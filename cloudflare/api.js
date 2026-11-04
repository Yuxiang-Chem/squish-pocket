import {ruleFor,validValue} from '../browser/dist/merge-rules.js';
import {roomsAPI} from './rooms-api.js';
import {FLASK_RECORD_EPOCH,THREE_RECORD_EPOCH,achievementEpochFor} from '../browser/dist/record-epoch.js';
import {MILESTONE_BATCH_SIZE,validMilestoneRun,validMilestoneCount} from '../browser/dist/milestone-totals.js';
const RECIPIENT = 'chem.xjtlu@gmail.com';
const RECORD = 'SELECT players.* FROM players JOIN world_record ON world_record.player_id = players.id WHERE world_record.slot = 1';
const BOTTLE_IDS = ['classic', 'lab-flask', 'classic-water', 'lab-flask-water', 'separating-funnel', 'conical-flask', 'separating-funnel-water', 'conical-flask-water'];
const BOTTLE_NAMES = {all: 'All bottles', classic: 'Original bottle', 'lab-flask': 'Three-neck flask', 'classic-water': 'Original bottle · water', 'lab-flask-water': 'Three-neck flask · water', 'separating-funnel': 'Separating funnel', 'conical-flask': 'Conical flask', 'separating-funnel-water': 'Separating funnel · water', 'conical-flask-water': 'Conical flask · water'};
const validScoreFor = (score,rule) => Number.isSafeInteger(score) && score >= 0 && score <= 1000000000 && score % (rule.count===3?3:4) === 0;
const validTileFor=(tile,rule)=>validValue(tile,rule.id);
function scopedRecords(db){
  return {prepare(sql){return db.prepare(sql.replace(/\b(players|world_record|bottle_scores|bottle_records|record_messages|bottle_messages|flask_current_scores)\b/g,name=>'three_v'+THREE_RECORD_EPOCH+'_'+name));},batch(statements){return db.batch(statements);}};
}
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

