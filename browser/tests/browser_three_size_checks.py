"""Three Combine bodies and preparation grow 30%, including a one-time old-save upgrade."""
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
from urllib.parse import urlparse,parse_qs
import json,os,math
base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:','http://localhost:','https://squish-test.chemisgreat.online'))
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def records(route):
   mode=parse_qs(urlparse(route.request.url).query).get('merge',['two'])[0];board={'record':None,'leaderboard':[],'highestTile':1 if mode=='three' else 2,'isRecordHolder':False}
   route.fulfill(status=200,json={**board,'mergeMode':mode,'achievementEpoch':2 if mode=='three' else 1,'milestone':2187 if mode=='three' else 2048,'reachedMilestone':0,'emailReady':False,'bottles':{id:{**board,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}})
  page.route('**/api/**',lambda r:r.abort());page.route('**/api/achievements*',records);page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page.goto(base+'/?merge=two',wait_until='domcontentloaded')
  comparison=page.evaluate('''async()=>{
   const {Engine,blob,radiusFor}=await import('./engine.js?v=61'),{prepare,measure}=await import('./softbody.js?v=61'),{RackMotion}=await import('./rack-motion.js?v=61');const sizes={fixtures:{}};
   for(const mode of ['two','three']){
    const e=new Engine(42,'classic',mode);e.score=mode==='three'?9:4;e.shots=1;e.highestLevel=2;e.rack=[{id:1,level:0},{id:2,level:1},{id:3,level:2}];e.rackSerial=3;e.selectedId=2;e.syncRack();
    const b=blob(0,180,300);b.renderRadius=radiusFor(0);prepare(b,b.renderRadius,1/120);measure(b,1/120);b.inBottle=true;b.hasEntered=true;for(const n of b.nodes)n.bottleSide=true;e.blobs=[b];delete e.blobScale;
    sizes.fixtures['squish-pocket-v1'+(mode==='three'?':three':'')]=JSON.stringify({version:1,engine:e,started:true,best:e.score,sound:false});
    const rack=new RackMotion();rack.setPhysics(e.physics,mode);rack.reset(e.rackOrder());sizes[mode]={body:e.radius(0),ready:rack.items.map(b=>b.body.renderRadius)};
   }return sizes;
  }''')
  page.add_init_script('if(new URL(location.href).searchParams.has("sizefixture")&&!sessionStorage.getItem("sizefixtureSeeded")){for(const [k,v] of Object.entries('+json.dumps(comparison['fixtures'])+'))localStorage.setItem(k,v);sessionStorage.setItem("sizefixtureSeeded","1");}')
  assert math.isclose(comparison['three']['body']/comparison['two']['body'],1.3)
  assert all(math.isclose(a/b,1.3) for a,b in zip(comparison['three']['ready'],comparison['two']['ready']))
  for mode,score in [('two','4'),('three','9')]:
   page.goto(base+'/?merge='+mode+'&sizefixture=1',wait_until='domcontentloaded');page.locator('#mode-classic').click();page.locator('[data-bottle=classic]').click();page.locator('#classic-play').click();expect(page.locator('#score')).to_have_text(score)
   key='squish-pocket-v1'+(':three' if mode=='three' else '')
   saved=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).engine',key)
   scale=1.3 if mode=='three' else 1
   assert saved['blobScale']==scale and saved['shots']==1
   assert math.isclose(saved['blobs'][0]['renderRadius'],19.5*scale)
   page.locator('#canvas').press('Space');page.wait_for_timeout(250)
   fired=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).engine',key)
   assert fired['shots']==2 and len(fired['blobs'])==2
   assert all(math.isclose(b['renderRadius'],19.5*1.2**b['level']*scale) for b in fired['blobs'])
   for w,h in [(320,568),(390,844),(430,932)]:
    page.set_viewport_size({'width':w,'height':h});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   page.screenshot(path=str(out/f'larger-three-{mode}-{name}.png'))
   page.reload(wait_until='domcontentloaded');page.locator('#mode-classic').click();page.locator('[data-bottle=classic]').click();page.locator('#classic-play').click()
   again=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).engine',key)
   assert again['blobScale']==scale and again['shots']==2 and again['score']==int(score)
   assert all(math.isclose(b['renderRadius'],19.5*1.2**b['level']*scale) for b in again['blobs'])
  assert not errors,errors
  print(json.dumps({'browser':name,'threeSizeMultiplier':1.3,'readyAndBottleBodies':True,'twoSizePreserved':True,'legacySaveUpgradeOnce':True,'shotsAndScoresPreserved':True,'phoneWidths':True,'errors':errors}),flush=True);browser.close()
