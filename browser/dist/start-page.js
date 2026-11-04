import {CURRENT_RULE,ruleFor,valueFor} from './merge-rules.js?v=59';
import {BOTTLES} from './bottles.js?v=59';
import {radiusFor} from './engine.js?v=59';
import {RoomClient} from './room-client.js?v=59';
const colors=['#eaaa8c','#e6c87f','#afc4a0','#9abfcb','#b6abca','#d9a3b7','#80b6a6','#d8ab71','#9faed0','#d5c788','#c395c6','#e49e7d'];
const $=id=>document.getElementById(id);
const blobCaption='<span class="blob-caption" aria-hidden="true">•ᴗ•</span>';
const setPrimaryLabel=(id,label)=>{$(id).innerHTML=`${label} ${blobCaption}`;};
export function createStartPage(hooks){
  let rule=CURRENT_RULE;
  let mode='classic',bottleId=hooks.initialBottle,room=null,connected=false,matchKey='',page='home',busy=false,readyBottle=null;
  const client=new RoomClient({
    getProgress:r=>hooks.getProgress(r),
    onStatus:(state,message)=>{
      connected=state==='connected';$('menu-status').textContent=message;
      $('match-connection').textContent=connected?'Connected':state==='connecting'?'Connecting…':'Reconnecting…';
      if(room){hooks.updateMatch(room,connected);renderRoom();}
    },
    onRoom:(r,online)=>{
      if(!r)return;
      if((r.mergeMode??'two')!==rule.id)switchMergeMode(r.mergeMode??'two',r.code);
      room=r;connected=online;bottleId=r.bottleId;
      hooks.updateMatch(r,online);renderRoom();
      const key=`${r.code}:${r.round}`;
      if(r.phase==='playing'&&key!==matchKey){matchKey=key;setPage('game');hooks.enterMatch(r,online);}
      if($('opponent-dialog').open)drawOpponent();
    }
  });
  function setPage(next){
    if(page==='game'&&next!=='game')hooks.suspend();page=next;
    $('start-page').classList.toggle('hidden',next==='game');$('game-layout').classList.toggle('hidden',next!=='game');
    $('mode-home').classList.toggle('hidden',next!=='home');$('mode-setup').classList.toggle('hidden',next!=='setup');
    document.body.dataset.page=next==='game'?'game':'menu';document.body.dataset.mode=mode;
    hooks.onPage(next==='game'?'game':'menu');
    if(next==='game'){
      requestAnimationFrame(hooks.onShown);$('match-bar').classList.toggle('hidden',mode!=='multiplayer');
    }
    else window.scrollTo({top:0});
  }
  function renderBottles(){
    const start=$('classic-actions');
    for(const button of document.querySelectorAll('[data-bottle]')){
      const ready=mode==='classic'&&readyBottle===button.dataset.bottle;
      button.setAttribute('aria-pressed',String(button.dataset.bottle===bottleId));
      button.disabled=!!room&&(!connected||room.you!==0||!['lobby','finished'].includes(room.phase));
      button.dataset.ready=String(ready);
      if(ready){
        button.id='classic-play';button.setAttribute('aria-label',`Start game · ${BOTTLES[bottleId].name}`);
        button.setAttribute('aria-describedby','classic-save-note');button.append(start);
      }else{
        if(button.id==='classic-play')button.removeAttribute('id');
        button.removeAttribute('aria-label');button.removeAttribute('aria-describedby');
      }
    }
    start.classList.toggle('hidden',!readyBottle||mode!=='classic');
    if(readyBottle){
      start.querySelector('.bottle-start-name').textContent=BOTTLES[readyBottle].name;
      $('classic-save-note').textContent=hooks.classicStatus(readyBottle)?'Continue your saved pile':'A fresh little pile';
    }
  }
  function showSetup(selected){
    mode=selected;readyBottle=null;$('menu-status').textContent='';
    $('mode-setup').dataset.stage='bottles';$('bottle-options').classList.remove('hidden');
    $('mode-title').textContent=mode==='classic'?'Your own little pace.':'A friendly rivalry.';
    $('mode-eyebrow').textContent=mode==='classic'?`${rule.id==='three'?'THREE COMBINE':'CLASSIC'} / JUST YOU`:'MULTIPLAYER / TWO LITTLE PILES';
    $('mode-description').textContent=(rule.id==='three'?'Three Combine · 1 → 3 → 9 → 27. ':'')+(mode==='classic'?'Choose a bottle, then tap Start game.':'Pick a bottle, create a private room, and invite a friend. Or enter their code to join.');
    $('multiplayer-setup').classList.toggle('hidden',mode!=='multiplayer');
    $('room-forms').classList.toggle('hidden',!!room);$('room-lobby').classList.toggle('hidden',!room);
    $('mode-back').textContent=room?(room.phase==='playing'?'← Leave room · forfeit match':'← Leave room'):'← Choose a mode';
    renderBottles();setPage('setup');
  }
  function renderRoom(){
    renderBottles();$('room-forms').classList.toggle('hidden',!!room);$('room-lobby').classList.toggle('hidden',!room);
    if(!room)return;
    $('room-code-display').textContent=room.code;
    const playing=room.phase==='playing',finished=room.phase==='finished',closed=room.phase==='closed';
    $('mode-back').textContent=playing?'← Leave room · forfeit match':'← Leave room';
    $('room-instruction').textContent=closed?'The host closed this room.':playing?'Your match is in progress.':finished?'A lovely little match. Ready for another?':room.players.length<2?'Share this code with a friend. They can join from Multiplayer.':'Both players are here. The host can start when you’re ready.';
    $('room-players').replaceChildren(...room.players.map((p,i)=>{
      const card=document.createElement('div'),name=document.createElement('strong'),score=document.createElement('b'),status=document.createElement('span');
      card.className='room-player';name.textContent=`${p.name}${i===room.you?' · you':''}${i===0?' · host':''}`;score.textContent=p.score.toLocaleString();
      status.textContent=p.status==='forfeit'?'Forfeited':p.status==='finished'?'Round complete':!p.connected?'Disconnected':p.paused?'Paused':playing?'Playing':'Ready';
      card.append(name,score,status);return card;
    }));
    if(room.players.length<2){const waiting=document.createElement('div');waiting.className='room-player room-player-waiting';waiting.textContent='A little room for your friend…';$('room-players').append(waiting);}
    $('room-start').classList.toggle('hidden',room.you!==0||playing||closed);$('room-start').disabled=!connected||room.players.length!==2||!room.players.every(p=>p.connected);
    setPrimaryLabel('room-start',finished?'Play again':'Start match');
    $('room-enter').classList.toggle('hidden',!playing);$('room-enter').disabled=!connected;
    $('room-leave').textContent=playing?'Leave room · forfeit match':'Leave room';
    $('room-result').classList.toggle('hidden',!finished);$('room-result').textContent=finished?resultTitle(room):'';
    const me=room.players[room.you],other=room.players[1-room.you];
    $('match-you').textContent=me?.score.toLocaleString()??'0';$('match-opponent').textContent=other?.score.toLocaleString()??'0';
    $('match-opponent-name').textContent=other?.name??'Opponent';
    $('match-finish').disabled=!connected||!playing||me?.status!=='playing';
    $('match-connection').textContent=!connected?'Reconnecting…':other&&!other.connected?'Friend disconnected':me?.status==='finished'?'Round finished':other?.status==='finished'?'Friend finished':'Live match';
  }
  async function run(action){
    if(busy)return;busy=true;for(const id of ['room-create','room-join','room-rejoin'])$(id).disabled=true;
    $('menu-status').textContent='Connecting…';
    try{await action();if(room){mode='multiplayer';showSetup(mode);renderRoom();}}catch(error){$('menu-status').textContent=error.message||'Could not connect. Please try again.';}
    finally{busy=false;for(const id of ['room-create','room-join','room-rejoin'])$(id).disabled=false;}
  }
  function drawOpponent(){
    if(!room)return;const other=room.players[1-room.you];if(!other)return;
    const canvas=$('opponent-canvas'),ctx=canvas.getContext('2d'),g=BOTTLES[room.bottleId];
    ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,360,420);g.drawBottleBack(ctx);
    ctx.save();ctx.beginPath();g.bottleOutline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
    for(const b of other.blobs){ctx.fillStyle=colors[b.level];ctx.beginPath();ctx.ellipse(b.x,b.y,radiusFor(b.level)*1.05,radiusFor(b.level)*.95,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#424d3d';ctx.font=`700 ${Math.min(24,radiusFor(b.level)*.55)}px sans-serif`;ctx.textAlign='center';ctx.fillText(valueFor(b.level,room.mergeMode??'two'),b.x,b.y+4);}
    ctx.restore();g.drawBottleFront(ctx);$('opponent-title').textContent=`${other.name}’s bottle`;
  }
  const modeCopy=[...document.querySelectorAll('#mode-home>.menu-footnote,.left-notes>p,.menu-friends span,#mode-classic h2,#mode-classic p,#guide .guide-row p')].map(element=>({element,html:element.innerHTML}));
  function renderMergeMode(){
    for(const {element,html} of modeCopy)element.innerHTML=html;
    $('merge-rule-badge').classList.toggle('hidden',rule.id!=='three');
    for(const button of document.querySelectorAll('[data-merge-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mergeMode===rule.id));
    if(rule.id==='three'){
      $('merge-rule-badge').classList.remove('hidden');
      document.querySelector('#mode-home>.menu-footnote').textContent='Your Three Combine rounds stay saved separately in this browser.';
      document.querySelector('.left-notes>p').innerHTML='Bring three matching friends together.<br>Grow 1 → 3 → 9 → 27.<br>See where the pile takes you.';
      document.querySelectorAll('.menu-friends span').forEach((el,i)=>el.textContent=3**i);
      $('mode-classic').querySelector('h2').textContent='Three Combine';
      $('mode-classic').querySelector('p').textContent='Match three equal blobs. Grow 1 → 3 → 9 → 27.';
      document.querySelector('#guide .guide-row p').textContent='Three ready blobs wait in a row. Tap 1, 2 or 3 to select one. Lift and move a blob to rearrange the row. Three identical ready blobs combine automatically into one next-level blob. A pair stays separate. Incoming values are 1, 3 and 9; merged values can grow to 177,147. Pull down and release to shoot from the selected slot.';
      document.querySelectorAll('#guide .guide-row p')[2].textContent='Three touching blobs of the same value combine: 1 + 1 + 1 makes 3, then three 3s make 9, and three 9s make 27. A connected chain of three counts, even if the two ends do not touch. Two matching blobs wait for a third. Your target is 2,187; keep going up to 177,147.';
    }
  }
  function switchMergeMode(next,roomCode=null){
    const state=hooks.switchMergeMode(next);
    rule=ruleFor(next);bottleId=state.bottleId;
    if(!roomCode)$('room-name').value=state.profile.name==='A squishy friend'?'':state.profile.name.slice(0,24);
    const url=new URL(location.href);url.searchParams.set('merge',rule.id);
    if(roomCode)url.searchParams.set('room',roomCode);else url.searchParams.delete('room');
    history.replaceState(null,'',url);
    renderMergeMode();renderBottles();
  }
  for(const button of document.querySelectorAll('[data-merge-mode]'))button.onclick=()=>{
    if(!room&&!busy&&button.dataset.mergeMode!==rule.id)switchMergeMode(button.dataset.mergeMode);
  };
  renderMergeMode();
  $('mode-classic').onclick=()=>showSetup('classic');$('mode-multiplayer').onclick=()=>showSetup('multiplayer');
  function requestHome(){
    if(page!=='game'){if(room)showSetup('multiplayer');else setPage('home');return;}
    $('home-copy').textContent=mode==='multiplayer'?'You’ll go home and forfeit this match. Your personal best stays.':'You’ll go home. This round will not be saved. Your personal best stays.';
    $('home-dialog').showModal();
  }
  async function confirmHome(){
    $('home-dialog').close();
    if(mode==='multiplayer'&&room)await leave('home');
    else {hooks.abandonRound();setPage('home');}
  }
  for(const link of document.querySelectorAll('.wordmark'))link.onclick=event=>{event.preventDefault();requestHome();};
  $('game-home').onclick=requestHome;$('confirm-home').onclick=()=>{void confirmHome();};
  $('mode-back').onclick=()=>{if(room){void leave();return;}setPage('home');};
  $('menu-achievements').onclick=()=>$('achievements').click();
  for(const button of document.querySelectorAll('[data-bottle]'))button.onclick=()=>{
    if(room){client.send({type:'bottle',bottleId:button.dataset.bottle});return;}
    if(mode==='classic'&&readyBottle===button.dataset.bottle){setPage('game');hooks.enterClassic(bottleId);return;}
    bottleId=button.dataset.bottle;readyBottle=mode==='classic'?bottleId:null;renderBottles();
  };
  $('room-create').onclick=()=>run(()=>client.create($('room-name').value,bottleId,rule.id));
  $('room-join-form').onsubmit=event=>{event.preventDefault();void run(()=>client.join($('room-name').value,$('room-code-input').value));};
  $('room-code-input').oninput=event=>{event.target.value=event.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'');};
  $('room-start').onclick=()=>client.send({type:'start'});
  $('room-copy').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);$('menu-status').textContent='Room code copied. Send it to your friend.';}catch{$('menu-status').textContent=`Share this room code: ${room.code}`;}};
  $('room-enter').onclick=()=>{setPage('game');hooks.enterMatch(room,connected);};
  async function leave(next='setup'){
    hooks.suspend();try{await client.leave();}catch{/* Server treats a lost connection with the normal grace period. */}
    room=null;connected=false;matchKey='';$('room-forms').classList.remove('hidden');$('room-lobby').classList.add('hidden');
    hooks.abandonRound();
    if(next==='home')setPage('home');else showSetup('multiplayer');
  }
  $('room-leave').onclick=()=>{void leave();};
  $('match-finish').onclick=()=>hooks.finishRound();
  $('match-opponent-view').onclick=()=>{hooks.cancelAim();drawOpponent();$('opponent-dialog').showModal();};
  $('room-name').addEventListener('focus',()=>$('room-name').select());
  $('room-name').value=hooks.profile.name==='A squishy friend'?'':hooks.profile.name.slice(0,24);
  try{const code=localStorage.getItem('squish-pocket-last-room');if(code){$('room-rejoin').classList.remove('hidden');$('room-rejoin').textContent=`Rejoin room ${code}`;$('room-rejoin').onclick=()=>run(()=>client.open(code));}}catch{}
  for(const button of document.querySelectorAll('[data-bottle]')){const ctx=button.querySelector('canvas').getContext('2d');ctx.scale(.5,.5);BOTTLES[button.dataset.bottle].drawBottleBack(ctx);BOTTLES[button.dataset.bottle].drawBottleFront(ctx);}
  if(new URL(location.href).searchParams.has('teststate')){setPage('game');hooks.showSavedState?.();}
  else {setPage('home');const code=new URL(location.href).searchParams.get('room');if(code)void run(()=>client.open(code));}
  return {client,showRoom:()=>showSetup('multiplayer'),publish:()=>client.publish(),resultTitle};
}
export function resultTitle(room){
  if(room.winner===null)return 'A lovely little tie.';
  if(room.winner===room.you)return room.reason==='forfeit'?'You win · your friend left.':'You win! A lovely little pile.';
  return room.reason==='forfeit'?'Match ended · you left the round.':`${room.players[room.winner].name} wins this one.`;
}
