import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pullMode,pullShot,insertionIndex,insertedOrder} from '../dist/preparation-gesture.js';
import {Engine} from '../dist/engine.js';
import {RackMotion} from '../dist/rack-motion.js';
const items=[{id:1,level:0},{id:2,level:2},{id:3,level:4}],start={x:180,y:58};
const ids=items=>items.map(b=>b.id);
function fixture(levels=[0,2,4]){const e=new Engine(123);e.rack=levels.map((level,i)=>({id:i+1,level}));e.rackSerial=3;e.selectedId=2;e.score=64;e.syncRack();return e;}
test('A small movement stays a tap; downward and upward pulls have distinct purposes',()=>{
 assert.equal(pullMode(start,{x:183,y:61}),'pending');
 assert.equal(pullMode(start,{x:184,y:75}),'charge');
 assert.equal(pullMode(start,{x:180,y:40}),'drag');
 assert.equal(pullMode(start,{x:220,y:61}),'drag');
});
test('Downward distance accumulates force, returning to the start cancels, sideways motion alone adds no force',()=>{
 const weak=pullShot(start,{x:180,y:98}),strong=pullShot(start,{x:180,y:238});
 assert.ok(weak.power>0&&weak.power<strong.power);assert.equal(strong.power,1);
 assert.equal(pullShot(start,{x:180,y:60}).cancelled,true);
 assert.equal(pullShot(start,{x:180,y:30}).cancelled,true);
 assert.equal(pullShot(start,{x:300,y:98}).power,weak.power);
 assert.ok(pullShot(start,{x:220,y:140}).angle>0);
});
test('Drop anchors stay stable and distant releases return instead of rearranging',()=>{
 const anchors=[90,180,270];assert.equal(insertionIndex({x:265,y:25},anchors),2);
 assert.equal(insertionIndex({x:85,y:50},anchors),0);assert.equal(insertionIndex({x:180,y:10},anchors),1);
 for(const p of [{x:180,y:200},{x:180,y:-90},{x:390,y:58}])assert.equal(insertionIndex(p,anchors),null);
});
test('Insertion moves neighbors into the vacated slots instead of swapping the ends',()=>{
 assert.deepEqual(ids(insertedOrder(items,2,2)),[1,3,2]);assert.deepEqual(ids(insertedOrder(items,1,2)),[2,3,1]);
 for(let from=0;from<3;from++)for(let to=0;to<3;to++){
  const e=fixture();assert.equal(e.reorderRack(from+1,to),from!==to);
  assert.deepEqual(ids(e.rack),ids(insertedOrder(items,from+1,to)));
  assert.equal(e.score,64);assert.equal(e.shots,0);assert.equal(e.blobs.length,0);
  if(from!==to){assert.equal(e.selectedId,from+1);assert.equal(e.rackEvents[0].kind,'shift');}
 }
});
test('Rearranging a row can intentionally create matching neighbors and refill to three',()=>{
 const e=fixture([0,2,0]);assert.equal(e.reorderRack(2,2),true);
 assert.equal(e.rackEvents[0].kind,'shift');assert.deepEqual(e.rackEvents[1].from,[1,3]);
 assert.equal(e.rack.length,3);assert.notEqual(e.rack[0].level,e.rack[1].level);assert.notEqual(e.rack[1].level,e.rack[2].level);
 assert.equal(e.score,64);assert.equal(e.shots,0);assert.equal(e.reorderRack(999,1),false);assert.equal(e.reorderRack(2,NaN),false);
});
test('Lifting to the right visibly shifts the right blob toward the middle before committing',()=>{
 const m=new RackMotion();m.reset(items);const oldRight=m.visual.get(3).x,home=m.rest.get(2);
 m.hold(2,oldRight,home.y-65);m.previewInsertion(2,2);
 for(let k=0;k<60;k++)m.update(1/120);
 assert.ok(m.visual.get(3).x<oldRight-20);assert.deepEqual(ids(m.order),[1,2,3]);
 m.release();assert.equal(m.rest.get(3).x,oldRight);
 const e=fixture();e.reorderRack(2,2);m.play(e.rackEvents,e.rack);
 for(let k=0;k<240&&m.busy;k++)m.update(1/120);
 assert.equal(m.busy,false);assert.deepEqual(ids(m.order),[1,3,2]);assert.ok(m.visual.get(3).x<m.visual.get(2).x);
});
test('Charging stretches the membrane without making it eligible for contact merging',()=>{
 const m=new RackMotion();m.reset([{id:1,level:0},{id:2,level:2},{id:3,level:0}]);
 const b=m.visual.get(1).body,home={x:b.x,y:b.y},before=b.bounds.maxY-b.bounds.minY;
 m.charge(1,home,1);m.update(1/60);
 assert.ok(b.bounds.maxY-b.bounds.minY>before*1.25);assert.equal(m.activeDrags.has(1),false);
 assert.equal(m.held.merge,false);assert.deepEqual(m.takeContacts(),[]);
 m.release();assert.equal(b.kinematic,false);assert.equal(b.chargeStretch,undefined);assert.deepEqual(b.restAspect,{x:1.4,y:1/1.4});
});
test('Diagonal pulls toward the bottle charge and show the guide from the first movement',()=>{
 for(const point of [{x:200,y:70},{x:160,y:70},{x:186,y:66}]){
  assert.equal(pullMode(start,point),'charge');
  const shot=pullShot(start,point);assert.equal(shot.cancelled,false);assert.ok(shot.power>0);
  assert.ok(Math.abs(shot.angle)<1,'Tiny pulls keep a steady aim instead of swinging to the edge');
 }
});
