// node apply-and-check.mjs D230_DOCS_COMMIT D230_RESULT_PATH D230_RESULT_SHA
// Apply two reviewed D231 UI/browser owners; run TypeScript and browsers, retaining original D230 core49.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [predecessor,resultArg,resultSha]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(predecessor,/^[a-f0-9]{40}$/u);assert.match(resultSha,/^[a-f0-9]{64}$/u);
assert.equal(predecessor,'7ab34ad2b527079c399be79e7b1b859e72feb500');assert.equal(resultSha,'1b842baa859626d77e32f62c01e8789d2a735cf51416e12cd1817fac3fd725e0');
const self=fileURLToPath(import.meta.url),base=path.dirname(self),out=path.join(base,'actual-a1');
const root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const proposalFiles=[
  {path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'ad8008d3abe29a6335ec30dd73070bd2e8b09eb64199c67704a657ad29fdd9b6'},
  {path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'9a960b9c9e8de390653f6069b40c0a8b757cbbfcba830ef3e6086a9cfc5aa463'},
];
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
assert.equal(previous.pass,true);assert.equal(previous.decision,'D230');
assert.match(previous.sourceCommit,/^[a-f0-9]{40}$/u);
assert.equal(git(['rev-parse',predecessor+'^']),previous.sourceCommit);assert.equal(previous.sourceInputCount,2101);assert.equal(previous.historicalDialogueDraftCount,36);
for(const k of ['approvedCount','availableAdultCount','availableChildCount','productionJourneyCount'])assert.equal(previous[k],0);assert.equal(previous.releaseReady,false);
const baselineChecksRef=previous.checks;
const baseline=await checked(baselineChecksRef);assert.equal(baseline.pass,true);assert.equal(baseline.sourceInputsUnchanged,true);assert.equal(previous.checks.sha256,baselineChecksRef.sha256);
assert.equal(previous.sourceManifest.sha256,baseline.sourceManifest.sha256);
const prior=await checked(baseline.sourceManifest);assert.equal(prior.files.length,2101);assert.equal(new Set(prior.files.map(f=>f.path)).size,2101);
for(const f of prior.files){assert.ok(!path.isAbsolute(f.path)&&!f.path.split(/[\\/]/u).includes('..'));assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);}
const baselineBefore=await checked(baseline.sourceBefore),baselineAfter=await checked(baseline.sourceAfter);assert.deepEqual(baselineBefore,baselineAfter);assert.deepEqual(baselineBefore.files,prior.files);
const oldUnit=await checked(previous.runs.unit.result),oldReport=await checked(previous.runs.unit.report),unitManifest=await checked(previous.runs.unit.sourceManifest);
assert.equal(oldUnit.pass,true);assert.equal(oldUnit.exitCode,0);assert.equal(oldUnit.error,null);assert.equal(oldUnit.report.sha256,previous.runs.unit.report.sha256);assert.equal(oldUnit.sourceManifest.sha256,previous.runs.unit.sourceManifest.sha256);await bytes(oldUnit.stdout);await bytes(oldUnit.stderr);
assert.deepEqual(oldUnit.files,[unitFile]);assert.deepEqual(oldUnit.summary,{total:49,passed:49,failed:0,pending:0});assert.equal(oldReport.success,true);assert.deepEqual([oldReport.numTotalTests,oldReport.numPassedTests,oldReport.numFailedTests,oldReport.numPendingTests],[49,49,0,0]);assert.equal(oldReport.testResults.length,1);assert.equal(oldReport.testResults[0].assertionResults.length,49);assert(oldReport.testResults[0].assertionResults.every(a=>a.status==='passed'));
const typeCorrection=await checked(previous.testTypeCorrection);assert.equal(typeCorrection.pass,true);assert.equal(typeCorrection.path,unitFile);assert.equal(typeCorrection.applicationSourceUnchanged,true);assert.equal(typeCorrection.unitRerun,false);assert.equal(typeCorrection.emittedJavaScriptUnchanged,true);assert.equal(typeCorrection.originalManifest.sha256,previous.runs.unit.sourceManifest.sha256);assert.equal(typeCorrection.finalManifest.sha256,baseline.sourceManifest.sha256);assert.equal(typeCorrection.retainedCurrentUnit.sha256,previous.runs.unit.result.sha256);
assert.equal(typeCorrection.beforeSha256,'7f47f474950a7117593dfdd69743ef5260311368c81716ff86db55c562c34b70');assert.equal(typeCorrection.afterSha256,'05a17d7c98e3027b4a935c5a72b1fb93d79abc75d6089a6bfac0882cc23c43e6');
assert.deepEqual(unitManifest.files.filter(f=>!paths.includes(f.path)&&f.path!==unitFile),prior.files.filter(f=>!paths.includes(f.path)&&f.path!==unitFile));assert.equal(unitManifest.files.find(f=>f.path===unitFile).sha256,typeCorrection.beforeSha256);assert.equal(prior.files.find(f=>f.path===unitFile).sha256,typeCorrection.afterSha256);
assert.equal(typeCorrection.erasureProof.sha256,'4764929773a7ccac1776f599e9ff1e485abef3abcf3ea2aa3161bc0f33b02ad5');const proof=await checked(typeCorrection.erasureProof);
assert.equal(proof.pass,true);assert.equal(proof.changedPath,unitFile);assert.equal(proof.beforeSha256,typeCorrection.beforeSha256);assert.equal(proof.afterSha256,typeCorrection.afterSha256);assert.equal(proof.emittedJavaScriptUnchanged,true);assert.equal(proof.emittedJavaScriptSha256,'3558e7b8b16162a52a6b7c0558f73252341d14e18867e78a3a514e75abfad5c7');assert.equal(typeCorrection.emittedJavaScriptSha256,proof.emittedJavaScriptSha256);assert.equal(proof.transform.tool,'actual esbuild.transform');assert.equal(proof.transform.options.target,'es2020');assert.equal(proof.transform.options.loader,'ts');assert.equal(proof.transform.options.sourcefile,unitFile);assert.deepEqual(await bytes(proof.emittedBefore),await bytes(proof.emittedAfter));assert.equal(proof.emittedBefore.sha256,proof.emittedJavaScriptSha256);assert.equal(proof.emittedAfter.sha256,proof.emittedJavaScriptSha256);for(const k of ['applicationSourceChanged','unitExecuted','browserExecuted','typecheckExecuted','canonicalWrites'])assert.equal(proof[k],false);
const retainedUnit={decision:'D230',passed:49,rerun:false,unit:previous.runs.unit.result,report:previous.runs.unit.report,sourceManifest:previous.runs.unit.sourceManifest,files:[unitFile,'apps/admin/lib/booky-journey-draft.ts'].map(p=>({...unitManifest.files.find(f=>f.path===p)})),currentFiles:[unitFile,'apps/admin/lib/booky-journey-draft.ts'].map(p=>({...prior.files.find(f=>f.path===p)})),testTypeCorrection:previous.testTypeCorrection,originalUnitManifestRetained:true,currentCoreAndTestSourceUnchangedSinceD230:true,currentCoreRuntimeUnchanged:true,emittedTestRuntimeUnchanged:true,protectedDependenciesUnchanged:true,coversNewUi:false};
const retainedHelper={...previous.retainedHelper};assert.equal(retainedHelper.decision,'D226');assert.equal(retainedHelper.passed,18);assert.equal(retainedHelper.rerun,false);assert.equal(retainedHelper.helperOwnBytesUnchanged,true);assert.equal(retainedHelper.coreDependencyChanged,true);assert.equal(retainedHelper.currentParserCoverageClaimed,false);
const helperUnit=await checked(retainedHelper.unit),helperReport=await checked(retainedHelper.report);assert.equal(helperUnit.pass,true);assert.equal(helperReport.success,true);const helperRow=helperReport.testResults.find(r=>norm(r.name).endsWith('/'+helperOwners[0]));assert.equal(helperRow.assertionResults.length,18);assert(helperRow.assertionResults.every(a=>a.status==='passed'));for(const f of retainedHelper.files)assert.equal(prior.files.find(p=>p.path===f.path).sha256,f.sha256,f.path);
const retainedAction=baseline.retainedAction;assert.equal(retainedAction.decision,'D225');assert.equal(retainedAction.passed,10);assert.equal(retainedAction.rerun,false);
assert.equal(retainedAction.mockedActionCoverage,true);assert.equal(retainedAction.parserCoverageClaimed,false);
const actionUnit=await checked(retainedAction.unit),actionReport=await checked(retainedAction.report);assert.equal(actionUnit.pass,true);assert.equal(actionReport.success,true);
assert.deepEqual(actionUnit.summary,{total:28,passed:28,failed:0,pending:0});const actionRow=actionReport.testResults.find(r=>norm(r.name).endsWith('/apps/admin/app/(dashboard)/journeys/actions.test.ts'));
assert.equal(actionRow.assertionResults.length,10);assert(actionRow.assertionResults.every(a=>a.status==='passed'));for(const f of retainedAction.files)assert.equal(prior.files.find(p=>p.path===f.path).sha256,f.sha256,f.path);
const smokeRef=baseline.retainedHistoricalFactSmoke.result,smoke=await checked(smokeRef);assert.equal(smokeRef.sha256,'9c411b7b8ee5705ebada165092ad257b28d510eb9f3ecb0afd924baf8dd498d8');
assert.equal(smoke.pass,true);assert.equal(smoke.sourceInputsUnchanged,true);assert.equal(smoke.evaluatedWorkCount,1);assert.equal(smoke.evaluatedChoiceCount,2);
assert.equal(smoke.currentSourceManifest.sha256,'3a8786ad17ed5e192b9958997bc7f70209b7bb5f16daf19661ad5b52eec9da67');assert.equal(smoke.factualClaimsVerified,false);assert.equal(smoke.sourcesFetched,false);assert.equal(smoke.fullCatalogValidationRepeated,false);
const imports=await checked(smoke.sourceManifest),smokeBefore=await checked(smoke.sourceBefore),smokeAfter=await checked(smoke.sourceAfter);assert.deepEqual(smokeBefore,smokeAfter);assert.deepEqual(smokeBefore.files,imports.files);
const retainedHistoricalFactSmoke={decision:'D226',rerun:false,result:smokeRef,sourceManifest:smoke.currentSourceManifest,importManifest:smoke.sourceManifest,
  historicalOnly:true,currentCoreCompatibilityClaimed:false,evaluatedWorkCount:1,evaluatedChoiceCount:2,syntheticCitationMetadata:true,factualClaimsVerified:false,sourcesFetched:false};