function bottleLeaders(db,id){
  const fresh=id==='lab-flask';
  const statement=db.prepare(`SELECT s.player_id,p.name,s.best_score AS score,s.highest_tile AS highestTile
    FROM ${fresh?'flask_current_scores':'bottle_scores'} s JOIN players p ON p.id=s.player_id
    LEFT JOIN bottle_records r ON r.bottle_id=?
    WHERE ${fresh?'':'s.bottle_id=? AND '}s.best_score>0
    ORDER BY s.best_score DESC,CASE WHEN r.player_id=s.player_id THEN 0 ELSE 1 END,s.best_at,s.player_id LIMIT 5`);
  return fresh?statement.bind(id):statement.bind(id,id);
}
const publicLeaders=(rows,playerId)=>rows.map((row,i)=>({rank:i+1,name:row.name,score:row.score,highestTile:row.highestTile,isYou:row.player_id===playerId}));
async function summary(env, playerId) {
  const rule=env.mergeRule??ruleFor();
  const results = await env.ACHIEVEMENTS.batch([
    env.ACHIEVEMENTS.prepare('SELECT COUNT(*) AS count FROM players WHERE highest_tile >= ?').bind(rule.milestone),
    env.ACHIEVEMENTS.prepare(RECORD),
    env.ACHIEVEMENTS.prepare('SELECT MAX(highest_tile) AS tile FROM players'),
    env.ACHIEVEMENTS.prepare('SELECT best_score AS score, highest_tile AS highestTile FROM players WHERE id = ?').bind(playerId ?? ''),
    env.ACHIEVEMENTS.prepare(`SELECT r.bottle_id, r.player_id, p.name, r.score,
      CASE WHEN r.bottle_id = 'lab-flask' THEN f.highest_tile ELSE s.highest_tile END AS highestTile
      FROM bottle_records r JOIN players p ON p.id = r.player_id
      JOIN bottle_scores s ON s.player_id = r.player_id AND s.bottle_id = r.bottle_id
      LEFT JOIN flask_current_scores f ON f.player_id = r.player_id`),
    env.ACHIEVEMENTS.prepare('SELECT bottle_id, MAX(highest_tile) AS tile FROM bottle_scores GROUP BY bottle_id'),
    env.ACHIEVEMENTS.prepare('SELECT bottle_id, best_score AS score, highest_tile AS highestTile FROM bottle_scores WHERE player_id = ?').bind(playerId ?? ''),
    env.ACHIEVEMENTS.prepare('SELECT MAX(highest_tile) AS tile FROM flask_current_scores'),
    env.ACHIEVEMENTS.prepare('SELECT best_score AS score, highest_tile AS highestTile FROM flask_current_scores WHERE player_id = ?').bind(playerId ?? ''),
    env.ACHIEVEMENTS.prepare(`SELECT p.id AS player_id,p.name,p.best_score AS score,p.highest_tile AS highestTile
      FROM players p LEFT JOIN world_record r ON r.slot=1 WHERE p.best_score>0
      ORDER BY p.best_score DESC,CASE WHEN r.player_id=p.id THEN 0 ELSE 1 END,p.best_at,p.id LIMIT 5`),
    ...BOTTLE_IDS.map(id=>bottleLeaders(env.ACHIEVEMENTS,id)),
    env.ACHIEVEMENTS.prepare(`SELECT COALESCE(SUM(merge_count),0) AS total,
      (SELECT started_at FROM milestone_tracking WHERE id=1) AS startedAt
      FROM milestone_runs WHERE merge_mode=? AND achievement_epoch=?`).bind(rule.id,achievementEpochFor(rule.id))
  ]);
  const announcement=rule.id==='three'?await env.ACHIEVEMENTS.prepare('SELECT published_at AS publishedAt, expires_at AS expiresAt FROM three_v2_release_notice WHERE id=1').first():null;
  const winner = results[1].results[0];
  const bottles = Object.fromEntries(BOTTLE_IDS.map((id,index) => {
    const record = results[4].results.find(row => row.bottle_id === id);
    const personal = results[6].results.find(row => row.bottle_id === id);
    return [id, {record: record ? {name: record.name, score: record.score, highestTile: record.highestTile} : null,
      leaderboard:publicLeaders(results[10+index].results,playerId),
      isRecordHolder: !!record && record.player_id === playerId,
      highestTile: (id === 'lab-flask' ? results[7].results[0]?.tile : results[5].results.find(row => row.bottle_id === id)?.tile) ?? rule.start,
      ...(id === 'lab-flask' ? {recordEpoch: FLASK_RECORD_EPOCH,
        ...(playerId ? {recordPersonal: results[8].results[0] ?? {score: 0, highestTile:rule.start}} : {})} : {}),
      ...(playerId ? {personal: {score: id==='lab-flask'?(results[8].results[0]?.score??0):(personal?.score??0), highestTile: personal?.highestTile??rule.start}} : {})}];
  }));
  return {
    bottles,mergeMode:rule.id,...(rule.id==='three'?{achievementEpoch:THREE_RECORD_EPOCH,announcement}:{}),milestone:rule.milestone,reachedMilestone:results[0].results[0].count,
    leaderboard:publicLeaders(results[9].results,playerId),
    totalMilestones:results[10+BOTTLE_IDS.length].results[0].total,
    milestoneTrackingSince:results[10+BOTTLE_IDS.length].results[0].startedAt,
    ...(rule.id==='two'?{reached2048:results[0].results[0].count}:{}),
    highestTile: results[2].results[0].tile ?? rule.start,
    record: winner ? {name: winner.name, score: winner.best_score, highestTile: winner.highest_tile} : null,
    isRecordHolder: !!winner && winner.id === playerId,
    ...(playerId ? {personal: results[3].results[0]} : {}),
    emailReady: !!env.EMAIL && env.EMAIL_ENABLED === 'true'
  };
}

