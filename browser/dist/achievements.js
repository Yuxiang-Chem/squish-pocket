const KEY = 'squish-pocket-achievements-v1';
const BOTTLE_IDS = ['classic', 'lab-flask'];
const validId = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const validTile = value => Number.isInteger(value) && value >= 2 && value <= 4096 && !(value & (value - 1));
const validScore = value => Number.isSafeInteger(value) && value >= 0;
const bottleKey = id => id === 'lab-flask' ? 'lab-flask' : 'classic';
const blankBottle = () => ({score: 0, highestTile: 2});
const bottleName = id => id === 'lab-flask' ? 'Three-neck flask' : 'Original bottle';

function bottleRow(value) {
  return validScore(value?.score) && validTile(value?.highestTile) ? {score: value.score, highestTile: value.highestTile} : null;
}

export function loadProfile(storage = localStorage) {
  try {
    const data = JSON.parse(storage.getItem(KEY));
    if (validId(data?.id) && validId(data.token)) {
      const classic = bottleRow(data.bottles?.classic) ?? (validScore(data.score) && validTile(data.highestTile) ? {score: data.score, highestTile: data.highestTile} : null);
      if (classic) {
        return {
          id: data.id, token: data.token, name: typeof data.name === 'string' ? data.name.slice(0, 32) : 'A squishy friend',
          score: classic.score, highestTile: classic.highestTile,
          bottles: {classic, 'lab-flask': bottleRow(data.bottles?.['lab-flask']) ?? blankBottle()}
        };
      }
    }
  } catch { /* The game still works without storage. */ }
  return {id: crypto.randomUUID(), token: crypto.randomUUID(), name: 'A squishy friend', score: 0, highestTile: 2,
    bottles: {classic: blankBottle(), 'lab-flask': blankBottle()}};
}

export function captureProgress(profile, engine, personalBest = engine.score) {
  const id = bottleKey(engine.bottleId);
  if (!profile.bottles || !BOTTLE_IDS.every(key => bottleRow(profile.bottles[key]))) {
    const classic = bottleRow(profile.bottles?.classic) ?? (validScore(profile.score) && validTile(profile.highestTile) ? {score: profile.score, highestTile: profile.highestTile} : blankBottle());
    profile.bottles = {classic, 'lab-flask': bottleRow(profile.bottles?.['lab-flask']) ?? blankBottle()};
  }
  const row = profile.bottles[id];
  const score = Math.max(row.score, engine.score, validScore(personalBest) ? personalBest : 0);
  const highestTile = Math.max(row.highestTile, 2 ** ((engine.highestLevel ?? 0) + 1));
  const changed = score !== row.score || highestTile !== row.highestTile;
  row.score = score; row.highestTile = highestTile;
  if (id === 'classic') { profile.score = score; profile.highestTile = highestTile; }
  return changed;
}

export class Achievements {
  constructor({onMilestone = () => {}, onUpdate = () => {}} = {}) {
    this.profile = loadProfile(); this.onMilestone = onMilestone; this.onUpdate = onUpdate;
    this.summary = null; this.pending = true; this.saving = null; this.lastAttempt = 0; this.bottleId = 'classic'; this.dirty = new Set();
    this.storageAvailable = this.persist();
    window.addEventListener('online', () => { void this.sync(true); });
  }
  bestFor(id) { return this.profile.bottles[bottleKey(id)]?.score ?? 0; }
  persist() {
    try { localStorage.setItem(KEY, JSON.stringify(this.profile)); return true; } catch { return false; }
  }
  observe(engine, best) {
    const id = bottleKey(engine.bottleId), switched = this.bottleId !== id;
    this.bottleId = id;
    const before = this.profile.bottles[id].highestTile;
    if (captureProgress(this.profile, engine, best)) {
      this.dirty.add(id); this.pending = true; this.storageAvailable = this.persist();
      if (before < 2048 && this.profile.bottles[id].highestTile >= 2048) this.onMilestone();
    }
    if (switched || (this.pending && Date.now() - this.lastAttempt > 15000)) void this.sync(switched);
  }
  async request(path, data) {
    const response = await fetch(path, {method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Player-Id': this.profile.id, 'Authorization': `Bearer ${this.profile.token}`
    }, body: JSON.stringify(data), signal: AbortSignal.timeout(12000), keepalive: true});
    let result;
    try { result = await response.json(); } catch { throw new Error('Shared achievements are unavailable. Your progress stays in this browser.'); }
    if (!response.ok) throw new Error(result.error || 'Please try again in a moment.');
    return result;
  }
  async sync(force = false) {
    if (this.saving) {
      await this.saving;
      if (force && this.pending) return this.sync(true);
      return this.summary;
    }
    this.lastAttempt = Date.now();
    const bottle = this.bottleId;
    const operation = (async () => {
      try {
        if (!this.storageAvailable) throw new Error('Browser saving is unavailable. Enable it to join shared achievements.');
        const row = this.profile.bottles[bottle];
        const snapshot = {name: this.profile.name, score: row.score, highestTile: row.highestTile, bottle};
        const summary = await this.request('/api/achievements', snapshot);
        this.dirty.delete(bottle);
        const current = this.profile.bottles[bottle];
        if (summary.personal && (!summary.bottle || summary.bottle === bottle)) {
          current.score = Math.max(current.score, summary.personal.score);
          current.highestTile = Math.max(current.highestTile, summary.personal.highestTile);
          if (bottle === 'classic') { this.profile.score = current.score; this.profile.highestTile = current.highestTile; }
          this.storageAvailable = this.persist();
        }
        // Another tab may have moved this bottle's record while the request was in flight.
        this.pending = this.dirty.size > 0 || snapshot.score !== current.score || snapshot.highestTile !== current.highestTile || snapshot.name !== this.profile.name;
        if (snapshot.score !== current.score || snapshot.highestTile !== current.highestTile || snapshot.name !== this.profile.name) this.dirty.add(bottle);
        this.error = '';
        if (!summary.bottle || summary.bottle === this.bottleId) { this.summary = summary; this.onUpdate(summary); }
        if (this.bottleId !== bottle && this.pending) return this.sync(true);
        return this.bottleId === bottle ? summary : this.summary;
      } catch (error) {
        this.error = error.name === 'TypeError' || error.name === 'TimeoutError' ? 'Couldn’t connect. Your progress is saved here; try again when online.' : error.message;
        this.onUpdate(this.summary); return null;
      }
    })();
    this.saving = operation;
    try { return await operation; } finally { this.saving = null; }
  }
  async rename(name) {
    this.profile.name = name.trim() || 'A squishy friend'; this.pending = true; this.dirty.add(this.bottleId);
    this.storageAvailable = this.persist(); return this.sync(true);
  }
  async send(message, replyTo) {
    const latest = await this.sync(true);
    if (!latest) throw new Error(this.error);
    if (!latest.isRecordHolder) throw new Error('Only the current highest-score holder can send a message.');
    return this.request('/api/record-message', {message, replyTo, bottle: this.bottleId});
  }
}

