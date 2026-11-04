// A round keeps its UUID across saves. Monotonic per-round counts make retries,
// restored rounds and two tabs submitting the same round safe to replay.
export const MILESTONE_BATCH_SIZE=50;
export const validMilestoneRun=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export const validMilestoneCount=count=>Number.isSafeInteger(count)&&count>0&&count<=1000000;
export function mergeMilestoneRuns(target,source){
  if(!source||typeof source!=='object'||Array.isArray(source))return false;
  let changed=false;
  for(const [id,count] of Object.entries(source))if(validMilestoneRun(id)&&validMilestoneCount(count)&&count>(target[id]??0)){
    target[id]=count;changed=true;
  }
  return changed;
}
export const pendingMilestoneRuns=profile=>Object.entries(profile.milestoneRuns??{}).filter(([id,count])=>count>(profile.milestoneSynced?.[id]??0));
