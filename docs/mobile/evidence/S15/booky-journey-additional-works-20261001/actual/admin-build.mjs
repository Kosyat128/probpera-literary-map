import fs from 'node:fs/promises';
// Proposal hashes bind the frozen external proposals; root acceptance is required before execution.
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// node admin-build.mjs SOURCE_COMMIT MANIFEST_PATH MANIFEST_SHA RECEIPT_PATH RECEIPT_SHA
const [sourceCommit, manifestArg, manifestSha, receiptArg, receiptSha] = process.argv.slice(2);
assert.equal(process.argv.length, 7, 'Supply the committed source, final manifest and source-commit receipt.');
assert.match(sourceCommit, /^[a-f0-9]{40}$/);
for (const digest of [manifestSha, receiptSha]) assert.match(digest, /^[a-f0-9]{64}$/);
const self = fileURLToPath(import.meta.url), base = path.dirname(self);
const bindingPath=path.join(base,'predecessor-binding.json'),binding=JSON.parse(await fs.readFile(bindingPath,'utf8'));
assert.equal(binding.schemaVersion,1);assert.equal(binding.decision,'D238');assert.match(binding.docsCommit,/^[a-f0-9]{40}$/u);assert.match(binding.result.sha256,/^[a-f0-9]{64}$/u);
const canonical = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const root = await fs.realpath(canonical), admin = path.join(root, 'apps/admin');
const out = path.join(base, 'admin-build-a1'), temp = path.join(root, '.tmp/admin-journey-additional-works-build-a1');
const normalize = p => path.normalize(p).replaceAll('\\', '/');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = async p => sha(await fs.readFile(p));
const ref = async p => ({ path: normalize(p), sha256: await hash(p) });
const at=p=>path.isAbsolute(p)?p:path.join(root,p);
const bytes=async r=>{assert.match(r.sha256,/^[a-f0-9]{64}$/u);const data=await fs.readFile(at(r.path));assert.equal(sha(data),r.sha256,r.path);return data;};
const checked=async r=>JSON.parse(await bytes(r));
const sameRef=(a,b)=>{assert.equal(normalize(path.resolve(at(a.path))),normalize(path.resolve(at(b.path))));assert.equal(a.sha256,b.sha256);};

