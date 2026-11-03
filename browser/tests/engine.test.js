import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob,radiusFor,HEIGHT,MERGE_DELAY,MERGE_GROW,setReducedMergeMotion} from '../dist/engine.js';
import {LAUNCH_X,LAUNCH_Y,MAX_ANGLE,aimFromPoint,shotVector} from '../dist/controls.js';
const dt=1/120;
test('Launch and cooldown, finite input, bounded power',()=>{
  const e=new Engine();assert.equal(e.shoot(NaN),false);assert.equal(e.shoot(0,5),true);
  assert.equal(e.blobs[0].x,LAUNCH_X);assert.equal(e.blobs[0].y,LAUNCH_Y);assert.equal(e.blobs[0].vy,1080);
  assert.equal(e.shoot(0),false);const wait=Math.ceil(e.cooldown/dt)+1;for(let i=0;i<wait;i++)e.step(dt);assert.equal(e.shoot(0),true);
});
test('All aiming angles launch from the same top-center position',()=>{
  for(const angle of [-MAX_ANGLE,-.4,0,.4,MAX_ANGLE]){
    const e=new Engine();e.shoot(angle,.6);const b=e.blobs[0];
    assert.equal(b.x,180);assert.equal(b.y,58);
    assert.equal(Math.sign(b.vx),Math.sign(angle));assert.ok(b.vy>0);
    assert.ok(Math.abs(Math.hypot(b.vx,b.vy)-(80+.6*1000))<.00001);
  }
});
test('Drag distance controls force and direction independently; return to center cancels',()=>{
  const short=aimFromPoint(180,98),long=aimFromPoint(180,258);
  assert.equal(short.angle,0);assert.equal(long.angle,0);assert.ok(long.power>short.power);
  assert.ok(Math.hypot(...Object.values(shotVector(long.angle,long.power)))>Math.hypot(...Object.values(shotVector(short.angle,short.power)))*4);
  const left=aimFromPoint(100,158),right=aimFromPoint(260,158);
  assert.ok(left.angle<0&&right.angle>0);assert.equal(left.power,right.power);
  assert.equal(aimFromPoint(180,58).cancelled,true);assert.equal(aimFromPoint(180,20).cancelled,true);
});
test('Strong and gentle shots keep visibly different flight speeds',()=>{
  const soft=new Engine(),hard=new Engine();soft.shoot(.5,.05);hard.shoot(.5,1);
  for(let i=0;i<12;i++){soft.step(dt);hard.step(dt);}
  assert.ok(hard.blobs[0].x-LAUNCH_X>(soft.blobs[0].x-LAUNCH_X)*5);
});
const settleMerge=(e,limit=120)=>{let events=[];for(let k=0;k<limit&&!events.length;k++)events=e.step(dt);return events;};
test('A matching pair doubles in value and scores exactly once',()=>{
  const e=new Engine();e.blobs=[blob(0,100,400),blob(0,120,400)];
  const events=settleMerge(e);assert.equal(events.length,1);assert.equal(e.blobs.length,1);
  assert.equal(e.blobs[0].level,1);assert.equal(e.score,4);
  for(let k=0;k<120;k++)assert.equal(e.step(dt).length,0);assert.equal(e.score,4);
});
test('A bottle merge fuses for a noticeable delay after first contact, then grows and scores once',()=>{
  const e=new Engine();e.blobs=[blob(2,140,390),blob(2,175,390)];
  let touched=null,mergedAt=null,start=Math.hypot(35,0),closest=start;
  for(let k=1;k<=120&&mergedAt===null;k++){
    const events=e.step(dt);
    if(touched===null&&e.blobs.every(b=>b.fuse))touched=k;
    if(events.length){mergedAt=k;assert.equal(events.length,1);assert.equal(events[0].value,16);}
    else{assert.equal(e.score,0,'No score while the pair is still fusing');closest=Math.min(closest,Math.hypot(e.blobs[0].x-e.blobs[1].x,e.blobs[0].y-e.blobs[1].y));}
  }
  assert.ok(touched!==null&&mergedAt!==null);
  assert.ok((mergedAt-touched)*dt>=MERGE_DELAY-.01,`Merge waits after contact, observed ${(mergedAt-touched)*dt}s`);
  assert.ok(closest<start*.6,'Fusing partners are drawn toward each other');
  const result=e.blobs.at(-1);assert.equal(result.level,3);assert.equal(e.score,16);
  assert.ok(result.renderRadius<e.radius(3)*.9,'The result starts near its sources\' size');
  for(let k=0;k<Math.ceil(MERGE_GROW/dt)+2;k++)e.step(dt);
  assert.ok(Math.abs(result.renderRadius-e.radius(3))<1e-9);assert.equal(result.grow,undefined);assert.equal(e.score,16);
});
test('A fusing pair survives save and restore and still merges once',()=>{
  const e=new Engine();e.blobs=[blob(1,140,390),blob(1,170,390)];
  for(let k=0;k<12;k++)e.step(dt);assert.ok(e.blobs.every(b=>b.fuse));
  const copy=Engine.restore(JSON.parse(JSON.stringify(e)));assert.deepEqual(copy,e);
  assert.equal(settleMerge(copy).length,1);assert.equal(copy.blobs.length,1);assert.equal(copy.score,8);
  const corrupt=JSON.parse(JSON.stringify(e));corrupt.blobs[0].fuse={id:'x',time:0};assert.equal(Engine.restore(corrupt),null);
});
test('Reduced motion merges on first contact at full size',()=>{
  setReducedMergeMotion(true);
  try{
    const e=new Engine();e.blobs=[blob(0,100,400),blob(0,120,400)];
    assert.equal(e.step(dt).length,1);assert.equal(e.blobs[0].grow,undefined);assert.equal(e.blobs[0].renderRadius,e.radius(1));
  }finally{setReducedMergeMotion(false);}
});
test('Three touching equal blobs cannot reuse a merged blob',()=>{
  const e=new Engine();e.blobs=[blob(0,100,400),blob(0,115,400),blob(0,130,400)];
  assert.equal(settleMerge(e).length,1);assert.equal(e.blobs.length,2);
});
test('Different levels and maximum level remain separate',()=>{
  const e=new Engine();e.blobs=[blob(0,100,400),blob(1,115,400)];assert.equal(e.step(dt).length,0);
  e.blobs=[blob(11,120,350),blob(11,220,350)];assert.equal(e.step(dt).length,0);
});
test('Walls and floor contain a blob and deform its surface',()=>{
  const e=new Engine();e.blobs=[blob(2,320,370,500,500)];e.step(dt);
  const b=e.blobs[0];assert.ok(b.nodes.every(p=>p.x>=3&&p.x<=357&&p.y>=3&&p.y<=HEIGHT-3));
  for(let i=0;i<100;i++)e.step(dt);assert.ok(b.shape.some(v=>Math.abs(v)>.001));
});
test('Impact flattens a real membrane while preserving its area',()=>{
  const e=new Engine();e.blobs=[blob(6,180,240)];let widest=1;
  const target=12*radiusFor(6)**2*Math.sin(Math.PI/12);
  for(let i=0;i<360;i++){
    e.step(dt);const b=e.blobs[0],box=b.bounds;
    widest=Math.max(widest,(box.maxX-box.minX)/(box.maxY-box.minY));
    let area=0;for(let k=0;k<24;k++){const p=b.nodes[k],q=b.nodes[(k+1)%24];area+=(p.x*q.y-q.x*p.y)*.5;}
    assert.ok(area/target>.8&&area/target<1.08,'Blob keeps its volume instead of collapsing');
  }
  assert.ok(widest>1.65,`Impact must visibly squash the outline, observed ${widest}`);
});
test('Old circular saves migrate into deformable membranes without losing score',()=>{
  const saved=new Engine(123);saved.blobs=[blob(3,180,400)];saved.score=64;saved.shots=5;
  const restored=Engine.restore(JSON.parse(JSON.stringify(saved)));restored.step(dt);
  assert.equal(restored.score,64);assert.equal(restored.shots,5);assert.equal(restored.blobs[0].nodes.length,24);
  const corrupt=JSON.parse(JSON.stringify(restored));corrupt.blobs[0].nodes[0].x=null;assert.equal(Engine.restore(corrupt),null);
});
test('Capacity warning and partial overhang do not end the round before a whole spill',()=>{
  const e=new Engine();const b=blob(9,180,150);b.age=3;b.danger=2.799;e.blobs=[b];e.step(dt);
  assert.equal(e.over,false);assert.ok(e.blobs[0].danger>2.8);
  const f=new Engine();f.blobs=[blob(0,180,58)];f.step(dt);assert.equal(f.over,false);assert.equal(f.blobs[0].danger,0);
});
test('Saves restore the complete simulation and reject corrupt shapes',()=>{
  const e=new Engine();e.shoot(.3,.5);e.step(dt);const copy=JSON.parse(JSON.stringify(e));
  assert.deepEqual(Engine.restore(copy),e);copy.blobs[0].shape=[];assert.equal(Engine.restore(copy),null);
  assert.equal(Engine.restore({blobs:[]}),null);
});
test('Seeded next queue is repeatable; invalid steps do not change state',()=>{
  const a=new Engine(123),b=new Engine(123);assert.deepEqual(Array.from({length:100},()=>a.random()),Array.from({length:100},()=>b.random()));
  a.shoot(100);const before=JSON.stringify(a);a.step(Infinity);assert.equal(JSON.stringify(a),before);
});
test('24,000-step stress simulation remains finite across hundreds of merges',()=>{
  let e=new Engine(987),merges=0;
  for(let tick=0;tick<24000;tick++){
    if(tick%75===0)e.shoot((((tick*7919)%310)/310-.5)*2.4,(tick%5)/4);
    merges+=e.step(dt).length;
    assert.ok(e.blobs.every(b=>[b.x,b.y,b.vx,b.vy,...b.shape,...b.spring,...(b.nodes??[]).flatMap(p=>[p.x,p.y,p.px,p.py])].every(Number.isFinite)));
    if(e.over)e=new Engine(tick+1);
  }
  assert.ok(merges>60);console.log(`Stress test: ${merges} merges, 24,000 steps`);
});
