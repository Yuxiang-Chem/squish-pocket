import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../api.js';

// Execute the actual parameterized statements against SQLite, D1's SQL engine.
function setup({beforeReset=false,beforeThree=false,beforeFresh=false,beforeTotals=false} = {}) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_achievements.sql', import.meta.url), 'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0002_bottle_records.sql', import.meta.url), 'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0003_import_existing_bottle_scores.sql', import.meta.url), 'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0004_bottle_record_messages.sql', import.meta.url), 'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0005_water_bottle_records.sql', import.meta.url), 'utf8'));
  if(!beforeReset)sql.exec(readFileSync(new URL('../migrations/0006_reset_dry_flask_world_record.sql', import.meta.url), 'utf8'));
  if(!beforeReset)sql.exec(readFileSync(new URL('../migrations/0007_reset_dry_flask_personal_scores.sql', import.meta.url), 'utf8'));
  if(!beforeReset)sql.exec(readFileSync(new URL('../migrations/0008_laboratory_vessels.sql', import.meta.url), 'utf8'));
  if(!beforeReset)sql.exec(readFileSync(new URL('../migrations/0009_laboratory_water_vessels.sql', import.meta.url), 'utf8'));
  if(!beforeThree)sql.exec(readFileSync(new URL('../migrations/0010_three_combine.sql', import.meta.url), 'utf8'));
  if(!beforeThree&&!beforeFresh)sql.exec(readFileSync(new URL('../migrations/0011_three_combine_fresh_achievements.sql',import.meta.url),'utf8'));
  if(!beforeTotals)sql.exec(readFileSync(new URL('../migrations/0012_milestone_totals.sql',import.meta.url),'utf8'));
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
    if(data&&path.includes('merge=three')&&data.achievementEpoch===undefined)data={...data,achievementEpoch:2};
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

test('bottle records have independent winners, deterministic ties, and monotonic personal bests', async () => {
  const t = setup(), a = t.player(), b = t.player();
  const submit = (player, name, bottles) => t.request('/api/achievements', {name, score: Math.max(...Object.values(bottles).map(r => r.score)), highestTile: 2048, bottles, ...(bottles['lab-flask'] ? {flaskRecord:{epoch:2,...bottles['lab-flask']}} : {})}, player);
  const empty = (await t.request('/api/achievements')).data;
  assert.equal(empty.bottles.classic.record, null);assert.equal(empty.bottles['lab-flask'].record, null);
  await submit(a, 'First', {classic: {score: 2048, highestTile: 1024}, 'lab-flask': {score: 128, highestTile: 32}});
  let response = await submit(b, 'Second', {classic: {score: 2048, highestTile: 2048}, 'lab-flask': {score: 512, highestTile: 256}});
  assert.equal(response.data.bottles.classic.record.name, 'First');assert.equal(response.data.bottles['lab-flask'].record.name, 'Second');
  assert.equal(response.data.bottles.classic.highestTile, 2048);
  assert.equal(response.data.isRecordHolder, false);
  response = await submit(a, 'Renamed', {classic: {score: 0, highestTile: 2}, 'lab-flask': {score: 0, highestTile: 2}});
  assert.equal(response.data.bottles.classic.record.name, 'Renamed');assert.equal(response.data.bottles.classic.personal.score, 2048);
  assert.equal(response.data.bottles['lab-flask'].personal.score, 128);
  response = await submit(b, 'Second', {classic: {score: 2052, highestTile: 2048}});
  assert.equal(response.data.bottles.classic.record.name, 'Second');
  const publicSummary = (await t.request('/api/achievements')).data;
  assert.equal(JSON.stringify(publicSummary).includes(a.id), false);assert.equal(JSON.stringify(publicSummary).includes(a.token), false);
});

test('legacy scores remain on overall board and forged or invalid bottle submissions cannot change records', async () => {
  const t = setup(), a = t.player();await t.submit(a, 4096);
  assert.equal((await t.request('/api/achievements')).data.bottles.classic.record, null);
  const valid = {name: 'Friend', score: 4096, highestTile: 2048, bottles: {classic: {score: 512, highestTile: 128}}};
  assert.equal((await t.request('/api/achievements', valid, {...a, token: crypto.randomUUID()})).status, 403);
  for (const bottles of [null, [], {fake: {score: 4, highestTile: 2}}, {classic: {score: 4097, highestTile: 2}}, {classic: {score: 4100, highestTile: 2}}, {'lab-flask': {score: 128, highestTile: 4096}}]) {
    assert.equal((await t.request('/api/achievements', {...valid, bottles}, a)).status, 400);
  }
  assert.equal((await t.request('/api/achievements', valid, a)).status, 200);
  const result = (await t.request('/api/achievements')).data;
  assert.equal(result.record.score, 4096);assert.equal(result.bottles.classic.record.score, 512);assert.equal(result.bottles['lab-flask'].record, null);
});

