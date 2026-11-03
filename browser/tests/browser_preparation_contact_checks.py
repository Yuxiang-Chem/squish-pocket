"""Mouse/touch regression for both directions, edge contact, and return-only merging."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
import json
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page.add_init_script("const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def state():return page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine")
 def fixture(size=150):
  e={'blobs':[],'score':64,'shots':0,'current':2,'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':1,'level':0},{'id':2,'level':2},{'id':3,'level':0}],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':10,'viscosity':0,'blobSize':size}}
  page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':128,'sound':False})),wait_until='networkidle');page.locator('#start').click();expect(page.locator('#shoot')).to_be_enabled(timeout=15000);page.wait_for_timeout(650)
  return page.locator('#canvas').bounding_box()
 def box(slot):return page.locator(f'#rack-{slot}').bounding_box()
 def center(slot):
  b=box(slot);return b['x']+b['width']/2,b['y']+b['height']/2
 def point(rect,x,y):return rect['x']+x/360*rect['width'],rect['y']+y/420*rect['height']
 def merged():
  page.wait_for_function("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine.rack.some(b=>b.level===1)",timeout=6000)
  s=state();assert s['shots']==0 and s['score']==64 and len(s['rack'])==3 and not s['blobs'] and not s['over']
  assert set(s['rackEvents'][0]['from'])=={1,3}
 # Resting equal sides must still wait for player intent.
 fixture();page.wait_for_timeout(1800);assert [b['level'] for b in state()['rack']]==[0,2,0]
 # One fast move crosses the mismatching middle and both side outlines.
 for source in [0,2]:
  rect=fixture();x,y=center(source);tx,ty=center(2-source);direction=1 if source==0 else -1
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(tx+direction*60,ty,steps=1);merged()
  # Continuing the old gesture into glass must not turn it into a shot.
  bx,by=point(rect,180,260);page.mouse.move(bx,by);page.mouse.up();assert state()['shots']==0
  expect(page.locator('#shoot')).to_be_enabled(timeout=15000)
 # Return-only contact: travel above the row, release beyond the opposite side.
 for source in [0,2]:
  rect=fixture();x,y=center(source);tx,ty=center(2-source);direction=1 if source==0 else -1;above=point(rect,180,-70)[1];outside=tx+direction*100*rect['width']/360
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,above,steps=8);page.mouse.move(outside,above,steps=12);page.mouse.move(outside,ty,steps=8)
  assert [b['level'] for b in state()['rack']]==[0,2,0]
  page.mouse.up();merged();page.screenshot(path=str(out/f'return-contact-merge-{source}.png'));expect(page.locator('#shoot')).to_be_enabled(timeout=15000)
 # Real touch brushes the target's edge, well outside the former center hit area.
 session=page.context.new_cdp_session(page)
 for source in [0,2]:
  fixture();x,y=center(source);tx,ty=center(2-source);direction=1 if source==0 else -1;tx-=direction*box(source)['width']*.72
  session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
  session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':tx,'y':ty}]});merged()
  session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});expect(page.locator('#shoot')).to_be_enabled(timeout=15000)
 # Small custom blobs also merge along their return path.
 rect=fixture(80);x,y=center(2);tx,ty=center(0);above=point(rect,180,-60)[1];outside=tx-70
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,above,steps=8);page.mouse.move(outside,above,steps=12);page.mouse.move(outside,ty,steps=8)
 assert [b['level'] for b in state()['rack']]==[0,2,0];page.mouse.up();merged();expect(page.locator('#shoot')).to_be_enabled(timeout=15000)
 page.goto('http://127.0.0.1:4173',wait_until='networkidle');page.locator('#start').click();assert state()['score']==64 and state()['shots']==0 and state()['physics']['blobSize']==80
 assert not errors,errors
 print(json.dumps({'passed':True,'checks':['idle equal sides stay apart','fast left/right crossing merges before release','return-only merge in both directions','real touch edge brushes','old gesture cannot shoot','small custom blobs','state persists'],'browser_errors':errors}))
 browser.close()
