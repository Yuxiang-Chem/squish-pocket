import {createVessel} from './vessel.js?v=37';
// Round-bottom flask. Each neck is a straight cylinder through the ground
// joint, then a circular flare tangent to that cylinder and to the elliptical
// chamber, so the bore never pinches and the glass has no welded corner.
const cx=180,cy=270,rx=166,ry=138;
const centerMouthY=92,centerHalf=42,centerStraight=30;
const theta=22*Math.PI/180,sideHalf=34,sideMouth={x:78,y:122},sideStraight=18;
const sin=Math.sin(theta),cos=Math.cos(theta);
const axis={x:sin,y:cos},perp={x:-cos,y:sin};
const sleeve=16;
function grad(p){
  const g={x:(p.x-cx)/(rx*rx),y:(p.y-cy)/(ry*ry)},l=Math.hypot(g.x,g.y)||1;
  return {x:g.x/l,y:g.y/l};
}
function tangentCircle(S,normal){
  let best=null;
  for(let i=0;i<=2400;i++){
    const phi=-Math.PI+(Math.PI*1.35)*i/2400;
    const P={x:cx+rx*Math.cos(phi),y:cy+ry*Math.sin(phi)},n=grad(P);
    for(const sign of [1,-1]){
      const vx=sign*n.x-normal.x,vy=sign*n.y-normal.y,dx=S.x-P.x,dy=S.y-P.y;
      const vl=Math.hypot(vx,vy),dl=Math.hypot(dx,dy);
      if(vl<1e-4||dl<1)continue;
      const align=(dx*vx+dy*vy)/(dl*vl);
      if(align<0.9999)continue;
      const R=dl/vl;
      if(R<12||R>80)continue;
      if(!best||align>best.align)best={phi,R,P,align,sign};
    }
  }
  const C={x:S.x+normal.x*best.R,y:S.y+normal.y*best.R};
  return {...best,C};
}
function flare(S,C,P,dir){
  const R=Math.hypot(S.x-C.x,S.y-C.y),a0=Math.atan2(S.y-C.y,S.x-C.x),a1=Math.atan2(P.y-C.y,P.x-C.x);
  const sign=(-(S.y-C.y)*dir.x+(S.x-C.x)*dir.y)>=0?1:-1;
  let sweep=a1-a0;
  sweep=sign>0?(sweep%(Math.PI*2)+Math.PI*2)%(Math.PI*2):-(((-sweep)%(Math.PI*2)+Math.PI*2)%(Math.PI*2));
  if(Math.abs(sweep)<1e-4)sweep=sign*Math.PI*2;
  const steps=Math.max(10,Math.ceil(Math.abs(sweep)*R/4)),points=[];
  for(let i=1;i<=steps;i++){const a=a0+sweep*i/steps;points.push({x:C.x+R*Math.cos(a),y:C.y+R*Math.sin(a)});}
  points[points.length-1]=P;return points;
}
function ellipseArc(phi0,phi1){
  let sweep=phi1-phi0;if(sweep>0)sweep-=Math.PI*2;
  const steps=Math.max(4,Math.ceil(Math.abs(sweep)*Math.max(rx,ry)/6)),points=[];
  for(let i=1;i<=steps;i++){const a=phi0+sweep*i/steps;points.push({x:cx+rx*Math.cos(a),y:cy+ry*Math.sin(a)});}
  return points;
}
const mirror=p=>({x:360-p.x,y:p.y});
const leftOuterLip={x:sideMouth.x+perp.x*sideHalf,y:sideMouth.y+perp.y*sideHalf};
const leftInnerLip={x:sideMouth.x-perp.x*sideHalf,y:sideMouth.y-perp.y*sideHalf};
const centerLeftLip={x:cx-centerHalf,y:centerMouthY},centerRightLip={x:cx+centerHalf,y:centerMouthY};
const leftOuterStart={x:leftOuterLip.x+axis.x*sideStraight,y:leftOuterLip.y+axis.y*sideStraight};
const leftInnerStart={x:leftInnerLip.x+axis.x*sideStraight,y:leftInnerLip.y+axis.y*sideStraight};
const centerLeftStart={x:centerLeftLip.x,y:centerLeftLip.y+centerStraight};
const outer=tangentCircle(leftOuterStart,perp);
const inner=tangentCircle(leftInnerStart,{x:-perp.x,y:-perp.y});
const center=tangentCircle(centerLeftStart,{x:-1,y:0});
const leftOuterCurve=flare(leftOuterStart,outer.C,outer.P,axis);
const leftInnerCurve=flare(leftInnerStart,inner.C,inner.P,axis);
const centerCurve=flare(centerLeftStart,center.C,center.P,{x:0,y:1});
function crossAt(a,b,c,d){
  const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
  if(Math.abs(den)<1e-8)return null;
  const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;
  return t>0.02&&t<0.98&&u>0.02&&u<0.98?{x:a.x+rx*t,y:a.y+ry*t,t,u,i:0,j:0}:null;
}
let meet=null;
for(let i=0;i<centerCurve.length-1&&!meet;i++)for(let j=0;j<leftInnerCurve.length-1&&!meet;j++){
  const hit=crossAt(centerCurve[i],centerCurve[i+1],leftInnerCurve[j],leftInnerCurve[j+1]);
  if(hit)meet={...hit,i,j};
}
function cutBack(points,index,at,distance){
  const seq=[...points.slice(0,index+1),at];
  let traveled=0;
  for(let i=seq.length-1;i>0;i--){
    const step=Math.hypot(seq[i].x-seq[i-1].x,seq[i].y-seq[i-1].y);
    if(traveled+step>=distance){
      const t=(distance-traveled)/(step||1);
      const b={x:seq[i].x+(seq[i-1].x-seq[i].x)*t,y:seq[i].y+(seq[i-1].y-seq[i].y)*t};
      return {kept:[...seq.slice(0,i),b],from:seq[i-1]};
    }
    traveled+=step;
  }
  return {kept:[seq[0]],from:seq[0]};
}
const centerCut=cutBack(centerCurve,meet.i,{x:meet.x,y:meet.y},16);
const innerCut=cutBack(leftInnerCurve,meet.j,{x:meet.x,y:meet.y},16);
const filletStart=centerCut.kept.at(-1),filletEnd=innerCut.kept.at(-1);
const tC={x:filletStart.x-centerCut.from.x,y:filletStart.y-centerCut.from.y};
const tI={x:filletEnd.x-innerCut.from.x,y:filletEnd.y-innerCut.from.y};
const den=tC.x*tI.y-tC.y*tI.x;
const control=Math.abs(den)<1e-6?meet:{
  x:filletStart.x+tC.x*((filletEnd.x-filletStart.x)*tI.y-(filletEnd.y-filletStart.y)*tI.x)/den,
  y:filletStart.y+tC.y*((filletEnd.x-filletStart.x)*tI.y-(filletEnd.y-filletStart.y)*tI.x)/den
};
const saddle=[];
for(let i=1;i<=10;i++){const t=i/10,u=1-t;saddle.push({x:u*u*filletStart.x+2*u*t*control.x+t*t*filletEnd.x,y:u*u*filletStart.y+2*u*t*control.y+t*t*filletEnd.y});}
const rightOuterLip=mirror(leftOuterLip),rightInnerLip=mirror(leftInnerLip);
const bulb=ellipseArc(outer.phi,Math.atan2(Math.sin(outer.phi),-Math.cos(outer.phi)));
const outline=[
  leftOuterLip,leftOuterStart,...leftOuterCurve,...bulb.slice(0,-1),...[...leftOuterCurve].reverse().map(mirror),mirror(leftOuterStart),rightOuterLip,
  rightInnerLip,mirror(leftInnerStart),...innerCut.kept.map(mirror),...[...saddle].reverse().map(mirror),...[...centerCut.kept].reverse().map(mirror),mirror(centerLeftStart),centerRightLip,
  centerLeftLip,centerLeftStart,...centerCut.kept,...saddle,...[...innerCut.kept].reverse(),leftInnerStart,leftInnerLip
];
const necks=[
  {outerLip:rightOuterLip,innerLip:rightInnerLip,inward:{x:-axis.x,y:axis.y},label:'24 / 40'},
  {outerLip:centerRightLip,innerLip:centerLeftLip,inward:{x:0,y:1},label:'29 / 32'},
  {outerLip:leftOuterLip,innerLip:leftInnerLip,inward:axis,label:'24 / 40'}
];
const geometry=createVessel({
  outline,mouthEdges:[
    {a:leftOuterLip,b:leftInnerLip},
    {a:centerRightLip,b:centerLeftLip},
    {a:rightOuterLip,b:rightInnerLip}
  ],floor:408,fillLine:236,joinY:210,version:3
});
function joint(ctx,neck){
  const dx=neck.innerLip.x-neck.outerLip.x,dy=neck.innerLip.y-neck.outerLip.y,width=Math.hypot(dx,dy);
  const ix=neck.inward.x,iy=neck.inward.y;
  const length=sleeve;
  ctx.save();ctx.translate((neck.outerLip.x+neck.innerLip.x)/2,(neck.outerLip.y+neck.innerLip.y)/2);
  ctx.rotate(Math.atan2(iy,ix)-Math.PI/2);
  ctx.fillStyle='#e6efead9';ctx.strokeStyle='#acc2b98c';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(-width/2,0,width,length,3);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#ffffffb0';ctx.lineWidth=1.2;
  for(const y of [7,length-7]){ctx.beginPath();ctx.moveTo(-width/2+2,y);ctx.lineTo(width/2-2,y);ctx.stroke();}
  ctx.fillStyle='#a28c7f88';ctx.font='600 6px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillText(neck.label,0,length*.62);
  ctx.fillStyle='#f4faf6aa';ctx.strokeStyle='#9fb8adbb';ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(0,0,width/2+3,4.2,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#ffffffee';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,-1,width/2+1,3,0,Math.PI,Math.PI*2);ctx.stroke();
  ctx.restore();
}
function drawBottleBack(ctx){
  ctx.save();ctx.fillStyle='#668a8013';ctx.beginPath();ctx.ellipse(180,414,128,4.5,0,0,Math.PI*2);ctx.fill();
  const glass=ctx.createLinearGradient(20,160,330,390);glass.addColorStop(0,'#f8ffffb5');glass.addColorStop(.35,'#d6eae05c');glass.addColorStop(.7,'#d4e7e044');glass.addColorStop(1,'#e7f6efa0');
  geometry.trace(ctx,true);ctx.fillStyle=glass;ctx.fill();
  geometry.trace(ctx);ctx.strokeStyle='#91ada17a';ctx.lineWidth=8;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
  geometry.trace(ctx);ctx.strokeStyle='#ffffffbc';ctx.lineWidth=4;ctx.stroke();
  geometry.trace(ctx);ctx.strokeStyle='#73988986';ctx.lineWidth=1;ctx.stroke();
  ctx.restore();
}
function drawBottleFront(ctx){
  ctx.save();geometry.trace(ctx,true);ctx.clip();
  const shine=ctx.createLinearGradient(16,0,110,0);shine.addColorStop(0,'#ffffff99');shine.addColorStop(.55,'#ffffff44');shine.addColorStop(1,'#ffffff00');
  ctx.fillStyle=shine;ctx.fillRect(16,168,78,230);
  ctx.strokeStyle='#ffffffbd';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(36,214);ctx.bezierCurveTo(22,260,28,330,58,372);ctx.stroke();
  ctx.strokeStyle='#ffffff90';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(70,386);ctx.bezierCurveTo(120,414,250,414,304,372);ctx.stroke();
  ctx.beginPath();ctx.moveTo(312,250);ctx.bezierCurveTo(328,290,322,340,300,368);ctx.stroke();
  ctx.fillStyle='#f4f1e745';ctx.beginPath();ctx.roundRect(148,318,64,29,13);ctx.fill();
  ctx.fillStyle='#95887966';ctx.font='600 8px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillText('1000 mL',180,312);
  ctx.font='500 5px "DM Sans",sans-serif';ctx.fillText('BOROSILICATE 3.3',180,359);ctx.restore();
  necks.forEach(neck=>joint(ctx,neck));
}
export const labFlask=Object.freeze({...geometry,id:'lab-flask',name:'Three-neck flask',rackSpread:86,necks,drawBottleBack,drawBottleFront});
