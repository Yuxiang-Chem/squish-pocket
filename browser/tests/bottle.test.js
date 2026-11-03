import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob,radiusFor} from '../dist/engine.js';
import {bottleWalls,bottleLeftAt,insideBottle,BOTTLE_FLOOR} from '../dist/bottle.js';
const dt=1/120;
test('Bottle has a narrower open neck and a wider rounded body',()=>{
  assert.ok(bottleLeftAt(140)>bottleLeftAt(300)+30);
  assert.equal(insideBottle(180,114),true);assert.equal(insideBottle(35,140),false);
  assert.equal(insideBottle(35,300),true);assert.equal(insideBottle(25,460),false);
  assert.ok(bottleLeftAt(460)>bottleLeftAt(300));
});
test('Neck walls reflect particles while missed shots fall freely outside the open rim',()=>{
  const neck={x:70,y:140,px:95,py:140},rim={x:40,y:118,px:40,py:110},middle={x:180,y:118,px:180,py:110};
  bottleWalls({nodes:[neck,rim,middle]});
  assert.ok(insideBottle(neck.x,neck.y,.00001));assert.ok(neck.x-neck.px>0);
  assert.equal(rim.y,118);assert.ok(rim.y-rim.py>0);
  assert.equal(middle.y,118);assert.equal(middle.py,110);
});
test('Sloped shoulder and rounded floor constrain actual membrane points',()=>{
  const shoulder={x:25,y:170,px:50,py:170},floor={x:30,y:418,px:40,py:395,bottleSide:true};
  bottleWalls({nodes:[shoulder,floor]});
  assert.ok(insideBottle(shoulder.x,shoulder.y,.00001));assert.ok(shoulder.y-shoulder.py>0);
  assert.ok(insideBottle(floor.x,floor.y,.00001));assert.ok(floor.y<=BOTTLE_FLOOR);
});
test('Blob size changes real geometry immediately and survives restoration',()=>{
  const e=new Engine(123);e.setPhysics({...e.physics,blobSize:80});e.blobs=[blob(3,180,320)];e.step(dt);
  const b=e.blobs[0],before=b.nodes.map(p=>Math.hypot(p.x-b.x,p.y-b.y)),velocity=b.nodes.map(p=>[p.x-p.px,p.y-p.py]);
  e.setPhysics({...e.physics,blobSize:150});
  assert.equal(b.renderRadius,radiusFor(3,150));
  b.nodes.forEach((p,i)=>{assert.ok(Math.abs(Math.hypot(p.x-b.x,p.y-b.y)/before[i]-150/80)<.00001);assert.ok(Math.abs((p.x-p.px)-velocity[i][0])<.00001);});
  const restored=Engine.restore(JSON.parse(JSON.stringify(e)));assert.equal(restored.physics.blobSize,150);
  assert.equal(restored.blobs[0].renderRadius,b.renderRadius);
});
test('Large and small blobs stay contained after entry or finish the round on a spill',()=>{
  for(const blobSize of [40,150])for(const stiffness of [0,100]){
    let e=new Engine(456);e.setPhysics({stiffness,viscosity:20,blobSize});
    for(let tick=0;tick<3000;tick++){
      if(tick%100===0)e.shoot(Math.sin(tick)*.7,(tick%3)/2);
      e.step(dt);
      for(const b of e.blobs)for(const p of b.nodes??[]){
        assert.ok([p.x,p.y,p.px,p.py].every(Number.isFinite));if(p.bottleSide&&!b.spilled)assert.ok(insideBottle(p.x,p.y,.00001));if(b.spilled)assert.equal(e.endReason,'spill');
      }
      if(e.over){e=new Engine(tick+1);e.setPhysics({stiffness,viscosity:20,blobSize});}
    }
  }
});
