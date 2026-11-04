"""Read-only publication checks: public GET summaries; every browser API write is mocked."""
from playwright.sync_api import sync_playwright,expect
from urllib.parse import urlparse,parse_qs
from pathlib import Path
import os,json
base=os.environ['SQUISH_VERIFY_URL'].rstrip('/')
assert base in ['https://squish.chemisgreat.online','https://squish-test.chemisgreat.online']
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  errors=[];loaded=[];summaries={}
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:loaded.append(r.url))
  for mode in ['two','three']:
   response=page.request.get(base+'/api/achievements?merge='+mode);assert response.ok
   summaries[mode]=response.json();assert isinstance(summaries[mode]['totalMilestones'],int)
  def records(route):
   mode=parse_qs(urlparse(route.request.url).query).get('merge',['two'])[0]
   route.fulfill(status=200,json=summaries[mode])
  page.route('**/api/**',lambda r:r.abort());page.route('**/api/achievements*',records)
  page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page.goto(base,wait_until='domcontentloaded');assert page.locator('#mode-lab').count()==0
  page.locator('#menu-achievements').click()
  for mode,label in [('two','total 2048 blobs made'),('three','total 2,187 blobs made')]:
   page.locator('[data-achievement-mode='+mode+']').click()
   expect(page.locator('#achievement-total-label')).to_have_text(label)
   expect(page.locator('#achievement-total')).to_have_text(f"{summaries[mode]['totalMilestones']:,}")
   expect(page.locator('#achievement-count')).to_have_text(f"{summaries[mode]['reachedMilestone']:,}")
   expect(page.locator('#achievement-total-note')).to_contain_text('tracking since')
  for width,height in [(320,568),(430,932)]:
   page.set_viewport_size({'width':width,'height':height});assert page.locator('#achievements-dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
  assert not any(urlparse(url).path in ['/lab.js','/lab-rotors.js'] for url in loaded)
  assert not errors,errors
  out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True);page.locator('#achievement-total').scroll_into_view_if_needed();page.screenshot(path=str(out/f'official-milestone-totals-{name}.png'))
  print(json.dumps({'browser':name,'publicCountersMatchAPI':True,'LabAbsent':True,'phoneLayouts':True,'realRecordWrites':False,'errors':errors}),flush=True)
  browser.close()