async function authenticateOriginalD237(unitRef,manifestRef){
  assert.equal(manifestRef.sha256,'1ee71b640b711d5c4da048913518d01583ecdc69bc0bd9288be8e005f072c5ea');
  const run=await checked(unitRef),report=await checked(run.report),manifest=await checked(manifestRef);
  assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);assert.equal(run.sourceManifest.sha256,manifestRef.sha256);assert.deepEqual(await checked(run.sourceManifest),manifest);await bytes(run.stdout);await bytes(run.stderr);
  assert.deepEqual(run.files,[unitFile]);assert.deepEqual(run.summary,{total:57,passed:57,failed:0,pending:0});assert.equal(report.success,true);assert.deepEqual([report.numTotalTests,report.numPassedTests,report.numFailedTests,report.numPendingTests],[57,57,0,0]);assert.equal(report.testResults.length,1);assert.equal(report.testResults[0].assertionResults.length,57);assert.ok(path.normalize(report.testResults[0].name).replaceAll('\\','/').endsWith('/'+unitFile));assert(report.testResults[0].assertionResults.every(a=>a.status==='passed'));
  assert.equal(manifest.files.length,2101);assert.equal(new Set(manifest.files.map(f=>f.path)).size,2101);
  assert.equal(manifest.files.find(f=>f.path===coreFile).sha256,'6de630ea2e713cb94d42354b3f7b674e4299ed00e849c9ec0edb08cc2c7bc37e');assert.equal(manifest.files.find(f=>f.path===unitFile).sha256,'b7e77f8289527deb4562070ef91d136db04a5c9663f3ad1cfae7aff5b4c9e66b');
  assert.deepEqual(run.command.slice(1),[path.join(root,'node_modules/vitest/vitest.mjs'),'run',unitFile,'--reporter=json','--outputFile='+path.join(path.dirname(base),'s15-booky-journey-prerequisites-review','actual-a1','unit-report.json')]);
  return {run,report,manifest,files:[unitFile,coreFile].map(p=>({...manifest.files.find(f=>f.path===p)}))};
}
function priorD238Retention(unitRef,manifestRef,validated){
  return {decision:'D237',passed:57,rerun:false,unit:unitRef,report:validated.run.report,sourceManifest:manifestRef,files:validated.files,
    originalUnitManifestRetained:true,currentCoreAndTestSourceUnchangedSinceD237:true,currentCoreRuntimeUnchanged:true,protectedDependenciesUnchanged:true,currentCoreCoverageClaimed:true,coversNewUi:false,boundedThroughDecision:'D238',nextActionRequiresFreshCoreUnitsAfterAuthorizedCoreChange:true};
}
async function authenticateHistoricalD230(history,erasure,expectedPaths){
  assert.equal(history.decision,'D230');assert.equal(history.passed,49);assert.equal(history.historicalOnly,true);for(const k of ['rerun','currentCoreCoverageClaimed','currentTestCoverageClaimed','currentCoreCompatibilityClaimed','coversNewUi'])assert.equal(history[k],false);
  assert.equal(history.sourceManifest.sha256,'b22f3d63a1f10a53084fa0a7d741c7e4b0a8385099a52a580d0804e02206b505');assert.equal(history.testTypeCorrection.sha256,'8a195fbfc0d4c11847b2aa0f2b40144d973e5411ef21b2e2026024f580797d39');assert.equal(history.lastCompatibleSourceManifest.sha256,'45a82dc9790865a48fbb1018cfd100da1fd04f81da4af9cc301944d8852d5805');
  const old=await checked(history.unit),report=await checked(history.report),manifest=await checked(history.sourceManifest),lastCompatible=await checked(history.lastCompatibleSourceManifest),correction=await checked(history.testTypeCorrection);
  assert.equal(old.pass,true);assert.equal(old.exitCode,0);assert.equal(old.error,null);assert.equal(old.report.sha256,history.report.sha256);assert.equal(old.sourceManifest.sha256,history.sourceManifest.sha256);assert.deepEqual(old.files,[unitFile]);assert.deepEqual(old.summary,{total:49,passed:49,failed:0,pending:0});await bytes(old.stdout);await bytes(old.stderr);
  assert.equal(report.success,true);assert.deepEqual([report.numTotalTests,report.numPassedTests,report.numFailedTests,report.numPendingTests],[49,49,0,0]);assert.equal(report.testResults.length,1);assert.equal(report.testResults[0].assertionResults.length,49);assert.ok(path.normalize(report.testResults[0].name).replaceAll('\\','/').endsWith('/'+unitFile));assert(report.testResults[0].assertionResults.every(a=>a.status==='passed'));
  assert.equal(correction.pass,true);assert.equal(correction.path,unitFile);assert.equal(correction.originalManifest.sha256,history.sourceManifest.sha256);assert.equal(correction.finalManifest.sha256,'a55eb3cac636a8d1f26ba2bb9520c022b766c67f1b4c6e071881243486a0abe4');assert.equal(correction.retainedCurrentUnit.sha256,history.unit.sha256);assert.equal(correction.beforeSha256,'7f47f474950a7117593dfdd69743ef5260311368c81716ff86db55c562c34b70');assert.equal(correction.afterSha256,'05a17d7c98e3027b4a935c5a72b1fb93d79abc75d6089a6bfac0882cc23c43e6');assert.equal(correction.unitRerun,false);assert.equal(correction.applicationSourceUnchanged,true);assert.equal(correction.emittedJavaScriptUnchanged,true);
  const corrected=await checked(correction.finalManifest);for(const m of [manifest,corrected,lastCompatible]){assert.equal(m.files.length,2101);assert.equal(new Set(m.files.map(f=>f.path)).size,2101);assert.deepEqual(m.files.map(f=>f.path),expectedPaths);}
  assert.deepEqual(manifest.files.filter(f=>f.path!==unitFile),corrected.files.filter(f=>f.path!==unitFile));assert.deepEqual(corrected.files.filter(f=>!legacyUiFixturePaths.includes(f.path)),lastCompatible.files.filter(f=>!legacyUiFixturePaths.includes(f.path)));
  assert.equal(manifest.files.find(f=>f.path===unitFile).sha256,correction.beforeSha256);assert.equal(lastCompatible.files.find(f=>f.path===unitFile).sha256,correction.afterSha256);assert.equal(lastCompatible.files.find(f=>f.path===coreFile).sha256,'eae1d1f0ddfe9ebce77fd2b0b0ae6fe1af8bcb6c3834cae5a70d553fcc19a5ea');
  assert.deepEqual(history.originalFiles,[unitFile,coreFile].map(p=>manifest.files.find(f=>f.path===p)));assert.deepEqual(history.lastCompatibleCoreAndTestFiles,[unitFile,coreFile].map(p=>lastCompatible.files.find(f=>f.path===p)));
  assert.equal(correction.erasureProof.sha256,'4764929773a7ccac1776f599e9ff1e485abef3abcf3ea2aa3161bc0f33b02ad5');const proof=await checked(correction.erasureProof);assert.equal(proof.pass,true);assert.equal(proof.changedPath,unitFile);assert.equal(proof.beforeSha256,correction.beforeSha256);assert.equal(proof.afterSha256,correction.afterSha256);assert.equal(proof.emittedJavaScriptUnchanged,true);assert.equal(proof.emittedJavaScriptSha256,'3558e7b8b16162a52a6b7c0558f73252341d14e18867e78a3a514e75abfad5c7');assert.equal(correction.emittedJavaScriptSha256,proof.emittedJavaScriptSha256);assert.equal(proof.transform.tool,'actual esbuild.transform');assert.deepEqual([proof.transform.options.target,proof.transform.options.loader,proof.transform.options.sourcefile],['es2020','ts',unitFile]);assert.deepEqual(await bytes(proof.emittedBefore),await bytes(proof.emittedAfter));assert.equal(proof.emittedBefore.sha256,proof.emittedJavaScriptSha256);assert.equal(proof.emittedAfter.sha256,proof.emittedJavaScriptSha256);for(const k of ['applicationSourceChanged','unitExecuted','browserExecuted','typecheckExecuted','canonicalWrites'])assert.equal(proof[k],false);
  assert.deepEqual(erasure,{decision:'D230',result:correction.erasureProof,testTypeCorrection:history.testTypeCorrection,historicalOnly:true,rerun:false,transformExecuted:false,currentCoreRuntimeEqualityClaimed:false,currentTestRuntimeEqualityClaimed:false,currentTestCoverageClaimed:false,beforeSha256:correction.beforeSha256,afterSha256:correction.afterSha256,emittedJavaScriptSha256:proof.emittedJavaScriptSha256});
  const historicalRefs=[history.unit,history.report,history.sourceManifest,history.testTypeCorrection,history.lastCompatibleSourceManifest,old.stdout,old.stderr,correction.finalManifest,correction.producer,proof.original,proof.corrected,proof.producer,proof.emittedBefore,proof.emittedAfter,erasure.result];for(const r of historicalRefs)await bytes(r);return historicalRefs;
}

