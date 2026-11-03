import * as original from './bottle.js?v=44';
import {labFlask} from './lab-flask.js?v=44';
import {waterBottle} from './water.js?v=44';
const classic=Object.freeze({id:'classic',name:'Original bottle',...original});
export const BOTTLES=Object.freeze({classic,'lab-flask':labFlask,
  'classic-water':waterBottle(classic,'classic-water','Original bottle · water'),
  'lab-flask-water':waterBottle(labFlask,'lab-flask-water','Three-neck flask · water')});
export const bottleFor=id=>Object.hasOwn(BOTTLES,id)?BOTTLES[id]:BOTTLES.classic;
export const isBottleId=id=>Object.hasOwn(BOTTLES,id);
