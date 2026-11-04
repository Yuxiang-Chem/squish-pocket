import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BOTTLES} from '../dist/bottles.js';
import {Engine,blob} from '../dist/engine.js';
import {prepare,measure} from '../dist/softbody.js';
for(const id of ['separating-funnel','conical-flask']){
  test(`${id} has one opening, a shaped bowl and a closed base`,()=>{
    const g=BOTTLES[id];assert.equal(g.mouths.length,1);
    if(id==='conical-flask')assert.ok(g.bottleLeftAt(300)<g.bottleLeftAt(140)-25);
    else assert.ok(g.bottleLeftAt(120)>g.bottleLeftAt(g.BOTTLE_MOUTH)+20);
    assert.ok(g.contains(180,240));assert.equal(g.contains(20,240),false);
    const p={x:180,y:g.BOTTLE_FLOOR-1,px:180,py:g.BOTTLE_FLOOR-1,bottleSide:true};
    const b={x:180,y:p.y,nodes:[p],inBottle:true,hasEntered:true};g.bottleWalls(b);
    p.y=g.BOTTLE_FLOOR+12;g.bottleWalls(b);assert.ok(g.contains(p.x,p.y,.001));
  });
  test(`${id} admits a centered shot, contains settled membranes and restores its own round`,()=>{
    const e=new Engine(42,id);e.rack=[{id:1,level:0},{id:2,level:2},{id:3,level:4}];e.selectedId=1;e.syncRack();
    assert.ok(e.shoot(0,.25,true,{x:180,y:60}));
    for(let i=0;i<480;i++){e.step(1/120);assert.equal(e.over,false);for(const b of e.blobs)for(const p of b.nodes)if(p.bottleSide)assert.ok(e.vessel.contains(p.x,p.y,.001));}
    assert.ok(e.blobs[0].hasEntered);
    const saved=Engine.restore(JSON.parse(JSON.stringify(e)));assert.equal(saved.bottleId,id);assert.equal(saved.blobs.length,e.blobs.length);
    for(const level of [3,5,7]){
      const b=blob(level,180,270);prepare(b,e.radius(level),1/120);measure(b,1/120);b.hasEntered=true;b.inBottle=true;for(const p of b.nodes)p.bottleSide=true;
      const pile=new Engine(42,id);pile.blobs=[b];
      for(let i=0;i<240;i++){pile.step(1/120);for(const n of b.nodes){assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y));if(n.bottleSide)assert.ok(pile.vessel.contains(n.x,n.y,.001));}}
      assert.equal(pile.over,false);
    }
  });
  test(`${id} keeps a falling blob outside the glass`,()=>{
    const e=new Engine(42,id);
    if(id==='separating-funnel')e.blobs=[blob(0,10,160)];else assert.ok(e.shoot(0,.1,true,{x:35,y:60}));
    for(let i=0;i<240&&!e.over;i++)e.step(1/120);
    assert.equal(e.endReason,'spill');
  });
}

test('both laboratory openings admit every incoming value at gentle and strong force with soft or firm material',()=>{
  for(const id of ['separating-funnel','conical-flask'])for(const level of [0,1,2,3,4])for(const power of [0,.25,1])for(const stiffness of [0,100]){
    const e=new Engine(42,id);e.setPhysics({stiffness,viscosity:0,blobSize:150});
    e.rack=[{id:1,level},{id:2,level:(level+1)%5},{id:3,level:(level+2)%5}];e.selectedId=1;e.syncRack();e.shoot(0,power,true,{x:180,y:58});
    for(let i=0;i<480&&!e.over;i++)e.step(1/120);
    assert.equal(e.over,false,`${id}, level ${level}, power ${power}, stiffness ${stiffness}`);assert.ok(e.blobs[0].hasEntered);
  }
});

