import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HEIGHT} from '../dist/engine.js';
import {bottleLeft,bottleLeftAt,insideBottle,bottleWalls,BOTTLE_MOUTH,BOTTLE_FLOOR} from '../dist/bottle.js';
test('Bottle is shorter and wider with a smoothly inset mouth and neck',()=>{
 assert.equal(HEIGHT,420);assert.equal(BOTTLE_FLOOR-BOTTLE_MOUTH,296);assert.equal(bottleLeftAt(300),10);
 assert.equal(insideBottle(16,300),true);assert.equal(insideBottle(8,300),false);
 assert.ok(bottleLeftAt(130)>bottleLeftAt(112)+20);assert.ok(bottleLeftAt(140)>bottleLeftAt(154));
 assert.ok(bottleLeft.every((p,i)=>i===0||p.y>bottleLeft[i-1].y));
});
test('The inward mouth curve is a real solid collision surface on both sides',()=>{
 const left=bottleLeftAt(130),inside={x:left-2,y:130,px:left+5,py:130,bottleSide:true};
 bottleWalls({nodes:[inside]});assert.ok(insideBottle(inside.x,inside.y,.00001));
 const outside={x:360-left-2,y:130,px:360-left+5,py:130,bottleSide:false};bottleWalls({nodes:[outside]});
 assert.ok(outside.x>=360-bottleLeftAt(outside.y));assert.equal(outside.bottleSide,false);
});
