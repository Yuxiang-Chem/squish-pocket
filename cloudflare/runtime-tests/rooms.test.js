import {env,exports as workerExports} from 'cloudflare:workers';
import {evictDurableObject,runInDurableObject,runDurableObjectAlarm} from 'cloudflare:test';
import {test,expect,afterEach} from 'vitest';
const sockets=[];
afterEach(()=>{for(const ws of sockets.splice(0))try{ws.close(1000,'Test complete');}catch{}});
async function setup(){
  const stub=env.ROOMS.getByName(`test:${crypto.randomUUID()}`);
  const host=await stub.command('initialize',{code:'ABC234',name:'Host',bottleId:'classic'});
  const guest=await stub.command('join',{name:'Guest'});
  expect(host.ok).toBe(true);expect(guest.ok).toBe(true);
  return {stub,host:host.data.token,guest:guest.data.token};
}
async function connect(stub,token){
  const response=await stub.fetch(new Request('https://game.example/connect',{headers:{Upgrade:'websocket','X-Room-Session':token}}));
  expect(response.status).toBe(101);const ws=response.webSocket;sockets.push(ws);const messages=[],pending=[];
  ws.addEventListener('message',event=>{const value=JSON.parse(event.data);messages.push(value);for(const wait of pending)if(wait.matches(value))wait.resolve(value);});
  const wait=matches=>{const existing=messages.findLast(matches);return existing?Promise.resolve(existing):new Promise(resolve=>pending.push({matches,resolve}));};
  ws.accept();await wait(m=>m.type==='room');return {ws,wait};
}
test('real private sockets share seed and scores, preserve state through hibernation, and decide winner',async()=>{
  const {stub,host,guest}=await setup(),a=await connect(stub,host),b=await connect(stub,guest);
  a.ws.send(JSON.stringify({type:'start'}));
  const started=await b.wait(m=>m.room?.phase==='playing');expect(started.room.you).toBe(1);expect(started.room.round).toBe(1);
  expect(JSON.stringify(started)).not.toContain(host);expect(JSON.stringify(started)).not.toContain('tokenHash');
  const msg=score=>({type:'progress',round:1,score,shots:4,highestTile:32,blobs:[],done:true,paused:false});
  a.ws.send(JSON.stringify(msg(128)));await b.wait(m=>m.room?.players[0].score===128);
  await evictDurableObject(stub);
  b.ws.send(JSON.stringify(msg(256)));
  const result=await a.wait(m=>m.room?.phase==='finished');expect(result.room.winner).toBe(1);
  await runInDurableObject(stub,(_instance,state)=>{
    const row=state.storage.sql.exec('SELECT data FROM room WHERE id=1').one();expect(JSON.parse(row.data).players[1].score).toBe(256);
  });
});
test('authentication, room capacity, object isolation, and guest permissions are enforced',async()=>{
  const {stub,host,guest}=await setup();
  const full=await stub.command('join',{name:'Third'});expect(full.ok).toBe(false);expect(full.status).toBe(409);
  const invalid=await stub.command('session',{token:crypto.randomUUID()});expect(invalid.status).toBe(403);
  const unauthorized=await stub.fetch(new Request('https://game.example/connect',{headers:{Upgrade:'websocket'}}));expect(unauthorized.status).toBe(401);
  const a=await connect(stub,host),b=await connect(stub,guest);b.ws.send(JSON.stringify({type:'start'}));
  const denied=await b.wait(m=>m.type==='error');expect(denied.error).toContain('host');
  const other=env.ROOMS.getByName(`test:${crypto.randomUUID()}`);const absent=await other.command('session',{token:host});expect(absent.ok).toBe(false);
  a.ws.send(JSON.stringify({type:'start'}));await b.wait(m=>m.room?.phase==='playing');
});
test('room HTTP routes issue private cookies, preserve full-room errors and reject cross-site requests',async()=>{
  const post=(path,data,cookie)=>workerExports.default.fetch(new Request(`https://game.example${path}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://game.example',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)}));
  const created=await post('/api/rooms',{name:'Host',bottleId:'lab-flask'});expect(created.status).toBe(200);
  const {code}=await created.json(),header=created.headers.get('Set-Cookie'),cookie=header.split(';')[0];
  expect(header).toContain('HttpOnly');expect(header).toContain('Secure');expect(header).toContain('SameSite=Strict');
  const session=await workerExports.default.fetch(new Request(`https://game.example/api/rooms/${code}/session`,{headers:{Cookie:cookie}}));
  const own=await session.json();expect(own.you).toBe(0);expect(own.bottleId).toBe('lab-flask');expect(JSON.stringify(own)).not.toContain('tokenHash');
  const joined=await post(`/api/rooms/${code}/join`,{name:'Guest'});expect(joined.status).toBe(200);
  const full=await post(`/api/rooms/${code}/join`,{name:'Third'});expect(full.status).toBe(409);
  const crossSite=await workerExports.default.fetch(new Request('https://game.example/api/rooms',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'}));expect(crossSite.status).toBe(403);
});
test('expiry alarm clears the room and invalidates its old session',async()=>{
  const {stub,host}=await setup();
  await runInDurableObject(stub,(instance,state)=>{instance.room.expiresAt=Date.now()-1;state.storage.sql.exec('UPDATE room SET data=? WHERE id=1',JSON.stringify(instance.room));});
  expect(await runDurableObjectAlarm(stub)).toBe(true);
  const session=await stub.command('session',{token:host});expect(session.status).toBe(410);
  await runInDurableObject(stub,(_instance,state)=>{expect(state.storage.sql.exec('SELECT COUNT(*) AS count FROM room').one().count).toBe(0);});
});

test('real Three Combine sockets retain their mode through hibernation and accept powers of three',async()=>{
 const stub=env.ROOMS.getByName(`test:three:${crypto.randomUUID()}`);
 const host=await stub.command('initialize',{code:'ABC234',name:'Host',bottleId:'classic',mergeMode:'three'}),guest=await stub.command('join',{name:'Guest'});
 expect(host.ok).toBe(true);const a=await connect(stub,host.data.token),b=await connect(stub,guest.data.token);
 a.ws.send(JSON.stringify({type:'start'}));let result=await b.wait(m=>m.room?.phase==='playing');expect(result.room.mergeMode).toBe('three');expect(result.room.players[0].highestTile).toBe(1);
 a.ws.send(JSON.stringify({type:'progress',round:1,score:3,shots:3,highestTile:3,blobs:[],done:true,paused:false}));await b.wait(m=>m.room?.players[0].score===3);
 await evictDurableObject(stub);
 b.ws.send(JSON.stringify({type:'progress',round:1,score:9,shots:4,highestTile:9,blobs:[],done:true,paused:false}));
 result=await a.wait(m=>m.room?.phase==='finished');expect(result.room.mergeMode).toBe('three');expect(result.room.winner).toBe(1);
});
