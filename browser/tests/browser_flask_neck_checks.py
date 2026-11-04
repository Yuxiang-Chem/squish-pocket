"""Crowded old-save neck containment, render clipping, and enlarged flask."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import os

base = os.environ.get('SQUISH_TEST_URL', 'http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:', 'http://localhost:')), 'Use a local test server.'
out = Path('/tmp/squish-pocket-qa')
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    for name in ['chromium', 'webkit']:
        browser = getattr(p, name).launch()
        page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/api/achievements', lambda route: route.fulfill(status=200, json={
            'reached2048': 0, 'record': None, 'highestTile': 2, 'bottles': {}, 'emailReady': False}))
        page.add_init_script("""
            window.__frames=[];window.requestAnimationFrame=cb=>(__frames.push(cb),1);
            window.__step=()=>{window.__time=(window.__time??performance.now())+16.667;__frames.shift()?.(__time);};
            const states=new WeakMap(),state=c=>{if(!states.has(c))states.set(c,{clips:0,stack:[],maxY:0});return states.get(c);};
            const color=document.createElement('canvas').getContext('2d');color.strokeStyle='#30352e19';
            window.__boardStrokes=0;window.__unclippedBoardStrokes=0;
            for(const name of ['save','restore','clip','beginPath','moveTo','lineTo','quadraticCurveTo','stroke']){
                const original=CanvasRenderingContext2D.prototype[name];
                CanvasRenderingContext2D.prototype[name]=function(...args){
                    const s=state(this);
                    if(name==='save')s.stack.push(s.clips);
                    if(name==='restore')s.clips=s.stack.pop()??0;
                    if(name==='clip')s.clips++;
                    if(name==='beginPath')s.maxY=0;
                    if(name==='moveTo'||name==='lineTo')s.maxY=Math.max(s.maxY,args[1]);
                    if(name==='quadraticCurveTo')s.maxY=Math.max(s.maxY,args[1],args[3]);
                    if(name==='stroke'&&this.canvas.id==='canvas'&&this.strokeStyle===color.strokeStyle&&s.maxY>150){
                        __boardStrokes++;if(!s.clips)__unclippedBoardStrokes++;
                    }
                    return original.apply(this,args);
                };
            }
        """)
        page.goto(base, wait_until='networkidle')
        fixture = page.evaluate("""async () => {
            const {Engine,blob}=await import('./engine.js?v=39');
            const {prepare,measure}=await import('./softbody.js?v=29');
            const e=new Engine(42,'lab-flask');e.bottleVersion=2;delete e.recordEpoch;e.score=9036;e.shots=77;
            e.blobs=[blob(7,125,250),blob(2,180,190),blob(5,254,202),blob(4,255,292),blob(6,180,345),blob(3,110,350),blob(1,275,360)];
            for(const b of e.blobs){prepare(b,e.radius(b.level),1/120);measure(b,1/120);b.inBottle=true;b.hasEntered=true;for(const n of b.nodes)n.bottleSide=true;}
            return JSON.stringify({version:1,engine:e,started:true,best:16364,sound:false});
        }""")
        page.add_init_script(f"if(!localStorage.getItem('neck-fixture-seeded')){{localStorage.setItem('squish-pocket-v1:lab-flask',{json.dumps(fixture)});localStorage.setItem('neck-fixture-seeded','1');}}")
        page.reload(wait_until='networkidle')
        page.locator('#mode-classic').click()
        page.locator('[data-bottle="lab-flask"]').click()
        page.locator('#classic-play').click()

        def check():
            page.evaluate("window.dispatchEvent(new Event('pagehide'))")
            result = page.evaluate("""async () => {
                const {labFlask:g}=await import('./lab-flask.js?v=39');
                const e=JSON.parse(localStorage.getItem('squish-pocket-v1:lab-flask')).engine;
                let invalid=0;
                for(const b of e.blobs)if(!b.spilled)for(let i=0;i<24;i++){
                    const a=b.nodes[i],c=b.nodes[(i+1)%24];
                    if(a.bottleSide&&!g.contains(a.x,a.y,.005))invalid++;
                    if(a.bottleSide&&c.bottleSide)for(let k=1;k<20;k++){
                        const t=k/20;if(!g.contains(a.x+(c.x-a.x)*t,a.y+(c.y-a.y)*t,.05))invalid++;
                    }
                }
                return {invalid,over:e.over,score:e.score,shots:e.shots,version:e.bottleVersion,strokes:__boardStrokes,unclipped:__unclippedBoardStrokes};
            }""")
            assert result['invalid'] == 0 and not result['over'], result
            assert result['version'] == 3 and result['score'] == 9036 and result['shots'] == 77, result
            assert result['strokes'] > 0 and result['unclipped'] == 0, result
            return result

        page.evaluate('__step()')
        check()
        page.screenshot(path=str(out / f'enlarged-flask-neck-repaired-{name}.png'))
        for _ in range(40):
            page.evaluate('for(let i=0;i<3;i++)__step()')
            check()
        page.screenshot(path=str(out / f'enlarged-flask-crowded-{name}.png'))
        for width, height in [(320, 568), (430, 932)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.evaluate('__step()')
            check()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            assert page.locator('#shoot').is_visible()
        page.reload(wait_until='networkidle')
        page.locator('#mode-classic').click()
        page.locator('[data-bottle="lab-flask"]').click()
        page.locator('#classic-play').click()
        page.evaluate('__step()')
        report = check()
        assert not errors, errors
        print(json.dumps({'browser': name, 'passed': True, 'checks': ['old crowded save', 'whole membrane neck containment', 'glass clipping before blob fill', 'score and shots preserved', 'reload', 'small phone layouts'], 'result': report, 'browser_errors': errors}))
        browser.close()
