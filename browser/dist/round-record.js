// Each bottle keeps its own Classic round. An existing three-neck round is
// cleared once, then later play records a new one under the same key.
export const CLASSIC_ROUND_KEY = 'squish-pocket-v1';
export const FLASK_ROUND_KEY = 'squish-pocket-v1:lab-flask';
export const FLASK_RERECORD_FLAG = 'squish-pocket-v1:lab-flask:rerecorded';

export function roundSaveKey(bottleId) {
  if (bottleId === 'classic') return CLASSIC_ROUND_KEY;
  if (bottleId === 'lab-flask') return FLASK_ROUND_KEY;
  return null;
}

export function readRound(storage, bottleId) {
  const key = roundSaveKey(bottleId);
  if (!key) return null;
  try {
    const data = JSON.parse(storage.getItem(key));
    return data?.version === 1 ? data : null;
  } catch {
    return null;
  }
}

export function writeRound(storage, bottleId, data) {
  const key = roundSaveKey(bottleId);
  if (!key) return false;
  storage.setItem(key, JSON.stringify(data));
  return true;
}

// Drop a previously saved flask round once. Flag "2" means that clear included
// the flask's own highest score. An older "1" only deleted the pile, and the
// shared personal best was then written back, so that visit is cleared again.
export function rerecordFlaskRound(storage) {
  try {
    if (storage.getItem(FLASK_RERECORD_FLAG) === '2') return false;
    storage.removeItem(FLASK_ROUND_KEY);
    storage.setItem(FLASK_RERECORD_FLAG, '2');
    return true;
  } catch {
    return false;
  }
}

// The flask shows the best stored with its own round. The shared achievement
// score stays on the original bottle and in the hall of fame.
export function displayedBest(bottleId, savedBest, score, sharedBest) {
  const own = Math.max(validScore(savedBest), validScore(score));
  if (bottleId === 'lab-flask') return own;
  return Math.max(own, validScore(sharedBest));
}

function validScore(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function savedRoundReady(bottleId, data) {
  if (!roundSaveKey(bottleId)) return false;
  return data?.version === 1 && data.started === true && !data.engine?.over && (data.engine?.bottleId ?? 'classic') === bottleId;
}

export function classicPlayLabel(bottleId, saved) {
  return roundSaveKey(bottleId) && saved ? 'Continue Classic' : 'Play Classic';
}

export function classicSaveNote(bottleId, saved) {
  return saved
    ? 'Your saved pile is ready. The other bottle’s round stays saved too.'
    : 'Each bottle keeps its own saved round.';
}

export function pauseFootnote() {
  return 'SAVED IN THIS BROWSER.';
}
