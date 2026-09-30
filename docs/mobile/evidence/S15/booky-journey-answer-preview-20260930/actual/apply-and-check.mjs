// Explicit D225 application/check run; prepare externally and review before execution.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const self=fileURLToPath(import.meta.url),base=path.dirname(self),root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const predecessor='c971d09081ee0d58ba9b960ed9b743375699afc4',out=path.join(base,'actual-a1');
const paths=['apps/admin/app/(dashboard)/journeys/actions.test.ts','apps/admin/app/(dashboard)/journeys/actions.ts','apps/admin/components/BookyJourneyDraftEditor.tsx','apps/admin/lib/booky-journey-activity-validation.test.ts','apps/admin/lib/booky-journey-activity-validation.ts','tests/host/booky-journey-authoring.spec.mjs'];
const corePaths=['apps/admin/lib/booky-journey-draft.test.ts','apps/admin/lib/booky-journey-draft.ts'];
const unitFiles=['apps/admin/lib/booky-journey-activity-validation.test.ts','apps/admin/app/(dashboard)/journeys/actions.test.ts'];
const priorResult={path:'docs/mobile/evidence/S15/booky-journey-activity-20260930/result.json',sha256:'fba038917320f2fa7c1752e1055f28ba1c14e1582d816f807522932233501d5c'};
const sha=b=>createHash('sha256').update(b).digest('hex'),norm=p=>path.normalize(p).replaceAll('\\','/'),at=p=>path.isAbsolute(p)?p:path.join(root,p);
const hash=async p=>sha(await fs.readFile(p)),ref=async p=>({path:norm(p),sha256:await hash(p)});
const checked=async r=>{assert.match(r.sha256,/^[a-f0-9]{64}$/u);const b=await fs.readFile(at(r.path));assert.equal(sha(b),r.sha256,r.path);return JSON.parse(b);};
const write=async(name,x)=>{const p=path.join(out,name);await fs.writeFile(p,JSON.stringify(x,null,2)+'\n',{flag:'wx'});return ref(p);};
const env={...process.env,CI:'1',NEXT_TELEMETRY_DISABLED:'1',GIT_CONFIG_PARAMETERS:"'core.autocrlf=true'",BOOKY_JOURNEY_BROWSER_OUTPUT:path.join(out,'captures'),BOOKY_JOURNEY_BROWSER_REPORT:path.join(out,'browser-report.json')};
const git=args=>{const r=spawnSync('git',args,{cwd:root,env,windowsHide:true,encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout.trim();};
const producer=await ref(self),proposalPath=path.join(base,'proposal-manifest.json'),proposalRef=await ref(proposalPath),proposal=await checked(proposalRef);
assert.deepEqual(proposal.files.map(f=>f.path).sort(),paths);for(const f of proposal.files){assert.match(f.sha256,/^[a-f0-9]{64}$/u);assert.equal(await hash(path.join(base,'proposed',f.path)),f.sha256,f.path);}
assert.equal(git(['rev-parse','HEAD']),predecessor);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
const previous=await checked(priorResult);assert.equal(previous.pass,true);assert.equal(previous.decision,'D224');assert.equal(previous.sourceInputCount,2101);assert.equal(previous.historicalDialogueDraftCount,36);assert.equal(previous.productionJourneyCount,0);assert.equal(previous.releaseReady,false);
const prior=await checked(previous.sourceManifest);assert.equal(previous.sourceManifest.sha256,'610fdb0c5247f71949c51d3359ec178aee5a4f7a4a9f314f216a5d6865fd62c7');assert.equal(prior.files.length,2101);assert.equal(new Set(prior.files.map(f=>f.path)).size,2101);
for(const f of prior.files){assert.ok(!path.isAbsolute(f.path)&&!f.path.split(/[\\/]/u).includes('..'));assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);}
assert.ok(paths.every(p=>prior.files.some(f=>f.path===p)));assert.ok(paths.every(p=>proposal.files.find(f=>f.path===p).sha256!==prior.files.find(f=>f.path===p).sha256));
const oldUnit=await checked(previous.runs.unit.result),oldReport=await checked(previous.runs.unit.report),oldErasure=await checked(previous.erasureProof);assert.equal(oldUnit.pass,true);assert.equal(oldReport.success,true);assert.equal(oldErasure.pass,true);assert.equal(oldErasure.unitRerun,false);
const originalCore=oldReport.testResults.find(r=>norm(r.name).endsWith('/apps/admin/lib/booky-journey-draft.test.ts'));assert.ok(originalCore);assert.equal(originalCore.assertionResults.length,20);assert.ok(originalCore.assertionResults.every(r=>r.status==='passed'));
const preservedCore=corePaths.map(p=>{const f=prior.files.find(f=>f.path===p);assert.equal(oldErasure.proofs.find(r=>r.path===p).afterSha256,f.sha256);return {...f};});
const retainedCore={decision:'D224',passed:20,rerun:false,predecessorResult:priorResult,unit:previous.runs.unit.result,report:previous.runs.unit.report,erasureProof:previous.erasureProof,files:preservedCore};
await fs.mkdir(out);
for(const p of paths)await fs.copyFile(path.join(base,'proposed',p),path.join(root,p));
const manifest={schemaVersion:1,checkpoint:predecessor,files:await Promise.all(prior.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))};
for(const f of prior.files)if(!paths.includes(f.path))assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256,f.path);
const sourceManifest=await write('source-manifest.json',manifest);
const snapshot=async()=>({head:git(['rev-parse','HEAD']),status:git(['status','--porcelain=v1','--untracked-files=all']),files:await Promise.all(manifest.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))});
const before=await snapshot();assert.equal(before.head,predecessor);assert.deepEqual(before.files,manifest.files);const sourceBefore=await write('source-before.json',before);
const temp=path.join(root,'.tmp/admin-journey-answer-preview-a1');await fs.mkdir(temp,{recursive:true});env.TEMP=temp;env.TMP=temp;
async function run(label,args){const stdoutPath=path.join(out,label+'.stdout.log'),stderrPath=path.join(out,label+'.stderr.log');const stdout=await fs.open(stdoutPath,'wx'),stderr=await fs.open(stderrPath,'wx'),started=Date.now();let error=null;
  console.log(JSON.stringify({started:label}));const code=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore',stdout.fd,stderr.fd]});child.once('error',e=>{error=e.message;});child.once('close',exit=>resolve(exit));});await stdout.close();await stderr.close();return {pass:code===0&&!error,exitCode:code,error,durationMs:Date.now()-started,command:[process.execPath,...args],sourceManifest,stdout:await ref(stdoutPath),stderr:await ref(stderrPath)};}
const [typecheck,unit]=await Promise.all([
  run('typecheck',[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(root,'apps/admin/tsconfig.json'),'--incremental','false','--pretty','false']),
  run('unit',[path.join(root,'node_modules/vitest/vitest.mjs'),'run',...unitFiles,'--reporter=json','--outputFile='+path.join(out,'unit-report.json')])
]);
let unitSummary=null;try{const report=JSON.parse(await fs.readFile(path.join(out,'unit-report.json'),'utf8'));unitSummary={total:report.numTotalTests,passed:report.numPassedTests,failed:report.numFailedTests,pending:report.numPendingTests};const counts=unitFiles.map(p=>report.testResults.find(r=>norm(r.name).endsWith('/'+p))?.assertionResults.length);unit.pass&&=report.success&&report.numTotalTests===28&&report.numPassedTests===28&&report.numFailedTests===0&&report.numPendingTests===0&&report.testResults.length===2&&counts[0]===18&&counts[1]===10;unit.files=unitFiles;unit.report=await ref(path.join(out,'unit-report.json'));}catch(e){unit.pass=false;unit.error=String(e);}
unit.summary=unitSummary;const unitRef=await write('unit-result.json',unit),typeRef=await write('typecheck-result.json',typecheck);
let browser=null,browserRef=null;if(typecheck.pass&&unit.pass){
  browser=await run('browser',[path.join(root,'node_modules/@playwright/test/cli.js'),'test','--config='+path.join(path.dirname(base),'s15-booky-journey-authoring-review/playwright.config.mjs')]);
  try{const report=JSON.parse(await fs.readFile(path.join(out,'browser-report.json'),'utf8'));browser.report=await ref(path.join(out,'browser-report.json'));browser.summary={cases:report.stats.expected+report.stats.unexpected+report.stats.skipped+report.stats.flaky,passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,flaky:report.stats.flaky};browser.pass&&=browser.summary.cases===2&&browser.summary.passed===2&&browser.summary.failed===0&&browser.summary.skipped===0&&browser.summary.flaky===0;}catch(e){browser.pass=false;browser.error=String(e);}
  browserRef=await write('browser-result.json',browser);
}
const after=await snapshot(),sourceAfter=await write('source-after.json',after),sourceInputsUnchanged=JSON.stringify(before)===JSON.stringify(after);assert.equal(sourceInputsUnchanged,true);assert.equal(await hash(proposalPath),proposalRef.sha256);assert.equal(await hash(self),producer.sha256);
const pass=typecheck.pass&&unit.pass&&browser?.pass===true,result=await write('checks-result.json',{pass,sourceManifest,sourceBefore,sourceAfter,sourceInputsUnchanged,predecessorDocsCommit:predecessor,changedPaths:paths,newPaths:[],protectedInputCount:2095,typecheck:typeRef,unit:unitRef,browser:browserRef,retainedCore,proposal:proposalRef,producer,mobileRuntimeUnchanged:true,mobileBuildExecuted:false,authenticatedAdminSession:false,liveSupabaseTested:false,stageAccepted:false,releaseReady:false});
console.log(JSON.stringify({pass,result,sourceManifest,unitSummary,browserSummary:browser?.summary}));if(!pass)process.exitCode=1;
