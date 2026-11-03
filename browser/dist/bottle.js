export const BOTTLE_VERSION=2,BOTTLE_MOUTH=112,BOTTLE_FLOOR=408,FILL_LINE=126;
export const BOTTLE_LIP_LEFT=52,BOTTLE_LIP_RIGHT=308;
export const bottleLeft=[{x:BOTTLE_LIP_LEFT,y:BOTTLE_MOUTH}];
function curve(a,b,c,d,count=12){
  for(let i=1;i<=count;i++){
    const t=i/count,u=1-t;bottleLeft.push({x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,y:u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y});
  }
}
// The lip turns inward to a curved waist, then opens into a broad, short body.
curve({x:52,y:112},{x:74,y:118},{x:82,y:138},{x:68,y:154});
curve({x:68,y:154},{x:51,y:170},{x:10,y:175},{x:10,y:206});
bottleLeft.push({x:10,y:382});
for(let i=1;i<=8;i++){
  const a=i/8*Math.PI/2;bottleLeft.push({x:36-26*Math.cos(a),y:382+26*Math.sin(a)});
}
export const bottleOutline=[...bottleLeft,...bottleLeft.map(p=>({x:360-p.x,y:p.y})).reverse()];
export function bottleLeftAt(y){
  if(y<BOTTLE_MOUTH)return 3;
  if(y>=BOTTLE_FLOOR)return 36;
  for(let i=1;i<bottleLeft.length;i++){
    const a=bottleLeft[i-1],b=bottleLeft[i];
    if(y<=b.y)return a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y);
  }
  return 36;
}
export function insideBottle(x,y,tolerance=0){
  if(y<3-tolerance||y>BOTTLE_FLOOR+tolerance)return false;
  if(y<=BOTTLE_MOUTH)return x>=3-tolerance&&x<=357+tolerance;
  const left=bottleLeftAt(y);
  return x>=left-tolerance&&x<=360-left+tolerance;
}
function inInterior(p,epsilon=.005){
  if(p.y<=BOTTLE_MOUTH+epsilon||p.y>=BOTTLE_FLOOR-epsilon)return false;
  const left=bottleLeftAt(p.y);return p.x>left+epsilon&&p.x<360-left-epsilon;
}
function inPolygon(p,nodes){
  let inside=false;
  for(let i=0,j=nodes.length-1;i<nodes.length;j=i++){
    const a=nodes[i],b=nodes[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
export function overlapsBottleInterior(body){
  const nodes=body.nodes??[{x:body.x,y:body.y}];
  if(nodes.some(p=>inInterior(p)))return true;
  const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
  // Proper crossings catch thin neck-spanning portions even if no membrane
  // vertex happens to lie inside. A tangency on the exterior is not interior.
  for(let i=0;i<nodes.length;i++)for(let j=0;j<bottleOutline.length;j++){
    const a=nodes[i],b=nodes[(i+1)%nodes.length],c=bottleOutline[j],d=bottleOutline[(j+1)%bottleOutline.length];
    const ax=b.x-a.x,ay=b.y-a.y,bx=d.x-c.x,by=d.y-c.y,denom=cross(ax,ay,bx,by);
    if(Math.abs(denom)<.000001)continue;
    const t=cross(c.x-a.x,c.y-a.y,bx,by)/denom,u=cross(c.x-a.x,c.y-a.y,ax,ay)/denom;
    if(t>.00001&&t<.99999&&u>.00001&&u<.99999)return true;
  }
  // A very large membrane can contain a bottle corner without an edge crossing.
  return [{x:180,y:BOTTLE_MOUTH+1},{x:180,y:(BOTTLE_MOUTH+BOTTLE_FLOOR)/2},{x:180,y:BOTTLE_FLOOR-1},...bottleLeft.slice(1,-1).flatMap(p=>[{x:p.x+.02,y:p.y},{x:360-p.x-.02,y:p.y}])].some(p=>inInterior(p)&&inPolygon(p,nodes));
}
export function updateBottleState(body){
  if(body.spilled)return true;
  body.inBottle=overlapsBottleInterior(body);
  if(body.inBottle)body.hasEntered=true;
  const top=body.nodes?Math.min(...body.nodes.map(p=>p.y)):body.y;
  // Do not lose on center position, half coverage, or a protruding tip.
  // Every part must clear the inside and descend beyond the opening first.
  const bottom=body.nodes?Math.max(...body.nodes.map(p=>p.y)):body.y;
  if(!body.inBottle&&(top>BOTTLE_MOUTH+1||(body.hasEntered&&bottom>BOTTLE_MOUTH+1&&(body.vy??0)>=0))){body.spilled=true;return true;}
  return false;
}
const wallSegments=bottleOutline.slice(1).map((b,i)=>({a:bottleOutline[i],b}));
const wallHistory=new WeakMap();
export function bottleWalls(blob,animateExterior=false){
  if(blob.spilled&&!animateExterior)return;
  const entered=!blob.spilled&&(blob.inBottle||blob.hasEntered);
  // Below the opening, a membrane edge joining interior and exterior particles
  // passes through the glass. The whole body then joins the side holding most
  // of it, so a blob sliding down the outside cannot be pulled back inside.
  // Particles still finishing a mouth crossing have not settled their side.
  const settled=p=>p.y>BOTTLE_MOUTH&&(wallHistory.get(p)?.y??p.y)>=BOTTLE_MOUTH;
  const interior=p=>(p.bottleSide??insideBottle(p.x,p.y))||(entered&&p.y>=BOTTLE_FLOOR);
  let votes=0,below=0,straddle=false;
  for(let i=0;i<blob.nodes.length;i++){
    const a=blob.nodes[i],b=blob.nodes[(i+1)%blob.nodes.length];
    if(!settled(a))continue;
    below++;if(interior(a))votes++;
    if(settled(b)&&interior(a)!==interior(b))straddle=true;
  }
  // A half-out body still over the opening stays playable; only one whose
  // center has passed beyond the rim is sent outside.
  const mostlyInside=votes*2>=below,beyondRim=blob.x<BOTTLE_LIP_LEFT||blob.x>BOTTLE_LIP_RIGHT;
  const deepInterior=entered&&blob.nodes.every(p=>p.y>206);
  const forced=blob.spilled||blob.y<=BOTTLE_MOUTH||!(straddle||deepInterior)?null:mostlyInside?true:beyondRim?false:null;
  for(const p of blob.nodes){
    let vx=p.x-p.px,vy=p.y-p.py;
    // Recover floor leakage in older saves too. An interior body cannot cross
    // the closed base; exterior falling blobs retain their original side.
    if(entered&&forced!==false&&blob.y>BOTTLE_MOUTH&&insideBottle(blob.x,blob.y)&&p.y>BOTTLE_FLOOR)p.bottleSide=true;
    const pinned=forced!==null&&p.y>=BOTTLE_MOUTH;
    const wasInside=pinned?forced:p.bottleSide??(p.py>=BOTTLE_MOUTH&&insideBottle(p.px,p.py));
    // Verlet px/py encode velocity after contacts, not a reliable crossing path.
    const origin=wallHistory.get(p)??(wasInside?{x:p.x,y:Math.max(BOTTLE_MOUTH,p.y)}:{x:p.px,y:p.py});
    const remember=()=>wallHistory.set(p,{x:p.x,y:p.y});
    if(p.y<3){p.y=3;vy=Math.abs(vy)*.04;p.py=p.y-vy;}
    let side=wasInside,blockedExit=false;
    if(p.y<BOTTLE_MOUTH){
      const t=origin.y>=BOTTLE_MOUTH?Math.max(0,Math.min(1,(BOTTLE_MOUTH-origin.y)/Math.min(-.000001,p.y-origin.y))):1;
      const x=origin.x+(p.x-origin.x)*t;
      if(!side||(x>=BOTTLE_LIP_LEFT&&x<=BOTTLE_LIP_RIGHT)){p.bottleSide=false;remember();continue;}
      blockedExit=true;
    }else if(!side&&!pinned&&origin.y<BOTTLE_MOUTH){
      const t=Math.max(0,Math.min(1,(BOTTLE_MOUTH-origin.y)/Math.max(.000001,p.y-origin.y))),x=origin.x+(p.x-origin.x)*t;
      side=x>=BOTTLE_LIP_LEFT&&x<=BOTTLE_LIP_RIGHT;
    }
    p.bottleSide=side;
    const nowInside=!blockedExit&&insideBottle(p.x,p.y);
    if((side&&nowInside)||(!side&&!nowInside)){remember();continue;}
    let distance=Infinity,qx=0,qy=0,nx=0,ny=0;
    for(const {a,b} of wallSegments){
      const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
      const x=a.x+dx*t,y=a.y+dy*t,d=(p.x-x)**2+(p.y-y)**2;
      if(d<distance){distance=d;qx=x;qy=y;const length=Math.hypot(dx,dy);nx=dy/length;ny=-dx/length;}
    }
    if(!side){nx=-nx;ny=-ny;}
    const closing=vx*nx+vy*ny;
    if(closing<0){const response=-closing>.12?1.25:1;vx-=closing*response*nx;vy-=closing*response*ny;}
    p.x=qx+nx*.02;p.y=qy+ny*.02;
    if(side){p.y=Math.max(BOTTLE_MOUTH+.02,Math.min(BOTTLE_FLOOR-.02,p.y));const left=bottleLeftAt(p.y)+.001;p.x=Math.max(left,Math.min(360-left,p.x));}
    p.px=p.x-vx*.995;p.py=p.y-vy*.995;remember();
  }
}
function trace(ctx,close=false){
  ctx.beginPath();ctx.moveTo(bottleOutline[0].x,bottleOutline[0].y);
  for(const p of bottleOutline.slice(1))ctx.lineTo(p.x,p.y);
  if(close)ctx.closePath();
}
export function drawBottleBack(ctx){
  ctx.save();
  ctx.fillStyle='#668a8016';ctx.beginPath();ctx.ellipse(180,412,152,5,0,0,Math.PI*2);ctx.fill();
  trace(ctx,true);const glass=ctx.createLinearGradient(10,185,350,380);
  glass.addColorStop(0,'#faffffb0');glass.addColorStop(.25,'#e4f4ef55');glass.addColorStop(.7,'#d5e9e044');glass.addColorStop(1,'#f6ffff99');
  ctx.fillStyle=glass;ctx.fill();
  trace(ctx);ctx.strokeStyle='#a3bdb38a';ctx.lineWidth=9;ctx.lineJoin='round';ctx.stroke();
  trace(ctx);ctx.strokeStyle='#ffffffbe';ctx.lineWidth=5;ctx.stroke();
  trace(ctx);ctx.strokeStyle='#739b8d85';ctx.lineWidth=1;ctx.stroke();
  ctx.restore();
}
export function drawBottleFront(ctx){
  ctx.save();
  trace(ctx,true);ctx.clip();
  const reflection=ctx.createLinearGradient(10,0,80,0);reflection.addColorStop(0,'#ffffff99');reflection.addColorStop(.3,'#ffffff30');reflection.addColorStop(1,'#ffffff00');
  ctx.fillStyle=reflection;ctx.fillRect(10,190,64,220);
  ctx.restore();ctx.save();ctx.lineCap='round';
  ctx.strokeStyle='#ffffffbd';ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(22,222);ctx.lineTo(22,358);ctx.stroke();
  ctx.strokeStyle='#ffffff88';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(30,232);ctx.lineTo(30,320);ctx.moveTo(339,224);ctx.lineTo(339,340);ctx.stroke();
  ctx.strokeStyle='#ffffffb0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(58,116);ctx.bezierCurveTo(88,135,62,162,45,174);ctx.bezierCurveTo(26,185,18,193,17,211);ctx.stroke();
  ctx.beginPath();ctx.moveTo(32,397);ctx.quadraticCurveTo(180,414,328,397);ctx.stroke();
  ctx.fillStyle='#a1bfb326';ctx.beginPath();ctx.ellipse(180,112,132,7,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#8faea3bb';ctx.lineWidth=3;ctx.stroke();
  ctx.strokeStyle='#faffffee';ctx.lineWidth=1.7;ctx.beginPath();ctx.ellipse(180,112,129,5,0,0,Math.PI);ctx.stroke();
  ctx.restore();
}
