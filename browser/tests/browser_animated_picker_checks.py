from playwright.sync_api import sync_playwright,expect
from pathlib import Path
from urllib.parse import urlparse
import os,json
url=os.environ.get('SQUISH_TEST_URL','http://localhost:4184');allow_lab=os.environ.get('SQUISH_ALLOW_LAB')=='1'
assert urlparse(url).hostname in ['localhost','127.0.0.1','squish-test.chemisgreat.online','squish.chemisgreat.online']
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  b=getattr(p,name).launch();context=b.new_context(viewport={'width':390,'height':844});context.route('**/api/**',lambda r:r.fulfill(status=503,json={'error':'Offline'}));context.route('https://fonts.googleapis.com/**',lambda r:r.abort());context.route('https://fonts.gstatic.com/**',lambda r:r.abort());page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url,wait_until='domcontentloaded');page.wait_for_function("document.getElementById('language-select').onclick!==null");token=page.evaluate('window.__sameDoc=Math.random()');expect(page.locator('#mode-lab')).to_have_count(1 if allow_lab else 0)
  for lang in ['zh-CN','en']:
   if page.locator('html').get_attribute('lang')!=lang:page.locator('#language-select').click()
   expect(page.locator('.home-title h1')).to_have_text('Find your kind of squish.',use_inner_text=True);expect(page.locator('.home-title')).to_have_attribute('lang','en');expect(page.locator('.home-title-english')).to_have_count(0)
   for mode,count in [('two',2),('three',3)]:
    button=page.locator('[data-merge-mode="'+mode+'"]');assert button.inner_text().strip()=='';expect(button.locator('canvas')).to_have_attribute('data-merge-preview',mode);assert button.get_attribute('aria-label');button.focus();button.press('Enter');expect(button).to_have_attribute('aria-pressed','true');assert page.evaluate('window.__sameDoc')==token
    for phase,components in [(400,count),(2200,1)]:
     result=button.locator('canvas').evaluate("""async(canvas,args)=>{
      const {paintMergePreview}=await import('./merge-preview.js?v=89');paintMergePreview(canvas,args.mode,args.phase);
      const {width:w,height:h}=canvas,data=canvas.getContext('2d').getImageData(0,0,w,h).data,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let components=0;
      for(let p=0;p<w*h;p++){if(seen[p]||data[p*4+3]<128)continue;let start=0,end=1;queue[0]=p;seen[p]=1;while(start<end){const q=queue[start++],x=q%w;for(const n of [x>0?q-1:-1,x<w-1?q+1:-1,q>=w?q-w:-1,q<w*(h-1)?q+w:-1])if(n>=0&&!seen[n]&&data[n*4+3]>=128){seen[n]=1;queue[end++]=n;}}if(end>150)components++;}
      return {components,png:canvas.toDataURL()};
     }""",{'mode':mode,'phase':phase})
     assert result['components']==components,(name,mode,phase,result['components'])
     if lang=='en':
      import base64
      Path('/tmp/squish-pocket-qa').mkdir(exist_ok=True);Path('/tmp/squish-pocket-qa/'+name+'-game-picker-'+mode+'-'+str(phase)+'.png').write_bytes(base64.b64decode(result['png'].split(',')[1]))
    for width in [320,390,430,1440]:
     page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(name,lang,width)
   page.set_viewport_size({'width':390,'height':844});Path('/tmp/squish-pocket-qa').mkdir(exist_ok=True);page.screenshot(path='/tmp/squish-pocket-qa/'+name+'-animated-picker-'+lang+'.png');page.locator('#menu-achievements').click();expect(page.locator('#achievements-dialog')).to_be_visible()
   for mode,count in [('two',2),('three',3)]:
    button=page.locator('[data-achievement-mode="'+mode+'"]');assert button.inner_text().strip()=='';expect(button.locator('canvas')).to_have_attribute('data-merge-preview',mode);button.click();expect(button).to_have_attribute('aria-pressed','true')
   page.locator('#achievements-dialog [data-close]').first.click()
  if not allow_lab:
   for asset in ['lab.js','lab-rotors.js','lab-physics.js']:assert page.request.get(url.rstrip('/')+'/'+asset).status==404
  page.emulate_media(reduced_motion='reduce');page.reload(wait_until='domcontentloaded');page.wait_for_function("()=>{const c=document.querySelector('[data-merge-mode=three] canvas');return c&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(v=>v>0);}");page.wait_for_timeout(100);still=page.locator('[data-merge-mode="three"] canvas');first=still.evaluate('c=>c.toDataURL()');page.wait_for_timeout(250);assert still.evaluate('c=>c.toDataURL()')==first
  page.locator('#mode-classic').click();page.locator('[data-bottle="classic"]').click();page.locator('#classic-play').click();expect(page.locator('#game-layout')).to_be_visible();page.locator('#settings').click()
  if not allow_lab:
   for slider in ['stiffness','viscosity','blobSize']:expect(page.locator('#'+slider)).to_be_disabled()
  page.locator('#settings-dialog [data-close]').first.click();assert not errors,errors
  print(json.dumps({'browser':name,'EnglishHeadingInBothLanguages':True,'animatedPairsAndTriples':True,'noVisibleSelectorText':True,'accessibleKeyboardSelectors':True,'achievementsSelectors':True,'reducedMotion':True,'phoneDesktop':True,'labEnabled':allow_lab,'errors':errors}),flush=True);context.close();b.close()
