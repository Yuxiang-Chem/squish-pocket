// Deformable, area-preserving particle membranes. Contacts act on the actual
// outline, so a blob can flatten on the floor and squeeze between its neighbors.
import {DEFAULT_MATERIAL} from './physics-settings.js?v=75';
import {ejectionShape,ejectionPhase} from './ejection.js?v=29';
export const COUNT=24;
// Softer effective mass growth lets large jelly bodies respond to small hits.
export const inverseMass=(radius,preparation=false)=>1/Math.max(1,radius)**(preparation?2:1.6);
const TAU=Math.PI*2;
const directions=Array.from({length:COUNT},(_,k)=>({x:Math.cos(k/COUNT*TAU),y:Math.sin(k/COUNT*TAU)}));
export function prepare(b,r,dt){
  if(b.nodes)return;
  b.nodes=directions.map((d,k)=>{
    const radius=r*(1+(b.shape?.[k]??0));
    const x=b.x+d.x*radius*(b.restAspect?.x??1),y=b.y+d.y*radius*(b.restAspect?.y??1);
    return {x,y,px:x-b.vx*dt,py:y-b.vy*dt};
  });
}
export function measure(b,dt){
  let x=0,y=0,vx=0,vy=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of b.nodes){x+=p.x;y+=p.y;vx+=p.x-p.px;vy+=p.y-p.py;minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  b.x=x/COUNT;b.y=y/COUNT;b.vx=vx/(COUNT*dt);b.vy=vy/(COUNT*dt);
  b.bounds={minX,minY,maxX,maxY};
}
export function integrate(b,dt,material=DEFAULT_MATERIAL,water=null){
  const retention=Math.exp(-material.drag*dt);
  for(const p of b.nodes){
    const wet=water&&p.bottleSide&&!b.spilled?Math.max(0,Math.min(1,(p.y-water.level+3)/6)):0;
    const fluidDrag=Math.exp(-(water?.drag??0)*wet*dt);
    const dx=Math.max(-9,Math.min(9,(p.x-p.px)*retention*fluidDrag));
    const dy=Math.max(-9,Math.min(9,(p.y-p.py)*retention*fluidDrag));
    p.px=p.x;p.py=p.y;p.x+=dx;p.y+=dy+(680-(water?.buoyancy??0)*wet)*dt*dt;
  }
}
function distanceConstraint(a,b,rest,stiffness){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d<.001)return;
  const correction=(d-rest)/d*stiffness*.5;
  a.x+=dx*correction;a.y+=dy*correction;b.x-=dx*correction;b.y-=dy*correction;
}
export function membrane(b,r,material=DEFAULT_MATERIAL){
  const nodes=b.nodes,ax=b.restAspect?.x??1,ay=b.restAspect?.y??1,phase=ejectionPhase(b);
  if(b.restGeometry?.r!==r||b.restGeometry?.ax!==ax||b.restGeometry?.ay!==ay||b.restGeometry?.phase!==phase){
    const points=b.ejection?ejectionShape(COUNT,r,1+(b.ejection.stretch-1)*phase,b.ejection.taper*phase).map(p=>({x:p.x*ax,y:p.y*ay})):directions.map(d=>({x:d.x*r*ax,y:d.y*r*ay}));
    const distances=jump=>points.map((p,k)=>Math.hypot(p.x-points[(k+jump)%COUNT].x,p.y-points[(k+jump)%COUNT].y));
    // Derived geometry is transient; keep it out of saved simulation state.
    Object.defineProperty(b,'restGeometry',{value:{r,ax,ay,phase,points,edges:distances(1),bends:distances(2)},writable:true,configurable:true});
  }
  const rest=b.restGeometry.points;
  for(let k=0;k<COUNT;k++){
    distanceConstraint(nodes[k],nodes[(k+1)%COUNT],b.restGeometry.edges[k],material.edge);
    distanceConstraint(nodes[k],nodes[(k+2)%COUNT],b.restGeometry.bends[k],material.bend);
  }
  // Pressure is an area constraint, not a target circular outline.
  let area=0,gradientSquared=0;
  const gradients=[];
  for(let k=0;k<COUNT;k++){
    const p=nodes[k],next=nodes[(k+1)%COUNT],previous=nodes[(k+COUNT-1)%COUNT];
    area+=(p.x*next.y-next.x*p.y)*.5;
    const gx=(next.y-previous.y)*.5,gy=(previous.x-next.x)*.5;
    gradients.push({x:gx,y:gy});gradientSquared+=gx*gx+gy*gy;
  }
  const target=COUNT*.5*r*r*ax*ay*Math.sin(TAU/COUNT);
  const pressure=(target-area)/Math.max(1,gradientSquared)*.55;
  for(let k=0;k<COUNT;k++){
    const g=gradients[k],length=Math.hypot(g.x,g.y),scale=Math.min(1,r*.055/Math.max(.001,Math.abs(pressure)*length));
    nodes[k].x+=g.x*pressure*scale;nodes[k].y+=g.y*pressure*scale;
  }
  // A very weak, rotation-invariant rest shape prevents folds over long runs.
  let cx=0,cy=0,cross=0,dot=0;
  for(const p of nodes){cx+=p.x;cy+=p.y;}cx/=COUNT;cy/=COUNT;
  for(let k=0;k<COUNT;k++){const x=nodes[k].x-cx,y=nodes[k].y-cy,d=rest[k];dot+=x*d.x+y*d.y;cross+=y*d.x-x*d.y;}
  const angle=Math.atan2(cross,dot),c=Math.cos(angle),s=Math.sin(angle);
  for(let k=0;k<COUNT;k++){
    const p=nodes[k],d=rest[k];
    p.x+=(cx+(d.x*c-d.y*s)-p.x)*material.recovery;
    p.y+=(cy+(d.x*s+d.y*c)-p.y)*material.recovery;
  }
}
export function walls(b,width,height){
  for(const p of b.nodes){
    const vx=p.x-p.px,vy=p.y-p.py;
    if(p.x<3){p.x=3;p.px=p.x+Math.min(0,vx)*.06;}
    if(p.x>width-3){p.x=width-3;p.px=p.x+Math.max(0,vx)*.06;}
    if(p.y<3){p.y=3;p.py=p.y+Math.min(0,vy)*.04;}
    if(p.y>height-3){p.y=height-3;p.py=p.y+Math.max(0,vy)*.04;p.px=p.x-vx*.96;}
  }
}
export function overlap(a,b){return a.bounds.minX<=b.bounds.maxX+1&&a.bounds.maxX+1>=b.bounds.minX&&a.bounds.minY<=b.bounds.maxY+1&&a.bounds.maxY+1>=b.bounds.minY;}
function move(p,x,y){p.x+=x;p.y+=y;p.px+=x;p.py+=y;}
export function contact(a,b,ra,rb,strength=.85){
  let touched=false;
  const ns=b.nodes,inverseA=a.kinematic?0:inverseMass(ra,a.preparation),inverseB=b.kinematic?0:inverseMass(rb,b.preparation);
  for(const p of a.nodes){
    if(p.x<b.bounds.minX-1||p.x>b.bounds.maxX+1||p.y<b.bounds.minY-1||p.y>b.bounds.maxY+1)continue;
    let inside=false,bestDistance=Infinity,edge=0,bestT=0,qx=0,qy=0;
    for(let k=0;k<COUNT;k++){
      const u=ns[k],v=ns[(k+1)%COUNT];
      if((u.y>p.y)!==(v.y>p.y)&&p.x<(v.x-u.x)*(p.y-u.y)/(v.y-u.y)+u.x)inside=!inside;
      const dx=v.x-u.x,dy=v.y-u.y;
      const t=Math.max(0,Math.min(1,((p.x-u.x)*dx+(p.y-u.y)*dy)/Math.max(.0001,dx*dx+dy*dy)));
      const x=u.x+dx*t,y=u.y+dy*t,d=(p.x-x)**2+(p.y-y)**2;
      if(d<bestDistance){bestDistance=d;edge=k;bestT=t;qx=x;qy=y;}
    }
    if(!inside&&bestDistance>1)continue;
    touched=true;
    const u=ns[edge],v=ns[(edge+1)%COUNT],distance=Math.sqrt(bestDistance),w1=1-bestT,w2=bestT;
    let nx,ny;
    if(distance>.001){nx=(inside?qx-p.x:p.x-qx)/distance;ny=(inside?qy-p.y:p.y-qy)/distance;}
    else{const ex=v.x-u.x,ey=v.y-u.y,len=Math.max(.001,Math.hypot(ex,ey));nx=ey/len;ny=-ex/len;}
    const inverseSum=inverseA+inverseB*(w1*w1+w2*w2);
    if(inverseSum<.00000001)continue;
    const depth=(inside?distance+1:1-distance);
    const correction=Math.min(depth,Math.min(ra,rb)*(strength===1?.65:.3))*strength/inverseSum;
    const relative=((p.x-p.px)-(u.x-u.px)*w1-(v.x-v.px)*w2)*nx+((p.y-p.py)-(u.y-u.py)*w1-(v.y-v.py)*w2)*ny;
    move(p,nx*correction*inverseA,ny*correction*inverseA);
    move(u,-nx*correction*inverseB*w1,-ny*correction*inverseB*w1);
    move(v,-nx*correction*inverseB*w2,-ny*correction*inverseB*w2);
    if(relative<0){
      const response=a.preparation&&b.preparation?.92:-relative>.12?1.25:1;
      const impulse=-relative*response/inverseSum;
      p.px-=nx*impulse*inverseA;p.py-=ny*impulse*inverseA;
      u.px+=nx*impulse*inverseB*w1;u.py+=ny*impulse*inverseB*w1;
      v.px+=nx*impulse*inverseB*w2;v.py+=ny*impulse*inverseB*w2;
    }
  }
  return touched;
}

