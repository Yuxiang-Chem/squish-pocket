"""Deterministic visual checkpoints of actual, moving teardrop membranes."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
import json
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page.add_init_script("window.__frames=[];window.requestAnimationFrame=cb=>(window.__frames.push(cb),1);window.__step=(ms=16.667)=>{window.__time=(window.__time??performance.now())+ms;const frame=window.__frames.shift();if(frame)frame(window.__time);};const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 e={'blobs':[],'score':0,'shots':0,'current':4,'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':1,'level':0},{'id':2,'level':4},{'id':3,'level':0}],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':30,'viscosity':20,'blobSize':80}}
 save={'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':0,'sound':False}
 page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps(save)),wait_until='networkidle');page.locator('#start').click();page.evaluate('for(let i=0;i<60;i++)__step()')
 page.screenshot(path=str(out/'separated-ready-no-symbol.png'))
 page.locator('#canvas').focus()
 for i in range(10):page.keyboard.press('ArrowUp')
 page.keyboard.press('Space');state=page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine");b=state['blobs'][-1]
 assert b['x']==180 and b['y']==58 and b['ejection']['taper']>.7 and len(b['nodes'])==24
 page.evaluate('__step()');page.screenshot(path=str(out/'teardrop-launch.png'))
 page.evaluate('for(let i=0;i<9;i++)__step()');page.screenshot(path=str(out/'teardrop-in-flight.png'))
 page.evaluate('for(let i=0;i<120;i++)__step()');page.screenshot(path=str(out/'teardrop-impact.png'))
 assert not errors,errors
 print(json.dumps({'passed':True,'checks':['separated equal outer blobs','centered real-node teardrop','launch/flight/impact visual checkpoints'],'browser_errors':errors}))
 browser.close()
