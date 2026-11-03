import {BOTTLES} from './bottles.js?v=44';
const KEY = 'squish-pocket-achievements-v1';
const FLASK_SCORE_RESET = 'squish-pocket-flask-score-reset';
const FLASK_ID = 'lab-flask';
const validId = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const validRecord = value => Number.isSafeInteger(value?.score) && value.score >= 0 &&
  Number.isInteger(value.highestTile) && value.highestTile >= 2 && value.highestTile <= 4096 && !(value.highestTile & (value.highestTile - 1));
function bottleRecords(records) {
  return Object.fromEntries(Object.keys(BOTTLES).filter(id => validRecord(records?.[id]))
    .map(id => [id, {score: records[id].score, highestTile: records[id].highestTile}]));
}
function mergeRecords(profile, records) {
  profile.bottles ??= {};
  for (const [id, record] of Object.entries(bottleRecords(records))) {
    const previous = profile.bottles[id] ?? {score: 0, highestTile: 2};
    profile.bottles[id] = {score: Math.max(previous.score, record.score), highestTile: Math.max(previous.highestTile, record.highestTile)};
    profile.score = Math.max(profile.score, record.score);profile.highestTile = Math.max(profile.highestTile, record.highestTile);
  }
}
function scoreOf(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

// Clear the three-neck flask's own highest score once. The saved round is
// removed so its current score is not immediately recorded again. Later play
// records a new best. Scores at or below the cleared value are not copied
// back from the shared server record.
export function resetFlaskBest(storage) {
  try {
    const existing = JSON.parse(storage.getItem(FLASK_SCORE_RESET));
    if (existing?.version === 1) return existing;
  } catch { /* A damaged flag is replaced below. */ }
  let profile = null;
  try { profile = JSON.parse(storage.getItem(KEY)); } catch { profile = null; }
  let baseline = scoreOf(profile?.bottles?.[FLASK_ID]?.score);
  try {
    const saved = JSON.parse(storage.getItem(`squish-pocket-v1:${FLASK_ID}`));
    baseline = Math.max(baseline, scoreOf(saved?.best), scoreOf(saved?.engine?.score));
    storage.removeItem(`squish-pocket-v1:${FLASK_ID}`);
  } catch { /* The round is already gone. */ }
  if (profile) {
    profile.bottles ??= {};
    const row = profile.bottles[FLASK_ID] ?? {score: 0, highestTile: 2};
    profile.bottles[FLASK_ID] = {...row, score: 0};
  }
  const state = {version: 1, baseline: {[FLASK_ID]: baseline}};
  try {
    if (profile) storage.setItem(KEY, JSON.stringify(profile));
    storage.setItem(FLASK_SCORE_RESET, JSON.stringify(state));
  } catch { return null; }
  return state;
}

export function flaskScoreBaseline(storage = localStorage) {
  try {
    const state = JSON.parse(storage.getItem(FLASK_SCORE_RESET));
    return state?.version === 1 ? state.baseline ?? {} : {};
  } catch { return {}; }
}

export function rememberFlaskBaseline(storage, baseline) {
  const state = {version: 1, baseline};
  try { storage.setItem(FLASK_SCORE_RESET, JSON.stringify(state)); } catch { /* The in-memory baseline still covers this visit. */ }
  return state;
}

export function visibleFlaskScore(bottleId, localScore, sharedScore, baseline) {
  const cap = baseline?.[bottleId];
  const shared = scoreOf(sharedScore);
  if (Number.isSafeInteger(cap) && shared <= cap) return scoreOf(localScore);
  return Math.max(scoreOf(localScore), shared);
}

export function loadProfile(storage = localStorage) {
  let profile;
  try {
    const data = JSON.parse(storage.getItem(KEY));
    if (validId(data?.id) && validId(data.token) && Number.isSafeInteger(data.score) && data.score >= 0 &&
        Number.isInteger(data.highestTile) && data.highestTile >= 2 && data.highestTile <= 4096 && !(data.highestTile & (data.highestTile - 1))) {
      profile = {...data, bottles: bottleRecords(data.bottles), name: typeof data.name === 'string' ? data.name.slice(0,32) : 'A squishy friend',
        recordCelebrations: Object.fromEntries(Object.keys(BOTTLES).filter(id => Number.isSafeInteger(data.recordCelebrations?.[id]) && data.recordCelebrations[id] > 0).map(id => [id, data.recordCelebrations[id]]))};
    }
  } catch { /* The game still works without storage. */ }
  profile ??= {id: crypto.randomUUID(), token: crypto.randomUUID(), name: 'A squishy friend', score: 0, highestTile: 2, bottles: {}, recordCelebrations: {}};
  // Older overall records have no vessel attribution. Recover only scores
  // belonging to an actual saved round, never its shared all-bottle "best".
  for (const id of Object.keys(BOTTLES)) {
    try {
      const saved = JSON.parse(storage.getItem(id === 'classic' ? 'squish-pocket-v1' : `squish-pocket-v1:${id}`));
      const engine = saved?.engine;
      if (saved?.version !== 1 || (engine?.bottleId ?? 'classic') !== id) continue;
      const levels = [...(engine.blobs ?? []), ...(engine.rack ?? [])].map(b => b.level).filter(n => Number.isInteger(n) && n >= 0 && n <= 11);
      const highestTile = 2 ** (Math.max(0, engine.highestLevel ?? 0, ...levels) + 1);
      mergeRecords(profile, {[id]: {score: engine.score, highestTile}});
    } catch { /* Missing or malformed rounds do not affect existing records. */ }
  }
  mergeRecords(profile, profile.bottles);
  return profile;
}

export function captureProgress(profile, engine, personalBest = engine.score) {
  const score = Math.max(profile.score, engine.score, personalBest);
  const highestTile = Math.max(profile.highestTile, 2 ** (engine.highestLevel + 1));
  const previous = profile.bottles?.[engine.bottleId];
  const changed = score !== profile.score || highestTile !== profile.highestTile ||
    !previous || engine.score > previous.score || 2 ** (engine.highestLevel + 1) > previous.highestTile;
  profile.score = score; profile.highestTile = highestTile;
  if (Object.hasOwn(BOTTLES, engine.bottleId)) mergeRecords(profile, {[engine.bottleId]: {score: engine.score, highestTile: 2 ** (engine.highestLevel + 1)}});
  return changed;
}

export function roundRecords(profile, summary, engine, baseline = {}) {
  const shared = summary?.bottles?.[engine.bottleId];
  const personalBest = visibleFlaskScore(engine.bottleId, Math.max(engine.score, profile.bottles?.[engine.bottleId]?.score ?? 0), shared?.personal?.score ?? 0, baseline);
  return {
    personalBest,
    worldBest: shared ? shared.record?.score ?? 0 : null
  };
}

export function canMessage(summary, bottle = 'all') {
  if(typeof bottle !== 'string')return false;
  return bottle === 'all' ? !!summary?.isRecordHolder : Object.hasOwn(BOTTLES, bottle) && !!summary?.bottles?.[bottle]?.isRecordHolder;
}

export function newlyWonBottles(previous, summary, celebrated = {}) {
  return Object.keys(BOTTLES).filter(id => {
    const record = summary?.bottles?.[id];
    const seen = Number.isSafeInteger(celebrated?.[id]) ? celebrated[id] : 0;
    return record?.isRecordHolder && record.record?.score > seen && !previous?.bottles?.[id]?.isRecordHolder;
  });
}

export class Achievements {
  constructor({onMilestone = () => {}, onUpdate = () => {}, onRecord = () => {}} = {}) {
    this.profile = loadProfile(); this.flaskBaseline = flaskScoreBaseline(); this.onMilestone = onMilestone; this.onUpdate = onUpdate; this.onRecord = onRecord;
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
        const snapshot = {name: this.profile.name, score: this.profile.score, highestTile: this.profile.highestTile, bottles: structuredClone(this.profile.bottles)};
        const previous = this.summary;
        this.summary = await this.request('/api/achievements', snapshot);
        const recordsWon = newlyWonBottles(previous, this.summary, this.profile.recordCelebrations);
        this.pending = snapshot.score !== this.profile.score || snapshot.highestTile !== this.profile.highestTile || snapshot.name !== this.profile.name || JSON.stringify(snapshot.bottles) !== JSON.stringify(this.profile.bottles);
        // Another tab may have submitted a newer record using this identity.
        if (this.summary.personal) {
          this.profile.score = Math.max(this.profile.score, this.summary.personal.score);
          this.profile.highestTile = Math.max(this.profile.highestTile, this.summary.personal.highestTile);
        }
        const cap = this.flaskBaseline?.[FLASK_ID];
        const beforeFlask = scoreOf(this.profile.bottles?.[FLASK_ID]?.score);
        mergeRecords(this.profile, Object.fromEntries(Object.entries(this.summary.bottles ?? {}).map(([id, record]) => [id, record.personal])));
        if (Number.isSafeInteger(cap) && this.profile.bottles?.[FLASK_ID]) {
          const serverFlask = scoreOf(this.summary.bottles?.[FLASK_ID]?.personal?.score);
          if (serverFlask <= cap) this.profile.bottles[FLASK_ID].score = beforeFlask;
          this.flaskBaseline[FLASK_ID] = Math.max(cap, serverFlask);
          rememberFlaskBaseline(localStorage, this.flaskBaseline);
        }
        this.storageAvailable = this.persist();
        this.error = ''; this.onUpdate(this.summary);
        for (const bottle of recordsWon) this.onRecord({bottle, score: this.summary.bottles[bottle].record.score});
        return this.summary;
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
  async send(message, replyTo, bottle = 'all') {
    const latest = await this.sync(true);
    if (!latest) throw new Error(this.error);
    if (!canMessage(latest, bottle)) throw new Error('Only this record’s current holder can send a message.');
    return this.request('/api/record-message', {message, replyTo, bottle});
  }
}

export function connectAchievements({getEngine, getBest, cancelAim, toast}) {
  const $ = id => document.getElementById(id), dialog = $('achievements-dialog');
  const pageIds = ['all', ...Object.keys(BOTTLES)], pages = $('achievement-pages');
  const celebration = $('champion-page'), recordQueue = [];
  let celebrating = null;
  let selectedPage = 0;
  for (const [id, vessel] of Object.entries(BOTTLES)) {
    const panel = document.createElement('section');
    panel.id = `achievement-page-${id}`;panel.className = 'achievement-page';panel.setAttribute('role', 'tabpanel');panel.setAttribute('aria-labelledby', `achievement-tab-${id}`);
    panel.innerHTML = `<h3 class="achievement-bottle-title"><canvas width="120" height="140" aria-hidden="true"></canvas>${vessel.name}<span>Its own little hall of fame</span></h3>
      <div class="achievement-card achievement-world"><span class="label">WORLD HIGH SCORE</span><strong data-record>—</strong><span data-holder>A little room for a new record</span><span>Biggest merge: <b data-global-tile>—</b></span><button type="button" data-celebrate class="text-button hidden">Your champion page →</button></div>
      <div class="achievement-personal"><span data-milestone>Your next little milestone: 2048</span><div><span>YOUR BIGGEST MERGE <b data-personal-tile>2</b></span><span>YOUR BEST SCORE <b data-personal-score>0</b></span></div></div>`;
    pages.append(panel);
    panel.querySelector('[data-celebrate]').onclick = () => showChampion(id);
    const context = panel.querySelector('canvas').getContext('2d');context.scale(1/3, 1/3);vessel.drawBottleBack(context);vessel.drawBottleFront(context);
  }
  function updatePage(index) {
    const changed = selectedPage !== index;
    selectedPage = index;
    pageIds.forEach((id, i) => {
      const tab = $(`achievement-tab-${id}`);tab.setAttribute('aria-selected', String(i === index));tab.tabIndex = i === index ? 0 : -1;
      $(`achievement-page-${id}`).inert = i !== index;
    });
    $('achievement-previous').disabled = index === 0;$('achievement-next').disabled = index === pageIds.length - 1;
    $('achievement-page-number').textContent = `${index + 1} / ${pageIds.length}`;
    const activeTab=$(`achievement-tab-${pageIds[index]}`),nav=activeTab.parentElement;
    if(activeTab.offsetLeft<nav.scrollLeft)nav.scrollLeft=activeTab.offsetLeft;
    else if(activeTab.offsetLeft+activeTab.offsetWidth>nav.scrollLeft+nav.clientWidth)nav.scrollLeft=activeTab.offsetLeft+activeTab.offsetWidth-nav.clientWidth;
    if(changed)renderMessageEligibility(true);
  }
  function selectPage(index, animate = true) {
    index = Math.max(0, Math.min(pageIds.length - 1, index));updatePage(index);
    const panel = $(`achievement-page-${pageIds[index]}`);
    pages.scrollTo({left: panel.offsetLeft - pages.firstElementChild.offsetLeft,
      behavior: animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant'});
  }
  pages.addEventListener('scroll', () => {
    let closest = 0, distance = Infinity;
    [...pages.children].forEach((panel, i) => {const d = Math.abs(panel.offsetLeft - pages.firstElementChild.offsetLeft - pages.scrollLeft);if (d < distance) {distance = d;closest = i;}});
    updatePage(closest);
  }, {passive: true});
  pageIds.forEach((id, i) => $(`achievement-tab-${id}`).onclick = () => selectPage(i));
  $('achievement-previous').onclick = () => selectPage(selectedPage - 1);
  $('achievement-next').onclick = () => selectPage(selectedPage + 1);
  for (const target of [pages, dialog.querySelector('.achievement-bottle-tabs')]) target.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    selectPage(event.key === 'Home' ? 0 : event.key === 'End' ? pageIds.length - 1 : selectedPage + (event.key === 'ArrowLeft' ? -1 : 1));
    if (target !== pages) $(`achievement-tab-${pageIds[selectedPage]}`).focus();
  });
  window.addEventListener('resize', () => {if (dialog.open) selectPage(selectedPage, false);});
  let sending = false;
  const tracker = new Achievements({onMilestone: () => toast('2048! You’ve joined the squishy achievers.'), onUpdate: render,
    onRecord: record => {recordQueue.push(record);queueMicrotask(flushRecords);}});
  function renderMessageEligibility(preferPage = false) {
    const s = tracker.summary, select = $('record-bottle');
    const eligible = pageIds.filter(id => canMessage(s, id)), requested = pageIds[selectedPage], previous = select.value;
    if([...select.options].map(option => option.value).join('|') !== eligible.join('|')){
      select.replaceChildren(...eligible.map(id => {const option = document.createElement('option');option.value = id;option.textContent = id === 'all' ? 'All bottles' : BOTTLES[id].name;return option;}));
    }
    select.value = preferPage && eligible.includes(requested) ? requested : eligible.includes(previous) ? previous : eligible.includes(requested) ? requested : eligible[0] ?? '';
    const holder = eligible.length > 0 && !tracker.error;
    $('record-message-form').classList.toggle('hidden', !holder);
    $('record-message-locked').classList.toggle('hidden', holder);
    $('record-send').disabled = sending || !holder || !s?.emailReady;
    select.disabled = sending;
    $('record-email-note').textContent = s?.emailReady ? 'Your message goes to the creator’s inbox. One message per record each day (UTC); a reply email is optional.' : 'The creator’s inbox is being connected. You can keep your message here until it’s ready.';
  }
  function renderChampion() {
    if(!celebrating)return;
    const {bottle, score} = celebrating, holder = canMessage(tracker.summary, bottle) && !tracker.error;
    $('champion-title').textContent = holder ? 'You’re number one!' : 'A record to remember.';
    $('champion-description').textContent = tracker.error ? 'Your record is saved. Reconnect to check the latest standings and email the creator.' : holder ? 'A new world record, made one little merge at a time.' : 'Another player now holds this bottle’s record. Your achievement is still worth celebrating.';
    $('champion-note').textContent = tracker.error ? 'One great round is always worth celebrating.' : holder ? 'Your bottle has a new champion. That’s you.' : 'Keep squishing. Your next great round is waiting.';
    $('champion-score').textContent = (holder ? tracker.summary.bottles[bottle].record.score : score).toLocaleString();
    $('champion-email').disabled = !holder;
  }
  function showChampion(bottle) {
    if(!canMessage(tracker.summary, bottle) || tracker.error)return;
    if(dialog.open)dialog.close();
    if(document.querySelector('dialog[open]'))return;
    const vessel = BOTTLES[bottle], score = tracker.summary.bottles[bottle].record.score;
    celebrating = {bottle, score};cancelAim();
    $('champion-bottle-name').textContent = vessel.name;
    const context = $('champion-bottle-preview').getContext('2d');context.setTransform(.5,0,0,.5,0,0);context.clearRect(0,0,360,420);vessel.drawBottleBack(context);vessel.drawBottleFront(context);
    tracker.profile.recordCelebrations[bottle] = score;tracker.storageAvailable = tracker.persist();
    renderChampion();celebration.showModal();
  }
  function flushRecords() {
    if(document.hidden || document.querySelector('dialog[open]'))return;
    recordQueue.sort((a,b) => Number(b.bottle === getEngine().bottleId) - Number(a.bottle === getEngine().bottleId));
    while(recordQueue.length){const record = recordQueue.shift();if(canMessage(tracker.summary, record.bottle) && !tracker.error){showChampion(record.bottle);break;}}
  }
  for(const modal of document.querySelectorAll('dialog'))modal.addEventListener('close', () => queueMicrotask(flushRecords));
  document.addEventListener('visibilitychange', () => {if(!document.hidden)flushRecords();});
  $('champion-email').onclick = () => {
    if(!celebrating || !canMessage(tracker.summary, celebrating.bottle) || tracker.error)return;
    const bottle = celebrating.bottle;celebration.close();cancelAim();
    if(!dialog.open)dialog.showModal();selectPage(pageIds.indexOf(bottle), false);renderMessageEligibility(true);
    $('record-bottle').value = bottle;
    $('record-message').scrollIntoView({block:'center'});$('record-message').focus({preventScroll:true});
  };
  tracker.roundRecords = () => roundRecords(tracker.profile, tracker.summary, getEngine(), tracker.flaskBaseline);
  tracker.renderRoundStats = () => {
    const engine = getEngine(), records = tracker.roundRecords(), name = BOTTLES[engine.bottleId].name;
    $('score').textContent = engine.score.toLocaleString();
    $('best').textContent = records.personalBest.toLocaleString();
    $('best').title = `Your best score · ${name}`;
    $('world-record').textContent = records.worldBest === null ? '—' : records.worldBest.toLocaleString();
    $('world-record').title = `${name} · ${tracker.error ? 'Last loaded world record. Reconnect to refresh.' : 'Highest shared score'}`;
    $('round-stats').setAttribute('aria-label', `${name} round results`);
    $('round-bottle').textContent = name;
  };
  function render() {
    const p = tracker.profile, s = tracker.summary;
    $('achievement-personal-tile').textContent = p.highestTile.toLocaleString();
    $('achievement-personal-score').textContent = p.score.toLocaleString();
    $('achievement-milestone').textContent = p.highestTile >= 2048 ? '2048 club · you made it!' : 'Your next little milestone: 2048';
    $('achievement-count').textContent = s ? s.reached2048.toLocaleString() : '—';
    $('achievement-count-label').textContent = s?.reached2048 === 1 ? 'player has reached 2048' : 'players have reached 2048';
    $('achievement-record').textContent = s?.record ? s.record.score.toLocaleString() : s ? 'Be the first' : '—';
    tracker.renderRoundStats();
    $('achievement-holder').textContent = s?.record ? `${s.record.name} · highest score` : 'A little room for a new record';
    $('achievement-global-tile').textContent = s ? s.highestTile.toLocaleString() : '—';
    for (const id of Object.keys(BOTTLES)) {
      const panel = $(`achievement-page-${id}`), shared = s?.bottles?.[id], personal = p.bottles[id] ?? {score: 0, highestTile: 2};
      panel.querySelector('[data-record]').textContent = shared ? (shared.record ? shared.record.score.toLocaleString() : 'Be the first') : '—';
      panel.querySelector('[data-holder]').textContent = shared?.record ? `${shared.record.name} · highest score` : 'A little room for a new record';
      panel.querySelector('[data-global-tile]').textContent = shared ? shared.highestTile.toLocaleString() : '—';
      panel.querySelector('[data-personal-score]').textContent = personal.score.toLocaleString();
      panel.querySelector('[data-personal-tile]').textContent = personal.highestTile.toLocaleString();
      panel.querySelector('[data-milestone]').textContent = personal.highestTile >= 2048 ? '2048 club · you made it!' : 'Your next little milestone: 2048';
      panel.querySelector('[data-celebrate]').classList.toggle('hidden', !canMessage(s, id) || !!tracker.error);
    }
    $('achievement-status').textContent = tracker.error || (s ? 'Shared records are up to date.' : 'Connecting to shared records…');
    renderMessageEligibility();renderChampion();
  }
  $('achievements').onclick = async () => {
    cancelAim(); tracker.observe(getEngine(), getBest()); render();
    $('achievement-name').value = tracker.profile.name;
    dialog.showModal();selectPage(Math.max(0, pageIds.indexOf(getEngine().bottleId)), false);await tracker.sync(true);
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
      await tracker.send($('record-message').value, $('record-reply').value, $('record-bottle').value);
      $('record-message-status').textContent = 'Message sent! Thanks for sharing your little victory.';
      $('record-message').value = ''; $('record-reply').value = '';
    } catch (error) { $('record-message-status').textContent = error.message; }
    finally { sending = false; render(); }
  };
  updatePage(0);render(); return tracker;
}
