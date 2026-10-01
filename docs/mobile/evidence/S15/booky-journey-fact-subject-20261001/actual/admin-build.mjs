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
assert.equal(binding.schemaVersion,1);assert.equal(binding.decision,'D239');assert.match(binding.docsCommit,/^[a-f0-9]{40}$/u);assert.match(binding.result.sha256,/^[a-f0-9]{64}$/u);
const canonical = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const root = await fs.realpath(canonical), admin = path.join(root, 'apps/admin');
const out = path.join(base, 'admin-build-a1'), temp = path.join(root, '.tmp/admin-journey-fact-subject-build-a1');
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
async function authenticateOriginalD239(unitRef,manifestRef){
  assert.equal(unitRef.sha256,'8d3f9b3b2e6749ae68757f211c4c87cc97e9477f09bbdcda2b77c84e02be3d5b');assert.equal(manifestRef.sha256,'2f027f828b117f1a5ed54bc2fe0573807a31c2f47ec1f3d75a4dec4c2e93b428');
  const run=await checked(unitRef),report=await checked(run.report),manifest=await checked(manifestRef);assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);assert.equal(run.sourceManifest.sha256,manifestRef.sha256);assert.deepEqual(await checked(run.sourceManifest),manifest);await bytes(run.stdout);await bytes(run.stderr);
  assert.deepEqual(run.files,[unitFile]);assert.deepEqual(run.summary,{total:65,passed:65,failed:0,pending:0});assert.equal(run.report.sha256,'af3399599e456a68242726c860b838cf819961859d1702ed9a5015a9af333d2a');assert.equal(report.success,true);assert.deepEqual([report.numTotalTests,report.numPassedTests,report.numFailedTests,report.numPendingTests],[65,65,0,0]);assert.equal(report.testResults.length,1);assert.equal(report.testResults[0].assertionResults.length,65);assert.ok(path.normalize(report.testResults[0].name).replaceAll('\\','/').endsWith('/'+unitFile));assert(report.testResults[0].assertionResults.every(a=>a.status==='passed'));
  assert.equal(manifest.files.length,2101);assert.equal(new Set(manifest.files.map(f=>f.path)).size,2101);assert.deepEqual(run.command.slice(1),[path.join(root,'node_modules/vitest/vitest.mjs'),'run',unitFile,'--reporter=json','--outputFile='+path.join(path.dirname(base),'s15-booky-journey-additional-works-review','actual-a2','unit-report.json')]);
  for(const f of [{path:coreFile,sha256:'1a1745979ac8280201ef152087b0792984832e77d5fbebda5cb195b8773d65bd'},{path:unitFile,sha256:'d3960c53d3ad70144bb2a81ab119af99acac3fe4dc5c8c2b7df9d99a0670c885'},{path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'bdc5d14b1b0cdd48a212afee2d5e35ec24bb9d8017d76f8d072ef874322becb5'},{path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'ccbd20162e0f39a3fb53fa7f95e5101ed4eb7c129853cfc6d817755ff0372a90'}])assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);
  return {run,report,manifest,files:[unitFile,coreFile].map(p=>({...manifest.files.find(f=>f.path===p)}))};
}
async function authenticateOriginalD239Typecheck(resultRef,manifestRef){
  assert.equal(resultRef.sha256,'91aea4147d034d5ecc68ca4904c613d3012fbe1a0647620b160fafc6ab018cf3');assert.equal(manifestRef.sha256,'2f027f828b117f1a5ed54bc2fe0573807a31c2f47ec1f3d75a4dec4c2e93b428');
  const run=await checked(resultRef);assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);assert.equal(run.sourceManifest.sha256,manifestRef.sha256);assert.deepEqual(await checked(run.sourceManifest),await checked(manifestRef));await bytes(run.stdout);await bytes(run.stderr);
  assert.deepEqual(run.command.slice(1),[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(root,'apps/admin/tsconfig.json'),'--incremental','false','--pretty','false']);return run;
}
function expectedD239UnitRetention(retained,validated){return {decision:'D239',passed:65,unit:retained.unit,report:validated.run.report,sourceManifest:retained.sourceManifest,files:validated.files,originalUnitManifestRetained:true,currentCoreAndTestSourceUnchangedSinceA2:true,currentCoreRuntimeUnchanged:true,protectedDependenciesUnchanged:true,currentCoreCoverageClaimed:true,rerun:false,coversNewFixture:false,boundedThroughDecision:'D239',boundedThroughAttempt:'a4',excludedChangedPaths:['tests/host/booky-journey-authoring.spec.mjs'],nextCoreChangeRequiresFreshUnits:true};}
function expectedD239TypecheckRetention(retained){return {decision:'D239',result:retained.result,sourceManifest:retained.sourceManifest,originalTypecheckManifestRetained:true,currentTypeScriptSourceUnchangedSinceA2:true,protectedDependenciesUnchanged:true,currentTypecheckCoverageClaimed:true,rerun:false,coversNewFixture:false,boundedThroughDecision:'D239',boundedThroughAttempt:'a4',excludedChangedPaths:['tests/host/booky-journey-authoring.spec.mjs'],nextTypeScriptChangeRequiresFreshTypecheck:true};}
function historicalD239Unit(retained,lastRef,lastManifest){return {decision:'D239',passed:65,unit:retained.unit,report:retained.report,sourceManifest:retained.sourceManifest,originalFiles:retained.files,lastCompatibleSourceManifest:lastRef,lastCompatibleCoreAndTestFiles:[unitFile,coreFile].map(p=>({...lastManifest.files.find(f=>f.path===p)})),historicalOnly:true,rerun:false,currentCoreCoverageClaimed:false,currentTestCoverageClaimed:false,currentCoreCompatibilityClaimed:false,currentCoreRuntimeEqualityClaimed:false,currentTestRuntimeEqualityClaimed:false,coversNewUi:false};}
function historicalD239Typecheck(retained,lastRef){return {decision:'D239',result:retained.result,sourceManifest:retained.sourceManifest,lastCompatibleSourceManifest:lastRef,historicalOnly:true,rerun:false,currentTypecheckCoverageClaimed:false,currentUiCoverageClaimed:false,currentCoreCompatibilityClaimed:false,coversNewUi:false};}
async function authenticateHistoricalD239(unit,typecheck,expectedPaths){
  assert.equal(unit.decision,'D239');assert.equal(unit.passed,65);assert.equal(unit.historicalOnly,true);for(const k of ['rerun','currentCoreCoverageClaimed','currentTestCoverageClaimed','currentCoreCompatibilityClaimed','currentCoreRuntimeEqualityClaimed','currentTestRuntimeEqualityClaimed','coversNewUi'])assert.equal(unit[k],false);
  const original=await authenticateOriginalD239(unit.unit,unit.sourceManifest),last=await checked(unit.lastCompatibleSourceManifest);assert.equal(unit.lastCompatibleSourceManifest.sha256,'4d53a85c2dd32846839022c4caa4477297ff55cfff2c5d896a2cac5be1855a70');assert.equal(unit.report.sha256,original.run.report.sha256);assert.deepEqual(await checked(unit.report),original.report);
  assert.equal(last.files.length,2101);assert.equal(new Set(last.files.map(f=>f.path)).size,2101);assert.deepEqual(original.manifest.files.map(f=>f.path),expectedPaths);assert.deepEqual(last.files.map(f=>f.path),expectedPaths);assert.deepEqual(original.manifest.files.filter(f=>f.path!=='tests/host/booky-journey-authoring.spec.mjs'),last.files.filter(f=>f.path!=='tests/host/booky-journey-authoring.spec.mjs'));assert.equal(last.files.find(f=>f.path==='tests/host/booky-journey-authoring.spec.mjs').sha256,'ae300a572b9d5432e91383182ebd781e6febfa7d4f9538886ca225648cfed106');
  assert.deepEqual(unit.originalFiles,original.files);assert.deepEqual(unit.lastCompatibleCoreAndTestFiles,[unitFile,coreFile].map(p=>last.files.find(f=>f.path===p)));
  assert.equal(typecheck.decision,'D239');assert.equal(typecheck.historicalOnly,true);for(const k of ['rerun','currentTypecheckCoverageClaimed','currentUiCoverageClaimed','currentCoreCompatibilityClaimed','coversNewUi'])assert.equal(typecheck[k],false);assert.equal(typecheck.sourceManifest.sha256,unit.sourceManifest.sha256);assert.deepEqual(typecheck.lastCompatibleSourceManifest,unit.lastCompatibleSourceManifest);const type=await authenticateOriginalD239Typecheck(typecheck.result,typecheck.sourceManifest);
  const refs=[unit.unit,unit.report,unit.sourceManifest,unit.lastCompatibleSourceManifest,original.run.stdout,original.run.stderr,typecheck.result,typecheck.sourceManifest,type.stdout,type.stderr];for(const r of refs)await bytes(r);return refs;
}
async function authenticateFreshD240(unitRef,manifestRef,proposals){
  const run=await checked(unitRef),report=await checked(run.report),manifest=await checked(manifestRef);
  assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);assert.equal(run.sourceManifest.sha256,manifestRef.sha256);assert.deepEqual(await checked(run.sourceManifest),manifest);await bytes(run.stdout);await bytes(run.stderr);
  assert.deepEqual(run.files,[unitFile]);assert.deepEqual(run.summary,{total:expectedCoreTests,passed:expectedCoreTests,failed:0,pending:0});
  assert.deepEqual(run.command,[process.execPath,path.join(root,'node_modules/vitest/vitest.mjs'),'run',unitFile,'--reporter=json','--outputFile='+path.join(base,'actual-a1','unit-report.json')]);
  assert.equal(report.success,true);assert.deepEqual([report.numTotalTests,report.numPassedTests,report.numFailedTests,report.numPendingTests],[expectedCoreTests,expectedCoreTests,0,0]);assert.equal(report.testResults.length,1);assert.ok(path.normalize(report.testResults[0].name).replaceAll('\\','/').endsWith('/'+unitFile));assert.equal(report.testResults[0].assertionResults.length,expectedCoreTests);assert(report.testResults[0].assertionResults.every(a=>a.status==='passed'));
  assert.equal(manifest.files.length,2101);assert.equal(new Set(manifest.files.map(f=>f.path)).size,2101);
  for(const p of [coreFile,unitFile])assert.equal(manifest.files.find(f=>f.path===p).sha256,proposals.find(f=>f.path===p).sha256);
  return {run,report,manifest};
}

