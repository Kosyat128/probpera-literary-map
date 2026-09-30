import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
const root='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const real='D:/CodexProjects/Работа по сайту/literary-planet-v12-work';
const base='D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94';
const folder=base+'/s15-booky-context-provenance-refresh-rev6-review',draft=folder+'/draft-a2',out=folder+'/actual-a1';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const save=async(n,v)=>fs.writeFile(out+'/'+n,typeof v==='string'?v:json(v),{flag:'wx'});
const git=a=>execFileSync('git',['-c','safe.directory='+root,'-c','safe.directory='+real,'-c','core.whitespace=cr-at-eol',...a],{cwd:root,windowsHide:true,maxBuffer:64*1024*1024}).toString('utf8').trim();
process.chdir(root);
Object.assign(process.env,{GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:root,GIT_CONFIG_KEY_1:'safe.directory',GIT_CONFIG_VALUE_1:real});
const [mode,expectedHead]=process.argv.slice(2);
assert.ok(['apply-check','commit'].includes(mode));assert.match(expectedHead,/^[a-f0-9]{40}$/u);assert.equal(git(['rev-parse','HEAD']),expectedHead);assert.equal(git(['diff','--cached','--name-only']),'');
const binding=await ref(draft+'/source-bindings.json');assert.equal(binding.sha256,'7a27fa8e149a5db4a20fd5d6b58b78e1a8ec64fc98b2272ff4948491a3816fe3');const b=await read(binding.path);
const beforeRef=await ref(base+'/s15-booky-reader-foreground-review/runtime-source-manifest-a3.json');assert.equal(beforeRef.sha256,'c785a629ec20371617288bc2edeafbb672a1a3fdb09b9c81466797623b45b1db');
const manifest=await read(beforeRef.path),paths=b.proposals.map(p=>p.path).sort();
assert.equal(git(['log','-1','--format=%H','--','src/host/PlanetMascotControls.tsx']),'5c66d6aa0061fe915e6c8fa6ef23fc6b1664a63c');
const checkpointPath=root+'/docs/mobile/evidence/S15/booky-reader-foreground-20260930/result.json',checkpoint=await read(checkpointPath);assert.equal(checkpoint.pass,true);assert.equal(checkpoint.sourceCommit,b.contextSource.sourceCommit);
async function verify(after){for(const pin of manifest.files){const changed=b.proposals.find(p=>p.path===pin.path);assert.equal(sha(await fs.readFile(root+'/'+pin.path)),after&&changed?changed.sha256:pin.sha256,pin.path);}}
async function run(name,args){const began=Date.now(),logs={stdout:[],stderr:[]};const exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});for(const stream of Object.keys(logs))child[stream].on('data',bytes=>logs[stream].push(bytes));child.once('error',reject);child.once('close',resolve);});const execution={command:[process.execPath,...args],exitCode,durationMs:Date.now()-began};for(const stream of Object.keys(logs)){const p=out+'/'+name+'-'+stream+'.log';await fs.writeFile(p,Buffer.concat(logs[stream]),{flag:'wx'});execution[stream]=await ref(p);}await save(name+'-execution.json',execution);assert.equal(exitCode,0,name+' failed');return Buffer.concat(logs.stdout).toString('utf8');}
if(mode==='apply-check'){
 assert.equal(git(['status','--porcelain','--untracked-files=all']),'');await verify(false);await assert.rejects(fs.stat(out),{code:'ENOENT'});
 const prepared=[];for(const p of b.proposals){assert.equal(sha(await fs.readFile(root+'/'+p.path)),p.beforeSha256);const bytes=await fs.readFile(draft+'/'+p.proposed);assert.equal(sha(bytes),p.sha256);prepared.push({p,bytes});}
 await fs.mkdir(out);await save('before.json',{head:expectedHead,checkpoint:await ref(checkpointPath),binding,beforeSourceManifest:beforeRef,producer:await ref(folder+'/apply-check-commit-a2.mjs')});
 for(const {p,bytes} of prepared)await fs.writeFile(root+'/'+p.path,bytes);await verify(true);
 const current={...manifest,checkpoint:expectedHead,files:manifest.files.map(p=>{const q=b.proposals.find(q=>q.path===p.path);return q?{...p,sha256:q.sha256}:p;})};await save('source-manifest.json',current);await save('apply.json',{pass:true,changedPaths:paths,sourceManifest:await ref(out+'/source-manifest.json'),checksRun:false});
 await run('unit',['node_modules/vitest/vitest.mjs','run','--config='+draft+'/unit.config.mjs','--reporter=json','--outputFile='+out+'/vitest.json']);
 const units=await read(out+'/vitest.json');assert.equal(units.numPassedTests,17);assert.equal(units.numFailedTests,0);assert.equal(units.numPendingTests,0);assert.equal(units.success,true);
 const text=await run('inventory',[real+'/scripts/mobile/verify-booky-navigation-drafts.mjs']);const audit=JSON.parse(text);assert.equal(audit.pass,true);assert.equal(audit.combinedDraftCount,34);assert.equal(audit.approvedCount,0);assert.equal(audit.availableAdultCount,0);assert.equal(audit.availableChildCount,0);await save('inventory.json',audit);await verify(true);
 await save('result.json',{pass:true,predecessorDocsCommit:expectedHead,contextRuntimeCommit:b.contextSource.sourceCommit,contextSource:b.contextSource,sourceManifest:await ref(out+'/source-manifest.json'),binding,changedPaths:paths,unit:{result:await ref(out+'/vitest.json'),execution:await ref(out+'/unit-execution.json'),passed:17},inventory:{result:await ref(out+'/inventory.json'),execution:await ref(out+'/inventory-execution.json')},staticRerun:false,browserRerun:false,buildsRerun:false,approvedCount:0,availableAdultCount:0,availableChildCount:0,stageAccepted:false,releaseReady:false});console.log(json({pass:true,units:17,inventory:true,sourceCommitPending:true}));
}else{
 const result=await read(out+'/result.json');assert.equal(result.pass,true);assert.equal(result.predecessorDocsCommit,expectedHead);await verify(true);assert.deepEqual(git(['diff','--name-only']).split(/\r?\n/u).filter(Boolean).sort(),paths);assert.equal(git(['ls-files','--others','--exclude-standard']),'');git(['diff','--check']);git(['add','--',...paths]);assert.deepEqual(git(['diff','--cached','--name-only']).split(/\r?\n/u).filter(Boolean).sort(),paths);git(['commit','-m','chore(booky): refresh contextual source provenance']);const commit=git(['rev-parse','HEAD']);assert.equal(git(['rev-parse',commit+'^']),expectedHead);await verify(true);assert.equal(git(['status','--porcelain','--untracked-files=all']),'');await save('source-commit.json',{pass:true,sourceCommit:commit,predecessorDocsCommit:expectedHead,changedPaths:paths,sourceInputsUnchanged:true,result:await ref(out+'/result.json')});console.log(json({pass:true,sourceCommit:commit,changedPaths:paths}));
}