function historicalD237Retention(current,lastRef,lastManifest){
  return {decision:'D237',passed:57,unit:current.unit,report:current.report,sourceManifest:current.sourceManifest,
    originalFiles:current.files,lastCompatibleSourceManifest:lastRef,lastCompatibleCoreAndTestFiles:[unitFile,coreFile].map(p=>({...lastManifest.files.find(f=>f.path===p)})),
    historicalOnly:true,rerun:false,currentCoreCoverageClaimed:false,currentTestCoverageClaimed:false,currentCoreCompatibilityClaimed:false,currentCoreRuntimeEqualityClaimed:false,currentTestRuntimeEqualityClaimed:false,coversNewUi:false};
}
async function authenticateHistoricalD237(history,expectedPaths){
  assert.equal(history.decision,'D237');assert.equal(history.passed,57);assert.equal(history.historicalOnly,true);
  for(const k of ['rerun','currentCoreCoverageClaimed','currentTestCoverageClaimed','currentCoreCompatibilityClaimed','currentCoreRuntimeEqualityClaimed','currentTestRuntimeEqualityClaimed','coversNewUi'])assert.equal(history[k],false);
  const original=await authenticateOriginalD237(history.unit,history.sourceManifest),last=await checked(history.lastCompatibleSourceManifest);
  assert.equal(history.lastCompatibleSourceManifest.sha256,'6fac7ba7cefbc3ce5e5c180a47f1d3857accf3d96358385fdc388ab749371713');assert.equal(history.report.sha256,original.run.report.sha256);assert.deepEqual(await checked(history.report),original.report);
  assert.equal(last.files.length,2101);assert.equal(new Set(last.files.map(f=>f.path)).size,2101);
  assert.deepEqual(original.manifest.files.map(f=>f.path),expectedPaths);assert.deepEqual(last.files.map(f=>f.path),expectedPaths);
  assert.deepEqual(original.manifest.files.filter(f=>!legacyUiFixturePaths.includes(f.path)),last.files.filter(f=>!legacyUiFixturePaths.includes(f.path)));
  assert.deepEqual(history.originalFiles,original.files);assert.deepEqual(history.lastCompatibleCoreAndTestFiles,[unitFile,coreFile].map(p=>last.files.find(f=>f.path===p)));
  for(const f of history.lastCompatibleCoreAndTestFiles)assert.equal(f.sha256,original.files.find(o=>o.path===f.path).sha256);
  const refs=[history.unit,history.report,history.sourceManifest,history.lastCompatibleSourceManifest,original.run.stdout,original.run.stderr];for(const r of refs)await bytes(r);return refs;
}
async function authenticateA2CoreUnit(unitRef,manifestRef,proposals,attempt='actual-a2'){
  const run=await checked(unitRef),report=await checked(run.report),manifest=await checked(manifestRef);
  assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);assert.equal(run.sourceManifest.sha256,manifestRef.sha256);assert.deepEqual(await checked(run.sourceManifest),manifest);await bytes(run.stdout);await bytes(run.stderr);
  assert.deepEqual(run.files,[unitFile]);assert.deepEqual(run.summary,{total:expectedCoreTests,passed:expectedCoreTests,failed:0,pending:0});
  assert.deepEqual(run.command,[process.execPath,path.join(root,'node_modules/vitest/vitest.mjs'),'run',unitFile,'--reporter=json','--outputFile='+path.join(base,attempt,'unit-report.json')]);
  assert.equal(report.success,true);assert.deepEqual([report.numTotalTests,report.numPassedTests,report.numFailedTests,report.numPendingTests],[expectedCoreTests,expectedCoreTests,0,0]);assert.equal(report.testResults.length,1);assert.ok(path.normalize(report.testResults[0].name).replaceAll('\\','/').endsWith('/'+unitFile));assert.equal(report.testResults[0].assertionResults.length,expectedCoreTests);assert(report.testResults[0].assertionResults.every(a=>a.status==='passed'));
  assert.equal(manifest.files.length,2101);assert.equal(new Set(manifest.files.map(f=>f.path)).size,2101);
  for(const p of [coreFile,unitFile])assert.equal(manifest.files.find(f=>f.path===p).sha256,proposals.find(f=>f.path===p).sha256);
  return {run,report,manifest};
}

async function authenticateA1Recovery(recovery,finalManifest,finalProposals){
  assert.equal(recovery.attempt,'a2');assert.equal(recovery.previousAttempt,'a1');assert.equal(recovery.reason,'TS7006');assert.equal(recovery.changedPath,coreFile);
  assert.equal(recovery.beforeSha256,'1416a6eb1163f03c59d991f36feeeec4e3fef2537a84bfd5a5ece4fa3eea28da');assert.equal(recovery.afterSha256,'1a1745979ac8280201ef152087b0792984832e77d5fbebda5cb195b8773d65bd');assert.equal(recovery.typeOnlyAnnotation,true);assert.equal(recovery.originalUnitHistoricalOnly,true);assert.equal(recovery.currentCoreCoverageClaimed,false);assert.equal(recovery.freshCoreUnitRequired,true);assert.equal(recovery.preservedInputCount,2100);
  assert.equal(recovery.originalChecks.sha256,'472d7fca56ee366b09d318f8d0f607a1c54a17a7c831a283a559841819ce54d0');
  const a1=await checked(recovery.originalChecks);assert.equal(a1.pass,false);assert.equal(a1.decision,'D239');assert.equal(a1.predecessorDocsCommit,binding.docsCommit);assert.equal(a1.expectedCoreTests,65);assert.equal(a1.typecheckExecuted,true);assert.equal(a1.unitExecuted,true);assert.equal(a1.sourceInputsUnchanged,true);assert.equal(a1.browser,null);assert.deepEqual(a1.captures,[]);
  assert.equal(a1.producer.sha256,'c3ed238aa306d95504eb4ac4bd8a0c1fd5d5f8c273124f8955157418af6bc7fb');assert.deepEqual(recovery.originalApplyProducer,a1.producer);assert.equal(await hash(path.join(base,'apply-and-check.mjs')),a1.producer.sha256);await bytes(a1.producer);
  assert.equal(a1.sourceManifest.sha256,'5130cabac936a53cdef38e3843cf2810875951961b00e82c00a44f262d5e5fff');assert.deepEqual(recovery.originalSourceManifest,a1.sourceManifest);assert.deepEqual(recovery.originalUnit,a1.unit);assert.deepEqual(recovery.originalTypecheck,a1.typecheck);
  const originalManifest=await checked(a1.sourceManifest),before=await checked(a1.sourceBefore),after=await checked(a1.sourceAfter);assert.deepEqual(before,after);assert.equal(before.head,binding.docsCommit);assert.deepEqual(before.files,originalManifest.files);
  const oldProposals=finalProposals.map(f=>({...f,sha256:f.path===coreFile?recovery.beforeSha256:f.sha256}));assert.deepEqual(a1.proposalFiles,oldProposals);assert.deepEqual(a1.changedPaths,paths);assert.equal(a1.protectedInputCount,2097);
  const originalUnit=await authenticateA2CoreUnit(a1.unit,a1.sourceManifest,oldProposals,'actual-a1');assert.equal(originalUnit.run.report.sha256,'aab5e6b2dd7ed5d5a1a9de33689f9258366e7328c5a93a8de0fdbbb42a14ab3a');assert.deepEqual(recovery.originalUnitReport,originalUnit.run.report);
  const failed=await checked(a1.typecheck);assert.equal(failed.pass,false);assert.equal(failed.exitCode,2);assert.equal(failed.error,null);assert.equal(failed.sourceManifest.sha256,a1.sourceManifest.sha256);
  assert.deepEqual(failed.command.slice(1),[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(root,'apps/admin/tsconfig.json'),'--incremental','false','--pretty','false']);
  assert.equal((await bytes(failed.stdout)).toString('utf8').replaceAll('\r\n','\n').trim(),"apps/admin/lib/booky-journey-draft.ts(417,127): error TS7006: Parameter 'item' implicitly has an 'any' type.");assert.equal((await bytes(failed.stderr)).length,0);
  const originalCore=await bytes(recovery.originalCore),correctedCore=await bytes(recovery.correctedCore);assert.equal(recovery.originalCore.sha256,recovery.beforeSha256);assert.equal(recovery.correctedCore.sha256,recovery.afterSha256);
  const oldText=originalCore.toString('utf8'),oldSnippet='writer.works.find(item => item.id === row.workId)',newSnippet='writer.works.find((item: JourneyDraftCatalog["countries"][number]["writers"][number]["works"][number]) => item.id === row.workId)';
  assert.equal(oldText.split(oldSnippet).length,2);assert.equal(correctedCore.toString('utf8'),oldText.replace(oldSnippet,newSnippet));
  assert.deepEqual(finalManifest.files.map(f=>f.path),originalManifest.files.map(f=>f.path));assert.deepEqual(finalManifest.files.filter(f=>f.path!==coreFile),originalManifest.files.filter(f=>f.path!==coreFile));assert.equal(finalManifest.files.find(f=>f.path===coreFile).sha256,recovery.afterSha256);
  return {a1,originalManifest,originalUnit,failed,refs:[recovery.originalChecks,a1.sourceManifest,a1.sourceBefore,a1.sourceAfter,a1.producer,a1.unit,originalUnit.run.report,originalUnit.run.stdout,originalUnit.run.stderr,a1.typecheck,failed.stdout,failed.stderr,recovery.originalCore,recovery.correctedCore]};
}

