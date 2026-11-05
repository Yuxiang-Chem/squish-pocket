export const BLOB_COLORS=['#eaaa8c','#e6c87f','#afc4a0','#9abfcb','#b6abca','#d9a3b7','#80b6a6','#d8ab71','#9faed0','#d5c788','#c395c6','#e49e7d'];
const colors=BLOB_COLORS;
export function drawBlobArt(ctx,b,{alpha=1,radius,value,glow=0}={}){
  ctx.save();ctx.globalAlpha=alpha;
  const r=b.renderRadius??radius,points=b.nodes?b.nodes.map(p=>[p.x,p.y]):b.shape.map((offset,k)=>{const a=k/24*Math.PI*2;return [b.x+Math.cos(a)*r*(1+offset),b.y+Math.sin(a)*r*(1+offset)];});
  ctx.beginPath();ctx.moveTo((points[23][0]+points[0][0])/2,(points[23][1]+points[0][1])/2);
  points.forEach((p,k)=>{const next=points[(k+1)%24];ctx.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);});
  ctx.closePath();
  const gradient=ctx.createLinearGradient(b.x-r,b.y-r,b.x+r,b.y+r);gradient.addColorStop(0,b.kind==='acid'?'#d5e88e':colors[b.level]);gradient.addColorStop(1,b.kind==='acid'?'#91b950':colors[b.level]+'e8');
  ctx.fillStyle=gradient;ctx.fill();ctx.strokeStyle='#30352e19';ctx.lineWidth=.8;ctx.stroke();
  if(glow>0){ctx.fillStyle=`rgba(255,255,255,${(.42*glow).toFixed(3)})`;ctx.fill();}
  // Faces and highlights deform with the membrane and never paint outside it.
  ctx.clip();
  ctx.fillStyle='#ffffff42';ctx.beginPath();ctx.ellipse(b.x-r*.33,b.y-r*.52,r*.22,r*.08,-.25,0,Math.PI*2);ctx.fill();
  const bounds=b.bounds;
  const faceX=bounds?Math.max(.55,Math.min(1.3,(bounds.maxX-bounds.minX)/(2*r))):1;
  const faceY=bounds?Math.max(.55,Math.min(1.3,(bounds.maxY-bounds.minY)/(2*r))):1;
  ctx.translate(b.x,b.y);ctx.scale(faceX,faceY);ctx.translate(-b.x,-b.y);
  ctx.fillStyle='#384031';
  for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(b.x+side*r*.23,b.y-r*.12,Math.max(1.5,r*.055),Math.max(2,r*.07),0,0,Math.PI*2);ctx.fill();}
  ctx.beginPath();ctx.moveTo(b.x-r*.1,b.y+r*.04);ctx.quadraticCurveTo(b.x,b.y+r*.17,b.x+r*.1,b.y+r*.04);ctx.strokeStyle='#384031';ctx.lineWidth=Math.max(1,r*.035);ctx.lineCap='round';ctx.stroke();
  ctx.font=`700 ${Math.max(9,r*.38)}px Manrope, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#384031cf';ctx.fillText(value,b.x,b.y+r*.45);
  ctx.restore();
}
