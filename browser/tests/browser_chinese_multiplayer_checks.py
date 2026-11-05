"""Chinese/English UI and real local two-player rooms. Shared records are mocked."""
from playwright.sync_api import sync_playwright,expect
from urllib.parse import urlparse,parse_qs
from pathlib import Path
import os,json,time
base=os.environ.get('SQUISH_TEST_URL','http://localhost:4184').rstrip('/')
local=urlparse(base).hostname in ['localhost','127.0.0.1']
assert local or urlparse(base).hostname=='squish-test.chemisgreat.online'
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
def records(route):
 mode=parse_qs(urlparse(route.request.url).query).get('merge',['two'])[0];board={'record':{'name':'Classic','score':2408,'highestTile':3 if mode=='three' else 2},'leaderboard':[{'name':'Classic','score':2408,'isYou':False}],'highestTile':3 if mode=='three' else 2,'isRecordHolder':False};now=int(time.time()*1000)
 route.fulfill(status=200,json={**board,'mergeMode':mode,'achievementEpoch':2 if mode=='three' else 1,'milestone':2187 if mode=='three' else 2048,'reachedMilestone':2,'totalMilestones':4,'milestoneTrackingSince':now,'announcement':None,'emailReady':False,'bottles':{id:{**board,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}})
def set_language(page,language):
 if page.locator('html').get_attribute('lang')!=language:page.locator('#language-select').click()
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();host=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);guest=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  errors=[]
  def setup(context):
   context.route('**/api/achievements*',records);context.route('**/api/record-message*',lambda r:r.abort());context.route('https://fonts.googleapis.com/**',lambda r:r.abort());context.route('https://fonts.gstatic.com/**',lambda r:r.abort())
   if not local:context.route('**/api/rooms**',lambda r:r.abort())
  setup(host);setup(guest);page=host.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base,wait_until='domcontentloaded');expect(page.locator('html')).to_have_attribute('lang','zh-CN');expect(page.locator('#mode-classic h2')).to_have_text('经典模式')
  token=page.evaluate('window.__noReloadToken=Math.random()')
  for width in [320,390,430]:
   page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  set_language(page,'en');expect(page.locator('#mode-classic h2')).to_have_text('Classic');assert page.evaluate('window.__noReloadToken')==token
  page.reload(wait_until='domcontentloaded');expect(page.locator('html')).to_have_attribute('lang','en');set_language(page,'zh-CN')
  page.locator('#menu-achievements').click();expect(page.locator('#achievements-title')).to_have_text('团子成就榜');expect(page.locator('.achievement-page')).to_have_count(8);expect(page.locator('.achievement-page').first.locator('.leader-name').first).to_have_text('Classic');expect(page.locator('.achievement-page').first.locator('.achievement-leaders h4')).to_have_text('前 5 名');page.locator('#achievements-dialog [data-close]').click()
  Path('/tmp/squish-pocket-qa').mkdir(exist_ok=True);page.screenshot(path='/tmp/squish-pocket-qa/'+name+'-chinese-home.png');page.locator('#mode-multiplayer').click();page.locator('#room-name').fill('Classic');card=page.locator('[data-bottle="conical-flask"]');card.click();expect(page.locator('#classic-actions')).to_be_visible();expect(page.locator('#classic-actions strong')).to_have_text('开始游戏');expect(page.locator('#classic-save-note')).to_have_text('创建房间，邀请朋友加入');expect(page.locator('#room-create')).to_be_hidden();page.screenshot(path='/tmp/squish-pocket-qa/'+name+'-chinese-card.png')
  set_language(page,'en');expect(page.locator('#classic-actions strong')).to_have_text('Start game');expect(page.locator('#room-name')).to_have_value('Classic');set_language(page,'zh-CN')
  if local:
   creates=[];page.on('request',lambda req:creates.append(req.post_data_json) if req.url.endswith('/api/rooms') and req.method=='POST' else None);token=page.evaluate('window.__noReloadToken=Math.random()')
   page.locator('#classic-play').click();expect(page.locator('#room-lobby')).to_be_visible(timeout=20000);expect(page.locator('#room-start')).to_be_disabled();expect(page.locator('#bottle-options')).to_be_hidden();assert len(creates)==1 and creates[0]['bottleId']=='conical-flask';code=page.locator('#room-code-display').inner_text();assert len(code)==6
   expect(page.locator('#room-players strong').first).to_have_text('Classic · 你 · 房主');set_language(page,'en');expect(page.locator('#room-players strong').first).to_have_text('Classic · you · host');expect(page.locator('#room-code-display')).to_have_text(code);assert page.evaluate('window.__noReloadToken')==token;set_language(page,'zh-CN')
   page.locator('#room-change-bottle').click();expect(page.locator('#bottle-options')).to_be_visible();page.locator('[data-bottle="classic-water"]').click();expect(page.locator('#bottle-options')).to_be_hidden()
   friend=guest.new_page();friend.on('pageerror',lambda e:errors.append(str(e)));friend.goto(base,wait_until='domcontentloaded');friend.locator('#mode-multiplayer').click();friend.locator('#room-name').fill('小团子');friend.locator('#room-code-input').fill(code);friend.locator('#room-join').click();expect(page.locator('#room-start')).to_be_enabled(timeout=20000);expect(friend.locator('#room-start')).to_be_hidden();expect(page.locator('#room-players')).to_contain_text('小团子')
   page.locator('#room-start').click();expect(page.locator('#game-layout')).to_be_visible();expect(friend.locator('#game-layout')).to_be_visible();expect(page.locator('#match-bar')).to_be_visible();expect(page.locator('#match-opponent-name')).to_have_text('小团子');expect(friend.locator('#match-opponent-name')).to_have_text('Classic')
   before=page.evaluate('localStorage.getItem("squish-pocket-match:'+code+':1")');page.evaluate('async()=>{const {setLanguage}=await import("./i18n.js?v=89");setLanguage("en")}');expect(page.locator('#match-opponent-name')).to_have_text('小团子');assert page.evaluate('window.__noReloadToken')==token;page.evaluate('async()=>{const {setLanguage}=await import("./i18n.js?v=89");setLanguage("zh-CN")}')
   page.locator('#game-home').click();page.locator('#confirm-home').click();expect(page.locator('#mode-home')).to_be_visible();friend.close()
   # A friend joining from Two Combine follows the host's Three Combine rule without navigation.
   page.locator('[data-merge-mode="three"]').click();page.locator('#mode-multiplayer').click();page.locator('[data-bottle="lab-flask"]').click();page.locator('#classic-play').click();expect(page.locator('#room-lobby')).to_be_visible();expect(page.locator('#room-start')).to_be_disabled();code3=page.locator('#room-code-display').inner_text()
   friend=guest.new_page();friend.goto(base+'/?merge=two',wait_until='domcontentloaded');friend.locator('#mode-multiplayer').click();friend.locator('#room-code-input').fill(code3);friend.locator('#room-join').click();expect(page.locator('#room-start')).to_be_enabled();expect(friend.locator('[data-merge-mode="three"]')).to_have_attribute('aria-pressed','true');page.locator('#room-start').click();expect(friend.locator('#game-layout')).to_be_visible();expect(friend.locator('#merge-rule-badge')).to_contain_text('三合一');expect(page.locator('#merge-rule-badge')).to_contain_text('三合一');page.locator('#game-home').click();page.locator('#confirm-home').click();expect(page.locator('#mode-home')).to_be_visible();friend.close()
  else:
   page.locator('#mode-back').click()
  page.goto(base+'/?merge=three',wait_until='domcontentloaded');expect(page.locator('#mode-classic h2')).to_have_text('三合一');page.locator('#mode-classic').click();page.locator('[data-bottle="classic"]').click();page.locator('#classic-play').click();expect(page.locator('#game-layout')).to_be_visible();page.locator('#settings').click();expect(page.locator('#settings-dialog')).to_be_visible();assert '设置' in page.locator('#settings-dialog').inner_text() or '软' in page.locator('#settings-dialog').inner_text();page.locator('#settings-dialog [data-close]').first.click()
  page.locator('#pause').click();key='squish-pocket-v1:three';saved=page.evaluate('key=>JSON.parse(localStorage.getItem(key))',key);page.evaluate('async()=>{const {setLanguage}=await import("./i18n.js?v=89");setLanguage("en")}');after=page.evaluate('key=>JSON.parse(localStorage.getItem(key))',key);assert saved['engine']['milestoneRun']==after['engine']['milestoneRun'] and saved['engine']['score']==after['engine']['score']
  assert not errors,errors
  Path('/tmp/squish-pocket-qa').mkdir(exist_ok=True);page.screenshot(path='/tmp/squish-pocket-qa/'+name+'-chinese-flow.png');print(json.dumps({'browser':name,'defaultChinese':True,'EnglishRemembered':True,'noReload':True,'namesAndCodesPreserved':True,'eightTopFiveBoards':True,'realLocalTwoPlayerMatch':local,'recordWritesMocked':True,'errors':errors}),flush=True);host.close();guest.close();browser.close()
