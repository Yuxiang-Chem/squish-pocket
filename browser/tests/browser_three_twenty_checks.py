"""20% Three Combine ratio for every vessel, plus one-time saved-pile resizing. No real writes."""
from playwright.sync_api import sync_playwright,expect
from urllib.parse import urlparse,parse_qs
from pathlib import Path
import os,json,math,time
base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4181').rstrip('/')
assert urlparse(base).hostname in ['127.0.0.1','localhost','squish-test.chemisgreat.online']
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def records(route):
   mode=parse_qs(urlparse(route.request.url).query).get('merge',['two'])[0];board={'record':None,'leaderboard':[],'highestTile':1 if mode=='three' else 2,'isRecordHolder':False};now=int(time.time()*1000)
   route.fulfill(status=200,json={**board,'mergeMode':mode,'achievementEpoch':2 if mode=='three' else 1,'milestone':2187 if mode=='three' else 2048,'reachedMilestone':0,'totalMilestones':0,'milestoneTrackingSince':now,'announcement':{'publishedAt':now-1000,'expiresAt':now+172799000} if mode=='three' else None,'emailReady':False,'bottles':{id:{**board,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}})
  page.route('**/api/**',lambda r:r.abort());page.route('**/api/achievements*',records);page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page.goto(base,wait_until='domcontentloaded')
  data=page.evaluate('''async()=>{
   const q=new URL(document.querySelector('script[type=module]').src).search;
   const {Engine,blob,radiusFor}=await import('./engine.js'+q),{RackMotion}=await import('./rack-motion.js'+q),{prepare,measure}=await import('./softbody.js'+q);
   const ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water'],ratios=[],fixtures={};
   for(const id of ids){const two=new Engine(42,id,'two'),three=new Engine(42,id,'three'),rack=[{id:1,level:0},{id:2,level:1},{id:3,level:2}],a=new RackMotion(),b=new RackMotion();a.setBottle(id);b.setBottle(id);a.setPhysics(two.physics,'two');b.setPhysics(three.physics,'three');a.reset(rack);b.reset(rack);ratios.push({id,base:two.physics.blobSize,effective:three.physics.blobSize*three.rules.blobScale,body:three.radius(2)/two.radius(2),ready:b.items.map((item,i)=>item.body.renderRadius/a.items[i].body.renderRadius)});}
   for(const [mode,id] of [['two','classic'],['three','lab-flask'],['three','conical-flask-water']]){
    const e=new Engine(42,id,mode);e.score=mode==='three'?27:24;e.shots=7;e.highestLevel=2;e.blobScale=mode==='three'?1.3:1;
    const b=blob(1,180,300);b.renderRadius=radiusFor(1,e.physics.blobSize,'two')*e.blobScale;prepare(b,b.renderRadius,1/120);measure(b,1/120);b.inBottle=true;b.hasEntered=true;for(const n of b.nodes)n.bottleSide=true;e.blobs=[b];
    const key='squish-pocket-v1'+(mode==='three'?':three':'')+(id==='classic'?'':':'+id);fixtures[key]=JSON.stringify({version:1,engine:e,started:true,best:e.score,sound:false});
   }return {ratios,fixtures};
  }''')
  for row in data['ratios']:
   assert math.isclose(row['body'],1.2) and all(math.isclose(v,1.2) for v in row['ready']),row
   expected=180 if row['id'].startswith('classic') else 144 if row['id'].startswith('lab-flask') else 120
   assert math.isclose(row['effective'],expected),row
  page.add_init_script('if(new URL(location.href).searchParams.has("twentyfixture")){if(!sessionStorage.getItem("twentyInstalled")){for(const [k,v] of Object.entries('+json.dumps(data['fixtures'])+'))localStorage.setItem(k,v);sessionStorage.setItem("twentyInstalled","1");}}')
  for mode,id in [('two','classic'),('three','lab-flask'),('three','conical-flask-water')]:
   page.goto(base+'/?merge='+mode+'&twentyfixture=1',wait_until='domcontentloaded')
   if mode=='three':expect(page.locator('#three-announcement')).to_contain_text('20% larger')
   page.locator('#mode-classic').click();page.locator('[data-bottle="'+id+'"]').click();page.locator('#classic-play').click();page.locator('#pause').click()
   key='squish-pocket-v1'+(':three' if mode=='three' else '')+(':'+id if id!='classic' else '')
   first=page.evaluate('key=>JSON.parse(localStorage.getItem(key)).engine',key);old=json.loads(data['fixtures'][key])['engine'];scale=1.2 if mode=='three' else 1
   assert first['blobScale']==scale and first['score']==old['score'] and first['shots']==7 and first['milestoneRun']==old['milestoneRun']
   assert math.isclose(first['blobs'][0]['renderRadius']/old['blobs'][0]['renderRadius'],scale/old['blobScale'])
   page.reload(wait_until='domcontentloaded');page.locator('#mode-classic').click();page.locator('[data-bottle="'+id+'"]').click();page.locator('#classic-play').click();page.locator('#pause').click()
   again=page.evaluate('key=>JSON.parse(localStorage.getItem(key)).engine',key);assert again['score']==old['score'] and again['shots']==7
   assert math.isclose(again['blobs'][0]['renderRadius'],first['blobs'][0]['renderRadius'])
  assert not errors,errors
  print(json.dumps({'browser':name,'allVesselBodyAndReadyRatios':1.2,'effectiveSizes':[180,144,120],'previous130PercentSaveShrinksOnce':True,'twoUnchanged':True,'scoresShotsAndRunIdentityPreserved':True,'realRecordWrites':False,'errors':errors}),flush=True);browser.close()
