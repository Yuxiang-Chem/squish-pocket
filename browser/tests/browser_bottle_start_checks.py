"""Choose a bottle, show Start game inside the same card, then explicitly start."""
from playwright.sync_api import sync_playwright,expect
from urllib.parse import urlparse,parse_qs
from pathlib import Path
import os,json,re
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
   route.fulfill(status=200,json={**board,'mergeMode':mode,'milestone':2187 if mode=='three' else 2048,'reachedMilestone':0,'emailReady':False,'bottles':{id:{**board,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids}})
  page.route('**/api/**',lambda r:r.abort());page.route('**/api/achievements*',records)
  page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page.goto(base+'/?merge=two',wait_until='networkidle')
  page.evaluate('''async()=>{const {Engine}=await import('./engine.js?v=59');for(const mode of ['two','three']){const engine=new Engine(42,'classic-water',mode);engine.score=mode==='three'?9:12;engine.shots=3;engine.highestLevel=1;localStorage.setItem('squish-pocket-v1'+(mode==='three'?':three':'')+':classic-water',JSON.stringify({version:1,engine,started:true,best:engine.score,sound:false}));}}''')
  for mode in ['two','three']:
   page.locator('[data-merge-mode='+mode+']').click();page.locator('#mode-classic').click()
   expect(page.locator('#classic-play')).to_be_hidden()
   origin=page.evaluate('performance.timeOrigin')
   for id in ids:
    card=page.locator('[data-bottle="'+id+'"]');card.scroll_into_view_if_needed()
    before=page.locator('[data-bottle]').evaluate_all('(cards)=>cards.map(c=>{const r=c.getBoundingClientRect();return [r.x,r.y+scrollY,r.width,r.height]})')
    scroll=page.evaluate('scrollY');title=page.locator('#mode-title').inner_text()
    if id=='conical-flask-water':card.press('Enter')
    else:card.click()
    expect(page.locator('#mode-setup')).to_have_attribute('data-stage','bottles');expect(page.locator('#bottle-options')).to_be_visible();expect(page.locator('#game-layout')).to_be_hidden()
    expect(page.locator('#classic-play')).to_have_attribute('data-bottle',id)
    expect(card.locator('.bottle-start strong')).to_have_text('Start game');expect(card.locator('.friend')).to_be_visible()
    assert page.locator('[data-ready=true]').count()==1 and page.locator('[data-bottle]:visible').count()==8
    after=page.locator('[data-bottle]').evaluate_all('(cards)=>cards.map(c=>{const r=c.getBoundingClientRect();return [r.x,r.y+scrollY,r.width,r.height]})')
    assert before==after,(name,mode,id,before,after)
    assert abs(page.evaluate('scrollY')-scroll)<1 and page.locator('#mode-title').inner_text()==title
    assert page.evaluate('performance.timeOrigin')==origin
    for width,height in [(320,568),(390,844),(430,932)]:
     page.set_viewport_size({'width':width,'height':height});card.scroll_into_view_if_needed()
     box=card.bounding_box();face=card.locator('.bottle-start').bounding_box()
     assert box and face and abs(box['y']-face['y'])<2 and face['height']<=box['height']
     assert box['y']>=-1 and box['y']+box['height']<=height+1,(name,mode,id,width,box)
     assert card.evaluate('(c)=>c.querySelector(".bottle-start").scrollHeight<=c.clientHeight+2')
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    if id=='conical-flask-water':page.screenshot(path=str(out/f'bottle-card-start-{mode}-{name}.png'))
   # Selecting other cards did not touch a saved pile. The same card starts only on the second tap.
   key='squish-pocket-v1'+(':three' if mode=='three' else '')+':classic-water'
   saved=page.evaluate('(key)=>localStorage.getItem(key)',key)
   page.locator('[data-bottle=classic-water]').click();expect(page.locator('#classic-save-note')).to_contain_text('saved pile')
   page.wait_for_timeout(300);assert page.evaluate('(key)=>localStorage.getItem(key)',key)==saved
   page.locator('#classic-play').click();expect(page.locator('#game-layout')).to_be_visible();expect(page.locator('#overlay')).to_be_hidden();expect(page.locator('#score')).to_have_text('9' if mode=='three' else '12')
   assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).engine.shots',key)==3
   page.reload(wait_until='domcontentloaded')
   # A fresh bottle still waits on its blob screen and starts from zero.
   page.locator('#mode-classic').click();page.locator('[data-bottle=conical-flask-water]').click();expect(page.locator('#classic-save-note')).to_contain_text('fresh')
   expect(page.locator('#game-layout')).to_be_hidden();page.locator('#classic-play').click();expect(page.locator('#score')).to_have_text('0');expect(page.locator('#overlay')).to_be_hidden()
   page.reload(wait_until='domcontentloaded')
  # Multiplayer bottle choices continue to configure the room instead of launching solo.
  page.locator('#mode-multiplayer').click();page.locator('[data-bottle=conical-flask]').click()
  expect(page.locator('#room-create')).to_be_visible();expect(page.locator('#bottle-options')).to_be_visible();expect(page.locator('#classic-play')).to_be_hidden()
  assert not errors,errors
  print(json.dumps({'browser':name,'sixteenCardPreviews':True,'startInsideSelectedCard':True,'gridAndScrollUnchanged':True,'secondTapRequired':True,'savedPilesRetained':True,'freshStarts':True,'multiplayerSelectionPreserved':True,'errors':errors}),flush=True);browser.close()
