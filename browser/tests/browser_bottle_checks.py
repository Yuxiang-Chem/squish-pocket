"""Mobile settings keep a fixed blob size across legacy saves, reload, and restart."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright
import json
output=Path('/tmp/squish-pocket-qa');output.mkdir(exist_ok=True)
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch()
  page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.add_init_script("const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);")
  e={'bottleVersion':2,'blobs':[{'level':0,'x':180,'y':280,'vx':0,'vy':0,'age':2,'danger':0,'shape':[0]*24,'spring':[0]*24,'renderRadius':14.3,'inBottle':True,'hasEntered':True}],'score':64,'shots':1,'current':2,'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':1,'level':0},{'id':2,'level':2},{'id':3,'level':4}],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':18,'viscosity':50,'blobSize':110}}
  fixture={'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':128,'sound':False}
  page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps(fixture)),wait_until='networkidle')
  page.locator('#settings').click()
  assert page.locator('#settings-dialog input[type=range]').count()==2
  assert page.locator('#blobSize').count()==0
  assert page.locator('#stiffness').input_value()=='18' and page.locator('#viscosity').input_value()=='50'
  page.locator('#stiffness').press('Home')
  saved=page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1'))")
  assert saved['engine']['physics']=={'stiffness':0,'viscosity':50,'blobSize':150}
  assert saved['engine']['score']==64 and saved['engine']['shots']==1 and saved['best']==128
  assert len(saved['engine']['blobs'])==1 and abs(saved['engine']['blobs'][0]['renderRadius']-19.5)<.00001
  page.locator('#settings-dialog [data-close]').last.click()
  page.goto('http://127.0.0.1:4173',wait_until='networkidle')
  page.locator('#settings').click()
  assert page.locator('#stiffness').input_value()=='0' and page.locator('#viscosity').input_value()=='50'
  for width,height in [(320,568),(390,844)]:
   page.set_viewport_size({'width':width,'height':height})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.locator('#reset-physics').click()
   assert page.locator('#stiffness').input_value()=='10' and page.locator('#viscosity').input_value()=='0'
   assert page.locator('#blobSize').count()==0
  page.screenshot(path=str(output/('fixed-size-settings-'+name+'.png')))
  page.locator('#settings-dialog [data-close]').last.click()
  page.locator('#restart').click();page.locator('#confirm-reset').click()
  saved=page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1'))")
  assert saved['engine']['physics']=={'stiffness':10,'viscosity':0,'blobSize':150}
  assert saved['engine']['score']==0 and saved['best']==128
  assert not errors,errors
  print(json.dumps({'browser':name,'passed':True,'checks':['size control removed','legacy size normalized','material settings editable','progress retained','reload and restart','small phone settings'],'browser_errors':errors}))
  browser.close()
