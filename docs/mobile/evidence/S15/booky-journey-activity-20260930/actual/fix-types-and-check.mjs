import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url)),root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work'),old=path.join(base,'actual-a1'),out=path.join(base,'actual-a2');
const sha=b=>createHash('sha256').update(b).digest('hex'),norm=p=>p.replaceAll('\\','/'),hash=async p=>sha(await fs.readFile(p)),ref=async p=>({path:norm(p),sha256:await hash(p)}),read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const write=async(name,v)=>{const p=path.join(out,name);await fs.writeFile(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(p);};
const env={...process.env,CI:'1',GIT_CONFIG_PARAMETERS:"'core.autocrlf=true'",BOOKY_JOURNEY_BROWSER_OUTPUT:path.join(out,'captures'),BOOKY_JOURNEY_BROWSER_REPORT:path.join(out,'browser-report.json')};
const git=args=>{const r=spawnSync('git',args,{cwd:root,env,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const oldChecks=await read(path.join(old,'checks-result.json')),m=await read(path.join(old,'source-manifest.json')),unit=await read(path.join(old,'unit-result.json'));
assert.equal(unit.pass,true);assert.deepEqual(unit.summary,{total:36,passed:36,failed:0,pending:0});
assert.equal(await hash(path.join(old,'source-manifest.json')),'25310638f37035d8b8a999f5e814702de97bc5c6eb1840e4613a3eb00e185a0f');
assert.equal(git(['rev-parse','HEAD']),oldChecks.predecessorDocsCommit);
const esbuild=createRequire(path.join(root,'package.json'))('esbuild');
const emit=(s,p)=>esbuild.transformSync(s,{loader:p.endsWith('.tsx')?'tsx':'ts',target:'es2020',jsx:'automatic'}).code;
const fixes=[
 ['apps/admin/components/BookyJourneyDraftEditor.tsx','{input.activity.choices.length > 2 &&','{input.activity!.choices.length > 2 &&'],
 ['apps/admin/lib/booky-journey-draft.test.ts','Object.assign(value.authoringSource.input.activity, { correctChoiceId: "choice-1" });','Object.assign(value.authoringSource.input.activity!, { correctChoiceId: "choice-1" });'],
 ['apps/admin/lib/booky-journey-draft.ts','? choiceCountry.writers.find(item => item?.id === choice.writerId) : undefined;','? choiceCountry.writers.find((item: JourneyDraftCatalog["countries"][number]["writers"][number]) => item?.id === choice.writerId) : undefined;'],
];
try { await fs.mkdir(out); } catch(e) { assert.equal(e.code,'EEXIST'); assert.deepEqual(await fs.readdir(out),[]); }
const proofs=[],pending=[];
for(const [relative,from,to]of fixes){const p=path.join(root,relative),before=await fs.readFile(path.join(base,'proposed',relative),'utf8');assert.equal(sha(Buffer.from(before)),m.files.find(f=>f.path===relative).sha256,relative);assert.equal(before.split(from).length,2,relative);const after=before.replace(from,to);assert.equal(sha(Buffer.from(emit(before,relative))),sha(Buffer.from(emit(after,relative))),relative);const current=await fs.readFile(p,'utf8');assert.ok(current===before||current===after,relative);pending.push({p,after});proofs.push({path:relative,beforeSha256:sha(Buffer.from(before)),afterSha256:sha(Buffer.from(after)),emittedJavaScriptSha256:sha(Buffer.from(emit(after,relative))),emittedJavaScriptIdentical:true,compiler:'esbuild',target:'es2020'});}
for(const f of m.files)if(!fixes.some(([p])=>p===f.path))assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);
for(const change of pending)await fs.writeFile(change.p,change.after);
for(const proof of proofs)m.files.find(f=>f.path===proof.path).sha256=proof.afterSha256;
const sourceManifest=await write('source-manifest.json',m),correction=await write('type-correction.json',{pass:true,originalUnit:await ref(path.join(old,'unit-result.json')),originalUnitManifest:await ref(path.join(old,'source-manifest.json')),finalManifest:sourceManifest,proofs,unitRerun:false,failedTypecheck:await ref(path.join(old,'typecheck-result.json')),producer:await ref(fileURLToPath(import.meta.url))});
const snapshot=async()=>({head:git(['rev-parse','HEAD']),status:git(['status','--porcelain=v1','--untracked-files=all']),files:await Promise.all(m.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))});
const before=await snapshot();assert.deepEqual(before.files,m.files);await write('source-before.json',before);
async function run(label,args){const stdoutPath=path.join(out,label+'.stdout.log'),stderrPath=path.join(out,label+'.stderr.log');const stdout=await fs.open(stdoutPath,'wx'),stderr=await fs.open(stderrPath,'wx'),start=Date.now();let error=null;console.log(JSON.stringify({started:label}));const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore',stdout.fd,stderr.fd]});child.once('error',e=>{error=e.message;});child.once('close',code=>resolve(code));});await stdout.close();await stderr.close();return {pass:exitCode===0&&!error,exitCode,error,durationMs:Date.now()-start,command:[process.execPath,...args],sourceManifest,stdout:await ref(stdoutPath),stderr:await ref(stderrPath)};}
const typecheck=await run('typecheck',[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(root,'apps/admin/tsconfig.json'),'--incremental','false','--pretty','false']),typeRef=await write('typecheck-result.json',typecheck);
let browser=null,browserRef=null;if(typecheck.pass){browser=await run('browser',[path.join(root,'node_modules/@playwright/test/cli.js'),'test','--config='+path.join(path.dirname(base),'s15-booky-journey-authoring-review/playwright.config.mjs')]);const report=await read(path.join(out,'browser-report.json'));browser.report=await ref(path.join(out,'browser-report.json'));browser.summary={cases:report.stats.expected+report.stats.unexpected+report.stats.skipped+report.stats.flaky,passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,flaky:report.stats.flaky};browser.pass&&=browser.summary.cases===2&&browser.summary.passed===2&&browser.summary.failed===0&&browser.summary.skipped===0&&browser.summary.flaky===0;browserRef=await write('browser-result.json',browser);}
const after=await snapshot();await write('source-after.json',after);assert.deepEqual(after,before);const result=await write('checks-result.json',{...oldChecks,pass:typecheck.pass&&browser?.pass===true,sourceManifest,sourceInputsUnchanged:true,unit:await ref(path.join(old,'unit-result.json')),unitRetainedAtOriginalManifest:true,correction,typecheck:typeRef,browser:browserRef,producer:await ref(fileURLToPath(import.meta.url))});console.log(JSON.stringify({pass:typecheck.pass&&browser?.pass===true,result,sourceManifest,correction,browserSummary:browser?.summary}));if(!(typecheck.pass&&browser?.pass===true))process.exitCode=1;
