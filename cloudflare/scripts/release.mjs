import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {FLASK_RECORD_EPOCH,THREE_RECORD_EPOCH} from '../../browser/dist/record-epoch.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const workerRoot=resolve(root,'cloudflare');
const receiptPath=resolve(root,'.releases/test-release.json');
const targets={
  test:{config:'wrangler.test.jsonc',worker:'squish-pocket-test',url:'https://squish-test.chemisgreat.online'},
  production:{config:'wrangler.jsonc',worker:'squish-pocket',url:'https://squish.chemisgreat.online'}
};
function files(directory){
  return readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(directory,e.name)):[resolve(directory,e.name)]).sort();
}
export function sourceDigest(){
  const inputs=[...files(resolve(root,'browser/dist')),...files(resolve(workerRoot,'migrations')),
    ...files(resolve(workerRoot,'scripts')), ...readdirSync(workerRoot).filter(n=>n.endsWith('.js')||/^wrangler.*\.jsonc$/.test(n)||n.startsWith('package')).map(n=>resolve(workerRoot,n))].sort();
  const hash=createHash('sha256');
  for(const path of inputs)hash.update(relative(root,path)+'\0').update(readFileSync(path)).update('\0');
  return hash.digest('hex');
}
export function requireTestedCandidate(receipt,digest,version){
  if(!receipt?.verified||receipt.worker!==targets.test.worker||receipt.url!==targets.test.url)
    throw new Error('Publish and verify a test release first: npm run deploy:test.');
  if(!version||version!==receipt.version)throw new Error('Pass the tested version explicitly: --tested-version '+receipt.version);
  if(receipt.sourceDigest!==digest)throw new Error('Source changed since the test release. Publish and verify it on test again before promotion.');
}
export function assertIsolatedTargets(){
  const official=JSON.parse(readFileSync(resolve(workerRoot,targets.production.config)));
  const test=JSON.parse(readFileSync(resolve(workerRoot,targets.test.config)));
  if(test.name!==targets.test.worker||official.name!==targets.production.worker||
      test.d1_databases[0].database_id===official.d1_databases[0].database_id||
      test.d1_databases[0].database_name!=='squish-pocket-achievements-test'||
      test.routes[0].pattern!==new URL(targets.test.url).hostname||
      official.routes[0].pattern!==new URL(targets.production.url).hostname||
      test.assets.directory!==official.assets.directory||test.vars.EMAIL_ENABLED!=='false'||
      test.durable_objects.bindings.some(b=>b.script_name))throw new Error('Test and official resources must remain isolated; inspect the Wrangler configurations.');
}
function run(args,cwd=workerRoot){
  const result=spawnSync(process.execPath,args,{cwd,env:process.env,encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.stderr)process.stderr.write(result.stderr);
  if(result.error||result.status!==0)throw new Error(result.error?.message??`Command failed: ${args.join(' ')}`);
  return result.stdout;
}
async function verifySite(target,digest){
  const assets=files(resolve(root,'browser/dist'));
  // Match every published asset to this source, rather than trusting HTTP 200.
  for(let start=0;start<assets.length;start+=6)await Promise.all(assets.slice(start,start+6).map(async path=>{
    const name=relative(resolve(root,'browser/dist'),path).split('/').map(encodeURIComponent).join('/');
    const url=name==='index.html'?target.url+'/':target.url+'/'+name;
    const response=await fetch(url+'?release='+digest,{signal:AbortSignal.timeout(30000)});
    if(!response.ok||!Buffer.from(await response.arrayBuffer()).equals(readFileSync(path)))throw new Error(`Published asset does not match: ${name}`);
  }));
  const response=await fetch(target.url+'/api/achievements',{signal:AbortSignal.timeout(30000)});
  const summary=await response.json();
  const boards=[summary,...Object.values(summary.bottles??{})];
  const validTotals=s=>Number.isSafeInteger(s.totalMilestones)&&s.totalMilestones>=0&&Number.isSafeInteger(s.milestoneTrackingSince)&&s.milestoneTrackingSince>0;
  if(!validTotals(summary))throw new Error('The milestone total is not ready.');
  if(!boards.every(board=>Array.isArray(board.leaderboard)&&board.leaderboard.length<=5&&board.leaderboard.every((row,i)=>row.rank===i+1&&row.score>0)))throw new Error('The top-five achievement boards are not ready.');
  if(!response.ok||!['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water'].every(id=>summary.bottles?.[id])||summary.bottles['lab-flask'].recordEpoch!==FLASK_RECORD_EPOCH)throw new Error('The deployed achievement API is not ready.');
  const tripleResponse=await fetch(target.url+'/api/achievements?merge=three',{signal:AbortSignal.timeout(30000)}),triple=await tripleResponse.json();
  if(!validTotals(triple))throw new Error('The Three Combine milestone total is not ready.');
  if(!tripleResponse.ok||triple.achievementEpoch!==THREE_RECORD_EPOCH||triple.announcement?.expiresAt-triple.announcement?.publishedAt!==172800000||triple.mergeMode!=='three'||triple.milestone!==2187||!Array.isArray(triple.leaderboard)||!Object.keys(summary.bottles).every(id=>Array.isArray(triple.bottles?.[id]?.leaderboard)))throw new Error('The Three Combine boards are not ready.');
}
async function main(){
  const channel=process.argv[2]??'test';
  if(channel==='status'){
    let receipt;try{receipt=JSON.parse(readFileSync(receiptPath));}catch{console.log('No verified test release recorded yet.');return;}
    console.log(JSON.stringify({...receipt,sourceMatches:receipt.sourceDigest===sourceDigest()},null,2));return;
  }
  if(channel==='verify-test'){
    const receipt=JSON.parse(readFileSync(receiptPath));
    if(!receipt.version||receipt.worker!==targets.test.worker||receipt.sourceDigest!==sourceDigest())throw new Error('No matching published test candidate is available to verify.');
    await verifySite(targets.test,receipt.sourceDigest);
    writeFileSync(receiptPath,JSON.stringify({...receipt,verified:true,verifiedAt:new Date().toISOString()},null,2)+'\n');
    console.log(`Verified test release ${receipt.version} at ${targets.test.url}/`);return;
  }
  if(!targets[channel])throw new Error('Choose test, production, status, or verify-test.');
  assertIsolatedTargets();
  const target=targets[channel],digest=sourceDigest();
  if(channel==='production'){
    let receipt;try{receipt=JSON.parse(readFileSync(receiptPath));}catch{}
    const index=process.argv.indexOf('--tested-version');
    requireTestedCandidate(receipt,digest,index<0?null:process.argv[index+1]);
    await verifySite(targets.test,digest);
  }else{
    // Invalidate an older verification before attempting a newer candidate.
    mkdirSync(dirname(receiptPath),{recursive:true});
    writeFileSync(receiptPath,JSON.stringify({verified:false,sourceDigest:digest,worker:target.worker,url:target.url},null,2)+'\n');
    run(['--test',...files(resolve(root,'browser/tests')).filter(p=>p.endsWith('.test.js'))],resolve(root,'browser'));
    run(['--test',...files(resolve(workerRoot,'tests')).filter(p=>p.endsWith('.test.js'))]);
    run([resolve(workerRoot,'node_modules/vitest/vitest.mjs'),'run']);
  }
  console.log(`Publishing ${channel}: ${target.url} (${target.worker})`);
  const wrangler=resolve(workerRoot,'node_modules/wrangler/bin/wrangler.js');
  run([wrangler,'d1','migrations','apply','ACHIEVEMENTS','--remote','--config',target.config]);
  const output=run([wrangler,'deploy','--config',target.config,'--message',`${channel} release ${digest.slice(0,12)}`]);
  const version=output.match(/Current Version ID:\s*([a-f0-9-]+)/i)?.[1];
  if(!version)throw new Error('Wrangler did not return a deployed version ID.');
  if(channel==='test')writeFileSync(receiptPath,JSON.stringify({verified:false,worker:target.worker,url:target.url,version,sourceDigest:digest},null,2)+'\n');
  await verifySite(target,digest);
  if(sourceDigest()!==digest)throw new Error('Source changed during publication. Test it again before promotion.');
  const receipt={verified:true,worker:target.worker,url:target.url,version,sourceDigest:digest,verifiedAt:new Date().toISOString()};
  mkdirSync(dirname(receiptPath),{recursive:true});
  writeFileSync(channel==='test'?receiptPath:resolve(root,'.releases/production-release.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(`Verified ${channel} release ${version} at ${target.url}/`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
