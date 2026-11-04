"""Real-control gap misses, visible falling, results, and flask phone rendering."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright, expect
import json
import os

base = os.environ.get('SQUISH_TEST_URL', 'http://127.0.0.1:4173')
out = Path('/tmp/squish-pocket-qa')
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    for name in ['chromium', 'webkit']:
        browser = getattr(p, name).launch()
        page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script("""
            const fixture=new URL(location.href).searchParams.get('flaskfixture');
            if(fixture)localStorage.setItem('squish-pocket-v1:lab-flask',fixture);
            window.__frames=[];
            window.requestAnimationFrame=cb=>(window.__frames.push(cb),1);
            window.__step=(ms=16.667)=>{
                window.__time=(window.__time??performance.now())+ms;
                const frame=window.__frames.shift();if(frame)frame(window.__time);
            };
        """)
        def state():
            return page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1:lab-flask')).engine")

        for slot, direction in [(0, 'ArrowRight'), (2, 'ArrowLeft')]:
            page.goto(base, wait_until='networkidle')
            fixture = page.evaluate("""async () => {
                const {Engine}=await import('./engine.js?v=37');
                const engine=new Engine(42,'lab-flask');
                engine.rack=[{id:1,level:0},{id:2,level:1},{id:3,level:2}];
                engine.rackSerial=3;engine.selectedId=2;engine.syncRack();engine.score=64;
                return JSON.stringify({version:1,engine,started:true,best:128,sound:false});
            }""")
            page.goto(base + '?flaskfixture=' + quote(fixture), wait_until='networkidle')
            page.locator('#mode-classic').click()
            page.locator('[data-bottle="lab-flask"]').click()
            page.locator('#classic-play').click()
            page.evaluate('for(let i=0;i<150;i++)__step()')
            if slot == 0:
                page.screenshot(path=str(out / f'reference-flask-{name}.png'))
            page.locator(f'#rack-{slot}').click()
            page.locator('#canvas').focus()
            for _ in range(4):
                page.keyboard.press(direction)
            for _ in range(15):
                page.keyboard.press('ArrowUp')
            page.keyboard.press('Space')
            for _ in range(120):
                page.evaluate('__step()')
                if state()['over']:
                    break
            lost = state()
            assert lost['over'] and lost['endReason'] == 'spill'
            assert lost['blobs'][0]['missedEntry']
            assert lost['score'] == 64 and lost['shots'] == 1
            assert page.locator('#overlay').is_hidden()
            y = lost['blobs'][0]['y']
            page.screenshot(path=str(out / f'flask-gap-{slot}-fall-{name}.png'))
            page.evaluate('for(let i=0;i<15;i++)__step()')
            assert page.locator('#overlay').is_hidden()
            page.evaluate('for(let i=0;i<35;i++)__step()')
            expect(page.locator('#overlay-title')).to_have_text('A little spill.')
            assert 'Game over' in page.locator('#overlay-description').inner_text()
            final = state()
            assert final['blobs'][0]['y'] > y + 25
            assert final['score'] == 64 and final['shots'] == 1
            page.locator('#start').click()
            assert not state()['over'] and state()['shots'] == 0

        for width, height in [(320, 568), (390, 844), (430, 932)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.evaluate('__step()')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            assert page.locator('#shoot').is_visible()
        assert not errors, errors
        print(json.dumps({'browser': name, 'passed': True, 'checks': ['both gaps through real controls', 'visible fall before results', 'score and shots preserved', 'restart', 'phone layouts'], 'browser_errors': errors}))
        browser.close()