test('migration imports the earlier live bottle layout without losing scores or tied holders', () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_achievements.sql', import.meta.url), 'utf8'));
  sql.exec(`CREATE TABLE player_scores (id TEXT, bottle TEXT, token_hash TEXT, name TEXT, best_score INTEGER, highest_tile INTEGER, best_at INTEGER, created_at INTEGER, PRIMARY KEY(id,bottle));
    CREATE TABLE bottle_record (bottle TEXT PRIMARY KEY, player_id TEXT, score INTEGER);
    CREATE TRIGGER first_bottle_record AFTER INSERT ON player_scores BEGIN SELECT 1; END;
    CREATE TRIGGER higher_bottle_record AFTER UPDATE ON player_scores BEGIN SELECT 1; END;
    INSERT INTO players VALUES ('overall','hash','Overall',16364,2048,1,1);
    INSERT INTO player_scores VALUES ('a','lab-flask','hash-a','First holder',9036,2048,2,1),('b','lab-flask','hash-b','Tied player',9036,2048,1,1),('overall','classic','hash','Overall',16364,2048,1,1);
    INSERT INTO bottle_record VALUES ('lab-flask','a',9036),('classic','overall',16364);`);
  sql.exec(readFileSync(new URL('../migrations/0002_bottle_records.sql', import.meta.url), 'utf8'));
  const bridge = readFileSync(new URL('../migrations/0003_import_existing_bottle_scores.sql', import.meta.url), 'utf8');
  sql.exec(bridge);
  assert.equal(sql.prepare("SELECT score FROM bottle_records WHERE bottle_id='classic'").get().score,16364);
  assert.equal(sql.prepare("SELECT score FROM bottle_records WHERE bottle_id='lab-flask'").get().score,9036);
  assert.equal(sql.prepare("SELECT player_id FROM bottle_records WHERE bottle_id='lab-flask'").get().player_id,'a');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM bottle_scores').get().n,3);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM player_scores').get().n,3);
  sql.exec(bridge);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM bottle_scores').get().n,3);
  sql.close();
});

test('already-open legacy clients can still submit attributed bottle records', async () => {
  const t = setup(), a = t.player();
  const response = await t.request('/api/achievements', {name:'Legacy',score:512,highestTile:128,bottle:'lab-flask'},a);
  assert.equal(response.status,200);assert.equal(response.data.bottles['lab-flask'].personal.score,0);
  assert.equal(response.data.bottles.classic.record,null);
  assert.equal(response.data.bottles['lab-flask'].record,null,'Legacy submissions cannot restore a reset world record');
});

