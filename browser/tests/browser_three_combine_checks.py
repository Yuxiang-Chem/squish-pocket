"""Mode picker, triple merge, save/record isolation and mobile Three Combine UI."""
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
from urllib.parse import urlparse,parse_qs
import json,os,uuid
base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:','http://localhost:','https://squish-test.chemisgreat.online')), 'Use local or test QA only.'
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
  errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)))
  old={'id':str(uuid.uuid4()),'token':str(uuid.uuid4()),'name':'Original friend','score':4096,'highestTile':2048,'bottles':{'classic':{'score':4096,'highestTile':2048}}}
  page.add_init_script('if(!localStorage.getItem("squish-pocket-achievements-v1"))localStorage.setItem("squish-pocket-achievements-v1",'+json.dumps(json.dumps(old))+');')
  def records(route):
   triple=parse_qs(urlparse(route.request.url).query).get('merge')==['three'];requests.append({'triple':triple,'method':route.request.method})
   start=1 if triple else 2
   data={'mergeMode':'three' if triple else 'two','achievementEpoch':2 if triple else 1,'milestone':2187 if triple else 2048,'reachedMilestone':0,'reached2048':0,'highestTile':start,'record':None,'leaderboard':[],'emailReady':False,'isRecordHolder':False,'bottles':{id:{'record':None,'leaderboard':[],'highestTile':start,'isRecordHolder':False,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}}
   route.fulfill(status=200,json=data)
  page.route('**/api/achievements*',records);page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page.goto(base,wait_until='networkidle');page.locator('[data-merge-mode=three]').click();page.wait_for_url('**merge=three');page.wait_for_load_state('networkidle')
  expect(page.locator('[data-merge-mode=three]')).to_have_attribute('aria-pressed','true');assert page.locator('.menu-friends span').all_text_contents()==['1','3','9']
  page.screenshot(path=str(out/f'three-combine-home-{name}.png'))
  page.locator('#menu-achievements').click();expect(page.locator('.achievement-badge')).to_have_text('2187');expect(page.locator('#achievement-personal-score')).to_have_text('0')
  assert page.locator('[data-leaderboard]').count()==9;page.locator('#achievements-dialog [data-close]').click()
  page.locator('#mode-classic').click();assert page.locator('[data-bottle]').count()==8;page.locator('[data-bottle=classic]').click();page.locator('#classic-play').click()
  expect(page.locator('#merge-rule-badge')).to_be_visible();saved=page.evaluate('JSON.parse(localStorage.getItem("squish-pocket-v1:three"))');assert saved['engine']['mergeMode']=='three'
  assert page.evaluate('JSON.parse(localStorage.getItem("squish-pocket-achievements-v1")).score')==4096
  result=page.evaluate('''async()=>{
   const {Engine,blob}=await import('./engine.js?v=61');const {prepare,measure}=await import('./softbody.js?v=61');const e=new Engine(42,'classic','three');
   e.blobs=[145,180,215].map(x=>blob(0,x,300));for(const b of e.blobs){prepare(b,e.radius(0),1/120);measure(b,1/120);b.inBottle=true;b.hasEntered=true;for(const n of b.nodes)n.bottleSide=true;}
   for(let i=0;i<50;i++)e.step(1/120);
   localStorage.setItem('squish-pocket-v1:three',JSON.stringify({version:1,engine:e,started:true,best:e.score,sound:false}));return {score:e.score,levels:e.blobs.map(b=>b.level),mode:e.mergeMode};
  }''');assert result=={'score':3,'levels':[1],'mode':'three'},result
  # Navigation triggers the active game's pagehide save, so seed a fixture via init script on the next load.
  snapshot=page.evaluate('localStorage.getItem("squish-pocket-v1:three")');page.add_init_script('if(new URL(location.href).searchParams.has("triplefixture"))localStorage.setItem("squish-pocket-v1:three",'+json.dumps(snapshot)+');')
  page.goto(base+'/?merge=three&triplefixture=1&teststate=1',wait_until='networkidle');expect(page.locator('#score')).to_have_text('3');page.locator('#start').click()
  assert page.locator('.evolution-blob').all_text_contents()[:4]==['1','3','9','27']
  for w,h in [(320,568),(430,932),(390,844)]:
   page.set_viewport_size({'width':w,'height':h});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.screenshot(path=str(out/f'three-combine-game-{name}.png'))
  page.locator('#achievements').click();expect(page.locator('#achievement-personal-score')).to_have_text('3');expect(page.locator('#achievement-milestone')).to_contain_text('2,187')
  assert page.evaluate('JSON.parse(localStorage.getItem("squish-pocket-achievements-v1:three")).score')==3
  page.goto(base,wait_until='networkidle');page.locator('#menu-achievements').click();expect(page.locator('#achievement-personal-score')).to_have_text('4,096')
  assert any(r['triple'] for r in requests) and any(not r['triple'] for r in requests)
  page.locator('#achievements-dialog [data-close]').click()
  room={'code':'ABC234','mergeMode':'three','bottleId':'classic','phase':'lobby','round':0,'seed':0,'you':1,'winner':None,'reason':None,'players':[{'name':'Host','score':0,'highestTile':1,'status':'waiting','connected':False,'blobs':[]},{'name':'Guest','score':0,'highestTile':1,'status':'waiting','connected':False,'blobs':[]}]}
  page.route_web_socket('**/api/rooms/ABC234/connect',lambda socket:None)
  page.route('**/api/rooms/ABC234/join',lambda route:route.fulfill(status=200,json={'code':'ABC234'}))
  page.route('**/api/rooms/ABC234/session',lambda route:route.fulfill(status=200,json=room))
  page.locator('#mode-multiplayer').click();page.locator('#room-code-input').fill('ABC234');page.locator('#room-join-form button').click()
  page.wait_for_url('**merge=three&room=ABC234');expect(page.locator('#multiplayer-setup')).to_be_visible();expect(page.locator('#room-code-display')).to_have_text('ABC234')
  assert not errors,errors
  print(json.dumps({'browser':name,'tripleValuesAndMerge':True,'picker':True,'separateSavesAndBoards':True,'oldScoresRetained':True,'phoneLayouts':True,'crossModeRoomJoin':True,'errors':errors}),flush=True);browser.close()
