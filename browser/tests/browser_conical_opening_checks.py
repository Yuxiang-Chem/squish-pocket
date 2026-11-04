"""Double-width conical opening in dry/water variants and both merge modes."""
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
from urllib.parse import parse_qs,urlparse
import os,json
base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:','http://localhost:','https://squish-test.chemisgreat.online'))
ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def records(route):
   mode=parse_qs(urlparse(route.request.url).query).get('merge',['two'])[0];start=1 if mode=='three' else 2
   route.fulfill(status=200,json={'mergeMode':mode,'milestone':2187 if mode=='three' else 2048,'reachedMilestone':0,'reached2048':0,'record':None,'leaderboard':[],'isRecordHolder':False,'highestTile':start,'emailReady':False,'bottles':{id:{'record':None,'leaderboard':[],'isRecordHolder':False,'highestTile':start,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}})
  page.route('**/api/achievements*',records);page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  for mode in ['two','three']:
   for id in ['conical-flask','conical-flask-water']:
    page.goto(base+'/?merge='+mode,wait_until='networkidle');page.locator('#mode-classic').click();page.locator('[data-bottle="'+id+'"]').click();page.locator('#classic-play').click()
    actual=page.evaluate('''async id=>{const {BOTTLES}=await import('./bottles.js?v=59');const g=BOTTLES[id],m=g.mouths[0];return {width:Math.abs(m.a.x-m.b.x),version:g.BOTTLE_VERSION,floor:g.BOTTLE_FLOOR,wet:!!g.water};}''',id)
    assert actual=={'width':164,'version':2,'floor':408,'wet':id.endswith('-water')},actual
    expect(page.locator('#canvas')).to_have_attribute('aria-label',__import__('re').compile('Conical flask'))
    page.wait_for_timeout(1200)
    for w,h in [(320,568),(430,932),(390,844)]:
     page.set_viewport_size({'width':w,'height':h});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    page.screenshot(path=str(out/f'wide-conical-{mode}-{id}-{name}.png'))
  assert not errors,errors
  print(json.dumps({'browser':name,'opening':164,'dryAndWater':True,'bothMergeModes':True,'phoneWidths':True,'errors':errors}),flush=True);browser.close()
