"""Milestone totals, retry-safe uploads and mobile layouts; all API writes mocked."""
from playwright.sync_api import sync_playwright,expect
from urllib.parse import urlparse,parse_qs
from pathlib import Path
import os,json,time
base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:','http://localhost:','https://squish-test.chemisgreat.online'))
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  errors=[];ledger={'two':{},'three':{}};sent=[];started=int(time.time()*1000)
  page.on('pageerror',lambda e:errors.append(str(e)))
  def records(route):
   mode=parse_qs(urlparse(route.request.url).query).get('merge',['two'])[0];body=route.request.post_data_json or {}
   if route.request.method=='POST':
    sent.append((mode,body))
    for run,count in body.get('milestoneRuns',{}).items():ledger[mode][run]=max(ledger[mode].get(run,0),count)
   total=sum(ledger[mode].values());milestone=2187 if mode=='three' else 2048
   board={'record':None,'leaderboard':[],'highestTile':milestone if total else 1 if mode=='three' else 2,'isRecordHolder':False}
   route.fulfill(status=200,json={**board,'mergeMode':mode,'achievementEpoch':2 if mode=='three' else 1,'milestone':milestone,'reachedMilestone':int(total>0),'totalMilestones':total,'milestoneTrackingSince':started,'emailReady':False,'bottles':{id:{**board,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}})
  page.route('**/api/**',lambda r:r.abort());page.route('**/api/achievements*',records)
  page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page.goto(base,wait_until='domcontentloaded')
  # Create real ready-row milestones, then resume those saves in the application.
  saves=page.evaluate('''async()=>{const saves={};
   const {Engine}=await import('./engine.js?v=62');const {refillRack}=await import('./rack.js?v=62');
   for(const mode of ['two','three']){
    const e=new Engine(7,'classic',mode),level=mode==='two'?9:6;
    for(let i=0;i<(mode==='two'?2:3);i++){
     e.rack=[{id:1,level},{id:2,level},{id:3,level:mode==='three'?level:0}];e.rackSerial=3;e.selectedId=1;e.incoming={level:0,side:'left'};
     refillRack(e,()=>({level:1,side:'left'}));e.syncRack();
    }
    saves['squish-pocket-v1'+(mode==='three'?':three':'')]=JSON.stringify({version:1,engine:e,started:true,best:0,sound:false});
   }return saves;
  }''')
  page.add_init_script('if(!sessionStorage.getItem("milestoneFixture")){for(const [k,v] of Object.entries('+json.dumps(saves)+'))localStorage.setItem(k,v);sessionStorage.setItem("milestoneFixture","1");}')
  page.reload(wait_until='domcontentloaded');page.locator('#menu-achievements').click();page.locator('#achievement-tab-all').click()
  expect(page.locator('#achievement-count')).to_have_text('1');expect(page.locator('#achievement-total')).to_have_text('2');expect(page.locator('#achievement-total-label')).to_have_text('total 2048 blobs made')
  expect(page.locator('#achievement-total-note')).to_contain_text('tracking since')
  page.locator('#achievement-refresh').click();expect(page.locator('#achievement-total')).to_have_text('2')
  page.locator('[data-achievement-mode=three]').click();expect(page.locator('#achievement-count')).to_have_text('1');expect(page.locator('#achievement-total')).to_have_text('3');expect(page.locator('#achievement-total-label')).to_have_text('total 2,187 blobs made')
  for w,h in [(320,568),(430,932),(390,844)]:
   page.set_viewport_size({'width':w,'height':h});assert page.locator('#achievements-dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.locator('#achievement-total').scroll_into_view_if_needed();out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True);page.screenshot(path=str(out/f'milestone-totals-{name}.png'))
  page.reload(wait_until='domcontentloaded');page.locator('#menu-achievements').click();page.locator('#achievement-tab-all').click();expect(page.locator('#achievement-total')).to_have_text('2')
  assert sum(ledger['two'].values())==2 and sum(ledger['three'].values())==3
  assert not errors,errors
  print(json.dumps({'browser':name,'repeatMergesCounted':True,'uniquePlayerCountRetained':True,'reloadAndRefreshDoNotDuplicate':True,'bothModesAndPhoneLayouts':True,'errors':errors}),flush=True)
  browser.close()
