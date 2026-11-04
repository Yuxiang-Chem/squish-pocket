"""Browse both achievement modes without navigating or changing an active round."""
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
from urllib.parse import urlparse,parse_qs
import json,os,uuid
base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:','http://localhost:','https://squish-test.chemisgreat.online'))
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
  errors=[];requests=[];messages=[];page.on('pageerror',lambda e:errors.append(str(e)))
  for mode,score,tile,nick in [('two',4096,2048,'Two friend'),('three',900,729,'A squishy friend')]:
   profile={'id':str(uuid.uuid4()),'token':str(uuid.uuid4()),'mergeMode':mode,'achievementEpoch':2 if mode=='three' else 1,'name':nick,'flaskRecord':{'epoch':2,'score':0,'highestTile':1 if mode=='three' else 2},'recordCelebrations':{id:9000 for id in ids},'score':score,'highestTile':tile,'bottles':{'classic':{'score':score,'highestTile':tile},'conical-flask':{'score':score,'highestTile':tile}}}
   key='squish-pocket-achievements-v1'+(':three' if mode=='three' else '')
   page.add_init_script('if(!localStorage.getItem('+json.dumps(key)+'))localStorage.setItem('+json.dumps(key)+','+json.dumps(json.dumps(profile))+');')
  def records(route):
   mode=parse_qs(urlparse(route.request.url).query).get('merge',['two'])[0];body=route.request.post_data_json or {};requests.append((mode,body))
   triple=mode=='three';start=1 if triple else 2
   leaders=[{'rank':i+1,'name':mode+' player '+str(i+1),'score':(9000 if triple else 6000)-i*120,'isYou':triple and i==0} for i in range(5)]
   board={'record':leaders[0],'leaderboard':leaders,'highestTile':2187 if triple else 2048,'isRecordHolder':triple}
   route.fulfill(status=200,json={**board,'mergeMode':mode,'achievementEpoch':2 if mode=='three' else 1,'milestone':2187 if triple else 2048,'reachedMilestone':7 if triple else 4,'emailReady':True,'bottles':{id:{**board,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}})
  page.route('**/api/achievements*',records)
  page.route('**/api/record-message*',lambda r:(messages.append(r.request.url),r.fulfill(status=200,json={'mergeMode':'three','achievementEpoch':2,'ok':True})))
  page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page.goto(base+'/?merge=two',wait_until='networkidle');page.locator('#mode-classic').click();page.locator('[data-bottle=classic]').click();page.locator('#classic-play').click()
  original_url=page.url;best=page.locator('#best').inner_text();page.locator('#achievements').click()
  expect(page.locator('[data-achievement-mode=two]')).to_have_attribute('aria-pressed','true')
  page.locator('#achievement-tab-conical-flask').click();page.locator('[data-achievement-mode=three]').click()
  expect(page.locator('#achievement-status')).to_have_text('Three Combine records are up to date.')
  expect(page.locator('.achievement-badge')).to_have_text('2187');expect(page.locator('#achievement-count-label')).to_have_text('players have reached 2,187');expect(page.locator('#achievement-count')).to_have_text('7')
  expect(page.locator('#achievement-personal-score')).to_have_text('900');expect(page.locator('#achievement-personal-tile')).to_have_text('729');expect(page.locator('#achievement-name')).to_have_value('')
  expect(page.locator('#achievement-tab-conical-flask')).to_have_attribute('aria-selected','true')
  assert page.url==original_url;expect(page.locator('#best')).to_have_text(best)
  for id in ['all']+ids:
   page.locator('#achievement-tab-'+id).click();panel=page.locator('#achievement-page-'+id)
   expect(panel.locator('[data-leaderboard] li')).to_have_count(5)
   assert panel.locator('.leader-name').all_text_contents()==['three player 1 · you']+['three player '+str(i) for i in range(2,6)]
   assert panel.locator('[data-leaderboard] strong').all_text_contents()==[format(9000-i*120,',') for i in range(5)]
   expect(panel.locator('#achievement-milestone' if id=='all' else '[data-milestone]')).to_contain_text('2,187')
  page.locator('#achievement-tab-all').click();page.wait_for_timeout(500)
  if name=='chromium':
   page.locator('#achievement-page-all h3').scroll_into_view_if_needed()
   box=page.locator('#achievement-pages').bounding_box();heading=page.locator('#achievement-page-all h3').bounding_box()
   cdp=page.context.new_cdp_session(page);x=box['x']+box['width']*.86;y=heading['y']+40
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
   for i in range(1,11):
    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-box['width']*.075*i,'y':y}]});page.wait_for_timeout(30)
   cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(600)
  else:
   page.locator('#achievement-pages').focus();page.keyboard.press('ArrowRight');page.wait_for_timeout(500)
  expect(page.locator('#achievement-tab-classic')).to_have_attribute('aria-selected','true')
  page.locator('#achievement-tab-classic').focus();page.keyboard.press('End');page.wait_for_timeout(500)
  expect(page.locator('#achievement-tab-conical-flask-water')).to_have_attribute('aria-selected','true')
  page.locator('#achievement-tab-conical-flask').click()
  for w,h in [(320,568),(430,932),(390,844)]:
   page.set_viewport_size({'width':w,'height':h});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.screenshot(path=str(out/f'achievement-three-mode-{name}.png'))
  page.locator('#achievement-page-conical-flask [data-celebrate]').click();expect(page.locator('#champion-bottle-name')).to_have_text('Three Combine · Conical flask')
  page.locator('#champion-name').fill('Triple friend');page.locator('#champion-name-form button').click();expect(page.locator('#champion-name-status')).to_have_text('Your name is on the board.')
  page.locator('#champion-email').click();expect(page.locator('[data-achievement-mode=three]')).to_have_attribute('aria-pressed','true')
  page.locator('#record-message').fill('QA intercepted message');page.locator('#record-send').click();expect(page.locator('#record-message-status')).to_contain_text('Message sent')
  assert len(messages)==1 and messages[0].endswith('?merge=three')
  page.locator('[data-achievement-mode=two]').click();expect(page.locator('#achievement-status')).to_have_text('Two Combine records are up to date.')
  expect(page.locator('#achievement-personal-score')).to_have_text('4,096');expect(page.locator('.achievement-badge')).to_have_text('2048');expect(page.locator('#achievement-name')).to_have_value('Two friend')
  assert page.locator('[data-leaderboard=conical-flask] .leader-name').all_text_contents()==['two player '+str(i) for i in range(1,6)]
  page.locator('#achievements-dialog [data-close]').click();assert page.url==original_url;expect(page.locator('#best')).to_have_text(best)
  assert page.evaluate('JSON.parse(localStorage.getItem("squish-pocket-achievements-v1")).name')=='Two friend'
  assert page.evaluate('JSON.parse(localStorage.getItem("squish-pocket-achievements-v1:three")).name')=='Triple friend'
  page.goto(base+'/?merge=three',wait_until='networkidle');page.locator('#menu-achievements').click();expect(page.locator('[data-achievement-mode=three]')).to_have_attribute('aria-pressed','true');expect(page.locator('#achievement-personal-score')).to_have_text('900')
  assert not errors,errors
  print(json.dumps({'browser':name,'allNineTopFiveBoards':True,'separateNamesAndScores':True,'championAndMessages':True,'gamePreserved':True,'phoneLayouts':True,'errors':errors}),flush=True);browser.close()
