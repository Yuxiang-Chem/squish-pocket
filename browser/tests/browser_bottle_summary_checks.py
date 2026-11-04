"""Pause, saved-resume, and game-over records stay scoped to the current bottle."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright, expect
import json
import os
import uuid

base = os.environ.get('SQUISH_TEST_URL', 'http://127.0.0.1:4173')
out = Path('/tmp/squish-pocket-qa')
out.mkdir(exist_ok=True)
shared = {'record': {'score': 30000, 'name': 'Overall'}, 'personal': {'score': 20000, 'highestTile': 2048},
          'reached2048': 4, 'highestTile': 2048, 'isRecordHolder': False, 'emailReady': False,
          'bottles': {'classic': {'record': {'score': 4096, 'name': 'Original holder'}, 'personal': {'score': 768, 'highestTile': 128}, 'highestTile': 256},
                      'lab-flask': {'record': {'score': 1024, 'name': 'Flask holder'}, 'personal': {'score': 256, 'highestTile': 32}, 'highestTile': 64}}}

with sync_playwright() as p:
    for name in ['chromium', 'webkit']:
        browser = getattr(p, name).launch()
        page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        profile = {'id': str(uuid.uuid4()), 'token': str(uuid.uuid4()), 'name': 'Friend', 'score': 20000, 'highestTile': 2048,
                   'bottles': {'classic': {'score': 512, 'highestTile': 128}, 'lab-flask': {'score': 128, 'highestTile': 32}}}
        page.add_init_script(f"""
            if(!localStorage.getItem('squish-pocket-achievements-v1'))localStorage.setItem('squish-pocket-achievements-v1',{json.dumps(json.dumps(profile))});
            const fixture=new URL(location.href).searchParams.get('teststate');
            if(fixture){{const id=JSON.parse(fixture).engine.bottleId;localStorage.setItem('squish-pocket-selected-bottle',id);localStorage.setItem(id==='classic'?'squish-pocket-v1':'squish-pocket-v1:'+id,fixture);}}
        """)
        page.route('**/api/achievements', lambda route: route.fulfill(status=200, json=shared))
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))

        def fixture(bottle, score=64, over=False):
            engine = {'bottleId': bottle, 'bottleVersion': 2 if bottle == 'classic' else 3, 'blobs': [], 'score': score, 'shots': 4,
                      'highestLevel': 2, 'current': 1, 'next': 4, 'cooldown': 0, 'over': over, 'endReason': 'spill' if over else None,
                      'seed': 123, 'rack': [{'id': 1, 'level': 0}, {'id': 2, 'level': 1}, {'id': 3, 'level': 2}],
                      'rackSerial': 3, 'selectedId': 2, 'incoming': {'level': 4, 'side': 'left'}, 'rackEvents': [],
                      'physics': {'stiffness': 10, 'viscosity': 0, 'blobSize': 150}}
            data = {'version': 1, 'engine': engine, 'started': True, 'best': 20000, 'sound': False}
            page.goto(base + '/?teststate=' + quote(json.dumps(data)), wait_until='networkidle')

        def check(bottle, score, best):
            label = 'Original bottle' if bottle == 'classic' else 'Three-neck flask'
            expect(page.locator('#round-stats')).to_be_visible()
            expect(page.locator('#round-bottle')).to_have_text(label)
            expect(page.locator('#score')).to_have_text(format(score, ','))
            expect(page.locator('#best')).to_have_text(format(best, ','))
            expect(page.locator('#world-record')).to_have_text('4,096' if bottle == 'classic' else '1,024')
            assert label in page.locator('#best').get_attribute('title')
            assert label in page.locator('#world-record').get_attribute('title')
            personal = page.locator('#best').bounding_box()
            world = page.locator('#world-record').bounding_box()
            assert world['x'] > personal['x'] and abs(world['y'] - personal['y']) < 2

        for bottle, best in [('classic', 768), ('lab-flask', 256)]:
            fixture(bottle)
            check(bottle, 64, best)
            page.locator('#start').click()
            expect(page.locator('#round-stats')).to_be_hidden()
            expect(page.locator('#round-bottle')).to_be_hidden()
            page.locator('#pause').click()
            check(bottle, 64, best)
            page.screenshot(path=str(out / f'{bottle}-pause-records-{name}.png'))
            page.locator('#start').click()
            page.locator('#pause').click()
            check(bottle, 64, best)
        for bottle, score in [('lab-flask', 512), ('classic', 1024)]:
            fixture(bottle, score, True)
            expect(page.locator('#overlay-title')).to_have_text('A little spill.')
            check(bottle, score, score)
            page.screenshot(path=str(out / f'{bottle}-game-over-records-{name}.png'))
            for width, height in [(320, 568), (390, 844), (430, 932)]:
                page.set_viewport_size({'width': width, 'height': height})
                check(bottle, score, score)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                button = page.locator('#start').bounding_box()
                jar = page.locator('#jar').bounding_box()
                assert button['y'] + button['height'] <= jar['y'] + jar['height'] + 1
        fixture('lab-flask', 0)
        check('lab-flask', 0, 512)
        assert not errors, errors
        print(json.dumps({'browser': name, 'passed': True, 'checks': ['saved resume', 'pause', 'bottle switching', 'game over personal best', 'new round retains bottle best', 'separate world records', 'phone layouts'], 'browser_errors': errors}))
        browser.close()
