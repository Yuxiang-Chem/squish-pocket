import {t,onLanguageChange,mountLanguagePicker} from './i18n.js?v=84';
import {recordEligible,recordScore} from './record-epoch.js?v=84';
import {CURRENT_RULE,ruleFor,saveKeyFor} from './merge-rules.js?v=84';
import {createStartPage} from './start-page.js?v=84';
import {Engine,blob,WIDTH,HEIGHT,MAX_LEVEL,setReducedMergeMotion} from './engine.js?v=84';
import {MAX_ANGLE,aimFromPoint,clampAngle,launchOrigin} from './controls.js?v=6';
import {PHYSICS_DEFAULTS_VERSION,playerPhysics,defaultPhysicsFor} from './physics-settings.js?v=84';
import {RackMotion} from './rack-motion.js?v=84';
import {isBottleId} from './bottles.js?v=84';

import {DragMotion} from './drag-motion.js?v=29';
import {HOLE,dragOutsideGlass} from './preparation.js?v=84';
import {pullMode,pullShot,insertionIndex} from './preparation-gesture.js?v=29';
import {installShootTouchGuard} from './shoot-touch.js?v=29';
import {connectAchievements} from './achievements.js?v=84';

const $=id=>document.getElementById(id);
const colors=['#eaaa8c','#e6c87f','#afc4a0','#9abfcb','#b6abca','#d9a3b7','#80b6a6','#d8ab71','#9faed0','#d5c788','#c395c6','#e49e7d'];
const canvas=$('canvas'),ctx=canvas.getContext('2d'),overlay=$('overlay');
installShootTouchGuard($('shoot'));
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
setReducedMergeMotion(reducedMotion);
let page='menu',gameMode='classic',activeRoom=null,roomConnected=false,currentMatchKey='',shownResult='',shell;
let activeRule=CURRENT_RULE;
let engine=new Engine(undefined,'classic',activeRule.id),started=false,paused=false,aimAngle=0,power=.25,pointer=null,aimCancelled=false,keyboardAiming=false;
let particles=[],rackRings=[],rackSparks=[],lastTime=performance.now(),accumulator=0,saveElapsed=0,best=0,sound=true,audio=null,lastSound=0;
let spillReveal=0,endedShown=false,highestSeen=0,storageWarning=false,toastTimer;
const rackMotion=new RackMotion(reducedMotion);
let rackGesture=null,aimGesture=null,fireGesture=null;
const dragMotion=new DragMotion(reducedMotion);
const dragCanvas=document.createElement('canvas'),dragCtx=dragCanvas.getContext('2d');
dragCanvas.className='prep-drag-layer';dragCanvas.setAttribute('aria-hidden','true');document.body.append(dragCanvas);
let previewEngine=null,previewAccumulator=0,previewAge=0,overlayCopy=null,lastToast='';
const selectedBottleKey=()=>'squish-pocket-selected-bottle'+(activeRule.id==='three'?':three':'');
function savedBottle(){
  try{const id=localStorage.getItem(selectedBottleKey());if(isBottleId(id))return id;}catch{}
  return 'classic';
}
const saveKey=id=>saveKeyFor(id,activeRule.id);
function restoreBottle(id,restoreSound=false){
  engine=new Engine(undefined,id,activeRule.id);started=false;paused=false;
  try{
    const data=JSON.parse(localStorage.getItem(saveKey(id)));
    if(data?.version===1){
      const restored=Engine.restore(data.engine);
      if(restored?.bottleId===id&&restored.mergeMode===activeRule.id){engine=restored;engine.setPhysics(defaultPhysicsFor(id));started=data.started===true;paused=started;}
      if(recordEligible(engine)&&Number.isSafeInteger(data.best)&&data.best>=0)best=Math.max(best,data.best);
      if(restoreSound&&typeof data.sound==='boolean')sound=data.sound;
    }
  }catch{/* A missing or unavailable save starts a new bottle. */}
}
let selectedBottle=savedBottle();
restoreBottle(selectedBottle,true);
best=Math.max(best,recordScore(engine));
highestSeen=Math.max(0,...engine.blobs.map(b=>b.level));
rackMotion.setBottle(engine.bottleId);rackMotion.setPhysics(engine.physics,engine.mergeMode);rackMotion.reset(engine.rackOrder());
const achievements=connectAchievements({getEngine:()=>engine,getBest:()=>best,
  canCelebrate:()=>!started||(engine.over&&endedShown)||(gameMode==='multiplayer'&&activeRoom?.phase==='finished'),cancelAim,toast});
best=Math.max(best,achievements.profile.score);
achievements.observe(engine,best);

function save(){
  achievements.observe(engine,best);
  try{
    const data={version:1,physicsDefaultsVersion:PHYSICS_DEFAULTS_VERSION,engine,started,best,sound};
    if(gameMode==='classic')localStorage.setItem(saveKey(engine.bottleId),JSON.stringify(data));
    else if(activeRoom&&currentMatchKey===`${activeRoom.code}:${activeRoom.round}`)localStorage.setItem(`squish-pocket-match:${currentMatchKey}`,JSON.stringify({...data,round:activeRoom.round,seed:activeRoom.seed}));
  }
  catch{if(!storageWarning){toast('Browser saving is unavailable');storageWarning=true;}}
}
function toast(message){
  lastToast=message;$('toast').textContent=t(message);$('toast').classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2400);
}
function unlockAudio(){
  if(!sound)return;
  try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{audio=null;}
}
function pop(level=0,shot=false){
  if(!sound||!audio||audio.state!=='running'||performance.now()-lastSound<55)return;
  lastSound=performance.now();
  const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
  oscillator.type='sine';oscillator.frequency.setValueAtTime(shot?190:280*1.12**level,now);
  oscillator.frequency.exponentialRampToValueAtTime(shot?90:420*1.12**level,now+.11);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(shot?.035:.065,now+.008);
  gain.gain.exponentialRampToValueAtTime(.0001,now+.18);
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(now);oscillator.stop(now+.2);
}
function cancelAim(){
  const oldPointer=pointer;
  rackMotion.release();dragMotion.stop();rackGesture=null;aimGesture=null;fireGesture=null;
  pointer=null;power=.25;aimCancelled=false;keyboardAiming=false;updateAimUI();
  if(oldPointer!==null)for(const target of [canvas,$('shoot')])if(target.hasPointerCapture(oldPointer))target.releasePointerCapture(oldPointer);
}
function modalOpen(){return !!document.querySelector('dialog[open]');}
function playable(){return page==='game'&&started&&!paused&&!engine.over&&!modalOpen()&&(gameMode==='classic'||(roomConnected&&activeRoom?.phase==='playing'&&activeRoom.players[activeRoom.you]?.status==='playing'));}

