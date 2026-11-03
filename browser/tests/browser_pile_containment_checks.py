"""Rendered floor merges, old floor leakage, and deeply overlapping saved blobs."""
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright
import json, math
out=Path('/tmp/squish-pocket-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page.add_init_script("""
 window.__frames=[];window.requestAnimationFrame=cb=>(__frames.push(cb),1);window.__step=()=>{window.__time=(window.__time??performance.now())+16.667;__frames.shift()?.(__time);};
 window.__faces=0;window.__unclippedFaces=0;
 const states=new WeakMap(),state=c=>{if(!states.has(c))states.set(c,{clipped:false,stack:[]});return states.get(c);};
 for(const name of ['save','restore','clip','ellipse','fillText']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){const s=state(this);if(name==='save')s.stack.push(s.clipped);if(name==='restore')s.clipped=s.stack.pop()??false;if(name==='clip')s.clipped=true;if((name==='ellipse'||name==='fillText')&&this.fillStyle.startsWith('#384031')){__faces++;if(!s.clipped)__unclippedFaces++;}return original.apply(this,args);};}
 const fixture=new URL(location.href).searchParams.get('teststate');if(fixture)localStorage.setItem('squish-pocket-v1',fixture);
 """)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def body(level,x,y,leaked=False):
  r=19.5*1.2**level;nodes=[]
  for k in range(24):
   xx=x+r*math.cos(k*math.pi/12);yy=y+r*math.sin(k*math.pi/12)
   nodes.append({'x':xx,'y':yy,'px':xx,'py':yy,'bottleSide':not(leaked and yy>408)})
  return {'level':level,'x':x,'y':y,'vx':0,'vy':0,'age':3,'danger':0,'shape':[0]*24,'spring':[0]*24,'nodes':nodes,'renderRadius':r,'inBottle':True,'hasEntered':True}
 def fixture(blobs):
  e={'bottleVersion':2,'blobs':blobs,'score':128,'shots':9,'current':2,'next':4,'cooldown':0,'over':False,'seed':123,'rack':[{'id':1,'level':0},{'id':2,'level':2},{'id':3,'level':4}],'rackSerial':3,'selectedId':2,'incoming':{'level':4,'side':'left'},'rackEvents':[],'physics':{'stiffness':10,'viscosity':0,'blobSize':150}}
  page.goto('http://127.0.0.1:4173/?teststate='+quote(json.dumps({'version':1,'physicsDefaultsVersion':1,'engine':e,'started':True,'best':128,'sound':False})),wait_until='networkidle');page.locator('#start').click()
 def check():
  page.evaluate("window.dispatchEvent(new Event('pagehide'))")
  result=page.evaluate("""()=>{const e=JSON.parse(localStorage.getItem('squish-pocket-v1')).engine;let depth=0;for(const a of e.blobs)for(const b of e.blobs){if(a===b||(a.fuse&&b.fuse&&a.fuse.id===b.fuse.id))continue;for(const p of a.nodes){let inside=false,d=Infinity;for(let k=0;k<24;k++){const u=b.nodes[k],v=b.nodes[(k+1)%24],x=v.x-u.x,y=v.y-u.y;if((u.y>p.y)!==(v.y>p.y)&&p.x<x*(p.y-u.y)/y+u.x)inside=!inside;const t=Math.max(0,Math.min(1,((p.x-u.x)*x+(p.y-u.y)*y)/(x*x+y*y)));d=Math.min(d,Math.hypot(p.x-u.x-x*t,p.y-u.y-y*t));}if(inside)depth=Math.max(depth,d);}}return {over:e.over,depth,maxY:Math.max(...e.blobs.flatMap(b=>b.nodes.map(p=>p.y))),score:e.score,shots:e.shots,faces:__faces,unclipped:__unclippedFaces};}""")
  assert not result['over'] and result['maxY']<=408.001 and result['depth']<.15,result
  assert result['faces']>0 and result['unclipped']==0,result
  assert page.locator('#overlay').is_hidden()
  return result
 reports=[]
 for name,blobs in [('floor-merge',[body(4,140,377),body(4,175,377),body(6,220,365)]),('nested-blobs',[body(4,180,300),body(6,180,300)]),('saved-floor-leak',[body(4,180,390,True)]),('crowded-corner-leak',[body(7,100,333),body(4,230,360),body(0,315,388),body(1,80,425,True)])]:
  fixture(blobs);page.evaluate('__step()');first=check()
  for k in range(60):page.evaluate('for(let i=0;i<3;i++)__step()');check()
  page.screenshot(path=str(out/(name+'-contained.png')));reports.append({'scene':name,**check()})
  assert reports[-1]['shots']==9
  if name in ['saved-floor-leak','crowded-corner-leak']:assert reports[-1]['score']==128
 assert not errors,errors
 print(json.dumps({'passed':True,'checks':reports,'browser_errors':errors}))
 browser.close()