async function authenticateOriginalD240(unitRef,typeRef,manifestRef){
  assert.equal(unitRef.sha256,'e5077dfbbd532b70ded95ded182c0ce071ea9ebfd3f6febb87bd69391ddbbc6e');assert.equal(typeRef.sha256,'b9090b1c0da77087d978047e0d3b015c4941fa9f654c9b7d4cb2bc9c28d3a32f');assert.equal(manifestRef.sha256,'0b4c71d8940fe0f64c181f20edf110d8f9c15582c73e3e1cf1577d52a3276953');
  const run=await checked(unitRef),report=await checked(run.report),type=await checked(typeRef),manifest=await checked(manifestRef);
  for(const result of [run,type]){assert.equal(result.pass,true);assert.equal(result.exitCode,0);assert.equal(result.error,null);assert.equal(result.sourceManifest.sha256,manifestRef.sha256);assert.deepEqual(await checked(result.sourceManifest),manifest);await bytes(result.stdout);await bytes(result.stderr);}
  assert.deepEqual(run.files,[unitFile]);assert.deepEqual(run.summary,{total:70,passed:70,failed:0,pending:0});assert.equal(run.report.sha256,'ab596e9c265c177cd3497700cc423a08b96ce04a79a26e1a9d444853199caaaa');assert.equal(report.success,true);assert.deepEqual([report.numTotalTests,report.numPassedTests,report.numFailedTests,report.numPendingTests],[70,70,0,0]);assert.equal(report.testResults.length,1);assert.ok(path.normalize(report.testResults[0].name).replaceAll('\\','/').endsWith('/'+unitFile));assert.equal(report.testResults[0].assertionResults.length,70);assert(report.testResults[0].assertionResults.every(a=>a.status==='passed'));
  assert.deepEqual(run.command.slice(1),[path.join(root,'node_modules/vitest/vitest.mjs'),'run',unitFile,'--reporter=json','--outputFile='+path.join(path.dirname(base),'s15-booky-journey-fact-subject-review','actual-a1','unit-report.json')]);
  assert.deepEqual(type.command.slice(1),[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(root,'apps/admin/tsconfig.json'),'--incremental','false','--pretty','false']);
  assert.equal(manifest.files.length,2101);assert.equal(new Set(manifest.files.map(f=>f.path)).size,2101);
  for(const f of [{path:coreFile,sha256:'9eb7fb61b4e28f46fa99e669e7c774994cad64a34515f5eab67b11b9df02e90f'},{path:unitFile,sha256:'c26e93ef346bf783557773badb58adc32873937d496385e1e641876d4872d4f3'},{path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'c33536cf719958ee153dbff88ecb08e43ee32548fb13ad59567cd8d3f53eda4b'},{path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'47d742242f116724a3e03a5a053c350eb2b9ed5412f6e10a2d8fe220792f19e6'}])assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);
  return {run,report,type,manifest,files:[unitFile,coreFile].map(p=>({...manifest.files.find(f=>f.path===p)}))};
}
const browserFile='tests/host/booky-journey-authoring.spec.mjs';
function a2UnitRetention(original,validated){return {decision:'D240',passed:70,unit:original.unit,report:validated.run.report,sourceManifest:original.sourceManifest,files:validated.files,originalUnitManifestRetained:true,currentCoreAndTestSourceUnchangedSinceA1:true,currentCoreRuntimeUnchanged:true,protectedDependenciesUnchanged:true,currentCoreCoverageClaimed:true,rerun:false,coversNewFixture:false,boundedThroughDecision:'D240',boundedThroughAttempt:'a2',excludedChangedPaths:[browserFile],nextCoreChangeRequiresFreshUnits:true};}
function a2TypecheckRetention(original){return {decision:'D240',result:original.typecheck,sourceManifest:original.sourceManifest,originalTypecheckManifestRetained:true,currentTypeScriptSourceUnchangedSinceA1:true,protectedDependenciesUnchanged:true,currentTypecheckCoverageClaimed:true,rerun:false,coversNewFixture:false,boundedThroughDecision:'D240',boundedThroughAttempt:'a2',excludedChangedPaths:[browserFile],nextTypeScriptChangeRequiresFreshTypecheck:true};}
async function authenticateD240FixtureRecovery(recovery,finalManifest,finalProposals){
  assert.equal(recovery.attempt,'a2');assert.equal(recovery.previousAttempt,'a1');assert.equal(recovery.reason,'reopened-fact-variants-reveal');assert.equal(recovery.revealCorrectionOnly,true);assert.equal(recovery.exactInsertionCount,2);assert.equal(recovery.preservedInputCount,2100);assert.equal(recovery.changedPath,browserFile);
  assert.equal(recovery.beforeSha256,'47d742242f116724a3e03a5a053c350eb2b9ed5412f6e10a2d8fe220792f19e6');assert.equal(recovery.afterSha256,'f5e31c06ad5886bd1519c47ca976cf3f62d6244dde4cc77a3750df62a262a9b9');assert.equal(recovery.originalFixture.sha256,recovery.beforeSha256);assert.equal(recovery.correctedFixture.sha256,recovery.afterSha256);
  assert.equal(recovery.originalRecoveryProducer.sha256,'996953133c6c8abc27c2f9c1db27c6dde4cf1283e8f74bf18221c5ca8e783ffc');assert.equal(recovery.guardCorrectionOnly,true);for(const k of ['canonicalChangedByFailedPreflight','browserExecutedByFailedPreflight','unitExecutedByFailedPreflight','typecheckExecutedByFailedPreflight'])assert.equal(recovery[k],false);await bytes(recovery.originalRecoveryProducer);
  assert.equal(recovery.originalChecks.sha256,'c37eaf294b38975f9cc564c4fc057e4924386ae3245a362fcf80f4c474f5c804');assert.equal(recovery.originalSourceManifest.sha256,'0b4c71d8940fe0f64c181f20edf110d8f9c15582c73e3e1cf1577d52a3276953');assert.equal(recovery.originalProducer.sha256,'8ad0a7e2af63927b177d2d2ff5a3131489dc06c33baf3edff3e6440ea1d52407');
  const original=await checked(recovery.originalChecks),oldManifest=await checked(recovery.originalSourceManifest);assert.equal(original.pass,false);assert.equal(original.decision,'D240');assert.equal(original.typecheckExecuted,true);assert.equal(original.unitExecuted,true);assert.equal(original.expectedCoreTests,70);assert.equal(original.captures.length,10);assert.equal(original.sourceInputsUnchanged,true);
  assert.deepEqual(original.sourceManifest,recovery.originalSourceManifest);assert.deepEqual(original.producer,recovery.originalProducer);assert.deepEqual(original.unit,recovery.originalUnit);assert.deepEqual(original.typecheck,recovery.originalTypecheck);assert.deepEqual(original.browser,recovery.originalBrowser);
  const validated=await authenticateOriginalD240(original.unit,original.typecheck,original.sourceManifest),failed=await checked(original.browser);assert.equal(failed.pass,false);assert.equal(failed.exitCode,1);assert.equal(failed.error,null);assert.equal(failed.sourceManifest.sha256,recovery.originalSourceManifest.sha256);assert.deepEqual(failed.summary,{cases:3,passed:2,failed:1,skipped:0,flaky:0});const failedReport=await checked(failed.report);assert.equal(failed.report.sha256,'ab660539bec375a2a5e49712ffba8e4042e987d240f18960777cd29f65af44d6');assert.deepEqual([failedReport.stats.expected,failedReport.stats.unexpected,failedReport.stats.skipped,failedReport.stats.flaky],[2,1,0,0]);const failedText=JSON.stringify(failedReport);assert.ok(failedText.includes("factVariantField('ru', 'caption')"));assert.ok(failedText.includes('2297'));
  const before=await checked(original.sourceBefore),after=await checked(original.sourceAfter);assert.deepEqual(before,after);assert.deepEqual(before.files,oldManifest.files);assert.equal(before.head,original.predecessorDocsCommit);
  assert.equal(finalManifest.files.length,2101);assert.equal(new Set(finalManifest.files.map(f=>f.path)).size,2101);assert.deepEqual(finalManifest.files.map(f=>f.path),oldManifest.files.map(f=>f.path));assert.deepEqual(finalManifest.files.filter(f=>f.path!==browserFile),oldManifest.files.filter(f=>f.path!==browserFile));for(const f of finalProposals)assert.equal(finalManifest.files.find(m=>m.path===f.path).sha256,f.sha256);assert.equal(finalManifest.files.find(f=>f.path===browserFile).sha256,recovery.afterSha256);
  const oldFixture=(await bytes(recovery.originalFixture)).toString('utf8'),newFixture=(await bytes(recovery.correctedFixture)).toString('utf8'),reveals=["    if (!(await factVariantPanel('ru').evaluate(node => node.open))) await factVariantPanel('ru').locator(':scope > summary').tap();","    if (!(await factVariantPanel('en').evaluate(node => node.open))) await factVariantPanel('en').locator(':scope > summary').tap();"];let restoredFixture=newFixture;for(const line of reveals){assert.equal(restoredFixture.split(line+'\n').length-1,1);restoredFixture=restoredFixture.replace(line+'\n','');}assert.equal(restoredFixture,oldFixture);
  const refs=[recovery.originalRecoveryProducer,recovery.originalChecks,recovery.originalSourceManifest,recovery.originalProducer,recovery.originalBrowser,recovery.originalUnit,recovery.originalTypecheck,validated.run.report,validated.run.stdout,validated.run.stderr,validated.type.stdout,validated.type.stderr,failed.report,failed.stdout,failed.stderr,original.sourceBefore,original.sourceAfter,recovery.originalFixture,recovery.correctedFixture,...original.captures,...original.retentionRefs];for(const r of refs)await bytes(r);return {original,validated,refs};
}

