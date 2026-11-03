import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob,MAX_LEVEL,radiusFor} from '../dist/engine.js';
import {DragMotion} from '../dist/drag-motion.js';
import {RackMotion} from '../dist/rack-motion.js';

test('Every ready value shoots from the center without reordering the preparation cluster',()=>{
 for(let slot=0;slot<3;slot++){
  const e=new Engine(765),source={...e.rack[slot]},order=e.rack.map(b=>b.id);
  e.select(source.id);assert.deepEqual(e.rack.map(b=>b.id),order);
  assert.equal(e.shoot(.3,.6),true);assert.equal(e.blobs[0].level,source.level);
  assert.equal(e.blobs[0].x,180);assert.equal(e.blobs[0].y,58);assert.ok(e.blobs[0].vy>400);
  assert.ok(!e.rack.some(b=>b.id===source.id));assert.equal(e.rack.length,3);assert.equal(e.shots,1);
 }
});
test('Direct drops into the bottle are disabled and preserve inventory and progress',()=>{
 const e=new Engine(12),before=JSON.stringify(e);
 for(const [x,y] of [[30,140],[180,58],[180,200],[180,400],[0,0]])assert.equal(e.dropRack(e.rack[0].id,x,y,{vx:80,vy:200}),false);
 assert.equal(JSON.stringify(e),before);
});
test('1024 and 2048 pairs merge through to 4096, and the cap persists',()=>{
 assert.equal(MAX_LEVEL,11);assert.ok(radiusFor(11)<160);
 for(const level of [9,10]){
  const e=new Engine(12);e.blobs=[blob(level,130,300),blob(level,210,300)];
  let events=[];for(let k=0;k<120&&!events.length;k++)events=e.step(1/120);assert.equal(events.length,1);assert.equal(events[0].value,2**(level+2));assert.equal(e.blobs[0].level,level+1);
  const restored=Engine.restore(JSON.parse(JSON.stringify(e)));assert.equal(restored.blobs[0].level,level+1);
  e.rack=[{id:1,level},{id:2,level:0},{id:3,level}];e.rackSerial=3;e.selectedId=2;
  assert.equal(e.moveRack(1,3),'merge');assert.ok(e.rack.some(b=>b.level===level+1));
 }
 const capped=new Engine(12);capped.blobs=[blob(11,130,300),blob(11,210,300)];for(let k=0;k<60;k++)assert.equal(capped.step(1/120).length,0);
});
test('Dragging animates toward the pointer, stretches with speed, and slows on hold',()=>{
 const drag=new DragMotion();drag.start(106,58,0);drag.move(170,190,100);drag.update(.016);
 assert.ok(drag.y>58&&drag.y<190);assert.ok(drag.pose(0).sy>drag.pose(0).sx);assert.ok(drag.trail.length>0);
 const initial=drag.velocity().vy;for(let i=0;i<60;i++)drag.update(1/60);
 assert.ok(Math.abs(drag.y-190)<.01);assert.ok(Math.abs(drag.velocity().vy)<initial*.01);
 drag.stop();assert.equal(drag.active,false);assert.equal(drag.trail.length,0);
});
test('Ready bodies are flatter jelly shapes instead of spheres',()=>{
 const m=new RackMotion();m.reset([{id:1,level:4}]);const b=m.items[0].body;
 assert.ok((b.bounds.maxX-b.bounds.minX)/(b.bounds.maxY-b.bounds.minY)>1.8);
});
