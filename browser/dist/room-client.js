export class RoomClient {
  constructor({onRoom,onStatus,getProgress}){
    Object.assign(this,{onRoom,onStatus,getProgress,room:null,code:null,socket:null,connected:false,stopped:true,retry:0});
    this.ticks=0;
    this.timer=setInterval(()=>{if(this.connected){if(this.room?.phase==='playing')this.publish();else if(++this.ticks%15===0)this.send({type:'ping'});}},1000);
    this.timer.unref?.();
    if(typeof window!=='undefined')window.addEventListener('online',()=>{if(this.code&&!this.connected&&!this.stopped)void this.connect().catch(()=>{});});
  }
  async api(path,data){
    const response=await fetch(path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},
      ...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(12000)});
    let result;try{result=await response.json();}catch{throw new Error('Multiplayer is unavailable. Please try again.');}
    if(!response.ok)throw Object.assign(new Error(result.error||'Could not reach the room.'),{status:response.status});return result;
  }
  async create(name,bottleId,mergeMode='two'){const {code}=await this.api('/api/rooms',{name,bottleId,mergeMode});await this.open(code);}
  async join(name,code){code=code.trim().toUpperCase();if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))throw new Error('Enter the six-character room code.');await this.api(`/api/rooms/${code}/join`,{name});await this.open(code);}
  async open(code){
    if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))throw new Error('Enter a valid room code.');
    this.stopSocket();this.code=code;this.room=null;this.stopped=false;this.retry=0;await this.connect();
  }
  async connect(){
    if(this.connecting||this.stopped)return;this.connecting=true;clearTimeout(this.retryTimer);
    this.onStatus('connecting','Connecting to your room…');
    try{
      const room=await this.api(`/api/rooms/${this.code}/session`);if(this.stopped)return;
      this.room=room;this.onRoom(room,false);
      const url=new URL(`/api/rooms/${this.code}/connect`,location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
      const ws=new WebSocket(url);this.socket=ws;
      ws.onopen=()=>{if(this.socket!==ws)return;this.connected=true;this.retry=0;this.onStatus('connected','Connected');try{localStorage.setItem('squish-pocket-last-room',this.code);}catch{}};
      ws.onmessage=event=>{
        if(this.socket!==ws)return;
        try{const data=JSON.parse(event.data);if(data.type==='room'){this.room=data.room;this.onRoom(this.room,this.connected);}else if(data.type==='error')this.onStatus('error',data.error);}catch{/* Ignore malformed server frames. */}
      };
      ws.onclose=event=>{
        if(this.socket!==ws)return;this.connected=false;
        if(this.stopped)return;
        if([4001,4002].includes(event.code)){this.stopped=true;this.onStatus('closed',event.code===4001?'Room opened in another tab.':'You have left the room.');this.onRoom(this.room,false);return;}
        this.onStatus('disconnected','Connection lost. Reconnecting…');this.onRoom(this.room,false);this.scheduleRetry();
      };
      ws.onerror=()=>{/* Close delivers the reconnect state. */};
    }catch(error){
      if([401,403,404,410].includes(error.status)){this.stopped=true;this.onStatus('closed',error.message);try{localStorage.removeItem('squish-pocket-last-room');}catch{}}
      else {this.onStatus('disconnected',error.message||'Could not connect. Retrying…');this.scheduleRetry();}
      throw error;
    }finally{this.connecting=false;}
  }
  scheduleRetry(){
    clearTimeout(this.retryTimer);
    if(!this.stopped){this.retryTimer=setTimeout(()=>{void this.connect().catch(()=>{});},Math.min(10000,1000*2**this.retry++));this.retryTimer.unref?.();}
  }
  send(data){if(this.connected&&this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(data));}
  publish(){const data=this.getProgress(this.room);if(data)this.send({type:'progress',...data});else this.send({type:'ping'});}
  stopSocket(){this.stopped=true;this.connected=false;clearTimeout(this.retryTimer);const ws=this.socket;this.socket=null;ws?.close(1000,'Leaving page');}
  async leave(){const code=this.code;this.stopSocket();try{if(code)await this.api(`/api/rooms/${code}/leave`,{});}finally{this.code=null;this.room=null;try{localStorage.removeItem('squish-pocket-last-room');}catch{}}}
}
