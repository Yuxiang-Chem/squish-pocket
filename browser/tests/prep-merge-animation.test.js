import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RackMotion} from '../dist/rack-motion.js';
const base=[{id:1,level:0},{id:2,level:0},{id:3,level:2}],merged={id:4,level:1},after=[merged,base[2]];
function merging(){
  const m=new RackMotion();m.reset(base);
  m.play([{kind:'merge',id:4,level:1,from:[1,2],before:base,after}],after);
  return m;
}
test('A preparation merge emits one burst at the merge point and the result pops past 1 before settling',()=>{
  const m=merging();let burst=null,peak=0;
  for(let k=0;k<240&&m.busy;k++){
    const before=[1,2].map(id=>m.visual.get(id)).filter(b=>b?.alpha>0).map(b=>({x:b.body.x,y:b.body.y}));
    m.update(1/120);
    const bursts=m.takeMergeBursts();
    if(bursts.length){
      assert.equal(burst,null);assert.equal(bursts.length,1);burst=bursts[0];
      const result=m.visual.get(4);assert.equal(burst.level,1);
      assert.ok(result.squash.amount>.1&&Math.abs(Math.cos(result.squash.angle))>.9,'Result starts stretched along the horizontal merge axis');
      assert.equal(result.glow,1);
      assert.ok(Math.hypot(burst.x-result.x,burst.y-result.y)<1e-9,'Burst sits at the result body');
      assert.equal(before.length,2);
      assert.ok(Math.hypot(burst.x-(before[0].x+before[1].x)/2,burst.y-(before[0].y+before[1].y)/2)<8,'Burst is between the sources');
    }
    if(burst)peak=Math.max(peak,m.visual.get(4)?.scale??0);
  }
  assert.ok(burst,'A burst event is queued');
  assert.ok(peak>1.08&&peak<1.2,`Result overshoots (peak ${peak})`);
  assert.equal(m.busy,false);
  const result=m.visual.get(4);assert.equal(result.scale,1);assert.equal(result.alpha,1);assert.equal(result.squash,null);assert.equal(result.glow,0);
});
test('Interrupting mid-pop leaves the merged blob fully visible at scale 1',()=>{
  const m=merging();
  for(let k=0;k<240&&m.segment?.mergeAt===null;k++)m.update(1/120);
  m.update(.08);assert.notEqual(m.visual.get(4).scale,1);
  m.interrupt(after);
  const result=m.visual.get(4);assert.equal(result.scale,1);assert.equal(result.alpha,1);assert.equal(result.squash,null);assert.equal(result.glow,0);
  assert.deepEqual([...m.visual.keys()].sort(),[3,4]);
});
test('Reduced motion resolves preparation merges without bursts or overshoot',()=>{
  const m=new RackMotion(true);m.reset(base);
  m.play([{kind:'merge',id:4,level:1,from:[1,2],before:base,after}],after);
  m.update(.2);assert.equal(m.busy,false);assert.deepEqual(m.takeMergeBursts(),[]);
  assert.ok(m.items.every(b=>b.scale===1&&b.alpha===1));
});
