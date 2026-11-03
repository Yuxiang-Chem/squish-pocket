import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RackMotion} from '../dist/rack-motion.js';
import {HOLE,dragOutsideGlass,outsideGlass} from '../dist/preparation.js';
import {Engine} from '../dist/engine.js';
import {insideBottle,BOTTLE_MOUTH} from '../dist/bottle.js';
const base=[{id:1,level:0},{id:2,level:2},{id:3,level:4}];
test('Ready outer blobs remain separated in a row across materials and sizes',()=>{
 for(const stiffness of [0,30,100])for(const blobSize of [40,80,150]){
  const m=new RackMotion();m.setPhysics({stiffness,blobSize});m.reset(base);m.update(3);
  const [left,middle,right]=base.map(b=>m.visual.get(b.id));
  assert.ok(left.x<middle.x&&middle.x<right.x);assert.ok(left.body.bounds.maxX+5<right.body.bounds.minX);
  assert.ok(!m.contactPairs.some(p=>p.a===1&&p.b===3));
  assert.ok(Math.abs(middle.y-58)<2);
 }
});
test('Held blobs move outside the preparation row and gravity returns them without a shot',()=>{
 const m=new RackMotion();m.reset(base);m.hold(1,-60,250);m.update(.2);
 assert.ok(Math.abs(m.visual.get(1).x+60)<.01);assert.ok(Math.abs(m.visual.get(1).y-250)<.01);
 m.release();m.update(.2);assert.ok(m.visual.get(1).x>-60);assert.ok(m.visual.get(1).y<250);
 m.update(3);assert.ok(Math.hypot(m.visual.get(1).x-m.rest.get(1).x,m.visual.get(1).y-m.rest.get(1).y)<12);assert.equal(m.items.length,3);
});
test('Preparation dragging cannot cross into glass, including fast jumps and side entry',()=>{
 const top=dragOutsideGlass({x:180,y:58},{x:180,y:300},12);
 assert.equal(top.blocked,true);assert.ok(top.y<112);assert.ok(outsideGlass(top.x,top.y,12*1.45,12*.85));
 const side=dragOutsideGlass({x:-40,y:250},{x:180,y:250},12);
 assert.equal(side.blocked,true);assert.ok(side.x<18);
 assert.deepEqual(dragOutsideGlass({x:180,y:58},{x:-40,y:40},12),{x:-40,y:40,blocked:false});
});
test('Every returning preparation particle remains outside the actual bottle',()=>{
 for(const stiffness of [0,100])for(const blobSize of [40,150]){
  const m=new RackMotion();m.setPhysics({stiffness,blobSize});m.reset(base);m.hold(1,-80,350);m.release();
  for(let n=0;n<600;n++){
   m.update(1/120);
   for(const item of m.items)for(const p of item.body.nodes)assert.ok(p.y<BOTTLE_MOUTH||!insideBottle(p.x,p.y));
  }
  assert.ok(Math.hypot(m.visual.get(1).x-m.rest.get(1).x,m.visual.get(1).y-m.rest.get(1).y)<12);
 }
});
test('Resting contact cannot merge ready values; an explicit drag can',()=>{
 const e=new Engine(12);e.rack=[{id:1,level:0},{id:2,level:2},{id:3,level:0}];e.rackSerial=3;e.selectedId=2;
 const before=JSON.stringify(e);assert.equal(e.mergeRackContacts([{a:1,b:3}]),false);assert.equal(JSON.stringify(e),before);
 assert.equal(e.moveRack(1,3),'merge');assert.equal(e.rack.length,3);assert.equal(e.score,0);assert.equal(e.shots,0);assert.ok(e.rack.some(b=>b.level===1));
});

test('A blob released below the bottle routes around the base and returns to the hole',()=>{
 for(const x of [100,180,260]){
  const m=new RackMotion();m.reset(base);m.hold(1,x,520);m.release();
  let escapedSide=false;
  for(let k=0;k<840;k++){
   m.update(1/120);const b=m.visual.get(1).body;
   if(b.y>112&&(b.x<0||b.x>360))escapedSide=true;
   for(const p of b.nodes)assert.ok(p.y<BOTTLE_MOUTH||!insideBottle(p.x,p.y));
  }
  const b=m.visual.get(1);assert.equal(escapedSide,true);assert.ok(Math.hypot(b.x-m.rest.get(1).x,b.y-m.rest.get(1).y)<12,`return position ${b.x}, ${b.y}`);
 }
});
