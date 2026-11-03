import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {RackMotion} from '../dist/rack-motion.js';
import {installShootTouchGuard} from '../dist/shoot-touch.js';
const items=[{id:1,level:0},{id:2,level:2},{id:3,level:4}];
test('Manual shots are accepted during refill cooldown and keep exactly three controllable values',()=>{
 const e=new Engine(123);for(let k=0;k<12;k++){
  e.select(e.rack[k%3].id);assert.equal(e.shoot(0,.05,true),true);
  assert.equal(e.rack.length,3);assert.notEqual(e.rack[0].level,e.rack[1].level);assert.notEqual(e.rack[1].level,e.rack[2].level);
 }
 assert.equal(e.shots,12);assert.equal(e.blobs.length,12);
});
test('Grabbing a second blob during a shift preserves the first body’s current pose and motion',()=>{
 const m=new RackMotion();m.reset(items);m.play([],[items[0],items[2],items[1]]);m.update(.07);
 const first=m.visual.get(2),x=first.x,y=first.y,vx=first.body.vx;
 assert.equal(m.busy,true);assert.equal(m.hold(1,70,-15),true);assert.equal(m.busy,false);
 assert.ok(Math.abs(m.visual.get(2).x-x)<.00001);assert.ok(Math.abs(m.visual.get(2).y-y)<.00001);assert.ok(Math.abs(m.visual.get(2).body.vx-vx)<.00001);
 m.update(.1);assert.ok(Math.abs(m.visual.get(2).x-x)>1);assert.equal(m.held.id,1);assert.equal(m.items.length,3);
});
test('Interrupting a refill preserves exactly the current logical IDs and removes obsolete merge faces',()=>{
 const m=new RackMotion();m.reset(items);const result={id:4,level:1},next={id:5,level:4};
 m.play([{kind:'merge',id:4,level:1,from:[1,2],before:items,after:[result,items[2]]}],[result,items[2],next]);
 m.interrupt([result,items[2],next]);assert.deepEqual([...m.visual.keys()].sort((a,b)=>a-b),[3,4,5]);assert.equal(m.items.length,3);
 assert.ok(m.items.every(i=>i.alpha===1&&i.scale===1&&i.body.nodes.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
});
test('The Shoot touch-end guard suppresses every rapid tap without preventing ordinary controls',()=>{
 const listeners=new Map(),doc={addEventListener:(type,fn,options)=>listeners.set(type,{fn,options}),removeEventListener:type=>listeners.delete(type)};
 const child={},button={ownerDocument:doc,contains:target=>target===child};const remove=installShootTouchGuard(button);
 assert.equal(listeners.get('touchend').options.passive,false);assert.equal(listeners.get('touchend').options.capture,true);
 function event(target,id){const e=new Event('touchend',{cancelable:true});Object.defineProperties(e,{target:{value:target},changedTouches:{value:[{identifier:id}]}});return e;}
 for(let id=1;id<4;id++){
  const start=event(child,id);listeners.get('touchstart').fn(start);
  const end=event(id===2?{}:button,id);listeners.get('touchend').fn(end);assert.equal(end.defaultPrevented,true);
 }
 const other=event({},99);listeners.get('touchend').fn(other);assert.equal(other.defaultPrevented,false);
 remove();assert.equal(listeners.size,0);
});
