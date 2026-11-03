// Collision geometry for vessels whose openings can have different heights
// and angles. The original bottle retains its existing implementation.
export function createVessel({outline,mouthEdges,floor,fillLine,joinY,version=1}){
  const eps=.00001,cross=(ax,ay,bx,by)=>ax*by-ay*bx;
  const same=(a,b)=>Math.abs(a.x-b.x)<eps&&Math.abs(a.y-b.y)<eps;
  const edges=outline.map((a,i)=>{
    const b=outline[(i+1)%outline.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    return {a,b,dx,dy,nx:dy/length,ny:-dx/length,mouth:mouthEdges.some(m=>(same(a,m.a)&&same(b,m.b))||(same(a,m.b)&&same(b,m.a)))};
  }).filter(e=>Number.isFinite(e.nx));
  const walls=edges.filter(e=>!e.mouth),mouths=edges.filter(e=>e.mouth);
  const top=Math.min(...outline.map(p=>p.y)),mouthBottom=Math.max(...mouths.flatMap(m=>[m.a.y,m.b.y]));
  const history=new WeakMap();
  function polygon(x,y,nodes=outline){
    let inside=false;
    for(let i=0,j=nodes.length-1;i<nodes.length;j=i++){
      const a=nodes[i],b=nodes[j];
      if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
  }
  function nearest(x,y,segments=edges){
    let best={distance:Infinity};
    for(const e of segments){
      const t=Math.max(0,Math.min(1,((x-e.a.x)*e.dx+(y-e.a.y)*e.dy)/(e.dx*e.dx+e.dy*e.dy)));
      const qx=e.a.x+e.dx*t,qy=e.a.y+e.dy*t,distance=(x-qx)**2+(y-qy)**2;
      if(distance<best.distance)best={...e,x:qx,y:qy,distance,t};
    }
    return best;
  }
  function contains(x,y,tolerance=0){
    if(y<top-Math.max(0,tolerance)||y>floor+Math.max(0,tolerance))return false;
    const inside=polygon(x,y);
    if(inside&&tolerance===0)return true;
    const d=nearest(x,y).distance;
    return tolerance<0?inside&&d>tolerance*tolerance:inside||d<=tolerance*tolerance;
  }
  function insideBottle(x,y,tolerance=0){
    if(y<3-tolerance)return false;
    if(y<top)return x>=3-tolerance&&x<=357+tolerance;
    return contains(x,y,tolerance);
  }
  function bottleLeftAt(y){
    if(y<top)return 3;
    let left=180;
    for(const e of edges){
      if(y<Math.min(e.a.y,e.b.y)||y>Math.max(e.a.y,e.b.y))continue;
      if(Math.abs(e.dy)<eps){left=Math.min(left,e.a.x,e.b.x);continue;}
      left=Math.min(left,e.a.x+e.dx*(y-e.a.y)/e.dy);
    }
    return left;
  }
  function overlapsBottleInterior(body){
    const nodes=body.nodes??[{x:body.x,y:body.y}];
    if(nodes.some(p=>contains(p.x,p.y,-.005)))return true;
    for(let i=0;i<nodes.length;i++)for(const e of edges){
      const a=nodes[i],b=nodes[(i+1)%nodes.length],sx=b.x-a.x,sy=b.y-a.y,denom=cross(sx,sy,e.dx,e.dy);
      if(Math.abs(denom)<eps)continue;
      const t=cross(e.a.x-a.x,e.a.y-a.y,e.dx,e.dy)/denom,u=cross(e.a.x-a.x,e.a.y-a.y,sx,sy)/denom;
      if(t>eps&&t<1-eps&&u>eps&&u<1-eps)return true;
    }
    return walls.some(e=>{
      const x=(e.a.x+e.b.x)/2+e.nx*.02,y=(e.a.y+e.b.y)/2+e.ny*.02;
      return contains(x,y,-.001)&&polygon(x,y,nodes);
    });
  }
  function updateBottleState(body){
    if(body.spilled)return true;
    body.inBottle=overlapsBottleInterior(body);if(body.inBottle)body.hasEntered=true;
    const nodes=body.nodes??[body],minY=Math.min(...nodes.map(p=>p.y)),maxY=Math.max(...nodes.map(p=>p.y));
    if(!body.inBottle&&(minY>mouthBottom+1||(body.hasEntered&&maxY>mouthBottom+1&&(body.vy??0)>=0))){body.spilled=true;return true;}
    return false;
  }
  // Each opening stops particles at its own height. The side mouths sit lower
  // than the center neck, so one global line let chamber blobs above the fill
  // mark slip through the center mouth and spring back in.
  function openingY(x){
    let best=null;
    for(const m of mouths){
      if(Math.abs(m.dx)<eps)continue;
      const minX=Math.min(m.a.x,m.b.x),maxX=Math.max(m.a.x,m.b.x);
      if(x<minX||x>maxX)continue;
      const t=Math.max(0,Math.min(1,(x-m.a.x)/m.dx)),y=m.a.y+m.dy*t;
      if(best===null||y>best)best=y;
    }
    return best;
  }
  function bottleWalls(body,animateExterior=false){
    if(body.spilled&&!animateExterior)return;
    const entered=!body.spilled&&(body.inBottle||body.hasEntered),nodes=body.nodes;
    let votes=0,count=0,straddle=false;
    const gate=p=>openingY(p.x)??mouthBottom;
    const settled=p=>p.y>gate(p)&&(history.get(p)?.y??p.py??p.y)>gate(p);
    const owned=p=>(p.bottleSide??contains(p.x,p.y))||(entered&&p.y>=floor);
    for(let i=0;i<nodes.length;i++){
      const a=nodes[i],b=nodes[(i+1)%nodes.length];if(!settled(a))continue;
      count++;if(owned(a))votes++;if(settled(b)&&owned(a)!==owned(b))straddle=true;
    }
    const deep=entered&&nodes.every(p=>p.y>joinY),mostlyInside=votes*2>=count;
    const outsideMouths=Number.isFinite(body.x)&&!mouths.some(m=>body.x>=Math.min(m.a.x,m.b.x)&&body.x<=Math.max(m.a.x,m.b.x));
    const centerOpening=Number.isFinite(body.x)?openingY(body.x)??mouthBottom:mouthBottom;
    const forced=body.spilled||body.y<=centerOpening||!(straddle||deep)?null:mostlyInside?true:outsideMouths?false:null;
    // A blob whose center is still down in the chamber cannot shed particles
    // out an opening. Releasing them is what made a full pile jump.
    const allowRelease=!entered||!Number.isFinite(body.x)||!contains(body.x,body.y)||body.y<=centerOpening+30;
    for(const p of nodes){
      let vx=p.x-p.px,vy=p.y-p.py;
      const pinned=forced!==null&&p.y>gate(p);
      let side=pinned?forced:p.bottleSide??contains(p.px,p.py);
      if(entered&&forced!==false&&contains(body.x,body.y)&&p.y>floor)side=true;
      const origin=history.get(p)??(side?{x:p.x,y:p.y}:{x:p.px,y:p.py});
      if(p.y<3){p.y=3;vy=Math.abs(vy)*.04;p.py=p.y-vy;}
      const sx=p.x-origin.x,sy=p.y-origin.y,hits=[];
      if(sx*sx+sy*sy>.000001&&(Math.min(origin.y,p.y)<joinY||side!==contains(p.x,p.y))){
        for(const e of edges){
          const denominator=cross(sx,sy,e.dx,e.dy);if(Math.abs(denominator)<eps)continue;
          const ax=e.a.x-origin.x,ay=e.a.y-origin.y,t=cross(ax,ay,e.dx,e.dy)/denominator,u=cross(ax,ay,sx,sy)/denominator;
          if(t>eps&&t<=1&&u>=0&&u<=1)hits.push({...e,t,x:origin.x+sx*t,y:origin.y+sy*t});
        }
      }
      hits.sort((a,b)=>a.t-b.t);let hit=null,mouthHit=null;
      for(const e of hits){
        const entering=sx*e.nx+sy*e.ny>0;
        if(e.mouth){if(!mouthHit)mouthHit=e;if(!pinned&&(allowRelease||entering))side=entering;continue;}
        if(entering!==side){hit=e;break;}
      }
      p.bottleSide=side;
      const nowInside=contains(p.x,p.y);
      if(!hit&&side===nowInside){history.set(p,{x:p.x,y:p.y});continue;}
      const blockedMouth=!hit&&mouthHit&&side&&!allowRelease;
      const q=hit??(blockedMouth?mouthHit:nearest(p.x,p.y,walls)),sign=side?1:-1,nx=q.nx*sign,ny=q.ny*sign;
      const closing=vx*nx+vy*ny;
      // Pulling a particle back from outside the glass is recovery, not an impact.
      const recovering=!hit&&!contains(origin.x,origin.y,.001);
      if(closing<0){const response=recovering||blockedMouth?1:-closing>.12?1.25:1;vx-=closing*response*nx;vy-=closing*response*ny;}
      p.x=q.x+nx*.03;p.y=q.y+ny*.03;
      // Near a lip endpoint, nudge along its wall before taking the normal.
      if(side&&!contains(p.x,p.y,.001)){
        const t=Math.max(.002,Math.min(.998,hit?((q.x-q.a.x)*q.dx+(q.y-q.a.y)*q.dy)/(q.dx*q.dx+q.dy*q.dy):q.t));
        p.x=q.a.x+q.dx*t+nx*.03;p.y=q.a.y+q.dy*t+ny*.03;
      }
      if(side&&!contains(p.x,p.y,.001)){
        const anchor=contains(body.x,body.y)?body:{x:180,y:(joinY+floor)/2};
        let lo=0,hi=1;
        for(let i=0;i<12;i++){
          const mid=(lo+hi)/2,x=p.x+(anchor.x-p.x)*mid,y=p.y+(anchor.y-p.y)*mid;
          if(contains(x,y,.001))hi=mid;else lo=mid;
        }
        p.x+=(anchor.x-p.x)*hi;p.y+=(anchor.y-p.y)*hi;
      }
      p.px=p.x-vx*.995;p.py=p.y-vy*.995;history.set(p,{x:p.x,y:p.y});
    }
  }
  function trace(ctx,close=false){
    ctx.beginPath();ctx.moveTo(outline[0].x,outline[0].y);
    for(const e of edges){if(!close&&e.mouth)ctx.moveTo(e.b.x,e.b.y);else ctx.lineTo(e.b.x,e.b.y);}
    if(close)ctx.closePath();
  }
  return {BOTTLE_VERSION:version,BOTTLE_MOUTH:top,BOTTLE_FLOOR:floor,FILL_LINE:fillLine,bottleOutline:outline,
    bottleLeftAt,insideBottle,contains,overlapsBottleInterior,updateBottleState,bottleWalls,trace,mouths};
}
