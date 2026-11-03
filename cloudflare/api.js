import {roomsAPI} from './rooms-api.js';
const RECIPIENT = 'chem.xjtlu@gmail.com';
const RECORD = 'SELECT players.* FROM players JOIN world_record ON world_record.player_id = players.id WHERE world_record.slot = 1';
const json = (body, status = 200) => Response.json(body, {status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
}});
const fail = (message, status) => { throw Object.assign(new Error(message), {status}); };
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const escapeHTML = text => text.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

async function identity(request) {
  const id = request.headers.get('X-Player-Id'), token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!uuid(id) || !uuid(token)) fail('Your player identity is missing. Reload and try again.', 401);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return {id, hash: Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('')};
}

async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail('Expected JSON.', 415);
  // Limit the actual stream, not just the caller-supplied Content-Length.
  const reader = request.body?.getReader();
  if (!reader) fail('A message is required.', 400);
  let text = '', size = 0; const decoder = new TextDecoder();
  while (true) {
    const {done, value} = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); fail('Message is too long.', 413); }
    text += decoder.decode(value, {stream: true});
  }
  try { const data = JSON.parse(text + decoder.decode()); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data; }
  catch { fail('Invalid JSON.', 400); }
}

async function summary(env, playerId) {
  const results = await env.ACHIEVEMENTS.batch([
    env.ACHIEVEMENTS.prepare('SELECT COUNT(*) AS count FROM players WHERE highest_tile >= 2048'),
    env.ACHIEVEMENTS.prepare(RECORD),
    env.ACHIEVEMENTS.prepare('SELECT MAX(highest_tile) AS tile FROM players'),
    env.ACHIEVEMENTS.prepare('SELECT best_score AS score, highest_tile AS highestTile FROM players WHERE id = ?').bind(playerId ?? '')
  ]);
  const winner = results[1].results[0];
  return {
    reached2048: results[0].results[0].count,
    highestTile: results[2].results[0].tile ?? 2,
    record: winner ? {name: winner.name, score: winner.best_score, highestTile: winner.highest_tile} : null,
    isRecordHolder: !!winner && winner.id === playerId,
    ...(playerId ? {personal: results[3].results[0]} : {}),
    emailReady: !!env.EMAIL && env.EMAIL_ENABLED === 'true'
  };
}

async function submit(request, env) {
  const {id, hash} = await identity(request), data = await body(request);
  const {score, highestTile} = data;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name || name.length > 32 || /[\u0000-\u001f\u007f]/.test(name)) fail('Choose a name of 1–32 characters.', 400);
  if (!Number.isSafeInteger(score) || score < 0 || score > 1000000000 || score % 4 !== 0 ||
      !Number.isInteger(highestTile) || highestTile < 2 || highestTile > 4096 || (highestTile & (highestTile - 1))) fail('Invalid achievement.', 400);
  const now = Date.now();
  // The token predicate protects existing identities. MAX preserves achievements
  // across new rounds, retries, and concurrent tabs. Ties keep the first holder.
  const result = await env.ACHIEVEMENTS.prepare(`INSERT INTO players (id, token_hash, name, best_score, highest_tile, best_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name,
      best_at = CASE WHEN excluded.best_score > players.best_score THEN excluded.best_at ELSE players.best_at END,
      best_score = MAX(players.best_score, excluded.best_score),
      highest_tile = MAX(players.highest_tile, excluded.highest_tile)
    WHERE players.token_hash = excluded.token_hash`).bind(id, hash, name, score, highestTile, now, now).run();
  if (!result.meta.changes) fail('This player identity could not be verified.', 403);
  return json(await summary(env, id));
}

async function sendMessage(request, env) {
  const {id, hash} = await identity(request), data = await body(request);
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  const replyTo = typeof data.replyTo === 'string' ? data.replyTo.trim() : '';
  if (!message || message.length > 2000) fail('Write a message of 1–2,000 characters.', 400);
  if (replyTo && (replyTo.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(replyTo))) fail('Enter a valid reply email, or leave it blank.', 400);
  const player = await env.ACHIEVEMENTS.prepare('SELECT id FROM players WHERE id = ? AND token_hash = ?').bind(id, hash).first();
  if (!player) fail('This player identity could not be verified.', 403);
  if (!env.EMAIL || env.EMAIL_ENABLED !== 'true') fail('Email is not available yet. Your message has not been sent.', 503);
  const now = Date.now(), messageId = crypto.randomUUID(), day = Math.floor(now / 86400000);
  // Check ownership again as part of the INSERT, rather than trusting the UI.
  const claim = await env.ACHIEVEMENTS.prepare(`INSERT INTO record_messages (id, player_id, day, score, message, reply_to, created_at)
    SELECT ?, id, ?, best_score, ?, ?, ? FROM (${RECORD}) WHERE id = ?
    ON CONFLICT(player_id, day) DO NOTHING RETURNING score`).bind(messageId, day, message, replyTo || null, now, id).all();
  if (!claim.results.length) {
    const winner = await env.ACHIEVEMENTS.prepare(RECORD).first();
    if (winner?.id !== id) fail('Only the current highest-score holder can send a message.', 403);
    fail('You can send one message per day. Please try again tomorrow (UTC).', 429);
  }
  const score = claim.results[0].score;
  try {
    const player = await env.ACHIEVEMENTS.prepare('SELECT name, highest_tile FROM players WHERE id = ?').bind(id).first();
    const text = `Squish Pocket record holder: ${player.name}\nHighest score: ${score}\nHighest tile: ${player.highest_tile}\n${replyTo ? `Reply email: ${replyTo}\n` : ''}\n${message}`;
    const result = await env.EMAIL.send({from: env.EMAIL_FROM, to: RECIPIENT,
      ...(replyTo ? {replyTo} : {}), subject: `Squish Pocket · a message from the record holder (${score})`,
      text, html: `<div style="white-space:pre-wrap">${escapeHTML(text)}</div>`});
    if (!result?.messageId) throw new Error('Email provider did not accept the message');
  } catch {
    await env.ACHIEVEMENTS.prepare('DELETE FROM record_messages WHERE id = ?').bind(messageId).run();
    console.error(JSON.stringify({event: 'record_email_failed'}));
    fail('Email delivery failed. Your message is still here; please try again.', 502);
  }
  try { await env.ACHIEVEMENTS.prepare("UPDATE record_messages SET status = 'sent' WHERE id = ?").bind(messageId).run(); }
  catch { console.error(JSON.stringify({event: 'record_email_status_failed'})); }
  return json({sent: true});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      const origin = request.headers.get('Origin');
      if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') fail('Please use the game to access achievements.', 403);
      if (url.pathname==='/api/rooms'||url.pathname.startsWith('/api/rooms/')) return await roomsAPI(request,env,body);
      if (!env.ACHIEVEMENTS) fail('Shared achievements are not available yet.', 503);
      if (url.pathname === '/api/achievements') {
        if (request.method === 'GET') return json(await summary(env));
        if (request.method === 'POST') return await submit(request, env);
      }
      if (url.pathname === '/api/record-message' && request.method === 'POST') return await sendMessage(request, env);
      return json({error: 'Not found.'}, 404);
    } catch (error) {
      if (!error.status) console.error(JSON.stringify({event: 'achievements_failed', path: url.pathname}));
      return json({error: error.status ? error.message : 'Achievements are temporarily unavailable. Please try again.'}, error.status ?? 500);
    }
  }
};
