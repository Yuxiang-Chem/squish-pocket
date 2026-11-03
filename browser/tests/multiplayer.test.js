import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {RoomClient} from '../dist/room-client.js';

test('same multiplayer room seed produces identical starting racks and incoming sequences on both bottles', () => {
  for (const bottleId of ['classic', 'lab-flask']) {
    const a = new Engine(987654321, bottleId);
    const b = new Engine(987654321, bottleId);
    assert.deepEqual(a.rackOrder(), b.rackOrder());
    assert.deepEqual(a.incoming, b.incoming);
    a.shoot(0, 0.5, true);
    b.shoot(0, 0.5, true);
    assert.deepEqual(a.rackOrder(), b.rackOrder());
    assert.deepEqual(a.incoming, b.incoming);
  }
});

test('RoomClient creates, joins, normalizes codes, and publishes match progress over WebSocket', async t => {
  const sent = [], statuses = [], rooms = [];
  const storage = new Map();
  const savedWindow = globalThis.window, savedLocation = globalThis.location, savedStorage = globalThis.localStorage, savedWS = globalThis.WebSocket;
  class FakeWebSocket {
    static OPEN = 1;
    constructor(url) {
      this.url = String(url);
      this.readyState = FakeWebSocket.OPEN;
      queueMicrotask(() => this.onopen?.());
    }
    send(payload) { sent.push(JSON.parse(payload)); }
    close(code, reason) { this.readyState = 3; this.onclose?.({code, reason}); }
  }
  Object.defineProperty(globalThis, 'window', {configurable: true, writable: true, value: {addEventListener(){}}});
  Object.defineProperty(globalThis, 'location', {configurable: true, writable: true, value: new URL('https://squish.chemisgreat.online/')});
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, writable: true, value: {
    getItem: k => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k)
  }});
  Object.defineProperty(globalThis, 'WebSocket', {configurable: true, writable: true, value: FakeWebSocket});
  t.after(() => {
    Object.defineProperty(globalThis, 'window', {configurable: true, writable: true, value: savedWindow});
    Object.defineProperty(globalThis, 'location', {configurable: true, writable: true, value: savedLocation});
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, writable: true, value: savedStorage});
    Object.defineProperty(globalThis, 'WebSocket', {configurable: true, writable: true, value: savedWS});
  });

  const calls = [];
  t.mock.method(globalThis, 'fetch', async (path, options = {}) => {
    calls.push({path, method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : null});
    if (path === '/api/rooms') return Response.json({code: 'ABC234'});
    if (path === '/api/rooms/ABC234/join') return Response.json({code: 'ABC234'});
    if (path === '/api/rooms/ABC234/session') {
      return Response.json({
        code: 'ABC234', bottleId: 'lab-flask', phase: 'playing', round: 1, seed: 42, you: 0,
        players: [{name: 'Host', score: 0, status: 'playing', connected: true, blobs: []}, {name: 'Guest', score: 0, status: 'playing', connected: true, blobs: []}]
      });
    }
    if (path === '/api/rooms/ABC234/leave') return Response.json({left: true});
    return Response.json({error: 'Not found'}, {status: 404});
  });

  const client = new RoomClient({
    onRoom: (room, connected) => rooms.push({room, connected}),
    onStatus: (state, message) => statuses.push({state, message}),
    getProgress: room => ({round: room.round, score: 128, shots: 3, highestTile: 32, done: false, paused: false, blobs: []})
  });

  await assert.rejects(() => client.join('Guest', 'bad'), /six-character/);
  await client.create('Host', 'lab-flask');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(client.connected, true);
  assert.equal(storage.get('squish-pocket-last-room'), 'ABC234');
  client.publish();
  assert.equal(sent.at(-1).type, 'progress');
  assert.equal(sent.at(-1).score, 128);
  await client.leave();
  assert.equal(client.connected, false);
  assert.equal(storage.has('squish-pocket-last-room'), false);
  assert.deepEqual(calls.map(c => `${c.method} ${c.path}`), [
    'POST /api/rooms',
    'GET /api/rooms/ABC234/session',
    'POST /api/rooms/ABC234/leave'
  ]);
});
