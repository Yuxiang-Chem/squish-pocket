import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob} from '../dist/engine.js';
import {insideBottle,BOTTLE_FLOOR} from '../dist/bottle.js';
import {prepare,measure,separateBodies} from '../dist/softbody.js';
import {bottleWalls} from '../dist/bottle.js';
const dt=1/120;
function depth(a,b){
 let maximum=0;
 for(const p of a.nodes){let inside=false,d=Infinity;
  for(let k=0;k<b.nodes.length;k++){
   const u=b.nodes[k],v=b.nodes[(k+1)%b.nodes.length];
   if((u.y>p.y)!==(v.y>p.y)&&p.x<(v.x-u.x)*(p.y-u.y)/(v.y-u.y)+u.x)inside=!inside;
   const x=v.x-u.x,y=v.y-u.y,t=Math.max(0,Math.min(1,((p.x-u.x)*x+(p.y-u.y)*y)/(x*x+y*y)));
   d=Math.min(d,Math.hypot(p.x-u.x-x*t,p.y-u.y-y*t));
  }
  if(inside)maximum=Math.max(maximum,d);
 }
 return maximum;
}
function check(bodies){
 const fusing=(a,b)=>a.fuse&&b.fuse&&a.fuse.id===b.fuse.id;
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)if(!fusing(bodies[i],bodies[j]))assert.ok(Math.max(depth(bodies[i],bodies[j]),depth(bodies[j],bodies[i]))<.15,'Actual membranes must separate after every frame');
 for(const b of bodies)if(!b.spilled)for(const p of b.nodes)if(p.bottleSide){assert.ok(insideBottle(p.x,p.y,.001));assert.ok(p.y<=BOTTLE_FLOOR+.001);}
}
function mergeChecked(e){
 let events=[];
 for(let k=0;k<120&&!events.length;k++){events=e.step(dt);check(e.blobs);assert.equal(e.over,false);}
 return events;
}
test('Floor merges keep all newly created membrane particles inside the glass',()=>{
 for(const level of [0,3,6,8]){
  const e=new Engine(123);e.blobs=[blob(level,160,390),blob(level,190,390)];
  assert.equal(mergeChecked(e).length,1);const b=e.blobs[0];
  assert.ok(b.nodes.every(p=>p.bottleSide&&insideBottle(p.x,p.y,.001)),'New result inherits the interior rather than spawning through the base');
  for(let i=0;i<240;i++){e.step(dt);check(e.blobs);assert.equal(e.over,false);}
 }
});
test('A merge beside another floor blob separates immediately and stays contained',()=>{
 for(const stiffness of [0,10,100]){
  const e=new Engine(123);e.setPhysics({stiffness,viscosity:0,blobSize:150});e.blobs=[blob(4,140,377),blob(4,175,377),blob(6,220,365)];
  assert.equal(mergeChecked(e).length,1);check(e.blobs);
  for(let i=0;i<240;i++){e.step(dt);check(e.blobs);assert.equal(e.over,false);}
 }
});
test('Deeply overlapping or nested saved bodies separate without folding together',()=>{
 for(const stiffness of [0,10,100]){
  const e=new Engine(123);e.setPhysics({stiffness,viscosity:0,blobSize:150});
  e.blobs=[blob(4,180,300),blob(6,180,300)];
  for(const b of e.blobs){prepare(b,e.radius(b.level),dt);measure(b,dt);}
  separateBodies(e.blobs,b=>e.radius(b.level),bottleWalls);check(e.blobs);
  for(let k=0;k<180;k++){e.step(dt);check(e.blobs);assert.equal(e.over,false);}
 }
});
test('Previously saved floor leakage is repaired without resetting progress',()=>{
 const original=new Engine(123),b=blob(4,180,390);prepare(b,original.radius(4),dt);measure(b,dt);
 b.inBottle=true;b.hasEntered=true;b.age=3;
 for(const p of b.nodes)p.bottleSide=insideBottle(p.x,p.y);
 original.blobs=[b];original.score=128;original.shots=9;
 const e=Engine.restore(JSON.parse(JSON.stringify(original)));e.step(dt);
 assert.ok(e.blobs[0].nodes.every(p=>p.bottleSide&&insideBottle(p.x,p.y,.001)));
 assert.equal(e.score,128);assert.equal(e.shots,9);assert.equal(e.over,false);
});
test('A crowded mixed pile remains separated as merges grow against the floor',()=>{
 const e=new Engine(123);
 for(let i=0;i<12;i++)e.blobs.push(blob(i%5,65+(i%4)*75,290+Math.floor(i/4)*40));
 let merges=0;
 for(let k=0;k<360;k++){merges+=e.step(dt).length;check(e.blobs);assert.equal(e.over,false);}
 assert.ok(merges>0);
});
