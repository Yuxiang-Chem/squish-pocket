import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RackMotion,trayRadius} from '../dist/rack-motion.js';
const base=[{id:1,level:0},{id:2,level:1},{id:3,level:2}];
test('Incoming blobs visibly travel from the edge before settling',()=>{
  const m=new RackMotion();m.reset(base.slice(1));
  m.play([{kind:'arrive',id:1,level:0,side:'left',before:base.slice(1),after:base}],base);
  assert.equal(m.visual.get(1).x,-32);m.update(.12);
  assert.ok(m.visual.get(1).x>-32&&m.visual.get(1).x<180);assert.equal(m.busy,true);
  m.update(2);assert.equal(m.busy,false);assert.ok(Math.hypot(m.visual.get(1).x-m.rest.get(1).x,m.visual.get(1).y-m.rest.get(1).y)<4);
});
test('Cluster translations show intermediate motion and resolve the new inventory',()=>{
  const m=new RackMotion();m.reset(base);const initial=m.visual.get(1).x;m.play([],[base[2],base[1],base[0]]);
  m.update(.1);assert.ok(Math.abs(m.visual.get(1).x-initial)>1);assert.equal(m.busy,true);
  m.update(2);assert.equal(m.busy,false);assert.equal(m.items.length,3);
});
test('Incoming projectiles transfer momentum and squash the neighboring membranes',()=>{
  const old=[{id:1,level:2},{id:2,level:3}],incoming={id:3,level:4},final=[incoming,...old];
  function run(hidden){
    const m=new RackMotion();m.setPhysics({stiffness:30,viscosity:20,blobSize:100});m.reset(old);m.play([{kind:'arrive',id:3,level:4,side:'left',before:old,after:final}],final);
    assert.ok(Math.abs(m.visual.get(3).body.vx-1080)<.000001);
    if(hidden)m.visual.get(3).alpha=0;
    m.update(.4);return m;
  }
  const impact=run(false),control=run(true);
  assert.ok(impact.stats.contacts>0);assert.ok(!control.stats.impacts.some(p=>p.a===3||p.b===3));
  assert.ok(impact.visual.get(1).x>control.visual.get(1).x+10,'Impact pushes the neighbor beyond the black-hole attraction alone');
  assert.ok(impact.stats.maxDeformation>control.stats.maxDeformation+.3,'Collision changes the actual soft-body outline');
  assert.ok(impact.stats.impacts.some(p=>p.a===1&&p.b===2),'The push propagates to the next ready blob');
});
test('Merge growth waits for source contact',()=>{
  const m=new RackMotion(),after=[{id:4,level:1},base[2]];m.reset(base);
  m.play([{kind:'merge',id:4,level:1,from:[1,2],before:base,after}],after);
  assert.equal(m.segment.mergeAt,null);assert.equal(m.visual.get(4).alpha,0);
  m.update(2);assert.equal(m.busy,false);assert.ok(m.stats.contacts>0);assert.equal(m.visual.get(4).alpha,1);
});
test('Projectile interaction stays finite at all stiffness and viscosity extremes',()=>{
  for(const stiffness of [0,100])for(const viscosity of [0,100])for(const side of ['left','right']){
    const old=[{id:1,level:2},{id:2,level:3}],n={id:3,level:4},final=side==='left'?[n,...old]:[...old,n];
    const m=new RackMotion();m.setPhysics({stiffness,viscosity});m.reset(old);
    m.play([{kind:'arrive',id:3,level:4,side,before:old,after:final}],final);
    for(let k=0;k<360;k++){
      m.update(1/120);
      for(const item of m.items)assert.ok(item.body.nodes.every(p=>[p.x,p.y,p.px,p.py].every(Number.isFinite)));
    }
    assert.equal(m.busy,false);assert.equal(m.items.length,3);
  }
});
test('Merge playback shows one combined face once contact begins, without layered source faces',()=>{
  const m=new RackMotion();m.reset(base);const merged={id:4,level:1},after=[merged,base[2]];
  m.play([{kind:'merge',id:4,level:1,from:[1,2],before:base,after}],after);
  assert.equal(m.visual.get(4).alpha,0);m.update(.03);
  assert.equal(m.visual.get(1).alpha,0);assert.equal(m.visual.get(2).alpha,0);assert.equal(m.visual.get(4).alpha,1);assert.ok(m.visual.get(4).scale<1);
  m.update(1);assert.deepEqual(m.items.map(b=>b.id),[3,4]);assert.equal(m.busy,false);
});
test('Reduced-motion playback resolves the same final inventory',()=>{
  const m=new RackMotion(true);m.reset([]);
  m.play([{kind:'arrive',id:1,level:0,side:'right',after:[base[0]]}],base);
  m.update(.1);assert.equal(m.busy,false);assert.equal(m.items.length,3);
});
test('Preparation bodies also resize and remain finite through large-blob swaps',()=>{
  for(const stiffness of [0,100])for(const blobSize of [40,150]){
    const m=new RackMotion();m.setPhysics({stiffness,viscosity:20,blobSize});m.reset(base);
    assert.ok(Math.abs(m.visual.get(1).body.renderRadius-trayRadius(0,blobSize))<.00001);
    m.play([],[base[2],base[1],base[0]]);m.update(3);
    assert.equal(m.busy,false);assert.equal(m.items.length,3);
    for(const b of m.items)assert.ok(b.body.nodes.every(p=>[p.x,p.y,p.px,p.py].every(Number.isFinite)));
  }
});
test('Resizing after a side arrival preserves the left-middle-right order',()=>{
  const old=[{id:1,level:2},{id:2,level:3}],incoming={id:3,level:4},final=[incoming,...old];
  const m=new RackMotion();m.reset(old);m.play([{kind:'arrive',id:3,level:4,side:'left',before:old,after:final}],final);m.update(2);
  m.setPhysics({blobSize:150});m.update(3);
  assert.ok(m.visual.get(3).x<m.visual.get(1).x&&m.visual.get(1).x<m.visual.get(2).x);
});
