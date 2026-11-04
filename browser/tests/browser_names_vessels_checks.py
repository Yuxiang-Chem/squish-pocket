"""Mock record writes; exercise optional naming and both laboratory vessels on mobile."""
import os,json,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4173')
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 for browser_name in ['chromium','webkit']:
  browser=getattr(p,browser_name).launch()
  page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  profile={'id':str(uuid.uuid4()),'token':str(uuid.uuid4()),'name':'A squishy friend','score':512,'highestTile':128,'bottles':{'separating-funnel':{'score':512,'highestTile':128}}}
  page.add_init_script('if(!localStorage.getItem("squish-pocket-achievements-v1"))localStorage.setItem("squish-pocket-achievements-v1",'+json.dumps(json.dumps(profile))+');')
  def records(route):
   data=route.request.post_data_json if route.request.method=='POST' else {}
   summary={'reached2048':0,'highestTile':128,'record':{'score':512,'name':data.get('name','A squishy friend')},'isRecordHolder':True,'emailReady':False,'bottles':{}}
   for id in ids:
    won=id=='separating-funnel'
    summary['bottles'][id]={'record':{'score':512,'name':data.get('name','A squishy friend')} if won else None,'isRecordHolder':won,'highestTile':128 if won else 2,'personal':{'score':512 if won else 0,'highestTile':128 if won else 2},**({'recordEpoch':2,'recordPersonal':{'score':0,'highestTile':2}} if id=='lab-flask' else {})}
   route.fulfill(status=200,json=summary)
  page.route('**/api/achievements',records)
  page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page.goto(base,wait_until='networkidle')
  expect(page.locator('#champion-page')).to_be_visible()
  expect(page.locator('#champion-name-form')).to_be_visible()
  assert page.locator('#champion-name').input_value()==''
  assert not page.locator('#champion-name').evaluate('(e)=>e.required')
  expect(page.locator('#champion-name-form')).to_contain_text('It’s optional.')
  for w,h in [(320,568),(430,932),(390,844)]:
   page.set_viewport_size({'width':w,'height':h})
   assert page.locator('#champion-page').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
   assert page.locator('#champion-name-form button').is_visible()
  page.screenshot(path=str(out/f'optional-champion-name-{browser_name}.png'))
  page.locator('#champion-page [data-close]').last.click()
  page.locator('#menu-achievements').click()
  assert page.locator('#achievement-name').input_value()==''
  assert page.locator('.achievement-bottle-tabs [role=tab]').count()==9
  page.locator('#achievement-tab-separating-funnel').click()
  page.locator('#achievement-page-separating-funnel [data-celebrate]').click()
  page.locator('#champion-name').fill('Ada')
  page.locator('#champion-name-form button').click()
  expect(page.locator('#champion-name-status')).to_have_text('Your name is on the board.')
  expect(page.locator('#champion-name-form')).to_be_hidden()
  page.locator('#champion-page [data-close]').last.click()
  page.locator('#menu-achievements').click()
  assert page.locator('#achievement-name').input_value()=='Ada'
  page.locator('#achievement-name').click();page.keyboard.type('Marie')
  assert page.locator('#achievement-name').input_value()=='Marie'
  page.locator('#achievement-name-form button').click()
  expect(page.locator('#achievement-page-separating-funnel [data-holder]')).to_contain_text('Marie')
  page.reload(wait_until='networkidle');expect(page.locator('#champion-page')).to_be_hidden()
  page.locator('#menu-achievements').click()
  assert page.locator('#achievement-name').input_value()=='Marie'
  page.locator('#achievement-tab-conical-flask').click()
  expect(page.locator('#achievement-tab-conical-flask')).to_have_attribute('aria-selected','true')
  for w,h in [(320,568),(430,932)]:
   page.set_viewport_size({'width':w,'height':h})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert page.locator('#achievements-dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
  page.locator('#achievements-dialog [data-close]').click()
  page.locator('#mode-classic').click()
  assert page.locator('[data-bottle]').count()==8
  for id,title in [('separating-funnel','Separating funnel'),('conical-flask','Conical flask'),('separating-funnel-water','Separating funnel · water'),('conical-flask-water','Conical flask · water')]:
   page.locator('[data-bottle="'+id+'"]').click()
   page.screenshot(path=str(out/f'new-vessels-menu-{browser_name}.png'))
   page.locator('#classic-play').click()
   expect(page.locator('#canvas')).to_have_attribute('aria-label',__import__('re').compile(title))
   page.wait_for_timeout(1200)
   page.screenshot(path=str(out/f'{id}-game-{browser_name}.png'))
   page.reload(wait_until='networkidle')
   page.locator('#mode-classic').click()
  assert not errors,errors
  print(json.dumps({'browser':browser_name,'optionalNames':True,'replaceOnTyping':True,'savedName':True,'eightVessels':True,'nineBoards':True,'mobileLayout':True,'errors':errors}),flush=True)
  browser.close()
