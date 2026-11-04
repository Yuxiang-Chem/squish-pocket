import {bottleFor} from './bottles.js?v=62';
const original=bottleFor('classic');
export const HOLE={x:180,y:58};
export const trayRadius=(level,blobSize=150)=>Math.max(9,Math.min(22,13*1.2**level)*blobSize/100);
// A line of touching neighbors: the middle separates the two outer blobs.
export function clusterLayout(items,blobSize=150,vessel=original){
  if(vessel.rackSpread)return items.map((item,i)=>({...item,x:HOLE.x+(i-(items.length-1)/2)*vessel.rackSpread,y:HOLE.y}));
  if(!items.length)return [];
  const radii=items.map(b=>trayRadius(b.level,blobSize)),positions=[0];
  for(let i=1;i<items.length;i++)positions.push(positions[i-1]+(radii[i-1]+radii[i])*1.4*.93);
  const center=items.length===3?positions[1]:(positions[0]+positions.at(-1))/2;
  return items.map((item,i)=>({...item,x:HOLE.x+positions[i]-center,y:HOLE.y}));
}
export function outsideGlass(x,y,rx=0,ry=0,vessel=original){
  const {BOTTLE_MOUTH,BOTTLE_FLOOR,bottleLeftAt}=vessel;
  if(y+ry<BOTTLE_MOUTH-2||y-ry>BOTTLE_FLOOR+2)return true;
  let left=Infinity;
  for(let yy=Math.max(BOTTLE_MOUTH,y-ry);yy<=Math.min(BOTTLE_FLOOR,y+ry)+.001;yy+=2)left=Math.min(left,bottleLeftAt(yy));
  left=Math.min(left,bottleLeftAt(Math.max(BOTTLE_MOUTH,Math.min(BOTTLE_FLOOR,y))));
  return x+rx<left-3||x-rx>360-left+3;
}
// Stop the held body at the first glass crossing, even for a fast pointer jump.
export function dragOutsideGlass(from,to,radius,vessel=original){
  const valid=p=>outsideGlass(p.x,p.y,radius*1.45,radius*.85,vessel);
  const steps=Math.min(800,Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/4)));
  let previous=from;
  for(let k=1;k<=steps;k++){
    const next={x:from.x+(to.x-from.x)*k/steps,y:from.y+(to.y-from.y)*k/steps};
    if(!valid(next)){
      let lo=previous,hi=next;
      for(let n=0;n<12;n++){const mid={x:(lo.x+hi.x)/2,y:(lo.y+hi.y)/2};if(valid(mid))lo=mid;else hi=mid;}
      return {...lo,blocked:true};
    }
    previous=next;
  }
  return {...to,blocked:false};
}
export function preparationWalls(body,vessel=original){
  const {BOTTLE_MOUTH,bottleOutline,insideBottle}=vessel;
  const boundary=[...bottleOutline,bottleOutline[0]];
  for(const p of body.nodes){
    if(p.y<BOTTLE_MOUTH||!insideBottle(p.x,p.y))continue;
    let best=Infinity,qx=0,qy=0,nx=0,ny=-1;
    for(let i=1;i<boundary.length;i++){
      const a=boundary[i-1],b=boundary[i],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
      const x=a.x+t*dx,y=a.y+t*dy,d=(x-p.x)**2+(y-p.y)**2;
      if(d<best){best=d;qx=x;qy=y;const len=Math.hypot(dx,dy);nx=-dy/len;ny=dx/len;}
    }
    const distance=Math.sqrt(best);
    // This outline runs counter-clockwise on screen; its left normal is exterior.
    if(distance>.00001){nx=(qx-p.x)/distance;ny=(qy-p.y)/distance;}
    const vx=p.x-p.px,vy=p.y-p.py,closing=vx*nx+vy*ny;
    p.x=qx+nx*.5;p.y=qy+ny*.5;
    p.px=p.x-(vx-Math.min(0,closing)*nx);p.py=p.y-(vy-Math.min(0,closing)*ny);
  }
}

export function returnTarget(body,side,home=HOLE,vessel=original){
  const {BOTTLE_MOUTH,BOTTLE_FLOOR}=vessel;
  const rx=body.renderRadius*1.5,ry=body.renderRadius*.9;
  if(body.y<=BOTTLE_MOUTH-ry-6)return home;
  const outerX=side<0?-rx-12:360+rx+12;
  // First clear the base sideways, then move up the chosen side of the glass.
  if(body.y>BOTTLE_FLOOR-ry&&body.x>-rx-8&&body.x<360+rx+8)return {x:outerX,y:BOTTLE_FLOOR+ry+12};
  return {x:outerX,y:home.y};
}
