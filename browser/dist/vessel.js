// Collision geometry for vessels whose openings can have different heights
// and angles. The original bottle retains its existing implementation.
export function createVessel({outline,mouthEdges,floor,fillLine,joinY,version=1}){
  const eps=.00001,cross=(ax,ay,bx,by)=>ax*by-ay*bx;
  const same=(a,b)=>Math.abs(a.x-b.x)<eps&&Math.abs(a.y-b.y)<eps;
  const edges=outline.map((a,i)=>{
    const b=outline[(i+1)%outline.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    return {a,b,dx,dy,lengthSquared:length*length,minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y),nx:dy/length,ny:-dx/length,mouth:mouthEdges.some(m=>(same(a,m.a)&&same(b,m.b))||(same(a,m.b)&&same(b,m.a)))};
  }).filter(e=>Number.isFinite(e.nx));
  const walls=edges.filter(e=>!e.mouth),mouths=edges.filter(e=>e.mouth);
  const top=Math.min(...outline.map(p=>p.y)),mouthBottom=Math.max(...mouths.flatMap(m=>[m.a.y,m.b.y]));
  // Only a few edges intersect a horizontal ray through this static outline.
  // Index their full y ranges once; queries still use the exact segments.
  const rowHeight=4,rows=Array.from({length:Math.ceil((floor-top)/rowHeight)+1},()=>[]);
  for(const e of edges)for(let row=Math.floor((e.minY-top)/rowHeight);row<=Math.floor((e.maxY-top)/rowHeight);row++)rows[row]?.push(e);
  const cellSize=16,columns=Math.ceil(Math.max(...outline.map(p=>p.x))/cellSize)+1,
    cellRows=Math.ceil(floor/cellSize)+1,cells=Array.from({length:columns*cellRows},()=>[]);
  let query=0;
  for(const e of edges)for(let y=Math.floor(e.minY/cellSize);y<=Math.floor(e.maxY/cellSize);y++)
    for(let x=Math.floor(e.minX/cellSize);x<=Math.floor(e.maxX/cellSize);x++)cells[y*columns+x]?.push(e);
  // A center-to-wall distance plus the cell's half diagonal bounds the
  // nearest wall everywhere in that cell. Exclude only edges whose bounding
  // boxes are provably farther away; projection remains exact.
  const nearestCells=cells.map((_,index)=>{
    const left=index%columns*cellSize,up=Math.floor(index/columns)*cellSize,cx=left+cellSize/2,cy=up+cellSize/2;
    let distance=Infinity;
    for(const e of walls){
      const t=Math.max(0,Math.min(1,((cx-e.a.x)*e.dx+(cy-e.a.y)*e.dy)/e.lengthSquared));
      distance=Math.min(distance,(cx-e.a.x-e.dx*t)**2+(cy-e.a.y-e.dy*t)**2);
    }
    const reach=(Math.sqrt(distance)+cellSize/Math.sqrt(2))**2;
    return edges.filter(e=>Math.max(e.minX-left-cellSize,0,left-e.maxX)**2+Math.max(e.minY-up-cellSize,0,up-e.maxY)**2<=reach);
  });
  function* nearbyEdges(a,b){
    const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y),stamp=++query;
    for(let y=Math.max(0,Math.floor(minY/cellSize));y<=Math.min(cellRows-1,Math.floor(maxY/cellSize));y++)
      for(let x=Math.max(0,Math.floor(minX/cellSize));x<=Math.min(columns-1,Math.floor(maxX/cellSize));x++)for(const e of cells[y*columns+x]){
        if(e.seen===stamp)continue;e.seen=stamp;
        if(e.maxX<minX||e.minX>maxX||e.maxY<minY||e.minY>maxY)continue;
        yield e;
      }
  }
  function crossesBoundary(a,b){
    const dx=b.x-a.x,dy=b.y-a.y;
    for(const e of nearbyEdges(a,b)){
      const d=cross(dx,dy,e.dx,e.dy);if(Math.abs(d)<eps)continue;
      const t=cross(e.a.x-a.x,e.a.y-a.y,e.dx,e.dy)/d,u=cross(e.a.x-a.x,e.a.y-a.y,dx,dy)/d;
      if(t>eps&&t<1-eps&&u>=0&&u<=1)return true;
    }
    return false;
  }
  const history=new WeakMap(),entryHistory=new WeakMap();
  const orderedMouths=[...mouths].sort((a,b)=>Math.min(a.a.x,a.b.x)-Math.min(b.a.x,b.b.x));
  const entryGaps=orderedMouths.slice(1).map((m,i)=>({
    left:(orderedMouths[i].a.x+orderedMouths[i].b.x)/2,right:(m.a.x+m.b.x)/2,
    y:Math.max(orderedMouths[i].a.y,orderedMouths[i].b.y,m.a.y,m.b.y)
  }));
  const neckPockets=entryGaps.map(gap=>{
    const segments=walls.filter(e=>Math.min(e.a.x,e.b.x)>gap.left&&Math.max(e.a.x,e.b.x)<gap.right&&Math.max(e.a.y,e.b.y)<joinY);
    const tip=segments.flatMap(e=>[e.a,e.b]).reduce((a,b)=>a.y>b.y?a:b);
    return {tip,left:gap.left,right:gap.right};
  });
  function polygon(x,y,nodes=outline){
    let inside=false;
    if(nodes===outline){
      for(const e of rows[Math.floor((y-top)/rowHeight)]??[])
        if((e.a.y>y)!==(e.b.y>y)&&x<e.a.x+e.dx*(y-e.a.y)/e.dy)inside=!inside;
      return inside;
    }
    for(let i=0,j=nodes.length-1;i<nodes.length;j=i++){
      const a=nodes[i],b=nodes[j];
      if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
  }
  function nearest(x,y,segments=edges){
    let best=null,distance=Infinity,bestX=0,bestY=0,bestT=0;
    const cx=Math.floor(x/cellSize),cy=Math.floor(y/cellSize);
    const candidates=cx>=0&&cx<columns&&cy>=0&&cy<cellRows?nearestCells[cy*columns+cx]:segments;
    for(const e of candidates){
      if(segments===walls&&e.mouth)continue;
      const bx=Math.max(e.minX-x,0,x-e.maxX),by=Math.max(e.minY-y,0,y-e.maxY);
      if(bx*bx+by*by>=distance)continue;
      const t=Math.max(0,Math.min(1,((x-e.a.x)*e.dx+(y-e.a.y)*e.dy)/e.lengthSquared));
      const qx=e.a.x+e.dx*t,qy=e.a.y+e.dy*t,d=(x-qx)**2+(y-qy)**2;
      if(d<distance){best=e;distance=d;bestX=qx;bestY=qy;bestT=t;}
    }
    return {...best,x:bestX,y:bestY,distance,t:bestT};
  }
  function contains(x,y,tolerance=0){
    if(y<top-Math.max(0,tolerance)||y>floor+Math.max(0,tolerance))return false;
    const inside=polygon(x,y);
    if(inside&&tolerance>=0)return true;
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
    if(!body.inBottle&&(minY>mouthBottom+1||(body.hasEntered&&maxY>mouthBottom+1&&(body.vy??0)>=0))){
      body.spilled=true;
      if(entryGaps.some(g=>body.x>g.left&&body.x<g.right&&body.y>=g.y&&body.y<joinY&&!contains(body.x,body.y)))missEntry(body,body.x);
      return true;
    }
    return false;
  }
  function missEntry(body,x){
    body.spilled=true;body.missedEntry=true;body.inBottle=false;
    // Let the missed shot tumble away from the necks during the reveal.
    const outward=(x<180?-1:1)*Math.max(180,Math.abs(body.vx??0));
    for(const p of body.nodes??[]){p.bottleSide=false;p.px=p.x-outward/120;}
  }
  function projectPoint(p){
    if(contains(p.x,p.y))return;
    let vx=p.x-p.px,vy=p.y-p.py;
    const q=nearest(p.x,p.y,walls),closing=vx*q.nx+vy*q.ny;
    if(closing<0){vx-=closing*q.nx;vy-=closing*q.ny;}
    p.x=q.x+q.nx*.03;p.y=q.y+q.ny*.03;
    if(!contains(p.x,p.y,.001)){
      const t=Math.max(.002,Math.min(.998,q.t));
      p.x=q.a.x+q.dx*t+q.nx*.03;p.y=q.a.y+q.dy*t+q.ny*.03;
    }
    p.px=p.x-vx;p.py=p.y-vy;
  }
  function openAboveMouth(x,y){
    return y<top||mouths.some(m=>x>=m.minX&&x<=m.maxX&&y<=m.a.y+m.dy*(x-m.a.x)/m.dx);
  }
  function projectChords(nodes,allowExterior=false){
    for(let pass=0;pass<4;pass++){
      let adjusted=false;
      for(let i=0;i<nodes.length;i++){
        const a=nodes[i],b=nodes[(i+1)%nodes.length];
        if((!allowExterior&&(!a.bottleSide||!b.bottleSide))||Math.min(a.y,b.y)>=joinY)continue;
        if(!crossesBoundary(a,b))continue;
        let worst=null,worstDist=0,worstT=.5;
        for(let k=1;k<20;k++){
          const t=k/20,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
          if(!contains(x,y)&&!(allowExterior&&openAboveMouth(x,y))){
            const q=nearest(x,y,walls),d=Math.sqrt(q.distance);
            if(d>worstDist){worstDist=d;worst=q;worstT=t;}
          }
        }
        if(worst&&worstDist>.005){
          const push=(worstDist+.03)/Math.max(.35,(1-worstT)**2+worstT**2);
          for(const [p,w] of [[a,1-worstT],[b,worstT]]){
            let vx=p.x-p.px,vy=p.y-p.py;
            const closing=vx*worst.nx+vy*worst.ny;
            if(closing<0){vx-=closing*worst.nx;vy-=closing*worst.ny;}
            p.x+=worst.nx*push*w;p.y+=worst.ny*push*w;
            p.px=p.x-vx;p.py=p.y-vy;
            if(allowExterior&&!p.bottleSide){
              if(contains(p.x,p.y))p.bottleSide=true;
              else if(!openAboveMouth(p.x,p.y)){p.bottleSide=true;projectPoint(p);}
            }else projectPoint(p);
          }
          adjusted=true;
        }
      }
      if(!adjusted)break;
    }
  }
  function repairNeckBridges(body,allowExterior=false){
    const nodes=body.nodes;
    if(body.spilled)return;
    const inside=nodes.filter(p=>p.bottleSide),allInside=inside.length===nodes.length;
    if(!inside.length)return;
    const minY=Math.min(...inside.map(p=>p.y));
    if(minY>=joinY)return;
    // Resolve saddle-straddling edges and curved neck chords locally so blobs
    // above the fill line never translate downward into neighbors underneath.
    for(const {tip} of neckPockets){
      const clearY=tip.y+.2;
      for(let i=0;i<nodes.length;i++){
        const a=nodes[i],b=nodes[(i+1)%nodes.length];
        if(!a.bottleSide||!b.bottleSide||(a.x<tip.x)===(b.x<tip.x))continue;
        const u=(tip.x-a.x)/(b.x-a.x),yAtTip=a.y+(b.y-a.y)*u;
        if(yAtTip<clearY){
          const deficit=clearY-yAtTip,denom=(1-u)**2+u**2;
          for(const [p,w] of [[a,(1-u)/denom],[b,u/denom]]){
            const dy=deficit*w,vy=Math.max(0,p.y-p.py);
            p.y+=dy;p.py=p.y-vy;
            projectPoint(p);
          }
        }
      }
    }
    projectChords(nodes,allowExterior);
    for(const {tip,left,right} of neckPockets){
      const clearY=tip.y+.2;
      let stillBridging=allInside&&polygon(tip.x,tip.y,nodes);
      for(let i=0;i<nodes.length&&!stillBridging;i++){
        const a=nodes[i],b=nodes[(i+1)%nodes.length];
        if(!a.bottleSide||!b.bottleSide||Math.min(a.y,b.y)>=joinY)continue;
        if(!crossesBoundary(a,b))continue;
        for(let k=1;k<20;k++){
          const t=k/20,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
          if(x>left&&x<right&&y<clearY&&!contains(x,y,.02)){stillBridging=true;break;}
        }
      }
      if(stillBridging){
        for(const p of inside)if(p.y<clearY&&p.x>left-15&&p.x<right+15){
          const vy=Math.max(0,p.y-p.py);
          p.y=clearY;p.py=p.y-vy;
          projectPoint(p);
        }
        projectChords(nodes,allowExterior);
      }
    }
    for(const p of nodes)history.set(p,{x:p.x,y:p.y});
  }
  function openingY(x){
    for(const m of mouths)if(x>=m.minX&&x<=m.maxX)return m.a.y+m.dy*(x-m.a.x)/m.dx;
    // Between/beyond openings the closed neck glass is already present at top.
    return top;
  }
  function bottleWalls(body,animateExterior=false){
    if(body.spilled&&!animateExterior)return;
    // A missed neck falls in front of the flask, clear of its narrow glass
    // saddles. Otherwise the soft membrane can bridge both lips indefinitely.
    if(body.missedEntry)return;
    const center={x:body.nodes.reduce((sum,p)=>sum+p.x,0)/body.nodes.length,y:body.nodes.reduce((sum,p)=>sum+p.y,0)/body.nodes.length};
    const tracked=entryHistory.get(body),previous=tracked??{x:body.x??center.x,y:body.y??center.y,entered:!!body.hasEntered&&contains(center.x,center.y)};
    if(!previous.entered){
      for(const gap of entryGaps){
        const crossing=center.y>previous.y&&previous.y<=gap.y&&center.y>=gap.y;
        const savedMiss=!tracked&&center.y>=gap.y&&center.y<joinY&&!contains(center.x,center.y);
        if(!crossing&&!savedMiss)continue;
        const x=crossing?previous.x+(center.x-previous.x)*(gap.y-previous.y)/(center.y-previous.y):center.x;
        if(x<=gap.left||x>=gap.right||contains(x,crossing?gap.y:center.y))continue;
        missEntry(body,x);
        return;
      }
    }
    entryHistory.set(body,{...center,entered:previous.entered||contains(center.x,center.y)});
    const entered=!body.spilled&&(body.inBottle||body.hasEntered),nodes=body.nodes;
    let votes=0,count=0,straddle=false;
    const settled=p=>p.y>mouthBottom&&(history.get(p)?.y??p.py??p.y)>mouthBottom;
    const owned=p=>(p.bottleSide??contains(p.x,p.y))||(entered&&p.y>=floor);
    for(let i=0;i<nodes.length;i++){
      const a=nodes[i],b=nodes[(i+1)%nodes.length];if(!settled(a))continue;
      count++;if(owned(a))votes++;if(settled(b)&&owned(a)!==owned(b))straddle=true;
    }
    const deep=entered&&nodes.every(p=>p.y>joinY),mostlyInside=votes*2>=count;
    const outsideMouths=Number.isFinite(body.x)&&!mouths.some(m=>body.x>=Math.min(m.a.x,m.b.x)&&body.x<=Math.max(m.a.x,m.b.x));
    // Once the center has entered, squeeze the remaining membrane through the
    // actual opening. Exterior flags from an incoming/older blob cannot leave
    // a lobe running down the outside of the closed neck while its center stays inside.
    const retainInside=entered&&previous.entered&&contains(center.x,center.y);
    const forced=body.spilled?null:retainInside?true:body.y<=mouthBottom||!(straddle||deep)?null:mostlyInside?true:outsideMouths?false:null;
    for(const p of nodes){
      let vx=p.x-p.px,vy=p.y-p.py;
      const pinned=forced!==null&&p.y>(retainInside?openingY(p.x):mouthBottom);
      let side=pinned?forced:p.bottleSide??contains(p.px,p.py);
      if(entered&&forced!==false&&contains(body.x,body.y)&&p.y>floor)side=true;
      const origin=history.get(p)??(side?{x:p.x,y:p.y}:{x:p.px,y:p.py});
      if(p.y<3){p.y=3;vy=Math.abs(vy)*.04;p.py=p.y-vy;}
      const sx=p.x-origin.x,sy=p.y-origin.y,hits=[];
      if(sx*sx+sy*sy>.000001&&(Math.min(origin.y,p.y)<joinY||side!==contains(p.x,p.y))){
        for(const e of nearbyEdges(origin,p)){
          const denominator=cross(sx,sy,e.dx,e.dy);if(Math.abs(denominator)<eps)continue;
          const ax=e.a.x-origin.x,ay=e.a.y-origin.y,t=cross(ax,ay,e.dx,e.dy)/denominator,u=cross(ax,ay,sx,sy)/denominator;
          if(t>eps&&t<=1&&u>=0&&u<=1)hits.push({...e,t,x:origin.x+sx*t,y:origin.y+sy*t});
        }
      }
      hits.sort((a,b)=>a.t-b.t);let hit=null;
      for(const e of hits){
        const entering=sx*e.nx+sy*e.ny>0;
        if(e.mouth){if(!pinned)side=entering;continue;}
        if(entering!==side){hit=e;break;}
      }
      p.bottleSide=side;
      const nowInside=contains(p.x,p.y);
      if(!hit&&side===nowInside){history.set(p,{x:p.x,y:p.y});continue;}
      const q=hit??nearest(p.x,p.y,walls),sign=side?1:-1,nx=q.nx*sign,ny=q.ny*sign;
      const closing=vx*nx+vy*ny;
      if(closing<0){const response=-closing>.12?1.25:1;vx-=closing*response*nx;vy-=closing*response*ny;}
      p.x=q.x+nx*.03;p.y=q.y+ny*.03;
      // Near a lip endpoint, nudge along its wall before taking the normal.
      if(side&&!contains(p.x,p.y,.001)){
        const t=Math.max(.002,Math.min(.998,hit?((q.x-q.a.x)*q.dx+(q.y-q.a.y)*q.dy)/(q.dx*q.dx+q.dy*q.dy):q.t));
        p.x=q.a.x+q.dx*t+nx*.03;p.y=q.a.y+q.dy*t+ny*.03;
      }
      p.px=p.x-vx*.995;p.py=p.y-vy*.995;history.set(p,{x:p.x,y:p.y});
    }
    repairNeckBridges(body,retainInside);
  }
  function trace(ctx,close=false){
    ctx.beginPath();ctx.moveTo(outline[0].x,outline[0].y);
    for(const e of edges){if(!close&&e.mouth)ctx.moveTo(e.b.x,e.b.y);else ctx.lineTo(e.b.x,e.b.y);}
    if(close)ctx.closePath();
  }
  return {BOTTLE_VERSION:version,BOTTLE_MOUTH:top,BOTTLE_FLOOR:floor,FILL_LINE:fillLine,bottleOutline:outline,
    bottleLeftAt,insideBottle,contains,overlapsBottleInterior,updateBottleState,bottleWalls,trace,mouths};
}
