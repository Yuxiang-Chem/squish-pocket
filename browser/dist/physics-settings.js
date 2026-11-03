export const DEFAULT_PHYSICS=Object.freeze({stiffness:10,viscosity:0,blobSize:150});
export function normalizePhysics(settings){
  const result={};
  for(const key of ['stiffness','viscosity','blobSize']){
    const value=settings?.[key];
    const min=key==='blobSize'?40:0,max=key==='blobSize'?150:100;
    result[key]=Number.isFinite(value)?Math.max(min,Math.min(max,value)):DEFAULT_PHYSICS[key];
  }
  return result;
}
export function materialFor(settings=DEFAULT_PHYSICS){
  const normalized=normalizePhysics(settings),s=normalized.stiffness/100,v=normalized.viscosity/100;
  const low=Math.min(1,s/.3),high=Math.max(0,(s-.3)/.7);
  return {
    edge:s<=.3?.012+.188*low:.2+.78*high,
    bend:s<=.3?.001+.034*low:.035+.815*high,
    recovery:s<=.3?.000001+.000599*low*low:.0006+.1794*high*high,
    // Viscosity adds motion drag. Cooldowns and the clock keep their normal pace.
    drag:.02+v*v*((-Math.log(.996)*120-.02)/.04)
  };
}
export const DEFAULT_MATERIAL=Object.freeze(materialFor());

export const PHYSICS_DEFAULTS_VERSION=1;
export function upgradePhysicsDefaults(settings,version){
  const normalized=normalizePhysics(settings);
  if(version!==PHYSICS_DEFAULTS_VERSION&&normalized.stiffness===30&&normalized.viscosity===20&&normalized.blobSize===80)return {...DEFAULT_PHYSICS};
  return normalized;
}

// All players use the same material, including games restored from old saves.
// normalizePhysics/setPhysics still support the engine's simulation checks.
export function playerPhysics(){
  return {...DEFAULT_PHYSICS};
}
