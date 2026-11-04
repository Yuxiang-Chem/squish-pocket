import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob,setReducedMergeMotion} from '../dist/engine.js';
import {refillRack} from '../dist/rack.js';
import {Achievements,captureProgress,loadProfile} from '../dist/achievements.js';
import {profileKeyFor,saveKeyFor} from '../dist/merge-rules.js';

test('each actual milestone creation counts, including repeated merges and ready-row merges in both modes',()=>{
  setReducedMergeMotion(true);
  try{
    for(const [mode,level] of [['two',9],['three',6]]){
      const e=new Engine(7,'classic',mode),n=e.rules.count;
      for(let repeat=1;repeat<=2;repeat++){
        e.blobs=Array.from({length:n},(_,i)=>blob(level,150+i*25,300));
        assert.equal(e.step(1/120).length,1);assert.equal(e.milestoneCount,repeat);
        e.step(1/120);assert.equal(e.milestoneCount,repeat,'keeping the created blob does not count again');
      }
      e.blobs=[];e.rack=Array.from({length:3},(_,i)=>({id:i+1,level:i<n?level:0}));e.rackSerial=3;e.selectedId=1;
      e.incoming={level:0,side:'left'};
      refillRack(e,()=>({level:1,side:'left'}));assert.equal(e.milestoneCount,3);
      if(mode==='two'){
        e.rack=[{id:1,level},{id:2,level:0},{id:3,level}];e.rackSerial=3;
        e.moveRack(1,3);assert.equal(e.milestoneCount,4,'intentional ready-row pair counts once');
      }
      const copy=Engine.restore(JSON.parse(JSON.stringify(e)));
      assert.equal(copy.milestoneRun,e.milestoneRun);assert.equal(copy.milestoneCount,e.milestoneCount);
      const p={mergeMode:mode,score:0,highestTile:e.rules.start};
      assert.equal(captureProgress(p,copy),true);assert.equal(captureProgress(p,copy),false);
      assert.equal(p.milestoneRuns[e.milestoneRun],e.milestoneCount);
      assert.notEqual(new Engine(7,'classic',mode).milestoneRun,e.milestoneRun);
    }
  }finally{setReducedMergeMotion(false);}
});

test('old saves start counting future merges without inventing historical totals; corrupt counters are rejected',()=>{
  const data=JSON.parse(JSON.stringify(new Engine(7)));
  data.highestLevel=11;delete data.milestoneRun;delete data.milestoneCount;
  const old=Engine.restore(data);assert.equal(old.milestoneCount,0);
  old.countMilestone(11);assert.equal(old.milestoneCount,0,'4096 is not another 2048 creation');
  old.countMilestone(10);assert.equal(old.milestoneCount,1);
  const saved=JSON.parse(JSON.stringify(old));
  for(const count of [-1,1.5,1000001,'2'])assert.equal(Engine.restore({...saved,milestoneCount:count}),null);
  assert.equal(Engine.restore({...saved,milestoneRun:'bad'}),null);
});

test('offline counts recover from saves; pre-restart Three rounds and profiles cannot refill new totals',()=>{
  const e=new Engine(7,'classic','three');e.highestLevel=7;e.milestoneCount=2;
  const values=new Map([[saveKeyFor('classic','three'),JSON.stringify({version:1,engine:e})]]),storage={getItem:k=>values.get(k)};
  let p=loadProfile(storage,'three');assert.equal(p.milestoneRuns[e.milestoneRun],2);
  e.achievementEpoch=1;values.set(saveKeyFor('classic','three'),JSON.stringify({version:1,engine:e}));
  values.set(profileKeyFor('three'),JSON.stringify({...p,achievementEpoch:1}));
  p=loadProfile(storage,'three');assert.deepEqual(p.milestoneRuns,{});assert.equal(captureProgress(p,e),false);
});

function browser(t){
  const values=new Map();
  for(const [key,value] of Object.entries({localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},window:{addEventListener(){}}})){
    const original=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key];});
  }
  return values;
}
test('offline retry, in-flight merges, reload and a second tab retain and acknowledge only committed counts',async t=>{
  browser(t);const a=new Achievements({canCelebrate:()=>false}),e=new Engine(7);e.highestLevel=10;e.milestoneCount=1;
  a.observe(e);const b=new Achievements({canCelebrate:()=>false}),second=new Engine(8);second.highestLevel=10;second.milestoneCount=3;b.observe(second);
  t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('offline');});
  assert.equal(await a.sync(true),null);
  let release;const sent=[];
  t.mock.method(globalThis,'fetch',async(_path,options)=>{sent.push(JSON.parse(options.body));return new Promise(resolve=>{release=()=>resolve(Response.json({mergeMode:'two',totalMilestones:4,bottles:{}}));});});
  const upload=a.sync();assert.equal(sent[0].milestoneRuns[second.milestoneRun],3,'another tab count survives');
  e.milestoneCount=2;a.observe(e);release();await upload;
  assert.equal(a.pending,true);assert.equal(a.profile.milestoneSynced[e.milestoneRun],1);
  t.mock.method(globalThis,'fetch',async(_path,options)=>{sent.push(JSON.parse(options.body));return Response.json({mergeMode:'two',totalMilestones:5,bottles:{}});});
  await a.sync(true);assert.deepEqual(sent[1].milestoneRuns,{[e.milestoneRun]:2});
  const reload=new Achievements({canCelebrate:()=>false});await reload.sync(true);
  assert.deepEqual(sent[2].milestoneRuns,{});assert.equal(reload.pending,false);
  assert.equal(reload.profile.milestoneRuns[second.milestoneRun],3);
});

test('large offline queues upload in bounded batches, then stop retrying',async t=>{
  browser(t);const tracker=new Achievements({canCelebrate:()=>false});tracker.profile.highestTile=2048;
  for(let i=0;i<53;i++)tracker.profile.milestoneRuns[crypto.randomUUID()]=1;
  const batches=[];t.mock.method(globalThis,'fetch',async(_path,options)=>{batches.push(Object.keys(JSON.parse(options.body).milestoneRuns).length);return Response.json({mergeMode:'two',totalMilestones:53,bottles:{}});});
  await tracker.sync(true);assert.deepEqual(batches,[50,3]);assert.equal(tracker.pending,false);
});
