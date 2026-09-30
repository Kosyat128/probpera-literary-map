// node apply-and-check.mjs D227_DOCS_COMMIT D227_RESULT_PATH D227_RESULT_SHA
// Apply four reviewed D228 owners; run current admin TypeScript, core units and browsers.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [predecessor,resultArg,resultSha]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(predecessor,/^[a-f0-9]{40}$/u);assert.match(resultSha,/^[a-f0-9]{64}$/u);
assert.equal(predecessor,'b923f1d66eb957539cc500c58dde54e2bba3665a');assert.equal(resultSha,'17e9b482a99376f881c9fbaaaf2abcc525c16ab634a8ef0eef40f605666e504f');
const self=fileURLToPath(import.meta.url),base=path.dirname(self),out=path.join(base,'actual-a1');
const root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const proposalFiles=[
  {path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'23f9388f558e26315e6cfae4ff90ef8fe02c9e99d878fd8c224da622865a07a7'},
  {path:'apps/admin/lib/booky-journey-draft.test.ts',sha256:'7e48bc4080029f4143466f20be1232f158a98269238ca8ebc12c60ba73d8de41'},
  {path:'apps/admin/lib/booky-journey-draft.ts',sha256:'998eb8c1bb89f535381a31c5410e6b074d6c5b684982dc77dbd098f645e959aa'},
  {path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'f6c086469a650cb193ea5a7b978694c81b2d160ae9cca80b1b5790fdee162ed9'},
];
const expectedCoreTests=36;
assert(Number.isInteger(expectedCoreTests)&&expectedCoreTests>28);
const paths=proposalFiles.map(f=>f.path),unitFile='apps/admin/lib/booky-journey-draft.test.ts';
const helperOwners=['apps/admin/lib/booky-journey-activity-validation.test.ts','apps/admin/lib/booky-journey-activity-validation.ts'];
const sha=b=>createHash('sha256').update(b).digest('hex'),norm=p=>path.normalize(p).replaceAll('\\','/'),at=p=>path.isAbsolute(p)?p:path.join(root,p);
const hash=async p=>sha(await fs.readFile(p)),ref=async p=>({path:norm(p),sha256:await hash(p)});
const bytes=async r=>{assert.match(r.sha256,/^[a-f0-9]{64}$/u);const b=await fs.readFile(at(r.path));assert.equal(sha(b),r.sha256,r.path);return b;};
const checked=async r=>JSON.parse(await bytes(r));
const write=async(n,v)=>{const p=path.join(out,n);await fs.writeFile(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(p);};
const env={...process.env,CI:'1',NEXT_TELEMETRY_DISABLED:'1',GIT_CONFIG_PARAMETERS:"'core.autocrlf=true'",BOOKY_JOURNEY_BROWSER_OUTPUT:path.join(out,'captures'),BOOKY_JOURNEY_BROWSER_REPORT:path.join(out,'browser-report.json')};
const git=args=>{const r=spawnSync('git',args,{cwd:root,env,windowsHide:true,encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout.trim();};
const producer=await ref(self),predecessorResult={path:norm(at(resultArg)),sha256:resultSha},previous=await checked(predecessorResult);
assert.equal(git(['rev-parse','HEAD']),predecessor);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
assert.equal(previous.pass,true);assert.equal(previous.decision,'D227');
assert.equal(previous.sourceCommit,'2da623326f0ef20167cd44049587e23fb76c4e1f');
assert.equal(git(['rev-parse',predecessor+'^']),previous.sourceCommit);assert.equal(previous.sourceInputCount,2101);assert.equal(previous.historicalDialogueDraftCount,36);
for(const k of ['approvedCount','availableAdultCount','availableChildCount','productionJourneyCount'])assert.equal(previous[k],0);assert.equal(previous.releaseReady,false);
const baselineChecksRef={path:path.join(path.dirname(base),'s15-booky-journey-step-overview-review/actual-a1/checks-result.json'),sha256:'54578d3b6712f6db4ead98183df0bd4654364bbc7551041e428dda5f7f39ae20'};
const baseline=await checked(baselineChecksRef);assert.equal(baseline.pass,true);assert.equal(baseline.sourceInputsUnchanged,true);assert.equal(previous.checks.sha256,baselineChecksRef.sha256);
assert.equal(baseline.sourceManifest.sha256,'1535dc7bb5ef22f52f504e971c721de0f763389c839e5ab23ef68b82228e8433');assert.equal(previous.sourceManifest.sha256,baseline.sourceManifest.sha256);
const prior=await checked(baseline.sourceManifest);assert.equal(prior.files.length,2101);assert.equal(new Set(prior.files.map(f=>f.path)).size,2101);
for(const f of prior.files){assert.ok(!path.isAbsolute(f.path)&&!f.path.split(/[\\/]/u).includes('..'));assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);}
const baselineBefore=await checked(baseline.sourceBefore),baselineAfter=await checked(baseline.sourceAfter);assert.deepEqual(baselineBefore,baselineAfter);assert.deepEqual(baselineBefore.files,prior.files);
const oldType=await checked(baseline.typecheck),oldUnit=await checked(baseline.retainedUnit.unit),oldReport=await checked(baseline.retainedUnit.report);
for(const run of [oldType,oldUnit]){assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);await bytes(run.stdout);await bytes(run.stderr);}
assert.equal(oldType.sourceManifest.sha256,baseline.sourceManifest.sha256);
assert.equal(oldUnit.sourceManifest.sha256,'b15d386b58589f87316b43beb43a91da17d07a7a5715cbb9f4f796630a9bd289');
assert.deepEqual(oldUnit.files,[unitFile,helperOwners[0]]);assert.deepEqual(oldUnit.summary,{total:46,passed:46,failed:0,pending:0});assert.equal(oldReport.success,true);
assert.deepEqual([oldReport.numTotalTests,oldReport.numPassedTests,oldReport.numFailedTests,oldReport.numPendingTests],[46,46,0,0]);assert.equal(oldReport.testResults.length,2);
assert.deepEqual([unitFile,helperOwners[0]].map(p=>oldReport.testResults.find(r=>norm(r.name).endsWith('/'+p))?.assertionResults.length),[28,18]);for(const r of oldReport.testResults)assert(r.assertionResults.every(a=>a.status==='passed'));
for(const p of helperOwners)assert.equal(baseline.retainedUnit.files.find(f=>f.path===p).sha256,prior.files.find(f=>f.path===p).sha256,p);
const retainedHelper={decision:'D226',passed:18,rerun:false,unit:baseline.retainedUnit.unit,report:baseline.retainedUnit.report,sourceManifest:oldUnit.sourceManifest,
  files:helperOwners.map(p=>({...prior.files.find(f=>f.path===p)})),helperOwnBytesUnchanged:true,coreDependencyChanged:true,currentParserCoverageClaimed:false};
const retainedAction=baseline.retainedAction;assert.equal(retainedAction.decision,'D225');assert.equal(retainedAction.passed,10);assert.equal(retainedAction.rerun,false);
assert.equal(retainedAction.mockedActionCoverage,true);assert.equal(retainedAction.parserCoverageClaimed,false);
const actionUnit=await checked(retainedAction.unit),actionReport=await checked(retainedAction.report);assert.equal(actionUnit.pass,true);assert.equal(actionReport.success,true);
assert.deepEqual(actionUnit.summary,{total:28,passed:28,failed:0,pending:0});const actionRow=actionReport.testResults.find(r=>norm(r.name).endsWith('/apps/admin/app/(dashboard)/journeys/actions.test.ts'));
assert.equal(actionRow.assertionResults.length,10);assert(actionRow.assertionResults.every(a=>a.status==='passed'));for(const f of retainedAction.files)assert.equal(prior.files.find(p=>p.path===f.path).sha256,f.sha256,f.path);
const smokeRef=baseline.retainedFactSmoke.result,smoke=await checked(smokeRef);assert.equal(smokeRef.sha256,'9c411b7b8ee5705ebada165092ad257b28d510eb9f3ecb0afd924baf8dd498d8');
assert.equal(smoke.pass,true);assert.equal(smoke.sourceInputsUnchanged,true);assert.equal(smoke.evaluatedWorkCount,1);assert.equal(smoke.evaluatedChoiceCount,2);
assert.equal(smoke.currentSourceManifest.sha256,'3a8786ad17ed5e192b9958997bc7f70209b7bb5f16daf19661ad5b52eec9da67');assert.equal(smoke.factualClaimsVerified,false);assert.equal(smoke.sourcesFetched,false);assert.equal(smoke.fullCatalogValidationRepeated,false);
const imports=await checked(smoke.sourceManifest),smokeBefore=await checked(smoke.sourceBefore),smokeAfter=await checked(smoke.sourceAfter);assert.deepEqual(smokeBefore,smokeAfter);assert.deepEqual(smokeBefore.files,imports.files);
const retainedHistoricalFactSmoke={decision:'D226',rerun:false,result:smokeRef,sourceManifest:smoke.currentSourceManifest,importManifest:smoke.sourceManifest,
  historicalOnly:true,currentCoreCompatibilityClaimed:false,evaluatedWorkCount:1,evaluatedChoiceCount:2,syntheticCitationMetadata:true,factualClaimsVerified:false,sourcesFetched:false};
const retentionRefs=[predecessorResult,baselineChecksRef,baseline.sourceManifest,baseline.sourceBefore,baseline.sourceAfter,baseline.typecheck,baseline.retainedUnit.unit,baseline.retainedUnit.report,oldUnit.sourceManifest,retainedAction.unit,retainedAction.report,
  smokeRef,smoke.sourceManifest,smoke.sourceBefore,smoke.sourceAfter,smoke.producer,baseline.producer];for(const r of retentionRefs)await bytes(r);
for(const f of proposalFiles){assert.equal(await hash(path.join(base,'proposed',f.path)),f.sha256,f.path);assert.notEqual(prior.files.find(p=>p.path===f.path)?.sha256,f.sha256);}
await fs.mkdir(out);for(const p of paths)await fs.copyFile(path.join(base,'proposed',p),path.join(root,p));
const manifest={schemaVersion:1,checkpoint:predecessor,files:await Promise.all(prior.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))};
for(const f of manifest.files)assert.equal(f.sha256,proposalFiles.find(p=>p.path===f.path)?.sha256??prior.files.find(p=>p.path===f.path).sha256,f.path);
assert.deepEqual(git(['diff','--name-only']).split('\n').filter(Boolean).sort(),paths);const sourceManifest=await write('source-manifest.json',manifest);
const snapshot=async()=>({head:git(['rev-parse','HEAD']),status:git(['status','--porcelain=v1','--untracked-files=all']),files:await Promise.all(manifest.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))});
const before=await snapshot();assert.equal(before.head,predecessor);assert.deepEqual(before.files,manifest.files);const sourceBefore=await write('source-before.json',before);
const temp=path.join(root,'.tmp/admin-journey-copy-variants-a1');await fs.mkdir(temp,{recursive:true});env.TEMP=temp;env.TMP=temp;
async function run(label,args){const stdoutPath=path.join(out,label+'.stdout.log'),stderrPath=path.join(out,label+'.stderr.log'),stdout=await fs.open(stdoutPath,'wx'),stderr=await fs.open(stderrPath,'wx'),started=Date.now();let error=null;
  console.log(JSON.stringify({started:label}));const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore',stdout.fd,stderr.fd]});child.once('error',e=>{error=e.message;});child.once('close',resolve);});await stdout.close();await stderr.close();
  return {pass:exitCode===0&&!error,exitCode,error,durationMs:Date.now()-started,command:[process.execPath,...args],sourceManifest,stdout:await ref(stdoutPath),stderr:await ref(stderrPath)};}
