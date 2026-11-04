import {renderThreeAnnouncement} from './announcement.js?v=72';
import {MILESTONE_BATCH_SIZE,mergeMilestoneRuns,pendingMilestoneRuns} from './milestone-totals.js?v=72';
import {CURRENT_RULE,ruleFor,valueFor,validValue,profileKeyFor,saveKeyFor} from './merge-rules.js?v=72';
import {BOTTLES} from './bottles.js?v=72';
import {FLASK_RECORD_EPOCH,THREE_RECORD_EPOCH,achievementEpochFor,recordEligible} from './record-epoch.js?v=72';
const DEFAULT_NAME='A squishy friend';
export const boardName=name=>typeof name==='string'&&name.trim()!==DEFAULT_NAME?name.trim():'';
const validId = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const validRecord = (value,mode=CURRENT_RULE.id) => Number.isSafeInteger(value?.score) && value.score >= 0 &&
  validValue(value.highestTile,mode);
function bottleRecords(records,mode=CURRENT_RULE.id) {
  return Object.fromEntries(Object.keys(BOTTLES).filter(id => validRecord(records?.[id],mode))
    .map(id => [id, {score: records[id].score, highestTile: records[id].highestTile}]));
}
function mergeRecords(profile, records) {
  profile.bottles ??= {};
  for (const [id, record] of Object.entries(bottleRecords(records,profile.mergeMode??'two'))) {
    const previous = profile.bottles[id] ?? {score: 0, highestTile: ruleFor(profile.mergeMode).start};
    profile.bottles[id] = {score: Math.max(previous.score, record.score), highestTile: Math.max(previous.highestTile, record.highestTile)};
    profile.score = Math.max(profile.score, record.score);profile.highestTile = Math.max(profile.highestTile, record.highestTile);
  }
}
function mergeFlaskRecord(profile, record) {
  const previous=profile.flaskRecord??{epoch:FLASK_RECORD_EPOCH,score:0,highestTile:ruleFor(profile.mergeMode).start};
  profile.flaskRecord=previous;
  if(record?.epoch!==FLASK_RECORD_EPOCH||!validRecord(record,profile.mergeMode??'two'))return false;
  const score=Math.max(previous.score,record.score),highestTile=Math.max(previous.highestTile,record.highestTile);
  profile.flaskRecord={epoch:FLASK_RECORD_EPOCH,score,highestTile};
  return score!==previous.score||highestTile!==previous.highestTile;
}
export function loadProfile(storage = localStorage,mode=CURRENT_RULE.id) {
  const rule=ruleFor(mode),key=profileKeyFor(rule.id);let profile;
  try {
    const data = JSON.parse(storage.getItem(key));
    if (validId(data?.id) && validId(data.token) && (data.mergeMode??'two')===rule.id && Number.isSafeInteger(data.score) && data.score >= 0 &&
        validValue(data.highestTile,rule.id)) {
      profile = {...data, mergeMode:rule.id,bottles: bottleRecords(data.bottles,rule.id), name: typeof data.name === 'string' ? data.name.slice(0,32) : 'A squishy friend',
        recordCelebrations: Object.fromEntries(Object.keys(BOTTLES).filter(id => Number.isSafeInteger(data.recordCelebrations?.[id]) && data.recordCelebrations[id] > 0).map(id => [id, data.recordCelebrations[id]]))};
    }
  } catch { /* The game still works without storage. */ }
  profile ??= {id: crypto.randomUUID(), token: crypto.randomUUID(), name: 'A squishy friend',mergeMode:rule.id,score: 0, highestTile:rule.start, bottles: {}, recordCelebrations: {}};
  if(rule.id==='three'&&profile.achievementEpoch!==THREE_RECORD_EPOCH){
    profile.score=0;profile.highestTile=1;profile.bottles={};profile.recordCelebrations={};delete profile.flaskRecord;
    delete profile.milestoneRuns;delete profile.milestoneSynced;
  }
  profile.achievementEpoch=achievementEpochFor(rule.id);
  const runs={},synced={};mergeMilestoneRuns(runs,profile.milestoneRuns);mergeMilestoneRuns(synced,profile.milestoneSynced);
  profile.milestoneRuns=runs;profile.milestoneSynced=synced;
  if(profile.flaskRecord?.epoch!==FLASK_RECORD_EPOCH||!validRecord(profile.flaskRecord,rule.id)){
    delete profile.flaskRecord;delete profile.recordCelebrations['lab-flask'];
    if(profile.bottles['lab-flask'])profile.bottles['lab-flask'].score=0;
  }
  mergeFlaskRecord(profile);
  // Older overall records have no vessel attribution. Recover only scores
  // belonging to an actual saved round, never its shared all-bottle "best".
  for (const id of Object.keys(BOTTLES)) {
    try {
      const saved = JSON.parse(storage.getItem(saveKeyFor(id,rule.id)));
      const engine = saved?.engine;
      if (saved?.version !== 1 || (engine?.bottleId ?? 'classic') !== id || (engine?.mergeMode??'two')!==rule.id || !recordEligible(engine)) continue;
      mergeMilestoneRuns(profile.milestoneRuns,{[engine.milestoneRun]:engine.milestoneCount});
      const levels = [...(engine.blobs ?? []), ...(engine.rack ?? [])].map(b => b.level).filter(n => Number.isInteger(n) && n >= 0 && n <= 11);
      const highestTile = valueFor(Math.max(0,engine.highestLevel??0,...levels),rule.id);
      const eligible=id!=='lab-flask'||engine.recordEpoch===FLASK_RECORD_EPOCH;
      mergeRecords(profile, {[id]: {score: eligible?engine.score:0, highestTile}});
      if(id==='lab-flask'&&engine.recordEpoch===FLASK_RECORD_EPOCH)mergeFlaskRecord(profile,{epoch:FLASK_RECORD_EPOCH,score:engine.score,highestTile});
    } catch { /* Missing or malformed rounds do not affect existing records. */ }
  }
  mergeRecords(profile, profile.bottles);
  return profile;
}

