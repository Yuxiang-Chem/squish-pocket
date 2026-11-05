import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {loadProfile, captureProgress, roundRecords, canMessage, newlyWonBottles, Achievements} from '../dist/achievements.js';

test('concurrent achievement modes keep identities, requests, milestones and storage separate', async t => {
  const values=new Map(),sent=[];
  for(const [key,value] of Object.entries({localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},window:{addEventListener(){}}})){
    const original=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key];});
  }
  t.mock.method(globalThis,'fetch',async(path,options)=>{
    sent.push({path,id:options.headers['X-Player-Id'],...JSON.parse(options.body)});
    return Response.json({mergeMode:path.includes('merge=three')?'three':'two',achievementEpoch:2,bottles:{}});
  });
  let twoMilestones=0,threeMilestones=0;
  const two=new Achievements({mergeMode:'two',canCelebrate:()=>false,onMilestone:()=>twoMilestones++});
  const three=new Achievements({mergeMode:'three',canCelebrate:()=>false,onMilestone:()=>threeMilestones++});
  const original=new Engine(7),triple=new Engine(7,'conical-flask','three');
  original.score=4096;original.highestLevel=10;triple.score=2187;triple.highestLevel=7;
  two.observe(original,4096);three.observe(triple,2187);
  assert.equal(twoMilestones,1);assert.equal(threeMilestones,1);
  assert.notEqual(two.profile.id,three.profile.id);
  await Promise.all([two.sync(true),three.sync(true)]);
  await three.rename('Triple friend');
  assert.deepEqual(sent.map(s=>s.path),['/api/achievements','/api/achievements?merge=three','/api/achievements?merge=three']);
  assert.equal(sent[0].id,two.profile.id);assert.equal(sent[1].id,three.profile.id);
  assert.equal(new Achievements({mergeMode:'two'}).profile.score,4096);
  const restored=new Achievements({mergeMode:'three'});
  assert.equal(restored.profile.score,2187);assert.equal(restored.profile.highestTile,2187);assert.equal(restored.profile.name,'Triple friend');
  t.mock.method(globalThis,'fetch',async()=>Response.json({mergeMode:'two'}));
  assert.equal(await three.sync(true),null);assert.match(three.error,/another merge mode/);
  assert.equal(three.profile.score,2187);
});

test('personal achievements survive new rounds and restored games preserve peak merge', () => {
  const engine = new Engine(123);
  engine.rack = [{id:1,level:9},{id:2,level:9},{id:3,level:0}]; engine.rackSerial = 3;
  engine.moveRack(1,2);
  assert.equal(engine.highestLevel, 10);
  const profile = {score:0, highestTile:2};
  captureProgress(profile, engine);
  assert.equal(profile.highestTile, 2048);
  engine.rack = [{id:4,level:0},{id:5,level:1},{id:6,level:2}];
  engine.rackSerial = 6; engine.selectedId = 4; engine.syncRack();
  const restored = Engine.restore(JSON.parse(JSON.stringify(engine)));
  assert.equal(restored.highestLevel, 10);
  captureProgress(profile, new Engine(456), 512);
  assert.equal(profile.highestTile, 2048); assert.equal(profile.score, 512);
  assert.equal(captureProgress(profile, new Engine(789), 0), false);
});

test('old saves infer biggest tile; invalid peak values are rejected', () => {
  const engine = new Engine(123); delete engine.highestLevel;
  engine.rack = [{id:1,level:10},{id:2,level:0},{id:3,level:1}];
  engine.rackSerial = 3; engine.selectedId = 1;
  assert.equal(Engine.restore(JSON.parse(JSON.stringify(engine))).highestLevel, 10);
  engine.highestLevel = 99;
  assert.equal(Engine.restore(JSON.parse(JSON.stringify(engine))), null);
});

test('invalid browser profile is repaired; valid player identity is retained', () => {
  const broken = loadProfile({getItem: () => '{broken'});
  assert.equal(broken.highestTile, 2); assert.ok(broken.id); assert.ok(broken.token);
  const loaded = loadProfile({getItem: () => JSON.stringify({...broken, score:4096, highestTile:2048})});
  assert.equal(loaded.id, broken.id); assert.equal(loaded.score, 4096);
});

