export const RACK_SIZE=3,MAX_SPAWN_LEVEL=4;
// Middle/neighbor matches always cascade. Equal outer values remain separated.
export const hasMatchingNeighbors=items=>items.some((b,i)=>i>0&&b.level===items[i-1].level);
export function refillRack(state,nextIncoming,maxLevel=11){
  const events=[],count=state.rules?.count??2;
  let previousSelection=state.selectedId;
  for(let safety=0;safety<128;safety++){
    let pair=null;
    for(let i=0;i<=state.rack.length-count;i++){
      if(state.rack[i].level<maxLevel&&state.rack.slice(i,i+count).every(b=>b.level===state.rack[i].level)){pair=Array.from({length:count},(_,j)=>i+j);break;}
    }
    if(pair){
      const i=pair[0],sources=pair.map(j=>state.rack[j]),a=sources[0],result={id:++state.rackSerial,level:a.level+1};
      const before=state.rack.map(b=>({...b}));
      state.rack.splice(i,count,result);
      if(sources.some(b=>b.id===previousSelection))previousSelection=result.id;
      events.push({kind:'merge',level:result.level,id:result.id,from:sources.map(b=>b.id),before,after:state.rack.map(b=>({...b}))});
      continue;
    }
    if(state.rack.length===RACK_SIZE){
      // Two capped values cannot double again; keep them on the outer sides.
      if(count===2&&hasMatchingNeighbors(state.rack)){
        const middle=state.rack.find(b=>b.level!==maxLevel),capped=state.rack.filter(b=>b.level===maxLevel);
        if(middle&&capped.length===2){
          const before=state.rack.map(b=>({...b}));state.rack=[capped[0],middle,capped[1]];
          events.push({kind:'shift',before,after:state.rack.map(b=>({...b}))});
        }
      }
      state.selectedId=state.rack.some(b=>b.id===previousSelection)?previousSelection:state.rack[1].id;
      return events;
    }
    const incoming=state.incoming,item={id:++state.rackSerial,level:incoming.level};
    const before=state.rack.map(b=>({...b}));
    if(incoming.side==='left')state.rack.unshift(item);else state.rack.push(item);
    events.push({kind:'arrive',level:item.level,id:item.id,side:incoming.side,before,after:state.rack.map(b=>({...b}))});
    state.incoming=nextIncoming();
  }
  throw new Error('Launcher refill did not converge');
}