export function captureProgress(profile, engine, personalBest = engine.score) {
  if((profile.mergeMode??'two')!==(engine.mergeMode??'two')||!recordEligible(engine))return false;
  profile.milestoneRuns??={};
  const milestoneChanged=mergeMilestoneRuns(profile.milestoneRuns,{[engine.milestoneRun]:engine.milestoneCount});
  const score = Math.max(profile.score, engine.score, personalBest);
  const highestTile = Math.max(profile.highestTile, valueFor(engine.highestLevel,engine.mergeMode??'two'));
  const previous = profile.bottles?.[engine.bottleId];
  const bottleScore=engine.bottleId==='lab-flask'&&engine.recordEpoch!==FLASK_RECORD_EPOCH?0:engine.score;
  const changed = score !== profile.score || highestTile !== profile.highestTile ||
    !previous || bottleScore > previous.score || valueFor(engine.highestLevel,engine.mergeMode??'two') > previous.highestTile;
  profile.score = score; profile.highestTile = highestTile;
  if (Object.hasOwn(BOTTLES, engine.bottleId)) mergeRecords(profile, {[engine.bottleId]: {score: bottleScore, highestTile: valueFor(engine.highestLevel,engine.mergeMode??'two')}});
  const fresh=engine.bottleId==='lab-flask'&&engine.recordEpoch===FLASK_RECORD_EPOCH&&
    mergeFlaskRecord(profile,{epoch:FLASK_RECORD_EPOCH,score:engine.score,highestTile:valueFor(engine.highestLevel,engine.mergeMode??'two')});
  return changed||fresh||milestoneChanged;
}

