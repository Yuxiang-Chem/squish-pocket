import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob} from '../dist/engine.js';
import {insideBottle} from '../dist/bottle.js';
import {DEFAULT_PHYSICS,normalizePhysics,playerPhysics} from '../dist/physics-settings.js';
const dt=1/120;
test('Low stiffness permits visibly more impact deformation than high stiffness',()=>{
  function impact(stiffness){
    const e=new Engine(123);e.setPhysics({stiffness,viscosity:20});e.blobs=[blob(6,180,240)];let widest=0;
    for(let i=0;i<360;i++){e.step(dt);const b=e.blobs[0].bounds;widest=Math.max(widest,(b.maxX-b.minX)/(b.maxY-b.minY));}
    return widest;
  }
  const liquid=impact(0),rigid=impact(100);
  assert.ok(liquid>rigid*3);assert.ok(rigid<1.15);
});
test('High viscosity slows movement through the same distance and gravity',()=>{
  function fall(viscosity){
    const e=new Engine(123);e.setPhysics({stiffness:30,viscosity});e.blobs=[blob(3,180,140)];
    for(let i=0;i<120;i++)e.step(dt);return e.blobs[0].y;
  }
  assert.ok(fall(0)>fall(100)+150);
});
test('Preferences persist without resetting the game and old saves get defaults',()=>{
  const e=new Engine(123);e.shoot(.3,.5);e.step(dt);const before=JSON.stringify(e.blobs),score=e.score,selection=e.selectedId;
  e.setPhysics({stiffness:8,viscosity:85});assert.equal(JSON.stringify(e.blobs),before);assert.equal(e.score,score);assert.equal(e.selectedId,selection);
  const restored=Engine.restore(JSON.parse(JSON.stringify(e)));assert.deepEqual(restored.physics,{stiffness:8,viscosity:85,blobSize:150});
  const old=JSON.parse(JSON.stringify(e));delete old.physics;assert.deepEqual(Engine.restore(old).physics,DEFAULT_PHYSICS);
  assert.deepEqual(normalizePhysics({stiffness:-10,viscosity:500}),{stiffness:0,viscosity:100,blobSize:150});
  old.physics={stiffness:null,viscosity:'bad'};assert.deepEqual(Engine.restore(old).physics,DEFAULT_PHYSICS);
});
test('Both extreme stiffness and viscosity settings remain stable in a loaded game',()=>{
  for(const stiffness of [0,100])for(const viscosity of [0,100]){
    let e=new Engine(234);e.setPhysics({stiffness,viscosity});
    for(let tick=0;tick<3600;tick++){
      if(tick%100===0)e.shoot(Math.sin(tick)*1.1,(tick%3)/2);
      e.step(dt);
      for(const b of e.blobs){
        assert.ok([b.x,b.y,b.vx,b.vy,...(b.nodes??[]).flatMap(p=>[p.x,p.y,p.px,p.py])].every(Number.isFinite));
        if(!b.spilled)assert.ok((b.nodes??[]).filter(p=>p.bottleSide).every(p=>insideBottle(p.x,p.y,.00001)));if(b.spilled)assert.equal(e.endReason,'spill');
      }
      if(e.over){e=new Engine(tick+1);e.setPhysics({stiffness,viscosity});}
    }
  }
});

test('Player physics locks legacy stiffness, viscosity and size while preserving game progress',()=>{
  for(const size of [40,80,110,150]){
    const e=new Engine(123);e.setPhysics({stiffness:18,viscosity:50,blobSize:size});e.shoot(0,.2);e.score=64;
    const restored=Engine.restore(JSON.parse(JSON.stringify(e)));
    restored.setPhysics(playerPhysics(restored.physics,1));
    assert.deepEqual(restored.physics,DEFAULT_PHYSICS);
    assert.equal(restored.score,64);assert.equal(restored.shots,1);assert.equal(restored.blobs.length,1);
    assert.equal(restored.blobs[0].renderRadius,restored.radius(restored.blobs[0].level));
  }
  assert.deepEqual(playerPhysics({stiffness:30,viscosity:20,blobSize:80}),DEFAULT_PHYSICS);
  assert.deepEqual(playerPhysics({stiffness:30,viscosity:20,blobSize:80},1),DEFAULT_PHYSICS);
});
