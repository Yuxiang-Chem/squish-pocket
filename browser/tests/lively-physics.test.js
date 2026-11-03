import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepare,measure,contact} from '../dist/softbody.js';
import {bottleWalls} from '../dist/bottle.js';
import {shotVector} from '../dist/controls.js';
test('A small projectile gives a large blob a noticeable kick instead of treating it as anchored',()=>{
 const a={x:100,y:200,vx:500,vy:0},b={x:198,y:200,vx:0,vy:0};
 prepare(a,20,1/120);prepare(b,80,1/120);measure(a,1/120);measure(b,1/120);
 contact(a,b,20,80,1);measure(a,1/120);measure(b,1/120);
 assert.ok(b.vx>6.5&&b.vx<a.vx,'Four-times-radius targets respond while retaining greater inertia');
 assert.ok(a.vx<500&&a.vx>0);
});
test('Glass retains a modest impact rebound without bouncing a resting particle',()=>{
 const impact={x:180,y:414,px:180,py:410,bottleSide:true};
 bottleWalls({x:180,y:390,nodes:[impact]});
 assert.ok(impact.y-impact.py<-.8&&impact.y-impact.py>-1.2);
 const resting={x:180,y:409,px:180,py:408.99,bottleSide:true};bottleWalls({x:180,y:390,nodes:[resting]});
 assert.ok(Math.abs(resting.y-resting.py)<.00001);
});
test('Full force launches 20 percent faster while short pulls retain control',()=>{
 assert.equal(shotVector(0,1).vy,1080);assert.equal(shotVector(0,0).vy,80);
 const soft=shotVector(0,.15),hard=shotVector(0,.8);assert.ok(hard.vy>soft.vy*3);
});
