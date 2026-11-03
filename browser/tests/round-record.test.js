import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_ROUND_KEY, FLASK_RERECORD_FLAG, FLASK_ROUND_KEY, classicPlayLabel, classicSaveNote, pauseFootnote,
  readRound, rerecordFlaskRound, roundSaveKey, savedRoundReady, writeRound
} from '../dist/round-record.js';

function memory() {
  const stored = new Map();
  return {
    stored,
    getItem: key => stored.has(key) ? stored.get(key) : null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key)
  };
}

const flaskRecord = {
  version: 1, started: true, best: 900, sound: false,
  engine: {bottleId: 'lab-flask', over: false, score: 900}
};
const classicRecord = {
  version: 1, started: true, best: 40, sound: true,
  engine: {bottleId: 'classic', over: false, score: 40}
};

test('an existing three-neck round is cleared once, then recording resumes', () => {
  const storage = memory();
  storage.setItem(FLASK_ROUND_KEY, JSON.stringify(flaskRecord));
  storage.setItem(CLASSIC_ROUND_KEY, JSON.stringify(classicRecord));
  assert.equal(roundSaveKey('lab-flask'), FLASK_ROUND_KEY);
  assert.equal(roundSaveKey('classic'), CLASSIC_ROUND_KEY);
  assert.equal(rerecordFlaskRound(storage), true);
  assert.equal(storage.getItem(FLASK_ROUND_KEY), null);
  assert.equal(storage.getItem(FLASK_RERECORD_FLAG), '1');
  assert.deepEqual(readRound(storage, 'classic'), classicRecord);
  assert.equal(readRound(storage, 'lab-flask'), null);

  const next = {...flaskRecord, best: 12, engine: {...flaskRecord.engine, score: 12}};
  assert.equal(writeRound(storage, 'lab-flask', next), true);
  assert.equal(rerecordFlaskRound(storage), false);
  assert.deepEqual(readRound(storage, 'lab-flask'), next);
  assert.deepEqual(readRound(storage, 'classic'), classicRecord);
  assert.equal(savedRoundReady('lab-flask', readRound(storage, 'lab-flask')), true);
  assert.equal(savedRoundReady('classic', readRound(storage, 'classic')), true);
  assert.equal(classicPlayLabel('lab-flask', true), 'Continue Classic');
  assert.equal(classicPlayLabel('lab-flask', false), 'Play Classic');
  assert.equal(classicPlayLabel('classic', true), 'Continue Classic');
  assert.equal(classicPlayLabel('classic', false), 'Play Classic');
  assert.match(classicSaveNote('lab-flask', true), /saved pile is ready/);
  assert.match(classicSaveNote('lab-flask', true), /stays saved/);
  assert.match(classicSaveNote('lab-flask', false), /keeps its own saved round/);
  assert.match(classicSaveNote('classic', false), /keeps its own saved round/);
  assert.equal(pauseFootnote('lab-flask'), 'SAVED IN THIS BROWSER.');
  assert.equal(pauseFootnote('classic'), 'SAVED IN THIS BROWSER.');
});

test('a finished or unstarted round is not offered as Continue', () => {
  assert.equal(savedRoundReady('classic', {...classicRecord, started: false}), false);
  assert.equal(savedRoundReady('classic', {...classicRecord, engine: {...classicRecord.engine, over: true}}), false);
  assert.equal(savedRoundReady('lab-flask', {...flaskRecord, started: false}), false);
  assert.equal(savedRoundReady('lab-flask', {...flaskRecord, engine: {...flaskRecord.engine, over: true}}), false);
  const legacy = {...classicRecord, engine: {over: false}};
  delete legacy.engine.bottleId;
  assert.equal(savedRoundReady('classic', legacy), true);
  assert.equal(savedRoundReady('lab-flask', legacy), false);
  assert.equal(writeRound(memory(), 'unknown', classicRecord), false);
  const blocked = {getItem() { throw new Error('blocked'); }, setItem() {}, removeItem() {}};
  assert.equal(rerecordFlaskRound(blocked), false);
  assert.equal(readRound(blocked, 'lab-flask'), null);
});
