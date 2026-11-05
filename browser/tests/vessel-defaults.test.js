import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {defaultPhysicsFor,DEFAULT_PHYSICS,upgradeVesselDefaults,VESSEL_DEFAULTS_VERSION} from '../dist/physics-settings.js';
import {RackMotion,trayRadius} from '../dist/rack-motion.js';

test('per-vessel defaults apply to both merge modes, water variants and physical ready blobs',()=>{
 for(const mode of ['two','three'])for(const [bottleId,size] of [['classic',150],['classic-water',150],['separating-funnel',115],['separating-funnel-water',115],['lab-flask',120],['lab-flask-water',120],['conical-flask',115],['conical-flask-water',115]]){
  const engine=new Engine(7,bottleId,mode),physics=defaultPhysicsFor(bottleId);
  assert.deepEqual(physics,{stiffness:10,viscosity:0,blobSize:size});assert.deepEqual(engine.physics,physics);
  assert.equal(engine.radius(0),13*size/100*engine.rules.blobScale);
  const rack=new RackMotion(true);rack.setBottle(bottleId);rack.setPhysics(engine.physics,mode);rack.reset(engine.rack);
  for(const item of rack.items)assert.equal(item.body.renderRadius,trayRadius(item.level,size*engine.rules.blobScale));
  engine.setPhysics({stiffness:75,viscosity:40,blobSize:40});engine.setPhysics(defaultPhysicsFor(bottleId));assert.deepEqual(engine.physics,physics);
 }
 assert.deepEqual(DEFAULT_PHYSICS,{stiffness:10,viscosity:0,blobSize:150});
});


test('legacy blanket/default settings upgrade once per saved round without replacing custom settings or progress',()=>{
 for(const bottleId of ['lab-flask','lab-flask-water','conical-flask','conical-flask-water','separating-funnel','separating-funnel-water']){
  const defaults=defaultPhysicsFor(bottleId);
  assert.deepEqual(upgradeVesselDefaults({...DEFAULT_PHYSICS},bottleId),defaults);
  if(bottleId.includes('conical')||bottleId.includes('funnel'))assert.deepEqual(upgradeVesselDefaults({...DEFAULT_PHYSICS,blobSize:100},bottleId,1),defaults);
  const custom={stiffness:45,viscosity:30,blobSize:170};assert.deepEqual(upgradeVesselDefaults(custom,bottleId),custom);
  assert.deepEqual(upgradeVesselDefaults({...DEFAULT_PHYSICS},bottleId,VESSEL_DEFAULTS_VERSION),DEFAULT_PHYSICS);
  const engine=new Engine(7,bottleId,'three');engine.score=27;engine.shots=4;const run=engine.milestoneRun;engine.setPhysics(upgradeVesselDefaults({...DEFAULT_PHYSICS},bottleId));assert.equal(engine.score,27);assert.equal(engine.shots,4);assert.equal(engine.milestoneRun,run);assert.deepEqual(engine.physics,defaults);
 }
});
