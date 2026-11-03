import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_ROUND_KEY, RETIRED_ROUND_KEYS, classicPlayLabel, classicSaveNote, pauseFootnote,
  forgetRetiredRounds, readRound, roundSaveKey, savedRoundReady, writeRound
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

test('the three-neck flask has no saved round, and an old flask record is removed', () => {
  const storage = memory();
  storage.setItem(RETIRED_ROUND_KEYS[0], JSON.stringify(flaskRecord));
  storage.setItem(CLASSIC_ROUND_KEY, JSON.stringify(classicRecord));
  assert.equal(roundSaveKey('lab-flask'), null);
  assert.equal(roundSaveKey('classic'), CLASSIC_ROUND_KEY);
  assert.equal(savedRoundReady('lab-flask', flaskRecord), false);
  assert.equal(writeRound(storage, 'lab-flask', {...flaskRecord, best: 1}), false);
  assert.equal(storage.getItem(RETIRED_ROUND_KEYS[0]), JSON.stringify(flaskRecord));
  forgetRetiredRounds(storage);
  assert.equal(storage.getItem(RETIRED_ROUND_KEYS[0]), null);
  assert.deepEqual(readRound(storage, 'classic'), classicRecord);
  assert.equal(readRound(storage, 'lab-flask'), null);
  assert.equal(savedRoundReady('classic', readRound(storage, 'classic')), true);
  assert.equal(classicPlayLabel('lab-flask', true), 'Play Classic');
  assert.equal(classicPlayLabel('classic', true), 'Continue Classic');
  assert.equal(classicPlayLabel('classic', false), 'Play Classic');
  assert.match(classicSaveNote('lab-flask', true), /starts fresh/);
  assert.doesNotMatch(classicSaveNote('lab-flask', true), /saved round/);
  assert.match(classicSaveNote('classic', true), /saved pile is ready/);
  assert.match(classicSaveNote('classic', false), /original bottle keeps its round/);
  assert.match(pauseFootnote('lab-flask'), /STARTS FRESH/);
  assert.equal(pauseFootnote('classic'), 'SAVED IN THIS BROWSER.');
});

test('a finished or unstarted original-bottle round is not offered as Continue', () => {
  assert.equal(savedRoundReady('classic', {...classicRecord, started: false}), false);
  assert.equal(savedRoundReady('classic', {...classicRecord, engine: {...classicRecord.engine, over: true}}), false);
  const legacy = {...classicRecord, engine: {over: false}};
  delete legacy.engine.bottleId;
  assert.equal(savedRoundReady('classic', legacy), true);
  assert.equal(writeRound(memory(), 'unknown', classicRecord), false);
});
