"""Vessel defaults and eight individual achievement boards; API writes are mocked."""
from playwright.sync_api import sync_playwright,expect
from urllib.parse import urlparse,parse_qs
from pathlib import Path
import os,json
base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4178').rstrip('/')
assert urlparse(base).hostname in ['127.0.0.1','localhost','squish-test.chemisgreat.online']
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
sizes={'classic':150,'classic-water':150,'lab-flask':120,'lab-flask-water':120,**{id:100 for id in ids if 'funnel' in id or 'conical' in id}}
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def records(route):
   mode=parse_qs(urlparse(route.request.url).query).get('merge',['two'])[0];rows=[{'rank':i+1,'name':'Player '+str(i+1),'score':(900-i*60) if mode=='three' else (800-i*40),'highestTile':81 if mode=='three' else 64,'isYou':False} for i in range(5)]
   board={'record':rows[0],'leaderboard':rows,'highestTile':81 if mode=='three' else 64,'isRecordHolder':False}
   route.fulfill(status=200,json={**board,'mergeMode':mode,'achievementEpoch':2 if mode=='three' else 1,'milestone':2187 if mode=='three' else 2048,'reachedMilestone':9,'totalMilestones':15,'milestoneTrackingSince':1793806994000,'emailReady':False,'bottles':{id:{**board,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}})
  page.route('**/api/**',lambda r:r.abort());page.route('**/api/achievements*',records);page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  for mode in ['two','three']:
   for id,size in sizes.items():
    page.goto(base+'/?merge='+mode,wait_until='domcontentloaded');page.locator('#mode-classic').click();page.locator('[data-bottle="'+id+'"]').click();page.locator('#classic-play').click()
    key='squish-pocket-v1'+(':three' if mode=='three' else '')+(':'+id if id!='classic' else '')
    saved=page.evaluate('key=>JSON.parse(localStorage.getItem(key)).engine',key)
    assert saved['physics']=={'stiffness':10,'viscosity':0,'blobSize':size},(id,mode,saved['physics'])
    assert saved['blobScale']==(1.3 if mode=='three' else 1)
   page.locator('#achievements').click();assert page.locator('#achievement-tab-all').count()==0;assert page.locator('#achievement-page-all').count()==0
   assert page.locator('.achievement-bottle-tabs [role=tab]').count()==8
   for id in ids:
    page.locator('#achievement-tab-'+id).click();board=page.locator('[data-leaderboard="'+id+'"]');assert board.locator('li').count()==5;assert board.locator('.leader-rank').all_text_contents()==['1','2','3','4','5'];expect(page.locator('#achievement-tab-'+id)).to_have_attribute('aria-selected','true')
   expect(page.locator('#achievement-page-number')).to_have_text('8 / 8')
   page.locator('#achievement-tab-'+ids[-1]).press('Home');expect(page.locator('#achievement-page-number')).to_have_text('1 / 8')
   page.locator('#achievement-tab-classic').press('End');expect(page.locator('#achievement-page-number')).to_have_text('8 / 8')
   for width,height in [(320,568),(430,932)]:page.set_viewport_size({'width':width,'height':height});assert page.locator('#achievements-dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
   out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True);page.screenshot(path=str(out/f'vessel-achievements-{mode}-{name}.png'));page.locator('#achievements-dialog [data-close]').click()
  assert not errors,errors
  print(json.dumps({'browser':name,'all16VesselModeDefaults':True,'waterVariants':True,'eightBoardsAndTopFive':True,'AllBottlesRemoved':True,'keyboardAndPhoneLayouts':True,'realRecordWrites':False,'errors':errors}),flush=True);browser.close()
