"""Bottle record carousel against the real local Worker and D1 database."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
import os
import uuid

base = os.environ.get('SQUISH_TEST_URL', 'http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:', 'http://localhost:')), 'Use a local test server.'
out = Path('/tmp/squish-pocket-qa')
out.mkdir(exist_ok=True)

with sync_playwright() as p:
    for name in ['chromium', 'webkit']:
        browser = getattr(p, name).launch()
        page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        profile = {'id': str(uuid.uuid4()), 'token': str(uuid.uuid4()), 'name': 'Original champion', 'score': 512, 'highestTile': 128,
                   'flaskRecord': {'epoch': 2, 'score': 128, 'highestTile': 32},
                   'recordCelebrations': {'classic': 512, 'lab-flask': 128},
                   'bottles': {'classic': {'score': 512, 'highestTile': 128}, 'lab-flask': {'score': 128, 'highestTile': 32}}}
        page.add_init_script(f"if(!localStorage.getItem('squish-pocket-achievements-v1'))localStorage.setItem('squish-pocket-achievements-v1',{json.dumps(json.dumps(profile))});")
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(base, wait_until='networkidle')
        response = page.request.post(base + '/api/achievements', headers={'X-Player-Id': str(uuid.uuid4()), 'Authorization': 'Bearer ' + str(uuid.uuid4())}, data={
            'name': 'Flask champion', 'score': 1024, 'highestTile': 256,
            'flaskRecord': {'epoch': 2, 'score': 1024, 'highestTile': 256},
            'bottles': {'classic': {'score': 256, 'highestTile': 64}, 'lab-flask': {'score': 1024, 'highestTile': 256}}})
        assert response.ok, response.text()
        page.locator('#menu-achievements').click()
        expect(page.locator('#achievement-status')).to_have_text('Two Combine records are up to date.')
        expect(page.locator('#achievement-tab-classic')).to_have_attribute('aria-selected', 'true')
        original = page.locator('#achievement-page-classic')
        flask = page.locator('#achievement-page-lab-flask')
        expect(original.locator('[data-record]')).to_have_text('512')
        expect(original.locator('[data-personal-score]')).to_have_text('512')
        expect(original.locator('[data-holder]')).to_have_text('Original champion · highest score')
        page.screenshot(path=str(out / f'achievement-original-{name}.png'))
        page.locator('#achievement-next').click()
        expect(page.locator('#achievement-tab-lab-flask')).to_have_attribute('aria-selected', 'true')
        expect(flask.locator('[data-record]')).to_have_text('1,024')
        expect(flask.locator('[data-personal-score]')).to_have_text('128')
        expect(flask.locator('[data-holder]')).to_have_text('Flask champion · highest score')
        expect(page.locator('#achievement-next')).to_be_enabled()
        page.wait_for_timeout(450)
        page.screenshot(path=str(out / f'achievement-flask-{name}.png'))
        page.locator('#achievement-tab-all').click()
        page.wait_for_timeout(450)
        expect(page.locator('#achievement-record')).to_have_text('1,024')
        expect(page.locator('#achievement-personal-score')).to_have_text('512')
        expect(page.locator('#achievement-previous')).to_be_disabled()
        if name == 'chromium':
            # Native touch drag, allowing browser scroll snapping to settle.
            box = page.locator('#achievement-pages').bounding_box()
            cdp = page.context.new_cdp_session(page)
            x, y = box['x'] + box['width'] * .86, box['y'] + 130
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
            for i in range(1, 11):
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x - box['width'] * .075 * i, 'y': y}]})
                page.wait_for_timeout(30)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            page.wait_for_timeout(600)
            expect(page.locator('#achievement-tab-classic')).to_have_attribute('aria-selected', 'true')
        else:
            page.locator('#achievement-pages').focus()
            page.keyboard.press('ArrowRight')
            page.wait_for_timeout(450)
            expect(page.locator('#achievement-tab-classic')).to_have_attribute('aria-selected', 'true')
        page.locator('#achievement-tab-classic').focus()
        page.keyboard.press('End')
        page.wait_for_timeout(450)
        expect(page.locator('#achievement-tab-lab-flask-water')).to_have_attribute('aria-selected', 'true')
        page.keyboard.press('Home')
        page.wait_for_timeout(450)
        expect(page.locator('#achievement-tab-all')).to_have_attribute('aria-selected', 'true')
        for width, height in [(320, 568), (430, 932)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.locator('#achievement-tab-lab-flask').click()
            page.wait_for_timeout(450)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            assert page.locator('#achievements-dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
        # Refresh and reload retain both personal records.
        page.locator('#achievement-refresh').click()
        expect(page.locator('#achievement-status')).to_have_text('Two Combine records are up to date.')
        page.reload(wait_until='networkidle')
        page.locator('#menu-achievements').click()
        expect(page.locator('#achievement-status')).to_have_text('Two Combine records are up to date.')
        expect(flask.locator('[data-personal-score]')).to_have_text('128')
        assert not errors, errors
        print(json.dumps({'browser': name, 'passed': True, 'checks': ['actual shared records per bottle', 'separate personal bests', 'tabs and arrows', 'touch swipe' if name == 'chromium' else 'keyboard slide', 'keyboard tab navigation', 'phone layouts', 'refresh and reload'], 'browser_errors': errors}))
        browser.close()
