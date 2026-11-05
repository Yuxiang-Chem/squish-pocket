from playwright.sync_api import sync_playwright,expect
from pathlib import Path
from urllib.parse import urlparse
import os,json
url=os.environ.get('SQUISH_TEST_URL','http://localhost:4184');allow_lab=os.environ.get('SQUISH_ALLOW_LAB')=='1'
assert urlparse(url).hostname in ['localhost','127.0.0.1','squish-test.chemisgreat.online','squish.chemisgreat.online']
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  b=getattr(p,name).launch();context=b.new_context(viewport={'width':390,'height':844});context.route('**/api/**',lambda r:r.fulfill(status=503,json={'error':'Offline'}));context.route('https://fonts.googleapis.com/**',lambda r:r.abort());context.route('https://fonts.gstatic.com/**',lambda r:r.abort());page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url,wait_until='domcontentloaded');token=page.evaluate('window.__sameDoc=Math.random()');expect(page.locator('#mode-lab')).to_have_count(1 if allow_lab else 0)
  for lang in ['zh-CN','en']:
   if page.locator('html').get_attribute('lang')!=lang:page.locator('#language-select').click()
   expect(page.locator('.home-title h1')).to_contain_text('团团乐趣' if lang=='zh-CN' else 'squish.');subtitle=page.locator('.home-title-english');expect(subtitle).to_have_text('Find your kind of squish')
   if lang=='zh-CN':expect(subtitle).to_be_visible()
   else:expect(subtitle).to_be_hidden()
   for mode,count in [('two',2),('three',3)]:
    button=page.locator('[data-merge-mode="'+mode+'"]');assert button.inner_text().strip()=='';expect(button.locator('.merge-source')).to_have_count(count);assert button.get_attribute('aria-label');button.focus();button.press('Enter');expect(button).to_have_attribute('aria-pressed','true');assert page.evaluate('window.__sameDoc')==token
    for phase in [400,2200]:
     states=button.locator('.merge-visual').evaluate('''(svg,time)=>{for(const item of svg.querySelectorAll('.merge-source,.merge-result'))for(const a of item.getAnimations()){a.pause();a.currentTime=time;}return [...svg.querySelectorAll('.merge-source,.merge-result')].map(e=>({opacity:+getComputedStyle(e).opacity,transform:getComputedStyle(e).transform}));}''',phase)
     assert len(states)==count+1
     if phase==400:assert all(v['opacity']>.95 for v in states[:-1]) and states[-1]['opacity']<.05,states
     else:assert all(v['opacity']<.05 for v in states[:-1]) and states[-1]['opacity']>.95,states
    for width in [320,390,430,1440]:
     page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(name,lang,width)
   page.set_viewport_size({'width':390,'height':844});Path('/tmp/squish-pocket-qa').mkdir(exist_ok=True);page.screenshot(path='/tmp/squish-pocket-qa/'+name+'-animated-picker-'+lang+'.png');page.locator('#menu-achievements').click();expect(page.locator('#achievements-dialog')).to_be_visible()
   for mode,count in [('two',2),('three',3)]:
    button=page.locator('[data-achievement-mode="'+mode+'"]');assert button.inner_text().strip()=='';expect(button.locator('.merge-source')).to_have_count(count);button.click();expect(button).to_have_attribute('aria-pressed','true')
   page.locator('#achievements-dialog [data-close]').first.click()
  if not allow_lab:
   for asset in ['lab.js','lab-rotors.js','lab-physics.js']:assert page.request.get(url.rstrip('/')+'/'+asset).status==404
  page.emulate_media(reduced_motion='reduce');page.reload(wait_until='domcontentloaded');states=page.locator('[data-merge-mode="three"] .merge-visual').evaluate('''svg=>[...svg.querySelectorAll('.merge-source,.merge-result')].map(e=>({animations:e.getAnimations().length,opacity:+getComputedStyle(e).opacity}))''');assert all(s['animations']==0 and s['opacity']==1 for s in states),states
  page.locator('#mode-classic').click();page.locator('[data-bottle="classic"]').click();page.locator('#classic-play').click();expect(page.locator('#game-layout')).to_be_visible();page.locator('#settings').click()
  if not allow_lab:
   for slider in ['stiffness','viscosity','blobSize']:expect(page.locator('#'+slider)).to_be_disabled()
  page.locator('#settings-dialog [data-close]').first.click();assert not errors,errors
  print(json.dumps({'browser':name,'bilingualHeading':True,'animatedPairsAndTriples':True,'noVisibleSelectorText':True,'accessibleKeyboardSelectors':True,'achievementsSelectors':True,'reducedMotion':True,'phoneDesktop':True,'labEnabled':allow_lab,'errors':errors}),flush=True);context.close();b.close()
