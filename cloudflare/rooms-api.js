const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const validCode=code=>/^[A-HJ-NP-Z2-9]{6}$/.test(code);
const cookieName=code=>`sq_room_${code}`;
const cookie=(request,code)=>request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${cookieName(code)}=`))?.slice(cookieName(code).length+1);
async function rpc(stub,action,data){
  const result=await stub.command(action,data);
  if(!result.ok)throw Object.assign(new Error(result.error),{status:result.status});return result.data;
}
function response(request,{code,token}){
  const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
  return Response.json({code},{headers:{'Cache-Control':'no-store','Set-Cookie':`${cookieName(code)}=${token}; Path=/api/rooms/${code}; HttpOnly; SameSite=Strict; Max-Age=21600${secure}`}});
}
export async function roomsAPI(request,env,readBody){
  const url=new URL(request.url);
  if(!env.ROOMS)return Response.json({error:'Multiplayer is temporarily unavailable.'},{status:503});
  if(url.pathname==='/api/rooms'&&request.method==='POST'){
    const data=await readBody(request);
    for(let attempt=0;attempt<3;attempt++){
      const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>alphabet[n%alphabet.length]).join('');
      const result=await rpc(env.ROOMS.getByName(`match:${code}`),'initialize',{code,name:data.name,bottleId:data.bottleId});
      if(result)return response(request,result);
    }
    return Response.json({error:'Please try creating a room again.'},{status:503});
  }
  const match=url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})\/(join|session|connect|leave)$/);
  if(!match||!validCode(match[1]))return Response.json({error:'Invalid room code.'},{status:404});
  const [,code,action]=match,stub=env.ROOMS.getByName(`match:${code}`),token=cookie(request,code);
  if(action==='join'&&request.method==='POST'){
    const data=await readBody(request);return response(request,await rpc(stub,'join',{name:data.name,token}));
  }
  if(action==='session'&&request.method==='GET')return Response.json(await rpc(stub,'session',{token}),{headers:{'Cache-Control':'no-store'}});
  if(action==='leave'&&request.method==='POST')return Response.json(await rpc(stub,'leave',{token}));
  if(action==='connect'&&request.method==='GET'){
    const headers=new Headers(request.headers);headers.delete('X-Room-Session');
    if(token)headers.set('X-Room-Session',token);
    return stub.fetch(new Request(request,{headers}));
  }
  return Response.json({error:'Not found.'},{status:404});
}
