"""Bigger Shoot button with slide-to-aim, left/right selection, and diagonal pull charging."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
import json,math
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page.add_init_script("const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def fixture():
  e={'bottleVersion':2,'blobs':[],'score':0,'shots':0,'current':2,'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':1,'level':0},{'id':2,'level':2},{'id':3,'level':4}],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':10,'viscosity':0,'blobSize':150}}
  page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':0,'sound':False})),wait_until='networkidle')
  page.locator('#start').click();page.wait_for_timeout(500)
 def tap(selector):
  b=page.locator(selector).bounding_box();page.touchscreen.tap(b['x']+b['width']/2,b['y']+b['height']/2);page.wait_for_timeout(60)
 read=lambda:page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine")
 fixture()
 assert page.locator('#next').count()==0 and page.locator('.next').count()==0
 shoot=page.locator('#shoot').bounding_box();assert shoot['height']>=48 and shoot['width']>=180,shoot
 page.screenshot(path=str(out/'shoot-aim-controls.png'))
 # Left/right buttons walk the selection across the preparation row and stop at the ends.
 tap('#select-left');expect(page.locator('#rack-0')).to_have_attribute('aria-pressed','true')
 expect(page.locator('#select-left')).to_have_attribute('aria-disabled','true')
 tap('#select-left');expect(page.locator('#rack-0')).to_have_attribute('aria-pressed','true')
 tap('#select-right');tap('#select-right');expect(page.locator('#rack-2')).to_have_attribute('aria-pressed','true')
 expect(page.locator('#select-right')).to_have_attribute('aria-disabled','true')
 tap('#select-left');expect(page.locator('#rack-1')).to_have_attribute('aria-pressed','true')
 assert read()['shots']==0
 # Holding Shoot and sliding sideways steers the shot, even past the button edge.
 def hold_and_slide(dx,dy=0):
  b=page.locator('#shoot').bounding_box();x=b['x']+b['width']/2;y=b['y']+b['height']/2
  page.mouse.move(x,y);page.mouse.down()
  for k in range(1,9):page.mouse.move(x+dx*k/8,y+dy*k/8);page.wait_for_timeout(25)
  page.wait_for_timeout(200);hint=page.locator('#hint').inner_text();page.mouse.up();page.wait_for_timeout(80);return hint
 velocities=[]
 for dx in [90,-90,170]:
  fixture();before=read()['shots'];hint=hold_and_slide(dx)
  assert '←→ AIM' in hint,hint
  state=read();assert state['shots']==before+1,state['shots']
  vx=state['blobs'][-1]['vx'];velocities.append(vx);assert (vx>0)==(dx>0),(dx,vx)
 assert velocities[2]>velocities[0],'Sliding farther aims wider'
 # Sliding up sets force directly; sliding down to zero cancels.
 speed=lambda s:math.hypot(s['blobs'][-1]['vx'],s['blobs'][-1]['vy'])
 fixture();b=page.locator('#shoot').bounding_box();page.touchscreen.tap(b['x']+b['width']/2,b['y']+b['height']/2);page.wait_for_timeout(80);tap_speed=speed(read())
 fixture();hold_and_slide(0,-130);strong=read();assert strong['shots']==1 and speed(strong)>1000 and speed(strong)>tap_speed*3,(speed(strong),tap_speed)
 fixture();hold_and_slide(0,-60);mid=speed(read());assert tap_speed<mid<speed(strong),(tap_speed,mid)
 fixture();hold_and_slide(0,35);assert read()['shots']==0
 # A short diagonal pull toward the bottle charges and shows the guide right away.
 for dx in [16,-16]:
  fixture();r=page.locator('#rack-1').bounding_box();x=r['x']+r['width']/2;y=r['y']+r['height']/2
  page.mouse.move(x,y);page.mouse.down()
  for k in range(1,6):page.mouse.move(x+dx*k/5,y+9*k/5);page.wait_for_timeout(20)
  hint=page.locator('#hint').inner_text();assert 'RELEASE TO SHOOT' in hint,hint
  page.screenshot(path=str(out/f'diagonal-pull-{"right" if dx>0 else "left"}.png'))
  page.mouse.up();page.wait_for_timeout(80);assert read()['shots']==1
 for w,h in [(320,568),(375,667),(430,932)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(120)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1'),(w,h)
  boxes=[page.locator(s).bounding_box() for s in ['#select-left','#shoot','#select-right']]
  assert boxes[0]['x']+boxes[0]['width']<=boxes[1]['x'] and boxes[1]['x']+boxes[1]['width']<=boxes[2]['x'] and boxes[2]['x']+boxes[2]['width']<=w,(w,boxes)
  page.screenshot(path=str(out/f'shoot-aim-{w}x{h}.png'))
 assert not errors,errors
 print(json.dumps({'passed':True,'velocities':velocities,'browser_errors':errors}))
 browser.close()
