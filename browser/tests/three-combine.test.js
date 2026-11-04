import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob,setReducedMergeMotion,MERGE_DELAY} from '../dist/engine.js';
import {RULES,valueFor,validValue,saveKeyFor,profileKeyFor,connectedTriples} from '../dist/merge-rules.js';
import {prepare,measure} from '../dist/softbody.js';
import {refillRack} from '../dist/rack.js';
import {loadProfile,captureProgress} from '../dist/achievements.js';
const dt=1/120;
function pile(xs,level=0,mode='three'){
 const e=new Engine(42,'classic',mode);e.blobs=xs.map(x=>blob(level,x,300));
 for(const b of e.blobs){prepare(b,e.radius(level),dt);measure(b,dt);b.hasEntered=true;b.inBottle=true;for(const p of b.nodes)p.bottleSide=true;}
 return e;
}
test('three-combine values, caps and save/profile keys are independent',()=>{
 assert.deepEqual([0,1,2,3,4].map(n=>valueFor(n,'three')),[1,3,9,27,81]);
 assert.equal(valueFor(11,'three'),177147);assert.equal(valueFor(0),2);assert.equal(valueFor(11),4096);
 for(const n of [1,3,9,27,2187,177147])assert.ok(validValue(n,'three'));
 for(const n of [0,2,4,8,2188,531441])assert.equal(validValue(n,'three'),false);
 assert.notEqual(saveKeyFor('classic','three'),saveKeyFor('classic'));assert.notEqual(profileKeyFor('three'),profileKeyFor('two'));
 const data=new Map();const storage={getItem:k=>data.get(k)??null};
 data.set(profileKeyFor('two'),JSON.stringify({id:crypto.randomUUID(),token:crypto.randomUUID(),name:'Old',score:8192,highestTile:2048,bottles:{classic:{score:8192,highestTile:2048}}}));
 const triple=loadProfile(storage,'three');assert.equal(triple.score,0);assert.equal(triple.highestTile,1);assert.equal(triple.mergeMode,'three');
 assert.equal(captureProgress(triple,new Engine(42)),false);assert.equal(triple.score,0);
});
test('pairs stay separate, while three touching ones make exactly one three',()=>{
 setReducedMergeMotion(true);
 const pair=pile([162,198]);for(let i=0;i<120;i++)assert.deepEqual(pair.step(dt),[]);assert.equal(pair.blobs.length,2);assert.equal(pair.score,0);
 const e=pile([145,180,215]);const result=e.step(dt);assert.equal(result.length,1);assert.equal(result[0].value,3);assert.equal(e.blobs.length,1);assert.equal(e.blobs[0].level,1);assert.equal(e.score,3);
 const classic=pile([162,198],0,'two');assert.equal(classic.step(dt)[0].value,4);assert.equal(classic.score,4);
 setReducedMergeMotion(false);
});
test('connected triples require three equal members and never consume an extra blob',()=>{
 const a=blob(0,100,300),b=blob(0,135,300),c=blob(0,170,300),d=blob(0,205,300),other=blob(1,135,320);
 assert.deepEqual(connectedTriples([a,b,c],[[a,b]]),[]);assert.deepEqual(connectedTriples([a,b,other],[[a,b],[b,other]]),[]);
 assert.deepEqual(connectedTriples([a,b,c,d],[[a,b],[b,c],[c,d]]),[[a,b,c]]);
 assert.deepEqual(connectedTriples([blob(11,0,0),b,c],[[b,c]]),[]);
 setReducedMergeMotion(true);const four=pile([128,163,198,233]);const result=four.step(dt);assert.equal(result.length,1);assert.equal(four.blobs.length,2);assert.equal(four.blobs.filter(b=>b.level===0).length,1);assert.equal(four.score,3);setReducedMergeMotion(false);
});
test('triple fusing survives a mid-merge save and scores once, and invalid mode saves are rejected',()=>{
 const e=pile([145,180,215]);e.step(dt);assert.equal(e.blobs.filter(b=>b.fuse).length,3);assert.equal(e.score,0);
 const restored=Engine.restore(JSON.parse(JSON.stringify(e)));assert.equal(restored.mergeMode,'three');
 for(let i=0;i<Math.ceil(MERGE_DELAY/dt)+3;i++)restored.step(dt);
 assert.equal(restored.blobs.length,1);assert.equal(restored.score,3);assert.equal(restored.value(restored.blobs[0].level),3);
 for(let i=0;i<120;i++)restored.step(dt);assert.equal(restored.score,3);
 const bad=JSON.parse(JSON.stringify(e));bad.mergeMode='unknown';assert.equal(Engine.restore(bad),null);
 const old=JSON.parse(JSON.stringify(new Engine(42)));delete old.mergeMode;assert.equal(Engine.restore(old).mergeMode,'two');
});
test('three ready values combine only as a triple and refill with three sources in the event',()=>{
 const state={rules:RULES.three,rack:[{id:1,level:0},{id:2,level:0},{id:3,level:1}],rackSerial:3,selectedId:2,incoming:{level:0,side:'right'}};
 assert.deepEqual(refillRack(state,()=>({level:2,side:'left'})),[]);assert.equal(state.rack.length,3);
 state.rack[2].level=0;
 const events=refillRack(state,()=>({level:2,side:'left'}));const event=events.find(e=>e.kind==='merge');assert.deepEqual(event.from,[1,2,3]);assert.equal(event.level,1);assert.equal(state.rack.length,3);
 const e=new Engine(42,'classic','three');e.rack=[{id:1,level:0},{id:2,level:0},{id:3,level:1}];e.rackSerial=3;e.selectedId=2;e.syncRack();assert.equal(e.mergeRackContacts([{a:1,b:2}],new Set([1])),false);assert.equal(e.rack.length,3);
 for(let i=0;i<100;i++)assert.ok(e.newIncoming().level<=2);
});

test('three threes make nine and three nines make twenty-seven',()=>{
 setReducedMergeMotion(true);
 for(const level of [1,2]){const e=pile([145,180,215],level);const events=e.step(dt);assert.equal(events.length,1);assert.equal(events[0].value,3**(level+1));assert.equal(e.blobs.length,1);assert.equal(e.blobs[0].level,level+1);}
 setReducedMergeMotion(false);
});
test('new arrivals complete landed and floating triples during ordinary repeated play',()=>{
 for(const id of ['classic','classic-water','lab-flask-water','conical-flask-water']){
  const e=new Engine(42,id,'three');
  for(let shot=0;shot<12&&!e.over;shot++){
   e.rack=[{id:1,level:0},{id:2,level:1},{id:3,level:2}];e.rackSerial=3;e.selectedId=1;e.syncRack();e.shoot(0,.2,true);
   for(let i=0;i<240&&!e.over;i++)e.step(dt);
  }
  assert.equal(e.over,false,id);assert.ok(e.score>=3,id);assert.equal(e.score%3,0);
 }
});
