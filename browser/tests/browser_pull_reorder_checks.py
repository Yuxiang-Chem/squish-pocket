"""Phone mouse/touch: pull-to-charge, lift-to-insert, synthesis, cancellation."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
import json,re
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page.add_init_script("const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def read():
  page.evaluate("window.dispatchEvent(new Event('pagehide'))")
  return page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine")
 def fixture(levels=[0,2,4]):
  e={'bottleVersion':2,'blobs':[],'score':64,'shots':0,'current':levels[1],'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':i+1,'level':v} for i,v in enumerate(levels)],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':10,'viscosity':0,'blobSize':150}}
  page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':128,'sound':False})),wait_until='networkidle');page.locator('#start').click();expect(page.locator('#shoot')).to_be_enabled(timeout=15000);page.wait_for_timeout(500)
  return page.locator('#canvas').bounding_box()
 def center(slot):
  b=page.locator(f'#rack-{slot}').bounding_box();return b['x']+b['width']/2,b['y']+b['height']/2
 def move(x,y):page.mouse.move(x,y,steps=6)
 speeds=[]
 for slot,amount in [(0,50),(1,110),(2,180)]:
  rect=fixture();scale=rect['width']/360;x,y=center(slot);page.mouse.move(x,y);page.mouse.down();move(x,y+amount*scale);page.wait_for_timeout(100)
  s=read();assert s['shots']==0 and not s['blobs'];assert 'RELEASE TO SHOOT' in page.locator('#hint').inner_text()
  if slot==2:page.screenshot(path=str(out/'pull-down-full-charge.png'))
  page.mouse.up();s=page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine")
  assert s['shots']==1 and len(s['blobs'])==1 and s['blobs'][0]['level']==[0,2,4][slot],s
  assert s['blobs'][0]['x']==180 and s['blobs'][0]['y']==58;speeds.append(s['blobs'][0]['vy'])
 assert speeds[0]<speeds[1]<speeds[2] and speeds[2]>speeds[0]*2,speeds
 # Returning the charge to its starting height cancels. Pointer cancellation also cancels.
 for cancel in ['return','pointer']:
  rect=fixture();scale=rect['width']/360;x,y=center(1);page.mouse.move(x,y);page.mouse.down();move(x,y+140*scale)
  if cancel=='return':move(x,y)
  else:page.dispatch_event('#canvas','pointercancel',{'pointerId':1})
  page.mouse.up();assert read()['shots']==0
 # A lifted middle blob takes the right slot; the old right blob slides to the middle.
 for source,destination,expected in [(1,2,[1,3,2]),(0,2,[2,3,1]),(2,0,[3,1,2])]:
  rect=fixture();scale=rect['width']/360;x,y=center(source);tx,ty=center(destination);old_right=center(2)[0]
  page.mouse.move(x,y);page.mouse.down();move(x,y-60*scale);move(tx,y-60*scale);page.wait_for_timeout(450)
  assert read()['shots']==0
  if source==1:
   assert center(2)[0]<old_right-15*scale;page.screenshot(path=str(out/'lift-middle-push-right-preview.png'))
  move(tx,ty-25*scale);page.mouse.up();expect(page.locator('#shoot')).to_be_enabled(timeout=15000)
  s=read();assert [b['id'] for b in s['rack']]==expected,s
  assert s['shots']==0 and s['score']==64 and not s['blobs'];page.screenshot(path=str(out/f'lift-insert-{source}-{destination}.png'))
 # A charged pull can be brought back upward and changed into a safe rearrangement.
 rect=fixture();scale=rect['width']/360;x,y=center(1);tx,ty=center(2);page.mouse.move(x,y);page.mouse.down();move(x,y+100*scale);move(x,y-60*scale);move(tx,y-60*scale);move(tx,ty-25*scale);page.mouse.up();expect(page.locator('#shoot')).to_be_enabled(timeout=15000)
 assert [b['id'] for b in read()['rack']]==[1,3,2] and read()['shots']==0
 # Lifting first and then lowering toward the bottle never becomes a charged shot.
 rect=fixture();scale=rect['width']/360;x,y=center(1);page.mouse.move(x,y);page.mouse.down();move(x,y-50*scale);move(x,y+200*scale);page.mouse.up();assert read()['shots']==0
 # Matching targets stay available for synthesis.
 rect=fixture([0,2,0]);scale=rect['width']/360;x,y=center(0);tx,ty=center(2);page.mouse.move(x,y);page.mouse.down();move(x,y-65*scale);move(tx,y-65*scale);page.wait_for_timeout(250);move(tx,ty)
 page.wait_for_function("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine.rackEvents.some(e=>e.kind==='merge'&&e.from.includes(1)&&e.from.includes(3))",timeout=6000)
 page.mouse.up();expect(page.locator('#shoot')).to_be_enabled(timeout=15000);s=read();assert s['shots']==0 and s['score']==64 and not s['blobs']
 # Real touch supports both charging and insertion too.
 session=page.context.new_cdp_session(page)
 def touch(kind,points):session.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points})
 rect=fixture();scale=rect['width']/360;x,y=center(0);touch('touchStart',[{'x':x,'y':y}]);touch('touchMove',[{'x':x,'y':y+130*scale}]);assert read()['shots']==0;touch('touchEnd',[]);assert read()['shots']==1
 rect=fixture();scale=rect['width']/360;x,y=center(1);tx,ty=center(2);touch('touchStart',[{'x':x,'y':y}]);touch('touchMove',[{'x':x,'y':y-60*scale}]);touch('touchMove',[{'x':tx,'y':y-60*scale}]);touch('touchMove',[{'x':tx,'y':ty-25*scale}]);touch('touchEnd',[]);expect(page.locator('#shoot')).to_be_enabled(timeout=15000)
 assert [b['id'] for b in read()['rack']]==[1,3,2] and read()['shots']==0
 page.goto('http://127.0.0.1:4173',wait_until='networkidle');page.locator('#start').click();assert [b['id'] for b in read()['rack']]==[1,3,2]
 for w,h in [(320,568),(375,667),(430,932)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(120);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1')
 assert not errors,errors
 print(json.dumps({'passed':True,'checks':['all three downward pulls','distance-based force','charge cancellation and upward transition','middle-to-right preview push','stable insertion in both directions','lifting cannot fire','matching contact synthesis','real touch charge and insertion','reordered save/reload','phone layouts'],'launch_speeds':speeds,'browser_errors':errors}))
 browser.close()
