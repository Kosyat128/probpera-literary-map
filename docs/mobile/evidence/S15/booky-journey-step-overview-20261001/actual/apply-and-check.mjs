// node apply-and-check.mjs D226_DOCS_COMMIT D226_RESULT_PATH D226_RESULT_SHA
// Apply two reviewed D227 owners; run only current admin TypeScript and browsers.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [predecessor,resultArg,resultSha]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(predecessor,/^[a-f0-9]{40}$/u);assert.match(resultSha,/^[a-f0-9]{64}$/u);
assert.equal(predecessor,'84102e7622ad38c5691b2102a152fa06eb251fcf');assert.equal(resultSha,'37e9e9c7befcfd065a5e5dcfced83d832950036e8e5790a2780f1b6a9a0d1bf1');
const self=fileURLToPath(import.meta.url),base=path.dirname(self),out=path.join(base,'actual-a1');
const root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const proposalFiles=[
  {path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'d63a70e308add47b4a6618f3c0b77a1bd57a6287c298cb0722fb2227f6fc7854'},
  {path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'eed87c458962a471a65a72fdd1516b03c4917e8df8b661a2c1a8fd44613d6721'},
];
const paths=proposalFiles.map(f=>f.path),unitFiles=['apps/admin/lib/booky-journey-draft.test.ts','apps/admin/lib/booky-journey-activity-validation.test.ts'];
const unitOwners=[...unitFiles,'apps/admin/lib/booky-journey-draft.ts','apps/admin/lib/booky-journey-activity-validation.ts'];
const sha=b=>createHash('sha256').update(b).digest('hex'),norm=p=>path.normalize(p).replaceAll('\\','/'),at=p=>path.isAbsolute(p)?p:path.join(root,p);
const hash=async p=>sha(await fs.readFile(p)),ref=async p=>({path:norm(p),sha256:await hash(p)});
const bytes=async r=>{assert.match(r.sha256,/^[a-f0-9]{64}$/u);const b=await fs.readFile(at(r.path));assert.equal(sha(b),r.sha256,r.path);return b;};
const checked=async r=>JSON.parse(await bytes(r));
const write=async(n,v)=>{const p=path.join(out,n);await fs.writeFile(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(p);};
const env={...process.env,CI:'1',NEXT_TELEMETRY_DISABLED:'1',GIT_CONFIG_PARAMETERS:"'core.autocrlf=true'",BOOKY_JOURNEY_BROWSER_OUTPUT:path.join(out,'captures'),BOOKY_JOURNEY_BROWSER_REPORT:path.join(out,'browser-report.json')};
const git=args=>{const r=spawnSync('git',args,{cwd:root,env,windowsHide:true,encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout.trim();};
const producer=await ref(self),predecessorResult={path:norm(at(resultArg)),sha256:resultSha},previous=await checked(predecessorResult);
assert.equal(git(['rev-parse','HEAD']),predecessor);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
assert.equal(previous.pass,true);assert.equal(previous.decision,'D226');assert.equal(previous.sourceCommit,'1acb8d15d6a53a638f5e491b849053fb688e42d7');
assert.equal(git(['rev-parse',predecessor+'^']),previous.sourceCommit);assert.equal(previous.sourceInputCount,2101);assert.equal(previous.historicalDialogueDraftCount,36);
for(const k of ['approvedCount','availableAdultCount','availableChildCount','productionJourneyCount'])assert.equal(previous[k],0);assert.equal(previous.releaseReady,false);
const baselineChecksRef={path:path.join(path.dirname(base),'s15-booky-journey-fact-review/actual-a2/checks-result.json'),sha256:'50ae1dedf230c95e4fe8ad4c327fa2d99b2e0f2f4206341e8dcfb0815e7da502'};
const baseline=await checked(baselineChecksRef);assert.equal(baseline.pass,true);assert.equal(baseline.sourceInputsUnchanged,true);assert.equal(previous.checks.sha256,baselineChecksRef.sha256);
assert.equal(baseline.sourceManifest.sha256,'3a8786ad17ed5e192b9958997bc7f70209b7bb5f16daf19661ad5b52eec9da67');assert.equal(previous.sourceManifest.sha256,baseline.sourceManifest.sha256);
const prior=await checked(baseline.sourceManifest);assert.equal(prior.files.length,2101);assert.equal(new Set(prior.files.map(f=>f.path)).size,2101);
for(const f of prior.files){assert.ok(!path.isAbsolute(f.path)&&!f.path.split(/[\\/]/u).includes('..'));assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);}
const baselineBefore=await checked(baseline.sourceBefore),baselineAfter=await checked(baseline.sourceAfter);assert.deepEqual(baselineBefore,baselineAfter);assert.deepEqual(baselineBefore.files,prior.files);
const fixture=await checked(baseline.fixtureCorrection),original=await checked(fixture.originalManifest);assert.equal(fixture.pass,true);assert.equal(fixture.applicationSourceUnchanged,true);
assert.equal(fixture.originalManifest.sha256,'b15d386b58589f87316b43beb43a91da17d07a7a5715cbb9f4f796630a9bd289');
assert.deepEqual(original.files.map(f=>f.path),prior.files.map(f=>f.path));assert.deepEqual(original.files.filter(f=>prior.files.find(p=>p.path===f.path).sha256!==f.sha256).map(f=>f.path),[paths[1]]);
const oldType=await checked(baseline.typecheck),oldUnit=await checked(baseline.unit),oldReport=await checked(oldUnit.report);
for(const run of [oldType,oldUnit]){assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);assert.equal(run.sourceManifest.sha256,fixture.originalManifest.sha256);await bytes(run.stdout);await bytes(run.stderr);}
assert.equal(previous.runs.unit.result.sha256,baseline.unit.sha256);assert.equal(previous.runs.unit.report.sha256,oldUnit.report.sha256);
assert.deepEqual(oldUnit.files,unitFiles);assert.deepEqual(oldUnit.summary,{total:46,passed:46,failed:0,pending:0});assert.equal(oldReport.success,true);
assert.deepEqual([oldReport.numTotalTests,oldReport.numPassedTests,oldReport.numFailedTests,oldReport.numPendingTests],[46,46,0,0]);assert.equal(oldReport.testResults.length,2);
assert.deepEqual(unitFiles.map(p=>oldReport.testResults.find(r=>norm(r.name).endsWith('/'+p))?.assertionResults.length),[28,18]);for(const r of oldReport.testResults)assert(r.assertionResults.every(a=>a.status==='passed'));
for(const p of unitOwners)assert.equal(original.files.find(f=>f.path===p).sha256,prior.files.find(f=>f.path===p).sha256,p);
const retainedUnit={decision:'D226',passed:46,rerun:false,unit:baseline.unit,report:oldUnit.report,sourceManifest:oldUnit.sourceManifest,
  files:unitOwners.map(p=>({...prior.files.find(f=>f.path===p)})),currentUnitSourcesUnchanged:true,coversNewUi:false};
const retainedAction=previous.retainedActionUnits;assert.deepEqual(retainedAction,baseline.retainedAction);assert.equal(retainedAction.decision,'D225');assert.equal(retainedAction.passed,10);assert.equal(retainedAction.rerun,false);
assert.equal(retainedAction.mockedActionCoverage,true);assert.equal(retainedAction.parserCoverageClaimed,false);
const actionUnit=await checked(retainedAction.unit),actionReport=await checked(retainedAction.report);assert.equal(actionUnit.pass,true);assert.equal(actionReport.success,true);
assert.deepEqual(actionUnit.summary,{total:28,passed:28,failed:0,pending:0});const actionRow=actionReport.testResults.find(r=>norm(r.name).endsWith('/apps/admin/app/(dashboard)/journeys/actions.test.ts'));
assert.equal(actionRow.assertionResults.length,10);assert(actionRow.assertionResults.every(a=>a.status==='passed'));for(const f of retainedAction.files)assert.equal(prior.files.find(p=>p.path===f.path).sha256,f.sha256,f.path);
const smoke=await checked(previous.factSmoke.result);assert.equal(previous.factSmoke.result.sha256,'9c411b7b8ee5705ebada165092ad257b28d510eb9f3ecb0afd924baf8dd498d8');
assert.equal(smoke.pass,true);assert.equal(smoke.sourceInputsUnchanged,true);assert.equal(smoke.evaluatedWorkCount,1);assert.equal(smoke.evaluatedChoiceCount,2);
assert.equal(smoke.currentSourceManifest.sha256,baseline.sourceManifest.sha256);assert.equal(smoke.factualClaimsVerified,false);assert.equal(smoke.sourcesFetched,false);assert.equal(smoke.fullCatalogValidationRepeated,false);
const imports=await checked(smoke.sourceManifest),smokeBefore=await checked(smoke.sourceBefore),smokeAfter=await checked(smoke.sourceAfter);assert.deepEqual(smokeBefore,smokeAfter);assert.deepEqual(smokeBefore.files,imports.files);
for(const f of imports.files){assert.ok(!path.isAbsolute(f.path)&&!f.path.split(/[\\/]/u).includes('..'));if(f.path.startsWith('node_modules/'))assert(f.path.startsWith('node_modules/@noble/hashes/'));else assert.equal(prior.files.find(p=>p.path===f.path)?.sha256,f.sha256,f.path);await bytes(f);}
const retainedFactSmoke={decision:'D226',rerun:false,result:previous.factSmoke.result,sourceManifest:smoke.currentSourceManifest,importManifest:smoke.sourceManifest,
  currentImportedBytesUnchanged:true,evaluatedWorkCount:1,evaluatedChoiceCount:2,syntheticCitationMetadata:true,factualClaimsVerified:false,sourcesFetched:false,coversNewUi:false};
const retentionRefs=[predecessorResult,baselineChecksRef,baseline.sourceManifest,baseline.sourceBefore,baseline.sourceAfter,baseline.fixtureCorrection,baseline.typecheck,baseline.unit,oldUnit.report,retainedAction.unit,retainedAction.report,
  previous.factSmoke.result,smoke.sourceManifest,smoke.sourceBefore,smoke.sourceAfter,smoke.producer,baseline.producer];for(const r of retentionRefs)await bytes(r);
for(const f of proposalFiles){assert.equal(await hash(path.join(base,'proposed',f.path)),f.sha256,f.path);assert.notEqual(prior.files.find(p=>p.path===f.path)?.sha256,f.sha256);}
await fs.mkdir(out);for(const p of paths)await fs.copyFile(path.join(base,'proposed',p),path.join(root,p));
const manifest={schemaVersion:1,checkpoint:predecessor,files:await Promise.all(prior.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))};
for(const f of manifest.files)assert.equal(f.sha256,proposalFiles.find(p=>p.path===f.path)?.sha256??prior.files.find(p=>p.path===f.path).sha256,f.path);
assert.deepEqual(git(['diff','--name-only']).split('\n').filter(Boolean).sort(),paths);const sourceManifest=await write('source-manifest.json',manifest);
const snapshot=async()=>({head:git(['rev-parse','HEAD']),status:git(['status','--porcelain=v1','--untracked-files=all']),files:await Promise.all(manifest.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))});
const before=await snapshot();assert.equal(before.head,predecessor);assert.deepEqual(before.files,manifest.files);const sourceBefore=await write('source-before.json',before);
const temp=path.join(root,'.tmp/admin-journey-step-overview-a1');await fs.mkdir(temp,{recursive:true});env.TEMP=temp;env.TMP=temp;
async function run(label,args){const stdoutPath=path.join(out,label+'.stdout.log'),stderrPath=path.join(out,label+'.stderr.log'),stdout=await fs.open(stdoutPath,'wx'),stderr=await fs.open(stderrPath,'wx'),started=Date.now();let error=null;
  console.log(JSON.stringify({started:label}));const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore',stdout.fd,stderr.fd]});child.once('error',e=>{error=e.message;});child.once('close',resolve);});await stdout.close();await stderr.close();
  return {pass:exitCode===0&&!error,exitCode,error,durationMs:Date.now()-started,command:[process.execPath,...args],sourceManifest,stdout:await ref(stdoutPath),stderr:await ref(stderrPath)};}
