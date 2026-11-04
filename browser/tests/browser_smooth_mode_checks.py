"""No document navigation while switching rules; saves, identities and rooms stay scoped."""
from playwright.sync_api import sync_playwright,expect
from urllib.parse import urlparse,parse_qs
from pathlib import Path
import json,os,uuid
base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:','http://localhost:','https://squish-test.chemisgreat.online'))
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  errors=[];navigations=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:navigations.append(r.url) if r.is_navigation_request() and r.resource_type=='document' else None)
  for mode,score,tile,bottle in [('two',4096,2048,'conical-flask'),('three',900,729,'separating-funnel-water')]:
   profile={'id':str(uuid.uuid4()),'token':str(uuid.uuid4()),'mergeMode':mode,'name':mode+' friend','score':score,'highestTile':tile,'flaskRecord':{'epoch':2,'score':0,'highestTile':1 if mode=='three' else 2},'bottles':{bottle:{'score':score,'highestTile':tile}}}
   key='squish-pocket-achievements-v1'+(':three' if mode=='three' else '')
   page.add_init_script('if(!localStorage.getItem('+json.dumps(key)+'))localStorage.setItem('+json.dumps(key)+','+json.dumps(json.dumps(profile))+');')
  def records(route):
   mode=parse_qs(urlparse(route.request.url).query).get('merge',['two'])[0];body=route.request.post_data_json or {};requests.append((mode,body))
   board={'record':None,'leaderboard':[],'highestTile':1 if mode=='three' else 2,'isRecordHolder':False}
   route.fulfill(status=200,json={**board,'mergeMode':mode,'milestone':2187 if mode=='three' else 2048,'reachedMilestone':0,'emailReady':False,'bottles':{id:{**board,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}})
  page.route('**/api/achievements*',records);page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page.goto(base+'/?merge=two',wait_until='networkidle')
  page.evaluate('''async()=>{
   const {Engine}=await import('./engine.js?v=59');
   for(const [mode,id,score,shots] of [['two','conical-flask',8,2],['three','separating-funnel-water',9,3]]){
    const engine=new Engine(17,id,mode);engine.score=score;engine.shots=shots;engine.highestLevel=1;
    const suffix=mode==='three'?':three':'';
    localStorage.setItem('squish-pocket-selected-bottle'+suffix,id);
    localStorage.setItem('squish-pocket-v1'+suffix+':'+id,JSON.stringify({version:1,engine,started:true,best:score,sound:false}));
   }
  }''')
  page.reload(wait_until='networkidle');navigation_count=len(navigations)
  origin=page.evaluate('performance.timeOrigin');page.evaluate('window.modeSwitchSentinel={alive:true}')
  identities=page.evaluate("['','' + ':three'].map(s=>JSON.parse(localStorage.getItem('squish-pocket-achievements-v1'+s)).id)")
  for mode in ['three','two','three','two','three','two','three']:
   page.locator('[data-merge-mode='+mode+']').click();expect(page.locator('[data-merge-mode='+mode+']')).to_have_attribute('aria-pressed','true')
   assert parse_qs(urlparse(page.url).query)['merge']==[mode]
   assert page.evaluate('window.modeSwitchSentinel?.alive') and page.evaluate('performance.timeOrigin')==origin
   assert len(navigations)==navigation_count,navigations
   assert page.locator('.menu-friends span').all_text_contents()==(['1','3','9'] if mode=='three' else ['2','4','8'])
   assert page.locator('.evolution-blob').all_text_contents()[:4]==(['1','3','9','27'] if mode=='three' else ['2','4','8','16'])
   expect(page.locator('#mode-classic h2')).to_have_text('Three Combine' if mode=='three' else 'Classic')
   page.locator('#menu-achievements').click();expect(page.locator('[data-achievement-mode='+mode+']')).to_have_attribute('aria-pressed','true')
   expect(page.locator('#achievement-personal-score')).to_have_text('900' if mode=='three' else '4,096')
   expect(page.locator('#achievement-name')).to_have_value(mode+' friend');expect(page.locator('.achievement-badge')).to_have_text('2187' if mode=='three' else '2048')
   page.locator('#achievements-dialog [data-close]').click()
  assert page.evaluate("['',':three'].map(s=>JSON.parse(localStorage.getItem('squish-pocket-achievements-v1'+s)).id)")==identities
  for mode,bottle,score,shots in [('two','conical-flask',8,2),('three','separating-funnel-water',9,3)]:
   saved=page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).engine','squish-pocket-v1'+(':three' if mode=='three' else '')+':'+bottle)
   assert (saved['mergeMode'],saved['bottleId'],saved['score'],saved['shots'])==(mode,bottle,score,shots),saved
  page.locator('#mode-classic').click();expect(page.locator('[data-bottle=separating-funnel-water]')).to_have_attribute('aria-pressed','true');page.locator('[data-bottle=separating-funnel-water]').click();expect(page.locator('#classic-play')).to_contain_text('Start game')
  page.locator('#classic-play').click();expect(page.locator('#score')).to_have_text('9');expect(page.locator('#best')).to_have_text('900');expect(page.locator('#merge-rule-badge')).to_be_visible()
  assert len(navigations)==navigation_count and page.evaluate('performance.timeOrigin')==origin
  # Joining another rule uses the existing authenticated room connection.
  page.goto(base+'/?merge=two',wait_until='networkidle');navigation_count=len(navigations);origin=page.evaluate('performance.timeOrigin')
  room={'code':'ABC234','mergeMode':'three','bottleId':'classic','phase':'lobby','round':0,'seed':0,'you':1,'winner':None,'reason':None,'players':[{'name':'Host','score':0,'highestTile':1,'status':'waiting','connected':False,'blobs':[]},{'name':'Guest','score':0,'highestTile':1,'status':'waiting','connected':False,'blobs':[]}]}
  page.route_web_socket('**/api/rooms/ABC234/connect',lambda socket:None)
  page.route('**/api/rooms/ABC234/join',lambda route:route.fulfill(status=200,json={'code':'ABC234'}));page.route('**/api/rooms/ABC234/session',lambda route:route.fulfill(status=200,json=room))
  page.locator('#mode-multiplayer').click();page.locator('#room-code-input').fill('ABC234');page.locator('#room-join-form button').click()
  expect(page.locator('#room-code-display')).to_have_text('ABC234');expect(page.locator('#mode-description')).to_contain_text('Three Combine')
  assert len(navigations)==navigation_count and page.evaluate('performance.timeOrigin')==origin
  assert parse_qs(urlparse(page.url).query)['merge']==['three']
  for mode,body in requests:
   if body.get('score'):assert body['score']==(4096 if mode=='two' else 900),(mode,body)
  assert not errors,errors
  print(json.dumps({'browser':name,'noReloads':True,'sevenSwitches':True,'separateSavesAndIdentities':True,'instructionsAndEvolution':True,'otherRuleRoomWithoutReload':True,'errors':errors}),flush=True);browser.close()
