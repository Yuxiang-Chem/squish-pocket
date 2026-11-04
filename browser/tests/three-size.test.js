import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob,radiusFor} from '../dist/engine.js';
import {RackMotion} from '../dist/rack-motion.js';
import {clusterLayout} from '../dist/preparation.js';
import {prepare,measure} from '../dist/softbody.js';
import {BOTTLES} from '../dist/bottles.js';
const dt=1/120;
test('Three Combine has 30% larger physical membranes and ready blobs without cumulative scaling',()=>{
 const two=new Engine(42),three=new Engine(42,'classic','three');
 for(let level=0;level<=11;level++){
  assert.ok(Math.abs(three.radius(level)/two.radius(level)-1.3)<1e-12);
  assert.equal(two.radius(level),radiusFor(level));
 }
 const a=blob(0,180,300),b=blob(0,180,300);prepare(a,two.radius(0),dt);prepare(b,three.radius(0),dt);
 const area=body=>Math.abs(body.nodes.reduce((sum,p,i)=>{const q=body.nodes[(i+1)%24];return sum+p.x*q.y-p.y*q.x;},0))/2;
 assert.ok(Math.abs(area(b)/area(a)-1.3**2)<1e-10);
 const rack=[{id:1,level:0},{id:2,level:1},{id:3,level:2}],motion=new RackMotion();motion.setPhysics(two.physics,'two');motion.reset(rack);
 const old=motion.items.map(b=>b.body.renderRadius);
 motion.setPhysics(three.physics,'three');
 for(let n=0;n<10;n++)motion.setPhysics(three.physics,'three');
 motion.items.forEach((b,i)=>assert.ok(Math.abs(b.body.renderRadius/old[i]-1.3)<1e-12));
 motion.setPhysics(two.physics,'two');motion.items.forEach((b,i)=>assert.ok(Math.abs(b.body.renderRadius-old[i])<1e-12));
});
test('older Three Combine saves grow once, keep score and shots, and fit entered blobs to the glass',()=>{
 for(const id of Object.keys(BOTTLES)){
  const old=new Engine(42,id,'three');old.score=27;old.shots=7;old.highestLevel=3;old.blobScale=1;
  const b=blob(1,180,old.vessel.BOTTLE_FLOOR-25);b.renderRadius=radiusFor(1);prepare(b,b.renderRadius,dt);measure(b,dt);b.inBottle=true;b.hasEntered=true;
  for(const n of b.nodes)n.bottleSide=true;
  old.vessel.bottleWalls(b);measure(b,dt);old.blobs=[b];
  const data=JSON.parse(JSON.stringify(old));delete data.blobScale;
  const e=Engine.restore(data);assert.equal(e.score,27);assert.equal(e.shots,7);assert.equal(e.highestLevel,3);assert.equal(e.blobScale,1.3);
  assert.equal(e.blobs[0].renderRadius,e.radius(1));
  for(const n of e.blobs[0].nodes)assert.ok(e.vessel.insideBottle(n.x,n.y,.001),id);
  const again=Engine.restore(JSON.parse(JSON.stringify(e)));assert.equal(again.blobs[0].renderRadius,e.blobs[0].renderRadius);
  assert.deepEqual(again.blobs[0].nodes,e.blobs[0].nodes);
 }
 const e=new Engine(42,'classic','three');e.blobScale=1;e.blobs=[blob(0,180,300)];prepare(e.blobs[0],radiusFor(0),dt);
 const legacy=JSON.parse(JSON.stringify(e));delete legacy.blobScale;delete legacy.blobs[0].renderRadius;
 const resized=Engine.restore(legacy);assert.ok(Math.abs(resized.blobs[0].nodes[0].x-180-radiusFor(0)*1.3)<1e-9);
});
test('larger Three Combine spawn values enter every vessel from all ready slots',()=>{
 for(const id of Object.keys(BOTTLES))for(const level of [0,1,2])for(const slot of [0,1,2])for(const power of [0,1]){
  const e=new Engine(42,id,'three');e.rack=[{id:1,level:0},{id:2,level:1},{id:3,level:2}];e.rack[slot].level=level;e.rackSerial=3;e.selectedId=slot+1;e.syncRack();
  const origin=clusterLayout(e.rackOrder(),195,e.vessel)[slot];assert.ok(e.shoot(0,power,true,origin));
  for(let i=0;i<480&&!e.over;i++)e.step(dt);
  assert.equal(e.over,false,`${id} level ${level} slot ${slot} power ${power}`);assert.ok(e.blobs[0].hasEntered);
  for(const b of e.blobs)for(const n of b.nodes)assert.ok([n.x,n.y,n.px,n.py].every(Number.isFinite));
 }
});