test('bottle bests stay separate from the overall best and survive new rounds', () => {
  const profile = {score: 0, highestTile: 2}, classic = new Engine(7), flask = new Engine(7, 'lab-flask');
  classic.score = 512;classic.highestLevel = 10;captureProgress(profile, classic);
  flask.score = 128;flask.highestLevel = 4;captureProgress(profile, flask, 512);
  assert.deepEqual(profile.bottles, {classic: {score: 512, highestTile: 2048}, 'lab-flask': {score: 128, highestTile: 32}});
  assert.equal(profile.score, 512);
  assert.equal(captureProgress(profile, new Engine(8, 'lab-flask'), 512), false);
  const restored = loadProfile({getItem: key => key.includes('achievements') ? JSON.stringify({...profile, id: crypto.randomUUID(), token: crypto.randomUUID()}) : null});
  assert.deepEqual(restored.bottles, profile.bottles);
});

test('round summaries use only the selected bottle personal and world records', () => {
  const profile={score:20000,bottles:{classic:{score:512},'lab-flask':{score:128}}};
  const shared={record:{score:30000},personal:{score:20000},bottles:{classic:{record:{score:4096},personal:{score:768}},'lab-flask':{record:{score:1024},personal:{score:256}}}};
  const classic=new Engine(7),flask=new Engine(7,'lab-flask');classic.score=64;flask.score=32;
  assert.deepEqual(roundRecords(profile,shared,classic),{personalBest:768,worldBest:4096});
  assert.deepEqual(roundRecords(profile,shared,flask),{personalBest:256,worldBest:1024});
  flask.score=512;assert.deepEqual(roundRecords(profile,shared,flask),{personalBest:512,worldBest:1024});
});

test('offline or missing bottle records never show another bottle world score', () => {
  const flask=new Engine(7,'lab-flask');flask.score=64;
  const profile={score:16364,bottles:{classic:{score:16364},'lab-flask':{score:128}}};
  assert.deepEqual(roundRecords(profile,null,flask),{personalBest:128,worldBest:null});
  assert.deepEqual(roundRecords(profile,{record:{score:16364},bottles:{classic:{record:{score:16364}}}},flask),{personalBest:128,worldBest:null});
  assert.deepEqual(roundRecords(profile,{bottles:{'lab-flask':{record:null}}},flask),{personalBest:128,worldBest:0});
});

test('record messaging accepts either bottle without requiring the overall record',()=>{
  const summary={isRecordHolder:false,bottles:{classic:{isRecordHolder:false},'lab-flask':{isRecordHolder:true,record:{score:1024}}}};
  assert.equal(canMessage(summary,'lab-flask'),true);assert.equal(canMessage(summary,'classic'),false);assert.equal(canMessage(summary,'all'),false);
  assert.equal(canMessage(summary,'unknown'),false);assert.equal(canMessage(null,'lab-flask'),false);
});

test('celebrations require confirmed ownership and avoid repeats for ongoing own-record improvements',()=>{
  const won={bottles:{'lab-flask':{isRecordHolder:true,record:{score:1024}}}};
  assert.deepEqual(newlyWonBottles(null,won),['lab-flask']);
  assert.deepEqual(newlyWonBottles(null,won,{'lab-flask':1024}),[]);
  assert.deepEqual(newlyWonBottles(won,{bottles:{'lab-flask':{isRecordHolder:true,record:{score:2048}}}}),[]);
  assert.deepEqual(newlyWonBottles({bottles:{'lab-flask':{isRecordHolder:false}}},won),['lab-flask']);
  assert.deepEqual(newlyWonBottles(null,{bottles:{'lab-flask':{isRecordHolder:false,record:{score:1024}}}}),[]);
});

