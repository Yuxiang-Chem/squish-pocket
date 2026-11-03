// Area-normalized nozzle-exit shape. +X is the rounded leading end; the narrow
// -X end trails the launch. These are membrane particles and constraints.
import {MIN_SHOT_SPEED,SHOT_SPEED_RANGE} from './controls.js?v=6';
export function ejectionShape(count,radius,stretch=1,taper=0){
  const points=Array.from({length:count},(_,k)=>{
    const a=k/count*Math.PI*2,f=Math.cos(a);
    return {x:f*stretch,y:Math.sin(a)*(1+taper*f)/stretch};
  });
  let area=0;
  for(let k=0;k<count;k++){const a=points[k],b=points[(k+1)%count];area+=(a.x*b.y-b.x*a.y)*.5;}
  const factor=radius*Math.sqrt((count*.5*Math.sin(2*Math.PI/count))/area);
  return points.map(p=>({x:p.x*factor,y:p.y*factor}));
}
export function ejectionPhase(b){return b.ejection?Math.exp(-b.age/b.ejection.relaxation):0;}
export function eject(body,radius,physics,dt=1/120){
  const speed=Math.hypot(body.vx,body.vy),strength=Math.max(0,Math.min(1,(speed-MIN_SHOT_SPEED)/SHOT_SPEED_RANGE)),compliance=1-physics.stiffness/150;
  const stretch=1.3+strength*.55*compliance,taper=.68+strength*.12;
  body.ejection={stretch,taper,relaxation:.20+compliance*.16+physics.viscosity/100*.12};
  const ux=body.vx/speed,uy=body.vy/speed;
  body.nodes=ejectionShape(24,radius,stretch,taper).map((p,k)=>{
    const forward=p.x*(body.restAspect?.x??1),lateral=p.y*(body.restAspect?.y??1);
    const x=body.x+forward*ux-lateral*uy,y=body.y+forward*uy+lateral*ux;
    // A faster leading surface and slower tail retain a small release strain.
    const impulse=speed*.10*strength*Math.cos(k/24*Math.PI*2);
    return {x,y,px:x-(body.vx+ux*impulse)*dt,py:y-(body.vy+uy*impulse)*dt};
  });
}
