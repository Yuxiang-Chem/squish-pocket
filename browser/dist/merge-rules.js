export const RULES=Object.freeze({
  two:Object.freeze({id:'two',name:'Two Combine',count:2,start:2,base:2,milestone:2048,maxValue:4096,spawnLevels:5}),
  three:Object.freeze({id:'three',name:'Three Combine',count:3,start:1,base:3,milestone:2187,maxValue:177147,spawnLevels:3})
});
export const ruleFor=mode=>RULES[mode==='three'?'three':'two'];
export const CURRENT_RULE=ruleFor(typeof location==='undefined'?'two':new URL(location.href).searchParams.get('merge'));
export const valueFor=(level,mode='two')=>{const r=ruleFor(mode);return r.start*r.base**level;};
export function validValue(value,mode='two'){
  const r=ruleFor(mode);if(!Number.isSafeInteger(value)||value<r.start||value>r.maxValue)return false;
  while(value>r.start&&value%r.base===0)value/=r.base;return value===r.start;
}
export const profileKeyFor=mode=>'squish-pocket-achievements-v1'+(mode==='three'?':three':'');
export const saveKeyFor=(id,mode='two')=>'squish-pocket-v1'+(mode==='three'?':three':'')+(id==='classic'?'':':'+id);
// Select connected triples, consuming each blob at most once. A touching chain
// counts; a pair alone or a nearby disconnected third blob does not.
export function connectedTriples(blobs,edges){
  const eligible=new Set(blobs.filter(b=>!b.spilled&&!b.fuse&&b.level<11)),neighbors=new Map([...eligible].map(b=>[b,new Set()]));
  for(const [a,b] of edges)if(eligible.has(a)&&eligible.has(b)&&a.level===b.level){neighbors.get(a).add(b);neighbors.get(b).add(a);}
  const groups=[];
  for(const start of blobs){
    if(!eligible.has(start))continue;
    const queue=[start],seen=new Set(queue),group=[];
    while(queue.length&&group.length<3){const b=queue.shift();if(!eligible.has(b))continue;group.push(b);for(const n of neighbors.get(b))if(eligible.has(n)&&!seen.has(n)){seen.add(n);queue.push(n);}}
    if(group.length===3){groups.push(group);for(const b of group)eligible.delete(b);}
  }
  return groups;
}
