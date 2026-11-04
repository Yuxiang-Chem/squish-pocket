"""Three-only achievement restart, protected old piles and a two-day release announcement."""
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
from urllib.parse import urlparse,parse_qs
import json,os,uuid,time
base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:','http://localhost:','https://squish-test.chemisgreat.online'))
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  page.clock.install();errors=[];sent=[];page.on('pageerror',lambda e:errors.append(str(e)))
  for mode,score,tile,nick in [('two',4096,2048,'Two friend'),('three',65610,6561,'zzz')]:
   profile={'id':str(uuid.uuid4()),'token':str(uuid.uuid4()),'mergeMode':mode,'name':nick,'score':score,'highestTile':tile,'bottles':{id:{'score':score,'highestTile':tile} for id in ids},'flaskRecord':{'epoch':2,'score':score,'highestTile':tile}}
   key='squish-pocket-achievements-v1'+(':three' if mode=='three' else '')
   page.add_init_script('if(!localStorage.getItem('+json.dumps(key)+'))localStorage.setItem('+json.dumps(key)+','+json.dumps(json.dumps(profile))+');')
  published=int(time.time()*1000)-1000;notice={'publishedAt':published,'expiresAt':published+172800000}
  def records(route):
   mode=parse_qs(urlparse(route.request.url).query).get('merge',['two'])[0];body=route.request.post_data_json or {}
   if route.request.method=='POST':sent.append((mode,body))
   board={'record':None,'leaderboard':[],'highestTile':1 if mode=='three' else 2,'isRecordHolder':False}
   route.fulfill(status=200,json={**board,'mergeMode':mode,'achievementEpoch':2 if mode=='three' else 1,'announcement':notice if mode=='three' else None,'milestone':2187 if mode=='three' else 2048,'reachedMilestone':0,'emailReady':False,'bottles':{id:{**board,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}})
  page.route('**/api/**',lambda r:r.abort());page.route('**/api/achievements*',records);page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page.goto(base+'/?merge=three',wait_until='domcontentloaded')
  snapshot=page.evaluate('''async()=>{const {Engine}=await import('./engine.js?v=61');const e=new Engine(42,'classic','three');delete e.achievementEpoch;e.score=65610;e.shots=200;e.highestLevel=8;return JSON.stringify({version:1,engine:e,started:true,best:65610,sound:false})}''')
  page.add_init_script('if(new URL(location.href).searchParams.has("oldpile")&&!sessionStorage.getItem("oldpileInstalled")){localStorage.setItem("squish-pocket-v1:three",'+json.dumps(snapshot)+');sessionStorage.setItem("oldpileInstalled","1");}')
  page.goto(base+'/?merge=three&oldpile=1',wait_until='domcontentloaded')
  expect(page.locator('#three-announcement')).to_be_visible();expect(page.locator('#three-announcement')).to_contain_text('zzz');expect(page.locator('#three-announcement')).to_contain_text('65,610')
  page.locator('#menu-achievements').click();expect(page.locator('#achievement-personal-score')).to_have_text('0');assert int(page.locator('#achievement-personal-tile').inner_text().replace(',',''))<2187;expect(page.locator('#achievement-name')).to_have_value('zzz')
  expect(page.locator('#achievement-season-note')).to_be_visible()
  for id in ['all']+ids:
   page.locator('#achievement-tab-'+id).click();assert page.locator('[data-leaderboard='+id+'] .leader-name').all_text_contents()==['Open spot']*5
  # Timers hide the notice even while its page remains open.
  page.clock.fast_forward(172801000);expect(page.locator('#achievement-season-note')).to_be_hidden();expect(page.locator('#three-announcement')).to_be_hidden()
  page.locator('[data-achievement-mode=two]').click();expect(page.locator('#achievement-personal-score')).to_have_text('4,096')
  page.locator('[data-achievement-mode=three]').click();expect(page.locator('#achievement-personal-score')).to_have_text('0');expect(page.locator('#achievement-season-note')).to_be_hidden()
  page.locator('#achievements-dialog [data-close]').click();page.locator('#mode-classic').click();page.locator('[data-bottle=classic]').click();page.locator('#classic-play').click()
  expect(page.locator('#score')).to_have_text('65,610');expect(page.locator('#best')).to_have_text('0')
  page.locator('#restart').click();page.locator('#confirm-reset').click();expect(page.locator('#score')).to_have_text('0');expect(page.locator('#best')).to_have_text('0')
  assert page.evaluate('JSON.parse(localStorage.getItem("squish-pocket-v1:three")).engine.achievementEpoch')==2
  assert all(body.get('score')==0 and body.get('achievementEpoch')==2 for mode,body in sent if mode=='three'),sent
  assert page.evaluate('JSON.parse(localStorage.getItem("squish-pocket-achievements-v1")).score')==4096
  assert not errors,errors
  print(json.dumps({'browser':name,'announcementThankYouAndTwoDayExpiry':True,'personalAndTopFiveReset':True,'oldPileCannotRestoreRecords':True,'twoRecordsPreserved':True,'errors':errors}),flush=True);browser.close()
