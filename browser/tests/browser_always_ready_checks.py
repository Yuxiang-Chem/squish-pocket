"""WebKit and Chromium: real rapid Shoot taps and input during preparation motion."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
import json
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
reports=[]
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
  page.add_init_script("""window.__frames=[];window.requestAnimationFrame=cb=>(__frames.push(cb),1);window.__step=(count=1)=>{for(let i=0;i<count;i++){window.__time=(window.__time??performance.now())+16.667;__frames.shift()?.(__time);}};window.__ends=[];document.addEventListener('touchend',e=>__ends.push({prevented:e.defaultPrevented,cancelable:e.cancelable}));const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);""")
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def state():
   page.evaluate("window.dispatchEvent(new Event('pagehide'))")
   return page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine")
  def fixture():
   e={'bottleVersion':2,'blobs':[],'score':64,'shots':0,'current':2,'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':1,'level':0},{'id':2,'level':2},{'id':3,'level':4}],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':10,'viscosity':0,'blobSize':150}}
   page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':128,'sound':False})),wait_until='networkidle');page.locator('#start').click();page.evaluate('__step()')
   return page.locator('#canvas').bounding_box()
  def center(selector):
   b=page.locator(selector).bounding_box();return b['x']+b['width']/2,b['y']+b['height']/2
  def move(x,y):page.mouse.move(x,y,steps=5)
  def touch_tap():
   x,y=center('#shoot');page.touchscreen.tap(x,y)
  fixture()
  # No animation frames between touches: every subsequent tap arrives inside the old cooldown/refill.
  for k in range(6):
   touch_tap();s=state();assert s['shots']==k+1 and len(s['rack'])==3,s
   assert page.locator('#shoot').is_enabled() and page.locator('#shoot').get_attribute('aria-disabled')=='false'
  page.wait_for_timeout(350);assert abs(page.evaluate('visualViewport.scale')-1)<.01
  ends=page.evaluate('__ends');assert len(ends)>=6 and all(e['prevented'] for e in ends if e['cancelable']),ends
  # A selected shift has not finished, but another blob can already move.
  rect=fixture();scale=rect['width']/360;x,y=center('#rack-1');tx,ty=center('#rack-2')
  page.mouse.move(x,y);page.mouse.down();move(x,y-65*scale);move(tx,y-65*scale);move(tx,ty-25*scale);page.mouse.up()
  assert [b['id'] for b in state()['rack']]==[1,3,2]
  x,y=center('#rack-0');page.mouse.move(x,y);page.mouse.down();move(x-35*scale,y-70*scale);page.evaluate('__step(2)')
  held=center('#rack-0');assert held[1]<y-30*scale,(held,y)
  before=center('#rack-2');page.evaluate('__step(8)');after=center('#rack-2');assert abs(after[0]-before[0])+abs(after[1]-before[1])>1
  page.screenshot(path=str(out/f'{name}-independent-preparation-motion.png'));page.mouse.up()
  # The Shoot control works before these motions settle.
  touch_tap();assert state()['shots']==1
  # It also takes priority over an actively held blob and ignores that old pointer's later release.
  rect=fixture();scale=rect['width']/360;x,y=center('#rack-0');page.mouse.move(x,y);page.mouse.down();move(x-20*scale,y-60*scale)
  touch_tap();assert state()['shots']==1;page.mouse.up();assert state()['shots']==1
  # Pause/end remains an unavailable state, even though the native control stays touch-safe.
  fixture();page.locator('#pause').click();assert page.locator('#shoot').get_attribute('aria-disabled')=='true';touch_tap();assert state()['shots']==0
  assert not errors,errors
  reports.append({'browser':name,'rapid_shots':6,'touch_ends_guarded':len(ends),'viewport_scale':page.evaluate('visualViewport.scale'),'checks':['no cooldown/refill input lock','three logical ready blobs','second drag during first shift','previous motion continues','Shoot during return','Shoot preempts active drag without stale release','paused shots blocked'],'browser_errors':errors})
  browser.close()
 print(json.dumps({'passed':True,'reports':reports}))
