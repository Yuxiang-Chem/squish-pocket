import {test} from 'node:test';
import assert from 'node:assert/strict';
import {labFlask} from '../dist/lab-flask.js';
import {resetFlaskBest, roundRecords, visibleFlaskScore} from '../dist/achievements.js';

test('a blob pushed into the center neck stays inside the three-neck flask', () => {
  const nodes = [];
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2;
    const x = 180 + Math.cos(angle) * 70, y = 190 + Math.sin(angle) * 70;
    nodes.push({x, y, px: x, py: y, bottleSide: labFlask.contains(x, y)});
  }
  const body = {x: 180, y: 190, nodes, inBottle: true, hasEntered: true, spilled: false, age: 6};
  labFlask.bottleWalls(body);
  for (const p of body.nodes) { p.y -= 20; p.py -= 20; }
  body.y = 170;
  labFlask.bottleWalls(body);
  const escaped = nodes.filter(p => p.x > 140 && p.x < 220 && (p.y < 106 || (p.bottleSide === false && !labFlask.contains(p.x, p.y))));
  assert.equal(escaped.length, 0);
  for (const p of nodes) if (p.bottleSide) assert.equal(labFlask.contains(p.x, p.y, .05), true);
});

test('the three-neck highest score is cleared once and a shared copy does not return', () => {
  const stored = new Map();
  const storage = {
    getItem: key => stored.has(key) ? stored.get(key) : null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key)
  };
  storage.setItem('squish-pocket-achievements-v1', JSON.stringify({
    id: '11111111-1111-4111-8111-111111111111', token: '22222222-2222-4222-8222-222222222222',
    name: 'A squishy friend', score: 900, highestTile: 64,
    bottles: {classic: {score: 40, highestTile: 16}, 'lab-flask': {score: 900, highestTile: 64}}
  }));
  storage.setItem('squish-pocket-v1:lab-flask', JSON.stringify({version: 1, best: 900, engine: {bottleId: 'lab-flask', score: 900}}));
  storage.setItem('squish-pocket-v1', JSON.stringify({version: 1, best: 40, engine: {bottleId: 'classic', score: 40}}));
  const first = resetFlaskBest(storage);
  assert.equal(first.baseline['lab-flask'], 900);
  assert.equal(storage.getItem('squish-pocket-v1:lab-flask'), null);
  assert.equal(JSON.parse(storage.getItem('squish-pocket-achievements-v1')).bottles['lab-flask'].score, 0);
  assert.equal(JSON.parse(storage.getItem('squish-pocket-v1')).best, 40);
  storage.setItem('squish-pocket-v1:lab-flask', JSON.stringify({version: 1, best: 12, engine: {score: 12}}));
  assert.equal(resetFlaskBest(storage).baseline['lab-flask'], 900);
  assert.equal(storage.getItem('squish-pocket-v1:lab-flask'), JSON.stringify({version: 1, best: 12, engine: {score: 12}}));
  const engine = {bottleId: 'lab-flask', score: 0};
  const profile = {bottles: {'lab-flask': {score: 0}}};
  const summary = {bottles: {'lab-flask': {personal: {score: 900}, record: {score: 1200}}}};
  assert.equal(roundRecords(profile, summary, engine, first.baseline).personalBest, 0);
  assert.equal(roundRecords(profile, summary, engine, first.baseline).worldBest, 1200);
  assert.equal(visibleFlaskScore('lab-flask', 16, 900, first.baseline), 16);
  assert.equal(visibleFlaskScore('classic', 40, 40, first.baseline), 40);
});