test('the taller funnel has substantially more playable space and upgrades existing saves',()=>{
  const g=BOTTLES['separating-funnel'],points=g.bottleOutline;
  const area=Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-p.y*q.x;},0))/2;
  assert.ok(area>36192.3468*1.3,'At least 30% more playable area than the earlier funnel');
  assert.ok(g.BOTTLE_FLOOR-g.BOTTLE_MOUTH>262*1.1,'A longer vessel interior');
  const e=new Engine(42,g.id);e.score=128;e.shots=4;e.blobs=[blob(3,180,275)];
  const b=e.blobs[0];prepare(b,e.radius(b.level),1/120);measure(b,1/120);b.inBottle=true;b.hasEntered=true;for(const n of b.nodes)n.bottleSide=true;
  const saved=JSON.parse(JSON.stringify(e));saved.bottleVersion=1;
  const restored=Engine.restore(saved);assert.equal(restored.bottleVersion,5);assert.equal(restored.score,128);assert.equal(restored.shots,4);
  for(let i=0;i<240;i++)restored.step(1/120);
  assert.equal(restored.over,false);for(const n of restored.blobs[0].nodes)assert.ok(g.contains(n.x,n.y,.001));
});

test('dry and water funnels have a flared mouth reduced by one third and admit its outer edges',()=>{
  const original=BOTTLES.classic,originalWidth=original.BOTTLE_LIP_RIGHT-original.BOTTLE_LIP_LEFT;
  for(const id of ['separating-funnel','separating-funnel-water']){
    const g=BOTTLES[id],m=g.mouths[0],left=Math.min(m.a.x,m.b.x),right=Math.max(m.a.x,m.b.x);
    assert.ok(Math.abs(right-left-280*2/3)<.00001);assert.ok(right-left<originalWidth);assert.ok(g.bottleLeftAt(g.BOTTLE_MOUTH+24)>left+15,'Flared lip turns inward like the Original bottle');
    for(const x of [left+6,right-6]){
      const p={x,y:g.BOTTLE_MOUTH-4,px:x,py:g.BOTTLE_MOUTH-4,bottleSide:false},body={x,y:p.y,nodes:[p]};
      g.bottleWalls(body);p.y=g.BOTTLE_MOUTH+1;body.y=p.y;g.bottleWalls(body);
      assert.equal(p.bottleSide,true);assert.ok(g.contains(p.x,p.y,.001));
    }
  }
});

test('outer ready slots can enter both widened funnels at gentle and full force',()=>{
  for(const id of ['separating-funnel','separating-funnel-water'])for(const slot of [0,2])for(const level of [0,4])for(const power of [0,1]){
    const e=new Engine(42,id);e.rack=[{id:1,level:slot===0?level:1},{id:2,level:2},{id:3,level:slot===2?level:3}];e.rackSerial=3;e.selectedId=slot+1;e.syncRack();
    e.shoot(0,power,true,{x:180+(slot-1)*e.vessel.rackSpread,y:58});
    for(let i=0;i<480&&!e.over;i++)e.step(1/120);
    assert.equal(e.over,false,`${id}, slot ${slot}, level ${level}, power ${power}`);assert.ok(e.blobs[0].hasEntered);
  }
});

test('doubled conical mouths admit outer slots and preserve saved rounds in both merge modes',()=>{
  for(const id of ['conical-flask','conical-flask-water'])for(const mode of ['two','three']){
    const g=BOTTLES[id],m=g.mouths[0];assert.equal(Math.abs(m.b.x-m.a.x),164);assert.equal(g.BOTTLE_VERSION,2);
    for(const slot of [0,2])for(const power of [0,1])for(const level of [0,4]){
      const e=new Engine(42,id,mode);e.rack=[{id:1,level:slot===0?level:1},{id:2,level:2},{id:3,level:slot===2?level:3}];e.rackSerial=3;e.selectedId=slot+1;e.syncRack();
      assert.ok(e.shoot(0,power,true,{x:180+(slot-1)*g.rackSpread,y:58}));for(let i=0;i<480&&!e.over;i++)e.step(1/120);
      assert.equal(e.over,false,`${id}, ${mode}, slot ${slot}, level ${level}, power ${power}`);assert.ok(e.blobs[0].hasEntered);
      const snapshot=JSON.parse(JSON.stringify(e));snapshot.bottleVersion=1;
      const restored=Engine.restore(snapshot);assert.equal(restored.bottleVersion,2);assert.equal(restored.score,e.score);assert.equal(restored.shots,e.shots);assert.equal(restored.mergeMode,mode);
    }
  }
});
