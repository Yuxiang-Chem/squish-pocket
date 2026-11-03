import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {ejectionShape,ejectionPhase} from '../dist/ejection.js';
import {insideBottle} from '../dist/bottle.js';
const area=points=>points.reduce((n,p,k)=>{const q=points[(k+1)%points.length];return n+(p.x*q.y-q.x*p.y)*.5;},0);
test('Nozzle-exit shape conserves membrane area and has a broad head and narrow tail',()=>{
 const points=ejectionShape(24,20,1.7,.8);
 assert.ok(Math.abs(area(points)/(12*400*Math.sin(Math.PI/12))-1)<.000001);
 assert.ok(Math.abs(points[4].y)>Math.abs(points[8].y)*2,'Head is wider than the symmetric trailing section');
 assert.ok(points[0].x>20&&points[12].x<-20);
});
test('Actual launched membrane points form a teardrop aligned with each shooting direction',()=>{
 for(const angle of [-.9,0,.9]){
  const e=new Engine(12);e.shoot(angle,.9);const b=e.blobs[0],ux=Math.sin(angle),uy=Math.cos(angle);
  const forward=p=>(p.x-b.x)*ux+(p.y-b.y)*uy,side=p=>-(p.x-b.x)*uy+(p.y-b.y)*ux;
  assert.ok(forward(b.nodes[0])>e.radius(b.level)*1.4);assert.ok(forward(b.nodes[12])<-e.radius(b.level)*1.4);
  assert.ok(Math.abs(side(b.nodes[4]))>Math.abs(side(b.nodes[8]))*2);
  const average=b.nodes.reduce((a,p)=>({x:a.x+(p.x-p.px)*120/24,y:a.y+(p.y-p.py)*120/24}),{x:0,y:0});
  assert.ok(Math.abs(average.x-b.vx)<.000001&&Math.abs(average.y-b.vy)<.000001,'Differential release strain conserves mean launch momentum');
 }
});
test('Launch deformation responds to force and stiffness, then relaxes with time',()=>{
 const slow=new Engine(12),fast=new Engine(12),rigid=new Engine(12);rigid.setPhysics({stiffness:100});
 slow.shoot(0,0);fast.shoot(0,1);rigid.shoot(0,1);
 assert.ok(fast.blobs[0].ejection.stretch>slow.blobs[0].ejection.stretch);assert.ok(fast.blobs[0].ejection.stretch>rigid.blobs[0].ejection.stretch);
 const b=fast.blobs[0],first=ejectionPhase(b);for(let i=0;i<30;i++)fast.step(1/120);assert.ok(ejectionPhase(b)<first*.6);
});
test('Ejected membranes survive impact at extreme materials and save mid-flight',()=>{
 for(const stiffness of [0,100])for(const viscosity of [0,100]){
  const e=new Engine(12);e.setPhysics({stiffness,viscosity});e.shoot(.25,1);
  const copy=Engine.restore(JSON.parse(JSON.stringify(e)));assert.deepEqual(copy,e);
  for(let k=0;k<360;k++){
   e.step(1/120);for(const b of e.blobs)for(const p of b.nodes)assert.ok([p.x,p.y,p.px,p.py].every(Number.isFinite)&&insideBottle(p.x,p.y,.00001));
  }
 }
 const e=new Engine(12);e.shoot(0,1);const save=JSON.parse(JSON.stringify(e));save.blobs[0].ejection.relaxation=0;assert.equal(Engine.restore(save),null);
});
