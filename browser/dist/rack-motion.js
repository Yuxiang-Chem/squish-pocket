import {bottleFor} from './bottles.js?v=33';
import {prepare,measure,membrane,overlap,contact,separateBodies} from './softbody.js?v=29';
import {materialFor,normalizePhysics} from './physics-settings.js?v=29';
import {HOLE,clusterLayout,trayRadius,preparationWalls,returnTarget} from './preparation.js?v=33';
import {eject} from './ejection.js?v=29';
import {outlinesTouch,renderedOutline} from './preparation-contact.js?v=29';
import {MAX_LEVEL} from './engine.js?v=33';
import {insertedOrder} from './preparation-gesture.js?v=29';
export {trayRadius};
export const RACK_Y=HOLE.y;
const copy=items=>items.map(item=>({...item}));
const STEP=1/120,MERGE_GROWTH=.5;
// Damped jelly pop: .65 at contact, ~1.15 peak at 0.12 s, within 1% of 1 by 0.5 s.
export function mergePopScale(seconds){return 1-.35*Math.cos(26.2*seconds)*Math.exp(-7.06*seconds);}
// Starts wide along the merge axis (two bodies fusing), then jiggles flat.
const wobbleFor=seconds=>.14*Math.cos(30*seconds)*Math.exp(-7.5*seconds);
function bodyFor(item,x,y,vx=0,blobSize=150,physics={stiffness:10,viscosity:0}){
  const body={preparation:true,age:0,restAspect:{x:1.4,y:1/1.4},id:item.id,level:item.level,x,y,vx,vy:0,shape:Array(24).fill(0),spring:Array(24).fill(0),renderRadius:trayRadius(item.level,blobSize)};
  if(vx)eject(body,body.renderRadius,physics);else prepare(body,body.renderRadius,STEP);measure(body,STEP);return body;
}
function moveBody(body,x,y){
  const dx=x-body.x,dy=y-body.y;
  for(const p of body.nodes){p.x+=dx;p.px+=dx;p.y+=dy;p.py+=dy;}
  measure(body,STEP);
}