const typecheck=await run('typecheck',[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(root,'apps/admin/tsconfig.json'),'--incremental','false','--pretty','false']),typeRef=await write('typecheck-result.json',typecheck);
let browser=null,browserRef=null,captures=[];if(typecheck.pass){
  browser=await run('browser',[path.join(root,'node_modules/@playwright/test/cli.js'),'test','--config='+path.join(path.dirname(base),'s15-booky-journey-authoring-review/playwright.config.mjs')]);
  try{const reportPath=path.join(out,'browser-report.json'),report=JSON.parse(await fs.readFile(reportPath,'utf8'));browser.report=await ref(reportPath);browser.summary={cases:report.stats.expected+report.stats.unexpected+report.stats.skipped+report.stats.flaky,passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,flaky:report.stats.flaky};
    browser.pass&&=browser.summary.cases===3&&browser.summary.passed===3&&browser.summary.failed===0&&browser.summary.skipped===0&&browser.summary.flaky===0;
    const captureRoot=path.join(out,'captures'),pngs=(await fs.readdir(captureRoot,{recursive:true})).filter(p=>p.endsWith('.png')).sort();captures=await Promise.all(pngs.map(p=>ref(path.join(captureRoot,p))));
    browser.pass&&=captures.length===8;
  }catch(e){browser.pass=false;browser.error=String(e);}browserRef=await write('browser-result.json',browser);
}
const after=await snapshot(),sourceAfter=await write('source-after.json',after);assert.deepEqual(after,before);for(const r of retentionRefs)await bytes(r);for(const f of imports.files)await bytes(f);
for(const f of proposalFiles)assert.equal(await hash(path.join(base,'proposed',f.path)),f.sha256);assert.equal(await hash(self),producer.sha256);
const pass=typecheck.pass&&browser?.pass===true,result=await write('checks-result.json',{pass,decision:'D227',predecessorDocsCommit:predecessor,predecessorResult,
  sourceManifest,sourceBefore,sourceAfter,sourceInputsUnchanged:true,changedPaths:paths,newPaths:[],protectedInputCount:2099,proposalFiles,typecheck:typeRef,browser:browserRef,captures,
  retainedUnit,retainedAction,retainedFactSmoke,retainedD226Checks:baselineChecksRef,retainedOriginalTypecheck:baseline.typecheck,retentionRefs,
  unitExecuted:false,catalogSmokeExecuted:false,mobileRuntimeUnchanged:true,mobileBuildExecuted:false,authenticatedAdminSession:false,liveSupabaseTested:false,stageAccepted:false,releaseReady:false,producer});
console.log(JSON.stringify({pass,result,sourceManifest,browserSummary:browser?.summary,captures:captures.length}));if(!pass)process.exitCode=1;
