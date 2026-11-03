import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../api.js';

// Execute the actual parameterized statements against SQLite, D1's SQL engine.
function setup() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_achievements.sql', import.meta.url), 'utf8'));
  const db = {prepare(query) {
    return {values: [], bind(...values) { this.values = values; return this; },
      async run() { const result = sql.prepare(query).run(...this.values); return {meta: {changes: result.changes}}; },
      async all() { return {results: sql.prepare(query).all(...this.values)}; },
      async first() { return sql.prepare(query).get(...this.values) ?? null; }
    };
  }, async batch(statements) { return Promise.all(statements.map(s => s.all())); }};
  const emails = [];
  const env = {ACHIEVEMENTS: db, EMAIL_ENABLED: 'true', EMAIL_FROM: 'records@chemisgreat.online',
    EMAIL: {async send(message) { emails.push(message); return {messageId: crypto.randomUUID()}; }}};
  const player = () => ({id: crypto.randomUUID(), token: crypto.randomUUID()});
  async function request(path, data, identity, extraHeaders = {}) {
    const response = await worker.fetch(new Request(`https://game.example${path}`, {
      method: data ? 'POST' : 'GET', headers: {'Content-Type': 'application/json',
        ...(identity ? {'X-Player-Id': identity.id, Authorization: `Bearer ${identity.token}`} : {}), ...extraHeaders},
      ...(data ? {body: JSON.stringify(data)} : {})
    }), env);
    return {status: response.status, data: await response.json()};
  }
  const submit = (identity, score = 2048, highestTile = 2048, name = 'Squishy') => request('/api/achievements', {score, highestTile, name}, identity);
  return {env, emails, sql, player, request, submit};
}

test('counts unique achievers, keeps milestones and best across restarts and out-of-order updates', async () => {
  const t = setup(), a = t.player(), b = t.player();
  const empty = await t.request('/api/achievements');
  assert.equal(empty.data.reached2048, 0); assert.equal(empty.data.record, null);
  await t.submit(a); await t.submit(a);
  const reset = await t.submit(a, 0, 2);
  assert.equal(reset.data.personal.score, 2048); assert.equal(reset.data.personal.highestTile, 2048);
  let result = await t.request('/api/achievements');
  assert.equal(result.data.reached2048, 1); assert.equal(result.data.record.score, 2048);
  await t.submit(b, 3000, 1024);
  result = await t.submit(b, 4096, 4096);
  assert.equal(result.data.reached2048, 2); assert.equal(result.data.highestTile, 4096);
  assert.equal(result.data.record.score, 4096); assert.equal(result.data.isRecordHolder, true);
  const publicSummary = await t.request('/api/achievements');
  assert.equal(JSON.stringify(publicSummary.data).includes(a.token), false);
  assert.equal(JSON.stringify(publicSummary.data).includes(a.id), false);
});

test('tie keeps first holder; a new high score transfers message permission', async () => {
  const t = setup(), a = t.player(), b = t.player();
  await t.submit(a, 2000, 1024, 'First');
  assert.equal((await t.submit(b, 2000, 2048, 'Second')).data.isRecordHolder, false);
  assert.equal((await t.submit(a, 2000, 1024)).data.isRecordHolder, true);
  await t.submit(b, 2004, 2048);
  assert.equal((await t.request('/api/record-message', {message: 'Hello'}, a)).status, 403);
  assert.equal((await t.request('/api/record-message', {message: 'I did it!'}, b)).status, 200);
});

test('existing identity cannot be overwritten or used to send by another token', async () => {
  const t = setup(), a = t.player(), forged = {...a, token: crypto.randomUUID()};
  await t.submit(a);
  assert.equal((await t.submit(forged, 4096)).status, 403);
  assert.equal((await t.request('/api/record-message', {message: 'Fake'}, forged)).status, 403);
  assert.equal((await t.request('/api/achievements')).data.record.score, 2048);
});

test('message sends from server to fixed inbox, supports reply address and escapes HTML', async () => {
  const t = setup(), a = t.player(); await t.submit(a, 2048, 2048, '<b>Friend</b>');
  const result = await t.request('/api/record-message', {message: '<script>Hello</script>', replyTo: 'friend@example.com', to: 'attacker@example.com'}, a);
  assert.equal(result.status, 200); assert.equal(result.data.sent, true);
  assert.equal(t.emails.length, 1); assert.equal(t.emails[0].to, 'chem.xjtlu@gmail.com');
  assert.equal(t.emails[0].replyTo, 'friend@example.com');
  assert.match(t.emails[0].text, /Highest score: 2048/);
  assert.match(t.emails[0].html, /&lt;script&gt;Hello&lt;\/script&gt;/);
  assert.equal((await t.request('/api/record-message', {message: 'Again'}, a)).status, 429);
  assert.equal(t.emails.length, 1);
});

test('provider failure releases daily claim and unavailable email never claims success', async () => {
  const t = setup(), a = t.player(); await t.submit(a);
  t.env.EMAIL_ENABLED = 'false';
  assert.equal((await t.request('/api/record-message', {message: 'Hi'}, a)).status, 503);
  t.env.EMAIL_ENABLED = 'true'; const send = t.env.EMAIL.send;
  t.env.EMAIL.send = async () => { throw new Error('Provider failed'); };
  assert.equal((await t.request('/api/record-message', {message: 'Hi'}, a)).status, 502);
  t.env.EMAIL.send = send;
  assert.equal((await t.request('/api/record-message', {message: 'Retry'}, a)).status, 200);
});

test('rejects invalid records, oversized messages and cross-origin requests', async () => {
  const t = setup(), a = t.player();
  assert.equal((await t.submit(a, -4)).status, 400);
  assert.equal((await t.submit(a, 2049)).status, 400);
  assert.equal((await t.submit(a, 2048, 2049)).status, 400);
  assert.equal((await t.submit(a, 2048, 2048, 'a'.repeat(33))).status, 400);
  await t.submit(a);
  assert.equal((await t.request('/api/record-message', {message: 'a'.repeat(2001)}, a)).status, 400);
  assert.equal((await t.request('/api/record-message', {message: 'Hello', replyTo: 'x\r\nBcc: x@test.com'}, a)).status, 400);
  assert.equal((await t.request('/api/record-message', {message: 'a'.repeat(9000)}, a)).status, 413);
  assert.equal((await t.request('/api/achievements', null, null, {Origin: 'https://evil.example'})).status, 403);
});
