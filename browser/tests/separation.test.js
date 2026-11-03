import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob} from '../dist/engine.js';
import {RackMotion} from '../dist/rack-motion.js';
function depth(a,b){
 let maximum=0;
 for(const p of a.nodes){let inside=false,distance=Infinity;
  for(let k=0;k<b.nodes.length;k++){
   const u=b.nodes[k],v=b.nodes[(k+1)%b.nodes.length];
   if((u.y>p.y)!==(v.y>p.y)&&p.x<(v.x-u.x)*(p.y-u.y)/(v.y-u.y)+u.x)inside=!inside;
   const dx=v.x-u.x,dy=v.y-u.y,t=Math.max(0,Math.min(1,((p.x-u.x)*dx+(p.y-u.y)*dy)/(dx*dx+dy*dy)));
   distance=Math.min(distance,Math.hypot(p.x-u.x-t*dx,p.y-u.y-t*dy));
  }
  if(inside)maximum=Math.max(maximum,distance);
 }
 return maximum;
}
function check(bodies){for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)assert.ok(Math.max(depth(bodies[i],bodies[j]),depth(bodies[j],bodies[i]))<1.25,'Membranes must not visibly penetrate one another');}
test('Different board blobs separate at the floor across soft and rigid materials',()=>{
 for(const stiffness of [0,10,100]){
  const e=new Engine(12);e.setPhysics({stiffness,viscosity:0,blobSize:150});e.blobs=[blob(0,170,300),blob(1,190,300),blob(2,180,330)];
  for(let k=0;k<240;k++){e.step(1/120);check(e.blobs);}
 }
});
test('Dragging a mismatching blob pushes and deforms its neighbors without pinning overlap',()=>{
 for(const stiffness of [0,10,100]){
  const m=new RackMotion();m.setPhysics({stiffness,viscosity:0,blobSize:150});m.reset([{id:1,level:0},{id:2,level:2},{id:3,level:4}]);
  m.hold(1,m.visual.get(2).x,58);
  for(let k=0;k<120;k++){m.update(1/120);check(m.items.map(i=>i.body));}
  assert.equal(m.visual.get(1).body.kinematic,true);m.release();assert.equal(m.visual.get(1).body.kinematic,false);
 }
});
test('Merge animation does not draw both source faces underneath the combined blob',()=>{
 const base=[{id:1,level:0},{id:2,level:0},{id:3,level:2}],result={id:4,level:1},m=new RackMotion();m.reset(base);
 m.play([{kind:'merge',id:4,level:1,from:[1,2],before:base,after:[result,base[2]]}],[result,base[2]]);
 for(let k=0;k<120&&m.busy;k++){
  m.update(1/120);const combined=m.visual.get(4);
  if(combined?.alpha>0)for(const id of [1,2])assert.ok(!m.visual.get(id)||m.visual.get(id).alpha===0);
 }
});
