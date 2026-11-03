"""Saved-row normalization, automatic neighbor cascades, and the wide curved-mouth bottle."""
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
 def invariant():
  e=state();levels=[b['level'] for b in e['rack']];assert len(levels)==3 and levels[0]!=levels[1] and levels[1]!=levels[2],levels
  for i,b in enumerate(e['rack']):assert page.locator(f'#rack-{i}').get_attribute('aria-label').startswith(str(2**(b['level']+1)))
  return e
 def fixture(levels):
  e={'blobs':[],'score':64,'shots':0,'current':levels[1],'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':i+1,'level':v} for i,v in enumerate(levels)],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':10,'viscosity':0,'blobSize':150}}
  page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':128,'sound':False})),wait_until='networkidle');page.locator('#start').click();expect(page.locator('#shoot')).to_be_enabled(timeout=15000);page.wait_for_timeout(2200)
 for levels in [[0,0,2],[2,0,0],[0,0,0],[2,2,2],[11,11,3]]:
  fixture(levels);e=invariant();assert e['score']==64 and e['shots']==0
 fixture([0,2,0]);assert [b['level'] for b in state()['rack']]==[0,2,0]
 page.screenshot(path=str(out/'short-wide-curved-bottle.png'))
 page.locator('#shoot').click();expect(page.locator('#shoot')).to_be_enabled(timeout=15000);e=invariant()
 assert e['shots']==1 and e['score']==64 and e['rackEvents'][0]['from']==[1,3]
 for i in range(5):
  page.locator('#canvas').focus();page.keyboard.press('Digit'+str(i%3+1));page.locator('#shoot').click();expect(page.locator('#shoot')).to_be_enabled(timeout=15000);invariant()
 page.screenshot(path=str(out/'short-wide-bottle-playing.png'))
 page.goto('http://127.0.0.1:4173',wait_until='networkidle');page.locator('#start').click();invariant()
 for w,h in [(320,568),(375,667),(430,932)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(120);box=page.locator('#canvas').bounding_box()
  assert abs(box['width']/box['height']-360/420)<.008
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1')
  assert page.locator('#shoot').is_visible()
 assert not errors,errors
 print(json.dumps({'passed':True,'checks':['left/middle/right duplicate saved rows','triple cascades','capped duplicates separated','equal outer values kept','shoot-created neighbors combine','repeated shots preserve invariant','reload and phone layouts'],'browser_errors':errors}))
 browser.close()
