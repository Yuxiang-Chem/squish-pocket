import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {refillRack} from '../dist/rack.js';
import {clusterLayout} from '../dist/preparation.js';

test('Incoming values cover 2–32 and use both sides independently',()=>{
  const e=new Engine(123),levels=new Set(),sides=new Set(),counts=Array(5).fill(0);
  for(let i=0;i<10000;i++){
    const item=e.newIncoming();levels.add(item.level);sides.add(item.side);counts[item.level]++;
    assert.ok(item.level>=0&&item.level<=4);
  }
  assert.deepEqual([...levels].sort(),[0,1,2,3,4]);assert.deepEqual([...sides].sort(),['left','right']);
  assert.ok(counts.every(n=>n>1750&&n<2250));
});
test('Launcher refill cascades matching values until exactly three are available',()=>{
  const state={rack:[{id:1,level:0},{id:2,level:1}],rackSerial:2,selectedId:1,incoming:{level:0,side:'left'},score:99};
  const sequence=[{level:2,side:'right'},{level:4,side:'left'},{level:1,side:'right'},{level:0,side:'left'}];
  const events=refillRack(state,()=>sequence.shift());
  assert.equal(state.rack.length,3);assert.equal(events.filter(e=>e.kind==='merge').length,3);
  assert.deepEqual(state.rack.map(b=>b.level),[4,3,1]);
  assert.equal(state.rack.reduce((n,b)=>n+2**(b.level+1),0),52,'Combining preserves total value');
  assert.equal(state.rack.find(b=>b.id===state.selectedId).level,3,'Selection follows a merged result');
  assert.equal(state.score,99,'Launcher setup does not add pile points');
});
test('Any ready blob can be selected in place and shoots from its own slot',()=>{
  for(let slot=0;slot<3;slot++){
    const e=new Engine(765),chosen=e.rackOrder()[slot],home=clusterLayout(e.rackOrder(),e.physics.blobSize)[slot];
    assert.equal(e.select(chosen.id),true);assert.equal(e.rackOrder()[slot].id,chosen.id);
    assert.equal(e.shoot(.1,.3,false,home),true);assert.equal(e.blobs[0].level,chosen.level);
    assert.equal(e.blobs[0].x,home.x);assert.equal(e.blobs[0].y,58);
    if(slot!==1)assert.ok(Math.abs(home.x-180)>40,'Side slots are well away from the center');
    assert.equal(e.rack.some(b=>b.id===chosen.id),false);assert.equal(e.rack.length,3);
  }
});
test('Next preview matches the arriving side and value across repeated shots',()=>{
  const e=new Engine(567);
  for(let i=0;i<200;i++){
    const incoming={...e.incoming};e.cooldown=0;e.blobs=[];
    assert.equal(e.shoot(0,.3),true);
    const arrival=e.rackEvents.find(event=>event.kind==='arrive');assert.equal(arrival.level,incoming.level);
    assert.equal(arrival.side,incoming.side);assert.equal(e.rack.length,3);
    assert.ok(e.rack.some(b=>b.id===e.selectedId));
  }
});
test('Separated matching blobs remain available for a manual drag merge',()=>{
  const e=new Engine(123);e.rack=[{id:1,level:0},{id:2,level:2},{id:3,level:0}];e.rackSerial=3;e.selectedId=2;e.incoming={level:4,side:'left'};e.syncRack();
  const shots=e.shots,score=e.score;
  assert.equal(e.moveRack(1,3),'merge');assert.equal(e.rack.length,3);
  assert.equal(e.shots,shots);assert.equal(e.score,score);assert.equal(e.blobs.length,0);
  assert.deepEqual(e.rackEvents[0].from,[1,3]);assert.ok(e.rack.some(b=>b.level===1));
  assert.ok(e.rack.some(b=>b.id===e.selectedId));
});
test('Dragging nonmatching blobs swaps positions without firing or consuming the preview',()=>{
  const e=new Engine(123);e.rack=[{id:1,level:0},{id:2,level:2},{id:3,level:1}];e.rackSerial=3;e.selectedId=2;e.syncRack();
  const incoming={...e.incoming};
  assert.equal(e.moveRack(1,3),'swap');assert.deepEqual(e.rack.map(b=>b.id),[3,2,1]);
  assert.deepEqual(e.incoming,incoming);assert.equal(e.shots,0);assert.equal(e.blobs.length,0);
  const before=JSON.stringify(e);assert.equal(e.moveRack(1,99),false);assert.equal(JSON.stringify(e),before);
});
test('An explicit drag merge can cascade with its new neighbor before refilling',()=>{
  const e=new Engine(123);e.rack=[{id:1,level:0},{id:2,level:1},{id:3,level:0}];e.rackSerial=3;e.selectedId=2;e.incoming={level:4,side:'left'};e.syncRack();
  e.moveRack(1,3);assert.ok(e.rackEvents.filter(event=>event.kind==='merge').length>=2);
  assert.equal(e.rack.length,3);assert.equal(e.shots,0);
  const copy=Engine.restore(JSON.parse(JSON.stringify(e)));assert.deepEqual(copy,e);
});
test('Old two-value saves migrate and ready selection survives save/restore',()=>{
  const old=JSON.parse(JSON.stringify(new Engine(456)));
  for(const k of ['rack','incoming','selectedId','rackSerial','rackEvents'])delete old[k];
  old.current=0;old.next=2;old.score=80;old.shots=6;
  const migrated=Engine.restore(old);assert.equal(migrated.rack.length,3);assert.equal(migrated.score,80);assert.equal(migrated.shots,6);
  migrated.select(migrated.rackOrder()[0].id);
  assert.deepEqual(Engine.restore(JSON.parse(JSON.stringify(migrated))),migrated);
  const corrupt=JSON.parse(JSON.stringify(migrated));corrupt.incoming.level=6;assert.equal(Engine.restore(corrupt),null);
});

test('Separated matching sides stay distinct until a shot makes them neighbors',()=>{
 const e=new Engine(12);e.rack=[{id:1,level:0},{id:2,level:2},{id:3,level:0}];e.selectedId=2;e.rackSerial=3;
 const before=JSON.stringify(e.rack),incoming={...e.incoming};assert.deepEqual(refillRack(e,()=>e.newIncoming()),[]);assert.equal(JSON.stringify(e.rack),before);assert.deepEqual(e.incoming,incoming);
 e.incoming={level:4,side:'left'};e.shoot(0,.1);assert.equal(e.rack.filter(b=>b.level===0).length,0,'Once the middle is shot, the two equal values are neighbors and combine');assert.deepEqual(e.rackEvents[0].from,[1,3]);
});
