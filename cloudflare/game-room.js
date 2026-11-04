import {DurableObject} from 'cloudflare:workers';
import {newRoom,addPlayer,connectPlayer,disconnectPlayer,startMatch,chooseBottle,progress,leaveRoom,expireDisconnects,publicRoom,roomError,RECONNECT_GRACE} from './room-model.js';
const hash=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,'0')).join('');
export class GameRoom extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)');
    const row=ctx.storage.sql.exec('SELECT data FROM room WHERE id=1').toArray()[0];
    this.room=row?JSON.parse(row.data):null;
  }
  commit(next){
    this.ctx.storage.sql.exec('INSERT INTO room(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',JSON.stringify(next));
    this.room=next;
  }
  async syncAlarm(){
    if(!this.room)return;
    const pending=this.room.phase==='playing'?this.room.players.filter(p=>!p.connected&&p.disconnectedAt!==null&&p.status==='playing').map(p=>p.disconnectedAt+RECONNECT_GRACE):[];
    await this.ctx.storage.setAlarm(Math.min(this.room.expiresAt,...pending));
  }
  active(){
    if(!this.room||this.room.expiresAt<=Date.now())roomError('This room has expired. Create a new room.',410);
    const next=structuredClone(this.room);if(expireDisconnects(next)){this.commit(next);this.broadcast();}
    return this.room;
  }
  async initialize(code,name,bottleId,mergeMode='two'){
    const token=crypto.randomUUID(),tokenHash=await hash(token);
    if(this.room&&this.room.expiresAt>Date.now())return null;
    this.commit(newRoom(code,name,bottleId,tokenHash,Date.now(),mergeMode));await this.syncAlarm();
    return {code,token};
  }
  async command(action,data={}){
    try{
      let result;
      if(action==='initialize')result=await this.initialize(data.code,data.name,data.bottleId,data.mergeMode);
      else if(action==='join')result=await this.join(data.name,data.token);
      else if(action==='session')result=await this.session(data.token);
      else if(action==='leave')result=await this.leave(data.token);
      else roomError('Unknown room action.');
      return {ok:true,data:result};
    }catch(error){return {ok:false,error:error.status?error.message:'The room is temporarily unavailable.',status:error.status??500};}
  }
  async member(token){
    if(typeof token!=='string'||token.length!==36)roomError('Rejoin this room from the browser you used before.',401);
    const tokenHash=await hash(token),room=this.active();
    const slot=room.players.findIndex(p=>p.tokenHash===tokenHash);
    if(slot<0)roomError('Your room session could not be verified.',403);return slot;
  }
  async join(name,existingToken){
    if(existingToken){try{await this.member(existingToken);return {code:this.room.code,token:existingToken};}catch{/* A new browser may take an empty seat. */}}
    const token=crypto.randomUUID(),tokenHash=await hash(token),next=structuredClone(this.active());
    addPlayer(next,name,tokenHash);this.commit(next);this.broadcast();return {code:next.code,token};
  }
  async session(token){const slot=await this.member(token);return publicRoom(this.room,slot);}
  async leave(token){
    const slot=await this.member(token),next=structuredClone(this.room);leaveRoom(next,slot);this.commit(next);this.broadcast();
    for(const ws of this.ctx.getWebSockets(`player:${slot}`))ws.close(4002,'Left room');
    return {left:true};
  }
  async fetch(request){
    try{
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
      const token=request.headers.get('X-Room-Session'),slot=await this.member(token);
      const pair=new WebSocketPair(),[client,server]=Object.values(pair);
      this.ctx.acceptWebSocket(server,[`player:${slot}`]);server.serializeAttachment({slot});
      for(const ws of this.ctx.getWebSockets(`player:${slot}`))if(ws!==server)ws.close(4001,'Opened in another tab');
      const next=structuredClone(this.room);connectPlayer(next,slot);this.commit(next);this.broadcast();await this.syncAlarm();
      return new Response(null,{status:101,webSocket:client});
    }catch(error){return Response.json({error:error.status?error.message:'Could not connect to the room.'},{status:error.status??500});}
  }
  broadcast(){
    if(!this.room)return;
    for(const ws of this.ctx.getWebSockets()){
      const {slot}=ws.deserializeAttachment()??{};
      if(!this.room.players[slot])continue;
      try{ws.send(JSON.stringify({type:'room',room:publicRoom(this.room,slot)}));}catch{/* Close callback handles membership. */}
    }
  }
  async webSocketMessage(ws,message){
    try{
      if(ws.readyState!==1)return;
      if(typeof message!=='string'||message.length>16384)roomError('Match update is too large.');
      const data=JSON.parse(message),{slot}=ws.deserializeAttachment();
      this.active();
      if(!this.room.players[slot])roomError('You have left this room.',403);
      const next=structuredClone(this.room);
      let changed=true;
      if(data.type==='start')startMatch(next,slot,crypto.getRandomValues(new Uint32Array(1))[0]);
      else if(data.type==='bottle')chooseBottle(next,slot,data.bottleId);
      else if(data.type==='progress')changed=progress(next,slot,data);
      else if(data.type==='ping')changed=false;
      else roomError('Unknown match action.');
      if(changed){this.commit(next);this.broadcast();}
      if(data.type==='start')await this.syncAlarm();
    }catch(error){try{ws.send(JSON.stringify({type:'error',error:error.status?error.message:'Invalid match action.'}));}catch{}}
  }
  async webSocketClose(ws,code){
    try{ws.close(code===1006?1000:code,'Closed');}catch{}
    const {slot}=ws.deserializeAttachment()??{};
    if(!this.room?.players[slot]||code===4001||code===4002)return;
    if(this.ctx.getWebSockets(`player:${slot}`).some(other=>other!==ws&&other.readyState===1))return;
    const next=structuredClone(this.room);disconnectPlayer(next,slot);this.commit(next);this.broadcast();await this.syncAlarm();
  }
  async webSocketError(ws){await this.webSocketClose(ws,1006);}
  async alarm(){
    const now=Date.now();
    if(this.room&&this.room.expiresAt>now){
      const next=structuredClone(this.room);
      if(expireDisconnects(next,now)){this.commit(next);this.broadcast();}
      await this.syncAlarm();return;
    }
    for(const ws of this.ctx.getWebSockets())ws.close(4002,'Room expired');
    this.ctx.storage.sql.exec('DELETE FROM room');this.room=null;
  }
}
