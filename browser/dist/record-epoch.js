// Only rounds started with the repaired flask compete on its fresh world board.
export const FLASK_RECORD_EPOCH=2;

// The larger Three Combine blobs start a fresh achievement season.
export const THREE_RECORD_EPOCH=2;
export const achievementEpochFor=mode=>mode==='three'?THREE_RECORD_EPOCH:1;
export const recordEligible=engine=>(engine.mergeMode??'two')!=='three'||engine.achievementEpoch===THREE_RECORD_EPOCH;
export const recordScore=engine=>recordEligible(engine)?engine.score:0;

// Only the official Two Combine water-conical board starts a new season.
// Test/local boards and Three Combine keep their existing scores.
export const WATER_CONICAL_RECORD_EPOCH=2;
export const waterConicalResetActive=(mode='two',hostname=globalThis.location?.hostname)=>mode==='two'&&hostname==='squish.chemisgreat.online';
export const waterConicalRecordEligible=engine=>!waterConicalResetActive(engine.mergeMode??'two')||engine.bottleId!=='conical-flask-water'||engine.waterConicalRecordEpoch===WATER_CONICAL_RECORD_EPOCH;
