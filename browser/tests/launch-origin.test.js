import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {clusterLayout} from '../dist/preparation.js';
import {MAX_ANGLE,LAUNCH_X,LAUNCH_Y,angleLimits,clampAngle,launchOrigin,aimFromPoint} from '../dist/controls.js';
import {pullShot} from '../dist/preparation-gesture.js';
const deg=Math.PI/180;
function ready(level,blobSize=150,physics={}){
  const e=new Engine(7);e.rack=[{id:1,level:0},{id:2,level},{id:3,level:0}];e.rackSerial=3;e.selectedId=2;e.syncRack();
  e.setPhysics({stiffness:10,viscosity:0,blobSize,...physics});return e;
}
test('Left and right ready blobs launch from their own slot, not the middle',()=>{
  for(const blobSize of [40,100,150]){
    const e=new Engine(765);e.setPhysics({...e.physics,blobSize});
    const slots=clusterLayout(e.rackOrder(),blobSize);
    for(const slot of [0,2]){
      const copy=Engine.restore(JSON.parse(JSON.stringify(e))),chosen=copy.rackOrder()[slot];copy.select(chosen.id);
      assert.equal(copy.shoot(0,.5,true,slots[slot]),true);
      const shot=copy.blobs[0];assert.equal(shot.level,chosen.level);
      assert.equal(shot.x,slots[slot].x);assert.equal(shot.y,slots[slot].y);
      assert.ok(slot===0?shot.x<LAUNCH_X-20:shot.x>LAUNCH_X+20,`slot ${slot} at size ${blobSize}`);
      assert.equal(shot.inBottle,false);assert.ok(shot.ejection,'Launch keeps the ejection teardrop');
    }
  }
});
test('Without an origin, shots still start from the center',()=>{
  const e=new Engine(3);assert.equal(e.shoot(.3,.5,true),true);
  assert.equal(e.blobs[0].x,LAUNCH_X);assert.equal(e.blobs[0].y,LAUNCH_Y);
});
test('Launch origins stay in the row above the opening',()=>{
  assert.deepEqual(launchOrigin({x:-40,y:-30}),{x:94,y:58});assert.deepEqual(launchOrigin({x:500,y:300}),{x:266,y:68});
  assert.deepEqual(launchOrigin({x:NaN,y:undefined}),{x:LAUNCH_X,y:LAUNCH_Y});
  assert.equal(launchOrigin({x:117,y:68},0).y,LAUNCH_Y,'A weak shot does not start below the row');
  const e=new Engine(3);e.shoot(0,.5,true,{x:-50,y:200});assert.equal(e.blobs[0].x,94);assert.equal(e.blobs[0].y,63);
});
test('Aim limits are 55° from the center and narrower toward the nearer rim',()=>{
  assert.deepEqual(angleLimits(LAUNCH_X),{min:-MAX_ANGLE,max:MAX_ANGLE});
  let previous=MAX_ANGLE;
  for(const x of [170,160,140,117,105,94]){
    const {min,max}=angleLimits(x),mirror=angleLimits(360-x);
    assert.equal(max,MAX_ANGLE);assert.ok(-min<previous);previous=-min;
    assert.ok(Math.abs(mirror.max+min)<1e-12&&mirror.min===-MAX_ANGLE,'The right side mirrors the left');
  }
  assert.ok(Math.abs(angleLimits(94).min+14*deg)<1e-9);
  assert.ok(Math.abs(clampAngle(-MAX_ANGLE,{x:117})-angleLimits(117).min)<1e-12);
  assert.equal(clampAngle(MAX_ANGLE,{x:117}),MAX_ANGLE);
});
test('Engine, bottle aiming and pull aiming all clamp to the selected slot',()=>{
  const left={x:117,y:58},{min}=angleLimits(117);
  const e=ready(2);e.shoot(-MAX_ANGLE,1,true,left);const b=e.blobs[0];
  assert.ok(Math.abs(Math.atan2(b.vx,b.vy)-min)<1e-9);
  assert.ok(Math.abs(aimFromPoint(-200,150,left).angle-min)<1e-12);
  assert.ok(Math.abs(pullShot({x:117,y:58},{x:-200,y:120},left).angle-min)<1e-12);
  assert.equal(aimFromPoint(117,200,left).angle,0,'Bottle aiming is measured from the selected blob');
});
// The hardest cases found near each limit while choosing it: large, fast,
// soft or stiff blobs that skid off the near lip.
const hard=[[9,1,{stiffness:0,blobSize:100}],[8,1,{stiffness:0,blobSize:100}],[6,1,{stiffness:0,blobSize:150}],[5,1,{stiffness:100,blobSize:100}],
  [9,1,{stiffness:100,blobSize:40}],[8,0,{stiffness:100,blobSize:100}],[7,1,{stiffness:100,blobSize:100}],[3,.6,{viscosity:100,blobSize:150}],[0,0,{blobSize:40}],[10,1,{stiffness:100,blobSize:150}],[11,.1,{stiffness:100,blobSize:150}]];
test('The widest allowed aim from every slot keeps the shot in the bottle',()=>{
  for(const x of [94,117,160,243,266])for(const y of [52,68]){
    const {min,max}=angleLimits(x);
    for(const angle of [min,max])for(const [level,power,physics] of [...hard,[8,.2,{stiffness:100,blobSize:100}],[6,.1,{stiffness:100,blobSize:150}],[6,.3,{stiffness:100,blobSize:150}],[9,.15,{stiffness:100,blobSize:100}]]){
      const e=ready(level,physics.blobSize,physics);assert.equal(e.shoot(angle,power,true,{x,y}),true);
      for(let t=0;t<480&&!e.over;t++)e.step(1/120);
      assert.equal(e.over,false,`x ${x}, y ${y}, ${(angle/deg).toFixed(1)}°, level ${level}, power ${power}, ${JSON.stringify(physics)}`);
    }
  }
});
