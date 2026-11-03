"""Verify the rendered guide begins at the selected membrane, including during return."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
import json
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page.add_init_script("""window.__frames=[];window.requestAnimationFrame=cb=>(__frames.push(cb),1);window.__step=()=>{window.__time=(window.__time??performance.now())+16.667;__frames.shift()?.(__time);};window.__guide=[];window.__selected=[];const move=CanvasRenderingContext2D.prototype.moveTo;CanvasRenderingContext2D.prototype.moveTo=function(x,y){const d=this.getLineDash();if((this.canvas.id==='canvas'||this.canvas.classList.contains('prep-drag-layer'))&&Math.abs(this.lineWidth-1.8)<.01&&d[0]===2&&d[1]===6)__guide.push({x,y});return move.call(this,x,y);};const ellipse=CanvasRenderingContext2D.prototype.ellipse;CanvasRenderingContext2D.prototype.ellipse=function(x,y,rx,ry,...args){const d=this.getLineDash();if((this.canvas.id==='canvas'||this.canvas.classList.contains('prep-drag-layer'))&&d[0]===2&&d[1]===3)__selected.push({x,y,rx,ry});return ellipse.call(this,x,y,rx,ry,...args);};const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);""")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 e={'blobs':[],'score':0,'shots':0,'current':2,'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':1,'level':0},{'id':2,'level':2},{'id':3,'level':4}],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':10,'viscosity':0,'blobSize':150}}
 save={'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':0,'sound':False}
 page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps(save)),wait_until='networkidle');page.locator('#start').click();page.evaluate('for(let i=0;i<60;i++)__step()');page.locator('#canvas').focus()
 starts=[]
 def capture(tolerance=.01):
  page.evaluate('__guide=[];__selected=[];__step()');data=page.evaluate('({guide:__guide.at(-1),selected:__selected.at(-1)})');g,s=data['guide'],data['selected']
  assert g and s,data
  assert abs(g["x"]-s["x"])<tolerance,data
  assert s['y']+s['ry']-8<g['y']<s['y']+s['ry']+5,data
  return g
 for slot in [1,2,3]:
  page.keyboard.press('Digit'+str(slot));page.keyboard.press('ArrowUp');g=capture();starts.append(g['x']);page.screenshot(path=str(out/f'aim-from-selected-{slot}.png'))
 assert starts[0]<160 and abs(starts[1]-180)<4 and starts[2]>200,starts
 # A selected blob in motion remains the guide's live origin.
 page.keyboard.press('Digit1');page.evaluate('__step()');box=page.locator('#rack-0').bounding_box();rect=page.locator('#canvas').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(rect['x']+30,rect['y']-20,steps=5);page.mouse.up();page.locator('#canvas').focus();page.keyboard.press('ArrowUp')
 first=capture();page.evaluate('for(let i=0;i<8;i++)__step()');last=capture();assert abs(last['x']-first['x'])>1
 page.screenshot(path=str(out/'aim-follows-returning-blob.png'))
 # Hold-to-shoot and bottle aiming use the same selected source for their guides.
 page.keyboard.press('Digit3');button=page.locator('#shoot').bounding_box();page.mouse.move(button['x']+20,button['y']+20);page.mouse.down();capture();page.dispatch_event('#shoot','pointercancel',{'pointerId':1});page.mouse.up()
 # Bottle aiming is measured from the selected blob, so pressing below it aims straight down.
 page.locator('#canvas').focus();page.keyboard.press('Digit3');page.evaluate('__step()')
 sel=page.locator('#rack-2').bounding_box();x=sel['x']+sel['width']/2;y=rect['y']+rect['height']*.5;page.mouse.move(x,y);page.mouse.down();capture(1);page.dispatch_event('#canvas','pointercancel',{'pointerId':1});page.mouse.up()
 assert not errors,errors
 print(json.dumps({'passed':True,'checks':['left/middle/right source','guide starts at membrane edge','live return position','charge button guide','bottle aim guide'],'origins':starts,'browser_errors':errors}))
 browser.close()
