import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,addPlayer,connectPlayer,disconnectPlayer,startMatch,progress,leaveRoom,expireDisconnects,chooseBottle,publicRoom,RECONNECT_GRACE} from '../room-model.js';
function setup(){const room=newRoom('ABC234','Host','classic','hash-host',1000);addPlayer(room,'Guest','hash-guest');connectPlayer(room,0,1000);connectPlayer(room,1,1000);return room;}
const update=(round,score,done=false)=>({round,score,shots:score/4,highestTile:32,blobs:[],done,paused:false});
test('room host controls the shared bottle and start; public snapshots exclude credentials',()=>{
  const room=setup();assert.throws(()=>startMatch(room,1,7),/host/);assert.throws(()=>chooseBottle(room,1,'lab-flask'),/host/);
  chooseBottle(room,0,'lab-flask');startMatch(room,0,7,2000);
  assert.equal(room.seed,7);assert.equal(room.bottleId,'lab-flask');assert.equal(room.round,1);
  assert.throws(()=>chooseBottle(room,0,'classic'),/fixed/);
  assert.equal(JSON.stringify(publicRoom(room,0)).includes('hash-'),false);
});
test('water and laboratory matches use distinct host-selected vessels',()=>{
  for(const bottle of ['classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']){
    const room=setup();chooseBottle(room,0,bottle);startMatch(room,0,42,2000);
    assert.equal(room.bottleId,bottle);assert.equal(publicRoom(room,1).bottleId,bottle);
    assert.throws(()=>chooseBottle(room,0,'classic'),/fixed/);
  }
  assert.throws(()=>newRoom('ABC234','Host','unknown-water','hash'),/valid bottle/);
});
test('separate scores determine a winner only after both rounds end; ties and rematches work',()=>{
  const room=setup();startMatch(room,0,7,2000);
  assert.equal(progress(room,0,update(1,128,true)),true);assert.equal(room.phase,'playing');
  assert.equal(progress(room,1,update(1,256,true)),true);assert.equal(room.phase,'finished');assert.equal(room.winner,1);
  startMatch(room,0,8,3000);assert.equal(room.round,2);assert.equal(room.players[0].score,0);
  progress(room,0,update(2,64,true));progress(room,1,update(2,64,true));assert.equal(room.winner,null);
});
test('stale, duplicate, or decreasing scores cannot overwrite an active round',()=>{
  const room=setup();startMatch(room,0,7,2000);
  assert.throws(()=>progress(room,0,update(0,128)),/older/);
  assert.equal(progress(room,0,update(1,128)),true);
  assert.equal(progress(room,0,update(1,128)),false);
  assert.equal(progress(room,0,update(1,64)),false);assert.equal(room.players[0].score,128);
  assert.throws(()=>progress(room,0,{...update(1,132),blobs:[{x:0,y:Infinity,level:0}]}),/Invalid/);
});
test('disconnects allow a grace period, reconnects preserve scores, and late reconnects forfeit',()=>{
  const room=setup();startMatch(room,0,7,2000);progress(room,0,update(1,128));disconnectPlayer(room,0,3000);
  expireDisconnects(room,3000+RECONNECT_GRACE-1);assert.equal(room.phase,'playing');
  connectPlayer(room,0,4000);assert.equal(room.players[0].score,128);
  disconnectPlayer(room,0,5000);expireDisconnects(room,5000+RECONNECT_GRACE);
  assert.equal(room.phase,'finished');assert.equal(room.winner,1);assert.equal(room.reason,'forfeit');
});
test('lobby guest may leave without closing the host room; active departure forfeits',()=>{
  const room=setup();leaveRoom(room,1);assert.equal(room.players.length,1);assert.equal(room.phase,'lobby');
  addPlayer(room,'Another friend','new-hash');connectPlayer(room,1,2000);startMatch(room,0,7,2000);leaveRoom(room,1);
  assert.equal(room.phase,'finished');assert.equal(room.winner,0);
});

test('Three Combine rooms keep the rule and validate triple scores, tiles and resets',()=>{
 const room=newRoom('ABC234','Host','classic','hash-host',1000,'three');addPlayer(room,'Guest','hash-guest');connectPlayer(room,0,1000);connectPlayer(room,1,1000);startMatch(room,0,42,2000);
 assert.equal(publicRoom(room,1).mergeMode,'three');assert.equal(room.players[0].highestTile,1);
 assert.ok(progress(room,0,{round:1,score:9,shots:3,highestTile:9,blobs:[],done:false,paused:false}));
 assert.throws(()=>progress(room,1,{round:1,score:4,shots:3,highestTile:4,blobs:[],done:false,paused:false}),/Invalid/);
 assert.ok(progress(room,0,{round:1,score:9,shots:3,highestTile:9,blobs:[],done:true,paused:false}));
 assert.ok(progress(room,1,{round:1,score:27,shots:4,highestTile:27,blobs:[],done:true,paused:false}));assert.equal(room.winner,1);
 startMatch(room,0,43,3000);assert.equal(room.players[0].score,0);assert.equal(room.players[0].highestTile,1);
});
