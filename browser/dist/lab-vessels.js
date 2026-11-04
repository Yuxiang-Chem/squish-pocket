import {createVessel} from './vessel.js?v=61';
function curve(points,b,c,d,count=14){
  const a=points.at(-1);
  for(let i=1;i<=count;i++){const t=i/count,u=1-t;points.push({x:u**3*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t**3*d.x,y:u**3*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t**3*d.y});}
}
const frostGrain=Array.from({length:100},(_,i)=>({x:90+(i*53%180),y:105+(i*17%32),r:.25+(i%3)*.16}));
function glassVessel({id,name,left,floor,fillLine,capacity,funnel=false,version=1}){
  const outline=[...left,...left.map(p=>({x:360-p.x,y:p.y})).reverse()];
  const mouth={a:left[0],b:outline.at(-1)};
  const geometry=createVessel({outline,mouthEdges:[mouth],floor,fillLine,joinY:190,version});
  return Object.freeze({...geometry,id,name,rackSpread:66,
    drawBottleBack(ctx){
      ctx.save();ctx.fillStyle='#668a8016';ctx.beginPath();ctx.ellipse(180,funnel?418:414,funnel?100:149,funnel?2:4,0,0,Math.PI*2);ctx.fill();
      const glass=ctx.createLinearGradient(35,140,320,380);glass.addColorStop(0,'#f8ffffbc');glass.addColorStop(.3,'#d2e9e65c');glass.addColorStop(.7,'#b9d8d333');glass.addColorStop(1,'#e7f6efb0');
      geometry.trace(ctx,true);ctx.fillStyle=glass;ctx.fill();
      for(const [color,width] of [['#91ada17a',8],['#ffffffbc',4],['#73988986',1]]){geometry.trace(ctx);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke();}ctx.restore();
    },
    drawBottleFront(ctx){
      ctx.save();geometry.trace(ctx,true);ctx.clip();
      const shine=ctx.createLinearGradient(35,0,130,0);shine.addColorStop(0,'#ffffff99');shine.addColorStop(1,'#ffffff00');ctx.fillStyle=shine;ctx.fillRect(20,150,130,260);
      ctx.lineCap='round';ctx.strokeStyle='#ffffffb0';ctx.lineWidth=3;ctx.beginPath();
      for(let i=3;i<left.length-2;i++){const p=left[i];i===3?ctx.moveTo(p.x+8,p.y):ctx.lineTo(p.x+8,p.y);}ctx.stroke();
      if(funnel){
        const frost=ctx.createLinearGradient(85,0,275,0);frost.addColorStop(0,'#cadad1c9');frost.addColorStop(.5,'#f7faf0dd');frost.addColorStop(1,'#cadad1c9');
        ctx.fillStyle=frost;ctx.fillRect(0,104,360,35);
        ctx.fillStyle='#ffffffba';ctx.beginPath();for(const p of frostGrain){ctx.moveTo(p.x+p.r,p.y);ctx.arc(p.x,p.y,p.r,0,Math.PI*2);}ctx.fill();
        ctx.strokeStyle='#faffffb0';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(0,104.5);ctx.lineTo(360,104.5);ctx.moveTo(0,138.5);ctx.lineTo(360,138.5);ctx.stroke();
      }
      ctx.strokeStyle='#9bb8ac99';ctx.lineWidth=1;ctx.fillStyle='#a27b688e';ctx.textAlign='center';ctx.font='500 10px "DM Sans",sans-serif';ctx.fillText(capacity,180,funnel?253:332);
      if(!funnel){for(const y of [267,292,317,342,367]){const x=geometry.bottleLeftAt(y);ctx.beginPath();ctx.moveTo(360-x-35,y);ctx.lineTo(360-x-15,y);ctx.stroke();}}
      ctx.restore();ctx.save();
      const width=mouth.b.x-mouth.a.x,rimDepth=funnel?7:4;ctx.fillStyle=funnel?'#a1bfb326':'#d9eae483';ctx.strokeStyle='#8faea3bb';ctx.lineWidth=funnel?3:2;
      ctx.beginPath();ctx.ellipse(180,mouth.a.y,width/2+2,rimDepth,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#faffffee';ctx.lineWidth=funnel?1.7:1;ctx.beginPath();ctx.ellipse(180,mouth.a.y-1,width/2,funnel?5:2.5,0,Math.PI,Math.PI*2);ctx.stroke();
      if(funnel){
        // Closed stopcock: blobs stay above the valve; the drain is decorative.
        ctx.fillStyle='#dfede783';ctx.strokeStyle='#8faea3bb';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(173,floor,14,415-floor,4);ctx.fill();ctx.stroke();
        ctx.fillStyle='#b6ccbd';ctx.beginPath();ctx.roundRect(160,floor-2,40,10,4);ctx.fill();ctx.stroke();ctx.fillStyle='#91ada1';ctx.beginPath();ctx.roundRect(194,floor-8,22,8,3);ctx.fill();
      }ctx.restore();
    }});
}
const conicalLeft=[{x:98,y:116},{x:98,y:174}];
curve(conicalLeft,{x:98,y:188},{x:92,y:203},{x:84,y:218});
conicalLeft.push({x:36,y:380});curve(conicalLeft,{x:26,y:400},{x:35,y:408},{x:52,y:408});
export const conicalFlask=glassVessel({id:'conical-flask',name:'Conical flask',left:conicalLeft,floor:408,fillLine:220,capacity:'500 mL',version:2});
// Longer bowl, with more width retained down its body for a larger playable volume.
// Retain the flared lip, reducing its previous 280-unit opening by one third.
const funnelLeft=[{x:180-280/3,y:96}];
curve(funnelLeft,{x:106,y:102},{x:118,y:122},{x:106,y:138});
// A short straight throat makes the tunnel below the frosted rim a little longer.
funnelLeft.push({x:106,y:154});
curve(funnelLeft,{x:90,y:166},{x:66,y:165},{x:61,y:193});
curve(funnelLeft,{x:51,y:216},{x:53,y:244},{x:64,y:271});
curve(funnelLeft,{x:83,y:316},{x:129,y:346},{x:158,y:371});
curve(funnelLeft,{x:170,y:381},{x:172,y:383},{x:172,y:390});
export const separatingFunnel=glassVessel({id:'separating-funnel',name:'Separating funnel',left:funnelLeft,floor:390,fillLine:183,capacity:'500 mL',funnel:true,version:5});