async function submit(request, env) {
  const rule=env.mergeRule??ruleFor(),validScore=score=>validScoreFor(score,rule),validTile=tile=>validTileFor(tile,rule);
  const {id, hash} = await identity(request), data = await body(request);
  if(rule.id==='three'&&data.achievementEpoch!==THREE_RECORD_EPOCH)fail('Three Combine achievements restarted. Refresh the game to join the new board.',409);
  const {score, highestTile} = data;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name || name.length > 32 || /[\u0000-\u001f\u007f]/.test(name)) fail('Choose a name of 1–32 characters.', 400);
  if (!validScore(score) || !validTile(highestTile)) fail('Invalid achievement.', 400);
  const milestoneRuns=data.milestoneRuns===undefined?{}:data.milestoneRuns;
  if(!milestoneRuns||typeof milestoneRuns!=='object'||Array.isArray(milestoneRuns)||Object.keys(milestoneRuns).length>MILESTONE_BATCH_SIZE||
      Object.entries(milestoneRuns).some(([run,count])=>!validMilestoneRun(run)||!validMilestoneCount(count))||
      (Object.keys(milestoneRuns).length>0&&highestTile<rule.milestone))fail('Invalid milestone total.',400);
  // Accept attributed submissions from an earlier already-open game page too.
  if (data.bottle !== undefined && !BOTTLE_IDS.includes(data.bottle)) fail('Invalid bottle achievement.', 400);
  if (data.bottles === undefined && data.bottle !== undefined) data.bottles = {[data.bottle]: {score, highestTile}};
  if (data.bottles !== undefined && (!data.bottles || typeof data.bottles !== 'object' || Array.isArray(data.bottles) ||
      Object.entries(data.bottles).some(([id, record]) => !BOTTLE_IDS.includes(id) || !record || !validScore(record.score) ||
        !validTile(record.highestTile) || record.score > score || record.highestTile > highestTile))) fail('Invalid bottle achievement.', 400);
  const submitted = data.flaskRecord;
  if (submitted !== undefined && (!submitted || !Number.isInteger(submitted.epoch) || submitted.epoch<1 || submitted.epoch>FLASK_RECORD_EPOCH || !validScore(submitted.score) ||
      !validTile(submitted.highestTile) || submitted.score>score || submitted.highestTile>highestTile)) fail('Invalid flask record.',400);
  // Already-open clients can still update other bottles, but cannot undo the
  // dry-flask reset with a pre-reset personal best or round.
  const fresh = submitted?.epoch===FLASK_RECORD_EPOCH?submitted:undefined;
  if (fresh !== undefined && (
      !validTile(fresh.highestTile) || fresh.score > (data.bottles?.['lab-flask']?.score ?? -1) ||
      fresh.highestTile > (data.bottles?.['lab-flask']?.highestTile ?? 0))) fail('Invalid flask record.', 400);
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
  if(Object.keys(milestoneRuns).length)await env.ACHIEVEMENTS.batch(Object.entries(milestoneRuns).map(([run,count])=>env.ACHIEVEMENTS.prepare(`
    INSERT INTO milestone_runs (merge_mode,achievement_epoch,player_id,run_id,merge_count) VALUES (?,?,?,?,?)
    ON CONFLICT(merge_mode,achievement_epoch,player_id,run_id) DO UPDATE SET merge_count=MAX(milestone_runs.merge_count,excluded.merge_count)`)
    .bind(rule.id,achievementEpochFor(rule.id),id,run,count)));
  const bottleStatements = Object.entries(data.bottles ?? {}).map(([bottleId, record]) => env.ACHIEVEMENTS.prepare(`
    INSERT INTO bottle_scores (player_id, bottle_id, best_score, highest_tile, best_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(player_id, bottle_id) DO UPDATE SET
      best_at = CASE WHEN excluded.best_score > bottle_scores.best_score THEN excluded.best_at ELSE bottle_scores.best_at END,
      best_score = CASE WHEN excluded.bottle_id='lab-flask' THEN MAX(excluded.best_score,COALESCE((SELECT best_score FROM flask_current_scores WHERE player_id=excluded.player_id),0)) ELSE MAX(bottle_scores.best_score, excluded.best_score) END,
      highest_tile = MAX(bottle_scores.highest_tile, excluded.highest_tile)`)
    .bind(id, bottleId, bottleId==='lab-flask'?(fresh?.score??0):record.score, record.highestTile, now));
  if (bottleStatements.length) await env.ACHIEVEMENTS.batch(bottleStatements);
  if (fresh) await env.ACHIEVEMENTS.prepare(`INSERT INTO flask_current_scores (player_id,best_score,highest_tile,best_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET
      best_at = CASE WHEN excluded.best_score > flask_current_scores.best_score THEN excluded.best_at ELSE flask_current_scores.best_at END,
      best_score = MAX(flask_current_scores.best_score,excluded.best_score),
      highest_tile = MAX(flask_current_scores.highest_tile,excluded.highest_tile)`)
    .bind(id,fresh.score,fresh.highestTile,now).run();
  return json(await summary(env, id));
}

