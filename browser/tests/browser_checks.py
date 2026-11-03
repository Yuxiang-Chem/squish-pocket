"""General shooting, game persistence, controls, and phone layout checks."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json,os
url=os.environ.get('GAME_URL','http://127.0.0.1:4173');output=Path('/tmp/squish-pocket-qa');output.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 assert page.goto(url,wait_until='networkidle').status==200
 page.screenshot(path=str(output/'phone-start.png'));page.locator('#start').click()
 def slot_center(index):
  # Wait for the row to settle, then convert the ready blob's hit box to world units.
  previous=None
  for _ in range(40):
   box=page.locator(f'#rack-{index}').bounding_box();rect=page.locator('#canvas').bounding_box()
   current=((box['x']+box['width']/2-rect['x'])/rect['width']*360,(box['y']+box['height']/2-rect['y'])/rect['height']*420)
   if previous and abs(current[0]-previous[0])<.3 and abs(current[1]-previous[1])<.3:return current
   previous=current;page.wait_for_timeout(100)
  return current
 origins=[]
 for i in range(20):
  expect(page.locator('#shoot')).to_be_enabled(timeout=15000)
  # Keyboard selection can choose each cluster member independently.
  page.locator('#canvas').focus();page.keyboard.press('Digit'+str(i%3+1))
  before=page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine");chosen=next(b for b in before['rack'] if b['id']==before['selectedId'])
  home=slot_center(i%3)
  box=page.locator('#shoot').bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.wait_for_timeout(30+(i%3)*180);page.mouse.up()
  state=page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine");shot=state['blobs'][-1]
  assert state['shots']==i+1 and shot['level']==chosen['level'],state
  # Each blob launches from its own place in the row, not from the middle.
  assert abs(shot['x']-max(80,min(280,home[0])))<8 and abs(shot['y']-58)<8,(i%3,home,shot['x'],shot['y'])
  origins.append(round(shot['x']))
  assert len(state['rack'])==3
  assert page.locator('#next').count()==0,'The incoming preview is removed'
 expect(page.locator('#shoot')).to_be_enabled(timeout=15000);page.wait_for_timeout(900)
 assert int(page.locator('#score').inner_text().replace(',',''))>0
 page.screenshot(path=str(output/'phone-playing.png'))
 page.locator('#pause').click();assert page.locator('#overlay-title').inner_text()=='Take a breather.';page.locator('#start').click()
 page.locator('#help').click();assert page.locator('#guide').is_visible();page.locator('#guide [data-close]').first.click()
 page.locator('#settings').click();page.locator('#stiffness').press('End')
 for _ in range(10):page.locator('#stiffness').press('ArrowLeft')
 page.locator('#viscosity').press('End')
 for _ in range(20):page.locator('#viscosity').press('ArrowLeft')
 assert page.locator('#stiffness-value').inner_text()=='90%' and page.locator('#viscosity-value').inner_text()=='80%'
 assert page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine.physics")=={'stiffness':90,'viscosity':80,'blobSize':150}
 page.screenshot(path=str(output/'phone-settings.png'));page.locator('#settings-dialog [data-close]').last.click()
 page.locator('#sound').click();assert page.locator('#sound').get_attribute('aria-pressed')=='false'
 page.reload(wait_until='networkidle');assert 'Right where' in page.locator('#overlay-title').inner_text();page.locator('#start').click()
 page.locator('#restart').click();page.locator('#reset-dialog [data-close]').click();assert page.locator('#overlay').is_hidden()
 page.locator('#restart').click();page.locator('#confirm-reset').click();assert page.locator('#score').inner_text()=='0'
 assert page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine.physics")=={'stiffness':90,'viscosity':80,'blobSize':150}
 page.locator('#settings').click();page.locator('#reset-physics').click();assert page.locator('#blobSize').count()==0;page.locator('#settings-dialog [data-close]').last.click()
 expect(page.locator('#shoot')).to_be_enabled(timeout=15000);page.locator('#canvas').focus();page.keyboard.press('Digit1');page.keyboard.press('ArrowLeft');page.keyboard.press('ArrowUp');page.keyboard.press('Space')
 state=page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine");assert state['shots']==1 and state['blobs'][-1]['vx']<0
 for w,h in [(375,667),(320,568),(430,932)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(150)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1')
  box=page.locator('#canvas').bounding_box();assert abs(box['width']/box['height']-360/420)<.008
  assert page.locator('#shoot').is_visible()
 desk=browser.new_page(viewport={'width':1440,'height':1000});desk.goto(url,wait_until='networkidle');desk.screenshot(path=str(output/'desktop-start.png'));assert desk.locator('.left-notes').is_visible() and desk.locator('.right-notes').is_visible()
 assert not errors,errors
 assert min(origins)<165 and max(origins)>195,origins
 print(json.dumps({'passed':True,'origins':origins,'checks':['20 shots from each selected slot cycling all three values','positive score','previews','pause/help/sound','settings and saves','restart','keyboard','phone and desktop layouts'],'browser_errors':errors}))
 browser.close()
