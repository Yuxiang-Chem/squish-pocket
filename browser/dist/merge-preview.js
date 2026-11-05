import {drawBlobArt} from './blob-art.js?v=91';
import {ruleFor,valueFor} from './merge-rules.js?v=91';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const PERIOD=3800;
function body(x,y,r,sx,sy,time){
  const nodes=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12,w=1+.018*Math.sin(i*1.7+time*3);return {x:x+Math.cos(a)*r*sx*w,y:y+Math.sin(a)*r*sy*w};});
  return {x,y,level:0,renderRadius:r,nodes,bounds:{minX:Math.min(...nodes.map(p=>p.x)),maxX:Math.max(...nodes.map(p=>p.x)),minY:Math.min(...nodes.map(p=>p.y)),maxY:Math.max(...nodes.map(p=>p.y))}};
}
function paint(ctx,x,y,r,sx,sy,level,mode,time,alpha=1,glow=0){
  const b=body(x,y,r,sx,sy,time);b.level=level;drawBlobArt(ctx,b,{value:valueFor(level,mode),alpha,glow});
}
export function paintMergePreview(canvas,mode,time=0,reducedMotion=false){
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(canvas.width/220,0,0,canvas.height/99,0,0);
  const rule=ruleFor(mode),r=19.5*rule.blobScale,count=rule.count;
  if(reducedMotion){
    const positions=count===2?[43,75]:[26,59,92];
    for(const x of positions)paint(ctx,x,49.5,r*.58,1.06,.94,0,mode,0);
    ctx.strokeStyle='#9da58e';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(116,49.5);ctx.lineTo(136,49.5);ctx.moveTo(131,44.5);ctx.lineTo(136,49.5);ctx.lineTo(131,54.5);ctx.stroke();
    paint(ctx,174,49.5,r*.72,1.05,.95,1,mode,0);return;
  }
  const phase=((time%PERIOD)+PERIOD)%PERIOD/PERIOD,seconds=time/1000;
  const approach=smooth((phase-.16)/.23),fuse=smooth((phase-.38)/.065),fade=1-smooth((phase-.84)/.1);
  const sourceAlpha=phase<.46?1-fuse:smooth((phase-.95)/.05);
  const starts=count===2?[-46,46]:[-61,0,61],ends=count===2?[-14,14]:[-25,0,25];
  if(sourceAlpha>0)for(let i=0;i<count;i++){
    const position=phase>.9?starts[i]:starts[i]+(ends[i]-starts[i])*approach;
    const squeeze=phase>.9?0:approach*approach;
    paint(ctx,110+position,49.5+Math.sin(seconds*3+i)*.6,r,1.06-.28*squeeze,.94+.2*squeeze,0,mode,seconds,sourceAlpha);
  }
  if(fuse>0&&fade>0){
    const age=Math.max(0,(phase-.4)*PERIOD/1000),bounce=.16*Math.sin(age*22)*Math.exp(-age*7),growth=.48+.52*smooth((phase-.38)/.075);
    paint(ctx,110,49.5,r*1.2*growth,1.02-bounce,1/(1.02-bounce),1,mode,seconds,fuse*fade,Math.max(0,1-age/.22)*.45);
    if(age>0&&age<.45){
      const life=1-age/.45;ctx.save();ctx.globalAlpha=life*.55;ctx.strokeStyle='#e6c87f';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(110,49.5,r*1.2+age*38,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#e6c87f';for(let k=0;k<8;k++){const a=k*Math.PI/4,d=r*1.4+age*45;ctx.beginPath();ctx.arc(110+Math.cos(a)*d,49.5+Math.sin(a)*d,1.5*life,0,Math.PI*2);ctx.fill();}ctx.restore();
    }
  }
}
export function createMergePreviews(){
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),items=[...document.querySelectorAll('[data-merge-preview]')].map(canvas=>({canvas,mode:canvas.dataset.mergePreview,visible:false,last:-Infinity,still:false}));
  const lookup=new Map(items.map(item=>[item.canvas,item]));
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){const item=lookup.get(entry.target);item.visible=entry.isIntersecting;if(item.visible){item.last=-Infinity;item.still=false;}}});
  for(const item of items){paintMergePreview(item.canvas,item.mode,0,motion.matches);observer.observe(item.canvas);}
  motion.addEventListener('change',()=>{for(const item of items){item.still=false;item.last=-Infinity;}});
  const start=performance.now();
  return {draw(now){if(document.hidden)return;for(const item of items){if(!item.visible||now-item.last<1000/30||(motion.matches&&item.still))continue;paintMergePreview(item.canvas,item.mode,now-start,motion.matches);item.last=now;item.still=motion.matches;}}};
}
