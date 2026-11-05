import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLanguage,translate,setLanguage,t,onLanguageChange,LANGUAGE_KEY} from '../dist/i18n.js';

test('Chinese is the default, English is remembered, invalid or unavailable storage falls back to Chinese',()=>{
 assert.equal(readLanguage({getItem:()=>null}),'zh-CN');assert.equal(readLanguage({getItem:()=>''}),'zh-CN');
 assert.equal(readLanguage({getItem:()=> 'en'}),'en');assert.equal(readLanguage({getItem:()=> 'unknown'}),'zh-CN');
 assert.equal(readLanguage({getItem(){throw new Error('blocked');}}),'zh-CN');
});
test('static and dynamic translations preserve values, player names and room codes',()=>{
 assert.equal(translate('Start game','zh-CN'),'开始游戏');assert.equal(translate('Start game','en'),'Start game');
 assert.equal(translate('FORCE 50% · RELEASE TO SHOOT','zh-CN'),'力度 50% · 松开发射');
 assert.equal(translate('Rejoin room ABC234','zh-CN'),'重新加入房间 ABC234');
 assert.equal(translate('Classic wins this one.','zh-CN'),'Classic 赢得了这一局。');
 assert.equal(translate('Classic · highest score','zh-CN'),'Classic · 最高分');
 assert.equal(translate('Three Combine · Every 2,187 starts with a tiny one.','zh-CN'),'三合一 · 每一个 2,187，都从小小的 1 开始。');
 assert.equal(translate('Three Combine · Three-neck flask top five scores','zh-CN'),'三合一 · 三颈烧瓶前五名成绩');
 assert.equal(translate(' · you','zh-CN'),' · 你');assert.equal(translate(' · host','zh-CN'),' · 房主');
 assert.equal(translate('2048','zh-CN'),'2048');assert.equal(translate('玩家自定义名字','en'),'玩家自定义名字');
});
test('language changes persist and notify views without touching game/profile storage',tst=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map([['squish-pocket-v1','round'],['squish-pocket-achievements-v1','profile']]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}});
 tst.after(()=>{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;setLanguage('zh-CN');});
 const events=[],remove=onLanguageChange(lang=>events.push(lang));
 setLanguage('en');assert.equal(t('Start game'),'Start game');assert.equal(values.get(LANGUAGE_KEY),'en');
 setLanguage('zh-CN');assert.equal(t('Start game'),'开始游戏');assert.deepEqual(events,['en','zh-CN']);remove();
 assert.equal(values.get('squish-pocket-v1'),'round');assert.equal(values.get('squish-pocket-achievements-v1'),'profile');
});