function showOverlay({kicker,title,description,button,action,secondary,secondaryAction,footnote,friends=false,stats=false}){
  overlayCopy={kicker,title,description,button,action,secondary,secondaryAction,footnote,friends,stats};
  cancelAim();overlay.classList.remove('hidden');
  overlay.querySelector('.intro-friends').classList.toggle('hidden',!friends);
  $('round-stats').classList.toggle('hidden',!stats);
  $('round-bottle').classList.toggle('hidden',!stats);
  if(stats){achievements.renderRoundStats();void achievements.sync(true);}
  $('overlay-kicker').textContent=t(kicker);$('overlay-title').replaceChildren(...t(title).split(/<br\s*\/?>/i).flatMap((part,i)=>i?[document.createElement('br'),document.createTextNode(part)]:[document.createTextNode(part)]));
  $('overlay-description').textContent=t(description);$('start').querySelector('span').textContent=t(button);
  $('start').onclick=action;$('secondary').classList.toggle('hidden',!secondary);
  $('secondary').textContent=t(secondary??'');$('secondary').onclick=secondaryAction??null;
  $('overlay-footnote').textContent=t(footnote??'');
}
function newGame(){
  if(gameMode!=='classic')return;
  achievements.observe(engine,best);
  const physics=defaultPhysicsFor(engine.bottleId);
  engine=new Engine(undefined,engine.bottleId,activeRule.id);engine.setPhysics(physics);started=true;paused=false;endedShown=false;spillReveal=0;highestSeen=0;
  particles=[];rackRings=[];rackSparks=[];aimAngle=0;cancelAim();accumulator=0;
  rackMotion.reset([]);rackMotion.play(engine.rackEvents,engine.rackOrder());
  overlay.classList.add('hidden');unlockAudio();updateHUD();save();canvas.focus({preventScroll:true});
}
function resume(){paused=false;overlay.classList.add('hidden');accumulator=0;unlockAudio();updateHUD();canvas.focus({preventScroll:true});}
function pauseGame(){
  if(!started||engine.over)return;
  paused=true;cancelAim();save();updateHUD();
  showOverlay({kicker:'A MOMENT TO YOURSELF',title:'Take a breather.',description:'Your little pile will be here.',button:'Keep squishing',action:resume,footnote:'SAVED IN THIS BROWSER.',friends:true,stats:true});
}
function showMatchOverlay(){
  if(activeRoom?.phase==='finished'){
    shownResult=`${activeRoom.code}:${activeRoom.round}`;
    showOverlay({kicker:'MATCH COMPLETE',title:'A lovely little match.',description:shell.resultTitle(activeRoom),button:'Back to the room',action:()=>shell.showRoom(),friends:true,stats:true});
    return;
  }
  showOverlay({kicker:'YOUR ROUND IS COMPLETE',title:engine.endReason==='spill'?'A little spill.':'A lovely little pile.',description:'Your score is saved for this match. Check your friend’s progress in the room.',button:'View match',action:()=>shell.showRoom(),friends:true,stats:true});
}
function finish(){
  if(endedShown)return;endedShown=true;cancelAim();best=Math.max(best,recordScore(engine));save();updateHUD();
  if(gameMode==='multiplayer'){shell.publish();showMatchOverlay();return;}
  const spilled=engine.endReason==='spill';
  showOverlay({kicker:spilled?'OUTSIDE THE BOTTLE':recordEligible(engine)&&engine.score>0&&engine.score>=achievements.roundRecords().personalBest?'A NEW PERSONAL BEST':'A LOVELY LITTLE PILE',title:spilled?'A little spill.':'Full of feelings.',description:spilled?'Game over — a blob fell outside the bottle.':`${engine.shots} little drops`,button:'One more round',action:newGame,footnote:'THERE’S ALWAYS ROOM FOR A FRESH START.',friends:true,stats:true});
}
// Shots leave from wherever the selected ready blob currently is.
function launchPoint(){
  const item=rackMotion.visual.get(engine.selectedId);
  return launchOrigin(item?{x:item.body?.x??item.x,y:item.body?.y??item.y}:null);
}
function shoot(){
  if(!playable())return;
  const origin=launchPoint();
  if(rackGesture)cancelAim();
  if(rackMotion.busy)rackMotion.interrupt(engine.rackOrder());
  unlockAudio();
  const firedId=engine.selectedId;
  if(engine.shoot(aimAngle,power,true,origin)){
    rackMotion.play(engine.rackEvents,engine.rackOrder(),firedId);
    pop(0,true);updateHUD();save();
  }
  cancelAim();
}
function updateHUD(){
  achievements.renderRoundStats();
  engine.rackOrder().forEach((item,i)=>{
    const button=$(`rack-${i}`);button.dataset.blobId=item.id;
    positionChoice(item,i);
    button.setAttribute('aria-label',t(`${engine.value(item.level)} blob, pull down to charge a shot, lift up to ${engine.rules.count===3?'rearrange':'merge or rearrange'}`));
    button.setAttribute('aria-pressed',String(item.id===engine.selectedId));button.disabled=!playable();
    button.title=t(`Choose ${engine.value(item.level)} to shoot`);
  });
  updateShootAvailability();
  $('restart').classList.toggle('hidden',gameMode==='multiplayer');
  $('pause').disabled=!started||engine.over;
  $('pause').setAttribute('aria-label',t(paused?'Resume game':'Pause game'));
  $('pause').querySelector('use').setAttribute('href',paused?'#i-play':'#i-pause');
  $('sound').setAttribute('aria-label',t(sound?'Turn sound off':'Turn sound on'));
  $('sound').setAttribute('aria-pressed',String(sound));
  $('sound').querySelector('use').setAttribute('href',sound?'#i-sound':'#i-muted');
  updateAimUI();
  canvas.setAttribute('aria-label',t(`${engine.vessel.name}. Three ready blobs: ${engine.rackOrder().map(b=>engine.value(b.level)).join(', ')}. Selected ${engine.value(engine.current)}. Aim through the opening. Use 1, 2, 3 to select a blob, left and right to aim, up and down for force, space to shoot.`));
}
function chooseSlot(index){
  if(!playable()||pointer!==null||rackGesture)return;
  if(rackMotion.busy)rackMotion.interrupt(engine.rackOrder());
  const item=engine.rackOrder()[index];
  if(item?.id===engine.selectedId)return;
  if(item&&engine.select(item.id)){
    cancelAim();updateHUD();save();
  }
}
for(let index=0;index<3;index++)$(`rack-${index}`).onclick=event=>{
  if(event.detail===0)chooseSlot(index);
};
function positionChoice(item,i){
  const visual=rackMotion.visual.get(item.id);if(!visual)return;
  const box=visual.body.bounds,button=$(`rack-${i}`);
  button.style.left=`${(box.minX-4)/WIDTH*100}%`;button.style.top=`${(box.minY-4)/HEIGHT*100}%`;
  button.style.width=`${(box.maxX-box.minX+8)/WIDTH*100}%`;button.style.height=`${(box.maxY-box.minY+8)/HEIGHT*100}%`;
}
function updateAimUI(){
  $('power-fill').style.width=`${Math.max(4,power*100)}%`;
  $('shoot').textContent=t(fireGesture?(fireGesture.manual&&power<=0?'Release to cancel':`Release · ${Math.round(power*100)}%`):'Hold to shoot ↓');
  if(engine.over){$('hint').textContent=t(gameMode==='multiplayer'?'ROUND COMPLETE · CHECK THE ROOM':engine.endReason==='spill'?'GAME OVER · A BLOB FELL OUTSIDE':'ROUND OVER · ONE MORE ROUND?');return;}
  if(rackGesture?.mode==='charge'){
    $('hint').textContent=t(aimCancelled?'PULL FARTHER DOWN TO CHARGE · RETURN UP TO CANCEL':`FORCE ${Math.round(power*100)}% · RELEASE TO SHOOT`);
  }else if(rackGesture?.mode==='drag'){
    if(engine.rules.count===3){$('hint').textContent=t('LIFT TO REARRANGE · THREE EQUAL BLOBS MAKE ONE');return;}
    $('hint').textContent=t(rackGesture.mergeTarget?'LOWER ON THE MATCHING BLOB TO MERGE':rackGesture.lifted&&rackGesture.dropIndex!==null?`RELEASE TO PLACE ${['LEFT','IN THE MIDDLE','RIGHT'][rackGesture.dropIndex]} · MATCHING BLOBS MERGE`:rackGesture.blocked?'LIFT TO REARRANGE · RELEASE TO RETURN':'MATCHING CONTACTS MERGE · RELEASE TO RETURN');
  }else if(rackMotion.busy){$('hint').textContent=t('PREPARING YOUR NEXT BLOBS…');}
  else if(fireGesture)$('hint').textContent=t(`FORCE ${Math.round(power*100)}% · ↑↓ FORCE · ←→ AIM · RELEASE TO FIRE`);
  else if(aimGesture||keyboardAiming)$('hint').textContent=t(`FORCE ${Math.round(power*100)}% · RELEASE TO SHOOT`);
  else $('hint').innerHTML=t(engine.rules.count===3?'PULL DOWN TO SHOOT <span>·</span> LIFT UP TO REARRANGE':'PULL DOWN TO SHOOT <span>·</span> LIFT UP TO MERGE & REARRANGE');
}
function updateShootAvailability(){
  // Native disabled buttons can bypass touch handlers on iOS. Guard actions
  // in the handlers and expose unavailable pause/end states through ARIA.
  $('shoot').disabled=false;
  $('shoot').setAttribute('aria-disabled',String(!playable()));
  $('shoot').tabIndex=playable()?0:-1;
  const index=engine.rack.findIndex(b=>b.id===engine.selectedId);
  for(const [id,step] of [['select-left',-1],['select-right',1]]){
    const target=index+step,available=playable()&&index>=0&&target>=0&&target<engine.rack.length;
    $(id).setAttribute('aria-disabled',String(!available));$(id).tabIndex=available?0:-1;
  }
}
function localPoint(event){
  const rect=canvas.getBoundingClientRect();
  return {x:(event.clientX-rect.left)/rect.width*WIDTH,y:(event.clientY-rect.top)/rect.height*HEIGHT};
}
function hitReady(p){
  return rackMotion.items.map(item=>({item,d:Math.hypot((p.x-item.x)/1.4,(p.y-item.y)*1.4)/item.body.renderRadius})).filter(({d})=>d<1.6).sort((a,b)=>a.d-b.d)[0]?.item;
}
function resolvePreparationContacts(){
  if(!playable()||rackMotion.busy||rackGesture?.mode==='charge'||fireGesture)return false;
  if(!engine.mergeRackContacts(rackMotion.takeContacts(),rackMotion.activeDrags))return false;
  const oldPointer=pointer,level=engine.rackEvents[0].level;
  // Finish this gesture before the merge/refill animation. Its remaining pointer
  // events cannot accidentally aim or shoot a new blob.
  rackGesture=null;aimGesture=null;fireGesture=null;pointer=null;dragMotion.stop();power=.25;keyboardAiming=false;
  rackMotion.play(engine.rackEvents,engine.rackOrder());
  if(oldPointer!==null)for(const target of [canvas,$('shoot')])if(target.hasPointerCapture(oldPointer))target.releasePointerCapture(oldPointer);
  pop(level);updateHUD();save();return true;
}
function pointerDown(event){
  if(!playable()||pointer!==null||event.button!==0)return;
  const requested=event.target.closest?.('.rack-choice')?.dataset.blobId;
  if(rackMotion.busy)rackMotion.interrupt(engine.rackOrder());
  const p=localPoint(event),item=requested?rackMotion.visual.get(Number(requested)):hitReady(p);
  if(!item&&!(p.y>engine.vessel.BOTTLE_MOUTH&&engine.vessel.insideBottle(p.x,p.y)))return;
  event.preventDefault();unlockAudio();pointer=event.pointerId;keyboardAiming=false;
  if(item){
    rackGesture={mode:'pending',id:item.id,startX:p.x,startY:p.y,x:item.x,y:item.y,home:{x:item.x,y:item.y},anchors:engine.rack.map(b=>rackMotion.rest.get(b.id)?.x??rackMotion.visual.get(b.id).x),lifted:false,dropIndex:null,blocked:false};
    dragMotion.start(item.x,item.y,event.timeStamp);
  }else {aimGesture={startX:p.x,startY:p.y};power=0;aimAngle=aimFromPoint(p.x,p.y,launchPoint()).angle;}
  canvas.setPointerCapture(pointer);canvas.focus({preventScroll:true});updateHUD();
}
// Prevent the browser’s double-tap zoom without blocking pinch zoom elsewhere.
document.querySelector('.game').addEventListener('dblclick',event=>event.preventDefault());
canvas.addEventListener('pointerdown',pointerDown);
for(let i=0;i<3;i++)$(`rack-${i}`).addEventListener('pointerdown',pointerDown);
function updatePointer(event){
  const p=localPoint(event);
  if(aimGesture){
    aimAngle=aimFromPoint(p.x,p.y,launchPoint()).angle;
    power=Math.min(1,Math.hypot(p.x-aimGesture.startX,p.y-aimGesture.startY)/198);
    aimCancelled=p.y<engine.vessel.BOTTLE_MOUTH;updateAimUI();return;
  }
  if(!rackGesture)return;
  const g=rackGesture,item=rackMotion.visual.get(g.id);if(!item)return;
  const start={x:g.startX,y:g.startY};
  if(g.mode==='pending'){
    g.mode=pullMode(start,p);if(g.mode==='pending')return;
    engine.select(g.id);updateHUD();
  }
  if(g.mode==='charge'&&p.y<g.startY-12){rackMotion.release();g.mode='drag';g.lifted=true;keyboardAiming=false;power=.25;}
  if(g.mode==='charge'){
    const shot=pullShot(start,p,launchPoint());power=shot.power;aimAngle=shot.angle;aimCancelled=shot.cancelled;keyboardAiming=true;
    rackMotion.charge(g.id,g.home,power,p.x-g.startX);updateAimUI();return;
  }
  if(p.y<g.startY-12)g.lifted=true;
  g.dropIndex=g.lifted?insertionIndex(p,g.anchors,g.home.y):null;
  const neighbor=engine.rack[g.dropIndex];
  g.mergeTarget=engine.rules.count===2&&!!neighbor&&neighbor.id!==g.id&&neighbor.level===item.level;
  rackMotion.previewInsertion(g.id,g.mergeTarget?null:g.dropIndex);
  const target=dragOutsideGlass({x:g.x,y:g.y},p,item.body.renderRadius,engine.vessel);
  g.x=target.x;g.y=target.y;g.blocked=target.blocked;
  dragMotion.move(g.x,g.y,event.timeStamp);rackMotion.hold(g.id,g.x,g.y);
  if(!resolvePreparationContacts())updateAimUI();
}
canvas.addEventListener('pointermove',event=>{if(event.pointerId===pointer){event.preventDefault();updatePointer(event);}});
canvas.addEventListener('pointerup',event=>{
  if(event.pointerId!==pointer)return;
  event.preventDefault();
  if(aimGesture){updatePointer(event);const fire=!aimCancelled;aimGesture=null;pointer=null;if(fire)shoot();else cancelAim();updateHUD();return;}
  const g=rackGesture;if(!g){cancelAim();return;}
  if(g.mode==='pending'){
    rackGesture=null;pointer=null;dragMotion.stop();chooseSlot(engine.rack.findIndex(b=>b.id===g.id));updateHUD();return;
  }
  updatePointer(event);if(!rackGesture)return;
  if(g.mode==='charge'){
    const fire=!aimCancelled&&power>0;
    rackGesture=null;pointer=null;dragMotion.stop();
    if(fire)shoot();else cancelAim();updateHUD();save();return;
  }
  rackMotion.release(dragMotion.velocity());
  rackGesture=null;pointer=null;dragMotion.stop();
  if(g.lifted&&g.dropIndex!==null&&engine.reorderRack(g.id,g.dropIndex)){
    rackMotion.play(engine.rackEvents,engine.rackOrder());cancelAim();updateHUD();save();return;
  }
  cancelAim();resolvePreparationContacts();updateHUD();save();
});
canvas.addEventListener('pointercancel',event=>{if(event.pointerId===pointer){cancelAim();updateHUD();}});
canvas.addEventListener('lostpointercapture',event=>{if(event.pointerId===pointer){cancelAim();updateHUD();}});
$('shoot').addEventListener('pointerdown',event=>{
  event.preventDefault();
  if(!playable()||event.button!==0||fireGesture)return;
  // Shoot takes priority even while another finger holds a ready blob.
  if(pointer!==null)cancelAim();
  if(rackMotion.busy)rackMotion.interrupt(engine.rackOrder());
  unlockAudio();pointer=event.pointerId;fireGesture={start:performance.now(),x:event.clientX,y:event.clientY,angle:aimAngle,manual:null};power=0;keyboardAiming=true;
  $('shoot').setPointerCapture(pointer);updateAimUI();
});
// While holding Shoot, sideways travel steers the guide and vertical travel
// sets force. These many CSS pixels cover the full angle and force ranges.
const SHOOT_AIM_SLIDE=110,SHOOT_FORCE_SLIDE=120,SHOOT_FORCE_START=8;
$('shoot').addEventListener('pointermove',event=>{
  if(event.pointerId!==pointer||!fireGesture)return;
  event.preventDefault();
  const g=fireGesture;
  aimAngle=clampAngle(g.angle+(event.clientX-g.x)/SHOOT_AIM_SLIDE*MAX_ANGLE,launchPoint());
  // Vertical movement takes over from timed charging, starting at the current force.
  if(!g.manual&&Math.abs(event.clientY-g.y)>SHOOT_FORCE_START)g.manual={y:event.clientY,power};
  if(g.manual)power=Math.max(0,Math.min(1,g.manual.power+(g.manual.y-event.clientY)/SHOOT_FORCE_SLIDE));
  updateAimUI();
});
$('shoot').addEventListener('pointerup',event=>{
  event.preventDefault();
  if(event.pointerId!==pointer||!fireGesture)return;
  // A slide down to zero force cancels; a quick tap still fires gently.
  const fire=!fireGesture.manual||power>0;
  fireGesture=null;pointer=null;if(fire)shoot();else cancelAim();updateHUD();
});
for(const [id,step] of [['select-left',-1],['select-right',1]])$(id).addEventListener('click',()=>{
  const index=engine.rack.findIndex(b=>b.id===engine.selectedId);
  if(index>=0)chooseSlot(Math.max(0,Math.min(engine.rack.length-1,index+step)));
});
$('shoot').addEventListener('pointercancel',event=>{if(event.pointerId===pointer){cancelAim();updateHUD();}});
$('shoot').addEventListener('lostpointercapture',event=>{if(fireGesture&&event.pointerId===pointer){cancelAim();updateHUD();}});
$('shoot').onclick=event=>{if(event.detail===0)shoot();};
document.addEventListener('keydown',event=>{
  if(page!=='game'||modalOpen()||event.target?.closest?.('input,select,textarea'))return;
  if(event.code==='Escape'){if(playable())pauseGame();else if(started&&!engine.over)resume();return;}
  if(!playable()||event.target instanceof HTMLButtonElement)return;
  if(['Digit1','Digit2','Digit3'].includes(event.code)){event.preventDefault();chooseSlot(Number(event.code.at(-1))-1);return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(event.code))event.preventDefault();
  if(event.code.startsWith('Arrow'))keyboardAiming=true;
  if(event.code==='ArrowLeft'||event.code==='ArrowRight'){
    const origin=launchPoint();aimAngle=clampAngle(clampAngle(aimAngle,origin)+(event.code==='ArrowLeft'?-.08:.08),origin);
  }
  if(event.code==='ArrowUp')power=Math.min(1,power+.08);
  if(event.code==='ArrowDown')power=Math.max(0,power-.08);
  updateAimUI();
  if(event.code==='Space'&&!event.repeat)shoot();
});
$('pause').onclick=()=>paused?resume():pauseGame();
$('sound').onclick=()=>{sound=!sound;unlockAudio();updateHUD();save();if(sound)pop(1);};
$('restart').onclick=()=>{
  if(gameMode!=='classic')return;
  if(!started||engine.over||engine.shots===0)newGame();else {cancelAim();$('reset-dialog').showModal();}
};
$('confirm-reset').onclick=()=>{$('reset-dialog').close();newGame();};
$('help').onclick=()=>{cancelAim();$('guide').showModal();};
function updatePhysicsUI(){
  for(const name of ['stiffness','viscosity']){
    const value=engine.physics[name];$(name).value=value;$(`${name}-value`).textContent=t(`${value}%`);
    $(name).setAttribute('aria-valuetext',t(`${value}%, ${name==='stiffness'?(value<35?'soft':value>70?'firm':'medium'):(value<35?'free-flowing':value>70?'thick and slow':'moderate resistance')}`));
  }
}
function resetPreview(){
  previewEngine=new Engine(345,'classic',activeRule.id);previewEngine.setPhysics(engine.physics);
  previewEngine.blobs=[blob(5,125,engine.vessel.BOTTLE_FLOOR-178+previewEngine.radius(5)+8,150,70)];previewAccumulator=0;previewAge=0;
}
$('settings').onclick=()=>{cancelAim();updatePhysicsUI();resetPreview();$('settings-dialog').showModal();};
$('preview-drop').onclick=resetPreview;
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{lastTime=performance.now();accumulator=0;}));
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(playable())pauseGame();else save();cancelAim();}else lastTime=performance.now();});
window.addEventListener('pagehide',save);

