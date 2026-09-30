// node commit-source.mjs D227_DOCS_COMMIT
// Commit exactly four reviewed D228 owners after actual TS/core units/browser and eight root views.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [predecessor]=process.argv.slice(2);assert.equal(process.argv.length,3);assert.match(predecessor,/^[a-f0-9]{40}$/u);
assert.equal(predecessor,'b923f1d66eb957539cc500c58dde54e2bba3665a');
const self=fileURLToPath(import.meta.url),base=path.dirname(self),out=path.join(base,'actual-a2'),root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const proposalFiles=[
  {path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'23f9388f558e26315e6cfae4ff90ef8fe02c9e99d878fd8c224da622865a07a7'},
  {path:'apps/admin/lib/booky-journey-draft.test.ts',sha256:'7e48bc4080029f4143466f20be1232f158a98269238ca8ebc12c60ba73d8de41'},
  {path:'apps/admin/lib/booky-journey-draft.ts',sha256:'998eb8c1bb89f535381a31c5410e6b074d6c5b684982dc77dbd098f645e959aa'},
  {path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'f6c086469a650cb193ea5a7b978694c81b2d160ae9cca80b1b5790fdee162ed9'},
];
const expectedCoreTests=36;
assert(Number.isInteger(expectedCoreTests)&&expectedCoreTests>28);
const effectiveProposalFiles=proposalFiles.map(f=>f.path==='apps/admin/lib/booky-journey-draft.ts'?{...f,sha256:'ffcb6b2ef5564ae161df7fd89022fd400de592ae548824530f421f4d5878b2a1'}:{...f});
const paths=proposalFiles.map(f=>f.path),sha=b=>createHash('sha256').update(b).digest('hex'),norm=p=>path.normalize(p).replaceAll('\\','/'),at=p=>path.isAbsolute(p)?p:path.join(root,p);
const hash=async p=>sha(await fs.readFile(p)),ref=async p=>({path:norm(p),sha256:await hash(p)});
const bytes=async r=>{assert.match(r.sha256,/^[a-f0-9]{64}$/u);const b=await fs.readFile(at(r.path));assert.equal(sha(b),r.sha256,r.path);return b;};
const checked=async r=>JSON.parse(await bytes(r));
const sameRef=(a,b)=>{assert.equal(norm(path.resolve(at(a.path))),norm(path.resolve(at(b.path))));assert.equal(a.sha256,b.sha256);};
const env={...process.env,GIT_CONFIG_PARAMETERS:"'core.autocrlf=true'"};
const git=args=>{const r=spawnSync('git',args,{cwd:root,env,windowsHide:true,encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout.trim();};
const producer=await ref(self),checksRef=await ref(path.join(out,'checks-result.json')),checks=await checked(checksRef);
assert.equal(checks.pass,true);assert.equal(checks.decision,'D228');assert.equal(checks.predecessorDocsCommit,predecessor);assert.equal(checks.sourceInputsUnchanged,true);
assert.deepEqual(checks.changedPaths,paths);assert.deepEqual(checks.newPaths,[]);assert.equal(checks.protectedInputCount,2097);assert.deepEqual(checks.proposalFiles,proposalFiles);assert.deepEqual(checks.effectiveProposalFiles,effectiveProposalFiles);assert.equal(checks.expectedCoreTests,expectedCoreTests);
assert.equal(checks.unitExecuted,true);for(const k of ['helperUnitExecuted','catalogSmokeExecuted','mobileBuildExecuted','authenticatedAdminSession','liveSupabaseTested','stageAccepted','releaseReady'])assert.equal(checks[k],false);assert.equal(checks.mobileRuntimeUnchanged,true);
assert.equal(git(['rev-parse','HEAD']),predecessor);assert.equal(git(['diff','--cached','--name-only']),'');assert.equal(git(['ls-files','--others','--exclude-standard']),'');
assert.equal(checks.predecessorResult.sha256,'17e9b482a99376f881c9fbaaaf2abcc525c16ab634a8ef0eef40f605666e504f');const previous=await checked(checks.predecessorResult);assert.equal(previous.decision,'D227');assert.equal(previous.pass,true);assert.equal(previous.sourceCommit,'2da623326f0ef20167cd44049587e23fb76c4e1f');assert.equal(git(['rev-parse',predecessor+'^']),previous.sourceCommit);
assert.equal(checks.retainedD227Checks.sha256,'54578d3b6712f6db4ead98183df0bd4654364bbc7551041e428dda5f7f39ae20');const baseline=await checked(checks.retainedD227Checks);assert.equal(baseline.pass,true);
const prior=await checked(baseline.sourceManifest),manifest=await checked(checks.sourceManifest);assert.equal(manifest.checkpoint,predecessor);assert.equal(manifest.files.length,2101);assert.equal(new Set(manifest.files.map(f=>f.path)).size,2101);
assert.deepEqual(manifest.files.map(f=>f.path),prior.files.map(f=>f.path));assert.deepEqual(prior.files.filter(f=>manifest.files.find(m=>m.path===f.path).sha256!==f.sha256).map(f=>f.path),paths);
for(const f of manifest.files){assert.ok(!path.isAbsolute(f.path)&&!f.path.split(/[\\/]/u).includes('..'));assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);}
for(const f of effectiveProposalFiles){assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);assert.equal(await hash(path.join(base,'proposed',f.path)),f.sha256);}
const correction=await checked(checks.runtimeCorrection);assert.equal(correction.pass,true);assert.equal(correction.path,'apps/admin/lib/booky-journey-draft.ts');assert.equal(correction.beforeSha256,proposalFiles[2].sha256);assert.equal(correction.afterSha256,effectiveProposalFiles[2].sha256);sameRef(correction.finalManifest,checks.sourceManifest);
for(const k of ['testSourceUnchanged','uiSourceUnchanged','browserSourceUnchanged','typecheckRerun','coreUnitRerun','browserFirstRun'])assert.equal(correction[k],true);
const originalManifest=await checked(correction.originalManifest);assert.equal(correction.originalManifest.sha256,'97f2bdb3222a0592122b2c9e4d5ccf1a01e975e79b9f4e9ec6ab710cb05d32b5');assert.deepEqual(originalManifest.files.map(f=>f.path),manifest.files.map(f=>f.path));assert.deepEqual(originalManifest.files.filter(f=>manifest.files.find(m=>m.path===f.path).sha256!==f.sha256).map(f=>f.path),[correction.path]);
sameRef(correction.failedChecks,checks.failedAttempt);assert.equal(checks.failedAttempt.sha256,'f6970da3d146d2604f67b67b156e0b182ae796b1ad9be0b260726c85144a762a');const failed=await checked(checks.failedAttempt),failedUnit=await checked(correction.failedUnit),failedReport=await checked(failedUnit.report),originalTypecheck=await checked(correction.originalTypecheck);assert.equal(failed.pass,false);assert.equal(failed.sourceInputsUnchanged,true);sameRef(failed.sourceManifest,correction.originalManifest);sameRef(failed.unit,correction.failedUnit);sameRef(failed.typecheck,correction.originalTypecheck);assert.equal(failed.browser,null);assert.deepEqual(failed.captures,[]);assert.equal(failedUnit.pass,false);assert.deepEqual(failedUnit.summary,{total:36,passed:35,failed:1,pending:0});assert.equal(failedReport.success,false);assert.equal(originalTypecheck.pass,true);for(const run of [failedUnit,originalTypecheck]){await bytes(run.stdout);await bytes(run.stderr);}await bytes(correction.originalApplyProducer);await bytes(correction.producer);
const before=await checked(checks.sourceBefore),after=await checked(checks.sourceAfter);assert.deepEqual(before,after);assert.equal(before.head,predecessor);assert.deepEqual(before.files,manifest.files);
for(const k of ['typecheck','unit','browser']){const run=await checked(checks[k]);assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);sameRef(run.sourceManifest,checks.sourceManifest);await bytes(run.stdout);await bytes(run.stderr);
  if(k==='unit'){assert.deepEqual(run.files,['apps/admin/lib/booky-journey-draft.test.ts']);assert.deepEqual(run.summary,{total:expectedCoreTests,passed:expectedCoreTests,failed:0,pending:0});const report=await checked(run.report);assert.equal(report.success,true);assert.deepEqual([report.numTotalTests,report.numPassedTests,report.numFailedTests,report.numPendingTests],[expectedCoreTests,expectedCoreTests,0,0]);assert.equal(report.testResults.length,1);assert.equal(report.testResults[0].assertionResults.length,expectedCoreTests);assert(report.testResults[0].assertionResults.every(a=>a.status==='passed'));}
  if(k==='browser'){assert.deepEqual(run.summary,{cases:3,passed:3,failed:0,skipped:0,flaky:0});const report=await checked(run.report);assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[3,0,0,0]);}}