const browserFile='tests/host/booky-journey-authoring.spec.mjs';
function a3UnitRetention(a2,validated){return {decision:'D239',passed:65,unit:a2.unit,report:validated.run.report,sourceManifest:a2.sourceManifest,files:[unitFile,coreFile].map(p=>({...validated.manifest.files.find(f=>f.path===p)})),originalUnitManifestRetained:true,currentCoreAndTestSourceUnchangedSinceA2:true,currentCoreRuntimeUnchanged:true,protectedDependenciesUnchanged:true,currentCoreCoverageClaimed:true,rerun:false,coversNewFixture:false,boundedThroughDecision:'D239',boundedThroughAttempt:'a3',excludedChangedPaths:[browserFile],nextCoreChangeRequiresFreshUnits:true};}
function a3TypecheckRetention(a2){return {decision:'D239',result:a2.typecheck,sourceManifest:a2.sourceManifest,originalTypecheckManifestRetained:true,currentTypeScriptSourceUnchangedSinceA2:true,protectedDependenciesUnchanged:true,currentTypecheckCoverageClaimed:true,rerun:false,coversNewFixture:false,boundedThroughDecision:'D239',boundedThroughAttempt:'a3',excludedChangedPaths:[browserFile],nextTypeScriptChangeRequiresFreshTypecheck:true};}
async function authenticateA3FixtureRecovery(fixtureRecovery,typeRecovery,finalManifest,finalProposals,correctedFixtureWitness=null){
  assert.equal(fixtureRecovery.attempt,'a3');assert.equal(fixtureRecovery.previousAttempt,'a2');assert.equal(fixtureRecovery.reason,'native-option-disabled-matcher');assert.equal(fixtureRecovery.changedPath,browserFile);assert.equal(fixtureRecovery.beforeSha256,'ccbd20162e0f39a3fb53fa7f95e5101ed4eb7c129853cfc6d817755ff0372a90');assert.equal(fixtureRecovery.afterSha256,'a461c48613d725d15b7c3e6a1746f6f5ec09ad7a7bb6ea464ed178914fada35e');assert.equal(fixtureRecovery.matcherCorrectionOnly,true);assert.equal(fixtureRecovery.exactSubstitutionCount,4);assert.equal(fixtureRecovery.preservedInputCount,2100);
  assert.equal(fixtureRecovery.originalChecks.sha256,'feaae512fb24e0496626c84e3039642f1c335cd7cba9191d77bf4858ac71ce58');const a2=await checked(fixtureRecovery.originalChecks);
  assert.equal(a2.pass,false);assert.equal(a2.decision,'D239');assert.equal(a2.attempt,'a2');assert.equal(a2.predecessorDocsCommit,binding.docsCommit);assert.equal(a2.typecheckExecuted,true);assert.equal(a2.unitExecuted,true);assert.equal(a2.expectedCoreTests,65);assert.equal(a2.sourceInputsUnchanged,true);assert.equal(a2.captures.length,9);
  assert.equal(a2.producer.sha256,'dc2e736e0b0902d3843df65d7b4e5e43a97983152b7c0579a110e3eaa41a9c71');assert.deepEqual(fixtureRecovery.originalProducer,a2.producer);assert.equal(await hash(path.join(base,'recover-a2-and-check.mjs')),a2.producer.sha256);await bytes(a2.producer);
  assert.equal(a2.sourceManifest.sha256,'2f027f828b117f1a5ed54bc2fe0573807a31c2f47ec1f3d75a4dec4c2e93b428');assert.deepEqual(fixtureRecovery.originalSourceManifest,a2.sourceManifest);assert.deepEqual(fixtureRecovery.originalBrowser,a2.browser);assert.deepEqual(fixtureRecovery.originalUnit,a2.unit);assert.deepEqual(fixtureRecovery.originalTypecheck,a2.typecheck);assert.deepEqual(typeRecovery,a2.recovery);
  const oldProposals=finalProposals.map(f=>({...f,sha256:f.path===browserFile?fixtureRecovery.beforeSha256:f.sha256}));assert.deepEqual(a2.proposalFiles,oldProposals);assert.deepEqual(a2.changedPaths,paths);assert.equal(a2.protectedInputCount,2097);
  const validated=await authenticateA2CoreUnit(a2.unit,a2.sourceManifest,oldProposals),manifest=validated.manifest,typecheck=await checked(a2.typecheck);
  assert.equal(typecheck.pass,true);assert.equal(typecheck.exitCode,0);assert.equal(typecheck.error,null);assert.equal(typecheck.sourceManifest.sha256,a2.sourceManifest.sha256);await bytes(typecheck.stdout);await bytes(typecheck.stderr);
  assert.deepEqual(typecheck.command.slice(1),[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(root,'apps/admin/tsconfig.json'),'--incremental','false','--pretty','false']);
  const browser=await checked(a2.browser),report=await checked(browser.report);assert.equal(browser.pass,false);assert.equal(browser.exitCode,1);assert.equal(browser.error,null);assert.equal(browser.sourceManifest.sha256,a2.sourceManifest.sha256);assert.deepEqual(browser.summary,{cases:3,passed:2,failed:1,skipped:0,flaky:0});assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[2,1,0,0]);await bytes(browser.stdout);await bytes(browser.stderr);for(const r of a2.captures)await bytes(r);
  const before=await checked(a2.sourceBefore),after=await checked(a2.sourceAfter);assert.deepEqual(before,after);assert.equal(before.head,binding.docsCommit);assert.deepEqual(before.files,manifest.files);
  const typeLineage=await authenticateA1Recovery(typeRecovery,manifest,oldProposals);
  if(correctedFixtureWitness)assert.equal(correctedFixtureWitness.sha256,fixtureRecovery.correctedFixture.sha256);
  const original=await bytes(fixtureRecovery.originalFixture),corrected=await bytes(correctedFixtureWitness??fixtureRecovery.correctedFixture);assert.equal(fixtureRecovery.originalFixture.sha256,fixtureRecovery.beforeSha256);assert.equal(fixtureRecovery.correctedFixture.sha256,fixtureRecovery.afterSha256);
  let text=original.toString('utf8');const replacements=[{selector:'additionalSelect(0)',value:'work-a',count:1},{selector:'additionalSelect(1)',value:'extra-alpha',count:2},{selector:'additionalSelect(0)',value:'extra-beta',count:1}];
  for(const r of replacements){const old="expect("+r.selector+".locator('option[value=\""+r.value+"\"]')).toBeDisabled()",next="expect("+r.selector+".locator('option[value=\""+r.value+"\"]')).toHaveAttribute('disabled', '')";assert.equal(text.split(old).length,r.count+1);text=text.replaceAll(old,next);}assert.equal(corrected.toString('utf8'),text);
  assert.deepEqual(finalManifest.files.map(f=>f.path),manifest.files.map(f=>f.path));assert.deepEqual(finalManifest.files.filter(f=>f.path!==browserFile),manifest.files.filter(f=>f.path!==browserFile));assert.equal(finalManifest.files.find(f=>f.path===browserFile).sha256,fixtureRecovery.afterSha256);
  return {a2,validated,unit:a3UnitRetention(a2,validated),typecheck:a3TypecheckRetention(a2),refs:[...typeLineage.refs,fixtureRecovery.originalChecks,a2.sourceManifest,a2.producer,a2.unit,validated.run.report,validated.run.stdout,validated.run.stderr,a2.typecheck,typecheck.stdout,typecheck.stderr,a2.browser,browser.report,browser.stdout,browser.stderr,a2.sourceBefore,a2.sourceAfter,...a2.captures,fixtureRecovery.originalFixture,correctedFixtureWitness??fixtureRecovery.correctedFixture]};
}

