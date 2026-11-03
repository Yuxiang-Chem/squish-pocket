"""Double-tap zoom suppression and score summaries away from active play."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
import json
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page.add_init_script("const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def fixture(over=False,best=128):
  e={'bottleVersion':2,'blobs':[],'score':64,'shots':4,'current':2,'next':4,'cooldown':0,'over':over,'endReason':'spill' if over else None,'seed':123,'rack':[{'id':1,'level':0},{'id':2,'level':2},{'id':3,'level':4}],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':10,'viscosity':0,'blobSize':150}}
  page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':best,'sound':False})),wait_until='networkidle')
 fixture();expect(page.locator('#round-stats')).to_be_visible();expect(page.locator('#score')).to_have_text('64');expect(page.locator('#best')).to_have_text('128')
 page.locator('#start').click();expect(page.locator('#round-stats')).to_be_hidden();assert page.locator('.scores').count()==0
 assert 'Score' not in page.locator('#canvas').get_attribute('aria-label')
 actions=page.evaluate("({body:getComputedStyle(document.body).touchAction,game:getComputedStyle(document.querySelector('.game')).touchAction,settings:getComputedStyle(document.querySelector('#settings')).touchAction,canvas:getComputedStyle(document.querySelector('#canvas')).touchAction})")
 assert actions=={'body':'manipulation','game':'manipulation','settings':'manipulation','canvas':'none'},actions
 session=page.context.new_cdp_session(page)
 for selector in ['#hint','#select-left','#select-right']:
  b=page.locator(selector).bounding_box();session.send('Input.synthesizeTapGesture',{'x':b['x']+b['width']/2,'y':b['y']+b['height']/2,'tapCount':2,'gestureSourceType':'touch'})
  page.wait_for_timeout(120);assert abs(page.evaluate('visualViewport.scale')-1)<.01
 assert page.evaluate("document.querySelector('.game').dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}))")==False
 for slot in [0,2,1]:
  page.locator(f'#rack-{slot}').tap();expect(page.locator(f'#rack-{slot}')).to_have_attribute('aria-pressed','true')
  expect(page.locator('#round-stats')).to_be_hidden()
 page.screenshot(path=str(out/'clean-play-no-score-cards.png'))
 page.locator('#pause').click();expect(page.locator('#round-stats')).to_be_visible();expect(page.locator('#score')).to_have_text('64');expect(page.locator('#best')).to_have_text('128')
 page.screenshot(path=str(out/'pause-score-summary.png'));page.locator('#start').click();expect(page.locator('#score')).to_be_hidden()
 for w,h in [(320,568),(375,667),(430,932)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1')
  page.locator('#pause').click();expect(page.locator('#round-stats')).to_be_visible();page.locator('#start').click()
 fixture(True,32);expect(page.locator('#overlay-title')).to_have_text('A little spill.');expect(page.locator('#round-stats')).to_be_visible();expect(page.locator('#score')).to_have_text('64');expect(page.locator('#best')).to_have_text('64')
 page.screenshot(path=str(out/'game-over-score-summary.png'));page.locator('#start').click();expect(page.locator('#score')).to_be_hidden()
 assert not errors,errors
 print(json.dumps({'passed':True,'checks':['no score cards in active play','accurate pause and game-over summaries','best updated at finish','summary hidden after resume/restart','double touch taps keep viewport scale 1','game double-click default suppressed','real touch selection','phone layouts'],'touch_actions':actions,'browser_errors':errors}))
 browser.close()
