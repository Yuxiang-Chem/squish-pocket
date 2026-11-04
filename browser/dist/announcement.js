// The release migration sets this window separately for test and official sites.
export const ANNOUNCEMENT_DURATION=48*60*60*1000;
export function announcementActive(notice,now=Date.now()){
  return !!notice&&Number.isFinite(notice.publishedAt)&&Number.isFinite(notice.expiresAt)&&
    notice.expiresAt-notice.publishedAt===ANNOUNCEMENT_DURATION&&now>=notice.publishedAt&&now<notice.expiresAt;
}
const timers=new WeakMap();
export function renderThreeAnnouncement(element,mode,notice){
  clearTimeout(timers.get(element));timers.delete(element);
  const visible=mode==='three'&&announcementActive(notice);
  element.classList.toggle('hidden',!visible);
  if(visible){
    const timer=setTimeout(()=>{element.classList.add('hidden');timers.delete(element);},notice.expiresAt-Date.now());
    timer.unref?.();timers.set(element,timer);
  }
}
let request;
export function loadThreeAnnouncement(){
  return request??=fetch('/api/achievements?merge=three',{signal:AbortSignal.timeout(12000)})
    .then(async response=>response.ok?(await response.json()).announcement:null).catch(()=>null);
}
