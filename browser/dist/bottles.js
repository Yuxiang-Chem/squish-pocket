import * as original from './bottle.js?v=34';
import {labFlask} from './lab-flask.js?v=34';
export const BOTTLES=Object.freeze({classic:Object.freeze({id:'classic',name:'Original bottle',...original}),'lab-flask':labFlask});
export const bottleFor=id=>Object.hasOwn(BOTTLES,id)?BOTTLES[id]:BOTTLES.classic;
export const isBottleId=id=>Object.hasOwn(BOTTLES,id);
