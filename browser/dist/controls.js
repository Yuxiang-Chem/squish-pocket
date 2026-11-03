// Angles are measured from downward: negative aims left, positive aims right.
export const LAUNCH_X=180,LAUNCH_Y=58,MAX_ANGLE=Math.PI*55/180;
export const DEAD_ZONE=22,MAX_DRAG=220;
export const MIN_SHOT_SPEED=80,SHOT_SPEED_RANGE=1000;
// Shots start from the selected ready blob. Resting slots span x 94–266; the
// launch point stays within that row so large blobs never start over the lip.
// Do not launch above the resting row: raised, very stiff 2048 blobs can ricochet out.
// A charging blob sinks up to CHARGE_DROP below the row at full force; a weak
// shot from lower down can rest on the lip, so the drop is limited by force.
export const ORIGIN_MIN_X=94,ORIGIN_MAX_X=266,ORIGIN_MIN_Y=LAUNCH_Y,CHARGE_DROP=10;
// Widest safe aim toward the nearer rim, in degrees, by distance from the center.
// Simulated values 2–4096, sampled forces and extreme physics settings stay inside
// with a few degrees to spare. Aiming toward the far side allows MAX_ANGLE.
export const NEAR_RIM_LIMITS=[[0,55],[20,48],[40,41],[63,26],[86,14]];
export function launchOrigin(origin,power=1){
  const x=Number.isFinite(origin?.x)?origin.x:LAUNCH_X,y=Number.isFinite(origin?.y)?origin.y:LAUNCH_Y;
  const lowest=LAUNCH_Y+CHARGE_DROP*Math.max(0,Math.min(1,Number.isFinite(power)?power:0));
  return {x:Math.max(ORIGIN_MIN_X,Math.min(ORIGIN_MAX_X,x)),y:Math.max(ORIGIN_MIN_Y,Math.min(lowest,y))};
}
function nearRimLimit(distance){
  const table=NEAR_RIM_LIMITS;
  for(let i=1;i<table.length;i++)if(distance<=table[i][0]){
    const [d0,a0]=table[i-1],[d1,a1]=table[i];return (a0+(a1-a0)*(distance-d0)/(d1-d0))*Math.PI/180;
  }
  return table.at(-1)[1]*Math.PI/180;
}
export function angleLimits(x=LAUNCH_X){
  const offset=launchOrigin({x}).x-LAUNCH_X,near=Math.min(MAX_ANGLE,nearRimLimit(Math.abs(offset)));
  return offset<0?{min:-near,max:MAX_ANGLE}:{min:-MAX_ANGLE,max:offset>0?near:MAX_ANGLE};
}
export function clampAngle(angle,origin){
  const {min,max}=angleLimits(origin?.x);return Math.max(min,Math.min(max,angle));
}
export function shotVector(angle,power,origin){
  if(!Number.isFinite(angle)||!Number.isFinite(power))return null;
  const direction=clampAngle(angle,origin);
  const strength=Math.max(0,Math.min(1,power)),speed=MIN_SHOT_SPEED+strength*SHOT_SPEED_RANGE;
  return {vx:Math.sin(direction)*speed,vy:Math.cos(direction)*speed};
}
export function aimFromPoint(x,y,origin){
  const o=launchOrigin(origin),dx=x-o.x,dy=y-o.y,distance=Math.hypot(dx,dy);
  const cancelled=distance<DEAD_ZONE||dy<-8;
  return {angle:clampAngle(Math.atan2(dx,Math.max(0,dy)),o),
    power:Math.max(0,Math.min(1,(distance-DEAD_ZONE)/(MAX_DRAG-DEAD_ZONE))),cancelled};
}
