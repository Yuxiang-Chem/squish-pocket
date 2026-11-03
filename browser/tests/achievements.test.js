import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {loadProfile, captureProgress, Achievements} from '../dist/achievements.js';

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
  const flask = new Engine(321, 'lab-flask'); flask.score = 4000; flask.highestLevel = 11;
  assert.equal(captureProgress(profile, flask, 4000), true);
  assert.equal(profile.score, 512); assert.equal(profile.highestTile, 2048);
  assert.equal(profile.bottles.classic.score, 512);
  assert.equal(profile.bottles['lab-flask'].score, 4000);
  assert.equal(profile.bottles['lab-flask'].highestTile, 4096);
  assert.equal(captureProgress(profile, new Engine(654), 100), false);
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
  const legacy = {...broken, score:4096, highestTile:2048}; delete legacy.bottles;
  const loaded = loadProfile({getItem: () => JSON.stringify(legacy)});
  assert.equal(loaded.id, broken.id); assert.equal(loaded.score, 4096);
  assert.equal(loaded.bottles.classic.highestTile, 2048);
  assert.equal(loaded.bottles['lab-flask'].score, 0);
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