test('old overall records remain unattributed while saved round scores are recovered per bottle', () => {
  const identity = {id: crypto.randomUUID(), token: crypto.randomUUID(), score: 4096, highestTile: 2048};
  const saves = new Map([
    ['squish-pocket-achievements-v1', JSON.stringify({...identity, bottles: {fake: {score: 5000, highestTile: 4096}, classic: {score: -1, highestTile: 2}}})],
    ['squish-pocket-v1', JSON.stringify({version: 1, best: 4096, engine: {score: 512, highestLevel: 8}})],
    ['squish-pocket-v1:lab-flask', JSON.stringify({version: 1, best: 4096, engine: {bottleId: 'lab-flask', score: 128, highestLevel: 4}})]
  ]);
  const profile = loadProfile({getItem: key => saves.get(key)});
  assert.equal(profile.id, identity.id);assert.equal(profile.score, 4096);
  assert.deepEqual(profile.bottles, {classic: {score: 512, highestTile: 512}, 'lab-flask': {score: 0, highestTile: 32}});
  saves.delete('squish-pocket-v1');saves.delete('squish-pocket-v1:lab-flask');
  assert.deepEqual(loadProfile({getItem: key => saves.get(key)}).bottles, {});
});

test('offline progress retries with the same identity and catches updates during an active sync', async t => {
  const values = new Map();
  for (const [key, value] of Object.entries({localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}, window:{addEventListener(){}}})) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {configurable:true,writable:true,value});
    t.after(() => {if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key];});
  }
  t.mock.method(globalThis, 'fetch', async () => {throw new TypeError('offline');});
  const tracker = new Achievements(), engine = new Engine(123);
  engine.highestLevel = 10; engine.score = 2048;
  captureProgress(tracker.profile, engine); tracker.persist();
  await tracker.sync(true);
  assert.equal(tracker.pending, true); assert.match(tracker.error, /connect/);
  const restored = new Achievements(); assert.equal(restored.profile.id, tracker.profile.id);
  assert.equal(restored.profile.highestTile, 2048);
  let release; const sent = [];
  t.mock.method(globalThis, 'fetch', async (_path, options) => {
    sent.push(JSON.parse(options.body));
    if (sent.length === 1) await new Promise(resolve => {release = resolve;});
    return Response.json({isRecordHolder:true,record:{score:sent.at(-1).score}});
  });
  const first = restored.sync(); engine.score = 4096; engine.highestLevel = 11;
  captureProgress(restored.profile, engine); restored.pending = true;
  release(); await first; assert.equal(restored.pending, true);
  await restored.sync(true); assert.equal(restored.pending, false);
  assert.deepEqual(sent.map(s=>s.score), [2048,4096]); assert.equal(sent[1].highestTile, 4096);
});

test('bottle-only progress during sync is retried and remote bottle bests merge independently', async t => {
  const values = new Map();
  for (const [key, value] of Object.entries({localStorage: {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)}, window: {addEventListener(){}}})) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
    t.after(() => {if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key];});
  }
  const tracker = new Achievements(), classic = new Engine(7), flask = new Engine(7, 'lab-flask');
  classic.score = 1024;captureProgress(tracker.profile, classic);
  let release;const sent = [];
  t.mock.method(globalThis, 'fetch', async (_path, options) => {
    sent.push(JSON.parse(options.body));
    if (sent.length === 1) await new Promise(resolve => {release = resolve;});
    return Response.json({bottles: {classic: {personal: {score: 2048, highestTile: 1024}}}});
  });
  const first = tracker.sync();flask.score = 128;captureProgress(tracker.profile, flask);tracker.pending = true;
  release();await first;assert.equal(tracker.pending, true);
  assert.equal(tracker.profile.bottles.classic.score, 2048);assert.equal(tracker.profile.bottles['lab-flask'].score, 128);
  await tracker.sync(true);assert.equal(tracker.pending, false);
  assert.equal(sent[0].bottles['lab-flask'], undefined);assert.equal(sent[1].bottles['lab-flask'].score, 128);
  assert.equal(new Achievements().profile.bottles['lab-flask'].score, 128);
});