export function connectAchievements({getEngine, getBest, cancelAim, toast}) {
  const $ = id => document.getElementById(id), dialog = $('achievements-dialog');
  let sending = false;
  const tracker = new Achievements({onMilestone: () => toast('2048! You’ve joined the squishy achievers.'), onUpdate: render});
  function render() {
    const id = bottleKey(tracker.bottleId), row = tracker.profile.bottles[id], name = bottleName(id);
    const s = tracker.summary && (!tracker.summary.bottle || tracker.summary.bottle === id) ? tracker.summary : null;
    $('achievement-intro').textContent = `Every 2048 starts with a tiny two. This board is the ${name}.`;
    $('achievement-bottle').textContent = name;
    $('achievement-personal-tile').textContent = row.highestTile.toLocaleString();
    $('achievement-personal-score').textContent = row.score.toLocaleString();
    $('achievement-milestone').textContent = row.highestTile >= 2048 ? '2048 club · you made it!' : 'Your next little milestone: 2048';
    $('achievement-count').textContent = s ? s.reached2048.toLocaleString() : '—';
    $('achievement-count-label').textContent = `${s?.reached2048 === 1 ? 'player has reached 2048' : 'players have reached 2048'} in this bottle`;
    $('achievement-record').textContent = s?.record ? s.record.score.toLocaleString() : s ? 'Be the first' : '—';
    $('world-record').textContent = s ? (s.record?.score ?? 0).toLocaleString() : '—';
    $('world-record').title = tracker.error ? 'Last loaded world record. Reconnect to refresh.' : `Highest shared score for the ${name}`;
    $('achievement-holder').textContent = s?.record ? `${s.record.name} · highest score` : 'A little room for a new record';
    $('achievement-global-tile').textContent = s ? s.highestTile.toLocaleString() : '—';
    $('achievement-status').textContent = tracker.error || (s ? 'Shared records are up to date.' : 'Connecting to shared records…');
    const holder = !!s?.isRecordHolder && !tracker.error;
    $('record-message-form').classList.toggle('hidden', !holder);
    $('record-message-locked').classList.toggle('hidden', holder);
    $('record-send').disabled = sending || !holder || !s?.emailReady;
    $('record-email-note').textContent = s?.emailReady ? 'Your message goes to the creator’s inbox. One message per day for this bottle; a reply email is optional.' : 'The creator’s inbox is being connected. You can keep your message here until it’s ready.';
  }
  $('achievements').onclick = async () => {
    cancelAim(); tracker.observe(getEngine(), getBest()); render();
    $('achievement-name').value = tracker.profile.name;
    dialog.showModal(); await tracker.sync(true);
  };
  $('achievement-refresh').onclick = async () => { $('achievement-status').textContent = 'Refreshing shared records…'; await tracker.sync(true); };
  $('achievement-name-form').onsubmit = async event => {
    event.preventDefault(); $('achievement-status').textContent = 'Saving your name…';
    await tracker.rename($('achievement-name').value);
  };
  $('record-message-form').onsubmit = async event => {
    event.preventDefault(); const button = $('record-send'); if (button.disabled) return;
    sending = true; button.disabled = true; $('record-message-status').textContent = 'Sending your message…';
    try {
      await tracker.send($('record-message').value, $('record-reply').value);
      $('record-message-status').textContent = 'Message sent! Thanks for sharing your little victory.';
      $('record-message').value = ''; $('record-reply').value = '';
    } catch (error) { $('record-message-status').textContent = error.message; }
    finally { sending = false; render(); }
  };
  render(); return tracker;
}
