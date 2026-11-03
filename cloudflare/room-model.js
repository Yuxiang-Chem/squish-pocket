export const ROOM_TTL=6*60*60*1000,RECONNECT_GRACE=30000;
export const validBottle=id=>id==='classic'||id==='lab-flask';
export const roomError=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function playerName(name,fallback){
  if(typeof name!=='string')return fallback;
  name=name.trim();if(!name)return fallback;
  if(name.length>24||/[\u0000-\u001f\u007f]/.test(name))roomError('Use a name of 1–24 characters.');
  return name;
}
const player=(name,tokenHash)=>({name,tokenHash,connected:false,disconnectedAt:null,status:'waiting',score:0,shots:0,highestTile:2,blobs:[],paused:false});
export function newRoom(code,name,bottleId,tokenHash,now=Date.now()){
  if(!validBottle(bottleId))roomError('Choose a valid bottle.');
  return {code,bottleId,phase:'lobby',round:0,seed:0,players:[player(playerName(name,'Player 1'),tokenHash)],createdAt:now,expiresAt:now+ROOM_TTL,winner:null,reason:null};
}
export function addPlayer(room,name,hash){
  if(room.phase!=='lobby')roomError('This match has already started. Rejoin from the same browser.',409);
  if(room.players.length>=2)roomError('This room already has two players.',409);
  room.players.push(player(playerName(name,'Player 2'),hash));return 1;
}
function conclude(room){
  if(room.phase!=='playing')return;
  const forfeits=room.players.map(p=>p.status==='forfeit');
  if(forfeits.some(Boolean)){
    room.phase='finished';room.winner=forfeits[0]===forfeits[1]?null:forfeits[0]?1:0;room.reason='forfeit';
  }else if(room.players.every(p=>p.status==='finished')){
    room.phase='finished';const difference=room.players[0].score-room.players[1].score;
    room.winner=difference===0?null:difference>0?0:1;room.reason='score';
  }
}
export function expireDisconnects(room,now=Date.now()){
  let changed=false;
  if(room.phase==='playing')for(const p of room.players){
    if(!p.connected&&p.disconnectedAt!==null&&now-p.disconnectedAt>=RECONNECT_GRACE&&p.status==='playing'){p.status='forfeit';changed=true;}
  }
  conclude(room);return changed;
}
export function connectPlayer(room,slot,now=Date.now()){
  expireDisconnects(room,now);const p=room.players[slot];p.connected=true;p.disconnectedAt=null;
}
export function disconnectPlayer(room,slot,now=Date.now()){
  const p=room.players[slot];p.connected=false;p.disconnectedAt=now;
}
export function startMatch(room,slot,seed,now=Date.now()){
  if(slot!==0)roomError('Only the host can start the match.',403);
  if(!['lobby','finished'].includes(room.phase))roomError('A match is already running.',409);
  if(room.players.length!==2||!room.players.every(p=>p.connected))roomError('Wait for both players to connect.',409);
  room.phase='playing';room.round++;room.seed=seed>>>0;room.winner=null;room.reason=null;room.expiresAt=now+ROOM_TTL;
  for(const p of room.players)Object.assign(p,{status:'playing',score:0,shots:0,highestTile:2,blobs:[],paused:false});
}
export function chooseBottle(room,slot,bottleId){
  if(slot!==0)roomError('Only the host chooses the bottle.',403);
  if(!['lobby','finished'].includes(room.phase))roomError('The bottle is fixed during a match.',409);
  if(!validBottle(bottleId))roomError('Choose a valid bottle.');room.bottleId=bottleId;
}
export function progress(room,slot,data){
  if(room.phase!=='playing'||room.players[slot].status!=='playing')return false;
  if(data.round!==room.round)roomError('That update belongs to an older round.',409);
  if(!Number.isSafeInteger(data.score)||data.score<0||data.score>1e9||data.score%4!==0||
    !Number.isSafeInteger(data.shots)||data.shots<0||data.shots>1e6||
    !Number.isInteger(data.highestTile)||data.highestTile<2||data.highestTile>4096||(data.highestTile&(data.highestTile-1))||
    typeof data.done!=='boolean'||typeof data.paused!=='boolean'||!Array.isArray(data.blobs)||data.blobs.length>90)roomError('Invalid match update.');
  const blobs=data.blobs.map(b=>{
    if(!b||!Number.isInteger(b.level)||b.level<0||b.level>11||!Number.isFinite(b.x)||!Number.isFinite(b.y)||Math.abs(b.x)>2000||Math.abs(b.y)>2000)roomError('Invalid blob update.');
    return {x:b.x,y:b.y,level:b.level};
  });
  const p=room.players[slot];
  // Delayed messages and reconnects cannot lower an accepted score.
  if(data.shots<p.shots||data.score<p.score)return false;
  const highestTile=Math.max(p.highestTile,data.highestTile);
  const unchanged=p.score===data.score&&p.shots===data.shots&&p.highestTile===highestTile&&p.paused===data.paused&&!data.done&&
    p.blobs.length===blobs.length&&p.blobs.every((b,i)=>b.level===blobs[i].level&&b.x===blobs[i].x&&b.y===blobs[i].y);
  if(unchanged)return false;
  Object.assign(p,{score:data.score,shots:data.shots,highestTile,blobs,paused:data.paused});
  if(data.done)p.status='finished';conclude(room);return true;
}
export function leaveRoom(room,slot){
  if(room.phase==='playing'){room.players[slot].status='forfeit';room.players[slot].connected=false;conclude(room);}
  else if(room.phase==='lobby'&&slot===1)room.players.splice(1,1);
  else if(slot===0)room.phase='closed';
}
export function publicRoom(room,slot){
  const {players,...view}=room;
  return {...view,you:slot,players:players.map(({tokenHash,...p})=>p)};
}