test('active gameplay suppresses background syncs until game over celebrates the final record', async t => {
  const values = new Map();
  for (const [key, value] of Object.entries({localStorage: {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)}, window: {addEventListener(){}}})) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
    t.after(() => {if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key];});
  }
  let gameOver = false;
  const celebrated = [], settled = [], sent = [];
  t.mock.method(globalThis, 'fetch', async (_path, options) => {
    const body = JSON.parse(options.body);
    sent.push(body);
    const score = body.bottles?.['lab-flask']?.score ?? 0;
    return Response.json({bottles: {'lab-flask': {isRecordHolder: score >= 1024, record: {score}, personal: {score, highestTile: 128}}}});
  });
  const tracker = new Achievements({
    canCelebrate: () => gameOver,
    onRecord: r => celebrated.push(r),
    onSettled: () => { if (gameOver) settled.push(celebrated.at(-1)); }
  });
  const flask = new Engine(7, 'lab-flask');
  flask.score = 1024;
  tracker.observe(flask, 1024);
  assert.equal(sent.length, 0, 'Do not sync or celebrate while the player is still playing');
  assert.equal(celebrated.length, 0);
  flask.score = 2048;
  tracker.observe(flask, 2048);
  gameOver = true;
  await tracker.sync(true);
  assert.equal(sent.length, 1);
  assert.deepEqual(celebrated, [{bottle: 'lab-flask', score: 2048}]);
  assert.deepEqual(settled, [{bottle: 'lab-flask', score: 2048}]);
});

test('fresh flask world board excludes old saves while retaining personal achievements and the pile',()=>{
  const old=new Engine(7,'lab-flask');old.score=13960;old.highestLevel=10;delete old.recordEpoch;
  const profile=loadProfile({getItem:key=>key==='squish-pocket-achievements-v1'?JSON.stringify({
    id:crypto.randomUUID(),token:crypto.randomUUID(),score:20000,highestTile:2048,
    bottles:{classic:{score:20000,highestTile:2048},'lab-flask':{score:13960,highestTile:2048}},
    recordCelebrations:{'lab-flask':13960}
  }):key==='squish-pocket-v1:lab-flask'?JSON.stringify({version:1,engine:old}):null});
  assert.equal(profile.bottles['lab-flask'].score,0);
  assert.deepEqual(profile.flaskRecord,{epoch:2,score:0,highestTile:2});
  assert.equal(profile.recordCelebrations['lab-flask'],undefined);
  const restored=Engine.restore(JSON.parse(JSON.stringify(old)));
  assert.equal(restored.score,13960);assert.equal(restored.recordEpoch,0);
  restored.score+=128;captureProgress(profile,restored);
  assert.equal(profile.flaskRecord.score,0,'An older round cannot upload its old score to the fresh world board');
  const fresh=new Engine(8,'lab-flask');fresh.score=64;fresh.highestLevel=5;
  assert.equal(captureProgress(profile,fresh),true,'Fresh world progress is observed below the historical personal best');
  assert.deepEqual(profile.flaskRecord,{epoch:2,score:64,highestTile:64});
  assert.equal(profile.bottles['lab-flask'].score,64);
  const round=Engine.restore(JSON.parse(JSON.stringify(fresh)));
  assert.equal(round.recordEpoch,2,'New eligible rounds remain eligible after reload');
});

test('fresh world progress below a historical personal best retries in-flight syncs and survives reload',async t=>{
  const values=new Map();
  for(const [key,value] of Object.entries({localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},window:{addEventListener(){}}})){
    const original=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key];});
  }
  const tracker=new Achievements(),engine=new Engine(7,'lab-flask');
  tracker.profile.score=13960;tracker.profile.highestTile=2048;
  tracker.profile.bottles['lab-flask']={score:13960,highestTile:2048};
  engine.score=64;engine.highestLevel=5;captureProgress(tracker.profile,engine);
  let release;const sent=[];
  t.mock.method(globalThis,'fetch',async(_path,options)=>{
    const data=JSON.parse(options.body);sent.push(data);
    if(sent.length===1)await new Promise(resolve=>{release=resolve;});
    return Response.json({bottles:{'lab-flask':{recordEpoch:2,recordPersonal:data.flaskRecord,personal:data.bottles['lab-flask']}}});
  });
  const first=tracker.sync();engine.score=128;
  assert.equal(captureProgress(tracker.profile,engine),true);
  release();await first;assert.equal(tracker.pending,true);
  await tracker.sync(true);assert.equal(tracker.pending,false);
  assert.deepEqual(sent.map(s=>s.flaskRecord.score),[64,128]);
  assert.equal(new Achievements().profile.flaskRecord.score,128);
  assert.equal(new Achievements().profile.bottles['lab-flask'].score,13960);
});