async function sendMessage(request, env) {
  const {id, hash} = await identity(request), data = await body(request);
  if(env.mergeRule?.id==='three'&&data.achievementEpoch!==THREE_RECORD_EPOCH)fail('Three Combine achievements restarted. Refresh the game to join the new board.',409);
  const bottle = data.bottle === undefined ? 'all' : data.bottle;
  if (typeof bottle !== 'string' || !Object.hasOwn(BOTTLE_NAMES, bottle)) fail('Choose a valid bottle record.', 400);
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  const replyTo = typeof data.replyTo === 'string' ? data.replyTo.trim() : '';
  if (!message || message.length > 2000) fail('Write a message of 1–2,000 characters.', 400);
  if (replyTo && (replyTo.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(replyTo))) fail('Enter a valid reply email, or leave it blank.', 400);
  const player = await env.ACHIEVEMENTS.prepare('SELECT id FROM players WHERE id = ? AND token_hash = ?').bind(id, hash).first();
  if (!player) fail('This player identity could not be verified.', 403);
  if (!env.EMAIL || env.EMAIL_ENABLED !== 'true') fail('Email is not available yet. Your message has not been sent.', 503);
  const now = Date.now(), messageId = crypto.randomUUID(), day = Math.floor(now / 86400000);
  // Check ownership again as part of the INSERT, rather than trusting the UI.
  const table = bottle === 'all' ? 'record_messages' : 'bottle_messages';
  const claim = bottle === 'all' ? await env.ACHIEVEMENTS.prepare(`INSERT INTO record_messages (id, player_id, day, score, message, reply_to, created_at)
    SELECT ?, id, ?, best_score, ?, ?, ? FROM (${RECORD}) WHERE id = ?
    ON CONFLICT(player_id, day) DO NOTHING RETURNING score`).bind(messageId, day, message, replyTo || null, now, id).all() :
    await env.ACHIEVEMENTS.prepare(`INSERT INTO bottle_messages (id, player_id, bottle, day, score, message, reply_to, created_at)
      SELECT ?, r.player_id, r.bottle_id, ?, r.score, ?, ?, ? FROM bottle_records r
      JOIN players p ON p.id = r.player_id WHERE r.bottle_id = ? AND r.player_id = ? AND p.token_hash = ?
      ON CONFLICT(player_id, bottle, day) DO NOTHING RETURNING score`).bind(messageId, day, message, replyTo || null, now, bottle, id, hash).all();
  if (!claim.results.length) {
    const winner = bottle === 'all' ? await env.ACHIEVEMENTS.prepare(RECORD).first() :
      await env.ACHIEVEMENTS.prepare('SELECT player_id AS id FROM bottle_records WHERE bottle_id = ?').bind(bottle).first();
    if (winner?.id !== id) fail('Only this record’s current holder can send a message.', 403);
    fail('You can send one message per record each day. Please try again tomorrow (UTC).', 429);
  }
  const score = claim.results[0].score;
  try {
    const player = bottle === 'all' ? await env.ACHIEVEMENTS.prepare('SELECT name, highest_tile FROM players WHERE id = ?').bind(id).first() :
      bottle === 'lab-flask' ? await env.ACHIEVEMENTS.prepare('SELECT p.name, f.highest_tile FROM players p JOIN flask_current_scores f ON f.player_id = p.id WHERE p.id = ?').bind(id).first() :
      await env.ACHIEVEMENTS.prepare('SELECT p.name, s.highest_tile FROM players p JOIN bottle_scores s ON s.player_id = p.id WHERE p.id = ? AND s.bottle_id = ?').bind(id, bottle).first();
    const text = `Squish Pocket record holder: ${player.name}\nBottle: ${BOTTLE_NAMES[bottle]}\nHighest score: ${score}\nHighest tile: ${player.highest_tile}\n${replyTo ? `Reply email: ${replyTo}\n` : ''}\n${message}`;
    const result = await env.EMAIL.send({from: env.EMAIL_FROM, to: RECIPIENT,
      ...(replyTo ? {replyTo} : {}), subject: `Squish Pocket${env.mergeRule?.count===3?' · Three Combine':''} · ${BOTTLE_NAMES[bottle]} record holder (${score})`,
      text, html: `<div style="white-space:pre-wrap">${escapeHTML(text)}</div>`});
    if (!result?.messageId) throw new Error('Email provider did not accept the message');
  } catch {
    await env.ACHIEVEMENTS.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(messageId).run();
    console.error(JSON.stringify({event: 'record_email_failed'}));
    fail('Email delivery failed. Your message is still here; please try again.', 502);
  }
  try { await env.ACHIEVEMENTS.prepare(`UPDATE ${table} SET status = 'sent' WHERE id = ?`).bind(messageId).run(); }
  catch { console.error(JSON.stringify({event: 'record_email_status_failed'})); }
  return json({sent:true,bottle,mergeMode:env.mergeRule?.id??'two',...(env.mergeRule?.id==='three'?{achievementEpoch:THREE_RECORD_EPOCH}:{})});
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
      const mode=url.searchParams.get('merge')??'two';if(!['two','three'].includes(mode))fail('Choose a valid merge mode.',400);
      const rule=ruleFor(mode);env={...env,mergeRule:rule,...(rule.count===3?{ACHIEVEMENTS:scopedRecords(env.ACHIEVEMENTS)}:{})};
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
