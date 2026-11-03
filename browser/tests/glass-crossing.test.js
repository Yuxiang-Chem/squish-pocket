import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob} from '../dist/engine.js';
import {prepare,measure} from '../dist/softbody.js';
import {bottleWalls,insideBottle,BOTTLE_FLOOR} from '../dist/bottle.js';
const dt=1/120;
test('Collision velocity cannot turn a contained floor particle into an exterior one',()=>{
 for(const x of [25,80,180,280,335]){
  const p={x,y:414,px:x,py:50,bottleSide:true};
  bottleWalls({x:180,y:390,inBottle:true,hasEntered:true,nodes:[p]});
  assert.equal(p.bottleSide,true);assert.ok(insideBottle(p.x,p.y,.001));
 }
});
test('Real mouth crossings use resolved positions rather than a later collision impulse',()=>{
 const p={x:180,y:150,px:180,py:150,bottleSide:true},b={x:180,y:150,nodes:[p]};bottleWalls(b);
 p.x=0;p.y=100;p.px=180;p.py=150;bottleWalls(b);
 assert.equal(p.bottleSide,true,'A particle cannot jump through the shoulder outside the opening');assert.ok(p.y>=112&&insideBottle(p.x,p.y,.001));
 const q={x:180,y:150,px:180,py:150,bottleSide:true},c={x:180,y:150,nodes:[q]};bottleWalls(c);
 q.y=105;bottleWalls(c);assert.equal(q.bottleSide,false,'The open center still allows exit');
 q.y=120;q.py=500;bottleWalls(c);assert.equal(q.bottleSide,true,'Re-entry follows the real above-mouth position even after a velocity correction');
});
test('An older small blob caught below the base is recovered even when its center is outside',()=>{
 const e=new Engine(123),b=blob(1,80,425);prepare(b,e.radius(1),dt);measure(b,dt);
 b.inBottle=true;b.hasEntered=true;b.age=4;for(const p of b.nodes)p.bottleSide=p.y<BOTTLE_FLOOR;
 e.blobs=[b];e.score=256;e.shots=14;
 const copy=Engine.restore(JSON.parse(JSON.stringify(e)));copy.step(dt);
 assert.equal(copy.over,false);assert.equal(copy.score,256);assert.equal(copy.shots,14);
 assert.ok(copy.blobs[0].nodes.every(p=>p.bottleSide&&insideBottle(p.x,p.y,.001)));
});
test('Strong crowded impacts never lose interior ownership at either bottom corner',()=>{
 for(const stiffness of [0,10,100]){
  const e=new Engine(5);e.setPhysics({stiffness,viscosity:0,blobSize:150});
  e.blobs=[blob(7,100,333),blob(4,230,360),blob(0,315,388),blob(1,60,392)];
  for(const b of e.blobs){prepare(b,e.radius(b.level),dt);b.hasEntered=true;b.inBottle=true;for(const p of b.nodes)p.bottleSide=true;}
  for(let tick=0;tick<300;tick++){
   const small=e.blobs.find(b=>b.level===1);
   if(small&&tick%50===0)for(const p of small.nodes)p.py=p.y-350;
   e.step(dt);assert.equal(e.over,false);
   for(const b of e.blobs)for(const p of b.nodes){assert.equal(p.bottleSide,true);assert.ok(insideBottle(p.x,p.y,.001));}
  }
 }
});
test('A blob sliding down the outside after catching the lip is never pulled back through the glass',()=>{
 for(const side of [-1,1]){
  const e=new Engine(9),b=blob(5,180+side*197,236,side*60,120);prepare(b,e.radius(5),dt);measure(b,dt);
  b.inBottle=true;b.hasEntered=true;b.age=1;
  // A few particles still hook inside the glass; most of the body is outside.
  for(const p of b.nodes){p.bottleSide=insideBottle(p.x,p.y);}
  assert.ok(b.nodes.some(p=>p.bottleSide)&&b.nodes.filter(p=>!p.bottleSide).length>12);
  e.blobs=[b];
  for(let tick=0;tick<240&&!e.over;tick++){
   e.step(dt);const c=e.blobs[0];
   assert.ok(!(c.y>BOTTLE_FLOOR-80&&insideBottle(c.x,c.y,-4)),'The body must not reappear inside the bottle');
  }
  assert.equal(e.over,true);assert.equal(e.endReason,'spill');
 }
});
