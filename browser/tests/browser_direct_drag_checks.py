"""Real touch outside dragging, charge-to-shoot force, and aim gestures."""
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
  e={'blobs':[],'score':0,'shots':0,'current':levels[1],'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':i+1,'level':n} for i,n in enumerate(levels)],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':30,'viscosity':20,'blobSize':80}}
  page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':0,'sound':False})),wait_until='networkidle');page.locator('#start').click();expect(page.locator('#shoot')).to_be_enabled(timeout=15000);page.wait_for_timeout(600)
  return page.locator('#canvas').bounding_box()
 session=page.context.new_cdp_session(page)
 for slot in range(3):
  rect=fixture();box=page.locator(f'#rack-{slot}').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2;tx=rect['x']+rect['width']*.15;ty=rect['y']-25
  session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
  for k in range(1,11):session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+(tx-x)*k/10,'y':y+(ty-y)*k/10}]})
  session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  assert read()['shots']==0 and not read()['blobs'] and len(read()['rack'])==3
  page.wait_for_timeout(1800)
 def slot_center(index):
  box=page.locator(f'#rack-{index}').bounding_box();rect=page.locator('#canvas').bounding_box()
  return ((box['x']+box['width']/2-rect['x'])/rect['width']*360,(box['y']+box['height']/2-rect['y'])/rect['height']*420)
 def from_slot(state,home):
  shot=state['blobs'][-1];return abs(shot['x']-home[0])<6 and abs(shot['y']-58)<6
 # Quick and held presses send different speeds from the selected blob's own slot.
 speeds=[];origins=[]
 for hold,slot in [(40,1),(1150,1),(400,0),(400,2)]:
  fixture()
  if slot!=1:page.locator('#canvas').focus();page.keyboard.press('Digit'+str(slot+1));page.wait_for_timeout(100)
  home=slot_center(slot);box=page.locator('#shoot').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
  session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});page.wait_for_timeout(hold)
  if hold>1000:page.screenshot(path=str(out/'black-hole-charge.png'))
  session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  state=read();assert state['shots']==1 and from_slot(state,home),(slot,home,state['blobs'][-1]['x'],state['blobs'][-1]['y'])
  origins.append(round(state['blobs'][-1]['x'],1))
  if slot==1:speeds.append(state['blobs'][-1]['vy'])
 assert speeds[1]>speeds[0]*4,speeds
 assert origins[2]<origins[0]-30 and origins[3]>origins[0]+30,origins
 # An aiming drag starts inside glass and launches from the selected blob, never the cursor.
 rect=fixture();home=slot_center(1);x=rect['x']+rect['width']*.5;y=rect['y']+150/420*rect['height'];tx=rect['x']+rect['width']*.7;ty=rect['y']+300/420*rect['height']
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(tx,ty,steps=12);page.screenshot(path=str(out/'black-hole-aim.png'));page.mouse.up()
 state=read();assert state['shots']==1 and from_slot(state,home) and state['blobs'][-1]['vx']>0
 # Cancel an aim by returning above the glass; sliding Shoot down to zero force cancels a charge.
 rect=fixture();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,rect['y']+25,steps=8);page.mouse.up();assert read()['shots']==0
 box=page.locator('#shoot').bounding_box();page.mouse.move(box['x']+20,box['y']+10);page.mouse.down();page.mouse.move(box['x']+20,box['y']+50,steps=6);page.mouse.up();assert read()['shots']==0
 fixture([9,10,11]);assert page.locator('#rack-2').get_attribute('aria-label').startswith('4096');page.screenshot(path=str(out/'black-hole-4096.png'))
 assert not errors,errors
 print(json.dumps({'passed':True,'checks':['real touch drags return all three values','no direct placement','quick/charged shot force','touch shots launch from the selected slot','mouse aim and cancel','charge cancellation','4096 UI'],'speeds':speeds,'origins':origins,'browser_errors':errors}))
 browser.close()
