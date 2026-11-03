// The original bottle keeps the only Classic round and the best stored with it.
// The three-neck flask is still playable, but it does not keep a separate record.
export const CLASSIC_ROUND_KEY = 'squish-pocket-v1';
export const RETIRED_ROUND_KEYS = Object.freeze(['squish-pocket-v1:lab-flask']);

export function roundSaveKey(bottleId) {
  return bottleId === 'classic' ? CLASSIC_ROUND_KEY : null;
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

export function forgetRetiredRounds(storage) {
  for (const key of RETIRED_ROUND_KEYS) {
    try { storage.removeItem(key); } catch { /* A blocked store simply leaves the unused flask record unread. */ }
  }
}

export function savedRoundReady(bottleId, data) {
  if (!roundSaveKey(bottleId)) return false;
  return data?.version === 1 && data.started === true && !data.engine?.over && (data.engine?.bottleId ?? 'classic') === bottleId;
}

export function classicPlayLabel(bottleId, saved) {
  return roundSaveKey(bottleId) && saved ? 'Continue Classic' : 'Play Classic';
}

export function classicSaveNote(bottleId, saved) {
  if (!roundSaveKey(bottleId)) return 'The three-neck flask starts fresh. The original bottle keeps its record.';
  return saved ? 'Your saved pile is ready.' : 'The original bottle keeps its round in this browser.';
}

export function pauseFootnote(bottleId) {
  return roundSaveKey(bottleId)
    ? 'SAVED IN THIS BROWSER.'
    : 'THIS FLASK STARTS FRESH NEXT VISIT. YOUR ORIGINAL-BOTTLE RECORD STAYS.';
}