test('personal reset clears only dry-flask scores once and neither saved rounds nor reloads reinstate them',()=>{
  const old=new Engine(7,'lab-flask');old.score=13960;old.highestLevel=10;old.recordEpoch=1;
  const values=new Map([
    ['squish-pocket-achievements-v1',JSON.stringify({id:crypto.randomUUID(),token:crypto.randomUUID(),score:20000,highestTile:2048,
      bottles:{classic:{score:20000,highestTile:2048},'lab-flask':{score:13960,highestTile:2048},'lab-flask-water':{score:2336,highestTile:256}},
      flaskRecord:{epoch:1,score:13960,highestTile:2048}})],
    ['squish-pocket-v1:lab-flask',JSON.stringify({version:1,engine:old,best:20000})]
  ]),storage={getItem:key=>values.get(key)};
  let profile=loadProfile(storage);
  assert.equal(profile.bottles['lab-flask'].score,0);assert.equal(profile.bottles['lab-flask'].highestTile,2048);
  assert.equal(profile.bottles.classic.score,20000);assert.equal(profile.bottles['lab-flask-water'].score,2336);assert.equal(profile.score,20000);
  assert.equal(roundRecords(profile,null,old).personalBest,0);
  captureProgress(profile,old);assert.equal(profile.bottles['lab-flask'].score,0);
  const fresh=new Engine(8,'lab-flask');fresh.score=64;captureProgress(profile,fresh);
  values.set('squish-pocket-achievements-v1',JSON.stringify(profile));
  profile=loadProfile(storage);assert.equal(profile.bottles['lab-flask'].score,64);
  assert.equal(profile.flaskRecord.score,64);assert.equal(roundRecords(profile,null,old).personalBest,64);
  assert.equal(Engine.restore(JSON.parse(values.get('squish-pocket-v1:lab-flask')).engine).score,13960,'The old round itself remains playable');
});

test('anonymous board names use an empty optional editor without changing named players',async()=>{
  const {boardName}=await import('../dist/achievements.js');
  assert.equal(boardName('A squishy friend'),'');assert.equal(boardName(''),'');assert.equal(boardName(undefined),'');
  assert.equal(boardName('  Ada  '),'Ada');
});

