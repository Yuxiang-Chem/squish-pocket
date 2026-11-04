import * as original from './bottle.js?v=72';
import {labFlask} from './lab-flask.js?v=72';
import {separatingFunnel,conicalFlask} from './lab-vessels.js?v=72';
import {waterBottle} from './water.js?v=72';
const classic=Object.freeze({id:'classic',name:'Original bottle',...original});
export const BOTTLES=Object.freeze({classic,'lab-flask':labFlask,
  'classic-water':waterBottle(classic,'classic-water','Original bottle · water'),
  'lab-flask-water':waterBottle(labFlask,'lab-flask-water','Three-neck flask · water'),
  'separating-funnel':separatingFunnel,'conical-flask':conicalFlask,
  'separating-funnel-water':waterBottle(separatingFunnel,'separating-funnel-water','Separating funnel · water'),
  'conical-flask-water':waterBottle(conicalFlask,'conical-flask-water','Conical flask · water')});
export const bottleFor=id=>Object.hasOwn(BOTTLES,id)?BOTTLES[id]:BOTTLES.classic;
export const isBottleId=id=>Object.hasOwn(BOTTLES,id);