async function authenticateA4FixtureRecovery(fixtureRecovery,typeRecovery,finalManifest,finalProposals){
  assert.equal(fixtureRecovery.attempt,'a4');assert.equal(fixtureRecovery.previousAttempt,'a3');assert.equal(fixtureRecovery.reason,'direct-summary-scope');assert.equal(fixtureRecovery.changedPath,browserFile);assert.equal(fixtureRecovery.beforeSha256,'a461c48613d725d15b7c3e6a1746f6f5ec09ad7a7bb6ea464ed178914fada35e');assert.equal(fixtureRecovery.afterSha256,'ae300a572b9d5432e91383182ebd781e6febfa7d4f9538886ca225648cfed106');assert.equal(fixtureRecovery.scopeCorrectionOnly,true);assert.equal(fixtureRecovery.exactSubstitutionCount,6);assert.equal(fixtureRecovery.preservedInputCount,2100);assert.equal(fixtureRecovery.previousCorrectedFixtureWitnessUsed,true);
  assert.equal(fixtureRecovery.originalChecks.sha256,'cc5a8d142f36caf7dee867b6081d4b3471f2ae559d3aa5d4d4423c547217a5dc');const a3=await checked(fixtureRecovery.originalChecks);assert.equal(a3.pass,false);assert.equal(a3.decision,'D239');assert.equal(a3.attempt,'a3');assert.equal(a3.predecessorDocsCommit,binding.docsCommit);assert.equal(a3.typecheckExecuted,false);assert.equal(a3.unitExecuted,false);assert.equal(a3.browserExecuted,true);assert.equal(a3.expectedCoreTests,65);assert.equal(a3.sourceInputsUnchanged,true);assert.equal(a3.captures.length,9);assert.equal(Object.hasOwn(a3,'unit'),false);assert.equal(Object.hasOwn(a3,'typecheck'),false);
  assert.equal(a3.producer.sha256,'edbcf8bbccaed844cd4c6a995cb388a404fdcccc1bd3cb763db88ee924815840');assert.deepEqual(fixtureRecovery.originalProducer,a3.producer);assert.equal(await hash(path.join(base,'recover-a3-and-check.mjs')),a3.producer.sha256);await bytes(a3.producer);
  assert.equal(a3.sourceManifest.sha256,'46bd884fefd5067702368638ccfeabbf8210fb59c9d8bb21cfde1ddd1fb203db');assert.deepEqual(fixtureRecovery.originalSourceManifest,a3.sourceManifest);assert.deepEqual(fixtureRecovery.originalBrowser,a3.browser);assert.deepEqual(fixtureRecovery.inheritedMatcherRecovery,a3.fixtureRecovery);assert.deepEqual(typeRecovery,a3.recovery);
  const oldProposals=finalProposals.map(f=>({...f,sha256:f.path===browserFile?fixtureRecovery.beforeSha256:f.sha256}));assert.deepEqual(a3.proposalFiles,oldProposals);assert.deepEqual(a3.changedPaths,paths);assert.equal(a3.protectedInputCount,2097);const manifest=await checked(a3.sourceManifest);
  const inherited=await authenticateA3FixtureRecovery(a3.fixtureRecovery,a3.recovery,manifest,oldProposals,fixtureRecovery.originalFixture);assert.deepEqual(a3.retainedCurrentD239Unit,inherited.unit);assert.deepEqual(a3.retainedCurrentD239Typecheck,inherited.typecheck);
  const browser=await checked(a3.browser),report=await checked(browser.report);assert.equal(browser.pass,false);assert.equal(browser.exitCode,1);assert.equal(browser.error,null);assert.equal(browser.sourceManifest.sha256,a3.sourceManifest.sha256);assert.deepEqual(browser.summary,{cases:3,passed:2,failed:1,skipped:0,flaky:0});assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[2,1,0,0]);await bytes(browser.stdout);await bytes(browser.stderr);for(const r of a3.captures)await bytes(r);
  const before=await checked(a3.sourceBefore),after=await checked(a3.sourceAfter);assert.deepEqual(before,after);assert.equal(before.head,binding.docsCommit);assert.deepEqual(before.files,manifest.files);
  const original=await bytes(fixtureRecovery.originalFixture),corrected=await bytes(fixtureRecovery.correctedFixture);assert.equal(fixtureRecovery.originalFixture.sha256,fixtureRecovery.beforeSha256);assert.equal(fixtureRecovery.correctedFixture.sha256,fixtureRecovery.afterSha256);
  const oldSnippet="additionalPanel.locator('summary')",newSnippet="additionalPanel.locator(':scope > summary')",text=original.toString('utf8');assert.equal(text.split(oldSnippet).length,7);assert.equal(corrected.toString('utf8'),text.replaceAll(oldSnippet,newSnippet));
  assert.deepEqual(finalManifest.files.map(f=>f.path),manifest.files.map(f=>f.path));assert.deepEqual(finalManifest.files.filter(f=>f.path!==browserFile),manifest.files.filter(f=>f.path!==browserFile));assert.equal(finalManifest.files.find(f=>f.path===browserFile).sha256,fixtureRecovery.afterSha256);
  return {a3,unit:{...inherited.unit,boundedThroughAttempt:'a4'},typecheck:{...inherited.typecheck,boundedThroughAttempt:'a4'},refs:[...inherited.refs,fixtureRecovery.originalChecks,a3.sourceManifest,a3.producer,a3.browser,browser.report,browser.stdout,browser.stderr,a3.sourceBefore,a3.sourceAfter,...a3.captures,fixtureRecovery.originalFixture,fixtureRecovery.correctedFixture]};
}