const helper=checks.retainedHelper;assert.equal(helper.decision,'D226');assert.equal(helper.passed,18);assert.equal(helper.rerun,false);assert.equal(helper.helperOwnBytesUnchanged,true);assert.equal(helper.coreDependencyChanged,true);assert.equal(helper.currentParserCoverageClaimed,false);
sameRef(helper.unit,baseline.retainedUnit.unit);sameRef(helper.report,baseline.retainedUnit.report);const oldUnit=await checked(helper.unit),oldReport=await checked(helper.report);sameRef(oldUnit.report,helper.report);sameRef(oldUnit.sourceManifest,helper.sourceManifest);
assert.equal(oldUnit.pass,true);assert.deepEqual(oldUnit.summary,{total:46,passed:46,failed:0,pending:0});assert.equal(oldReport.success,true);assert.deepEqual([oldReport.numTotalTests,oldReport.numPassedTests,oldReport.numFailedTests,oldReport.numPendingTests],[46,46,0,0]);
assert.equal(oldReport.testResults.length,2);assert.deepEqual(oldReport.testResults.map(r=>r.assertionResults.length).sort((a,b)=>a-b),[18,28]);for(const row of oldReport.testResults)assert(row.assertionResults.every(a=>a.status==='passed'));
assert.deepEqual(helper.files.map(f=>f.path),['apps/admin/lib/booky-journey-activity-validation.test.ts','apps/admin/lib/booky-journey-activity-validation.ts']);
assert.equal(oldReport.testResults.find(r=>norm(r.name).endsWith('/apps/admin/lib/booky-journey-activity-validation.test.ts')).assertionResults.length,18);
for(const f of helper.files)assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256,f.path);
const action=checks.retainedAction;assert.deepEqual(action,baseline.retainedAction);assert.equal(action.decision,'D225');assert.equal(action.passed,10);assert.equal(action.rerun,false);assert.equal(action.parserCoverageClaimed,false);
for(const f of action.files)assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256,f.path);
const retainedSmoke=checks.retainedHistoricalFactSmoke;assert.equal(retainedSmoke.decision,'D226');assert.equal(retainedSmoke.rerun,false);assert.equal(retainedSmoke.historicalOnly,true);assert.equal(retainedSmoke.currentCoreCompatibilityClaimed,false);
assert.equal(retainedSmoke.result.sha256,'9c411b7b8ee5705ebada165092ad257b28d510eb9f3ecb0afd924baf8dd498d8');sameRef(retainedSmoke.result,baseline.retainedFactSmoke.result);
const smoke=await checked(retainedSmoke.result),imports=await checked(retainedSmoke.importManifest);assert.equal(smoke.pass,true);assert.equal(smoke.sourceInputsUnchanged,true);assert.equal(smoke.evaluatedWorkCount,1);assert.equal(smoke.evaluatedChoiceCount,2);assert.equal(smoke.factualClaimsVerified,false);assert.equal(smoke.sourcesFetched,false);
sameRef(retainedSmoke.importManifest,smoke.sourceManifest);sameRef(retainedSmoke.sourceManifest,smoke.currentSourceManifest);assert.equal(retainedSmoke.sourceManifest.sha256,'3a8786ad17ed5e192b9958997bc7f70209b7bb5f16daf19661ad5b52eec9da67');
for(const r of checks.retentionRefs)await bytes(r);await bytes(checks.producer);
const visualRef=await ref(path.join(out,'root-visual-review.json')),visual=await checked(visualRef);assert.equal(visual.pass,true);assert.equal(visual.directRootViews,8);assert.equal(visual.screenshots.length,8);assert.equal(new Set(visual.screenshots.map(r=>r.path)).size,8);
sameRef(visual.sourceManifest,checks.sourceManifest);sameRef(visual.browser,checks.browser);assert.equal(checks.captures.length,8);
assert.deepEqual(visual.screenshots.map(r=>norm(path.resolve(at(r.path)))).sort(),checks.captures.map(r=>norm(path.resolve(at(r.path)))).sort());
for(const r of visual.screenshots){const capture=checks.captures.find(c=>norm(path.resolve(at(c.path)))===norm(path.resolve(at(r.path))));assert.equal(r.sha256,capture.sha256);await bytes(r);}
assert.deepEqual(git(['diff','--name-only']).split('\n').filter(Boolean).sort(),paths);
git(['add','--',...paths]);assert.deepEqual(git(['diff','--cached','--name-only']).split('\n').sort(),paths);git(['commit','-m','feat(admin): author Booky caption and reduced copy variants']);
const sourceCommit=git(['rev-parse','HEAD']);assert.equal(git(['rev-parse',sourceCommit+'^']),predecessor);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');assert.deepEqual(git(['diff','--name-only',predecessor,sourceCommit]).split('\n').sort(),paths);
const blobs=[];for(const p of paths){const run=spawnSync('git',['cat-file','blob',`${sourceCommit}:${p}`],{cwd:root,env,windowsHide:true,maxBuffer:64*1024*1024});assert.equal(run.status,0);const raw=await fs.readFile(path.join(root,p));assert.equal(raw.toString('utf8').replaceAll('\r\n','\n'),run.stdout.toString('utf8').replaceAll('\r\n','\n'));blobs.push({path:p,workingSha256:sha(raw),gitBlobSha256:sha(run.stdout)});}
for(const f of manifest.files)assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);for(const r of checks.retentionRefs)await bytes(r);for(const r of [checks.runtimeCorrection,checks.failedAttempt,correction.originalManifest,correction.failedUnit,failedUnit.report,correction.originalTypecheck,correction.originalApplyProducer,correction.producer])await bytes(r);await bytes(checksRef);await bytes(visualRef);assert.equal(await hash(self),producer.sha256);
const receipt={pass:true,decision:'D228',sourceCommit,predecessorDocsCommit:predecessor,predecessorResult:checks.predecessorResult,sourceManifest:checks.sourceManifest,changedPaths:paths,newPaths:[],protectedInputCount:2097,proposalFiles,effectiveProposalFiles,runtimeCorrection:checks.runtimeCorrection,failedAttempt:checks.failedAttempt,expectedCoreTests,blobs,checks:checksRef,visual:visualRef,
  retainedHelper:helper,retainedAction:action,retainedHistoricalFactSmoke:retainedSmoke,retainedD227Checks:checks.retainedD227Checks,
  sourceInputsUnchanged:true,worktreeClean:true,mobileRuntimeUnchanged:true,adminBuildPending:true,unitExecuted:true,helperUnitExecuted:false,catalogSmokeExecuted:false,authenticatedAdminSession:false,stageAccepted:false,releaseReady:false,producer};
const target=path.join(out,'actual-source-commit.json');await fs.writeFile(target,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,sourceCommit,sourceManifest:checks.sourceManifest,receipt:await ref(target)}));
