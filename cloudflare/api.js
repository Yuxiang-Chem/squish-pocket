import {roomsAPI} from './rooms-api.js';
const RECIPIENT = 'chem.xjtlu@gmail.com';
const BOTTLES = new Set(['classic', 'lab-flask']);
const bottleName = bottle => bottle === 'lab-flask' ? 'Three-neck flask' : 'Original bottle';
const bottleOf = value => {
  if (value == null || value === '') return 'classic';
  if (!BOTTLES.has(value)) fail('Choose a valid bottle.', 400);
  return value;
};
const RECORD = `SELECT player_scores.id, player_scores.name, player_scores.best_score, player_scores.highest_tile
  FROM bottle_record JOIN player_scores
  ON player_scores.id = bottle_record.player_id AND player_scores.bottle = bottle_record.bottle
  WHERE bottle_record.bottle = ?`;
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

async function summary(env, playerId, bottle) {
  const results = await env.ACHIEVEMENTS.batch([
    env.ACHIEVEMENTS.prepare('SELECT COUNT(*) AS count FROM player_scores WHERE bottle = ? AND highest_tile >= 2048').bind(bottle),
    env.ACHIEVEMENTS.prepare(RECORD).bind(bottle),
    env.ACHIEVEMENTS.prepare('SELECT MAX(highest_tile) AS tile FROM player_scores WHERE bottle = ?').bind(bottle),
    env.ACHIEVEMENTS.prepare('SELECT best_score AS score, highest_tile AS highestTile FROM player_scores WHERE id = ? AND bottle = ?').bind(playerId ?? '', bottle)
  ]);
  const winner = results[1].results[0];
  return {
    bottle,
    reached2048: results[0].results[0].count,
    highestTile: results[2].results[0].tile ?? 2,
    record: winner ? {name: winner.name, score: winner.best_score, highestTile: winner.highest_tile} : null,
    isRecordHolder: !!winner && winner.id === playerId,
    ...(playerId ? {personal: results[3].results[0] ?? null} : {}),
    emailReady: !!env.EMAIL && env.EMAIL_ENABLED === 'true'
  };
}

async function submit(request, env) {
  const {id, hash} = await identity(request), data = await body(request);
  const bottle = bottleOf(data.bottle);
  const {score, highestTile} = data;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name || name.length > 32 || /[\u0000-\u001f\u007f]/.test(name)) fail('Choose a name of 1–32 characters.', 400);
  if (!Number.isSafeInteger(score) || score < 0 || score > 1000000000 || score % 4 !== 0 ||
      !Number.isInteger(highestTile) || highestTile < 2 || highestTile > 4096 || (highestTile & (highestTile - 1))) fail('Invalid achievement.', 400);
  const now = Date.now();
  // The token predicate protects existing identities. Scores are stored per
  // bottle. MAX preserves that bottle's achievements across rounds and tabs.
  const identityResult = await env.ACHIEVEMENTS.prepare(`INSERT INTO players (id, token_hash, name, best_score, highest_tile, best_at, created_at)
    VALUES (?, ?, ?, 0, 2, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name
    WHERE players.token_hash = excluded.token_hash`).bind(id, hash, name, now, now).run();
  if (!identityResult.meta.changes) fail('This player identity could not be verified.', 403);
  await env.ACHIEVEMENTS.prepare('UPDATE player_scores SET name = ? WHERE id = ?').bind(name, id).run();
  const result = await env.ACHIEVEMENTS.prepare(`INSERT INTO player_scores (id, bottle, token_hash, name, best_score, highest_tile, best_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, bottle) DO UPDATE SET name = excluded.name,
      best_at = CASE WHEN excluded.best_score > player_scores.best_score THEN excluded.best_at ELSE player_scores.best_at END,
      best_score = MAX(player_scores.best_score, excluded.best_score),
      highest_tile = MAX(player_scores.highest_tile, excluded.highest_tile)
    WHERE player_scores.token_hash = excluded.token_hash`).bind(id, bottle, hash, name, score, highestTile, now, now).run();
  if (!result.meta.changes) fail('This player identity could not be verified.', 403);
  return json(await summary(env, id, bottle));
}

async function sendMessage(request, env) {
  const {id, hash} = await identity(request), data = await body(request);
  const bottle = bottleOf(data.bottle);
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  const replyTo = typeof data.replyTo === 'string' ? data.replyTo.trim() : '';
  if (!message || message.length > 2000) fail('Write a message of 1–2,000 characters.', 400);
  if (replyTo && (replyTo.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(replyTo))) fail('Enter a valid reply email, or leave it blank.', 400);
  const player = await env.ACHIEVEMENTS.prepare('SELECT id FROM players WHERE id = ? AND token_hash = ?').bind(id, hash).first();
  if (!player) fail('This player identity could not be verified.', 403);
  if (!env.EMAIL || env.EMAIL_ENABLED !== 'true') fail('Email is not available yet. Your message has not been sent.', 503);
  const now = Date.now(), messageId = crypto.randomUUID(), day = Math.floor(now / 86400000);
  // Check ownership again as part of the INSERT, rather than trusting the UI.
  const claim = await env.ACHIEVEMENTS.prepare(`INSERT INTO bottle_messages (id, player_id, bottle, day, score, message, reply_to, created_at)
    SELECT ?, id, ?, ?, best_score, ?, ?, ? FROM (${RECORD}) WHERE id = ?
    ON CONFLICT(player_id, bottle, day) DO NOTHING RETURNING score`).bind(messageId, bottle, day, message, replyTo || null, now, bottle, id).all();
  if (!claim.results.length) {
    const winner = await env.ACHIEVEMENTS.prepare(RECORD).bind(bottle).first();
    if (winner?.id !== id) fail('Only the current highest-score holder can send a message.', 403);
    fail('You can send one message per day. Please try again tomorrow (UTC).', 429);
  }
  const score = claim.results[0].score;
  try {
    const player = await env.ACHIEVEMENTS.prepare('SELECT name, highest_tile FROM player_scores WHERE id = ? AND bottle = ?').bind(id, bottle).first();
    const text = `Squish Pocket record holder (${bottleName(bottle)}): ${player.name}\nHighest score: ${score}\nHighest tile: ${player.highest_tile}\n${replyTo ? `Reply email: ${replyTo}\n` : ''}\n${message}`;
    const result = await env.EMAIL.send({from: env.EMAIL_FROM, to: RECIPIENT,
      ...(replyTo ? {replyTo} : {}), subject: `Squish Pocket · ${bottleName(bottle)} · a message from the record holder (${score})`,
      text, html: `<div style="white-space:pre-wrap">${escapeHTML(text)}</div>`});
    if (!result?.messageId) throw new Error('Email provider did not accept the message');
  } catch {
    await env.ACHIEVEMENTS.prepare('DELETE FROM bottle_messages WHERE id = ?').bind(messageId).run();
    console.error(JSON.stringify({event: 'record_email_failed'}));
    fail('Email delivery failed. Your message is still here; please try again.', 502);
  }
  try { await env.ACHIEVEMENTS.prepare("UPDATE bottle_messages SET status = 'sent' WHERE id = ?").bind(messageId).run(); }
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
        if (request.method === 'GET') return json(await summary(env, null, bottleOf(url.searchParams.get('bottle'))));
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
