// Safari may still infer a double-tap gesture when a control becomes disabled
// between taps. Keep Shoot enabled, and cancel its native touch-end default.
export function installShootTouchGuard(button){
  const document=button.ownerDocument,ids=new Set();
  const inside=event=>event.target===button||button.contains(event.target);
  const start=event=>{if(inside(event))for(const touch of event.changedTouches)ids.add(touch.identifier);};
  const end=event=>{
    let guarded=inside(event);
    for(const touch of event.changedTouches){if(ids.has(touch.identifier))guarded=true;ids.delete(touch.identifier);}
    if(guarded&&event.cancelable)event.preventDefault();
  };
  const cancel=event=>{for(const touch of event.changedTouches)ids.delete(touch.identifier);};
  document.addEventListener('touchstart',start,{capture:true,passive:true});
  document.addEventListener('touchend',end,{capture:true,passive:false});
  document.addEventListener('touchcancel',cancel,{capture:true,passive:true});
  return ()=>{document.removeEventListener('touchstart',start,true);document.removeEventListener('touchend',end,true);document.removeEventListener('touchcancel',cancel,true);};
}