// Arrivals are free projectiles, not easing curves. The existing soft-body
// contact solver transfers momentum and deforms every touching membrane.
export class RackMotion{
  constructor(reduced=false){
    this.vessel=bottleFor('classic');this.reduced=reduced;this.visual=new Map();this.rest=new Map();this.queue=[];this.segment=null;this.accumulator=0;
    this.held=null;this.order=[];this.contactPairs=[];this.activeDrags=new Set();this.contactEvents=[];this.settleTimes=new Map();this.mergeBursts=[];this.setPhysics();this.stats={contacts:0,impacts:[],maxDeformation:0};
  }
  setBottle(id){this.vessel=bottleFor(id);}
  setPhysics(settings){
    const previous=this.physics?.blobSize??150;this.physics=normalizePhysics(settings);this.material=materialFor(this.physics);
    if(previous!==this.physics.blobSize){
    for(const item of this.visual.values()){
      const body=item.body,newRadius=trayRadius(item.level,this.physics.blobSize),ratio=newRadius/body.renderRadius;body.renderRadius=newRadius;
      for(const p of body.nodes){const vx=p.x-p.px,vy=p.y-p.py;p.x=body.x+(p.x-body.x)*ratio;p.y=body.y+(p.y-body.y)*ratio;p.px=p.x-vx;p.py=p.y-vy;}
      measure(body,STEP);
    }
    if(!this.busy)this.rest=new Map(clusterLayout(this.order,this.physics.blobSize,this.vessel).map(p=>[p.id,{x:p.x,y:p.y}]));
    }
  }
  get busy(){return !!this.segment||this.queue.length>0;}
  get items(){return [...this.visual.values()].filter(b=>b.alpha>.001);}
  record(item,x,y,vx=0){return {...item,x,y,scale:1,alpha:1,squash:null,glow:0,body:bodyFor(item,x,y,vx,this.physics.blobSize,this.physics)};}
  // Merge points for the renderer's ring and particles; drained by the caller.
  takeMergeBursts(){const bursts=this.mergeBursts;this.mergeBursts=[];return bursts;}
  reset(items){
    this.order=copy(items);
    this.visual.clear();this.rest.clear();this.queue=[];this.segment=null;this.accumulator=0;this.held=null;this.contactPairs=[];this.activeDrags.clear();this.contactEvents=[];this.settleTimes.clear();this.mergeBursts=[];
    this.stats={contacts:0,impacts:[],maxDeformation:0};
    clusterLayout(items,this.physics.blobSize,this.vessel).forEach(item=>{this.visual.set(item.id,this.record(item,item.x,item.y));this.rest.set(item.id,{x:item.x,y:item.y});});
  }
  place(id,x,y=RACK_Y){const item=this.visual.get(id);if(item){moveBody(item.body,x,y);item.x=x;item.y=y;}}
  interrupt(items=this.order){
    // User input retargets the springs; existing bodies keep moving from their
    // current pose instead of being snapped home or waiting for the queue.
    this.release();this.queue=[];this.segment=null;this.order=copy(items);
    const targets=clusterLayout(items,this.physics.blobSize,this.vessel),keep=new Set(items.map(b=>b.id));
    for(const id of this.visual.keys())if(!keep.has(id))this.visual.delete(id);
    for(const target of targets){
      const item=this.visual.get(target.id);
      if(item){item.alpha=1;item.scale=1;item.squash=null;item.glow=0;item.body.kinematic=false;}
      else this.visual.set(target.id,this.record(target,target.x,target.y));
    }
    this.rest=new Map(targets.map(item=>[item.id,{x:item.x,y:item.y}]));
    for(const id of this.activeDrags)if(!keep.has(id)){this.activeDrags.delete(id);this.settleTimes.delete(id);}
    this.contactEvents=this.contactEvents.filter(p=>keep.has(p.a)&&keep.has(p.b));
  }
  queueDragContact(a,b){
    if(this.held?.merge===false&&(a.id===this.held.id||b.id===this.held.id))return;
    if((!this.activeDrags.has(a.id)&&!this.activeDrags.has(b.id))||a.level!==b.level||a.level>=MAX_LEVEL)return;
    if(!this.contactEvents.some(p=>(p.a===a.id&&p.b===b.id)||(p.a===b.id&&p.b===a.id)))this.contactEvents.push({a:a.id,b:b.id});
  }
  takeContacts(){const contacts=this.contactEvents;this.contactEvents=[];return contacts;}
  setHeldPose(pose){if(this.held)this.held.pose=pose;}
  contactOutline(item){return this.held?.id===item.id?renderedOutline(item.body,this.held.pose):item.body;}
  hold(id,x,y,pose={sx:1,sy:1,tilt:0},merge=true){
    if(this.busy)this.interrupt();
    const item=this.visual.get(id);if(!item)return false;
    item.body.kinematic=true;this.held={id,x,y,pose,merge};
    if(merge)this.activeDrags.add(id);
    else{this.activeDrags.delete(id);this.contactEvents=this.contactEvents.filter(p=>p.a!==id&&p.b!==id);}
    this.settleTimes.delete(id);item.returning=false;
    const start={x:item.x,y:item.y},steps=Math.max(1,Math.ceil(Math.hypot(x-start.x,y-start.y)/Math.min(4,item.body.renderRadius*.35)));
    // Sweep rather than teleport: fast left/right gestures must not skip a blob.
    for(let k=1;k<=steps;k++){
      this.place(id,start.x+(x-start.x)*k/steps,start.y+(y-start.y)*k/steps);
      for(const other of this.items)if(other.id!==id&&outlinesTouch(this.contactOutline(item),this.contactOutline(other)))this.queueDragContact(item,other);
    }
    return true;
  }
  charge(id,home,power,dx=0){
    const item=this.visual.get(id);if(!item)return;
    const b=item.body,stretch=1+power*.55,ratio=stretch/(b.chargeStretch??1);
    for(const p of b.nodes){const vx=p.x-p.px,vy=p.y-p.py;p.x=b.x+(p.x-b.x)/ratio;p.y=b.y+(p.y-b.y)*ratio;p.px=p.x-vx;p.py=p.y-vy;}
    b.chargeStretch=stretch;b.restAspect={x:1.4/stretch,y:stretch/1.4};measure(b,STEP);
    this.hold(id,home.x+Math.max(-12,Math.min(12,dx*.08)),home.y+power*10,undefined,false);
  }
  previewInsertion(id,index){
    this.previewing=true;
    const order=index===null?this.order:insertedOrder(this.order,id,index);
    this.rest=new Map(clusterLayout(order,this.physics.blobSize,this.vessel).map(p=>[p.id,{x:p.x,y:p.y}]));
  }
  clearPreview(){
    if(!this.previewing)return;
    this.previewing=false;this.rest=new Map(clusterLayout(this.order,this.physics.blobSize,this.vessel).map(p=>[p.id,{x:p.x,y:p.y}]));
  }
  release(velocity={vx:0,vy:0}){
    this.clearPreview();
    const item=this.visual.get(this.held?.id);this.held=null;if(item)item.body.kinematic=false;
    if(item?.body.chargeStretch){delete item.body.chargeStretch;item.body.restAspect={x:1.4,y:1/1.4};}
    if(item){item.returning=Math.hypot(item.x-HOLE.x,item.y-HOLE.y)>55;item.returnSide=item.x<=HOLE.x?-1:1;}
    if(item)for(const p of item.body.nodes){p.px=p.x-Math.max(-350,Math.min(350,velocity.vx))*STEP;p.py=p.y-Math.max(-350,Math.min(350,velocity.vy))*STEP;}
  }
  play(events,finalItems,removeId=null){
    if(this.busy)this.interrupt(events[0]?.before??finalItems);
    this.order=copy(finalItems);
    this.release();
    for(const event of events)if(event.kind==='merge'){
      const active=(event.from??[]).some(id=>this.activeDrags.has(id));
      for(const id of event.from??[]){this.activeDrags.delete(id);this.settleTimes.delete(id);}
      if(active)this.activeDrags.add(event.id);
    }
    const readyIds=new Set(finalItems.map(item=>item.id));
    for(const id of this.activeDrags)if(!readyIds.has(id)){this.activeDrags.delete(id);this.settleTimes.delete(id);}
    this.contactEvents=this.contactEvents.filter(p=>readyIds.has(p.a)&&readyIds.has(p.b));this.settleTimes.clear();
    if(removeId!==null)this.visual.delete(removeId);
    this.queue=events.map(e=>({...e,before:copy(e.before??[]),after:copy(e.after??[])}));
    this.queue.push({kind:'shift',after:copy(finalItems)});this.segment=null;this.begin();
  }
  begin(){
    const event=this.queue.shift();if(!event){this.segment=null;return;}
    const target=new Map(clusterLayout(event.after,this.physics.blobSize,this.vessel).map(item=>[item.id,item]));
    if(event.kind==='arrive'&&!this.visual.has(event.id)){
      const fromLeft=event.side==='left';
      this.visual.set(event.id,this.record({id:event.id,level:event.level},fromLeft?-32:392,RACK_Y,fromLeft?1080:-1080));
    }
    if(event.kind==='merge'){
      const result=target.get(event.id);
      for(const id of event.from??[]){const source=this.visual.get(id);if(source&&result)target.set(id,{...source,x:result.x,y:result.y});}
      if(result){const record=this.record(result,result.x,result.y);record.scale=0;record.alpha=0;this.visual.set(event.id,record);}
    }
    for(const [id,item] of target)if(!this.visual.has(id))this.visual.set(id,this.record(item,item.x,item.y));
    this.segment={event,target,start:new Map([...this.visual].map(([id,b])=>[id,{x:b.x,y:b.y}])),time:0,hitAt:null,mergeAt:null,affected:new Set(event.kind==='arrive'?[event.id]:[])};
  }
  bounds(body){preparationWalls(body,this.vessel);}
  simulate(dt){
    const s=this.segment,event=s?.event;
    const merging=new Set(s?.mergeAt!==null&&s?.mergeAt!==undefined?event.from??[]:[]);
    const active=this.items.filter(item=>!merging.has(item.id));this.contactPairs=[];
    for(const item of active){
      if(item.id===this.held?.id){this.place(item.id,this.held.x,this.held.y);continue;}
      const b=item.body;b.age+=dt;if(b.ejection&&b.age>b.ejection.relaxation*7)delete b.ejection;
      const waiting=event?.kind==='arrive'&&!s.affected.has(item.id);
      const target=(waiting?s.start.get(item.id):s?.target.get(item.id))??this.rest.get(item.id)??{x:item.x,y:RACK_Y};
      const incoming=event?.kind==='arrive'&&item.id===event.id;
      const flying=incoming&&s.hitAt===null&&s.time<.4;
      const mergeSource=event?.kind==='merge'&&(event.from??[]).includes(item.id);
      const k=flying?0:mergeSource?90:30,damping=flying?0:mergeSource?12:9;
      if(item.returning&&Math.hypot(b.x-HOLE.x,b.y-HOLE.y)<45&&b.y<100-b.renderRadius)item.returning=false;
      const home=this.rest.get(item.id)??s?.target.get(item.id)??HOLE;
      const attract=mergeSource?target:item.returning?returnTarget(b,item.returnSide,home,this.vessel):target;
      const ax=(attract.x-b.x)*k-b.vx*damping,ay=(attract.y-b.y)*k-b.vy*damping;
      const retention=Math.exp(-(this.material.drag+1.3)*dt);
      for(const p of b.nodes){
        const vx=Math.max(-9,Math.min(9,(p.x-p.px)*retention)),vy=Math.max(-5,Math.min(5,(p.y-p.py)*retention));
        p.px=p.x;p.py=p.y;p.x+=vx+ax*dt*dt;p.y+=vy+ay*dt*dt;
      }
    }
    for(let iteration=0;iteration<4;iteration++){
      for(const item of active){
        membrane(item.body,item.body.renderRadius,this.material);
        this.bounds(item.body,event?.kind==='arrive'&&item.id===event.id&&s.hitAt===null);
        measure(item.body,dt);
      }
      for(let i=0;i<active.length-1;i++)for(let j=i+1;j<active.length;j++){
        const a=active[i],b=active[j];
        if((this.activeDrags.has(a.id)||this.activeDrags.has(b.id))&&outlinesTouch(this.contactOutline(a),this.contactOutline(b)))this.queueDragContact(a,b);
        if(!overlap(a.body,b.body))continue;
        const hitA=contact(a.body,b.body,a.body.renderRadius,b.body.renderRadius);
        const hitB=contact(b.body,a.body,b.body.renderRadius,a.body.renderRadius);
        if(!hitA&&!hitB)continue;
        this.stats.contacts++;this.queueDragContact(a,b);
        if(!this.contactPairs.some(p=>p.a===a.id&&p.b===b.id))this.contactPairs.push({a:a.id,b:b.id});
        if(event?.kind==='arrive'){s.affected.add(a.id);s.affected.add(b.id);}
        if(!this.stats.impacts.some(p=>p.a===a.id&&p.b===b.id))this.stats.impacts.push({a:a.id,b:b.id});
        if(event?.kind==='arrive'&&(a.id===event.id||b.id===event.id)&&s.hitAt===null)s.hitAt=s.time;
        if(event?.kind==='merge'&&s.mergeAt===null&&(event.from??[]).includes(a.id)&&(event.from??[]).includes(b.id))this.startMerge();
      }
    }
    if(this.held)this.place(this.held.id,this.held.x,this.held.y);
    const resolved=this.items;
    separateBodies(resolved.map(item=>item.body),b=>b.renderRadius,b=>this.bounds(b));
    for(const item of resolved){
      this.bounds(item.body);measure(item.body,dt);item.x=item.body.x;item.y=item.body.y;
      for(const p of item.body.nodes)this.stats.maxDeformation=Math.max(this.stats.maxDeformation,Math.abs(Math.hypot(p.x-item.x,p.y-item.y)/item.body.renderRadius-1));
    }
    if(!this.busy)for(const id of this.activeDrags){
      const item=this.visual.get(id),home=this.rest.get(id);
      const settled=item&&home&&this.held?.id!==id&&Math.hypot(item.x-home.x,item.y-home.y)<Math.max(2,item.body.renderRadius*.2)&&Math.hypot(item.body.vx,item.body.vy)<8;
      const time=settled?(this.settleTimes.get(id)??0)+dt:0;this.settleTimes.set(id,time);
      if(time>.3&&!this.contactEvents.some(p=>p.a===id||p.b===id)){this.activeDrags.delete(id);this.settleTimes.delete(id);}
    }
    if(event?.kind==='arrive'&&s.hitAt===null){
      const item=this.visual.get(event.id),goal=s.target.get(event.id);
      if(item&&goal&&((event.side==='left'&&item.x>=goal.x)||(event.side==='right'&&item.x<=goal.x)))s.hitAt=s.time;
    }
  }
  startMerge(){
    const s=this.segment;if(!s||s.mergeAt!==null)return;
    const sources=(s.event.from??[]).map(id=>this.visual.get(id)).filter(Boolean),result=this.visual.get(s.event.id);
    if(!result||!sources.length)return;
    const x=sources.reduce((n,b)=>n+b.body.x,0)/sources.length,y=sources.reduce((n,b)=>n+b.body.y,0)/sources.length;
    const axis=sources.length>1?Math.atan2(sources[1].body.y-sources[0].body.y,sources[1].body.x-sources[0].body.x):0;
    result.body=bodyFor(result,x,y,0,this.physics.blobSize,this.physics);result.x=x;result.y=y;result.alpha=1;result.scale=.65;result.glow=1;result.squash={angle:axis,amount:wobbleFor(0)};
    for(const source of sources){source.alpha=0;source.scale=0;source.squash=null;}s.mergeAt=s.time;
    this.mergeBursts.push({x,y,level:result.level,radius:result.body.renderRadius});
  }
  finish(){
    const s=this.segment,keep=new Set(s.event.after.map(item=>item.id));
    for(const id of this.visual.keys())if(!keep.has(id))this.visual.delete(id);
    if(s.event.kind==='merge'){const result=this.visual.get(s.event.id);if(result){result.alpha=1;result.scale=1;result.squash=null;result.glow=0;}}
    if(s.event.kind==='shift'){
      this.rest=new Map([...s.target].map(([id,item])=>[id,{x:item.x,y:item.y}]));
      for(const [id,target] of s.target){
        const item=this.visual.get(id);if(!item)continue;
        moveBody(item.body,target.x,target.y);
        measure(item.body,STEP);const vx=item.body.vx*STEP,vy=item.body.vy*STEP;
        for(const p of item.body.nodes){p.px=p.x-((p.x-p.px)-vx)*.25;p.py=p.y-((p.y-p.py)-vy)*.25;}
        item.x=target.x;item.y=target.y;item.alpha=1;item.scale=1;
      }
    }
    this.begin();
  }
  tick(dt){
    const s=this.segment;
    if(!s){this.simulate(dt);return;}
    s.time+=dt;
    if(this.reduced){
      for(const [id,target] of s.target)this.place(id,target.x,target.y);
      if(s.time>=.025)this.finish();return;
    }
    if(s.event.kind==='shift'){
      const t=Math.min(1,s.time/.32),ease=1-(1-t)**3;
      for(const [id,target] of s.target){
        const item=this.visual.get(id),start=s.start.get(id);if(!item||!start)continue;
        const direction=Math.sign(target.x-start.x),arc=Math.abs(target.x-start.x)>70?direction*18*Math.sin(Math.PI*t):0;
        moveBody(item.body,start.x+(target.x-start.x)*ease,start.y+(target.y-start.y)*ease+arc);
        item.x=item.body.x;item.y=item.body.y;
      }
      this.simulate(dt);
      if(t>=1)this.finish();return;
    }
    this.simulate(dt);
    if(s.event.kind==='arrive'){
      if((s.hitAt!==null&&s.time-s.hitAt>.30)||s.time>1.1)this.finish();
    }else if(s.event.kind==='merge'){
      if(s.mergeAt!==null){
        const age=s.time-s.mergeAt,t=Math.min(1,age/MERGE_GROWTH);
        for(const id of s.event.from??[]){const old=this.visual.get(id);if(old){old.alpha=0;old.scale=0;}}
        const result=this.visual.get(s.event.id);
        if(result){result.alpha=1;result.scale=t>=1?1:mergePopScale(age);result.squash=t>=1?null:{angle:result.squash?.angle??0,amount:wobbleFor(age)};result.glow=Math.max(0,1-age/.25);}
        if(t>=1)this.finish();
      }else{
        // Sources reach toward each other while the spring pulls them in.
        const sources=(s.event.from??[]).map(id=>this.visual.get(id)).filter(Boolean);
        if(sources.length>1){
          const cx=sources.reduce((n,b)=>n+b.x,0)/sources.length,cy=sources.reduce((n,b)=>n+b.y,0)/sources.length;
          for(const source of sources)source.squash={angle:Math.atan2(cy-source.y,cx-source.x),amount:Math.min(.16,s.time*.8)};
        }
      }
    }
  }
  update(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    this.accumulator+=Math.min(3,dt);
    while(this.accumulator>=STEP){this.tick(STEP);this.accumulator-=STEP;}
  }
}
