import {outlinesTouch} from './preparation-contact.js?v=29';
import {validMilestoneRun} from './milestone-totals.js?v=89';
import {ruleFor,valueFor,connectedTriples} from './merge-rules.js?v=89';
import {prepare,measure,integrate,membrane,walls,overlap,contact,separateBodies} from './softbody.js?v=89';
import {normalizePhysics,materialFor,defaultPhysicsFor} from './physics-settings.js?v=89';
import {launchOrigin,shotVector} from './controls.js?v=6';
import {refillRack,hasMatchingNeighbors} from './rack.js?v=89';
import {bottleFor,isBottleId} from './bottles.js?v=89';
import {eject} from './ejection.js?v=29';
import {insertedOrder} from './preparation-gesture.js?v=29';
import {createWaterState,advanceWater,waterContact} from './water.js?v=89';
import {FLASK_RECORD_EPOCH,achievementEpochFor} from './record-epoch.js?v=89';
export const WIDTH=360, HEIGHT=420, DANGER=103, MAX_LEVEL=11;
export const radiusFor=(level,blobSize=150,mergeMode='two')=>13*1.2**level*blobSize/100*ruleFor(mergeMode).blobScale;
// Matching blobs fuse for MERGE_DELAY seconds before combining; the result then
// grows from its sources' radius over MERGE_GROW. Reduced motion merges on contact.
export const MERGE_DELAY=.3,MERGE_GROW=.3;
let instantMerge=false;
export function setReducedMergeMotion(reduced){instantMerge=!!reduced;}
const fused=(a,b)=>!!(a.fuse&&b.fuse&&a.fuse.id===b.fuse.id);
export function blob(level,x,y,vx=0,vy=0){
  return {level,x,y,vx,vy,age:0,danger:0,shape:Array(24).fill(0),spring:Array(24).fill(0)};
}
export class Engine {
  constructor(seed=Date.now(),bottleId='classic',mergeMode='two'){
    this.milestoneRun=crypto.randomUUID();this.milestoneCount=0;
    this.mergeMode=ruleFor(mergeMode).id;this.achievementEpoch=achievementEpochFor(this.mergeMode);this.blobScale=this.rules.blobScale;
    this.bottleId=isBottleId(bottleId)?bottleId:'classic';
    this.bottleVersion=this.vessel.BOTTLE_VERSION;this.recordEpoch=FLASK_RECORD_EPOCH;this.blobs=[];this.score=0;this.shots=0;this.current=0;this.next=1;this.highestLevel=0;
    this.cooldown=0;this.over=false;this.endReason=null;this.seed=seed>>>0;this.fuseSerial=0;
    this.physics=defaultPhysicsFor(this.bottleId);
    Object.defineProperty(this,'waterState',{value:createWaterState(),writable:true,configurable:true});
    this.rack=[];this.rackSerial=0;this.selectedId=null;this.incoming=this.newIncoming();
    this.rackEvents=refillRack(this,()=>this.newIncoming(),MAX_LEVEL);this.syncRack();
  }
  get rules(){return ruleFor(this.mergeMode);}
  value(level){return valueFor(level,this.mergeMode);}
  countMilestone(level){if(this.value(level)===this.rules.milestone)this.milestoneCount++;}
  get vessel(){return bottleFor(this.bottleId);}
  randomUint(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed;}
  setPhysics(settings){
    const oldSize=this.physics?.blobSize??150,oldScale=this.blobScale??1,next=normalizePhysics(settings);
    this.physics=next;this.blobScale=this.rules.blobScale;
    for(const b of this.blobs){
      const previousRadius=b.renderRadius??radiusFor(b.level,oldSize)*oldScale,nextRadius=this.bodyRadius(b),ratio=nextRadius/previousRadius;
      b.renderRadius=nextRadius;
      if(b.nodes&&Math.abs(ratio-1)>.000001){
        for(const p of b.nodes){
          const vx=p.x-p.px,vy=p.y-p.py;
          p.x=b.x+(p.x-b.x)*ratio;p.y=b.y+(p.y-b.y)*ratio;p.px=p.x-vx;p.py=p.y-vy;
        }
        measure(b,1/120);
      }
    }
  }
  radius(level){return radiusFor(level,this.physics.blobSize,this.mergeMode);}
  bodyRadius(b){
    const full=this.radius(b.level);if(b.grow===undefined)return full;
    const t=Math.min(1,b.grow/MERGE_GROW),start=1/1.2;
    return full*(start+(1-start)*(1-(1-t)**3));
  }
  random(){return (this.randomUint()>>>8)%this.rules.spawnLevels;}
  newIncoming(){return {level:this.random(),side:(this.randomUint()>>>31)?'left':'right'};}
  syncRack(){
    this.highestLevel=Math.max(this.highestLevel,...this.rack.map(b=>b.level),...this.blobs.map(b=>b.level));
    const selected=this.rack.find(b=>b.id===this.selectedId)??this.rack[1];
    this.selectedId=selected?.id??null;this.current=selected?.level??0;this.next=this.incoming.level;
  }
  select(id){
    if(!this.rack.some(b=>b.id===id))return false;
    this.selectedId=id;this.syncRack();return true;
  }
  rackOrder(){return this.rack;}
  reorderRack(id,index){
    if(this.over||!Number.isInteger(index)||index<0||index>=this.rack.length||!this.rack.some(b=>b.id===id)||this.rack[index].id===id)return false;
    const before=this.rack.map(b=>({...b}));this.rack=insertedOrder(this.rack,id,index);this.selectedId=id;
    this.rackEvents=[{kind:'shift',before,after:this.rack.map(b=>({...b}))},...refillRack(this,()=>this.newIncoming(),MAX_LEVEL)];
    this.syncRack();return true;
  }
  moveRack(sourceId,targetId){
    if(this.over||sourceId===targetId)return false;
    const i=this.rack.findIndex(b=>b.id===sourceId),j=this.rack.findIndex(b=>b.id===targetId);
    if(i<0||j<0)return false;
    const source=this.rack[i],target=this.rack[j],before=this.rack.map(b=>({...b}));
    if(this.rules.count===2&&source.level===target.level&&source.level<MAX_LEVEL){
      const result={id:++this.rackSerial,level:source.level+1};
      this.countMilestone(result.level);
      this.rack=this.rack.filter(b=>b.id!==sourceId);
      this.rack[this.rack.findIndex(b=>b.id===targetId)]=result;this.selectedId=result.id;
      this.rackEvents=[{kind:'merge',id:result.id,level:result.level,from:[sourceId,targetId],before,after:this.rack.map(b=>({...b}))},...refillRack(this,()=>this.newIncoming(),MAX_LEVEL)];
      this.syncRack();return 'merge';
    }
    [this.rack[i],this.rack[j]]=[this.rack[j],this.rack[i]];
    this.selectedId=this.rack[1].id;
    this.rackEvents=[{kind:'shift',before,after:this.rack.map(b=>({...b}))},...refillRack(this,()=>this.newIncoming(),MAX_LEVEL)];this.syncRack();return 'swap';
  }
  consumeRack(id,shot){
    shot.renderRadius=this.radius(shot.level);this.blobs.push(shot);
    this.rack=this.rack.filter(b=>b.id!==id);this.selectedId=null;
    this.rackEvents=refillRack(this,()=>this.newIncoming(),MAX_LEVEL);this.syncRack();
    this.cooldown=Math.max(.5,Math.min(1.6,this.rackEvents.length*.14));this.shots++;return true;
  }
  // The origin is the selected ready blob's position; omitted, shots start at the center.
  shoot(angle=0,power=0,immediate=false,origin=null){
    const from=launchOrigin(origin,power),velocity=shotVector(angle,power,from),index=this.rack.findIndex(b=>b.id===this.selectedId);
    if(this.over||(!immediate&&this.cooldown>0)||this.blobs.length>=90||!velocity||index<0)return false;
    const source=this.rack[index],shot=blob(source.level,from.x,from.y,velocity.vx,velocity.vy);shot.inBottle=false;
    eject(shot,this.radius(source.level),this.physics);return this.consumeRack(source.id,shot);
  }
  dropRack(){return false;}
  // A drag remains intentional while that blob returns; idle contact is inert.
  mergeRackContacts(pairs,draggedIds=[]){
    if(this.over)return false;
    const eligible=new Set(draggedIds);
    if(this.rules.count===3)return false;
    for(const {a,b} of pairs){
      if(a===b||(!eligible.has(a)&&!eligible.has(b)))continue;
      const first=this.rack.find(item=>item.id===a),second=this.rack.find(item=>item.id===b);
      if(!first||!second||first.level!==second.level||first.level>=MAX_LEVEL)continue;
      return this.moveRack(eligible.has(a)?a:b,eligible.has(a)?b:a)==='merge';
    }
    return false;
  }
  step(dt){
    if(this.over||!Number.isFinite(dt)||dt<=0||dt>1/30)return [];
    const {bottleWalls,insideBottle,BOTTLE_MOUTH,FILL_LINE,updateBottleState}=this.vessel;
    this.cooldown=Math.max(0,this.cooldown-dt);
    const material=materialFor(this.physics);
    const water=this.vessel.water;
    if(water)advanceWater(this.waterState,dt);
    const bs=this.blobs,delay=instantMerge?0:MERGE_DELAY,pairs=new Map();
    for(const b of bs)if(b.fuse){const list=pairs.get(b.fuse.id);if(list)list.push(b);else pairs.set(b.fuse.id,[b]);}
    const mergeCount=this.rules.count,contacts=[];
    for(const [id,list] of pairs){
      const [a,b]=list;
      if(list.length===mergeCount&&list.every(c=>!c.spilled&&c.level===a.level&&c.level<MAX_LEVEL)&&list.every(c=>list.some(other=>other!==c&&Math.hypot(c.x-other.x,c.y-other.y)<this.radius(c.level)*(mergeCount===3?5:3))))continue;
      for(const c of list)delete c.fuse;pairs.delete(id);
    }
    for(const b of bs){
      if(b.grow!==undefined&&(b.grow+=dt)>=MERGE_GROW)delete b.grow;
      const r=this.bodyRadius(b);b.renderRadius=r;
      prepare(b,r,dt);bottleWalls(b);integrate(b,dt,material,water);measure(b,dt);b.age+=dt;
      if(water)waterContact(b,water,this.waterState);
      if(b.ejection&&b.age>b.ejection.relaxation*7)delete b.ejection;
    }
    // Resting membranes retain a tiny solver gap; include their visible contact
    // so an arriving third blob can complete a settled or floating chain.
    if(mergeCount===3)for(let i=0;i<bs.length-1;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j];if(a.level===b.level&&!a.fuse&&!b.fuse&&!a.spilled&&!b.spilled&&outlinesTouch(a,b,1.5))contacts.push([a,b]);}
    // Fusing partners ignore each other's contact and are drawn together.
    for(const group of pairs.values()){
      if(group.length===2){
        const [a,b]=group;a.fuse.time+=dt;b.fuse.time+=dt;
        const pull=[[a,b],[b,a]].map(([self,other])=>({x:(other.x-self.x)*45-(self.vx-other.vx)*9.5,y:(other.y-self.y)*45-(self.vy-other.vy)*9.5}));
        group.forEach((self,k)=>{for(const p of self.nodes){p.x+=pull[k].x*dt*dt;p.y+=pull[k].y*dt*dt;}bottleWalls(self);measure(self,dt);});
      }else{
        const mean=key=>group.reduce((sum,b)=>sum+b[key],0)/group.length,c={x:mean('x'),y:mean('y'),vx:mean('vx'),vy:mean('vy')};
        for(const self of group){self.fuse.time+=dt;const ax=(c.x-self.x)*90-(self.vx-c.vx)*19,ay=(c.y-self.y)*90-(self.vy-c.vy)*19;for(const p of self.nodes){p.x+=ax*dt*dt;p.y+=ay*dt*dt;}bottleWalls(self);measure(self,dt);}
      }
    }
    for(let iteration=0;iteration<5;iteration++){
      for(const b of bs){membrane(b,this.bodyRadius(b),material);bottleWalls(b);measure(b,dt);}
      for(let i=0;i<bs.length-1;i++)for(let j=i+1;j<bs.length;j++){
        const a=bs[i],b=bs[j];
        if(a.spilled||b.spilled||fused(a,b))continue;
        if(!overlap(a,b))continue;
        const ra=this.bodyRadius(a),rb=this.bodyRadius(b);
        const hitA=contact(a,b,ra,rb),hitB=contact(b,a,rb,ra);
        if((hitA||hitB)&&mergeCount===3)contacts.push([a,b]);
        if(mergeCount===2&&(hitA||hitB)&&a.level===b.level&&a.level<MAX_LEVEL&&!a.fuse&&!b.fuse){
          const id=++this.fuseSerial;a.fuse={id,time:0};b.fuse={id,time:0};pairs.set(id,[a,b]);
        }
      }
      if(mergeCount===3)for(const group of connectedTriples(bs,contacts)){const id=++this.fuseSerial;for(const b of group)b.fuse={id,time:0};pairs.set(id,group);}
    }
    for(const b of bs){
      const r=this.bodyRadius(b);
      bottleWalls(b);measure(b,dt);
      for(let k=0;k<24;k++)b.shape[k]=Math.hypot(b.nodes[k].x-b.x,b.nodes[k].y-b.y)/r-1;
      if(b.fuse)continue;
      if(b.inBottle!==false&&b.age>2&&b.bounds.minY<FILL_LINE)b.danger+=dt;else b.danger=0;
    }
    const merged=new Set();
    const events=[...pairs.values()].filter(([a])=>a.fuse.time>=delay-1e-9).map(group=>{
      const [a,b]=group;for(const source of group)merged.add(source);
      const mean=key=>group.reduce((sum,b)=>sum+b[key],0)/group.length;
      const level=a.level+1,n=blob(level,mean('x'),mean('y'),mean('vx')*1.4,mean('vy')*1.4),axis=Math.atan2(b.y-a.y,b.x-a.x);
      // Start the merged membrane stretched along the pair, then let pressure round it out.
      for(let k=0;k<24;k++)n.shape[k]=.18*Math.cos(2*(k/24*Math.PI*2-axis));
      if(!instantMerge)n.grow=0;
      n.renderRadius=this.bodyRadius(n);prepare(n,n.renderRadius,dt);measure(n,dt);
      // A larger result still belongs to the same side of the glass. Its new
      // outline can extend below the base before the first wall projection.
      const interior=n.y>=BOTTLE_MOUTH&&insideBottle(n.x,n.y);
      n.hasEntered=!!(group.some(source=>source.hasEntered)||interior);
      for(const p of n.nodes)p.bottleSide=p.y>=BOTTLE_MOUTH&&(interior||insideBottle(p.x,p.y));
      bottleWalls(n);measure(n,dt);
      this.highestLevel=Math.max(this.highestLevel,level);
      this.countMilestone(level);this.score+=this.value(level);return {blob:n,value:this.value(level)};
    });
    if(merged.size)this.blobs=bs.filter(b=>!merged.has(b)).concat(events.map(e=>e.blob));
    separateBodies(this.blobs,b=>this.bodyRadius(b),bottleWalls,6,fused);
    for(const b of this.blobs)if(updateBottleState(b)){this.over=true;this.endReason='spill';}
    return events;
  }
  animateSpill(dt){
    if(!this.over||this.endReason!=='spill'||!Number.isFinite(dt)||dt<=0)return;
    if(this.vessel.water)advanceWater(this.waterState,Math.min(dt,.05));
    this.spillAccumulator=(this.spillAccumulator??0)+Math.min(dt,.05);
    const material=materialFor(this.physics);
    const {bottleWalls}=this.vessel;
    while(this.spillAccumulator>=1/120){this.spillAccumulator-=1/120;
      for(const b of this.blobs)if(b.spilled){integrate(b,1/120,material);membrane(b,this.radius(b.level),material);bottleWalls(b,true);measure(b,1/120);b.age+=1/120;}
    }
  }
  static restore(data){
    if(data?.milestoneRun!==undefined&&!validMilestoneRun(data.milestoneRun))return null;
    if(data?.milestoneCount!==undefined&&(!Number.isSafeInteger(data.milestoneCount)||data.milestoneCount<0||data.milestoneCount>1000000||!validMilestoneRun(data.milestoneRun)))return null;
    if(data?.achievementEpoch!==undefined&&(!Number.isSafeInteger(data.achievementEpoch)||data.achievementEpoch<1))return null;
    if(data?.blobScale!==undefined&&(!Number.isFinite(data.blobScale)||data.blobScale<=0||data.blobScale>2))return null;
    if(data?.mergeMode!==undefined&&!['two','three'].includes(data.mergeMode))return null;
    if(data?.recordEpoch!==undefined&&(!Number.isSafeInteger(data.recordEpoch)||data.recordEpoch<0))return null;
    if(data?.bottleId!==undefined&&!isBottleId(data.bottleId))return null;
    if(data?.highestLevel!==undefined&&(!Number.isInteger(data.highestLevel)||data.highestLevel<0||data.highestLevel>MAX_LEVEL))return null;
    if(!data||!Array.isArray(data.blobs)||data.blobs.length>90||!Number.isSafeInteger(data.score)||data.score<0||!Number.isSafeInteger(data.shots)||data.shots<0||![data.current,data.next].every(x=>Number.isInteger(x)&&x>=0&&x<=MAX_LEVEL)||!Number.isFinite(data.cooldown)||typeof data.over!=='boolean'||!Number.isInteger(data.seed))return null;
    for(const b of data.blobs){
      if(!Number.isInteger(b.level)||b.level<0||b.level>MAX_LEVEL||!['x','y','vx','vy','age','danger'].every(k=>Number.isFinite(b[k]))||!['shape','spring'].every(k=>Array.isArray(b[k])&&b[k].length===24&&b[k].every(Number.isFinite)))return null;
    }
    if(data.endReason!==undefined&&data.endReason!==null&&!['spill','overflow'].includes(data.endReason))return null;
    for(const b of data.blobs)if((b.inBottle!==undefined&&typeof b.inBottle!=='boolean')||(b.spilled!==undefined&&typeof b.spilled!=='boolean')||(b.hasEntered!==undefined&&typeof b.hasEntered!=='boolean')||(b.missedEntry!==undefined&&(b.missedEntry!==true||!b.spilled)))return null;
    for(const b of data.blobs)if(b.ejection&&(!['stretch','taper','relaxation'].every(k=>Number.isFinite(b.ejection[k]))||b.ejection.stretch<1||b.ejection.stretch>2||b.ejection.taper<0||b.ejection.taper>.9||b.ejection.relaxation<.1||b.ejection.relaxation>1))return null;
    for(const b of data.blobs)if(b.restAspect&&(!Number.isFinite(b.restAspect.x)||!Number.isFinite(b.restAspect.y)||b.restAspect.x<.5||b.restAspect.x>2||b.restAspect.y<.5||b.restAspect.y>2))return null;
    for(const b of data.blobs)if((b.fuse!==undefined&&(!b.fuse||!Number.isSafeInteger(b.fuse.id)||b.fuse.id<1||!Number.isFinite(b.fuse.time)||b.fuse.time<0||b.fuse.time>MERGE_DELAY+1))||(b.grow!==undefined&&(!Number.isFinite(b.grow)||b.grow<0||b.grow>MERGE_GROW)))return null;
    if(data.fuseSerial!==undefined&&(!Number.isSafeInteger(data.fuseSerial)||data.fuseSerial<0))return null;
    for(const b of data.blobs)if(b.nodes&&(!Array.isArray(b.nodes)||b.nodes.length!==24||!b.nodes.every(p=>['x','y','px','py'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<100000)&&(p.bottleSide===undefined||typeof p.bottleSide==='boolean'))))return null;
    const levelOK=n=>Number.isInteger(n)&&n>=0&&n<=MAX_LEVEL;
    if(data.rack&&(!Array.isArray(data.rack)||data.rack.length!==3||!data.rack.every(b=>levelOK(b.level)&&Number.isSafeInteger(b.id)&&b.id>0)||new Set(data.rack.map(b=>b.id)).size!==3||!data.rack.some(b=>b.id===data.selectedId)||!Number.isSafeInteger(data.rackSerial)||data.rackSerial<Math.max(...data.rack.map(b=>b.id))||!data.incoming||!Number.isInteger(data.incoming.level)||data.incoming.level<0||data.incoming.level>4||!['left','right'].includes(data.incoming.side)))return null;
    // Three capped values cannot be produced with only three slots and 2–32 entries.
    if(data.rack?.every(b=>b.level===MAX_LEVEL))return null;
    const restored=Object.assign(new Engine(undefined,data.bottleId??'classic',data.mergeMode??'two'),data);
    restored.achievementEpoch=data.achievementEpoch??1;restored.recordEpoch=data.recordEpoch??0;restored.blobScale=data.blobScale??1;
    restored.waterState=createWaterState();
    const {bottleWalls,BOTTLE_VERSION,BOTTLE_FLOOR}=restored.vessel;
    // Older saves have no serial; unpaired fuses are dropped on the next step.
    restored.fuseSerial=Math.max(restored.fuseSerial??0,...data.blobs.map(b=>b.fuse?.id??0));
    if(!data.rack){
      restored.rack=[{id:1,level:data.current},{id:2,level:data.next}];restored.rackSerial=2;restored.selectedId=1;
      restored.incoming=restored.newIncoming();restored.rackEvents=refillRack(restored,()=>restored.newIncoming(),MAX_LEVEL);
    }
    if(hasMatchingNeighbors(restored.rack))restored.rackEvents=refillRack(restored,()=>restored.newIncoming(),MAX_LEVEL);
    if(restored.bottleId==='classic'&&(data.bottleVersion??1)<2){
      // Lift an older settled pile with the shorter base, preserving its shape and momentum.
      for(const b of restored.blobs)if(b.age>2&&!b.spilled){
        b.y-=468-BOTTLE_FLOOR;
        if(b.nodes){for(const p of b.nodes){p.y-=468-BOTTLE_FLOOR;p.py-=468-BOTTLE_FLOOR;}measure(b,1/120);}
      }
    }
    if(data.bottleVersion!==BOTTLE_VERSION){
      // Fit entered blobs to the selected vessel when restoring legacy geometry.
      // Version-2 classic saves already use the current floor; do not lift again.
      for(const b of restored.blobs)if(!b.spilled&&(b.inBottle||b.hasEntered)&&b.nodes){
        for(const p of b.nodes)p.bottleSide=true;
        bottleWalls(b);measure(b,1/120);
      }
    }
    const resize=restored.blobScale!==restored.rules.blobScale;
    restored.bottleVersion=BOTTLE_VERSION;restored.setPhysics(data.physics);
    if(resize)for(const b of restored.blobs)if(b.nodes&&!b.spilled){bottleWalls(b);measure(b,1/120);}
    restored.syncRack();return restored;
  }
}
