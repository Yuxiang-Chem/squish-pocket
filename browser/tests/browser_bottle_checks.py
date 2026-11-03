"""Bottle, extreme settings, and live size preference integration checks."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
output=Path('/tmp/squish-pocket-qa');output.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:4173',wait_until='networkidle');page.locator('#start').click()
    expect(page.locator('#rack-0')).to_be_enabled(timeout=15000)
    expect(page.locator('#shoot')).to_be_enabled(timeout=15000)
    page.locator('#shoot').click()
    page.wait_for_timeout(250)
    page.locator('#settings').click()
    page.locator('#blobSize').press('Home')
    for _ in range(8):page.locator('#blobSize').press('ArrowRight')
    before=page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine")
    page.locator('#stiffness').press('Home');page.locator('#blobSize').press('End')
    assert page.locator('#stiffness-value').inner_text()=='0%'
    assert page.locator('#blobSize-value').inner_text()=='150%'
    saved=page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine")
    assert saved['physics']['blobSize']==150 and saved['physics']['stiffness']==0
    assert saved['shots']==before['shots']==1
    assert abs(saved['blobs'][0]['renderRadius']/before['blobs'][0]['renderRadius']-150/80)<.00001
    page.screenshot(path=str(output/'bottle-size-settings.png'))
    page.locator('#settings-dialog [data-close]').last.click()
    page.locator('#pause').click();page.reload(wait_until='networkidle')
    page.locator('#settings').click();assert page.locator('#blobSize').input_value()=='150'
    page.locator('#settings-dialog [data-close]').last.click();page.locator('#start').click()
    page.locator('#restart').click();page.locator('#confirm-reset').click()
    assert page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine.physics.blobSize")==150
    expect(page.locator('#rack-0')).to_be_enabled(timeout=15000)
    for width,height in [(320,568),(390,844)]:
        page.set_viewport_size({'width':width,'height':height})
        page.locator('#settings').click()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.locator('#blobSize').press('Home');assert page.locator('#blobSize-value').inner_text()=='40%'
        page.locator('#reset-physics').click();assert page.locator('#blobSize').input_value()=='150'
        page.locator('#settings-dialog [data-close]').last.click()
    assert not errors,errors
    print(json.dumps({'passed':True,'checks':['live size updates geometry','extreme stiffness input','size persists after reload and restart','small phone settings scroll','reset restores size'],'browser_errors':errors}))
    browser.close()
