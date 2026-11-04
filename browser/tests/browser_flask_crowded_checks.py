"""Reported neck scene, personal-score reset, and controlled-frame runtime.

Set SQUISH_BASELINE_VESSEL to an earlier vessel.js for a same-browser comparison.
All shared-record requests are mocked; this test submits no scores.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
import os
import uuid

base = os.environ.get('SQUISH_TEST_URL', 'http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:', 'http://localhost:'))
baseline = os.environ.get('SQUISH_BASELINE_VESSEL')
out = Path('/tmp/squish-pocket-qa')
out.mkdir(exist_ok=True)
shared = {'reached2048': 4, 'record': {'score': 20000, 'name': 'Original'}, 'highestTile': 2048,
          'bottles': {'lab-flask': {'record': None, 'recordEpoch': 2, 'recordPersonal': {'score': 0, 'highestTile': 2},
                                  'highestTile': 2, 'personal': {'score': 0, 'highestTile': 2048}}}}
with sync_playwright() as p:
    for name in ['chromium', 'webkit']:
        reports = []
        for variant in (['baseline', 'current'] if baseline else ['current']):
            browser = getattr(p, name).launch()
            page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.route('**/api/achievements', lambda route: route.fulfill(status=200, json=shared))
            page.route('https://fonts.googleapis.com/**', lambda route: route.abort())
            page.route('https://fonts.gstatic.com/**', lambda route: route.abort())
            if variant == 'baseline':
                page.route('**/vessel.js*', lambda route: route.fulfill(status=200, body=Path(baseline).read_text(), content_type='text/javascript'))
            profile = {'id': str(uuid.uuid4()), 'token': str(uuid.uuid4()), 'name': 'Friend', 'score': 20000, 'highestTile': 2048,
                       'bottles': {'classic': {'score': 20000, 'highestTile': 2048}, 'lab-flask': {'score': 13960, 'highestTile': 2048},
                                   'lab-flask-water': {'score': 2336, 'highestTile': 256}},
                       'flaskRecord': {'epoch': 1, 'score': 13960, 'highestTile': 2048}}
            page.add_init_script(f"""
                if(!localStorage.getItem('squish-pocket-achievements-v1'))localStorage.setItem('squish-pocket-achievements-v1',{json.dumps(json.dumps(profile))});
                window.__frames=[];window.requestAnimationFrame=cb=>(__frames.push(cb),1);
                window.__step=()=>{{window.__time=(window.__time??performance.now())+16.667;__frames.shift()?.(__time);}};
            """)
            page.goto(base, wait_until='networkidle')
            page.evaluate("""async()=>{
                const {Engine,blob}=await import('./engine.js?v=46'),{prepare,measure}=await import('./softbody.js?v=46');
                const e=new Engine(42,'lab-flask');e.recordEpoch=1;e.score=13960;e.shots=77;e.highestLevel=10;
                e.blobs=[blob(8,125,325),blob(6,82,215),blob(5,184,198),blob(6,290,282),blob(3,225,285),blob(4,246,377),blob(1,223,340),blob(2,236,218),blob(1,155,160),blob(0,280,193),blob(4,275,153)];
                for(const b of e.blobs){prepare(b,e.radius(b.level),1/120);measure(b,1/120);b.inBottle=true;b.hasEntered=true;for(const n of b.nodes)n.bottleSide=e.vessel.contains(n.x,n.y);}
                localStorage.setItem('squish-pocket-selected-bottle','lab-flask');
                localStorage.setItem('squish-pocket-v1:lab-flask',JSON.stringify({version:1,engine:e,started:true,best:20000,sound:false}));
            }""")
            page.reload(wait_until='networkidle')
            page.locator('#mode-classic').click()
            page.locator('#classic-play').click()
            page.locator('#pause').click()
            expect(page.locator('#best')).to_have_text('0')
            expect(page.locator('#score')).to_have_text('13,960')
            page.locator('#start').click()
            runtime = page.evaluate("""()=>{const start=performance.now();for(let i=0;i<180;i++)__step();return performance.now()-start;}""")
            page.screenshot(path=str(out / f'crowded-neck-{variant}-{name}.png'))
            page.evaluate("window.dispatchEvent(new Event('pagehide'))")
            result = page.evaluate("""async()=>{
                const {labFlask:g}=await import('./lab-flask.js?v=46');
                const saved=JSON.parse(localStorage.getItem('squish-pocket-v1:lab-flask')),e=saved.engine;
                let invalid=0;
                for(const b of e.blobs)if(g.contains(b.x,b.y))for(let i=0;i<24;i++){
                    const a=b.nodes[i],c=b.nodes[(i+1)%24];
                    for(let k=0;k<=20;k++){
                        const t=k/20,x=a.x+(c.x-a.x)*t,y=a.y+(c.y-a.y)*t;
                        const open=y<g.BOTTLE_MOUTH||g.mouths.some(m=>x>=Math.min(m.a.x,m.b.x)&&x<=Math.max(m.a.x,m.b.x)&&y<=m.a.y+m.dy*(x-m.a.x)/m.dx+.05);
                        if(!open&&!g.contains(x,y,.05))invalid++;
                    }
                }
                const profile=JSON.parse(localStorage.getItem('squish-pocket-achievements-v1'));
                return {invalid,score:e.score,shots:e.shots,over:e.over,personal:profile.bottles['lab-flask'].score,original:profile.bottles.classic.score,water:profile.bottles['lab-flask-water'].score};
            }""")
            assert not result['over'] and result['score'] == 13960 and result['shots'] == 77, result
            assert result['personal'] == 0 and result['original'] == 20000 and result['water'] == 2336, result
            if variant == 'current':
                assert result['invalid'] == 0, result
                page.reload(wait_until='networkidle')
                profile = page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-achievements-v1'))")
                assert profile['bottles']['lab-flask']['score'] == 0
            assert not errors, errors
            reports.append({'variant': variant, 'frame_batch_ms': runtime, **result})
            browser.close()
        if baseline:
            assert reports[1]['frame_batch_ms'] < reports[0]['frame_batch_ms'] * .5, reports
        print(json.dumps({'browser': name, 'passed': True, 'results': reports}), flush=True)
