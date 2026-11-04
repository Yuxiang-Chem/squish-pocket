import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {defaultPhysicsFor,DEFAULT_PHYSICS} from '../dist/physics-settings.js';
import {RackMotion,trayRadius} from '../dist/rack-motion.js';

test('per-vessel defaults apply to both merge modes, water variants and physical ready blobs',()=>{
 for(const mode of ['two','three'])for(const [bottleId,size] of [['classic',150],['classic-water',150],['separating-funnel',100],['separating-funnel-water',100],['lab-flask',120],['lab-flask-water',120],['conical-flask',100],['conical-flask-water',100]]){
  const engine=new Engine(7,bottleId,mode),physics=defaultPhysicsFor(bottleId);
  assert.deepEqual(physics,{stiffness:10,viscosity:0,blobSize:size});assert.deepEqual(engine.physics,physics);
  assert.equal(engine.radius(0),13*size/100*engine.rules.blobScale);
  const rack=new RackMotion(true);rack.setBottle(bottleId);rack.setPhysics(engine.physics,mode);rack.reset(engine.rack);
  for(const item of rack.items)assert.equal(item.body.renderRadius,trayRadius(item.level,size*engine.rules.blobScale));
  engine.setPhysics({stiffness:75,viscosity:40,blobSize:40});engine.setPhysics(defaultPhysicsFor(bottleId));assert.deepEqual(engine.physics,physics);
 }
 assert.deepEqual(DEFAULT_PHYSICS,{stiffness:10,viscosity:0,blobSize:150});
});