export function roundRecords(profile, summary, engine) {
  const shared = summary?.bottles?.[engine.bottleId];
  const personal=engine.bottleId==='lab-flask'&&shared?.recordEpoch!==undefined&&shared.recordEpoch!==FLASK_RECORD_EPOCH?0:shared?.personal?.score??0;
  return {
    personalBest: Math.max(!recordEligible(engine)?0:engine.bottleId==='lab-flask'&&engine.recordEpoch!==FLASK_RECORD_EPOCH?0:engine.score, profile.bottles?.[engine.bottleId]?.score ?? 0, personal),
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
  constructor({mergeMode = CURRENT_RULE.id, onMilestone = () => {}, onUpdate = () => {}, onRecord = () => {}, onSettled = () => {}, canCelebrate = () => true} = {}) {
    this.rule = ruleFor(mergeMode);
    this.profile = loadProfile(localStorage,this.rule.id); this.onMilestone = onMilestone; this.onUpdate = onUpdate; this.onRecord = onRecord;
    this.onSettled = onSettled; this.canCelebrate = canCelebrate;
    this.summary = null; this.pending = true; this.saving = null; this.lastAttempt = 0;
    this.storageAvailable = this.persist();
    window.addEventListener('online', () => { void this.sync(true); });
  }
  persist() {
    try {
      // Preserve another tab's offline merges when either tab saves its profile.
      let stored;try{stored=JSON.parse(localStorage.getItem(profileKeyFor(this.rule.id)));}catch{}
      if(stored?.id===this.profile.id&&stored.token===this.profile.token&&stored.achievementEpoch===this.profile.achievementEpoch){
        mergeMilestoneRuns(this.profile.milestoneRuns,stored.milestoneRuns);
        mergeMilestoneRuns(this.profile.milestoneSynced,stored.milestoneSynced);
        if(validRecord(stored,this.rule.id)){
          this.profile.score=Math.max(this.profile.score,stored.score);this.profile.highestTile=Math.max(this.profile.highestTile,stored.highestTile);
        }
      }
      localStorage.setItem(profileKeyFor(this.rule.id), JSON.stringify(this.profile)); return true;
    } catch { return false; }
  }
  observe(engine, best) {
    const before = this.profile.highestTile;
    if (captureProgress(this.profile, engine, best)) {
      this.pending = true; this.storageAvailable = this.persist();
      if (before < this.rule.milestone && this.profile.highestTile >= this.rule.milestone) this.onMilestone();
    }
    if (this.pending && this.canCelebrate() && Date.now() - this.lastAttempt > 15000) void this.sync();
  }
  async request(path, data) {
    const response = await fetch(path+(this.rule.id==='three'?'?merge=three':''), {method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Player-Id': this.profile.id, 'Authorization': `Bearer ${this.profile.token}`
    }, body: JSON.stringify({...data,...(this.rule.id==='three'?{achievementEpoch:THREE_RECORD_EPOCH}:{})}), signal: AbortSignal.timeout(12000), keepalive: true});
    let result;
    try { result = await response.json(); } catch { throw new Error('Shared achievements are unavailable. Your progress stays in this browser.'); }
    if (!response.ok) throw new Error(result.error || 'Please try again in a moment.');
    if((result.mergeMode??'two')!==this.rule.id)throw new Error('This board belongs to another merge mode. Please refresh.');
    if(this.rule.id==='three'&&result.achievementEpoch!==THREE_RECORD_EPOCH)throw new Error('Three Combine achievements restarted. Please refresh to join the new board.');
    return result;
  }
  async sync(force = false) {
    if (this.saving) {
      await this.saving;
      if (force && this.pending) return this.sync(true);
      this.onSettled();
      return this.summary;
    }
    this.lastAttempt = Date.now();
    const operation = (async () => {
      try {
        if (!this.storageAvailable) throw new Error('Browser saving is unavailable. Enable it to join shared achievements.');
        this.storageAvailable=this.persist();
        if(!this.storageAvailable)throw new Error('Browser saving is unavailable. Enable it to join shared achievements.');
        const snapshot = {name: this.profile.name, score: this.profile.score, highestTile: this.profile.highestTile, bottles: structuredClone(this.profile.bottles),
          milestoneRuns:Object.fromEntries(pendingMilestoneRuns(this.profile).slice(0,MILESTONE_BATCH_SIZE)),
          ...(this.profile.bottles['lab-flask'] ? {flaskRecord: structuredClone(this.profile.flaskRecord)} : {})};
        const previous = this.summary;
        this.summary = await this.request('/api/achievements', snapshot);
        // Only acknowledge counts the server has committed. A merge occurring
        // during this request remains pending for the next upload.
        if(Number.isSafeInteger(this.summary.totalMilestones))mergeMilestoneRuns(this.profile.milestoneSynced,snapshot.milestoneRuns);
        const recordsWon = newlyWonBottles(previous, this.summary, this.profile.recordCelebrations);
        this.pending = pendingMilestoneRuns(this.profile).length>0 || snapshot.score !== this.profile.score || snapshot.highestTile !== this.profile.highestTile || snapshot.name !== this.profile.name || JSON.stringify(snapshot.bottles) !== JSON.stringify(this.profile.bottles) ||
          (snapshot.flaskRecord!==undefined&&JSON.stringify(snapshot.flaskRecord)!==JSON.stringify(this.profile.flaskRecord));
        // Another tab may have submitted a newer record using this identity.
        if (this.summary.personal) {
          this.profile.score = Math.max(this.profile.score, this.summary.personal.score);
          this.profile.highestTile = Math.max(this.profile.highestTile, this.summary.personal.highestTile);
        }
        mergeRecords(this.profile, Object.fromEntries(Object.entries(this.summary.bottles ?? {})
          .filter(([id, record])=>id!=='lab-flask'||record.recordEpoch===undefined||record.recordEpoch===FLASK_RECORD_EPOCH)
          .map(([id, record]) => [id, record.personal])));
        const flask=this.summary.bottles?.['lab-flask'];
        if(flask)mergeFlaskRecord(this.profile,{epoch:flask.recordEpoch,...flask.recordPersonal});
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
    let result;
    try { result=await operation; } finally { this.saving = null; this.onSettled(); }
    if(force&&result&&Number.isSafeInteger(result.totalMilestones)&&pendingMilestoneRuns(this.profile).length)return this.sync(true);
    return result;
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

export function connectAchievements({getEngine, getBest, canCelebrate = () => true, cancelAim, toast}) {
  const $ = id => document.getElementById(id), dialog = $('achievements-dialog');
  const pageIds = Object.keys(BOTTLES), pages = $('achievement-pages');
  const celebration = $('champion-page'), recordQueue = [];
  let celebrating = null;
  let selectedPage = 0;
  let scrollingTo = null;
  for (const [id, vessel] of Object.entries(BOTTLES)) {
    const panel = document.createElement('section');
    panel.id = `achievement-page-${id}`;panel.className = 'achievement-page';panel.setAttribute('role', 'tabpanel');panel.setAttribute('aria-labelledby', `achievement-tab-${id}`);
    panel.innerHTML = `<h3 class="achievement-bottle-title"><canvas width="120" height="140" aria-hidden="true"></canvas>${vessel.name}<span>${id==='lab-flask'?'Fresh world board · new rounds count':'Its own little hall of fame'}</span></h3>
      <div class="achievement-card achievement-world"><span class="label">WORLD HIGH SCORE</span><strong data-record>—</strong><span data-holder>A little room for a new record</span><span>Biggest merge: <b data-global-tile>—</b></span><button type="button" data-celebrate class="text-button hidden">Your champion page →</button></div>
      <div class="achievement-personal"><span data-milestone>Your next little milestone: 2048</span><div><span>YOUR BIGGEST MERGE <b data-personal-tile>2</b></span><span>YOUR BEST SCORE <b data-personal-score>0</b></span></div></div>`;
    pages.append(panel);
    panel.querySelector('[data-celebrate]').onclick = () => showChampion(id,viewTracker);
    const context = panel.querySelector('canvas').getContext('2d');context.scale(1/3, 1/3);vessel.drawBottleBack(context);vessel.drawBottleFront(context);
  }
  for(const id of pageIds){
    const section=document.createElement('section'),heading=document.createElement('h4'),list=document.createElement('ol');
    section.className='achievement-leaders';heading.textContent='Top 5';list.dataset.leaderboard=id;
    list.setAttribute('aria-label',`${id==='all'?'All bottles':BOTTLES[id].name} top five scores`);list.setAttribute('role','list');
    section.append(heading,list);const panel=$(`achievement-page-${id}`);panel.insertBefore(section,panel.querySelector('.achievement-personal'));
  }
  function renderLeaders(id,board){
    const list=pages.querySelector(`[data-leaderboard="${id}"]`);
    const rows=Array.isArray(board?.leaderboard)?board.leaderboard:board?.record?[board.record]:[];
    list.replaceChildren(...Array.from({length:5},(_,i)=>{
      const row=rows[i],item=document.createElement('li'),rank=document.createElement('span'),name=document.createElement('span'),score=document.createElement('strong');
      rank.className='leader-rank';rank.textContent=String(i+1);rank.setAttribute('aria-hidden','true');
      name.className='leader-name';name.textContent=row?`${row.name}${row.isYou?' · you':''}`:board?'Open spot':'Loading…';
      score.textContent=row?row.score.toLocaleString():'—';item.classList.toggle('leader-you',!!row?.isYou);
      item.append(rank,name,score);return item;
    }));
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
    index = Math.max(0, Math.min(pageIds.length - 1, index));scrollingTo=index;updatePage(index);
    const panel = $(`achievement-page-${pageIds[index]}`);
    pages.scrollTo({left: panel.offsetLeft - pages.firstElementChild.offsetLeft,
      behavior: animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant'});
  }
  pages.addEventListener('scroll', () => {
    if(scrollingTo!==null){
      const panel=$(`achievement-page-${pageIds[scrollingTo]}`);
      if(Math.abs(panel.offsetLeft-pages.firstElementChild.offsetLeft-pages.scrollLeft)>2)return;
      scrollingTo=null;
    }
    let closest = 0, distance = Infinity;
    [...pages.children].forEach((panel, i) => {const d = Math.abs(panel.offsetLeft - pages.firstElementChild.offsetLeft - pages.scrollLeft);if (d < distance) {distance = d;closest = i;}});
    updatePage(closest);
  }, {passive: true});
  for(const event of ['pointerdown','wheel'])pages.addEventListener(event,()=>{scrollingTo=null;},{passive:true});
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
  let tracker;
  function createTracker(mode){
    const owner=new Achievements({mergeMode:mode,
      onMilestone:()=>toast(`${owner.rule.milestone.toLocaleString()}! You’ve joined the squishy achievers.`),onUpdate:render,
      canCelebrate:()=>owner===tracker&&canCelebrate(),onSettled:()=>queueMicrotask(flushRecords),
      onRecord:record=>{
        if(owner!==tracker)return;
        const existing=recordQueue.find(r=>r.bottle===record.bottle);
        if(existing)existing.score=record.score;else recordQueue.push(record);
        queueMicrotask(flushRecords);
      }});
    return owner;
  }
  tracker=createTracker(CURRENT_RULE.id);
  let viewTracker=tracker;
  // Both the game and board browser reuse each rule's existing identity.
  const boardTrackers=new Map([[tracker.rule.id,tracker]]);
  function trackerFor(mode){
    if(!boardTrackers.has(mode))boardTrackers.set(mode,createTracker(mode));
    return boardTrackers.get(mode);
  }
  async function selectMode(mode) {
    if(sending)return;
    viewTracker=trackerFor(mode);
    $('achievement-name').value=boardName(viewTracker.profile.name);
    $('record-message').value='';$('record-reply').value='';$('record-message-status').textContent='';
    render();selectPage(selectedPage,false);await viewTracker.sync(true);
  }
  for(const button of dialog.querySelectorAll('[data-achievement-mode]'))button.onclick=()=>{void selectMode(button.dataset.achievementMode);};
  function renderMessageEligibility(preferPage = false) {
    const s = viewTracker.summary, select = $('record-bottle');
    const eligible = pageIds.filter(id => canMessage(s, id)), requested = pageIds[selectedPage], previous = select.value;
    if([...select.options].map(option => option.value).join('|') !== eligible.join('|')){
      select.replaceChildren(...eligible.map(id => {const option = document.createElement('option');option.value = id;option.textContent = id === 'all' ? 'All bottles' : BOTTLES[id].name;return option;}));
    }
    select.value = preferPage && eligible.includes(requested) ? requested : eligible.includes(previous) ? previous : eligible.includes(requested) ? requested : eligible[0] ?? '';
    const holder = eligible.length > 0 && !viewTracker.error;
    $('record-message-form').classList.toggle('hidden', !holder);
    $('record-message-locked').classList.toggle('hidden', holder);
    $('record-send').disabled = sending || !holder || !s?.emailReady;
    select.disabled = sending;
    $('record-email-note').textContent = s?.emailReady ? 'Your message goes to the creator’s inbox. One message per record each day (UTC); a reply email is optional.' : 'The creator’s inbox is being connected. You can keep your message here until it’s ready.';
  }
  function renderChampion() {
    if(!celebrating)return;
    const owner=celebrating.tracker;
    const {bottle, score} = celebrating, holder = canMessage(owner.summary, bottle) && !owner.error;
    const latestScore = holder ? owner.summary.bottles[bottle].record.score : score;
    celebrating.score = latestScore;
    if(holder && latestScore > (owner.profile.recordCelebrations[bottle] ?? 0)){
      owner.profile.recordCelebrations[bottle] = latestScore;owner.storageAvailable = owner.persist();
    }
    $('champion-title').textContent = holder ? 'You’re number one!' : 'A record to remember.';
    $('champion-description').textContent = owner.error ? 'Your record is saved. Reconnect to check the latest standings and email the creator.' : holder ? 'A new world record, made one little merge at a time.' : 'Another player now holds this bottle’s record. Your achievement is still worth celebrating.';
    $('champion-note').textContent = owner.error ? 'One great round is always worth celebrating.' : holder ? 'Your bottle has a new champion. That’s you.' : 'Keep squishing. Your next great round is waiting.';
    $('champion-score').textContent = latestScore.toLocaleString();
    $('champion-email').disabled = !holder;
    $('champion-name-form').classList.toggle('hidden',!!boardName(owner.profile.name));
  }
  function showChampion(bottle,owner=tracker) {
    if(!canMessage(owner.summary, bottle) || owner.error)return;
    if(dialog.open)dialog.close();
    if(document.querySelector('dialog[open]'))return;
    const vessel = BOTTLES[bottle], score = owner.summary.bottles[bottle].record.score;
    celebrating = {bottle, score,tracker:owner};cancelAim();
    $('champion-name').value=boardName(owner.profile.name);$('champion-name-status').textContent='';
    $('champion-bottle-name').textContent = owner.rule.name+' · '+vessel.name;
    const context = $('champion-bottle-preview').getContext('2d');context.setTransform(.5,0,0,.5,0,0);context.clearRect(0,0,360,420);vessel.drawBottleBack(context);vessel.drawBottleFront(context);
    owner.profile.recordCelebrations[bottle] = score;owner.storageAvailable = owner.persist();
    renderChampion();celebration.showModal();
  }
  function flushRecords() {
    if(!canCelebrate() || tracker.saving || document.hidden || document.querySelector('dialog[open]'))return;
    recordQueue.sort((a,b) => Number(b.bottle === getEngine().bottleId) - Number(a.bottle === getEngine().bottleId));
    while(recordQueue.length){const record = recordQueue.shift();if(canMessage(tracker.summary, record.bottle) && !tracker.error){showChampion(record.bottle);break;}}
  }
  for(const modal of document.querySelectorAll('dialog'))modal.addEventListener('close', () => queueMicrotask(flushRecords));
  document.addEventListener('visibilitychange', () => {if(!document.hidden)flushRecords();});
  $('champion-email').onclick = () => {
    if(!celebrating)return;
    const owner=celebrating.tracker;
    if(!canMessage(owner.summary, celebrating.bottle) || owner.error)return;
    viewTracker=owner;render();
    const bottle = celebrating.bottle;celebration.close();cancelAim();
    if(!dialog.open)dialog.showModal();selectPage(pageIds.indexOf(bottle), false);renderMessageEligibility(true);
    $('record-bottle').value = bottle;$('achievement-name').value=boardName(owner.profile.name);
    $('record-message').scrollIntoView({block:'center'});$('record-message').focus({preventScroll:true});
  };
  const currentRoundRecords = () => roundRecords(tracker.profile, tracker.summary, getEngine());
  const renderRoundStats = () => {
    const engine = getEngine(), records = currentRoundRecords(), name = BOTTLES[engine.bottleId].name;
    $('score').textContent = engine.score.toLocaleString();
    $('best').textContent = records.personalBest.toLocaleString();
    $('best').title = `Your best score · ${name}`;
    $('world-record').textContent = records.worldBest === null ? '—' : records.worldBest.toLocaleString();
    $('world-record').title = `${name} · ${tracker.error ? 'Last loaded world record. Reconnect to refresh.' : 'Highest shared score'}`;
    $('round-stats').setAttribute('aria-label', `${name} round results`);
    $('round-bottle').textContent = name;
  };
  function render() {
    const p = viewTracker.profile, s = viewTracker.summary, rule=viewTracker.rule, milestone=rule.id==='three'?'2,187':'2048';
    for(const id of pageIds)pages.querySelector(`[data-leaderboard="${id}"]`).setAttribute('aria-label',`${rule.name} · ${id==='all'?'All bottles':BOTTLES[id].name} top five scores`);
    dialog.querySelectorAll('[data-achievement-mode]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.achievementMode===rule.id));button.disabled=sending;});
    renderThreeAnnouncement($('achievement-season-note'),rule.id,s?.announcement);
    dialog.querySelector('.achievement-badge').textContent=String(rule.milestone);
    dialog.querySelector('.achievement-intro').textContent=rule.name+' · Every '+milestone+' starts with a tiny '+(rule.id==='three'?'one.':'two.');
    dialog.querySelector('.achievement-footnote').textContent=rule.name+' keeps its own name, best scores and saved rounds in this browser. The player counter counts each player once. The blob total counts every new '+milestone+' merge in the bottle or ready row from the tracking date. Clearing browser data or switching devices creates a new player. Shared scores are reported by players.'+(rule.id==='three'?' Only fresh rounds started after the restart count toward these achievements.':'');
    $('achievement-count').textContent = s ? (s.reachedMilestone??s.reached2048).toLocaleString() : '—';
    $('achievement-count-label').textContent = `${(s?.reachedMilestone??s?.reached2048)===1?'player has':'players have'} reached ${milestone}`;
    $('achievement-total').textContent = Number.isSafeInteger(s?.totalMilestones)?s.totalMilestones.toLocaleString():'—';
    $('achievement-total-label').textContent = `total ${milestone} blobs made`;
    $('achievement-total-note').textContent = s?.milestoneTrackingSince ? 'Every merge counts · tracking since '+new Date(s.milestoneTrackingSince).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'Every merge counts · tracking starts with this update';
    renderRoundStats();
    for (const id of Object.keys(BOTTLES)) {
      const panel = $(`achievement-page-${id}`), shared = s?.bottles?.[id], personal = p.bottles[id] ?? {score: 0, highestTile:rule.start};
      renderLeaders(id,shared);
      panel.querySelector('[data-record]').textContent = shared ? (shared.record ? shared.record.score.toLocaleString() : 'Be the first') : '—';
      panel.querySelector('[data-holder]').textContent = shared?.record ? `${shared.record.name} · highest score` : 'A little room for a new record';
      panel.querySelector('[data-global-tile]').textContent = shared ? shared.highestTile.toLocaleString() : '—';
      panel.querySelector('[data-personal-score]').textContent = personal.score.toLocaleString();
      panel.querySelector('[data-personal-tile]').textContent = personal.highestTile.toLocaleString();
      panel.querySelector('[data-milestone]').textContent = personal.highestTile >= rule.milestone ? `${milestone} club · you made it!` : `Your next little milestone: ${milestone}`;
      panel.querySelector('[data-celebrate]').classList.toggle('hidden', !canMessage(s, id) || !!viewTracker.error);
    }
    $('achievement-status').textContent = viewTracker.error || (s ? rule.name+' records are up to date.' : 'Connecting to shared records…');
    renderMessageEligibility();renderChampion();
  }
  $('achievements').onclick = async () => {
    cancelAim(); viewTracker=tracker;tracker.observe(getEngine(), getBest()); render();
    $('achievement-name').value = boardName(tracker.profile.name);
    dialog.showModal();selectPage(Math.max(0, pageIds.indexOf(getEngine().bottleId)), false);await tracker.sync(true);
  };
  $('achievement-refresh').onclick = async () => { $('achievement-status').textContent = 'Refreshing shared records…'; await viewTracker.sync(true); };
  for(const id of ['achievement-name','champion-name']){
    const input=$(id),selectName=()=>input.setSelectionRange(0,input.value.length);
    input.addEventListener('focus',selectName);input.addEventListener('click',()=>{selectName();setTimeout(()=>{if(document.activeElement===input)selectName();},0);});
  }
  $('champion-name-form').onsubmit=async event=>{
    event.preventDefault();const button=$('champion-name-form').querySelector('button');button.disabled=true;
    $('champion-name-status').textContent='Saving your name…';
    const owner=celebrating?.tracker??tracker;
    try{await owner.rename($('champion-name').value);$('achievement-name').value=boardName(viewTracker.profile.name);
      $('champion-name-status').textContent=owner.error|| (boardName(owner.profile.name)?'Your name is on the board.':'You can keep playing without a name.');
    }finally{button.disabled=false;}
  };
  $('achievement-name-form').onsubmit = async event => {
    event.preventDefault(); $('achievement-status').textContent = 'Saving your name…';
    await viewTracker.rename($('achievement-name').value);
  };
  $('record-message-form').onsubmit = async event => {
    event.preventDefault(); const button = $('record-send'); if (button.disabled) return;
    const owner=viewTracker;
    sending = true; render();button.disabled = true; $('record-message-status').textContent = 'Sending your message…';
    try {
      await owner.send($('record-message').value, $('record-reply').value, $('record-bottle').value);
      $('record-message-status').textContent = 'Message sent! Thanks for sharing your little victory.';
      $('record-message').value = ''; $('record-reply').value = '';
    } catch (error) { $('record-message-status').textContent = error.message; }
    finally { sending = false; render(); }
  };
  updatePage(0);render();
  return {
    get profile(){return tracker.profile;},
    observe:(...args)=>tracker.observe(...args),sync:(...args)=>tracker.sync(...args),
    roundRecords:currentRoundRecords,renderRoundStats,
    setMode(mode){
      if(celebration.open)celebration.close();
      recordQueue.length=0;celebrating=null;
      tracker=trackerFor(mode);viewTracker=tracker;
      $('achievement-name').value=boardName(tracker.profile.name);render();
    }
  };
}
