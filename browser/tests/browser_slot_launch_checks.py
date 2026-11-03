"""Chromium/WebKit: side-slot launches and matching asymmetric guide/shot limits."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
import json,math
reports=[]
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
  page.add_init_script("window.__frames=[];window.requestAnimationFrame=cb=>(__frames.push(cb),1);window.__step=()=>{window.__time=(window.__time??performance.now())+16.667;__frames.shift()?.(__time);};const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);")
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def fixture():
   e={'bottleVersion':2,'blobs':[],'score':64,'shots':0,'current':2,'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':1,'level':0},{'id':2,'level':2},{'id':3,'level':4}],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':10,'viscosity':0,'blobSize':150}}
   page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':128,'sound':False})),wait_until='networkidle');page.locator('#start').click();page.evaluate('__step()')
  launches=[]
  for slot in range(3):
   for direction in [-1,1]:
    fixture();page.locator('#canvas').focus();page.keyboard.press('Digit'+str(slot+1));page.evaluate('__step()')
    box=page.locator(f'#rack-{slot}').bounding_box();rect=page.locator('#canvas').bounding_box();expected_x=(box['x']+box['width']/2-rect['x'])/rect['width']*360
    b=page.locator('#shoot').bounding_box();x=b['x']+b['width']/2;y=b['y']+b['height']/2
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+direction*180,y,steps=5);page.evaluate('__step()');page.mouse.up()
    e=page.evaluate("JSON.parse(localStorage.getItem('squish-pocket-v1')).engine");assert e['shots']==1 and e['blobs'][0]['level']==[0,2,4][slot]
    shot=e['blobs'][0];angle=math.degrees(math.atan2(shot['vx'],shot['vy']));assert abs(shot['x']-expected_x)<2,(slot,shot['x'],expected_x)
    if slot==0:assert shot['x']<150
    elif slot==2:assert shot['x']>220
    else:assert abs(shot['x']-180)<2
    assert direction*angle>0 and abs(angle)<=55.0001
    launches.append({'slot':slot,'direction':direction,'x':shot['x'],'angle_degrees':angle})
  assert abs(launches[0]['angle_degrees'])<abs(launches[1]['angle_degrees'])
  assert abs(launches[5]['angle_degrees'])<abs(launches[4]['angle_degrees'])
  assert page.locator('#next').count()==0 and page.locator('#select-left').is_visible() and page.locator('#select-right').is_visible()
  assert not errors,errors
  reports.append({'browser':name,'launches':launches,'browser_errors':errors});browser.close()
 print(json.dumps({'passed':True,'reports':reports}))
