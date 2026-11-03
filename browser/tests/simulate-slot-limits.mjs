// Reproducible empty-bottle launch sweep for the largest values and slot limits.
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {angleLimits} from '../dist/controls.js';
let cases=0;const failures=[];
for(const x of [94,180,266])for(const y of [52,68])for(const angle of Object.values(angleLimits(x)))for(const level of [10,11])for(const power of [0,.1,.5,1])for(const stiffness of [0,10,100])for(const viscosity of [0,100])for(const blobSize of [40,100,150]){
 const e=new Engine(7);e.rack=[{id:1,level:0},{id:2,level},{id:3,level:0}];e.rackSerial=3;e.selectedId=2;e.syncRack();e.setPhysics({stiffness,viscosity,blobSize});e.shoot(angle,power,true,{x,y});
 for(let k=0;k<480&&!e.over;k++)e.step(1/120);
 cases++;if(e.over)failures.push({x,y,angle:angle*180/Math.PI,value:2**(level+1),power,stiffness,viscosity,blobSize});
}
console.log(JSON.stringify({cases,failures,outermostLeft:{left:14,right:55},middle:{left:55,right:55},outermostRight:{left:55,right:14}}));
assert.equal(failures.length,0);
