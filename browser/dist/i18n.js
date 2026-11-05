import zh from './i18n-zh.js?v=89';
export const LANGUAGE_KEY='squish-pocket-language-v1';
export function readLanguage(storage){
  try{return (storage??globalThis.localStorage).getItem(LANGUAGE_KEY)==='en'?'en':'zh-CN';}catch{return 'zh-CN';}
}
let language=readLanguage(),mounted=false;
const listeners=new Set(),staticText=new Map(),staticAttributes=new Map(),staticHTML=new Map();
export const getLanguage=()=>language;
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=Object.entries(zh).filter(([s])=>s.includes('{')).map(([source,target])=>{
  const names=[],parts=[];let end=0;
  for(const m of source.matchAll(/\{(\w+)\}/g)){
    parts.push(escape(source.slice(end,m.index)));names.push(m[1]);
    parts.push(m[1]==='mode'?'(Two Combine|Three Combine|Lab)':m[1]==='count'||m[1]==='power'||m[1]==='size'?'([\\d,.]+)':'(.+?)');end=m.index+m[0].length;
  }
  parts.push(escape(source.slice(end)));return {regex:new RegExp('^'+parts.join('')+'$'),names,target,specificity:source.replace(/\{\w+\}/g,'').length};
}).sort((a,b)=>b.specificity-a.specificity);
export function translate(source,lang=language,params){
  const value=String(source??'');if(lang==='en')return params?value.replace(/\{(\w+)\}/g,(_,k)=>String(params[k]??'')):value;
  const lead=value.match(/^\s*/)[0],tail=value.match(/\s*$/)[0],key=value.trim();
  if(!/[A-Za-z]/.test(key))return value;
  let result=zh[key];
  if(result!==undefined&&params)result=result.replace(/\{(\w+)\}/g,(_,k)=>String(params[k]??''));
  if(result===undefined)for(const {regex,names,target} of patterns){
    const match=key.match(regex);if(!match)continue;
    result=target.replace(/\{(\w+)\}/g,(_,name)=>{const v=match[names.indexOf(name)+1]??'';return ['mode','bottle','state','description','action','item'].includes(name)?translate(v,lang):v;});break;
  }
  return result===undefined?value:lead+result+tail;
}
const translationCache=new Map();
export function t(source,params){
  if(params)return translate(source,language,params);
  const key=String(source??'');if(translationCache.has(key))return translationCache.get(key);
  const value=translate(key,language);if(translationCache.size>=2048)translationCache.clear();translationCache.set(key,value);return value;
}
export const onLanguageChange=callback=>{listeners.add(callback);return ()=>listeners.delete(callback);};

// Capture only application-owned static copy, before names/records are rendered.
// Dynamic text uses t() explicitly; player-authored names never enter this cache.
export function captureTranslations(root){
  if(!root||typeof document==='undefined')return;
  for(const element of [root,...root.querySelectorAll('*')]){
    if(element.closest('[data-i18n-skip],script,style'))continue;
    if(element.hasAttribute('data-i18n-html')&&!staticHTML.has(element))staticHTML.set(element,element.innerHTML);
    for(const name of ['title','aria-label','aria-valuetext','placeholder'])if(element.hasAttribute(name)){
      let attrs=staticAttributes.get(element);if(!attrs){attrs=new Map();staticAttributes.set(element,attrs);}
      if(!attrs.has(name))attrs.set(name,element.getAttribute(name));
    }
  }
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode()))if(!node.parentElement.closest('[data-i18n-skip],[data-i18n-html],script,style')&&!staticText.has(node)&&/[A-Za-z]/.test(node.data))staticText.set(node,node.data);
}
export function applyTranslations(){
  if(typeof document==='undefined')return;
  document.documentElement.lang=language;
  for(const [node,source] of staticText){if(node.isConnected)node.data=t(source);else staticText.delete(node);}
  for(const [node,attrs] of staticAttributes)if(node.isConnected)for(const [name,source] of attrs)node.setAttribute(name,t(source));
  for(const [node,source] of staticHTML)if(node.isConnected)node.innerHTML=t(source);
  const select=document.getElementById('language-select');
  if(select){
    select.value=language;
    if(select.tagName==='BUTTON'){
      const label=t(language==='en'?'Switch to Chinese':'Switch to English');select.setAttribute('aria-label',label);select.title=label;
      for(const item of select.querySelectorAll('[data-language-label]'))item.classList.toggle('is-current',item.dataset.languageLabel===language);
    }
  }
}
export function translateTree(root){captureTranslations(root);if(mounted)applyTranslations();}
export function setLanguage(next){
  language=next==='en'?'en':'zh-CN';translationCache.clear();try{localStorage.setItem(LANGUAGE_KEY,language);}catch{}
  applyTranslations();for(const listener of listeners)listener(language);
}
export function mountLanguagePicker(){
  mounted=true;applyTranslations();document.title=t('Squish Pocket — a little room to play');const select=document.getElementById('language-select');
  if(select){if(select.tagName==='BUTTON')select.onclick=()=>setLanguage(language==='en'?'zh-CN':'en');else select.onchange=()=>setLanguage(select.value);}
}
if(typeof document!=='undefined'&&document.body)captureTranslations(document.body);