const producer=await ref(self),expectedCoreTests=Number('65');assert.ok(Number.isInteger(expectedCoreTests)&&expectedCoreTests>57);
const write = async (name, value) => {
  const p = path.join(out, name);
  await fs.writeFile(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  return ref(p);
};
const manifestPath = await fs.realpath(manifestArg), receiptPath = await fs.realpath(receiptArg);
assert.equal(await hash(manifestPath), manifestSha, 'Final manifest hash');
assert.equal(await hash(receiptPath), receiptSha, 'Source-commit receipt hash');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
assert.equal(receipt.pass, true, 'Source commit must have passed');
assert.equal(receipt.decision, 'D239');
assert.equal(receipt.sourceCommit, sourceCommit);
assert.equal(receipt.predecessorDocsCommit,binding.docsCommit);assert.equal(receipt.predecessorResult.sha256,binding.result.sha256);assert.equal(receipt.predecessorBinding.sha256,await hash(bindingPath));
sameRef(receipt.predecessorBinding,await ref(bindingPath));assert.equal(normalize(path.resolve(at(receipt.predecessorResult.path))),normalize(path.resolve(at(binding.result.path))));
assert.equal(receipt.typecheckExecuted,false);assert.equal(receipt.unitExecuted,false);assert.equal(receipt.browserExecuted,true);assert.equal(receipt.protectedInputCount,2097);assert.equal(receipt.expectedCoreTests,expectedCoreTests);
for(const k of ['helperUnitExecuted','catalogSmokeExecuted','authenticatedAdminSession','stageAccepted','releaseReady'])assert.equal(receipt[k],false);
assert.equal(receipt.historicalD237CoreAndTestChanged,true);assert.equal(receipt.historicalD237CurrentCoverageClaimed,false);assert.equal(Object.hasOwn(receipt,'retainedCurrentD237Unit'),false);assert.equal(receipt.historicalD230CoreAndTestChanged,true);assert.equal(Object.hasOwn(receipt,'unit'),false);assert.equal(Object.hasOwn(receipt,'typecheck'),false);assert.equal(receipt.historicalD230CurrentCoverageClaimed,false);assert.equal(receipt.erasureProofTransformExecuted,false);assert.equal(Object.hasOwn(receipt,'retainedUnit'),false);
const proposalFiles=[
  {path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'bdc5d14b1b0cdd48a212afee2d5e35ec24bb9d8017d76f8d072ef874322becb5'},
  {path:'apps/admin/lib/booky-journey-draft.test.ts',sha256:'d3960c53d3ad70144bb2a81ab119af99acac3fe4dc5c8c2b7df9d99a0670c885'},
  {path:'apps/admin/lib/booky-journey-draft.ts',sha256:'1a1745979ac8280201ef152087b0792984832e77d5fbebda5cb195b8773d65bd'},
  {path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'ae300a572b9d5432e91383182ebd781e6febfa7d4f9538886ca225648cfed106'},
];
for(const f of proposalFiles)assert.match(f.sha256,/^[a-f0-9]{64}$/u);
const paths=proposalFiles.map(f=>f.path),unitFile='apps/admin/lib/booky-journey-draft.test.ts',coreFile='apps/admin/lib/booky-journey-draft.ts',legacyUiFixturePaths=['apps/admin/components/BookyJourneyDraftEditor.tsx','tests/host/booky-journey-authoring.spec.mjs'];
assert.deepEqual(receipt.changedPaths,paths);assert.deepEqual(receipt.newPaths,[]);assert.deepEqual(receipt.proposalFiles,proposalFiles);
assert.equal(receipt.sourceManifest?.sha256, manifestSha);
assert.equal(await fs.realpath(receipt.sourceManifest.path), manifestPath);
assert.ok(Array.isArray(manifest.files) && manifest.files.length === 2101);
assert.equal(new Set(manifest.files.map(f => f.path)).size, manifest.files.length);
assert.equal(manifest.checkpoint,binding.docsCommit);
for(const f of proposalFiles)assert.equal(manifest.files.find(m=>m.path===f.path)?.sha256,f.sha256);
for (const f of manifest.files) {
  assert.equal(typeof f.path, 'string');
  assert.ok(!path.isAbsolute(f.path) && !f.path.split(/[\\/]/).includes('..'), f.path);
  assert.match(f.sha256, /^[a-f0-9]{64}$/);
}
// Independently qualify original a2 TS/65 under unchanged 2100 inputs; a4 browser uses the final manifest.
sameRef(receipt.producer,await ref(path.join(base,'commit-source.mjs')));const checks=await checked(receipt.checks);sameRef(checks.producer,await ref(path.join(base,'recover-a4-and-check.mjs')));
assert.equal(checks.pass,true);assert.equal(checks.decision,'D239');assert.equal(checks.predecessorDocsCommit,binding.docsCommit);sameRef(checks.sourceManifest,receipt.sourceManifest);sameRef(checks.predecessorBinding,receipt.predecessorBinding);sameRef(checks.predecessorResult,receipt.predecessorResult);
assert.deepEqual(checks.proposalFiles,proposalFiles);assert.deepEqual(checks.changedPaths,paths);assert.deepEqual(checks.newPaths,[]);assert.equal(checks.protectedInputCount,2097);assert.equal(checks.expectedCoreTests,expectedCoreTests);
assert.equal(checks.typecheckExecuted,false);assert.equal(checks.unitExecuted,false);assert.equal(checks.browserExecuted,true);assert.equal(checks.historicalD237CoreAndTestChanged,true);assert.equal(checks.historicalD237CurrentCoverageClaimed,false);assert.equal(Object.hasOwn(checks,'retainedCurrentD237Unit'),false);assert.equal(checks.historicalD230CoreAndTestChanged,true);assert.equal(checks.historicalD230CurrentCoverageClaimed,false);assert.equal(checks.erasureProofTransformExecuted,false);assert.equal(Object.hasOwn(checks,'retainedUnit'),false);assert.equal(Object.hasOwn(checks,'unit'),false);assert.equal(Object.hasOwn(checks,'typecheck'),false);
for(const k of ['helperUnitExecuted','catalogSmokeExecuted','mobileBuildExecuted','authenticatedAdminSession','liveSupabaseTested','stageAccepted','releaseReady'])assert.equal(checks[k],false);
for(const key of ['browser']){const run=await checked(checks[key]);assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);sameRef(run.sourceManifest,receipt.sourceManifest);await bytes(run.stdout);await bytes(run.stderr);if(key==='browser'){assert.deepEqual(run.summary,{cases:3,passed:3,failed:0,skipped:0,flaky:0});const report=await checked(run.report);assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[3,0,0,0]);}}
assert.equal(checks.captures.length,8);const beforeChecks=await checked(checks.sourceBefore),afterChecks=await checked(checks.sourceAfter);assert.deepEqual(beforeChecks,afterChecks);assert.equal(beforeChecks.head,binding.docsCommit);assert.deepEqual(beforeChecks.files,manifest.files);assert.equal(checks.sourceInputsUnchanged,true);
const previous=await checked(receipt.predecessorResult);assert.equal(previous.pass,true);assert.equal(previous.decision,'D238');assert.equal(previous.sourceInputCount,2101);assert.equal(previous.historicalDialogueDraftCount,36);for(const k of ['approvedCount','availableAdultCount','availableChildCount','productionJourneyCount'])assert.equal(previous[k],0);assert.equal(previous.releaseReady,false);
sameRef(checks.retainedD238Checks,receipt.retainedD238Checks);sameRef(checks.retainedD238Checks,previous.checks);assert.equal(checks.retainedD238Checks.sha256,'cea89d23a2d198bd7f260166b9d02b941d975125619b4b26c5c6de2fafde9c5c');
const baseline=await checked(checks.retainedD238Checks);assert.equal(baseline.pass,true);assert.equal(baseline.decision,'D238');assert.equal(baseline.typecheckExecuted,true);assert.equal(baseline.unitExecuted,false);assert.equal(baseline.currentD237CoreAndTestUnchanged,true);assert.equal(baseline.expectedCoreTests,57);assert.equal(baseline.sourceManifest.sha256,'6fac7ba7cefbc3ce5e5c180a47f1d3857accf3d96358385fdc388ab749371713');assert.equal(baseline.sourceManifest.sha256,previous.sourceManifest.sha256);assert.deepEqual(await checked(baseline.sourceManifest),await checked(previous.sourceManifest));
const prior=await checked(baseline.sourceManifest);assert.deepEqual(prior.files.map(f=>f.path),manifest.files.map(f=>f.path));assert.deepEqual(prior.files.filter(f=>manifest.files.find(m=>m.path===f.path).sha256!==f.sha256).map(f=>f.path),paths);
const originalD237=baseline.retainedCurrentD237Unit,validatedD237=await authenticateOriginalD237(originalD237.unit,originalD237.sourceManifest);
assert.deepEqual(originalD237,priorD238Retention(originalD237.unit,originalD237.sourceManifest,validatedD237));
assert.deepEqual(receipt.retainedHistoricalD237Unit,checks.retainedHistoricalD237Unit);assert.deepEqual(receipt.retainedHistoricalD237Unit,historicalD237Retention(originalD237,baseline.sourceManifest,prior));
await authenticateHistoricalD237(receipt.retainedHistoricalD237Unit,manifest.files.map(f=>f.path));assert.deepEqual(manifest.files.filter(f=>!paths.includes(f.path)),prior.files.filter(f=>!paths.includes(f.path)));
for(const f of receipt.retainedHistoricalD237Unit.lastCompatibleCoreAndTestFiles)assert.notEqual(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);
assert.equal(receipt.attempt,'a4');assert.equal(checks.attempt,'a4');assert.deepEqual(receipt.recovery,checks.recovery);assert.deepEqual(receipt.fixtureRecovery,checks.fixtureRecovery);
const authenticatedA3=await authenticateA4FixtureRecovery(receipt.fixtureRecovery,receipt.recovery,manifest,proposalFiles);assert.deepEqual(receipt.retainedCurrentD239Unit,checks.retainedCurrentD239Unit);assert.deepEqual(receipt.retainedCurrentD239Typecheck,checks.retainedCurrentD239Typecheck);assert.deepEqual(receipt.retainedCurrentD239Unit,authenticatedA3.unit);assert.deepEqual(receipt.retainedCurrentD239Typecheck,authenticatedA3.typecheck);
for(const k of ['retainedHistoricalD237Unit','retainedHistoricalD230Unit','retainedHistoricalD230ErasureProof'])assert.deepEqual(receipt[k],authenticatedA3.a3[k]);
assert.deepEqual(receipt.retainedHistoricalD230Unit,checks.retainedHistoricalD230Unit);assert.deepEqual(receipt.retainedHistoricalD230ErasureProof,checks.retainedHistoricalD230ErasureProof);assert.deepEqual(receipt.retainedHistoricalD230Unit,baseline.retainedHistoricalD230Unit);assert.deepEqual(receipt.retainedHistoricalD230ErasureProof,baseline.retainedHistoricalD230ErasureProof);
await authenticateHistoricalD230(receipt.retainedHistoricalD230Unit,receipt.retainedHistoricalD230ErasureProof,manifest.files.map(f=>f.path));
for(const key of ['retainedHelper','retainedAction','retainedHistoricalFactSmoke','retainedD232Typecheck','retainedD232FixtureCorrection'])assert.deepEqual(receipt[key],checks[key]);
const helper=receipt.retainedHelper;assert.equal(helper.decision,'D226');assert.equal(helper.passed,18);assert.equal(helper.rerun,false);assert.equal(helper.helperOwnBytesUnchanged,true);assert.equal(helper.coreDependencyChanged,true);assert.equal(helper.currentParserCoverageClaimed,false);assert.deepEqual(helper,previous.retainedHelper);for(const f of helper.files)assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);for(const r of [helper.unit,helper.report,helper.sourceManifest])await bytes(r);
const action=receipt.retainedAction;assert.equal(action.decision,'D225');assert.equal(action.passed,10);assert.equal(action.rerun,false);assert.equal(action.mockedActionCoverage,true);assert.equal(action.parserCoverageClaimed,false);assert.deepEqual(action,baseline.retainedAction);for(const f of action.files)assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);for(const r of [action.unit,action.report])await bytes(r);
const smoke=receipt.retainedHistoricalFactSmoke;assert.equal(smoke.decision,'D226');assert.equal(smoke.rerun,false);assert.equal(smoke.historicalOnly,true);assert.equal(smoke.currentCoreCompatibilityClaimed,false);assert.equal(smoke.factualClaimsVerified,false);assert.equal(smoke.sourcesFetched,false);sameRef(smoke.result,baseline.retainedHistoricalFactSmoke.result);for(const r of [smoke.result,smoke.sourceManifest,smoke.importManifest])await bytes(r);
assert.deepEqual(receipt.retainedD232Typecheck,previous.retainedD232Typecheck);assert.deepEqual(receipt.retainedD232FixtureCorrection,previous.retainedD232FixtureCorrection);assert.equal(receipt.retainedD232Typecheck.historicalOnly,true);assert.equal(receipt.retainedD232Typecheck.currentTypecheckCoverageClaimed,false);assert.equal(receipt.retainedD232FixtureCorrection.historicalOnly,true);assert.equal(receipt.retainedD232FixtureCorrection.currentCorrectionClaimed,false);for(const r of [receipt.retainedD232Typecheck.result,receipt.retainedD232Typecheck.sourceManifest,receipt.retainedD232FixtureCorrection.result])await bytes(r);
const env = { ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1', TEMP: temp, TMP: temp,
  GIT_CONFIG_COUNT: '3', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: normalize(canonical),
  GIT_CONFIG_KEY_1: 'safe.directory', GIT_CONFIG_VALUE_1: normalize(root),
  GIT_CONFIG_KEY_2: 'core.autocrlf', GIT_CONFIG_VALUE_2: 'true' };
