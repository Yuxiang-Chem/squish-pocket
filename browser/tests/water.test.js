import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob} from '../dist/engine.js';
import {BOTTLES,isBottleId} from '../dist/bottles.js';
import {prepare,measure} from '../dist/softbody.js';
const dt=1/120;
function shot(id,power){
  const e=new Engine(42,id);e.rack=[{id:1,level:0},{id:2,level:1},{id:3,level:2}];e.rackSerial=3;e.selectedId=1;e.syncRack();
  assert.equal(e.shoot(0,power,true),true);
  let deepest=0,droplets=0,ripples=0;
  for(let i=0;i<1200&&!e.over;i++){
    e.step(dt);deepest=Math.max(deepest,e.blobs[0].y);droplets=Math.max(droplets,e.waterState.droplets.length);ripples=Math.max(ripples,e.waterState.ripples.length);
    for(const b of e.blobs)for(const p of b.nodes){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));if(p.bottleSide)assert.ok(e.vessel.insideBottle(p.x,p.y,.01));}
  }
  return {e,deepest,droplets,ripples};
}
test('Four water vessels retain the existing bottle shapes and separate identities',()=>{
  assert.equal(Object.keys(BOTTLES).length,8);
  for(const base of ['classic','lab-flask','separating-funnel','conical-flask']){
    const wet=BOTTLES[base+'-water'];assert.ok(isBottleId(wet.id));assert.equal(wet.baseBottleId,base);
    assert.equal(wet.bottleOutline,BOTTLES[base].bottleOutline);assert.equal(wet.bottleWalls,BOTTLES[base].bottleWalls);
    assert.ok(wet.water);assert.equal(BOTTLES[base].water,undefined);
    assert.equal(new Engine(42).bottleId,'classic');
  }
});
test('Blobs rise and settle floating at each water surface while strong shots dive and splash',()=>{
  for(const id of ['classic-water','lab-flask-water','separating-funnel-water','conical-flask-water']){
    const gentle=shot(id,0),strong=shot(id,1),water=strong.e.vessel.water;
    assert.equal(gentle.e.over,false);assert.equal(strong.e.over,false);
    assert.equal(gentle.droplets,0);assert.ok(gentle.ripples>0);assert.ok(strong.droplets>=8);
    assert.ok(strong.deepest>gentle.deepest+35,'A strong shot dives substantially deeper');
    const b=strong.e.blobs[0];assert.ok(Math.abs(b.y-water.level)<strong.e.radius(b.level));
    assert.ok(b.bounds.minY<water.level&&b.bounds.maxY>water.level);assert.ok(Math.abs(b.vy)<2);
    assert.equal(strong.e.score,0);assert.equal(strong.e.shots,1);
  }
});
test('Floating blobs can merge and their wet round resumes without phantom splashes',()=>{
  for(const id of ['classic-water','lab-flask-water','separating-funnel-water','conical-flask-water']){
    const e=new Engine(7,id),level=e.vessel.water.level;
    e.blobs=[blob(1,164,level+6),blob(1,198,level+6)];
    for(const b of e.blobs){prepare(b,e.radius(b.level),dt);measure(b,dt);b.inBottle=true;b.hasEntered=true;for(const p of b.nodes)p.bottleSide=true;}
    for(let i=0;i<360;i++)e.step(dt);
    assert.equal(e.over,false);assert.equal(e.blobs.length,1);assert.equal(e.score,8);
    const saved=JSON.parse(JSON.stringify(e));assert.equal(saved.waterState,undefined);
    const restored=Engine.restore(saved);assert.ok(restored);assert.equal(restored.bottleId,id);assert.equal(restored.score,8);
    restored.step(dt);assert.equal(restored.waterState.droplets.length,0);
    assert.ok(Math.abs(restored.blobs[0].y-level)<restored.radius(2));
  }
});
test('Water does not rescue shots between flask necks or make droplets end the round',()=>{
  const e=new Engine(42,'lab-flask-water');e.shoot(0,1,true,{x:123,y:58});
  for(let i=0;i<240&&!e.over;i++)e.step(dt);
  assert.equal(e.endReason,'spill');assert.equal(e.blobs[0].missedEntry,true);
  const y=e.blobs[0].y;for(let i=0;i<24;i++)e.animateSpill(1/60);
  assert.ok(e.blobs[0].y>y+25);assert.equal(e.shots,1);assert.equal(e.score,0);
});
