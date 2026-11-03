import {createVessel} from './vessel.js?v=34';
const left=[{x:64,y:148}];
function curve(list,a,b,c,d,count=18){
  for(let i=1;i<=count;i++){const t=i/count,u=1-t;list.push({x:u**3*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t**3*d.x,y:u**3*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t**3*d.y});}
}
curve(left,left.at(-1),{x:68,y:183},{x:77,y:214},{x:83,y:234});
curve(left,left.at(-1),{x:50,y:252},{x:47,y:304},{x:69,y:342});
curve(left,left.at(-1),{x:91,y:383},{x:133,y:408},{x:180,y:408});
const outer=[...left,...left.slice(0,-1).map(p=>({x:360-p.x,y:p.y})).reverse()];
const roof=[{x:246,y:130}];
curve(roof,roof.at(-1),{x:242,y:158},{x:227,y:183},{x:232,y:202});
curve(roof,roof.at(-1),{x:227,y:214},{x:221,y:201},{x:222,y:188},12);
curve(roof,roof.at(-1),{x:224,y:156},{x:226,y:133},{x:228,y:106});
const outline=[...outer,...roof,...roof.map(p=>({x:360-p.x,y:p.y})).reverse()];
const geometry=createVessel({outline,mouthEdges:[
  {a:{x:64,y:148},b:{x:114,y:130}},
  {a:{x:132,y:106},b:{x:228,y:106}},
  {a:{x:246,y:130},b:{x:296,y:148}}
],floor:408,fillLine:242,joinY:238});
function joint(ctx,{a,b},index){
  const x=(a.x+b.x)/2,y=(a.y+b.y)/2,angle=Math.atan2(b.y-a.y,b.x-a.x);
  // Orient left-to-right, so the frosted joint extends toward the flask body.
  const rotation=angle>Math.PI/2||angle<-Math.PI/2?angle+Math.PI:angle;
  const width=Math.hypot(b.x-a.x,b.y-a.y),height=index===1?65:48;
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);
  ctx.fillStyle='#e6efead9';ctx.strokeStyle='#acc2b98c';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(-width/2,0,width,height,3);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#ffffffb0';ctx.lineWidth=1.3;
  for(const yy of [9,height-10]){ctx.beginPath();ctx.moveTo(-width/2+2,yy);ctx.lineTo(width/2-2,yy);ctx.stroke();}
  ctx.fillStyle='#a28c7f88';ctx.font='600 6px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillText(index===1?'29 / 32':'24 / 40',0,height*.67);
  ctx.fillStyle='#f4faf6aa';ctx.strokeStyle='#9fb8adbb';ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(0,0,width/2+3,4.2,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#ffffffee';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,-1,width/2+1,3,0,Math.PI,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawBottleBack(ctx){
  ctx.save();ctx.fillStyle='#668a8013';ctx.beginPath();ctx.ellipse(180,414,111,4,0,0,Math.PI*2);ctx.fill();
  const glass=ctx.createLinearGradient(55,180,305,370);glass.addColorStop(0,'#f8ffffb5');glass.addColorStop(.35,'#d6eae05c');glass.addColorStop(.7,'#d4e7e044');glass.addColorStop(1,'#e7f6efa0');
  geometry.trace(ctx,true);ctx.fillStyle=glass;ctx.fill();
  geometry.trace(ctx);ctx.strokeStyle='#91ada17a';ctx.lineWidth=8;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
  geometry.trace(ctx);ctx.strokeStyle='#ffffffbc';ctx.lineWidth=4;ctx.stroke();
  geometry.trace(ctx);ctx.strokeStyle='#73988986';ctx.lineWidth=1;ctx.stroke();
  ctx.restore();
}
function drawBottleFront(ctx){
  ctx.save();geometry.trace(ctx,true);ctx.clip();
  const shine=ctx.createLinearGradient(45,0,125,0);shine.addColorStop(0,'#ffffff99');shine.addColorStop(.55,'#ffffff44');shine.addColorStop(1,'#ffffff00');
  ctx.fillStyle=shine;ctx.fillRect(40,180,88,230);
  ctx.strokeStyle='#ffffffbd';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(79,250);ctx.bezierCurveTo(59,291,72,337,96,358);ctx.stroke();
  ctx.strokeStyle='#ffffff90';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(99,379);ctx.bezierCurveTo(141,408,214,411,264,369);ctx.stroke();
  ctx.beginPath();ctx.moveTo(287,269);ctx.bezierCurveTo(299,295,293,328,283,346);ctx.stroke();
  ctx.strokeStyle='#ffffff80';ctx.beginPath();ctx.moveTo(146,168);ctx.lineTo(146,201);ctx.moveTo(71,191);ctx.lineTo(87,221);ctx.moveTo(283,189);ctx.lineTo(269,220);ctx.stroke();
  // A translucent enamel writing patch and capacity mark echo the reference.
  ctx.fillStyle='#f4f1e745';ctx.beginPath();ctx.roundRect(148,298,64,29,13);ctx.fill();
  ctx.fillStyle='#95887966';ctx.font='600 8px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillText('500 mL',180,291);
  ctx.font='500 5px "DM Sans",sans-serif';ctx.fillText('BOROSILICATE 3.3',180,339);ctx.restore();
  // Match the photo: taller central joint and two angled side joints.
  geometry.mouths.forEach((m,i)=>joint(ctx,m,i===0?2:i===1?1:0));
}
export const labFlask=Object.freeze({...geometry,id:'lab-flask',name:'Three-neck flask',rackSpread:86,drawBottleBack,drawBottleFront});
