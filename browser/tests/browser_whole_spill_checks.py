"""Controlled-frame UI checks for a partially outside blob and visible full-spill fall."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
import json,math
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page.add_init_script("window.__frames=[];window.requestAnimationFrame=cb=>(window.__frames.push(cb),1);window.__step=(ms=16.667)=>{window.__time=(window.__time??performance.now())+ms;const f=window.__frames.shift();if(f)f(window.__time);};const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def fixture(x,y,vx,vy,entered):
  radius=19.5;nodes=[{'x':x+radius*math.cos(k*math.pi/12),'y':y+radius*math.sin(k*math.pi/12),'px':x+radius*math.cos(k*math.pi/12)-vx/120,'py':y+radius*math.sin(k*math.pi/12)-vy/120} for k in range(24)]
  b={'level':0,'x':x,'y':y,'vx':vx,'vy':vy,'age':3,'danger':0,'shape':[0]*24,'spring':[0]*24,'nodes':nodes,'renderRadius':radius,'inBottle':entered,'hasEntered':entered}
  e={'bottleVersion':2,'blobs':[b],'score':64,'shots':1,'current':2,'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':1,'level':0},{'id':2,'level':2},{'id':3,'level':4}],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':10,'viscosity':0,'blobSize':150}}
  page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':128,'sound':False})),wait_until='networkidle');page.locator('#start').click()
 def state():return page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine")
 fixture(295,125,0,0,True);page.evaluate('__step()');assert page.locator('#overlay').is_hidden();assert page.locator('#shoot').is_enabled()
 page.screenshot(path=str(out/'partial-spill-still-playing.png'))
 page.evaluate('for(let i=0;i<130;i++)__step()');assert page.locator('#overlay').is_hidden();assert state()['over']==False
 # A missed blob is allowed to descend, and the entire membrane clears before loss.
 fixture(330,90,0,65,False);clear=None
 for k in range(180):
  page.evaluate('__step()');s=state()
  if s['over']:clear=s;break
 assert clear and clear['endReason']=='spill';assert page.locator('#overlay').is_hidden()
 assert min(n['y'] for n in clear['blobs'][0]['nodes'])>112
 y=clear['blobs'][0]['y'];page.screenshot(path=str(out/'whole-spill-visible-fall.png'))
 page.evaluate('for(let i=0;i<15;i++)__step()');assert page.locator('#overlay').is_hidden()
 page.screenshot(path=str(out/'whole-spill-falling-later.png'))
 page.evaluate('for(let i=0;i<40;i++)__step()');expect(page.locator('#overlay-title')).to_have_text('A little spill.')
 final=state();assert final['blobs'][0]['y']>y+25 and final['score']==64 and final['shots']==1
 assert not errors,errors
 print(json.dumps({'passed':True,'checks':['half-out blob remains playable','no capacity timer loss while partly inside','full-outline exit detection','visible fall before results','score and shot count frozen'],'browser_errors':errors}))
 browser.close()
