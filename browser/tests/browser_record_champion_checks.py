"""Bottle champion pages and email permissions against local D1/email simulation."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
import os
import uuid

base = os.environ.get('SQUISH_TEST_URL', 'http://127.0.0.1:4173')
assert base.startswith(('http://127.0.0.1:', 'http://localhost:')), 'Use the local email simulator only.'
out = Path('/tmp/squish-pocket-qa')
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    for name in ['chromium', 'webkit']:
        browser = getattr(p, name).launch()
        page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        errors = []
        summaries = []
        page.on('response', lambda r: summaries.append(r.json()) if '/api/achievements' in r.url else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        current = page.request.get(base + '/api/achievements').json()
        start = max([current.get('record', {}).get('score', 0) if current.get('record') else 0] + [(b.get('record') or {}).get('score', 0) for b in current['bottles'].values()]) + 20000

        def identity():
            return {'id': str(uuid.uuid4()), 'token': str(uuid.uuid4())}

        def submit(player, score, bottles, label='A champion'):
            response = page.request.post(base + '/api/achievements', headers={'X-Player-Id': player['id'], 'Authorization': 'Bearer ' + player['token']},
                                         data={'name': label, 'score': score, 'highestTile': 2048, 'bottles': bottles,
                                               **({'flaskRecord': {'epoch': 2, **bottles['lab-flask']}} if 'lab-flask' in bottles else {})})
            assert response.ok, response.text()
            return response.json()

        submit(identity(), start + 10000, {'classic': {'score': start + 10000, 'highestTile': 2048}}, 'Original champion')
        submit(identity(), start + 20000, {}, 'Overall champion')
        player = identity()
        profile = {**player, 'name': 'Flask champion', 'score': start + 1000, 'highestTile': 2048,
                   'flaskRecord': {'epoch': 2, 'score': start + 1000, 'highestTile': 128},
                   'bottles': {'lab-flask': {'score': start + 1000, 'highestTile': 128}}}
        page.add_init_script(f"if(!localStorage.getItem('squish-pocket-achievements-v1'))localStorage.setItem('squish-pocket-achievements-v1',{json.dumps(json.dumps(profile))});")
        page.goto(base, wait_until='networkidle')
        try:
            expect(page.locator('#champion-page')).to_be_visible()
        except AssertionError:
            raise AssertionError({'browser_errors':errors,'status':page.locator('#achievement-status').inner_text(),'summary':summaries[-1] if summaries else None,'hidden':page.evaluate('document.hidden')})
        expect(page.locator('#champion-title')).to_have_text('You’re number one!')
        expect(page.locator('#champion-bottle-name')).to_have_text('Three-neck flask')
        expect(page.locator('#champion-score')).to_have_text(format(start + 1000, ','))
        page.screenshot(path=str(out / f'flask-champion-{name}.png'))
        for width, height in [(320, 568), (430, 932)]:
            page.set_viewport_size({'width': width, 'height': height})
            assert page.locator('#champion-page').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
            assert page.locator('#champion-email').is_visible()
        page.locator('#champion-email').click()
        expect(page.locator('#record-message-form')).to_be_visible()
        assert page.locator('#record-bottle').input_value() == 'lab-flask'
        assert page.locator('#record-bottle option').count() == 1
        page.locator('#record-message').fill('A flask victory — local simulator check.')
        with page.expect_response(lambda r: '/api/record-message' in r.url) as sent:
            page.locator('#record-send').click()
        assert sent.value.ok and sent.value.json()['bottle'] == 'lab-flask'
        expect(page.locator('#record-message-status')).to_contain_text('Message sent!')
        page.locator('#record-message').fill('A second message stays here when limited.')
        page.locator('#record-send').click()
        expect(page.locator('#record-message-status')).to_contain_text('one message per record')
        assert page.locator('#record-message').input_value().startswith('A second message')
        page.locator('#achievements-dialog [data-close]').click()
        page.reload(wait_until='networkidle')
        expect(page.locator('#champion-page')).to_be_hidden()
        page.locator('#menu-achievements').click()
        page.locator('#achievement-tab-lab-flask').click()
        page.locator('#achievement-page-lab-flask [data-celebrate]').click()
        expect(page.locator('#champion-page')).to_be_visible()
        page.locator('#champion-page [data-close]').last.click()
        # Losing the record removes both the message permission and replay action.
        submit(identity(), start + 1004, {'lab-flask': {'score': start + 1004, 'highestTile': 128}}, 'New flask champion')
        page.locator('#menu-achievements').click()
        page.locator('#achievement-refresh').click()
        expect(page.locator('#record-message-form')).to_be_hidden()
        expect(page.locator('#achievement-page-lab-flask [data-celebrate]')).to_be_hidden()
        page.locator('#achievements-dialog [data-close]').click()
        # The same player can qualify on the other bottle, below the overall score.
        result = submit(player, start + 12000, {'classic': {'score': start + 12000, 'highestTile': 2048}})
        assert result['bottles']['classic']['isRecordHolder'] and not result['isRecordHolder']
        page.reload(wait_until='networkidle')
        expect(page.locator('#champion-bottle-name')).to_have_text('Original bottle')
        expect(page.locator('#champion-page')).to_be_visible()
        page.screenshot(path=str(out / f'original-champion-{name}.png'))
        page.locator('#champion-email').click()
        assert page.locator('#record-bottle').input_value() == 'classic'
        page.locator('#record-message').fill('An original bottle victory — local simulator check.')
        with page.expect_response(lambda r: '/api/record-message' in r.url) as sent:
            page.locator('#record-send').click()
        assert sent.value.ok and sent.value.json()['bottle'] == 'classic'
        expect(page.locator('#record-message-status')).to_contain_text('Message sent!')
        assert not errors, errors
        print(json.dumps({'browser': name, 'passed': True, 'checks': ['both bottle champion pages', 'eligible without overall record', 'correct email scope', 'local simulated send', 'daily limit retains draft', 'reload suppresses repeat', 'replay champion page', 'lost ownership locks form', 'phone layouts'], 'browser_errors': errors}))
        browser.close()
