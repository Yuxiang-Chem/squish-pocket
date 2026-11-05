import {createVessel} from './vessel.js?v=89';
const left=[{x:64,y:148}];
function curve(list,a,b,c,d,count=18){
  for(let i=1;i<=count;i++){const t=i/count,u=1-t;list.push({x:u**3*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t**3*d.x,y:u**3*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t**3*d.y});}
}
curve(left,left.at(-1),{x:70,y:177},{x:62,y:196},{x:52,y:210});
curve(left,left.at(-1),{x:13,y:241},{x:9,y:301},{x:39,y:349});
curve(left,left.at(-1),{x:67,y:389},{x:120,y:408},{x:180,y:408});
const outer=[...left,...left.slice(0,-1).map(p=>({x:360-p.x,y:p.y})).reverse()];
const roof=[{x:246,y:130}];
curve(roof,roof.at(-1),{x:242,y:158},{x:237,y:180},{x:226,y:191});
curve(roof,roof.at(-1),{x:221,y:193},{x:221,y:189},{x:222,y:180},12);
curve(roof,roof.at(-1),{x:224,y:153},{x:226,y:130},{x:228,y:106});
const outline=[...outer,...roof,...roof.map(p=>({x:360-p.x,y:p.y})).reverse()];
const geometry=createVessel({outline,mouthEdges:[
  {a:{x:64,y:148},b:{x:114,y:130}},
  {a:{x:132,y:106},b:{x:228,y:106}},
  {a:{x:246,y:130},b:{x:296,y:148}}
],floor:408,fillLine:229,joinY:224,version:3});
function joint(ctx,{a,b},index){
  const x=(a.x+b.x)/2,y=(a.y+b.y)/2,angle=Math.atan2(b.y-a.y,b.x-a.x);
  // Orient left-to-right, so the frosted joint extends toward the flask body.
  const rotation=angle>Math.PI/2||angle<-Math.PI/2?angle+Math.PI:angle;
  const width=Math.hypot(b.x-a.x,b.y-a.y),height=index===1?72:49;
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);
  const frost=ctx.createLinearGradient(-width/2,0,width/2,0);
  frost.addColorStop(0,'#c6dcd5e0');frost.addColorStop(.22,'#f7fcf1ed');frost.addColorStop(.65,'#e4ede5d9');frost.addColorStop(1,'#afc9c1dc');
  ctx.fillStyle=frost;ctx.strokeStyle='#91ada68c';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(-width/2,0,width,height,3);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#ffffffb0';ctx.lineWidth=1.3;
  for(const yy of [9,Math.round(height*.36),height-12]){ctx.beginPath();ctx.ellipse(0,yy,width/2,2.7,0,0,Math.PI);ctx.stroke();}
  ctx.fillStyle='#b274669e';ctx.font='600 7px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillText(index===1?'45 / 50':'24 / 40',0,height*.67);
  ctx.fillStyle='#f4faf6aa';ctx.strokeStyle='#9fb8adbb';ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(0,0,width/2+3,4.2,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#799e9a38';ctx.beginPath();ctx.ellipse(0,-.7,width/2-3,2.1,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ffffffee';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,-1,width/2+1,3,0,Math.PI,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawBottleBack(ctx){
  ctx.save();ctx.fillStyle='#668a8013';ctx.beginPath();ctx.ellipse(180,414,143,4,0,0,Math.PI*2);ctx.fill();
  const glass=ctx.createLinearGradient(55,180,305,370);glass.addColorStop(0,'#f8ffffbc');glass.addColorStop(.25,'#d2e9e65c');glass.addColorStop(.55,'#b9d8d33b');glass.addColorStop(.8,'#d4eae544');glass.addColorStop(1,'#e7f6efb0');
  geometry.trace(ctx,true);ctx.fillStyle=glass;ctx.fill();
  geometry.trace(ctx);ctx.strokeStyle='#91ada17a';ctx.lineWidth=8;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
  geometry.trace(ctx);ctx.strokeStyle='#ffffffbc';ctx.lineWidth=4;ctx.stroke();
  geometry.trace(ctx);ctx.strokeStyle='#73988986';ctx.lineWidth=1;ctx.stroke();
  geometry.trace(ctx,true);ctx.clip();
  const bowl=ctx.createRadialGradient(174,287,65,180,295,158);
  bowl.addColorStop(0,'#aacac200');bowl.addColorStop(.8,'#9dbfb51c');bowl.addColorStop(1,'#6e9c9255');ctx.fillStyle=bowl;ctx.fillRect(8,202,344,210);
  ctx.restore();
}
function drawBottleFront(ctx){
  ctx.save();geometry.trace(ctx,true);ctx.clip();
  const shine=ctx.createLinearGradient(14,0,102,0);shine.addColorStop(0,'#ffffff99');shine.addColorStop(.55,'#ffffff44');shine.addColorStop(1,'#ffffff00');
  ctx.fillStyle=shine;ctx.fillRect(10,180,100,230);
  ctx.fillStyle='#ffffff40';ctx.beginPath();ctx.ellipse(70,276,14,37,.35,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffffff20';ctx.beginPath();ctx.ellipse(278,310,13,44,.25,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ffffffbd';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(42,242);ctx.bezierCurveTo(18,282,32,335,62,359);ctx.stroke();
  ctx.strokeStyle='#ffffff90';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(72,378);ctx.bezierCurveTo(130,408,227,411,289,368);ctx.stroke();
  ctx.beginPath();ctx.moveTo(320,269);ctx.bezierCurveTo(332,295,324,328,313,346);ctx.stroke();
  ctx.strokeStyle='#ffffff80';ctx.beginPath();ctx.moveTo(144,183);ctx.bezierCurveTo(145,214,135,226,119,234);ctx.moveTo(73,199);ctx.lineTo(85,221);ctx.moveTo(285,199);ctx.lineTo(273,221);ctx.stroke();
  // A translucent enamel writing patch and capacity mark echo the reference.
  ctx.fillStyle='#f4f1e789';ctx.beginPath();ctx.roundRect(149,293,62,37,17);ctx.fill();
  ctx.fillStyle='#ae776a9c';ctx.font='500 11px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillText('750 mL',180,285);
  ctx.strokeStyle='#ae776a70';ctx.lineWidth=1;ctx.beginPath();ctx.arc(180,270,6,0,Math.PI*2);ctx.stroke();
  ctx.font='600 4px "DM Sans",sans-serif';ctx.fillText('3.3',180,271.5);
  ctx.fillStyle='#95887966';ctx.font='500 5px "DM Sans",sans-serif';ctx.fillText('BOROSILICATE',180,343);ctx.restore();
  // Match the photo: taller central joint and two angled side joints.
  geometry.mouths.forEach((m,i)=>joint(ctx,m,i===0?2:i===1?1:0));
}
export const labFlask=Object.freeze({...geometry,id:'lab-flask',name:'Three-neck flask',rackSpread:86,drawBottleBack,drawBottleFront});
