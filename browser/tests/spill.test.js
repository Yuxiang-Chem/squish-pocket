import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob} from '../dist/engine.js';
import {updateBottleState,BOTTLE_MOUTH} from '../dist/bottle.js';
import {DEFAULT_PHYSICS,upgradePhysicsDefaults,PHYSICS_DEFAULTS_VERSION} from '../dist/physics-settings.js';
import {MAX_ANGLE,LAUNCH_X,LAUNCH_Y} from '../dist/controls.js';
import {eject} from '../dist/ejection.js';
// Shots cannot aim this wide any more; this models a blob leaving the opening sideways.
function wideShot(e,angle){const s=e.rack.find(b=>b.id===e.selectedId),b=blob(s.level,LAUNCH_X,LAUNCH_Y,Math.sin(angle)*1080,Math.cos(angle)*1080);b.inBottle=false;eject(b,e.radius(s.level),e.physics);return e.consumeRack(s.id,b);}
const dt=1/120;
test('Default profile is 10% stiffness, 0% viscosity, and 150% size',()=>{
 assert.deepEqual(DEFAULT_PHYSICS,{stiffness:10,viscosity:0,blobSize:150});assert.deepEqual(new Engine(123).physics,DEFAULT_PHYSICS);
 assert.deepEqual(upgradePhysicsDefaults({stiffness:30,viscosity:20,blobSize:80}),DEFAULT_PHYSICS);
 assert.deepEqual(upgradePhysicsDefaults({stiffness:18,viscosity:50,blobSize:110}),{stiffness:18,viscosity:50,blobSize:110});
 assert.deepEqual(upgradePhysicsDefaults({stiffness:30,viscosity:20,blobSize:80},PHYSICS_DEFAULTS_VERSION),{stiffness:30,viscosity:20,blobSize:80});
});
test('Missing the opening on either side ends the round immediately and survives reload',()=>{
 for(const angle of [-1.3,1.3]){
  const e=new Engine(123);wideShot(e,angle);let steps=0;
  while(!e.over&&steps++<120)e.step(dt);
  assert.equal(e.over,true);assert.equal(e.endReason,'spill');assert.equal(e.blobs[0].spilled,true);
  assert.ok(e.blobs[0].y>=BOTTLE_MOUTH);assert.ok(steps<120);assert.equal(e.shoot(0,1),false);
  const saved=JSON.parse(JSON.stringify(e));assert.deepEqual(Engine.restore(saved),e);
  const before=JSON.stringify(e);e.step(dt);assert.equal(JSON.stringify(e),before);
 }
});
test('Normal center entry and interior wall collisions do not count as spills',()=>{
 const e=new Engine(123);e.shoot(.5,1);for(let k=0;k<180;k++)e.step(dt);
 assert.equal(e.over,false);assert.equal(e.blobs[0].inBottle,true);assert.ok(!e.blobs[0].spilled);
 const wall=new Engine(123);const b=blob(0,320,300,700,0);b.inBottle=true;wall.blobs=[b];
 for(let k=0;k<40;k++)wall.step(dt);assert.equal(wall.over,false);assert.ok(b.bounds.maxX<=350.0001);
});
test('A previously entered blob can leave over the lip and spill outside',()=>{
 const b={x:280,y:100,inBottle:true,renderRadius:10};assert.equal(updateBottleState(b,{x:280,y:120}),false);assert.equal(b.inBottle,false);
 b.x=320;b.y=114;assert.equal(updateBottleState(b,{x:300,y:100}),true);assert.equal(b.spilled,true);
 const e=new Engine(123),outside=blob(0,25,145,0,60);outside.inBottle=false;e.blobs=[outside];e.step(dt);
 assert.equal(e.endReason,'spill');assert.equal(e.over,true);assert.ok(outside.x<60,'Outside blob is not warped back inside');
});
test('Soft membrane tips near the opening do not lose the round while the body enters',()=>{
 const e=new Engine(123);e.shoot(0,1);const b=e.blobs[0];
 assert.ok(b.nodes.some(p=>p.y<BOTTLE_MOUTH));
 for(let k=0;k<30;k++)e.step(dt);assert.equal(e.over,false);assert.equal(b.inBottle,true);
});
test('The widest aim never launches a ready blob straight out of the bottle',()=>{
 for(const blobSize of [40,150])for(let level=0;level<=5;level++)for(const power of [0,.5,1])for(const sign of [-1,1]){
  const e=new Engine(7);e.rack=[{id:1,level:0},{id:2,level},{id:3,level:0}];e.rackSerial=3;e.selectedId=2;e.syncRack();e.setPhysics({stiffness:10,viscosity:0,blobSize});
  assert.equal(e.shoot(sign*MAX_ANGLE*2,power,true),true);
  for(let t=0;t<480&&!e.over;t++)e.step(1/120);
  assert.equal(e.over,false,`level ${level}, power ${power}, side ${sign}, size ${blobSize}`);
 }
});
