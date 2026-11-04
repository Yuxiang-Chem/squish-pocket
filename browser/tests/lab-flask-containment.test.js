// Historical crowded-pile regressions deliberately retain their original 150% size.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,blob} from '../dist/engine.js';
import {prepare,measure} from '../dist/softbody.js';

const dt=1/120;
function checkGlass(e){
  for(const b of e.blobs)if(!b.spilled){
    for(let i=0;i<b.nodes.length;i++){
      const a=b.nodes[i],c=b.nodes[(i+1)%b.nodes.length];
      if(a.bottleSide)assert.ok(e.vessel.contains(a.x,a.y,.005),'An interior particle stays inside the vessel');
      if(!a.bottleSide||!c.bottleSide)continue;
      // Particle-only assertions miss a membrane bridging two separate necks.
      for(let k=1;k<20;k++){
        const t=k/20,x=a.x+(c.x-a.x)*t,y=a.y+(c.y-a.y)*t;
        assert.ok(e.vessel.contains(x,y,.05),`level ${b.level} membrane crosses glass at ${x},${y}`);
      }
    }
  }
}
function crowded(){
  const e=new Engine(42,'lab-flask');e.setPhysics({blobSize:150});
  e.blobs=[blob(7,125,250),blob(2,180,190),blob(5,254,202),blob(4,255,292),blob(6,180,345),blob(3,110,350),blob(1,275,360)];
  for(const b of e.blobs){prepare(b,e.radius(b.level),dt);measure(b,dt);b.inBottle=true;b.hasEntered=true;for(const p of b.nodes)p.bottleSide=true;}
  return e;
}
function screenshotPile(){
  const e=new Engine(42,'lab-flask');e.setPhysics({blobSize:150});
  e.blobs=[blob(8,125,325),blob(6,82,215),blob(5,184,198),blob(6,290,282),blob(3,225,285),blob(4,246,377),blob(1,223,340),blob(2,236,218),blob(1,155,160),blob(0,280,193),blob(4,275,153)];
  for(const b of e.blobs){prepare(b,e.radius(b.level),dt);measure(b,dt);b.inBottle=true;b.hasEntered=true;for(const p of b.nodes)p.bottleSide=e.vessel.contains(p.x,p.y);}
  return e;
}
test('Partly entered blobs follow the angled neck glass in the reported crowded pile',()=>{
  const e=screenshotPile(),g=e.vessel;
  for(let step=0;step<360;step++){
    e.step(dt);assert.equal(e.over,false);checkGlass(e);
    if(step<60)continue;
    for(const b of e.blobs)if(g.contains(b.x,b.y))for(let i=0;i<24;i++){
      const a=b.nodes[i],c=b.nodes[(i+1)%24];
      for(let k=0;k<=20;k++){
        const t=k/20,x=a.x+(c.x-a.x)*t,y=a.y+(c.y-a.y)*t;
        const aboveOpening=y<g.BOTTLE_MOUTH||g.mouths.some(m=>x>=m.minX&&x<=m.maxX&&y<=m.a.y+m.dy*(x-m.a.x)/m.dx+.05);
        assert.ok(aboveOpening||g.contains(x,y,.05),`Partly entered level ${b.level} cuts glass at ${x},${y}, step ${step}`);
      }
    }
  }
});
test('Indexed containment and nearest-boundary tolerances match the full outline',()=>{
  const g=new Engine(42,'lab-flask').vessel,nodes=g.bottleOutline;
  let seed=42;
  for(let i=0;i<6000;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed/2**32*400-20;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed/2**32*340+90;
    let inside=false,distance=Infinity;
    for(let a=0,j=nodes.length-1;a<nodes.length;j=a++){
      const u=nodes[a],v=nodes[j],dx=v.x-u.x,dy=v.y-u.y;
      if((u.y>y)!==(v.y>y)&&x<dx*(y-u.y)/dy+u.x)inside=!inside;
      const t=Math.max(0,Math.min(1,((x-u.x)*dx+(y-u.y)*dy)/(dx*dx+dy*dy)));
      distance=Math.min(distance,(x-u.x-dx*t)**2+(y-u.y-dy*t)**2);
    }
    for(const tolerance of [0,.05,-.05])assert.equal(g.contains(x,y,tolerance),tolerance<0?inside&&distance>tolerance**2:inside||distance<=tolerance**2);
  }
});
test('Larger flask adds at least twenty percent playable area and preserves mouth positions',()=>{
  const g=new Engine(42,'lab-flask').vessel;
  const area=Math.abs(g.bottleOutline.reduce((sum,p,i)=>{const q=g.bottleOutline[(i+1)%g.bottleOutline.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
  assert.ok(area>59600.85*1.2);assert.ok(360-2*g.bottleLeftAt(300)>310);
  assert.equal(g.BOTTLE_VERSION,3);assert.equal(g.BOTTLE_FLOOR,408);
  assert.ok(g.mouths.some(m=>m.a.y===106&&m.b.y===106));
  assert.equal(new Engine(42).vessel.bottleLeftAt(300),10);
});
test('Crowded membranes cannot span the closed glass between the three necks',()=>{
  const e=crowded();
  for(let i=0;i<300;i++){e.step(dt);assert.equal(e.over,false);checkGlass(e);}
});
test('Older crowded flask saves repair neck penetration while retaining progress and blob size',()=>{
  const e=crowded();e.bottleVersion=2;e.score=9036;e.shots=77;
  const restored=Engine.restore(JSON.parse(JSON.stringify(e)));
  assert.equal(restored.bottleVersion,3);assert.equal(restored.score,9036);assert.equal(restored.shots,77);
  assert.equal(restored.physics.blobSize,150);checkGlass(restored);
  for(let i=0;i<120;i++){restored.step(dt);checkGlass(restored);}
  assert.equal(restored.over,false);assert.equal(restored.shots,77);
});
test('Oversized shots and merges retain whole-membrane glass containment',()=>{
  for(const level of [5,7,9])for(const x of [94,180,266]){
    const e=new Engine(42,'lab-flask');e.setPhysics({blobSize:150});e.rack=[{id:1,level},{id:2,level:0},{id:3,level:1}];e.rackSerial=3;e.selectedId=1;e.syncRack();
    e.shoot(0,1,true,{x,y:58});
    for(let i=0;i<180&&!e.over;i++){e.step(dt);checkGlass(e);}
  }
  const e=new Engine(7,'lab-flask');e.setPhysics({blobSize:150});e.blobs=[blob(5,150,218),blob(5,200,218)];
  for(let i=0;i<180&&!e.over;i++){e.step(dt);checkGlass(e);}
  assert.ok(e.score>0,'A merge near the necks completes normally');
});
test('Blobs filling the three-neck flask above the red line settle without spontaneous jumping',()=>{
  const e=new Engine(42,'lab-flask');e.setPhysics({blobSize:150});
  e.blobs=[
    blob(7,120,340),blob(6,235,345),blob(4,55,290),blob(3,300,300),
    blob(5,180,260),blob(2,100,235),blob(1,255,240),blob(4,150,195),
    blob(3,220,195),blob(6,95,185)
  ];
  for(const b of e.blobs){prepare(b,e.radius(b.level),dt);measure(b,dt);b.inBottle=true;b.hasEntered=true;for(const p of b.nodes)p.bottleSide=true;}
  for(let s=0;s<360;s++){
    const previous=new Map(e.blobs.map(b=>[b,b.y]));
    e.step(dt);assert.equal(e.over,false);checkGlass(e);
    if(s>=180)for(const b of e.blobs){
      const oldY=previous.get(b);
      if(oldY!==undefined)assert.ok(Math.abs(b.y-oldY)<1.5,`Blob level ${b.level} jumped ${Math.abs(b.y-oldY)} at step ${s}`);
    }
  }
  assert.ok(Math.min(...e.blobs.map(b=>b.bounds.minY))<e.vessel.FILL_LINE,'Pile remains above the red fill line');
});
