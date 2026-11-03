import {BOTTLES} from './bottles.js?v=33';
import {radiusFor} from './engine.js?v=33';
import {RoomClient} from './room-client.js?v=34';
import {classicPlayLabel,classicSaveNote} from './round-record.js?v=38';
const colors=['#eaaa8c','#e6c87f','#afc4a0','#9abfcb','#b6abca','#d9a3b7','#80b6a6','#d8ab71','#9faed0','#d5c788','#c395c6','#e49e7d'];
const $=id=>document.getElementById(id);
const blobCaption='<span class="blob-caption" aria-hidden="true">•ᴗ•</span>';
const setPrimaryLabel=(id,label)=>{$(id).innerHTML=`${label} ${blobCaption}`;};
export function createStartPage(hooks){
  let mode='classic',bottleId=hooks.initialBottle,room=null,connected=false,matchKey='',page='home',busy=false;
  const client=new RoomClient({
    getProgress:r=>hooks.getProgress(r),
    onStatus:(state,message)=>{
      connected=state==='connected';$('menu-status').textContent=message;
      $('match-connection').textContent=connected?'Connected':state==='connecting'?'Connecting…':'Reconnecting…';
      if(room){hooks.updateMatch(room,connected);renderRoom();}
    },
    onRoom:(r,online)=>{
      if(!r)return;room=r;connected=online;bottleId=r.bottleId;
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
    for(const button of document.querySelectorAll('[data-bottle]')){
      button.setAttribute('aria-pressed',String(button.dataset.bottle===bottleId));
      button.disabled=!!room&&(!connected||room.you!==0||!['lobby','finished'].includes(room.phase));
    }
    const saved=hooks.classicStatus(bottleId);
    setPrimaryLabel('classic-play',classicPlayLabel(bottleId,saved));
    $('classic-save-note').textContent=classicSaveNote(bottleId,saved);
  }
  function showSetup(selected){
    mode=selected;$('menu-status').textContent='';
    $('mode-title').textContent=mode==='classic'?'Your own little pace.':'A friendly rivalry.';
    $('mode-eyebrow').textContent=mode==='classic'?'CLASSIC / JUST YOU':'MULTIPLAYER / TWO LITTLE PILES';
    $('mode-description').textContent=mode==='classic'?'Choose a bottle and make a little room.':'Pick a bottle, create a private room, and invite a friend. Or enter their code to join.';
    $('classic-actions').classList.toggle('hidden',mode!=='classic');$('multiplayer-setup').classList.toggle('hidden',mode!=='multiplayer');
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
    for(const b of other.blobs){ctx.fillStyle=colors[b.level];ctx.beginPath();ctx.ellipse(b.x,b.y,radiusFor(b.level)*1.05,radiusFor(b.level)*.95,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#424d3d';ctx.font=`700 ${Math.min(24,radiusFor(b.level)*.55)}px sans-serif`;ctx.textAlign='center';ctx.fillText(2**(b.level+1),b.x,b.y+4);}
    ctx.restore();g.drawBottleFront(ctx);$('opponent-title').textContent=`${other.name}’s bottle`;
  }
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
  $('classic-play').onclick=()=>{setPage('game');hooks.enterClassic(bottleId);};
  for(const button of document.querySelectorAll('[data-bottle]'))button.onclick=()=>{
    if(room){client.send({type:'bottle',bottleId:button.dataset.bottle});return;}
    bottleId=button.dataset.bottle;renderBottles();
  };
  $('room-create').onclick=()=>run(()=>client.create($('room-name').value,bottleId));
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
  $('room-name').value=hooks.profile.name==='A squishy friend'?'':hooks.profile.name.slice(0,24);
  try{const code=localStorage.getItem('squish-pocket-last-room');if(code){$('room-rejoin').classList.remove('hidden');$('room-rejoin').textContent=`Rejoin room ${code}`;$('room-rejoin').onclick=()=>run(()=>client.open(code));}}catch{}
  for(const [id,key] of [['menu-bottle-classic','classic'],['menu-bottle-flask','lab-flask']]){const ctx=$(id).getContext('2d');ctx.scale(.5,.5);BOTTLES[key].drawBottleBack(ctx);BOTTLES[key].drawBottleFront(ctx);}
  if(new URL(location.href).searchParams.has('teststate')){setPage('game');hooks.showSavedState?.();}
  else setPage('home');
  return {client,showRoom:()=>showSetup('multiplayer'),publish:()=>client.publish(),resultTitle};
}
export function resultTitle(room){
  if(room.winner===null)return 'A lovely little tie.';
  if(room.winner===room.you)return room.reason==='forfeit'?'You win · your friend left.':'You win! A lovely little pile.';
  return room.reason==='forfeit'?'Match ended · you left the round.':`${room.players[room.winner].name} wins this one.`;
}