const [typecheck,unit]=await Promise.all([
  run('typecheck',[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(root,'apps/admin/tsconfig.json'),'--incremental','false','--pretty','false']),
  run('unit',[path.join(root,'node_modules/vitest/vitest.mjs'),'run',unitFile,'--reporter=json','--outputFile='+path.join(out,'unit-report.json')]),
]);
try{const reportPath=path.join(out,'unit-report.json'),report=JSON.parse(await fs.readFile(reportPath,'utf8'));unit.report=await ref(reportPath);unit.files=[unitFile];unit.summary={total:report.numTotalTests,passed:report.numPassedTests,failed:report.numFailedTests,pending:report.numPendingTests};
  unit.pass&&=report.success&&report.numTotalTests===expectedCoreTests&&report.numPassedTests===expectedCoreTests&&report.numFailedTests===0&&report.numPendingTests===0&&report.testResults.length===1&&report.testResults[0].assertionResults.length===expectedCoreTests&&report.testResults[0].assertionResults.every(a=>a.status==='passed');
}catch(e){unit.pass=false;unit.error=String(e);}
const typeRef=await write('typecheck-result.json',typecheck),unitRef=await write('unit-result.json',unit);
let browser=null,browserRef=null,captures=[];if(typecheck.pass&&unit.pass){
  browser=await run('browser',[path.join(root,'node_modules/@playwright/test/cli.js'),'test','--config='+path.join(path.dirname(base),'s15-booky-journey-authoring-review/playwright.config.mjs')]);
  try{const reportPath=path.join(out,'browser-report.json'),report=JSON.parse(await fs.readFile(reportPath,'utf8'));browser.report=await ref(reportPath);browser.summary={cases:report.stats.expected+report.stats.unexpected+report.stats.skipped+report.stats.flaky,passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,flaky:report.stats.flaky};
    browser.pass&&=browser.summary.cases===3&&browser.summary.passed===3&&browser.summary.failed===0&&browser.summary.skipped===0&&browser.summary.flaky===0;
    const captureRoot=path.join(out,'captures'),pngs=(await fs.readdir(captureRoot,{recursive:true})).filter(p=>p.endsWith('.png')).sort();captures=await Promise.all(pngs.map(p=>ref(path.join(captureRoot,p))));
    browser.pass&&=captures.length===8;
  }catch(e){browser.pass=false;browser.error=String(e);}browserRef=await write('browser-result.json',browser);
}
const after=await snapshot(),sourceAfter=await write('source-after.json',after);assert.deepEqual(after,before);for(const r of retentionRefs)await bytes(r);
for(const f of proposalFiles)assert.equal(await hash(path.join(base,'proposed',f.path)),f.sha256);assert.equal(await hash(self),producer.sha256);
const pass=typecheck.pass&&unit.pass&&browser?.pass===true,result=await write('checks-result.json',{pass,decision:'D228',predecessorDocsCommit:predecessor,predecessorResult,
  sourceManifest,sourceBefore,sourceAfter,sourceInputsUnchanged:true,changedPaths:paths,newPaths:[],protectedInputCount:2097,proposalFiles,typecheck:typeRef,unit:unitRef,browser:browserRef,captures,expectedCoreTests,
  retainedHelper,retainedAction,retainedHistoricalFactSmoke,retainedD227Checks:baselineChecksRef,retentionRefs,
  unitExecuted:true,helperUnitExecuted:false,catalogSmokeExecuted:false,mobileRuntimeUnchanged:true,mobileBuildExecuted:false,authenticatedAdminSession:false,liveSupabaseTested:false,stageAccepted:false,releaseReady:false,producer});
console.log(JSON.stringify({pass,result,sourceManifest,browserSummary:browser?.summary,captures:captures.length}));if(!pass)process.exitCode=1;
