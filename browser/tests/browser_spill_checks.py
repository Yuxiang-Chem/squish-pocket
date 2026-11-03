"""Spill game over, new defaults, and one-time saved-default migration."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
import json,math
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);")
 def state():return page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1'))")
 def controls(values):
  page.locator('#settings').click()
  for key,value in values.items():assert page.locator('#'+key).input_value()==str(value)
  page.locator('#settings-dialog [data-close]').last.click()
 def fixture(physics,defaults=None,blobs=(),shots=0):
  e={'blobs':list(blobs),'score':64,'shots':shots,'current':0,'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':1,'level':2},{'id':2,'level':0},{'id':3,'level':4}],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':physics}
  saved={'version':1,'engine':e,'started':True,'best':128,'sound':False}
  if defaults is not None:saved['physicsDefaultsVersion']=defaults
  page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps(saved)),wait_until='networkidle')
 default={'stiffness':10,'viscosity':0,'blobSize':150}
 page.goto('http://127.0.0.1:4173',wait_until='networkidle');controls(default)
 page.locator('#settings').click();page.locator('#stiffness').press('End');page.locator('#viscosity').press('End');page.locator('#blobSize').press('Home');page.locator('#reset-physics').click()
 for key,value in default.items():assert page.locator('#'+key).input_value()==str(value)
 page.screenshot(path=str(out/'spill-new-defaults.png'));page.locator('#settings-dialog [data-close]').last.click()
 page.locator('#start').click();expect(page.locator('#shoot')).to_be_enabled(timeout=15000);assert state()['engine']['physics']==default
 page.locator('#shoot').click();page.wait_for_timeout(650);assert not state()['engine']['over']
 # The widest, strongest aim still lands inside the bottle.
 fixture(default,1);page.locator('#start').click();page.locator('#canvas').focus()
 for _ in range(20):page.keyboard.press('ArrowRight')
 for _ in range(10):page.keyboard.press('ArrowUp')
 page.keyboard.press('Space');page.wait_for_timeout(3000);assert not state()['engine']['over'] and state()['engine']['shots']==1
 # A blob already flying past the rim ends the round before the overflow timer.
 r=19.5;nodes=[{'x':330+r*math.cos(k*math.pi/12),'y':90+r*math.sin(k*math.pi/12),'px':330+r*math.cos(k*math.pi/12)-300/120,'py':90+r*math.sin(k*math.pi/12)-65/120} for k in range(24)]
 missed={'level':0,'x':330,'y':90,'vx':300,'vy':65,'age':.2,'danger':0,'shape':[0]*24,'spring':[0]*24,'nodes':nodes,'renderRadius':r,'inBottle':False,'hasEntered':False}
 fixture(default,1,[missed],1);page.locator('#start').click()
 expect(page.locator('#overlay-title')).to_have_text('A little spill.',timeout=5000)
 assert 'Game over' in page.locator('#overlay-description').inner_text()
 assert 'GAME OVER' in page.locator('#hint').inner_text()
 saved=state();assert saved['engine']['over'] and saved['engine']['endReason']=='spill' and saved['engine']['shots']==1
 assert saved['engine']['score']==64 and saved['best']==128
 page.screenshot(path=str(out/'spill-game-over.png'));page.goto('http://127.0.0.1:4173',wait_until='networkidle');expect(page.locator('#overlay-title')).to_have_text('A little spill.')
 page.locator('#start').click();expect(page.locator('#shoot')).to_be_enabled(timeout=15000);assert state()['engine']['score']==0 and state()['best']==128 and state()['engine']['physics']==default
 # Previous stock defaults upgrade without resetting score or best.
 fixture({'stiffness':30,'viscosity':20,'blobSize':80});controls(default);page.locator('#start').click();page.wait_for_timeout(2400)
 saved=state();assert saved['physicsDefaultsVersion']==1 and saved['engine']['physics']==default and saved['engine']['score']==64 and saved['best']==128
 # A prior custom profile, and an intentional later choice of the old profile, both persist.
 fixture({'stiffness':18,'viscosity':50,'blobSize':110});controls({'stiffness':18,'viscosity':50,'blobSize':110})
 fixture({'stiffness':30,'viscosity':20,'blobSize':80},1);controls({'stiffness':30,'viscosity':20,'blobSize':80})
 assert not errors,errors
 print(json.dumps({'passed':True,'checks':['fresh defaults and Reset','valid center entry','missed shot game over','reason and progress persist','restart preserves best and settings','one-time default upgrade','custom settings preserved'],'browser_errors':errors}))
 browser.close()
