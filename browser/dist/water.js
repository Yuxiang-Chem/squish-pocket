// Stylized water: buoyancy and drag act on submerged interior particles;
// ripples and droplets are visual effects, separate from score/game-over rules.
export function createWaterState(){return {time:0,ripples:[],droplets:[],contacts:new WeakMap()};}
export function advanceWater(state,dt){
  state.time+=dt;
  for(const r of state.ripples)r.life-=dt;
  state.ripples=state.ripples.filter(r=>r.life>0);
  for(const p of state.droplets){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=680*dt;}
  state.droplets=state.droplets.filter(p=>p.life>0&&p.y<450&&p.x>-40&&p.x<400);
}
export function waterContact(body,water,state){
  if(body.spilled)return;
  const wet=body.nodes.some(p=>p.bottleSide&&p.y>=water.level),previous=state.contacts.get(body);
  state.contacts.set(body,{wet,vy:body.vy});
  if(!previous||previous.wet||!wet)return;
  const impact=Math.max(0,previous.vy,body.vy);
  state.ripples.push({x:body.x,life:1.6,amplitude:Math.min(9,2+impact/160)});
  state.ripples=state.ripples.slice(-12);
  if(impact<650)return;
  const count=Math.min(20,8+Math.floor(impact/100));
  for(let i=0;i<count;i++){
    const angle=-Math.PI*.92+Math.PI*.84*i/Math.max(1,count-1),speed=(140+Math.min(impact,1200)*.17)*(.65+(i%4)*.12);
    state.droplets.push({x:body.x+(i%3-1)*3,y:water.level-2,vx:Math.cos(angle)*speed+body.vx*.12,vy:Math.sin(angle)*speed,life:1.1,radius:1.3+(i%3)*.55});
  }
  state.droplets=state.droplets.slice(-96);
}
function trace(ctx,vessel){
  ctx.beginPath();vessel.bottleOutline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
}
export function waterHeight(water,state,x){
  const time=state?.time??0;
  let y=water.level+Math.sin(x*.032+time*1.5)*1.6+Math.sin(x*.058-time*1.9)*.7;
  for(const r of state?.ripples??[]){const age=1.6-r.life,d=Math.abs(x-r.x);y+=Math.sin(d*.09-age*15)*Math.exp(-Math.abs(d-age*110)/55)*r.amplitude*(r.life/1.6);}
  return y;
}
function surface(ctx,water,state){
  ctx.moveTo(0,waterHeight(water,state,0));for(let x=4;x<=360;x+=4)ctx.lineTo(x,waterHeight(water,state,x));
}
export function waterBottle(base,id,name){
  const water=Object.freeze({level:base.id==='lab-flask'?244:238,buoyancy:1120,drag:3.8});
  return Object.freeze({...base,id,name,baseBottleId:base.id,water,
    drawBottleBack(ctx,state){
      base.drawBottleBack(ctx);ctx.save();trace(ctx,base);ctx.clip();
      ctx.beginPath();surface(ctx,water,state);ctx.lineTo(360,420);ctx.lineTo(0,420);ctx.closePath();
      const fill=ctx.createLinearGradient(0,water.level,0,408);fill.addColorStop(0,'#80c8dd65');fill.addColorStop(1,'#4ba5c483');ctx.fillStyle=fill;ctx.fill();
      ctx.strokeStyle='#e4fbff70';ctx.lineWidth=1;
      for(let i=0;i<7;i++){const x=55+i*40,y=water.level+20+((i*37-(state?.time??0)*10)%140+140)%140;ctx.beginPath();ctx.arc(x,y,1.3+i%3*.6,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    },
    drawBottleFront(ctx,state){
      ctx.save();trace(ctx,base);ctx.clip();
      ctx.beginPath();surface(ctx,water,state);ctx.lineTo(360,420);ctx.lineTo(0,420);ctx.closePath();ctx.fillStyle='#8bd5e21a';ctx.fill();
      ctx.beginPath();surface(ctx,water,state);ctx.strokeStyle='#f0fdffdc';ctx.lineWidth=2;ctx.stroke();ctx.translate(0,2);ctx.strokeStyle='#58aacb99';ctx.lineWidth=.8;ctx.stroke();ctx.restore();
      base.drawBottleFront(ctx);
      ctx.save();
      for(const p of state?.droplets??[]){ctx.globalAlpha=Math.min(.9,p.life*2);ctx.fillStyle='#66b9d6';ctx.beginPath();ctx.ellipse(p.x,p.y,p.radius,p.radius*1.45,Math.atan2(p.vy,p.vx)-Math.PI/2,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }
  });
}