function git(args) {
  const r = spawnSync('git', args, { cwd: root, env, windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr || r.error?.message || `git ${args[0]} failed`);
  return r.stdout.trim();
}
async function snapshot() {
  return { sourceCommit: git(['rev-parse', 'HEAD']), status: git(['status', '--porcelain=v1', '--untracked-files=all']),
    files: await Promise.all(manifest.files.map(async f => ({ path: f.path, sha256: await hash(path.join(root, f.path)) }))) };
}
function checkSnapshot(value) {
  assert.equal(value.sourceCommit, sourceCommit, 'HEAD must remain the supplied source commit');
  assert.equal(value.status, '', 'The committed checkout must be clean');
  for (const f of value.files) assert.equal(f.sha256, manifest.files.find(p => p.path === f.path).sha256, f.path);
}
async function run(label, args) {
  const stdoutPath = path.join(out, `${label}.stdout.log`), stderrPath = path.join(out, `${label}.stderr.log`);
  const stdout = await fs.open(stdoutPath, 'wx'), stderr = await fs.open(stderrPath, 'wx'), started = Date.now();
  let spawnError = null;
  console.log(JSON.stringify({ started: label, command: [process.execPath, ...args], sourceCommit }));
  const execution = await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: admin, env, windowsHide: true, stdio: ['ignore', stdout.fd, stderr.fd] });
    child.once('error', error => { spawnError = error.message; });
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
  });
  await stdout.close(); await stderr.close();
  return { ...execution, pass: execution.exitCode === 0 && !spawnError, spawnError, durationMs: Date.now() - started,
    command: [process.execPath, ...args], cwd: normalize(admin), stdout: await ref(stdoutPath), stderr: await ref(stderrPath) };
}