const retentionRefs=[predecessorResult,baselineChecksRef,baseline.sourceManifest,baseline.sourceBefore,baseline.sourceAfter,retainedUnit.unit,retainedUnit.report,retainedUnit.sourceManifest,previous.testTypeCorrection,typeCorrection.erasureProof,proof.emittedBefore,proof.emittedAfter,proof.original,proof.corrected,proof.producer,typeCorrection.producer,retainedHelper.unit,retainedHelper.report,retainedHelper.sourceManifest,retainedAction.unit,retainedAction.report,
  smokeRef,smoke.sourceManifest,smoke.sourceBefore,smoke.sourceAfter,smoke.producer,baseline.producer];for(const r of retentionRefs)await bytes(r);
for(const f of proposalFiles){assert.equal(await hash(path.join(base,'proposed',f.path)),f.sha256,f.path);assert.notEqual(prior.files.find(p=>p.path===f.path)?.sha256,f.sha256);}
await fs.mkdir(out);for(const p of paths)await fs.copyFile(path.join(base,'proposed',p),path.join(root,p));
const manifest={schemaVersion:1,checkpoint:predecessor,files:await Promise.all(prior.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))};
for(const f of manifest.files)assert.equal(f.sha256,proposalFiles.find(p=>p.path===f.path)?.sha256??prior.files.find(p=>p.path===f.path).sha256,f.path);
assert.deepEqual(git(['diff','--name-only']).split('\n').filter(Boolean).sort(),paths);const sourceManifest=await write('source-manifest.json',manifest);
const snapshot=async()=>({head:git(['rev-parse','HEAD']),status:git(['status','--porcelain=v1','--untracked-files=all']),files:await Promise.all(manifest.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))});
const before=await snapshot();assert.equal(before.head,predecessor);assert.deepEqual(before.files,manifest.files);const sourceBefore=await write('source-before.json',before);
const temp=path.join(root,'.tmp/admin-journey-preview-width-a1');await fs.mkdir(temp,{recursive:true});env.TEMP=temp;env.TMP=temp;
async function run(label,args){const stdoutPath=path.join(out,label+'.stdout.log'),stderrPath=path.join(out,label+'.stderr.log'),stdout=await fs.open(stdoutPath,'wx'),stderr=await fs.open(stderrPath,'wx'),started=Date.now();let error=null;
  console.log(JSON.stringify({started:label}));const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore',stdout.fd,stderr.fd]});child.once('error',e=>{error=e.message;});child.once('close',resolve);});await stdout.close();await stderr.close();
  return {pass:exitCode===0&&!error,exitCode,error,durationMs:Date.now()-started,command:[process.execPath,...args],sourceManifest,stdout:await ref(stdoutPath),stderr:await ref(stderrPath)};}