const producer=await ref(self),expectedCoreTests=Number('70');assert.ok(Number.isInteger(expectedCoreTests)&&expectedCoreTests>65);
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
assert.equal(receipt.decision, 'D240');
assert.equal(receipt.sourceCommit, sourceCommit);
assert.equal(receipt.predecessorDocsCommit,binding.docsCommit);assert.equal(receipt.predecessorResult.sha256,binding.result.sha256);assert.equal(receipt.predecessorBinding.sha256,await hash(bindingPath));
sameRef(receipt.predecessorBinding,await ref(bindingPath));assert.equal(normalize(path.resolve(at(receipt.predecessorResult.path))),normalize(path.resolve(at(binding.result.path))));
assert.equal(receipt.typecheckExecuted,false);assert.equal(receipt.unitExecuted,false);assert.equal(receipt.currentD240CoreAndTestUnchanged,true);assert.equal(receipt.currentD240TypeScriptInputsUnchanged,true);assert.equal(Object.hasOwn(receipt,'typecheck'),false);assert.equal(Object.hasOwn(receipt,'unit'),false);assert.equal(receipt.protectedInputCount,2097);assert.equal(receipt.expectedCoreTests,expectedCoreTests);
for(const k of ['helperUnitExecuted','catalogSmokeExecuted','authenticatedAdminSession','stageAccepted','releaseReady'])assert.equal(receipt[k],false);
assert.equal(receipt.historicalD239CoreAndTestChanged,true);assert.equal(receipt.historicalD239CurrentCoverageClaimed,false);assert.equal(receipt.historicalD239TypecheckCurrentCoverageClaimed,false);assert.equal(Object.hasOwn(receipt,'retainedCurrentD239Unit'),false);assert.equal(Object.hasOwn(receipt,'retainedCurrentD239Typecheck'),false);assert.equal(receipt.historicalD237CoreAndTestChanged,true);assert.equal(receipt.historicalD237CurrentCoverageClaimed,false);assert.equal(Object.hasOwn(receipt,'retainedCurrentD237Unit'),false);assert.equal(receipt.historicalD230CoreAndTestChanged,true);assert.equal(Object.hasOwn(receipt,'unit'),false);assert.equal(receipt.historicalD230CurrentCoverageClaimed,false);assert.equal(receipt.erasureProofTransformExecuted,false);assert.equal(Object.hasOwn(receipt,'retainedUnit'),false);
const proposalFiles=[
  {path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'c33536cf719958ee153dbff88ecb08e43ee32548fb13ad59567cd8d3f53eda4b'},
  {path:'apps/admin/lib/booky-journey-draft.test.ts',sha256:'c26e93ef346bf783557773badb58adc32873937d496385e1e641876d4872d4f3'},
  {path:'apps/admin/lib/booky-journey-draft.ts',sha256:'9eb7fb61b4e28f46fa99e669e7c774994cad64a34515f5eab67b11b9df02e90f'},
  {path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'f5e31c06ad5886bd1519c47ca976cf3f62d6244dde4cc77a3750df62a262a9b9'},
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
// Independently qualify original a1 TS/70 at unchanged TypeScript/core sources, then bind fresh current browser; earlier evidence remains historical.
sameRef(receipt.producer,await ref(path.join(base,'commit-source.mjs')));const checks=await checked(receipt.checks);sameRef(checks.producer,await ref(path.join(base,'recover-a2b-and-check.mjs')));
assert.equal(checks.pass,true);assert.equal(checks.decision,'D240');assert.equal(checks.predecessorDocsCommit,binding.docsCommit);sameRef(checks.sourceManifest,receipt.sourceManifest);assert.deepEqual(checks.retainedCurrentD240Unit,receipt.retainedCurrentD240Unit);assert.deepEqual(checks.retainedCurrentD240Typecheck,receipt.retainedCurrentD240Typecheck);assert.deepEqual(checks.fixtureRecovery,receipt.fixtureRecovery);sameRef(checks.predecessorBinding,receipt.predecessorBinding);sameRef(checks.predecessorResult,receipt.predecessorResult);
assert.deepEqual(checks.proposalFiles,proposalFiles);assert.deepEqual(checks.changedPaths,paths);assert.deepEqual(checks.newPaths,[]);assert.equal(checks.protectedInputCount,2097);assert.equal(checks.expectedCoreTests,expectedCoreTests);
assert.equal(checks.typecheckExecuted,false);assert.equal(checks.unitExecuted,false);assert.equal(checks.attempt,'a2');assert.equal(checks.currentD240CoreAndTestUnchanged,true);assert.equal(checks.currentD240TypeScriptInputsUnchanged,true);assert.equal(Object.hasOwn(checks,'typecheck'),false);assert.equal(Object.hasOwn(checks,'unit'),false);assert.equal(checks.historicalD239CoreAndTestChanged,true);assert.equal(checks.historicalD239CurrentCoverageClaimed,false);assert.equal(checks.historicalD239TypecheckCurrentCoverageClaimed,false);assert.equal(Object.hasOwn(checks,'retainedCurrentD239Unit'),false);assert.equal(Object.hasOwn(checks,'retainedCurrentD239Typecheck'),false);assert.equal(checks.historicalD237CoreAndTestChanged,true);assert.equal(checks.historicalD237CurrentCoverageClaimed,false);assert.equal(Object.hasOwn(checks,'retainedCurrentD237Unit'),false);assert.equal(checks.historicalD230CoreAndTestChanged,true);assert.equal(checks.historicalD230CurrentCoverageClaimed,false);assert.equal(checks.erasureProofTransformExecuted,false);assert.equal(Object.hasOwn(checks,'retainedUnit'),false);assert.equal(Object.hasOwn(checks,'unit'),false);
for(const k of ['helperUnitExecuted','catalogSmokeExecuted','mobileBuildExecuted','authenticatedAdminSession','liveSupabaseTested','stageAccepted','releaseReady'])assert.equal(checks[k],false);
for(const key of ['browser']){const run=await checked(checks[key]);assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);sameRef(run.sourceManifest,receipt.sourceManifest);await bytes(run.stdout);await bytes(run.stderr);if(key==='browser'){assert.deepEqual(run.summary,{cases:3,passed:3,failed:0,skipped:0,flaky:0});const report=await checked(run.report);assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[3,0,0,0]);}}
assert.equal(checks.captures.length,8);const beforeChecks=await checked(checks.sourceBefore),afterChecks=await checked(checks.sourceAfter);assert.deepEqual(beforeChecks,afterChecks);assert.equal(beforeChecks.head,binding.docsCommit);assert.deepEqual(beforeChecks.files,manifest.files);assert.equal(checks.sourceInputsUnchanged,true);
const previous=await checked(receipt.predecessorResult);assert.equal(previous.pass,true);assert.equal(previous.decision,'D239');assert.equal(previous.sourceInputCount,2101);assert.equal(previous.historicalDialogueDraftCount,36);for(const k of ['approvedCount','availableAdultCount','availableChildCount','productionJourneyCount'])assert.equal(previous[k],0);assert.equal(previous.releaseReady,false);
sameRef(checks.retainedD239Checks,receipt.retainedD239Checks);sameRef(checks.retainedD239Checks,previous.checks);assert.equal(checks.retainedD239Checks.sha256,'2679e50394df782fa1e6a48fc906f7264bf647de1d4b1df50f7fc52f7692d9f2');
const baseline=await checked(checks.retainedD239Checks);assert.equal(baseline.pass,true);assert.equal(baseline.decision,'D239');assert.equal(baseline.attempt,'a4');assert.equal(baseline.typecheckExecuted,false);assert.equal(baseline.unitExecuted,false);assert.equal(baseline.expectedCoreTests,65);assert.equal(baseline.sourceManifest.sha256,'4d53a85c2dd32846839022c4caa4477297ff55cfff2c5d896a2cac5be1855a70');assert.equal(baseline.sourceManifest.sha256,previous.sourceManifest.sha256);assert.deepEqual(await checked(baseline.sourceManifest),await checked(previous.sourceManifest));assert.equal(Object.hasOwn(baseline,'unit'),false);assert.equal(Object.hasOwn(baseline,'typecheck'),false);
const prior=await checked(baseline.sourceManifest);assert.deepEqual(prior.files.map(f=>f.path),manifest.files.map(f=>f.path));assert.deepEqual(prior.files.filter(f=>manifest.files.find(m=>m.path===f.path).sha256!==f.sha256).map(f=>f.path),paths);
const currentD239=baseline.retainedCurrentD239Unit,currentD239Typecheck=baseline.retainedCurrentD239Typecheck,validatedD239=await authenticateOriginalD239(currentD239.unit,currentD239.sourceManifest);assert.deepEqual(currentD239,expectedD239UnitRetention(currentD239,validatedD239));assert.deepEqual(currentD239Typecheck,expectedD239TypecheckRetention(currentD239Typecheck));await authenticateOriginalD239Typecheck(currentD239Typecheck.result,currentD239Typecheck.sourceManifest);
assert.deepEqual(receipt.retainedHistoricalD239Unit,checks.retainedHistoricalD239Unit);assert.deepEqual(receipt.retainedHistoricalD239Typecheck,checks.retainedHistoricalD239Typecheck);assert.deepEqual(receipt.retainedHistoricalD239Unit,historicalD239Unit(currentD239,baseline.sourceManifest,prior));assert.deepEqual(receipt.retainedHistoricalD239Typecheck,historicalD239Typecheck(currentD239Typecheck,baseline.sourceManifest));await authenticateHistoricalD239(receipt.retainedHistoricalD239Unit,receipt.retainedHistoricalD239Typecheck,manifest.files.map(f=>f.path));
assert.deepEqual(manifest.files.filter(f=>!paths.includes(f.path)),prior.files.filter(f=>!paths.includes(f.path)));for(const f of receipt.retainedHistoricalD239Unit.lastCompatibleCoreAndTestFiles)assert.notEqual(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);
const recovered=await authenticateD240FixtureRecovery(receipt.fixtureRecovery,manifest,proposalFiles);assert.deepEqual(receipt.retainedCurrentD240Unit,a2UnitRetention(recovered.original,recovered.validated));assert.deepEqual(receipt.retainedCurrentD240Typecheck,a2TypecheckRetention(recovered.original));for(const key of ['retainedHistoricalD239Unit','retainedHistoricalD239Typecheck','retainedHistoricalD237Unit','retainedHistoricalD230Unit','retainedHistoricalD230ErasureProof'])assert.deepEqual(receipt[key],recovered.original[key]);
assert.deepEqual(receipt.retainedHistoricalD237Unit,checks.retainedHistoricalD237Unit);assert.deepEqual(receipt.retainedHistoricalD237Unit,baseline.retainedHistoricalD237Unit);await authenticateHistoricalD237(receipt.retainedHistoricalD237Unit,manifest.files.map(f=>f.path));
assert.deepEqual(receipt.retainedHistoricalD230Unit,checks.retainedHistoricalD230Unit);assert.deepEqual(receipt.retainedHistoricalD230ErasureProof,checks.retainedHistoricalD230ErasureProof);assert.deepEqual(receipt.retainedHistoricalD230Unit,baseline.retainedHistoricalD230Unit);assert.deepEqual(receipt.retainedHistoricalD230ErasureProof,baseline.retainedHistoricalD230ErasureProof);await authenticateHistoricalD230(receipt.retainedHistoricalD230Unit,receipt.retainedHistoricalD230ErasureProof,manifest.files.map(f=>f.path));
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
const result = { schemaVersion: 1, kind: 'booky-journey-fact-subject-admin-build', pass, sourceCommit,
  sourceManifest: await ref(manifestPath), sourceCommitReceipt: await ref(receiptPath),
  retainedCurrentCoreUnit:receipt.retainedCurrentD240Unit.unit,retainedCurrentTypecheck:receipt.retainedCurrentD240Typecheck.result,expectedCoreTests,currentCoreUnitValidated:true,unitRerun:false,
  durationMs: Date.now() - started, build, clientSecrets: secrets, failure,
  sourceBefore: before ? await ref(path.join(out, 'source-before.json')) : null,
  sourceAfter: after ? await ref(path.join(out, 'source-after.json')) : null,
  sourceInputsUnchanged: !failure && before !== null && after !== null,
  standaloneTypecheckExecuted: false, catalogGenerationExecuted: false, mobileBuildExecuted: false, deploymentExecuted: false,
  stageAccepted: false, releaseReady: false, producer };
const resultRef = await write('result.json', result);
console.log(JSON.stringify({ pass, sourceCommit, result: resultRef, failure }));
if (!pass) process.exitCode = 1;