await fs.mkdir(out); // Never overwrite an earlier build attempt.
await fs.mkdir(temp, { recursive: true });
let before = null, after = null, build = null, secrets = null, failure = null;
const started = Date.now();
try {
  before = await snapshot(); await write('source-before.json', before); checkSnapshot(before);
  assert.match(manifest.checkpoint, /^[a-f0-9]{40}$/);
  git(['merge-base', '--is-ancestor', manifest.checkpoint, sourceCommit]);
  const next = await fs.realpath(createRequire(path.join(admin, 'package.json')).resolve('next/dist/bin/next'));
  build = await run('next-build', [next, 'build', '--webpack']);
  if (build.pass) {
    // This script's primary-CLI guard requires argv and import.meta realpaths to agree.
    const audit = await fs.realpath(path.join(root, 'scripts/check-admin-client-secrets.mjs'));
    secrets = await run('client-secrets', [audit]);
    assert.ok(!secrets.pass || (await fs.stat(path.join(out, 'client-secrets.stdout.log'))).size > 0, 'Secret audit returned no output');
  }
} catch (error) { failure = error.message; }
try {
  after = await snapshot(); await write('source-after.json', after); checkSnapshot(after);
  assert.equal(await hash(manifestPath), manifestSha, 'Final manifest must remain unchanged');
  assert.equal(await hash(receiptPath), receiptSha, 'Commit receipt must remain unchanged');
  assert.equal(await hash(bindingPath),receipt.predecessorBinding.sha256,'Predecessor binding must remain unchanged');
  assert.equal(await hash(self),producer.sha256,'Build runner must remain frozen');
}
catch (error) { failure = failure ? `${failure}; source after: ${error.message}` : error.message; }
const pass = !failure && build?.pass === true && secrets?.pass === true;
const result = { schemaVersion: 1, kind: 'booky-journey-additional-works-admin-build', pass, sourceCommit,attempt:'a4',recovery:receipt.recovery,fixtureRecovery:receipt.fixtureRecovery,
  sourceManifest: await ref(manifestPath), sourceCommitReceipt: await ref(receiptPath),
  retainedCurrentCoreUnit:receipt.retainedCurrentD239Unit.unit,retainedCurrentTypecheck:receipt.retainedCurrentD239Typecheck.result,expectedCoreTests,currentCoreUnitValidated:true,unitRerun:false,
  durationMs: Date.now() - started, build, clientSecrets: secrets, failure,
  sourceBefore: before ? await ref(path.join(out, 'source-before.json')) : null,
  sourceAfter: after ? await ref(path.join(out, 'source-after.json')) : null,
  sourceInputsUnchanged: !failure && before !== null && after !== null,
  standaloneTypecheckExecuted: false, catalogGenerationExecuted: false, mobileBuildExecuted: false, deploymentExecuted: false,
  stageAccepted: false, releaseReady: false, producer };
const resultRef = await write('result.json', result);
console.log(JSON.stringify({ pass, sourceCommit, result: resultRef, failure }));
if (!pass) process.exitCode = 1;
