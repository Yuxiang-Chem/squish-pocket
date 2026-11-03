import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RackMotion} from '../dist/rack-motion.js';
import {Engine} from '../dist/engine.js';
import {outlinesTouch,renderedOutline} from '../dist/preparation-contact.js';
const ready=[{id:1,level:0},{id:2,level:2},{id:3,level:0}];
function setup(physics){const m=new RackMotion();m.setPhysics(physics);m.reset(ready);m.update(1);return m;}
function engine(){const e=new Engine(123);e.rack=ready.map(b=>({...b}));e.rackSerial=3;e.selectedId=2;e.incoming={level:4,side:'left'};e.syncRack();return e;}
test('Fast swipes check both directions, every crossed blob, and edge contact without center overlap',()=>{
 for(const source of [1,3])for(const blobSize of [40,150])for(const stiffness of [0,100]){
  const m=setup({blobSize,stiffness}),target=m.visual.get(source===1?3:1),direction=source===1?1:-1;
  m.hold(source,target.x+direction*100,58);
  const contacts=m.takeContacts();assert.ok(contacts.some(p=>[p.a,p.b].includes(1)&&[p.a,p.b].includes(3)));
  assert.equal(engine().mergeRackContacts(contacts,m.activeDrags),true);
 }
});
test('A matching contact while returning merges even when the outward drag never touched it',()=>{
 for(const source of [1,3]){
  const m=setup(),origin=m.visual.get(source),target=m.visual.get(source===1?3:1),outside=target.x+(source===1?100:-100);
  m.hold(source,origin.x,-70);m.hold(source,outside,-70);m.hold(source,outside,58);
  assert.deepEqual(m.takeContacts(),[]);m.release();let contacts=[];
  for(let k=0;k<600&&!contacts.length;k++){m.update(1/120);contacts=m.takeContacts();}
  assert.ok(contacts.length);const e=engine();assert.equal(e.mergeRackContacts(contacts,m.activeDrags),true);
  assert.equal(e.shots,0);assert.equal(e.score,0);assert.equal(e.rack.length,3);
 }
});
test('Contacts persist across substeps and are deduplicated, even after a fast swipe passes completely',()=>{
 const m=setup(),target=m.visual.get(3);m.hold(1,target.x+120,58);m.hold(1,target.x+140,-40);m.release();m.update(.05);
 const events=m.takeContacts();assert.equal(events.length,1);assert.deepEqual(m.takeContacts(),[]);
 const e=engine();assert.equal(e.mergeRackContacts(events,m.activeDrags),true);assert.equal(e.mergeRackContacts(events,m.activeDrags),false);
});
test('Mismatched, stale, idle, and capped contacts do not merge or hide a later valid contact',()=>{
 const e=engine(),initial=JSON.stringify(e);
 assert.equal(e.mergeRackContacts([{a:1,b:3}]),false);assert.equal(JSON.stringify(e),initial);
 assert.equal(e.mergeRackContacts([{a:99,b:1},{a:1,b:2},{a:1,b:3}],new Set([1])),true);
 const capped=engine();capped.rack[0].level=capped.rack[2].level=11;
 assert.equal(capped.mergeRackContacts([{a:1,b:3}],[1]),false);
});
test('Resting equal sides remain separate; eligibility ends after a completed return',()=>{
 const m=setup();assert.deepEqual(m.takeContacts(),[]);assert.equal(m.activeDrags.size,0);
 m.hold(1,m.visual.get(1).x-40,-40);m.release();
 for(let k=0;k<720;k++){m.update(1/120);m.takeContacts();}
 assert.equal(m.activeDrags.size,0);m.update(1);assert.deepEqual(m.takeContacts(),[]);
});
test('Matching merge descendants retain drag intent through refill without retaining consumed IDs',()=>{
 const m=setup(),e=engine();m.hold(1,m.visual.get(3).x,58);assert.equal(e.mergeRackContacts(m.takeContacts(),m.activeDrags),true);
 const result=e.rackEvents[0].id;m.play(e.rackEvents,e.rackOrder());
 assert.equal(m.activeDrags.has(1),false);assert.equal(m.activeDrags.has(3),false);assert.equal(m.activeDrags.has(result),true);
 assert.ok([...m.activeDrags].every(id=>e.rack.some(b=>b.id===id)));
});
test('Displayed stretching is included in contact checks and never depends on stale target positions',()=>{
 const m=setup(),left=m.visual.get(1),right=m.visual.get(3);
 m.place(1,right.body.bounds.minX-(left.body.bounds.maxX-left.x)-4,58);
 assert.equal(outlinesTouch(left.body,right.body),false);
 assert.equal(outlinesTouch(renderedOutline(left.body,{sx:1.3,sy:1/1.3,tilt:0}),right.body),true);
 m.hold(1,left.x,58,{sx:1.3,sy:1/1.3,tilt:0});assert.ok(m.takeContacts().some(p=>p.a===1&&p.b===3));
});
