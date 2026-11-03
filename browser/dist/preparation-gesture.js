import {clampAngle} from './controls.js?v=6';
// The dead zone sits below the charge threshold so the guide appears as soon
// as a pull starts charging. Diagonal pulls toward the bottle still charge.
export const PULL_THRESHOLD=8,PULL_DEAD_ZONE=4,FULL_PULL=180,AIM_PULL=24;
export function pullMode(start,point){
  const dx=point.x-start.x,dy=point.y-start.y;
  if(Math.hypot(dx,dy)<=PULL_THRESHOLD)return 'pending';
  return dy>PULL_DEAD_ZONE&&dy>Math.abs(dx)*.35?'charge':'drag';
}
export function pullShot(start,point,origin){
  const dx=point.x-start.x,dy=point.y-start.y;
  return {power:Math.max(0,Math.min(1,(dy-PULL_DEAD_ZONE)/(FULL_PULL-PULL_DEAD_ZONE))),
    angle:clampAngle(Math.atan2(dx,Math.max(AIM_PULL,dy)),origin),cancelled:dy<=PULL_DEAD_ZONE};
}
// Stable anchors prevent the shifting neighbors from moving the drop targets.
export function insertionIndex(point,anchors,rowY=58){
  if(anchors.length!==3||point.y<rowY-100||point.y>rowY+36||point.x<anchors[0]-60||point.x>anchors[2]+60)return null;
  return point.x<(anchors[0]+anchors[1])/2?0:point.x<(anchors[1]+anchors[2])/2?1:2;
}
export function insertedOrder(items,id,index){
  const source=items.find(item=>item.id===id);if(!source)return [...items];
  const result=items.filter(item=>item.id!==id);result.splice(Math.max(0,Math.min(result.length,index)),0,source);return result;
}
