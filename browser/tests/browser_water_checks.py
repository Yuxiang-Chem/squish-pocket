"""Four choices, floating, force-driven splashes, wet saves, and bottle records."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright, expect
import json
import os
import uuid

base=os.environ.get('SQUISH_TEST_URL','http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:','http://localhost:'))
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
summary={'record':{'score':50000,'name':'Overall'},'highestTile':2048,'reached2048':4,'isRecordHolder':False,'emailReady':True,'bottles':{}}
for bottle,score in [('classic',50000),('lab-flask',9036),('classic-water',4096),('lab-flask-water',8192)]:
    summary['bottles'][bottle]={'record':{'score':score,'name':'World holder'},'highestTile':2048,'isRecordHolder':False}
with sync_playwright() as p:
    for name in ['chromium','webkit']:
        browser=getattr(p,name).launch()
        page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        profile={'id':str(uuid.uuid4()),'token':str(uuid.uuid4()),'name':'Friend','score':20000,'highestTile':2048,
                 'bottles':{'classic':{'score':20000,'highestTile':2048},'classic-water':{'score':512,'highestTile':128},'lab-flask-water':{'score':256,'highestTile':64}}}
        page.add_init_script(f"""
            if(!localStorage.getItem('squish-pocket-achievements-v1'))localStorage.setItem('squish-pocket-achievements-v1',{json.dumps(json.dumps(profile))});
            const fixture=new URL(location.href).searchParams.get('teststate');
            if(fixture){{const id=JSON.parse(fixture).engine.bottleId;localStorage.setItem('squish-pocket-selected-bottle',id);localStorage.setItem(id==='classic'?'squish-pocket-v1':'squish-pocket-v1:'+id,fixture);}}
            window.__frames=[];window.requestAnimationFrame=cb=>(__frames.push(cb),1);
            window.__step=()=>{{window.__time=(window.__time??performance.now())+16.667;__frames.shift()?.(__time);}};
            window.__dropletDraws=0;
            const ellipse=CanvasRenderingContext2D.prototype.ellipse;
            CanvasRenderingContext2D.prototype.ellipse=function(...args){{if(this.canvas.id==='canvas'&&this.fillStyle==='#66b9d6')__dropletDraws++;return ellipse.apply(this,args);}};
        """)
        page.route('**/api/achievements',lambda route:route.fulfill(status=200,json=summary))
        page.goto(base,wait_until='networkidle')
        page.locator('#mode-classic').click()
        assert page.locator('[data-bottle]').count()==4
        page.screenshot(path=str(out/f'four-bottle-choices-{name}.png'),full_page=True)
        reports=[]
        for bottle in ['classic-water','lab-flask-water']:
            outcomes=[]
            for power in [0,1]:
                fixture=page.evaluate("""async bottle=>{
                    const {Engine}=await import('./engine.js?v=43');const e=new Engine(42,bottle);e.score=64;e.shots=4;
                    e.rack=[{id:1,level:1},{id:2,level:0},{id:3,level:2}];e.rackSerial=3;e.selectedId=2;e.syncRack();
                    return JSON.stringify({version:1,engine:e,started:true,best:20000,sound:false});
                }""",bottle)
                page.goto(base+'/?teststate='+quote(fixture),wait_until='networkidle')
                page.locator('#start').click()
                page.evaluate('for(let i=0;i<100;i++)__step()')
                page.locator('#canvas').focus()
                for _ in range(15 if power else 4):page.keyboard.press('ArrowUp' if power else 'ArrowDown')
                page.keyboard.press('Space')
                peak_y=0;captured=False
                for _ in range(150):
                    page.evaluate('for(let i=0;i<4;i++)__step()')
                    page.evaluate("window.dispatchEvent(new Event('pagehide'))")
                    state=page.evaluate("id=>JSON.parse(localStorage.getItem('squish-pocket-v1:'+id)).engine",bottle)
                    assert not state['over'] and state['score']==64 and state['shots']==5,state
                    peak_y=max(peak_y,state['blobs'][0]['y'])
                    if power and not captured and page.evaluate('__dropletDraws>0'):
                        page.screenshot(path=str(out/f'{bottle}-splash-{name}.png'));captured=True
                draws=page.evaluate('__dropletDraws')
                assert (draws>0) if power else draws==0
                level=244 if bottle=='lab-flask-water' else 238
                assert abs(state['blobs'][0]['y']-level)<25,state['blobs'][0]['y']
                outcomes.append(peak_y)
                page.screenshot(path=str(out/f'{bottle}-floating-{name}.png'))
                page.locator('#pause').click()
                expect(page.locator('#round-bottle')).to_contain_text('water')
                expect(page.locator('#best')).to_have_text('512' if bottle=='classic-water' else '256')
                expect(page.locator('#world-record')).to_have_text('4,096' if bottle=='classic-water' else '8,192')
            assert outcomes[1]>outcomes[0]+35,outcomes
            # Reload the saved wet round without reinjecting its initial fixture.
            page.goto(base,wait_until='networkidle');page.locator('#mode-classic').click()
            page.locator(f'[data-bottle="{bottle}"]').click();page.locator('#classic-play').click()
            page.evaluate('for(let i=0;i<4;i++)__step()')
            state=page.evaluate("id=>JSON.parse(localStorage.getItem('squish-pocket-v1:'+id)).engine",bottle)
            assert state['score']==64 and state['shots']==5
            assert page.evaluate('__dropletDraws')==0
            page.locator('#achievements').click()
            expect(page.locator(f'#achievement-tab-{bottle}')).to_have_attribute('aria-selected','true')
            assert page.locator('.achievement-bottle-tabs [role=tab]').count()==5
            for width,height in [(320,568),(430,932)]:
                page.set_viewport_size({'width':width,'height':height})
                assert page.locator('#achievements-dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.locator('#achievements-dialog [data-close]').click()
            reports.append({'bottle':bottle,'gentle_depth':outcomes[0],'strong_depth':outcomes[1]})
        assert not errors,errors
        print(json.dumps({'browser':name,'passed':True,'checks':['four bottle choices','floating in both shapes','strong shot dives and droplets','gentle shot has no droplets','independent wet records','saved wet rounds','five achievement slides','phone layouts'],'results':reports,'browser_errors':errors}))
        browser.close()
