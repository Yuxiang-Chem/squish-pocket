"""Frame-stepped screenshots of a preparation-row merge (ring, sparks, jelly pop)."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright
import json
out=Path('/tmp/squish-pocket-qa/prep-merge');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page.add_init_script("window.__frames=[];window.requestAnimationFrame=cb=>(window.__frames.push(cb),1);window.__step=(ms=16.667)=>{window.__time=(window.__time??performance.now())+ms;const f=window.__frames.shift();if(f)f(window.__time);};const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def state():return page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine")
 e={'blobs':[],'score':64,'shots':0,'current':2,'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':1,'level':1},{'id':2,'level':0},{'id':3,'level':1}],'rackSerial':3,'selectedId':3,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':10,'viscosity':0,'blobSize':150}}
 page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':128,'sound':False})),wait_until='networkidle')
 page.locator('#start').click();page.evaluate('for(let i=0;i<90;i++)__step()')
 rect=page.locator('#canvas').bounding_box()
 clip={'x':rect['x'],'y':max(0,rect['y']-40),'width':rect['width'],'height':rect['height']*.32+40}
 def center(slot):
  b=page.locator(f'#rack-{slot}').bounding_box();return b['x']+b['width']/2,b['y']+b['height']/2
 x,y=center(0);tx,ty=center(2)
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(tx+60,ty,steps=1)
 merged=None;shots=[]
 for k in range(120):
  page.evaluate('__step()')
  if merged is None and any(b['level']==2 for b in state()['rack']):merged=k;page.mouse.up()
  if merged is not None and (k-merged)%2==0 and k-merged<40:
   path=out/f'frame-{k-merged:02d}.png';page.screenshot(path=str(path),clip=clip);shots.append(str(path))
 assert merged is not None,'drag did not merge'
 page.evaluate('for(let i=0;i<60;i++)__step()')
 s=state();assert [b['level'] for b in s['rack']].count(2)==1 and not s['over']
 assert not errors,errors
 print(json.dumps({'passed':True,'screenshots':shots,'browser_errors':errors}))
 browser.close()
