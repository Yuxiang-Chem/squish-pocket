// Non-mutating contact test for the actual membrane outline, including edge
// crossings and a small tolerance for the rounded canvas outline.
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
function pointSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(.000001,dx*dx+dy*dy)));
  return (p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;
}
function inside(p,nodes){
  let result=false;
  for(let i=0,j=nodes.length-1;i<nodes.length;j=i++){
    const a=nodes[i],b=nodes[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
  }
  return result;
}
export function outlinesTouch(a,b,tolerance=1.5){
  const aa=a.bounds,bb=b.bounds;
  if(aa.maxX+tolerance<bb.minX||bb.maxX+tolerance<aa.minX||aa.maxY+tolerance<bb.minY||bb.maxY+tolerance<aa.minY)return false;
  const an=a.nodes,bn=b.nodes;
  if(inside(an[0],bn)||inside(bn[0],an))return true;
  for(let i=0;i<an.length;i++)for(let j=0;j<bn.length;j++){
    const p=an[i],q=an[(i+1)%an.length],u=bn[j],v=bn[(j+1)%bn.length];
    const ax=q.x-p.x,ay=q.y-p.y,bx=v.x-u.x,by=v.y-u.y,denom=cross(ax,ay,bx,by);
    if(Math.abs(denom)>.000001){
      const dx=u.x-p.x,dy=u.y-p.y,t=cross(dx,dy,bx,by)/denom,s=cross(dx,dy,ax,ay)/denom;
      if(t>=0&&t<=1&&s>=0&&s<=1)return true;
    }
    if(pointSegment(p,u,v)<=tolerance*tolerance||pointSegment(u,p,q)<=tolerance*tolerance)return true;
  }
  return false;
}
export function renderedOutline(body,pose={sx:1,sy:1,tilt:0}){
  if(pose.sx===1&&pose.sy===1&&pose.tilt===0)return body;
  const c=Math.cos(pose.tilt),s=Math.sin(pose.tilt);
  const nodes=body.nodes.map(p=>{
    const x=(p.x-body.x)*pose.sx,y=(p.y-body.y)*pose.sy;
    return {x:body.x+x*c-y*s,y:body.y+x*s+y*c};
  });
  return {nodes,bounds:{minX:Math.min(...nodes.map(p=>p.x)),maxX:Math.max(...nodes.map(p=>p.x)),minY:Math.min(...nodes.map(p=>p.y)),maxY:Math.max(...nodes.map(p=>p.y))}};
}
