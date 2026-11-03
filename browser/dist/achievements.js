const KEY = 'squish-pocket-achievements-v1';
const validId = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
export function loadProfile(storage = localStorage) {
  try {
    const data = JSON.parse(storage.getItem(KEY));
    if (validId(data?.id) && validId(data.token) && Number.isSafeInteger(data.score) && data.score >= 0 &&
        Number.isInteger(data.highestTile) && data.highestTile >= 2 && data.highestTile <= 4096 && !(data.highestTile & (data.highestTile - 1))) {
      return {...data, name: typeof data.name === 'string' ? data.name.slice(0,32) : 'A squishy friend'};
    }
  } catch { /* The game still works without storage. */ }
  return {id: crypto.randomUUID(), token: crypto.randomUUID(), name: 'A squishy friend', score: 0, highestTile: 2};
}

export function captureProgress(profile, engine, personalBest = engine.score) {
  const score = Math.max(profile.score, engine.score, personalBest);
  const highestTile = Math.max(profile.highestTile, 2 ** (engine.highestLevel + 1));
  const changed = score !== profile.score || highestTile !== profile.highestTile;
  profile.score = score; profile.highestTile = highestTile;
  return changed;
}

export class Achievements {
  constructor({onMilestone = () => {}, onUpdate = () => {}} = {}) {
    this.profile = loadProfile(); this.onMilestone = onMilestone; this.onUpdate = onUpdate;
    this.summary = null; this.pending = true; this.saving = null; this.lastAttempt = 0;
    this.storageAvailable = this.persist();
    window.addEventListener('online', () => { void this.sync(true); });
  }
  persist() {
    try { localStorage.setItem(KEY, JSON.stringify(this.profile)); return true; } catch { return false; }
  }
  observe(engine, best) {
    const before = this.profile.highestTile;
    if (captureProgress(this.profile, engine, best)) {
      this.pending = true; this.storageAvailable = this.persist();
      if (before < 2048 && this.profile.highestTile >= 2048) this.onMilestone();
    }
    if (this.pending && Date.now() - this.lastAttempt > 15000) void this.sync();
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
    const operation = (async () => {
      try {
        if (!this.storageAvailable) throw new Error('Browser saving is unavailable. Enable it to join shared achievements.');
        const snapshot = {name: this.profile.name, score: this.profile.score, highestTile: this.profile.highestTile};
        this.summary = await this.request('/api/achievements', snapshot);
        this.pending = snapshot.score !== this.profile.score || snapshot.highestTile !== this.profile.highestTile || snapshot.name !== this.profile.name;
        // Another tab may have submitted a newer record using this identity.
        if (this.summary.personal) {
          this.profile.score = Math.max(this.profile.score, this.summary.personal.score);
          this.profile.highestTile = Math.max(this.profile.highestTile, this.summary.personal.highestTile);
          this.storageAvailable = this.persist();
        }
        this.error = ''; this.onUpdate(this.summary); return this.summary;
      } catch (error) {
        this.error = error.name === 'TypeError' || error.name === 'TimeoutError' ? 'Couldn’t connect. Your progress is saved here; try again when online.' : error.message;
        this.onUpdate(this.summary); return null;
      }
    })();
    this.saving = operation;
    try { return await operation; } finally { this.saving = null; }
  }
  async rename(name) {
    this.profile.name = name.trim() || 'A squishy friend'; this.pending = true;
    this.storageAvailable = this.persist(); return this.sync(true);
  }
  async send(message, replyTo) {
    const latest = await this.sync(true);
    if (!latest) throw new Error(this.error);
    if (!latest.isRecordHolder) throw new Error('Only the current highest-score holder can send a message.');
    return this.request('/api/record-message', {message, replyTo});
  }
}

export function connectAchievements({getEngine, getBest, cancelAim, toast}) {
  const $ = id => document.getElementById(id), dialog = $('achievements-dialog');
  let sending = false;
  const tracker = new Achievements({onMilestone: () => toast('2048! You’ve joined the squishy achievers.'), onUpdate: render});
  function render() {
    const p = tracker.profile, s = tracker.summary;
    $('achievement-personal-tile').textContent = p.highestTile.toLocaleString();
    $('achievement-personal-score').textContent = p.score.toLocaleString();
    $('achievement-milestone').textContent = p.highestTile >= 2048 ? '2048 club · you made it!' : 'Your next little milestone: 2048';
    $('achievement-count').textContent = s ? s.reached2048.toLocaleString() : '—';
    $('achievement-count-label').textContent = s?.reached2048 === 1 ? 'player has reached 2048' : 'players have reached 2048';
    $('achievement-record').textContent = s?.record ? s.record.score.toLocaleString() : s ? 'Be the first' : '—';
    $('world-record').textContent = s ? (s.record?.score ?? 0).toLocaleString() : '—';
    $('world-record').title = tracker.error ? 'Last loaded world record. Reconnect to refresh.' : 'Highest shared score';
    $('achievement-holder').textContent = s?.record ? `${s.record.name} · highest score` : 'A little room for a new record';
    $('achievement-global-tile').textContent = s ? s.highestTile.toLocaleString() : '—';
    $('achievement-status').textContent = tracker.error || (s ? 'Shared records are up to date.' : 'Connecting to shared records…');
    const holder = !!s?.isRecordHolder && !tracker.error;
    $('record-message-form').classList.toggle('hidden', !holder);
    $('record-message-locked').classList.toggle('hidden', holder);
    $('record-send').disabled = sending || !holder || !s?.emailReady;
    $('record-email-note').textContent = s?.emailReady ? 'Your message goes to the creator’s inbox. One message per day; a reply email is optional.' : 'The creator’s inbox is being connected. You can keep your message here until it’s ready.';
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
