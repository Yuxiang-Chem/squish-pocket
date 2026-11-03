import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob} from '../dist/engine.js';
import {BOTTLES} from '../dist/bottles.js';
import {clusterLayout} from '../dist/preparation.js';
import {prepare,measure} from '../dist/softbody.js';
const g=BOTTLES['lab-flask'];
test('Original bottle is the default and remains independent of the reference flask',()=>{
  const original=new Engine(7),lab=new Engine(7,'lab-flask');
  assert.equal(original.bottleId,'classic');assert.equal(original.bottleVersion,2);
  assert.equal(original.vessel.BOTTLE_MOUTH,112);assert.equal(original.vessel.FILL_LINE,126);
  assert.equal(original.vessel.bottleLeftAt(300),10);assert.ok(original.vessel.insideBottle(35,300));
  assert.equal(lab.vessel.id,g.id);assert.deepEqual(lab.vessel.bottleOutline,g.bottleOutline);assert.notEqual(original.vessel,lab.vessel);
  const unchanged=original.vessel;lab.step(1/120);assert.equal(original.vessel,unchanged);
});
test('Reference flask has a higher vertical center neck and two angled side mouths',()=>{
  assert.equal(g.mouths.length,3);
  const center=g.mouths.find(m=>Math.abs(m.a.y-m.b.y)<.001),sides=g.mouths.filter(m=>m!==center);
  assert.ok(center);assert.ok(sides.every(m=>Math.abs(m.nx)>.25));
  assert.ok(sides.every(m=>(m.a.y+m.b.y)/2>center.a.y+25));
  assert.ok(g.contains(180,300));assert.equal(g.contains(40,300),false);
  assert.equal(g.contains(132,160),false);assert.equal(g.contains(228,160),false);
});
test('Each real angled opening admits and releases particles across its own mouth plane',()=>{
  for(const m of g.mouths){
    const x=(m.a.x+m.b.x)/2,y=(m.a.y+m.b.y)/2;
    const p={x:x-m.nx*8,y:y-m.ny*8,px:x-m.nx*8,py:y-m.ny*8,bottleSide:false};
    const body={x:p.x,y:p.y,nodes:[p]};g.bottleWalls(body);
    p.x=x+m.nx*8;p.y=y+m.ny*8;body.x=p.x;body.y=p.y;g.bottleWalls(body);
    assert.equal(p.bottleSide,true);assert.ok(g.contains(p.x,p.y,.001));
    p.x=x-m.nx*8;p.y=y-m.ny*8;body.x=p.x;body.y=p.y;g.bottleWalls(body);
    assert.equal(p.bottleSide,false);
  }
});
test('Fast motion cannot jump through the central-neck walls into another neck',()=>{
  for(const x of [85,275]){
    const p={x:180,y:140,px:180,py:140,bottleSide:true},body={x:180,y:140,nodes:[p]};g.bottleWalls(body);
    p.x=x;p.y=170;body.x=x;body.y=170;g.bottleWalls(body);
    assert.ok(p.x>131&&p.x<229);assert.equal(p.bottleSide,true);assert.ok(g.contains(p.x,p.y,.001));
  }
});
test('Side approaches are not marked as spills before reaching the lower side openings',()=>{
  const body={x:84,y:119,vy:100,nodes:[{x:82,y:116},{x:86,y:116},{x:86,y:122},{x:82,y:122}]};
  assert.equal(g.updateBottleState(body),false);assert.equal(body.inBottle,false);
});
test('All incoming values enter the lab flask from each slot at gentle, medium and full force',()=>{
  for(const level of [0,1,2,3,4])for(const slot of [0,1,2])for(const power of [0,.25,1]){
    const e=new Engine(42,'lab-flask');
    e.rack=[{id:1,level:slot===0?level:0},{id:2,level:slot===1?level:1},{id:3,level:slot===2?level:2}];
    e.rackSerial=3;e.selectedId=slot+1;e.syncRack();
    const origin=clusterLayout(e.rackOrder(),150,e.vessel)[slot];assert.equal(e.shoot(0,power,true,origin),true);
    for(let i=0;i<480&&!e.over;i++){
      e.step(1/120);
      for(const b of e.blobs)for(const p of b.nodes){
        assert.ok([p.x,p.y,p.px,p.py].every(Number.isFinite));
        if(p.bottleSide&&!b.spilled)assert.ok(g.contains(p.x,p.y,.001));
      }
    }
    assert.equal(e.over,false,`value ${2**(level+1)}, slot ${slot}, force ${power}`);
    assert.ok(e.blobs[0].hasEntered);
  }
});
test('Legacy saves restore to the original bottle; each explicit bottle restores independently',()=>{
  for(const bottleId of ['classic','lab-flask']){
    const e=new Engine(7,bottleId);e.score=bottleId==='classic'?128:256;e.shots=8;e.highestLevel=10;
    const b=blob(2,180,320);prepare(b,e.radius(2),1/120);measure(b,1/120);b.inBottle=true;b.hasEntered=true;e.blobs=[b];
    const restored=Engine.restore(JSON.parse(JSON.stringify(e)));
    assert.equal(restored.bottleId,bottleId);assert.equal(restored.score,e.score);assert.equal(restored.highestLevel,10);
    restored.step(1/120);assert.equal(restored.over,false);
  }
  const legacy=JSON.parse(JSON.stringify(new Engine(7)));delete legacy.bottleId;legacy.bottleVersion=3;
  assert.equal(Engine.restore(legacy).bottleId,'classic');
  legacy.bottleId='unknown';assert.equal(Engine.restore(legacy),null);
});
test('A blob above the fill line cannot pop out of a neck and spring back',()=>{
  const nodes=[];
  for(let k=0;k<24;k++){
    const angle=k/24*Math.PI*2,x=180+Math.cos(angle)*70,y=190+Math.sin(angle)*70;
    nodes.push({x,y,px:x,py:y,bottleSide:g.contains(x,y)});
  }
  const body={x:180,y:190,nodes,inBottle:true,hasEntered:true};
  g.bottleWalls(body);
  for(const p of nodes)p.y-=20;
  body.y=180;g.bottleWalls(body);
  const escaped=nodes.filter(p=>p.x>140&&p.x<220&&(p.y<106||(!p.bottleSide&&!g.contains(p.x,p.y,.05))));
  assert.equal(escaped.length,0);
  assert.ok(nodes.filter(p=>p.bottleSide).every(p=>g.contains(p.x,p.y,.05)));
  const e=new Engine(4,'lab-flask');e.blobs=[];
  for(const [level,x,y] of [[7,145,355],[5,235,360],[4,180,310],[6,175,245],[3,250,280],[2,120,270],[1,200,220],[0,160,190]]){
    const b=blob(level,x,y);b.age=6;b.inBottle=true;b.hasEntered=true;
    prepare(b,e.radius(level),1/120);
    for(const p of b.nodes){p.bottleSide=true;p.px=p.x;p.py=p.y;}
    measure(b,1/120);e.blobs.push(b);
  }
  for(let i=0;i<240&&!e.over;i++)e.step(1/120);
  assert.equal(e.over,false);
  assert.ok(e.blobs.some(b=>b.bounds.minY<g.FILL_LINE));
  for(let i=0;i<180&&!e.over;i++){
    const prev=e.blobs.map(b=>({b,x:b.x,y:b.y,v:Math.hypot(b.vx,b.vy),minY:b.bounds.minY}));
    e.step(1/120);
    for(const p of prev){
      if(!e.blobs.includes(p.b)||p.minY>=g.FILL_LINE||p.v>40)continue;
      assert.ok(Math.hypot(p.b.x-p.x,p.b.y-p.y)<8,`level ${p.b.level} jumped while resting above the fill line`);
    }
  }
  assert.equal(e.over,false);
});
