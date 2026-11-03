import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob} from '../dist/engine.js';
import {hasMatchingNeighbors,refillRack} from '../dist/rack.js';
import {prepare,measure} from '../dist/softbody.js';
function fixture(levels){const e=new Engine(123);e.rack=levels.map((level,i)=>({id:i+1,level}));e.rackSerial=3;e.selectedId=2;e.incoming={level:4,side:'left'};e.syncRack();return e;}
test('Old saved middle/neighbor duplicates normalize and refill without losing progress',()=>{
 for(const levels of [[0,0,2],[2,0,0],[0,0,0],[2,2,2]]){
  const e=fixture(levels);e.score=128;e.shots=9;
  const restored=Engine.restore(JSON.parse(JSON.stringify(e)));
  assert.equal(restored.rack.length,3);assert.equal(hasMatchingNeighbors(restored.rack),false);assert.equal(restored.score,128);assert.equal(restored.shots,9);
  assert.ok(restored.rackEvents.some(event=>event.kind==='merge'));
 }
 const separated=fixture([0,2,0]);assert.deepEqual(Engine.restore(JSON.parse(JSON.stringify(separated))).rack,separated.rack);
});
test('Shooting between equal outer blobs makes them merge as new neighbors',()=>{
 const e=fixture([0,2,0]);e.shoot(0,.1);
 assert.deepEqual(e.rackEvents[0].from,[1,3]);assert.equal(e.rack.length,3);assert.equal(hasMatchingNeighbors(e.rack),false);assert.equal(e.score,0);assert.equal(e.shots,1);
});
test('Swap-created duplicates and capped values also leave a distinct middle',()=>{
 const e=fixture([0,2,0]);e.moveRack(2,1);assert.equal(hasMatchingNeighbors(e.rack),false);assert.equal(e.rack.length,3);
 for(const levels of [[11,11,3],[3,11,11]]){
  const e=fixture(levels),before=e.rack.reduce((n,b)=>n+2**(b.level+1),0),events=refillRack(e,()=>e.newIncoming());
  assert.equal(hasMatchingNeighbors(e.rack),false);assert.equal(e.rack[1].level,3);assert.equal(events[0].kind,'shift');assert.equal(e.rack.reduce((n,b)=>n+2**(b.level+1),0),before);
 }
});
test('Ten thousand selectable shots preserve three blobs, distinct neighbors, and total value',()=>{
 const e=new Engine(765);
 for(let k=0;k<10000;k++){
  e.cooldown=0;e.blobs=[];const chosen=e.rack[k%3],before=e.rack.reduce((n,b)=>n+2**(b.level+1),0);e.select(chosen.id);e.shoot(0,.1);
  const incoming=e.rackEvents.filter(event=>event.kind==='arrive').reduce((n,event)=>n+2**(event.level+1),0);
  assert.equal(e.rack.length,3);assert.equal(hasMatchingNeighbors(e.rack),false);assert.equal(e.rack.reduce((n,b)=>n+2**(b.level+1),0),before-2**(chosen.level+1)+incoming);
 }
});
test('Older settled piles move with the shorter base without changing score or momentum',()=>{
 const e=new Engine(123),b=blob(0,180,430,40,0);b.age=3;prepare(b,e.radius(0),1/120);measure(b,1/120);e.blobs=[b];e.score=64;
 const saved=JSON.parse(JSON.stringify(e));delete saved.bottleVersion;const restored=Engine.restore(saved);
 assert.ok(Math.abs(restored.blobs[0].y-370)<.0001);assert.ok(Math.abs(restored.blobs[0].vx-40)<.0001);assert.equal(restored.score,64);
 assert.deepEqual(Engine.restore(JSON.parse(JSON.stringify(restored))),restored);
});
