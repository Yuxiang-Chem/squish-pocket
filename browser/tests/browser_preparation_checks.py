"""Preparation drag boundaries, physical return, contact merging, and selection."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from urllib.parse import quote
import json
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page.add_init_script("const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def read():return page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine")
 def fixture(levels=[0,2,4]):
  e={'blobs':[],'score':0,'shots':0,'current':levels[1],'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':i+1,'level':v} for i,v in enumerate(levels)],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':30,'viscosity':20,'blobSize':80}}
  page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':0,'sound':False})),wait_until='networkidle');page.locator('#start').click();expect(page.locator('#shoot')).to_be_enabled(timeout=15000);page.wait_for_timeout(550)
  return page.locator('#canvas').bounding_box()
 def point(rect,x,y):return rect['x']+x/360*rect['width'],rect['y']+y/420*rect['height']
 def center(slot):
  box=page.locator(f'#rack-{slot}').bounding_box();return box['x']+box['width']/2,box['y']+box['height']/2
 rect=fixture();page.screenshot(path=str(out/'black-hole-cluster.png'))
 # Tap each member in the touching cluster; selection does not reorder inventory.
 for slot in range(3):
  x,y=center(slot);page.mouse.click(x,y);assert read()['selectedId']==slot+1;assert [b['id'] for b in read()['rack']]==[1,2,3]
 # A held blob can leave the canvas into the surrounding page, then returns under gravity.
 x,y=center(0);tx,ty=point(rect,35,-35);page.mouse.move(x,y);page.mouse.down();page.mouse.move(tx,ty,steps=16);page.wait_for_timeout(120)
 assert 'RELEASE TO RETURN' in page.locator('#hint').inner_text();page.screenshot(path=str(out/'black-hole-drag-outside.png'))
 box=page.locator('#rack-0').bounding_box();assert box['y']<rect['y']
 page.mouse.up();assert read()['shots']==0 and not read()['blobs'];page.wait_for_timeout(2400)
 box=page.locator('#rack-0').bounding_box();cx,cy=center(0);hx,hy=point(rect,180,58);assert abs(cx-hx)<rect['width']*.2 and abs(cy-hy)<rect['height']*.12
 page.screenshot(path=str(out/'black-hole-returned.png'))
 # A downward pull charges above the lip, and cancellation never shoots.
 x,y=center(1);tx,ty=point(rect,180,300);page.mouse.move(x,y);page.mouse.down();page.mouse.move(tx,ty,steps=15);page.wait_for_timeout(120)
 assert 'RELEASE TO SHOOT' in page.locator('#hint').inner_text();box=page.locator('#rack-1').bounding_box();_,mouth=point(rect,180,112)
 assert box['y']+box['height']<mouth+12;page.screenshot(path=str(out/'black-hole-glass-block.png'));page.dispatch_event('#canvas','pointercancel',{'pointerId':1});page.mouse.up()
 assert read()['shots']==0 and not read()['blobs'];page.wait_for_timeout(1800)
 # Cancelling a drag also returns it without consuming anything.
 x,y=center(2);tx,ty=point(rect,300,30);page.mouse.move(x,y);page.mouse.down();page.mouse.move(tx,ty,steps=8);page.dispatch_event('#canvas','pointercancel',{'pointerId':1});page.mouse.up();page.wait_for_timeout(1800)
 assert read()['shots']==0 and len(read()['rack'])==3
 # A blob released below the base travels around the glass instead of sticking there.
 x,y=center(0);page.mouse.move(x,y);page.mouse.down()
 for wx,wy in [(-8,40),(-8,520),(180,520)]:
  tx,ty=point(rect,wx,wy);page.mouse.move(tx,ty,steps=16)
 page.mouse.up();page.wait_for_timeout(7200);cx,cy=center(0);hx,hy=point(rect,180,58)
 assert abs(cx-hx)<rect['width']*.2 and abs(cy-hy)<rect['height']*.12
 assert read()['shots']==0 and not read()['blobs']
 # Equal side values stay available until the player explicitly brings them together.
 rect=fixture([0,2,0]);page.wait_for_timeout(2200);state=read()
 assert [b['level'] for b in state['rack']]==[0,2,0] and state['shots']==0
 left=page.locator('#rack-0').bounding_box();right=page.locator('#rack-2').bounding_box();assert left['x']+left['width']<right['x']
 page.screenshot(path=str(out/'ready-sides-separated.png'))
 x,y=center(0);tx,ty=center(2);_,above=point(rect,180,20)
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,above,steps=8);page.mouse.move(tx,above,steps=14);page.mouse.move(tx,ty,steps=8)
 page.wait_for_function("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine.rackEvents[0]?.kind==='merge'");page.screenshot(path=str(out/'manual-side-merge.png'));page.mouse.up()
 state=read();assert state['rackEvents'][0]['kind']=='merge' and state['rackEvents'][0]['from']==[1,3]
 expect(page.locator('#shoot')).to_be_enabled(timeout=15000);state=read();assert state['shots']==0 and state['score']==0 and len(state['rack'])==3 and any(b['level']==1 for b in state['rack'])
 assert state['physics']=={'stiffness':30,'viscosity':20,'blobSize':80}
 assert not errors,errors
 print(json.dumps({'passed':True,'checks':['tap all cluster members','drag outside canvas','physical return','glass blocks direct placement','cancel without firing','return around bottle base','separated equal sides persist','explicit drag merge and refill'],'browser_errors':errors}))
 browser.close()
