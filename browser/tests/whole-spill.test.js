import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob} from '../dist/engine.js';
import {prepare,measure} from '../dist/softbody.js';
import {overlapsBottleInterior,updateBottleState,bottleWalls,bottleLeftAt} from '../dist/bottle.js';
import {LAUNCH_X,LAUNCH_Y} from '../dist/controls.js';
import {eject} from '../dist/ejection.js';
// Shots cannot aim this wide any more; this models a blob leaving the opening sideways.
function wideShot(e,angle){const s=e.rack.find(b=>b.id===e.selectedId),b=blob(s.level,LAUNCH_X,LAUNCH_Y,Math.sin(angle)*1080,Math.cos(angle)*1080);b.inBottle=false;eject(b,e.radius(s.level),e.physics);return e.consumeRack(s.id,b);}
const dt=1/120;
const shape=(x,y,r=20)=>{const b=blob(0,x,y);b.renderRadius=r;prepare(b,r,dt);measure(b,dt);return b;};
function move(b,dx,dy){for(const p of b.nodes){p.px=(p.px??p.x)+dx;p.py=(p.py??p.y)+dy;p.x+=dx;p.y+=dy;}measure(b,dt);}
test('A center outside the neck does not lose while any membrane portion remains inside',()=>{
 const neck=bottleLeftAt(125);for(const x of [neck-5,360-neck+5]){
  const b=shape(x,125);assert.equal(overlapsBottleInterior(b),true);assert.equal(updateBottleState(b),false);assert.equal(b.inBottle,true);
  for(let k=0;k<600;k++){b.age+=dt;assert.equal(updateBottleState(b),false);}
  assert.ok(!b.spilled);
 }
});
test('Only full clearance loses, including a tiny remaining sliver and a neck-spanning polygon',()=>{
 const right=360-bottleLeftAt(130);
 const b={x:right+10,y:130,vy:0,nodes:[{x:right-.2,y:130},{x:right+20,y:130},{x:right+20,y:130.1},{x:right-.2,y:130.1}]};assert.equal(updateBottleState(b),false);assert.equal(b.inBottle,true);
 move(b,1,0);assert.equal(overlapsBottleInterior(b),false);assert.equal(updateBottleState(b),true);
 const strip={x:180,y:125,vy:0,nodes:[{x:40,y:120},{x:320,y:120},{x:320,y:121},{x:40,y:121}]};
 assert.equal(overlapsBottleInterior(strip),true);assert.equal(updateBottleState(strip),false);
});
test('A missed shot above the opening has time to fall; a partial blob can slip back inside',()=>{
 const miss=shape(340,85);assert.equal(updateBottleState(miss),false);move(miss,0,60);assert.equal(updateBottleState(miss),true);
 const partial=shape(360-bottleLeftAt(125)+5,125);assert.equal(updateBottleState(partial),false);move(partial,-50,50);assert.equal(updateBottleState(partial),false);assert.equal(partial.inBottle,true);
});
test('Exterior particles slide against the outside rather than being teleported inside',()=>{
 const right=360-bottleLeftAt(130);
 const exterior={x:right-1,y:130,px:right+5,py:125,bottleSide:false};
 bottleWalls({nodes:[exterior]});assert.ok(exterior.x>=360-bottleLeftAt(exterior.y));assert.equal(exterior.bottleSide,false);
 const interior={x:right+2,y:130,px:right-5,py:128,bottleSide:true};
 bottleWalls({nodes:[interior]});assert.ok(interior.x<=360-bottleLeftAt(interior.y));assert.equal(interior.bottleSide,true);
});
test('Fully escaped blobs continue falling during the reveal; score and shot count stay frozen',()=>{
 const e=new Engine(123);wideShot(e,1.3);for(let k=0;k<240&&!e.over;k++)e.step(dt);assert.equal(e.endReason,'spill');
 const b=e.blobs[0],y=b.y,shots=e.shots,score=e.score;
 for(let k=0;k<24;k++)e.animateSpill(1/60);
 assert.ok(b.y>y+25);assert.equal(e.shots,shots);assert.equal(e.score,score);assert.equal(e.over,true);
 assert.deepEqual(Engine.restore(JSON.parse(JSON.stringify(e))),e);
});
