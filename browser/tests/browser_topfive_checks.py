"""Top-five layouts and reduced frosted funnel; mock all remote score writes."""
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import os,json
base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4173')
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
rows=[{'rank':i+1,'name':name,'score':score,'isYou':i==2} for i,(name,score) in enumerate([('Ada',1000000000),('A very long champion name to wrap',4096),('<img src=x onerror=alert(1)>',2048),('Marie',1024),('A squishy friend',512)])]
summary={'record':rows[0],'leaderboard':rows,'highestTile':2048,'reached2048':5,'isRecordHolder':False,'emailReady':False,'bottles':{id:{'record':rows[0],'leaderboard':rows,'highestTile':2048,'isRecordHolder':False,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}}
summary['bottles']['separating-funnel-water']={**summary['bottles']['separating-funnel-water'],'leaderboard':rows[:2]}
summary['bottles']['conical-flask']={**summary['bottles']['conical-flask'],'record':None,'leaderboard':[]}
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/api/achievements',lambda route:route.fulfill(status=200,json=summary))
  page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page.goto(base,wait_until='networkidle');page.locator('#menu-achievements').click()
  for id in ['all']+ids:
   page.locator('#achievement-tab-'+id).click();expect(page.locator('#achievement-tab-'+id)).to_have_attribute('aria-selected','true')
   board=page.locator('[data-leaderboard="'+id+'"]');assert board.locator('li').count()==5
   assert board.locator('.leader-rank').all_text_contents()==['1','2','3','4','5']
   if id=='conical-flask':assert board.locator('.leader-name').all_text_contents()==['Open spot']*5
   elif id=='separating-funnel-water':assert board.locator('.leader-name').all_text_contents()[2:]==['Open spot']*3
   else:
    assert board.locator('strong').first.inner_text()=='1,000,000,000'
    assert board.locator('.leader-name').nth(2).inner_text()=='<img src=x onerror=alert(1)> · you'
    assert board.locator('img').count()==0
  page.locator('#achievement-tab-all').click()
  for w,h in [(320,568),(430,932),(390,844)]:
   page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(200)
   assert page.locator('#achievements-dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.locator('[data-leaderboard="all"]').scroll_into_view_if_needed();page.screenshot(path=str(out/f'topfive-{name}.png'))
  page.locator('#achievements-dialog [data-close]').click();page.locator('#mode-classic').click()
  for id in ['separating-funnel','separating-funnel-water']:
   page.locator('[data-bottle="'+id+'"]').click();page.locator('#classic-play').click()
   actual=page.evaluate('''async id=>{const {BOTTLES}=await import('./bottles.js?v=52');const g=BOTTLES[id],m=g.mouths[0];return {width:Math.abs(m.a.x-m.b.x),version:g.BOTTLE_VERSION};}''',id)
   assert abs(actual['width']-280*2/3)<.0001 and actual['version']==5,actual
   page.wait_for_timeout(1200);page.screenshot(path=str(out/f'frosted-{id}-{name}.png'))
   page.reload(wait_until='networkidle');page.locator('#mode-classic').click()
  assert not errors,errors
  print(json.dumps({'browser':name,'topFiveAllNineBoards':True,'safeNames':True,'emptyAndPartialBoards':True,'phoneWidths':True,'reducedFrostedFunnels':True,'errors':errors}),flush=True)
  browser.close()