function renderEvolution(){
$('evolution').replaceChildren();
for(let level=0;level<=MAX_LEVEL;level++){
  const row=document.createElement('div');row.className='evolution-item';
  const friend=document.createElement('span');friend.className='evolution-blob';friend.style.background=colors[level];friend.textContent=t(engine.value(level));if(engine.value(level)>=10000)friend.style.fontSize='7px';
  const caption=document.createElement('span');caption.textContent=t(level===0?'a little hello':level===MAX_LEVEL?`${engine.value(MAX_LEVEL).toLocaleString()} · keep growing`:'↓');
  row.append(friend,caption);$('evolution').append(row);
}
}
renderEvolution();

function drawBlob(b,alpha=1,paint=ctx,glow=0){
  const ctx=paint;
  ctx.save();ctx.globalAlpha=alpha;
  const r=b.renderRadius??engine.radius(b.level),points=b.nodes?b.nodes.map(p=>[p.x,p.y]):b.shape.map((offset,k)=>{const a=k/24*Math.PI*2;return [b.x+Math.cos(a)*r*(1+offset),b.y+Math.sin(a)*r*(1+offset)];});
  ctx.beginPath();ctx.moveTo((points[23][0]+points[0][0])/2,(points[23][1]+points[0][1])/2);
  points.forEach((p,k)=>{const next=points[(k+1)%24];ctx.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);});
  ctx.closePath();
  const gradient=ctx.createLinearGradient(b.x-r,b.y-r,b.x+r,b.y+r);gradient.addColorStop(0,colors[b.level]);gradient.addColorStop(1,colors[b.level]+'e8');
  ctx.fillStyle=gradient;ctx.fill();ctx.strokeStyle='#30352e19';ctx.lineWidth=.8;ctx.stroke();
  if(glow>0){ctx.fillStyle=`rgba(255,255,255,${(.42*glow).toFixed(3)})`;ctx.fill();}
  // Faces and highlights deform with the membrane and never paint outside it.
  ctx.clip();
  ctx.fillStyle='#ffffff42';ctx.beginPath();ctx.ellipse(b.x-r*.33,b.y-r*.52,r*.22,r*.08,-.25,0,Math.PI*2);ctx.fill();
  const bounds=b.bounds;
  const faceX=bounds?Math.max(.55,Math.min(1.3,(bounds.maxX-bounds.minX)/(2*r))):1;
  const faceY=bounds?Math.max(.55,Math.min(1.3,(bounds.maxY-bounds.minY)/(2*r))):1;
  ctx.translate(b.x,b.y);ctx.scale(faceX,faceY);ctx.translate(-b.x,-b.y);
  ctx.fillStyle='#384031';
  for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(b.x+side*r*.23,b.y-r*.12,Math.max(1.5,r*.055),Math.max(2,r*.07),0,0,Math.PI*2);ctx.fill();}
  ctx.beginPath();ctx.moveTo(b.x-r*.1,b.y+r*.04);ctx.quadraticCurveTo(b.x,b.y+r*.17,b.x+r*.1,b.y+r*.04);ctx.strokeStyle='#384031';ctx.lineWidth=Math.max(1,r*.035);ctx.lineCap='round';ctx.stroke();
  ctx.font=`700 ${Math.max(9,r*.38)}px Manrope, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#384031cf';ctx.fillText(t(engine.value(b.level)),b.x,b.y+r*.45);
  ctx.restore();
}
const demo=[blob(3,55,388),blob(5,115,375),blob(4,185,382),blob(2,240,391),blob(1,282,393),blob(0,320,395),blob(2,75,348)];
function prepareOuterCanvas(){
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  if(dragCanvas.width!==Math.round(innerWidth*dpr)||dragCanvas.height!==Math.round(innerHeight*dpr)){dragCanvas.width=Math.round(innerWidth*dpr);dragCanvas.height=Math.round(innerHeight*dpr);}
  dragCtx.setTransform(1,0,0,1,0,0);dragCtx.clearRect(0,0,dragCanvas.width,dragCanvas.height);
  dragCtx.setTransform(rect.width/WIDTH*dpr,0,0,rect.height/HEIGHT*dpr,rect.left*dpr,rect.top*dpr);
  dragCanvas.style.visibility=started&&!paused&&!modalOpen()&&(!engine.over||!endedShown)?'visible':'hidden';
}
const RING_LIFE=.45,SPARK_LIFE=.55;
function spawnRackBurst({x,y,level,radius}){
  rackRings.push({x,y,level,radius,life:RING_LIFE});
  for(let k=0;k<14;k++){
    const angle=k/14*Math.PI*2+(k%2)*.2,speed=(k%2?55:85)+Math.random()*25;
    rackSparks.push({x:x+Math.cos(angle)*radius*1.1,y:y+Math.sin(angle)*radius*.75,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed*.7-25,life:SPARK_LIFE,size:k%2?1.6:2.6,white:k%3===0,level});
  }
}
function updateRackBursts(elapsed){
  for(const r of rackRings)r.life-=elapsed;
  for(const p of rackSparks){p.life-=elapsed;p.x+=p.vx*elapsed;p.y+=p.vy*elapsed;p.vx*=Math.exp(-3*elapsed);p.vy=p.vy*Math.exp(-3*elapsed)+70*elapsed;}
  rackRings=rackRings.filter(r=>r.life>0).slice(-8);rackSparks=rackSparks.filter(p=>p.life>0).slice(-120);
}
function drawRackBursts(){
  ctx.save();
  for(const r of rackRings){
    const t=1-r.life/RING_LIFE,ease=1-(1-t)**3;
    ctx.globalAlpha=(1-t)**2*.4;ctx.fillStyle='#fffdf6';ctx.beginPath();ctx.ellipse(r.x,r.y,r.radius*(.8+.5*ease)*1.2,r.radius*(.8+.5*ease)/1.2,0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=(1-t)*.9;ctx.strokeStyle=colors[r.level];ctx.lineWidth=3.2*(1-t)+.4;ctx.beginPath();ctx.ellipse(r.x,r.y,r.radius*(.9+1.1*ease)*1.25,r.radius*(.9+1.1*ease)/1.25,0,0,Math.PI*2);ctx.stroke();
  }
  for(const p of rackSparks){const t=p.life/SPARK_LIFE;ctx.globalAlpha=Math.min(1,t*1.6);ctx.fillStyle=p.white?'#fffaf0':colors[p.level];ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.2,p.size*(.4+.6*t)),0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function drawRack(){
  if(rackGesture?.mode==='drag'&&rackGesture.lifted&&rackGesture.dropIndex!==null){
    const target=rackGesture.mergeTarget?rackMotion.visual.get(engine.rack[rackGesture.dropIndex]?.id):rackMotion.rest.get(rackGesture.id),item=rackMotion.visual.get(rackGesture.id);
    if(target&&item){ctx.save();ctx.strokeStyle='#cf725d99';ctx.fillStyle='#cf725d0a';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.ellipse(target.x,target.y,item.body.renderRadius*1.4,item.body.renderRadius/1.4,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
  }
  for(const item of rackMotion.items){
    const bounds=item.body.bounds,outside=bounds.minX<0||bounds.maxX>WIDTH||bounds.minY<0||bounds.maxY>HEIGHT;
    const paint=outside?dragCtx:ctx;
    paint.save();paint.translate(item.x,item.y);paint.scale(item.scale,item.scale);
    if(item.squash?.amount){paint.rotate(item.squash.angle);paint.scale(1+item.squash.amount,1-item.squash.amount*.7);paint.rotate(-item.squash.angle);}
    paint.translate(-item.body.x,-item.body.y);drawBlob(item.body,item.alpha,paint,item.glow??0);paint.restore();
    if(item.id===engine.selectedId){paint.strokeStyle='#cf725d99';paint.lineWidth=1;paint.setLineDash([2,3]);paint.beginPath();paint.ellipse(item.x,item.y,(bounds.maxX-bounds.minX)/2+4,(bounds.maxY-bounds.minY)/2+4,0,0,Math.PI*2);paint.stroke();paint.setLineDash([]);}
  }
  drawRackBursts();
  engine.rack.forEach(positionChoice);
  ctx.textAlign='center';ctx.font='600 7px "DM Sans", sans-serif';ctx.fillStyle='#9da58e';ctx.fillText(t(rackMotion.busy?'PREPARING…':rackGesture?.mode==='charge'?`CHARGING · ${Math.round(power*100)}%`:(engine.rules.count===3?'LIFT UP · REARRANGE':'LIFT UP · MERGE OR REARRANGE')),180,12);
  ctx.font='600 6px "DM Sans", sans-serif';ctx.fillText(t(rackGesture?.mode==='charge'?'RELEASE TO SHOOT · PULL BACK UP TO CANCEL':'PULL DOWN TO CHARGE A SHOT'),180,101);

}
function drawAimGuide(){
  const selected=rackMotion.visual.get(engine.selectedId);
  if(!selected||selected.alpha<=0)return;
  const body=selected.body,originX=body.x,originY=body.y;
  const bounds=body.bounds,outside=bounds&&(bounds.minX<0||bounds.maxX>WIDTH||bounds.minY<0||bounds.maxY>HEIGHT);
  const paint=outside?dragCtx:ctx,angle=clampAngle(aimAngle,launchPoint());
  const sx=Math.sin(angle),sy=Math.cos(angle);
  let edge=0;
  for(let i=0;i<body.nodes.length;i++){
    const a=body.nodes[i],b=body.nodes[(i+1)%body.nodes.length],dx=b.x-a.x,dy=b.y-a.y;
    const denominator=sx*dy-sy*dx;if(Math.abs(denominator)<.000001)continue;
    const ax=a.x-originX,ay=a.y-originY,distance=(ax*dy-ay*dx)/denominator,along=(ax*sy-ay*sx)/denominator;
    if(distance>=0&&along>=0&&along<=1)edge=Math.max(edge,distance);
  }
  const offset=edge+2,length=Math.max(65+power*100,offset+25);
  const x=originX+sx*length,y=originY+sy*length;
  paint.setLineDash([2,6]);paint.lineWidth=1.8;paint.strokeStyle=power>.7?'#cf725dc0':'#8c9775a0';paint.beginPath();paint.moveTo(originX+sx*offset,originY+sy*offset);paint.lineTo(x,y);paint.stroke();paint.setLineDash([]);
  paint.fillStyle=power>.7?'#cf725d':'#8c9775';paint.beginPath();paint.moveTo(x+sy*4-sx*6,y-sx*4-sy*6);paint.lineTo(x,y);paint.lineTo(x-sy*4-sx*6,y+sx*4-sy*6);paint.fill();
}
function draw(elapsed=1/60){
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  prepareOuterCanvas();
  engine.vessel.drawBottleBack(ctx,engine.waterState);
  ctx.fillStyle='#6c968510';
  for(let x=38;x<WIDTH-25;x+=22)for(let y=236;y<HEIGHT-28;y+=22)if(engine.vessel.insideBottle(x,y)){ctx.beginPath();ctx.arc(x,y,.65,0,Math.PI*2);ctx.fill();}
  const danger=Math.max(0,...engine.blobs.map(b=>b.danger));
  ctx.beginPath();ctx.moveTo(engine.vessel.bottleLeftAt(engine.vessel.FILL_LINE)+10,engine.vessel.FILL_LINE);ctx.lineTo(WIDTH-engine.vessel.bottleLeftAt(engine.vessel.FILL_LINE)-10,engine.vessel.FILL_LINE);ctx.setLineDash([3,6]);ctx.lineWidth=1;
  ctx.strokeStyle=danger>0?'#cf725dd9':'#98a08566';ctx.stroke();ctx.setLineDash([]);
  ctx.font='600 7px "DM Sans", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle=danger>0?'#cf725d':'#9fa58e';ctx.fillText(t(danger>0?'MAKE A LITTLE ROOM':'A LITTLE ROOM TO GROW'),WIDTH/2,engine.vessel.FILL_LINE+14);
  for(const b of started?engine.blobs:engine.bottleId==='classic'?demo:[]){
    const box=b.bounds,outside=box&&(box.minX<0||box.maxX>WIDTH||box.minY<0||box.maxY>HEIGHT);
    const paint=outside?dragCtx:ctx;
    paint.save();
    // Smoothing a concave membrane can round across a glass corner. Keep the
    // rendered outline within the same vessel once every particle is inside.
    if(engine.vessel.trace&&!b.spilled&&b.nodes?.every(p=>p.bottleSide)){engine.vessel.trace(paint,true);paint.clip();}
    drawBlob(b,1,paint);paint.restore();
  }
  for(const p of particles){ctx.globalAlpha=p.life/.6;ctx.fillStyle=colors[p.level];ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.2,2.8*p.life/.6),0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  ctx.globalAlpha=1;
  engine.vessel.drawBottleFront(ctx,engine.waterState);
  if(started&&(!engine.over||!endedShown)){
    if((keyboardAiming||aimGesture)&&!aimCancelled)drawAimGuide();
    drawRack(elapsed);
    if(engine.shots===0&&engine.bottleId==='classic'){ctx.font='500 10px "DM Sans", sans-serif';ctx.fillStyle='#99a08b';ctx.fillText(t(engine.bottleId==='classic'?'Pull a blob down, then release to shoot.':'Aim into a neck, then release to shoot.'),WIDTH/2,HEIGHT*.61);ctx.fillText(t(engine.rules.count===3?'Lift it up to rearrange the ready row.':'Lift it up to merge or change its position.'),WIDTH/2,HEIGHT*.61+17);}
  }
}
function resize(){
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
  if(!rect.width||!rect.height)return;
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  ctx.setTransform(canvas.width/WIDTH,0,0,canvas.height/HEIGHT,0,0);draw();
}
function fitJar(){
  const wrap=document.querySelector('.jar-wrap'),jar=$('jar');
  const width=Math.min(wrap.clientWidth,wrap.clientHeight*WIDTH/HEIGHT);
  jar.style.width=`${width}px`;jar.style.height=`${width*HEIGHT/WIDTH}px`;
}
function drawPhysicsPreview(elapsed){
  if(!$('settings-dialog').open||!previewEngine)return;
  previewAccumulator+=elapsed;previewAge+=elapsed;
  while(previewAccumulator>=1/120){previewEngine.step(1/120);previewAccumulator-=1/120;}
  const p=$('physics-preview').getContext('2d');p.setTransform(2,0,0,2,0,0);p.clearRect(0,0,360,180);
  p.fillStyle='#535e3912';
  for(let x=14;x<360;x+=22)for(let y=12;y<180;y+=22){p.beginPath();p.arc(x,y,.8,0,Math.PI*2);p.fill();}
  p.strokeStyle='#bfc5b3';p.lineWidth=1;p.beginPath();p.moveTo(0,178);p.lineTo(360,178);p.stroke();
  p.save();p.translate(0,178-engine.vessel.BOTTLE_FLOOR);for(const b of previewEngine.blobs)drawBlob(b,1,p);p.restore();
  if(previewAge>4)resetPreview();
}
new ResizeObserver(fitJar).observe(document.querySelector('.jar-wrap'));
new ResizeObserver(resize).observe(canvas);
function frame(now){
  const elapsed=Math.min(.05,Math.max(0,(now-lastTime)/1000));lastTime=now;
  if(playable()){
    accumulator+=elapsed;
    while(accumulator>=1/120){
      const events=engine.step(1/120);accumulator-=1/120;
      for(const event of events){
        const b=event.blob;pop(b.level);
        if(!reducedMotion)for(let k=0;k<10;k++){const angle=k*Math.PI/5;particles.push({x:b.x,y:b.y,vx:Math.cos(angle)*90,vy:Math.sin(angle)*90-40,life:.6,level:b.level});}
        if(b.level>highestSeen){highestSeen=b.level;if(b.level===MAX_LEVEL)toast(`${engine.value(MAX_LEVEL).toLocaleString()}! A pocketful of possibility.`);}
      }
      if(events.length){best=Math.max(best,recordScore(engine));achievements.observe(engine,best);updateHUD();}
      if(engine.over){if(engine.endReason==='spill'){cancelAim();updateHUD();save();}else finish();break;}
    }
    for(const p of particles){p.life-=elapsed;p.x+=p.vx*elapsed;p.y+=p.vy*elapsed;p.vy+=150*elapsed;}
    particles=particles.filter(p=>p.life>0).slice(-150);
    saveElapsed+=elapsed;if(saveElapsed>2){save();saveElapsed=0;}
  }else accumulator=0;
  if(engine.over&&engine.endReason==='spill'&&!endedShown){engine.animateSpill(elapsed);spillReveal+=elapsed;if(spillReveal>=.7)finish();}
  const moving=rackMotion.busy;
  if(playable()){dragMotion.update(elapsed);rackMotion.setHeldPose({sx:1,sy:1,tilt:0});rackMotion.setPhysics(engine.physics,engine.mergeMode);rackMotion.update(elapsed);resolvePreparationContacts();
    for(const burst of rackMotion.takeMergeBursts())if(!reducedMotion)spawnRackBurst(burst);
    updateRackBursts(elapsed);
  }
  if(moving&&!rackMotion.busy)updateHUD();
  if(playable()){
    if(fireGesture&&!fireGesture.manual){power=Math.min(1,(now-fireGesture.start)/1100);updateAimUI();}
    updateShootAvailability();
  }
  drawPhysicsPreview(elapsed);
  if(page==='game')draw(elapsed);requestAnimationFrame(frame);
}
function showSavedState(){
  if(engine.over&&started)finish();
  else if(started)showOverlay({kicker:'WELCOME BACK, LITTLE DAYDREAMER',title:'Right where<br>you left it.',description:'Your little pile missed you.',button:'Keep squishing',action:resume,secondary:'Start a fresh game',secondaryAction:()=>{$('reset-dialog').showModal();},footnote:'SAVED IN THIS BROWSER.',friends:true,stats:true});
  else $('start').onclick=newGame;
}
function resetVisuals(){
  endedShown=false;spillReveal=0;highestSeen=engine.highestLevel;particles=[];rackRings=[];rackSparks=[];accumulator=0;aimAngle=0;
  rackMotion.setBottle(engine.bottleId);rackMotion.setPhysics(engine.physics,engine.mergeMode);rackMotion.reset(engine.rackOrder());
}
function abandonRound(){
  cancelAim();
  if(gameMode==='multiplayer'){
    try{if(currentMatchKey)localStorage.removeItem(`squish-pocket-match:${currentMatchKey}`);}catch{}
    activeRoom=null;currentMatchKey='';shownResult='';gameMode='classic';
  }
  const physics=engine.physics,id=engine.bottleId;
  engine=new Engine(undefined,id,activeRule.id);engine.setPhysics(physics);
  started=false;paused=false;endedShown=false;particles=[];rackRings=[];rackSparks=[];overlay.classList.add('hidden');
  resetVisuals();save();updateHUD();
}
function enterClassic(id){
  cancelAim();if(gameMode==='classic')save();gameMode='classic';activeRoom=null;currentMatchKey='';restoreBottle(id);
  best=Math.max(best,recordScore(engine),achievements.profile.score);resetVisuals();
  try{localStorage.setItem(selectedBottleKey(),id);}catch{}
  if(!started||engine.over)newGame();else resume();
  updateHUD();save();
  if(!recordEligible(engine))toast('Old saved pile · start a fresh round for the new Three Combine boards.');
}
function enterMatch(room,connected){
  const key=`${room.code}:${room.round}`;
  if(currentMatchKey!==key||gameMode!=='multiplayer'){
    cancelAim();if(gameMode==='classic')save();gameMode='multiplayer';activeRoom=room;currentMatchKey=key;shownResult='';
    engine=new Engine(room.seed,room.bottleId,room.mergeMode??'two');engine.setPhysics(defaultPhysicsFor(engine.bottleId));
    let restoredSave=false;
    try{
      const data=JSON.parse(localStorage.getItem(`squish-pocket-match:${key}`));
      if(data?.round===room.round&&data.seed===room.seed){const restored=Engine.restore(data.engine);if(restored?.bottleId===room.bottleId&&restored.mergeMode===(room.mergeMode??'two')){engine=restored;engine.setPhysics(defaultPhysicsFor(engine.bottleId));restoredSave=true;}}
    }catch{}
    started=true;resetVisuals();
    if(!restoredSave){rackMotion.reset([]);rackMotion.play(engine.rackEvents,engine.rackOrder());}
  }
  activeRoom=room;roomConnected=connected;paused=false;overlay.classList.add('hidden');
  if(room.players[room.you].status==='finished'||engine.over){
    engine.over=true;
    if(!endedShown)finish();else showMatchOverlay();
  }
  updateHUD();save();
}
function updateMatch(room,connected){
  activeRoom=room;roomConnected=connected;
  if(gameMode!=='multiplayer'||currentMatchKey!==`${room.code}:${room.round}`)return;
  if(room.phase==='finished'&&page==='game'){
    paused=true;cancelAim();best=Math.max(best,recordEligible(engine)?room.players[room.you].score:0);save();
    const key=`${room.code}:${room.round}`;
    if(shownResult!==key){shownResult=key;showOverlay({kicker:'MATCH COMPLETE',title:'A lovely little match.',description:shell.resultTitle(room),button:'Back to the room',action:()=>shell.showRoom(),friends:true,stats:true});}
  }
  updateHUD();
}
function switchMergeMode(mode){
  if(mode===activeRule.id)return {bottleId:engine.bottleId,profile:achievements.profile};
  save();cancelAim();
  activeRule=ruleFor(mode);best=0;gameMode='classic';activeRoom=null;
  currentMatchKey='';shownResult='';roomConnected=false;
  restoreBottle(savedBottle());
  achievements.setMode(activeRule.id);
  best=Math.max(best,recordScore(engine),achievements.profile.score);
  previewEngine=null;overlay.classList.add('hidden');resetVisuals();renderEvolution();updateHUD();
  return {bottleId:engine.bottleId,profile:achievements.profile};
}
shell=createStartPage({
  initialBottle:engine.bottleId,profile:achievements.profile,cancelAim,showSavedState,switchMergeMode,
  classicStatus:id=>{try{const data=JSON.parse(localStorage.getItem(saveKey(id)));return data?.started===true&&!data.engine?.over;}catch{return false;}},
  onPage:next=>{page=next;dragCanvas.style.display=page==='game'?'':'none';},
  onShown:()=>{fitJar();resize();updateHUD();},
  suspend:()=>{cancelAim();paused=started;save();updateHUD();},
  abandonRound,
  enterClassic,enterMatch,updateMatch,
  finishRound:()=>{if(gameMode==='multiplayer'&&!engine.over){engine.over=true;engine.endReason=null;finish();}},
  getProgress:room=>{
    if(gameMode!=='multiplayer'||!room||currentMatchKey!==`${room.code}:${room.round}`)return null;
    save();return {round:room.round,score:engine.score,shots:engine.shots,highestTile:engine.value(engine.highestLevel),done:engine.over,paused:paused||page!=='game',blobs:engine.blobs.slice(0,90).map(b=>({level:b.level,x:Math.round(b.x*10)/10,y:Math.round(b.y*10)/10}))};
  }
});
onLanguageChange(()=>{cancelAim();updateHUD();renderEvolution();if($('settings-dialog').open)resetPreview();if(!overlay.classList.contains('hidden')&&overlayCopy)showOverlay(overlayCopy);$('toast').textContent=t(lastToast);document.title=t('Squish Pocket — a little room to play');});
mountLanguagePicker();updateHUD();requestAnimationFrame(frame);