function convexHull(nodes){
  const sorted=[...nodes].sort((a,b)=>a.x-b.x||a.y-b.y),lower=[],upper=[];
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(const p of sorted.reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function separationVector(a,b){
  const ah=convexHull(a.nodes),bh=convexHull(b.nodes);let best=null,depth=Infinity;
  for(const hull of [ah,bh])for(let k=0;k<hull.length;k++){
    const p=hull[k],q=hull[(k+1)%hull.length],length=Math.hypot(q.x-p.x,q.y-p.y);
    if(length<.00001)continue;
    const nx=(q.y-p.y)/length,ny=(p.x-q.x)/length;
    let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
    for(const p of ah){const d=p.x*nx+p.y*ny;amin=Math.min(amin,d);amax=Math.max(amax,d);}
    for(const p of bh){const d=p.x*nx+p.y*ny;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d);}
    const negative=amax-bmin,positive=bmax-amin;
    if(negative<=.02||positive<=.02)return null;
    const d=Math.min(negative,positive);
    if(d<depth){depth=d;const direction=negative<positive?-1:1;best={x:nx*direction,y:ny*direction,depth:d+.25};}
  }
  return best;
}
function penetrates(a,b){
  for(const [first,second] of [[a,b],[b,a]])for(const p of first.nodes){
    let inside=false,distance=Infinity;
    for(let k=0;k<COUNT;k++){
      const u=second.nodes[k],v=second.nodes[(k+1)%COUNT],dx=v.x-u.x,dy=v.y-u.y;
      if((u.y>p.y)!==(v.y>p.y)&&p.x<dx*(p.y-u.y)/dy+u.x)inside=!inside;
      const t=Math.max(0,Math.min(1,((p.x-u.x)*dx+(p.y-u.y)*dy)/Math.max(.00001,dx*dx+dy*dy)));
      distance=Math.min(distance,(p.x-u.x-dx*t)**2+(p.y-u.y-dy*t)**2);
    }
    if(inside&&distance>.0025)return true;
  }
  // Thin crossing edges can overlap without containing any vertex.
  for(let i=0;i<COUNT;i++)for(let j=0;j<COUNT;j++){
    const p=a.nodes[i],q=a.nodes[(i+1)%COUNT],u=b.nodes[j],v=b.nodes[(j+1)%COUNT];
    const ax=q.x-p.x,ay=q.y-p.y,bx=v.x-u.x,by=v.y-u.y,d=ax*by-ay*bx;
    if(Math.abs(d)<.00001)continue;
    const t=((u.x-p.x)*by-(u.y-p.y)*bx)/d,s=((u.x-p.x)*ay-(u.y-p.y)*ax)/d;
    if(t>.00001&&t<.99999&&s>.00001&&s<.99999)return true;
  }
  return false;
}
function translateBody(body,x,y,boundary){
  if(body.kinematic)return 0;
  const oldX=body.x,oldY=body.y;
  for(const p of body.nodes)move(p,x,y);
  boundary(body);measure(body,1/120);
  return {x:body.x-oldX,y:body.y-oldY};
}
function untangle(a,b,ra,rb,boundary){
  const vector=separationVector(a,b);
  if(!vector||!penetrates(a,b))return false;
  const ia=a.kinematic?0:inverseMass(ra,a.preparation),ib=b.kinematic?0:inverseMass(rb,b.preparation),sum=ia+ib;
  if(!sum)return false;
  const wa=ia/sum,wb=ib/sum,{x,y,depth}=vector;
  const movedA=translateBody(a,x*depth*wa,y*depth*wa,boundary),movedB=translateBody(b,-x*depth*wb,-y*depth*wb,boundary);
  const da=movedA?movedA.x*x+movedA.y*y:0,db=movedB?-(movedB.x*x+movedB.y*y):0;
  const remaining=depth-da-db;
  // If the floor blocks one correction, the free neighbor takes the rest.
  if(remaining>.01){
    if(wa&&(!wb||da/wa>=db/wb))translateBody(a,x*remaining,y*remaining,boundary);
    else if(wb)translateBody(b,-x*remaining,-y*remaining,boundary);
  }
  return true;
}

// Finish each frame with non-penetration, after elastic recovery has acted.
// A held body is kinematic: neighbors yield rather than being pushed back into it.
export function separateBodies(bodies,radius,boundary=()=>{},passes=6,ignore=()=>false){
  for(let pass=0;pass<passes;pass++){
    for(const b of bodies){boundary(b);measure(b,1/120);}
    for(let i=0;i<bodies.length-1;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j];if(a.spilled||b.spilled||ignore(a,b)||!overlap(a,b))continue;
      contact(a,b,radius(a),radius(b),1);measure(a,1/120);measure(b,1/120);
      contact(b,a,radius(b),radius(a),1);measure(a,1/120);measure(b,1/120);
    }
  }
  // Vertex/edge relaxation alone can leave crossing or nested membranes after
  // a merge or resize. Translate only unresolved intersections, preserving
  // their deformation and velocity, then reapply the real glass boundary.
  for(let pass=0;pass<12;pass++){
    let corrected=false;
    for(let i=0;i<bodies.length-1;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j];if(a.spilled||b.spilled||ignore(a,b)||!overlap(a,b))continue;
      if(untangle(a,b,radius(a),radius(b),boundary))corrected=true;
    }
    if(!corrected)break;
  }
  for(const b of bodies){boundary(b);measure(b,1/120);}
}