const typecheck=await run('typecheck',[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(root,'apps/admin/tsconfig.json'),'--incremental','false','--pretty','false']);
const typeRef=await write('typecheck-result.json',typecheck);
let browser=null,browserRef=null,captures=[];if(typecheck.pass){
  browser=await run('browser',[path.join(root,'node_modules/@playwright/test/cli.js'),'test','--config='+path.join(path.dirname(base),'s15-booky-journey-authoring-review/playwright.config.mjs')]);
  try{const reportPath=path.join(out,'browser-report.json'),report=JSON.parse(await fs.readFile(reportPath,'utf8'));browser.report=await ref(reportPath);browser.summary={cases:report.stats.expected+report.stats.unexpected+report.stats.skipped+report.stats.flaky,passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,flaky:report.stats.flaky};
    browser.pass&&=browser.summary.cases===3&&browser.summary.passed===3&&browser.summary.failed===0&&browser.summary.skipped===0&&browser.summary.flaky===0;
    const captureRoot=path.join(out,'captures'),pngs=(await fs.readdir(captureRoot,{recursive:true})).filter(p=>p.endsWith('.png')).sort();captures=await Promise.all(pngs.map(p=>ref(path.join(captureRoot,p))));
    browser.pass&&=captures.length===8;
  }catch(e){browser.pass=false;browser.error=String(e);}browserRef=await write('browser-result.json',browser);
}
const after=await snapshot(),sourceAfter=await write('source-after.json',after);assert.deepEqual(after,before);for(const r of retentionRefs)await bytes(r);
for(const f of proposalFiles)assert.equal(await hash(path.join(base,'proposed',f.path)),f.sha256);assert.equal(await hash(self),producer.sha256);
const pass=typecheck.pass&&browser?.pass===true,result=await write('checks-result.json',{pass,decision:'D231',predecessorDocsCommit:predecessor,predecessorResult,
  sourceManifest,sourceBefore,sourceAfter,sourceInputsUnchanged:true,changedPaths:paths,newPaths:[],protectedInputCount:2099,proposalFiles,typecheck:typeRef,browser:browserRef,captures,
  retainedUnit,retainedHelper,retainedAction,retainedHistoricalFactSmoke,retainedD230Checks:baselineChecksRef,retentionRefs,
  typecheckExecuted:true,unitExecuted:false,helperUnitExecuted:false,catalogSmokeExecuted:false,mobileRuntimeUnchanged:true,mobileBuildExecuted:false,authenticatedAdminSession:false,liveSupabaseTested:false,stageAccepted:false,releaseReady:false,producer});
console.log(JSON.stringify({pass,result,sourceManifest,browserSummary:browser?.summary,captures:captures.length}));if(!pass)process.exitCode=1;