test('dry flask reset preserves historical personal scores and every other world board; stale uploads cannot undo it',async()=>{
  const t=setup({beforeReset:true}),a=t.player(),b=t.player();
  const old={name:'Previous holder',score:20000,highestTile:2048,bottles:{
    classic:{score:20000,highestTile:2048},'lab-flask':{score:13960,highestTile:2048},
    'classic-water':{score:4096,highestTile:512},'lab-flask-water':{score:2336,highestTile:256}
  }};
  // Seed the pre-reset schema directly; the new API expects the new table.
  t.sql.prepare('INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?)').run(a.id,'hash','Previous holder',20000,2048,1,1);
  for(const [id,r] of Object.entries(old.bottles))t.sql.prepare('INSERT INTO bottle_scores VALUES (?, ?, ?, ?, ?)').run(a.id,id,r.score,r.highestTile,1);
  const before=t.sql.prepare('SELECT * FROM bottle_records WHERE bottle_id <> ? ORDER BY bottle_id').all('lab-flask');
  t.sql.exec(readFileSync(new URL('../migrations/0006_reset_dry_flask_world_record.sql',import.meta.url),'utf8'));
  assert.deepEqual(t.sql.prepare('SELECT * FROM bottle_records WHERE bottle_id <> ? ORDER BY bottle_id').all('lab-flask'),before);
  assert.equal(t.sql.prepare("SELECT COUNT(*) AS n FROM bottle_records WHERE bottle_id='lab-flask'").get().n,0);
  assert.equal(t.sql.prepare("SELECT best_score FROM bottle_scores WHERE bottle_id='lab-flask'").get().best_score,13960);
  t.sql.exec(readFileSync(new URL('../migrations/0007_reset_dry_flask_personal_scores.sql',import.meta.url),'utf8'));
  // Cached clients retain overall history but cannot reinstate reset dry scores.
  let result=await t.request('/api/achievements',old,b);
  assert.equal(result.status,200);assert.equal(result.data.bottles['lab-flask'].record,null);
  assert.equal(result.data.bottles['lab-flask'].personal.score,0);
  assert.equal(result.data.bottles['lab-flask'].highestTile,2);
  result=await t.request('/api/achievements',{...old,flaskRecord:{epoch:2,score:64,highestTile:32}},b);
  assert.equal(result.status,200);assert.equal(result.data.bottles['lab-flask'].record.score,64);
  assert.equal(result.data.bottles['lab-flask'].record.highestTile,32);
  assert.equal(result.data.bottles['lab-flask'].recordPersonal.score,64);
  assert.equal(result.data.bottles['lab-flask'].personal.score,64);
  result=await t.request('/api/achievements',old,b);
  assert.equal(result.data.bottles['lab-flask'].record.score,64,'An already-open client cannot reinstate the previous record');
  for(const flaskRecord of [{epoch:0,score:64,highestTile:32},{epoch:2,score:20004,highestTile:32},{epoch:2,score:65,highestTile:32}])
    assert.equal((await t.request('/api/achievements',{...old,flaskRecord},b)).status,400);
  const sent=await t.request('/api/record-message',{bottle:'lab-flask',message:'Fresh record'},b);
  assert.equal(sent.status,200);assert.match(t.emails[0].text,/Highest tile: 32/);
  assert.deepEqual(t.sql.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('either bottle holder can email even when another player holds the overall record', async () => {
  const t=setup(),a=t.player(),b=t.player(),tie=t.player();
  await t.request('/api/achievements',{name:'Original champion',score:16364,highestTile:2048,bottles:{classic:{score:16364,highestTile:2048}}},a);
  const result=await t.request('/api/achievements',{name:'Flask champion',score:1024,highestTile:256,flaskRecord:{epoch:2,score:1024,highestTile:256},bottles:{'lab-flask':{score:1024,highestTile:256}}},b);
  assert.equal(result.data.isRecordHolder,false);assert.equal(result.data.bottles['lab-flask'].isRecordHolder,true);assert.equal(result.data.bottles.classic.isRecordHolder,false);
  const publicData=(await t.request('/api/achievements')).data;
  assert.equal(publicData.bottles['lab-flask'].isRecordHolder,false);assert.equal(JSON.stringify(publicData).includes(b.id),false);
  assert.equal((await t.request('/api/record-message',{bottle:'classic',message:'Wrong bottle'},b)).status,403);
  const sent=await t.request('/api/record-message',{bottle:'lab-flask',message:'A flask victory!',replyTo:'friend@example.com'},b);
  assert.equal(sent.status,200);assert.equal(sent.data.bottle,'lab-flask');assert.equal(t.emails.length,1);
  assert.equal(t.emails[0].to,'chem.xjtlu@gmail.com');assert.match(t.emails[0].subject,/Three-neck flask.*1024/);
  assert.match(t.emails[0].text,/Bottle: Three-neck flask/);assert.match(t.emails[0].text,/Highest tile: 256/);
  await t.request('/api/achievements',{name:'Tied',score:1024,highestTile:256,flaskRecord:{epoch:2,score:1024,highestTile:256},bottles:{'lab-flask':{score:1024,highestTile:256}}},tie);
  assert.equal((await t.request('/api/record-message',{bottle:'lab-flask',message:'Tied'},tie)).status,403);
  assert.equal((await t.request('/api/record-message',{bottle:'lab-flask',message:'Forged'},{...b,token:crypto.randomUUID()})).status,403);
  await t.request('/api/achievements',{name:'New champion',score:1028,highestTile:256,flaskRecord:{epoch:2,score:1028,highestTile:256},bottles:{'lab-flask':{score:1028,highestTile:256}}},tie);
  assert.equal((await t.request('/api/record-message',{bottle:'lab-flask',message:'Stale permission'},b)).status,403);
});

test('bottle email limits are independent and failed delivery releases only the selected claim', async () => {
  const t=setup(),a=t.player();
  await t.request('/api/achievements',{name:'Champion',score:2048,highestTile:1024,flaskRecord:{epoch:2,score:1024,highestTile:128},bottles:{classic:{score:2048,highestTile:1024},'lab-flask':{score:1024,highestTile:128}}},a);
  assert.equal((await t.request('/api/record-message',{bottle:'classic',message:'Original'},a)).status,200);
  assert.equal((await t.request('/api/record-message',{bottle:'classic',message:'Again'},a)).status,429);
  const send=t.env.EMAIL.send;t.env.EMAIL.send=async()=>{throw new Error('Provider failed');};
  assert.equal((await t.request('/api/record-message',{bottle:'lab-flask',message:'Flask'},a)).status,502);
  assert.equal(t.sql.prepare("SELECT COUNT(*) AS n FROM bottle_messages WHERE bottle='lab-flask'").get().n,0);
  t.env.EMAIL.send=send;
  assert.equal((await t.request('/api/record-message',{bottle:'lab-flask',message:'Retry'},a)).status,200);
  assert.equal((await t.request('/api/record-message',{message:'Overall'},a)).status,200);
  assert.equal(t.emails.length,3);
  for(const bottle of ['unknown',null,['classic'],{}])assert.equal((await t.request('/api/record-message',{bottle,message:'Invalid'},a)).status,400);
});

test('water bottles have independent records and champion message permissions',async()=>{
  const t=setup(),a=t.player();
  const result=await t.request('/api/achievements',{name:'Water champion',score:2048,highestTile:1024,bottles:{'classic-water':{score:2048,highestTile:1024},'lab-flask-water':{score:1024,highestTile:128}}},a);
  assert.equal(result.status,200);assert.equal(result.data.bottles.classic.record,null);assert.equal(result.data.bottles['lab-flask'].record,null);
  assert.equal(result.data.bottles['classic-water'].isRecordHolder,true);assert.equal(result.data.bottles['lab-flask-water'].personal.score,1024);
  for(const bottle of ['classic-water','lab-flask-water'])assert.equal((await t.request('/api/record-message',{bottle,message:'A water record!'},a)).status,200);
  assert.match(t.emails[0].subject,/Original bottle · water/);assert.match(t.emails[1].subject,/Three-neck flask · water/);
});

test('personal reset covers every dry-flask player and old epoch clients cannot restore scores',async()=>{
  const t=setup(),a=t.player(),b=t.player();
  const old={name:'Before reset',score:20000,highestTile:2048,bottles:{classic:{score:20000,highestTile:2048},'lab-flask':{score:13960,highestTile:2048},'lab-flask-water':{score:2336,highestTile:256}},flaskRecord:{epoch:2,score:13960,highestTile:2048}};
  await t.request('/api/achievements',old,a);await t.request('/api/achievements',old,b);
  const otherRecords=t.sql.prepare("SELECT * FROM bottle_records WHERE bottle_id <> 'lab-flask' ORDER BY bottle_id").all();
  t.sql.exec(readFileSync(new URL('../migrations/0007_reset_dry_flask_personal_scores.sql',import.meta.url),'utf8'));
  assert.equal(t.sql.prepare("SELECT COUNT(*) AS n FROM bottle_scores WHERE bottle_id='lab-flask' AND best_score<>0").get().n,0);
  assert.equal(t.sql.prepare("SELECT COUNT(*) AS n FROM bottle_scores WHERE bottle_id='lab-flask' AND highest_tile=2048").get().n,2);
  // An in-flight old Worker can finish writing its old tables during rollout.
  // Those tables cannot populate the current board or its personal scores.
  t.sql.prepare('INSERT INTO flask_record_scores VALUES (?,13960,2048,1)').run(a.id);
  t.sql.prepare("UPDATE bottle_scores SET best_score=13960 WHERE player_id=? AND bottle_id='lab-flask'").run(a.id);
  assert.equal((await t.request('/api/achievements')).data.bottles['lab-flask'].record,null);
  for(const player of [a,b]){
    const response=await t.request('/api/achievements',{...old,flaskRecord:{...old.flaskRecord,epoch:1}},player);
    assert.equal(response.status,200);assert.equal(response.data.bottles['lab-flask'].personal.score,0);
    assert.equal(response.data.bottles['lab-flask'].record,null);
    assert.equal(response.data.bottles.classic.personal.score,20000);assert.equal(response.data.bottles['lab-flask-water'].personal.score,2336);
  }
  const result=await t.request('/api/achievements',{...old,flaskRecord:{epoch:2,score:64,highestTile:32}},a);
  assert.equal(result.data.bottles['lab-flask'].personal.score,64,'Only fresh-epoch points count, even with a cached historical personal maximum in the payload');
  assert.equal(result.data.bottles['lab-flask'].record.score,64);
  assert.deepEqual(t.sql.prepare("SELECT * FROM bottle_records WHERE bottle_id <> 'lab-flask' ORDER BY bottle_id").all(),otherRecords);
  assert.equal(t.sql.prepare('SELECT MIN(best_score) AS score FROM players').get().score,20000);
});

test('water record migration preserves dry scores, first holders, and daily message history',()=>{
  const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON;');
  for(const migration of ['0001_achievements.sql','0002_bottle_records.sql','0003_import_existing_bottle_scores.sql','0004_bottle_record_messages.sql'])sql.exec(readFileSync(new URL('../migrations/'+migration,import.meta.url),'utf8'));
  sql.exec(`INSERT INTO players VALUES ('first','hash','First',2048,1024,1,1),('tie','hash2','Tie',2048,1024,1,1);
    INSERT INTO bottle_scores VALUES ('first','classic',2048,1024,1),('tie','classic',2048,1024,1);
    INSERT INTO bottle_messages VALUES ('message','first','classic',10,2048,'Existing note',NULL,'sent',1);`);
  sql.exec('BEGIN;'+readFileSync(new URL('../migrations/0005_water_bottle_records.sql',import.meta.url),'utf8')+'COMMIT;');
  assert.equal(sql.prepare("SELECT player_id FROM bottle_records WHERE bottle_id='classic'").get().player_id,'first');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM bottle_scores').get().n,2);
  assert.equal(sql.prepare("SELECT message FROM bottle_messages WHERE id='message'").get().message,'Existing note');
  assert.throws(()=>sql.exec("INSERT INTO bottle_messages VALUES ('duplicate','first','classic',10,2048,'Again',NULL,'sent',1)"));
  sql.exec("INSERT INTO bottle_scores VALUES ('first','classic-water',128,32,2),('first','lab-flask-water',256,64,2)");
  assert.equal(sql.prepare("SELECT score FROM bottle_records WHERE bottle_id='lab-flask-water'").get().score,256);
  assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);sql.close();
});

test('new laboratory vessels keep independent scores, ties and message scopes',async()=>{
  const t=setup(),a=t.player(),b=t.player();
  const bottles={'separating-funnel':{score:512,highestTile:128},'conical-flask':{score:256,highestTile:64},'separating-funnel-water':{score:384,highestTile:64},'conical-flask-water':{score:192,highestTile:32},'lab-flask':{score:128,highestTile:32}};
  let result=await t.request('/api/achievements',{name:'Ada',score:512,highestTile:128,bottles,flaskRecord:{epoch:2,...bottles['lab-flask']}},a);
  assert.equal(result.status,200);
  for(const id of Object.keys(bottles)){assert.equal(result.data.bottles[id].record.score,bottles[id].score);assert.equal(result.data.bottles[id].personal.score,bottles[id].score);}
  result=await t.request('/api/achievements',{name:'Bob',score:512,highestTile:128,bottles:{'separating-funnel':bottles['separating-funnel']}},b);
  assert.equal(result.data.bottles['separating-funnel'].isRecordHolder,false);
  assert.equal((await t.request('/api/record-message',{bottle:'conical-flask',message:'A lovely flask!'},a)).status,200);
  assert.match(t.emails[0].subject,/Conical flask/);
  assert.deepEqual(t.sql.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('vessel migration preserves old holders, messages and current dry-flask epoch',async()=>{
  const t=setup({beforeReset:true}),a=t.player();
  await t.request('/api/achievements',{name:'Old friend',score:1024,highestTile:256,bottles:{classic:{score:1024,highestTile:256}}},a);
  await t.request('/api/record-message',{bottle:'classic',message:'Keep my message'},a);
  for(const file of ['0006_reset_dry_flask_world_record.sql','0007_reset_dry_flask_personal_scores.sql'])t.sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  await t.request('/api/achievements',{name:'Old friend',score:1024,highestTile:256,bottles:{'lab-flask':{score:64,highestTile:16}},flaskRecord:{epoch:2,score:64,highestTile:16}},a);
  const before={scores:t.sql.prepare('SELECT * FROM bottle_scores ORDER BY bottle_id').all(),records:t.sql.prepare('SELECT * FROM bottle_records ORDER BY bottle_id').all(),messages:t.sql.prepare('SELECT * FROM bottle_messages').all(),fresh:t.sql.prepare('SELECT * FROM flask_current_scores').all()};
  for(const migration of ['0008_laboratory_vessels.sql','0009_laboratory_water_vessels.sql']){
  t.sql.exec('BEGIN;'+readFileSync(new URL('../migrations/'+migration,import.meta.url),'utf8')+'COMMIT;');
  assert.deepEqual({scores:t.sql.prepare('SELECT * FROM bottle_scores ORDER BY bottle_id').all(),records:t.sql.prepare('SELECT * FROM bottle_records ORDER BY bottle_id').all(),messages:t.sql.prepare('SELECT * FROM bottle_messages').all(),fresh:t.sql.prepare('SELECT * FROM flask_current_scores').all()},before);
  }
  await t.request('/api/achievements',{name:'Old friend',score:1024,highestTile:256,bottles:{'lab-flask':{score:128,highestTile:32}},flaskRecord:{epoch:2,score:128,highestTile:32}},a);
  assert.equal((await t.request('/api/achievements')).data.bottles['lab-flask'].record.score,128);
});

test('water laboratory migration preserves dry vessel records and messages',async()=>{
  const t=setup({beforeReset:true}),a=t.player();await t.submit(a,1024,256,'Friend');
  for(const migration of ['0006_reset_dry_flask_world_record.sql','0007_reset_dry_flask_personal_scores.sql','0008_laboratory_vessels.sql'])t.sql.exec(readFileSync(new URL('../migrations/'+migration,import.meta.url),'utf8'));
  await t.request('/api/achievements',{name:'Friend',score:1024,highestTile:256,bottles:{'separating-funnel':{score:512,highestTile:128},'conical-flask':{score:256,highestTile:64}}},a);
  await t.request('/api/record-message',{bottle:'separating-funnel',message:'Keep my dry record'},a);
  const rows=()=>({scores:t.sql.prepare('SELECT * FROM bottle_scores ORDER BY bottle_id').all(),records:t.sql.prepare('SELECT * FROM bottle_records ORDER BY bottle_id').all(),messages:t.sql.prepare('SELECT * FROM bottle_messages').all()});
  const before=rows();t.sql.exec('BEGIN;'+readFileSync(new URL('../migrations/0009_laboratory_water_vessels.sql',import.meta.url),'utf8')+'COMMIT;');assert.deepEqual(rows(),before);
  const result=await t.request('/api/achievements',{name:'Friend',score:1024,highestTile:256,bottles:{'separating-funnel-water':{score:128,highestTile:32},'conical-flask-water':{score:64,highestTile:16}}},a);
  assert.equal(result.status,200);assert.equal(result.data.bottles['separating-funnel'].record.score,512);assert.equal(result.data.bottles['separating-funnel-water'].record.score,128);
  assert.equal(result.data.bottles['conical-flask'].record.score,256);assert.equal(result.data.bottles['conical-flask-water'].record.score,64);
  assert.deepEqual(t.sql.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('top five ranks every board, keeps tied champion first, updates names and exposes no identities',async()=>{
  const t=setup(),ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water'];
  const empty=(await t.request('/api/achievements')).data;assert.deepEqual(empty.leaderboard,[]);for(const id of ids)assert.deepEqual(empty.bottles[id].leaderboard,[]);
  const players=Array.from({length:7},()=>t.player());players[0].id='ffffffff-ffff-4fff-bfff-ffffffffffff';players[1].id='00000000-0000-4000-8000-000000000001';
  const scores=[1024,1024,768,512,256,128,0],names=['First','Tied','Third','Fourth','Fifth','Sixth','No score'];
  const payload=(i,score=scores[i],name=names[i])=>({name,score,highestTile:256,bottles:Object.fromEntries(ids.map(id=>[id,{score,highestTile:256}])),flaskRecord:{epoch:2,score,highestTile:256}});
  for(let i=0;i<players.length;i++)assert.equal((await t.request('/api/achievements',payload(i),players[i])).status,200);
  for(const table of ['players','bottle_scores','flask_current_scores'])t.sql.exec(`UPDATE ${table} SET best_at=1`);
  let result=(await t.request('/api/achievements')).data;
  for(const board of [result,...ids.map(id=>result.bottles[id])]){
    assert.deepEqual(board.leaderboard.map(r=>r.name),names.slice(0,5));assert.deepEqual(board.leaderboard.map(r=>r.rank),[1,2,3,4,5]);
    assert.equal(board.leaderboard[0].name,board.record.name);assert.ok(board.leaderboard.every(r=>!r.isYou));
  }
  for(const player of players){assert.ok(!JSON.stringify(result).includes(player.id));assert.ok(!JSON.stringify(result).includes(player.token));}
  result=(await t.request('/api/achievements',payload(1,1024,'Renamed'),players[1])).data;
  assert.equal(result.leaderboard[1].name,'Renamed');assert.equal(result.leaderboard[1].isYou,true);assert.equal(result.leaderboard[0].isYou,false);
  result=(await t.request('/api/achievements',payload(5,4096),players[5])).data;
  for(const board of [result,...ids.map(id=>result.bottles[id])]){assert.equal(board.leaderboard[0].name,'Sixth');assert.equal(board.leaderboard[0].score,4096);assert.equal(board.leaderboard.length,5);}
  result=(await t.request('/api/achievements',payload(5,4),players[5])).data;assert.equal(result.leaderboard[0].score,4096);
});

test('dry flask top five uses only current epoch scores while retaining wet and overall history',async()=>{
  const t=setup(),fresh=t.player(),old=t.player();
  await t.request('/api/achievements',{name:'Fresh',score:128,highestTile:32,bottles:{'lab-flask':{score:128,highestTile:32}},flaskRecord:{epoch:2,score:128,highestTile:32}},fresh);
  await t.request('/api/achievements',{name:'Historical',score:8192,highestTile:2048,bottles:{'lab-flask':{score:8192,highestTile:2048},'lab-flask-water':{score:8192,highestTile:2048}},flaskRecord:{epoch:1,score:8192,highestTile:2048}},old);
  t.sql.prepare("UPDATE bottle_scores SET best_score=8192 WHERE player_id=? AND bottle_id='lab-flask'").run(old.id);
  t.sql.prepare('INSERT INTO flask_record_scores VALUES (?,?,?,?)').run(old.id,8192,2048,1);
  const result=(await t.request('/api/achievements')).data;
  assert.equal(result.leaderboard[0].name,'Historical');assert.equal(result.bottles['lab-flask-water'].leaderboard[0].name,'Historical');
  assert.deepEqual(result.bottles['lab-flask'].leaderboard,[{rank:1,name:'Fresh',score:128,highestTile:32,isYou:false}]);
});

test('Three Combine has independent identities, points, milestones and top-five boards',async()=>{
 const t=setup(),a=t.player(),b=t.player();await t.submit(a,4096,2048,'Two champion');
 let result=await t.request('/api/achievements?merge=three');assert.equal(result.status,200);assert.equal(result.data.mergeMode,'three');assert.equal(result.data.highestTile,1);assert.deepEqual(result.data.leaderboard,[]);
 const payload=(name,score,tile)=>({name,score,highestTile:tile,bottles:{classic:{score,highestTile:tile}}});
 result=await t.request('/api/achievements?merge=three',payload('Triple champion',2187,2187),a);assert.equal(result.status,200);assert.equal(result.data.record.score,2187);assert.equal(result.data.milestone,2187);assert.equal(result.data.reachedMilestone,1);
 await t.request('/api/achievements?merge=three',payload('Triple second',81,27),b);
 result=await t.request('/api/achievements?merge=three');assert.deepEqual(result.data.leaderboard.map(r=>r.score),[2187,81]);assert.equal(result.data.bottles.classic.record.name,'Triple champion');
 result=await t.request('/api/achievements');assert.equal(result.data.record.name,'Two champion');assert.equal(result.data.record.score,4096);assert.equal(result.data.reached2048,1);
 assert.equal((await t.request('/api/achievements?merge=three',payload('Bad two value',4,4),a)).status,400);
 assert.equal((await t.request('/api/achievements',payload('Bad triple value',81,27),a)).status,400);
 assert.equal((await t.request('/api/record-message?merge=three',{bottle:'classic',message:'Three is lovely'},a)).status,200);assert.match(t.emails[0].subject,/Three Combine/);
 assert.deepEqual(t.sql.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('adding Three Combine leaves every original identity, best and holder intact',async()=>{
 const t=setup({beforeThree:true}),a=t.player();
 await t.request('/api/achievements',{name:'Keep my original record',score:4096,highestTile:2048,bottles:{classic:{score:4096,highestTile:2048}}},a);
 const tables=['players','world_record','bottle_scores','bottle_records','record_messages','bottle_messages','flask_current_scores'];
 const rows=()=>Object.fromEntries(tables.map(table=>[table,t.sql.prepare('SELECT * FROM '+table+' ORDER BY 1,2').all()]));
 const before=rows();t.sql.exec('BEGIN;'+readFileSync(new URL('../migrations/0010_three_combine.sql',import.meta.url),'utf8')+readFileSync(new URL('../migrations/0011_three_combine_fresh_achievements.sql',import.meta.url),'utf8')+'COMMIT;');assert.deepEqual(rows(),before);
 assert.equal((await t.request('/api/achievements')).data.record.score,4096);assert.equal((await t.request('/api/achievements?merge=three')).data.record,null);
 assert.deepEqual(t.sql.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('Three Combine fresh boards preserve Two records and archived zzz records while rejecting stale clients',async()=>{
 const t=setup({beforeFresh:true}),a=t.player();await t.submit(a,4096,2048,'Two champion');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(a.token))),n=>n.toString(16).padStart(2,'0')).join('');
 t.sql.prepare('INSERT INTO three_players (id,token_hash,name,best_score,highest_tile,best_at,created_at) VALUES (?,?,?,?,?,?,?)').run(a.id,hash,'zzz',65610,6561,1,1);
 for(const bottle of ['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water'])t.sql.prepare('INSERT INTO three_bottle_scores VALUES (?,?,?,?,?)').run(a.id,bottle,65610,6561,1);
 t.sql.prepare('INSERT INTO three_flask_current_scores VALUES (?,?,?,?)').run(a.id,65610,6561,1);
 const tables=['players','world_record','bottle_scores','bottle_records','flask_current_scores','record_messages','bottle_messages',...['players','world_record','bottle_scores','bottle_records','flask_current_scores','record_messages','bottle_messages'].map(t=>'three_'+t)];
 const rows=()=>Object.fromEntries(tables.map(table=>[table,t.sql.prepare('SELECT * FROM '+table+' ORDER BY 1,2').all()]));const before=rows();
 t.sql.exec('BEGIN;'+readFileSync(new URL('../migrations/0011_three_combine_fresh_achievements.sql',import.meta.url),'utf8')+'COMMIT;');assert.deepEqual(rows(),before);
 let result=(await t.request('/api/achievements?merge=three')).data;assert.equal(result.announcement.expiresAt-result.announcement.publishedAt,172800000);assert.equal(result.achievementEpoch,2);assert.equal(result.record,null);assert.equal(result.reachedMilestone,0);assert.equal(result.highestTile,1);
 for(const b of Object.values(result.bottles)){assert.equal(b.record,null);assert.deepEqual(b.leaderboard,[]);}
 assert.equal(t.sql.prepare('SELECT name FROM three_v2_players WHERE id=?').get(a.id).name,'zzz');
 assert.equal((await t.request('/api/achievements')).data.record.score,4096);
 const old={name:'zzz',score:65610,highestTile:6561,bottles:{classic:{score:65610,highestTile:6561}}};
 const stale=await worker.fetch(new Request('https://game.example/api/achievements?merge=three',{method:'POST',headers:{'Content-Type':'application/json','X-Player-Id':a.id,Authorization:'Bearer '+a.token},body:JSON.stringify(old)}),t.env);assert.equal(stale.status,409);
 assert.equal((await t.request('/api/achievements?merge=three',{...old,achievementEpoch:1},a)).status,409);
 assert.equal((await t.request('/api/record-message?merge=three',{message:'old record',achievementEpoch:1},a)).status,409);
 result=await t.request('/api/achievements?merge=three',{name:'zzz',score:9,highestTile:9,bottles:{classic:{score:9,highestTile:9}}},a);assert.equal(result.status,200);assert.equal(result.data.record.score,9);
 assert.equal((await t.request('/api/achievements?merge=three',{name:'Hijack',score:27,highestTile:27},{id:a.id,token:crypto.randomUUID()})).status,403);
 assert.deepEqual(rows(),before);assert.deepEqual(t.sql.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('milestone totals count repeated creations independently of unique players and survive retries, restarts and tab races',async()=>{
 const t=setup(),a=t.player(),b=t.player(),run=crypto.randomUUID(),next=crypto.randomUUID();
 const payload=(runs)=>({name:'Friend',score:4096,highestTile:2048,milestoneRuns:runs});
 let r=await t.request('/api/achievements',payload({[run]:1}),a);
 assert.equal(r.status,200);assert.equal(r.data.totalMilestones,1);assert.equal(r.data.reached2048,1);
 assert.ok(r.data.milestoneTrackingSince>0);
 r=await t.request('/api/achievements',payload({[run]:2}),a);
 assert.equal(r.data.totalMilestones,2);assert.equal(r.data.reached2048,1);
 await Promise.all([t.request('/api/achievements',payload({[run]:2}),a),t.request('/api/achievements',payload({[run]:1}),a)]);
 r=await t.request('/api/achievements',payload({[next]:3}),a);assert.equal(r.data.totalMilestones,5);assert.equal(r.data.reached2048,1);
 r=await t.submit(a,0,2);assert.equal(r.data.totalMilestones,5,'old clients and a fresh round cannot reduce totals');
 r=await t.request('/api/achievements',payload({[run]:2}),b);assert.equal(r.data.totalMilestones,7);assert.equal(r.data.reached2048,2);
 const forged=await t.request('/api/achievements',payload({[next]:99}),{...a,token:crypto.randomUUID()});assert.equal(forged.status,403);
 const publicSummary=(await t.request('/api/achievements')).data;
 assert.equal(publicSummary.totalMilestones,7);assert.equal(JSON.stringify(publicSummary).includes(run),false);assert.equal(JSON.stringify(publicSummary).includes(a.id),false);
 assert.equal((await t.request('/api/achievements?merge=three')).data.totalMilestones,0);
 r=await t.request('/api/achievements?merge=three',{name:'Triple',score:2187,highestTile:2187,milestoneRuns:{[run]:2}},a);
 assert.equal(r.status,200);assert.equal(r.data.totalMilestones,2);assert.equal(r.data.reachedMilestone,1);
 assert.equal((await t.request('/api/achievements')).data.totalMilestones,7);
 assert.equal((await t.request('/api/achievements?merge=three',{name:'Old',score:2187,highestTile:2187,achievementEpoch:1,milestoneRuns:{[run]:50}},a)).status,409);
 assert.equal((await t.request('/api/achievements?merge=three')).data.totalMilestones,2);
});

test('invalid milestone batches make no player or total changes',async()=>{
 const t=setup(),a=t.player(),run=crypto.randomUUID(),payload={name:'Valid',score:2048,highestTile:2048};
 for(const milestoneRuns of [null,[],3,'bad',{bad:1},{[run]:0},{[run]:-1},{[run]:1.5},{[run]:1000001},Object.fromEntries(Array.from({length:51},()=>[crypto.randomUUID(),1]))]){
  assert.equal((await t.request('/api/achievements',{...payload,milestoneRuns},a)).status,400);
 }
 assert.equal((await t.request('/api/achievements',{...payload,highestTile:1024,milestoneRuns:{[run]:1}},a)).status,400);
 assert.equal(t.sql.prepare('SELECT COUNT(*) AS n FROM players').get().n,0);
 assert.equal(t.sql.prepare('SELECT COUNT(*) AS n FROM milestone_runs').get().n,0);
});

test('adding totals preserves every existing board and starts with no invented historical merges',async()=>{
 const t=setup({beforeTotals:true}),a=t.player();
 for(const prefix of ['', 'three_v2_'])t.sql.prepare(`INSERT INTO ${prefix}players (id,token_hash,name,best_score,highest_tile,best_at,created_at) VALUES (?,?,?,?,?,?,?)`).run(a.id,'hash','Keep me',prefix?2187:4096,prefix?2187:2048,1,1);
 const tables=['players','world_record','bottle_scores','bottle_records','flask_current_scores','three_v2_players','three_v2_world_record','three_v2_bottle_scores','three_v2_bottle_records'];
 const snapshot=()=>Object.fromEntries(tables.map(name=>[name,t.sql.prepare('SELECT * FROM '+name+' ORDER BY 1').all()])),before=snapshot();
 t.sql.exec(readFileSync(new URL('../migrations/0012_milestone_totals.sql',import.meta.url),'utf8'));
 assert.deepEqual(snapshot(),before);
 for(const mode of ['two','three']){const r=await t.request('/api/achievements?merge='+mode);assert.equal(r.status,200);assert.equal(r.data.totalMilestones,0);assert.equal(r.data.reachedMilestone,1);assert.equal(r.data.record.name,'Keep me');}
 assert.deepEqual(t.sql.prepare('PRAGMA foreign_key_check').all(),[]);
});