test('Three Combine restart clears every personal board once and excludes old saved rounds',()=>{
 const values=new Map(),id=crypto.randomUUID(),token=crypto.randomUUID(),ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water'];
 const old={id,token,name:'zzz',mergeMode:'three',score:65610,highestTile:6561,bottles:Object.fromEntries(ids.map(id=>[id,{score:65610,highestTile:6561}])),flaskRecord:{epoch:2,score:65610,highestTile:6561},recordCelebrations:{classic:65610}};
 values.set('squish-pocket-achievements-v1:three',JSON.stringify(old));
 const rounds=ids.map(id=>{const e=new Engine(42,id,'three');delete e.achievementEpoch;e.score=65610;e.highestLevel=8;e.shots=200;values.set('squish-pocket-v1:three'+(id==='classic'?'':':'+id),JSON.stringify({version:1,engine:e,started:true,best:65610}));return e;});
 const storage={getItem:k=>values.get(k)},fresh=loadProfile(storage,'three');
 assert.equal(fresh.id,id);assert.equal(fresh.token,token);assert.equal(fresh.name,'zzz');assert.equal(fresh.achievementEpoch,2);assert.equal(fresh.score,0);assert.equal(fresh.highestTile,1);assert.deepEqual(fresh.bottles,{});assert.deepEqual(fresh.recordCelebrations,{});
 for(const old of rounds){
  const resumed=Engine.restore(JSON.parse(JSON.stringify(old)));assert.equal(resumed.achievementEpoch,1);assert.equal(resumed.score,65610);assert.equal(resumed.shots,200);
  assert.equal(captureProgress(fresh,resumed,65610),false);assert.equal(roundRecords(fresh,null,resumed).personalBest,0);
 }
 const current=new Engine(42,'classic','three');current.score=9;current.highestLevel=2;assert.ok(captureProgress(fresh,current,0));assert.equal(fresh.score,9);
 values.set('squish-pocket-achievements-v1:three',JSON.stringify(fresh));assert.equal(loadProfile(storage,'three').score,9);
 values.set('squish-pocket-achievements-v1',JSON.stringify({...old,mergeMode:'two',score:4096,highestTile:2048,bottles:{classic:{score:4096,highestTile:2048}},flaskRecord:{epoch:2,score:0,highestTile:2}}));
 assert.equal(loadProfile(storage,'two').score,4096);
});


test('official water-conical personal reset excludes old saves but preserves other bottles, overall best and Three Combine',async t=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'location');Object.defineProperty(globalThis,'location',{configurable:true,writable:true,value:{hostname:'squish.chemisgreat.online'}});t.after(()=>old?Object.defineProperty(globalThis,'location',old):delete globalThis.location);
 const id='conical-flask-water',key='squish-pocket-achievements-v1';
 const profile={id:crypto.randomUUID(),token:crypto.randomUUID(),name:'Friend',mergeMode:'two',score:800,highestTile:2048,bottles:{[id]:{score:800,highestTile:2048},'conical-flask':{score:400,highestTile:128}},recordCelebrations:{[id]:800}};
 const oldEngine=new Engine(42,id);delete oldEngine.waterConicalRecordEpoch;oldEngine.score=800;oldEngine.highestLevel=10;
 const values=new Map([[key,JSON.stringify(profile)],['squish-pocket-v1:'+id,JSON.stringify({version:1,engine:oldEngine})]]),storage={getItem:k=>values.get(k)};
 const loaded=loadProfile(storage,'two');assert.equal(loaded.waterConicalRecordEpoch,2);assert.equal(loaded.bottles[id],undefined);assert.equal(loaded.recordCelebrations[id],undefined);assert.equal(loaded.score,800);assert.equal(loaded.highestTile,2048);assert.equal(loaded.bottles['conical-flask'].score,400);
 const restored=Engine.restore(JSON.parse(JSON.stringify(oldEngine)));assert.equal(restored.waterConicalRecordEpoch,1);assert.equal(restored.score,800);
 captureProgress(loaded,restored);assert.equal(loaded.bottles[id],undefined);assert.equal(roundRecords(loaded,null,restored).personalBest,0);
 const fresh=new Engine(7,id);assert.equal(fresh.waterConicalRecordEpoch,2);fresh.score=40;fresh.highestLevel=3;captureProgress(loaded,fresh);assert.equal(loaded.bottles[id].score,40);assert.equal(loaded.bottles[id].highestTile,16);
 captureProgress(loaded,restored);assert.equal(loaded.bottles[id].score,40);values.set(key,JSON.stringify(loaded));assert.equal(loadProfile(storage,'two').bottles[id].score,40);
 const three={...profile,mergeMode:'three',achievementEpoch:2,score:81,highestTile:27,bottles:{[id]:{score:81,highestTile:27}}};values.set(key+':three',JSON.stringify(three));assert.equal(loadProfile(storage,'three').bottles[id].score,81);
 globalThis.location={hostname:'squish-test.chemisgreat.online'};values.set(key,JSON.stringify(profile));assert.equal(loadProfile(storage,'two').bottles[id].score,800);assert.equal(new Engine(7,id).waterConicalRecordEpoch,1);
});
