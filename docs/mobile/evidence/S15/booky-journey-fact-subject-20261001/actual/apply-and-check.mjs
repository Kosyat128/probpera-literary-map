// node apply-and-check.mjs D239_DOCS_COMMIT D239_RESULT_PATH D239_RESULT_SHA
// Proposal hashes bind the frozen external proposals; root acceptance is required before execution.
// Apply four accepted D240 fact-subject owners; run current TypeScript/70 core units in parallel, then browsers.
// D23965/TS, D23757 and D23049/proof are retained only as historical evidence after the new source changes.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [predecessor,resultArg,resultSha]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(predecessor,/^[a-f0-9]{40}$/u);assert.match(resultSha,/^[a-f0-9]{64}$/u);
const self=fileURLToPath(import.meta.url),base=path.dirname(self),out=path.join(base,'actual-a1');
const bindingPath=path.join(base,'predecessor-binding.json'),binding=JSON.parse(await fs.readFile(bindingPath,'utf8'));
assert.equal(binding.schemaVersion,1);assert.equal(binding.decision,'D239');assert.match(binding.docsCommit,/^[a-f0-9]{40}$/u);assert.match(binding.result.sha256,/^[a-f0-9]{64}$/u);
assert.equal(predecessor,binding.docsCommit);
assert.equal(resultSha,binding.result.sha256);
const canonical='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work',root=await fs.realpath(canonical);
const proposalFiles=[
  {path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'c33536cf719958ee153dbff88ecb08e43ee32548fb13ad59567cd8d3f53eda4b'},
  {path:'apps/admin/lib/booky-journey-draft.test.ts',sha256:'c26e93ef346bf783557773badb58adc32873937d496385e1e641876d4872d4f3'},
  {path:'apps/admin/lib/booky-journey-draft.ts',sha256:'9eb7fb61b4e28f46fa99e669e7c774994cad64a34515f5eab67b11b9df02e90f'},
  {path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'47d742242f116724a3e03a5a053c350eb2b9ed5412f6e10a2d8fe220792f19e6'},
];
for(const f of proposalFiles)assert.match(f.sha256,/^[a-f0-9]{64}$/u);
const paths=proposalFiles.map(f=>f.path),unitFile='apps/admin/lib/booky-journey-draft.test.ts',coreFile='apps/admin/lib/booky-journey-draft.ts';
const legacyUiFixturePaths=['apps/admin/components/BookyJourneyDraftEditor.tsx','tests/host/booky-journey-authoring.spec.mjs'],expectedCoreTests=Number('70');
assert.ok(Number.isInteger(expectedCoreTests)&&expectedCoreTests>65);
const helperOwners=['apps/admin/lib/booky-journey-activity-validation.test.ts','apps/admin/lib/booky-journey-activity-validation.ts'];
const sha=b=>createHash('sha256').update(b).digest('hex'),norm=p=>path.normalize(p).replaceAll('\\','/'),at=p=>path.isAbsolute(p)?p:path.join(root,p);
const hash=async p=>sha(await fs.readFile(p)),ref=async p=>({path:norm(p),sha256:await hash(p)});
const bytes=async r=>{assert.match(r.sha256,/^[a-f0-9]{64}$/u);const b=await fs.readFile(at(r.path));assert.equal(sha(b),r.sha256,r.path);return b;};
const checked=async r=>JSON.parse(await bytes(r));
const write=async(n,v)=>{const p=path.join(out,n);await fs.writeFile(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(p);};
const env={...process.env,CI:'1',NEXT_TELEMETRY_DISABLED:'1',GIT_CONFIG_COUNT:'3',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:norm(canonical),GIT_CONFIG_KEY_1:'safe.directory',GIT_CONFIG_VALUE_1:norm(root),GIT_CONFIG_KEY_2:'core.autocrlf',GIT_CONFIG_VALUE_2:'true',BOOKY_JOURNEY_BROWSER_OUTPUT:path.join(out,'captures'),BOOKY_JOURNEY_BROWSER_REPORT:path.join(out,'browser-report.json')};
const git=args=>{const r=spawnSync('git',args,{cwd:root,env,windowsHide:true,encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout.trim();};

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

const producer=await ref(self),predecessorBinding=await ref(bindingPath),predecessorResult={path:norm(at(resultArg)),sha256:resultSha},previous=await checked(predecessorResult);
assert.equal(norm(at(resultArg)),norm(at(binding.result.path)));
assert.equal(git(['rev-parse','HEAD']),predecessor);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
assert.equal(previous.pass,true);assert.equal(previous.decision,'D239');
assert.match(previous.sourceCommit,/^[a-f0-9]{40}$/u);
assert.equal(git(['rev-parse',predecessor+'^']),previous.sourceCommit);assert.equal(previous.sourceInputCount,2101);assert.equal(previous.historicalDialogueDraftCount,36);
for(const k of ['approvedCount','availableAdultCount','availableChildCount','productionJourneyCount'])assert.equal(previous[k],0);assert.equal(previous.releaseReady,false);
const baselineChecksRef=previous.checks;
assert.equal(baselineChecksRef.sha256,'2679e50394df782fa1e6a48fc906f7264bf647de1d4b1df50f7fc52f7692d9f2');
const baseline=await checked(baselineChecksRef);assert.equal(baseline.decision,'D239');assert.equal(baseline.typecheckExecuted,false);assert.equal(baseline.unitExecuted,false);assert.equal(baseline.attempt,'a4');assert.equal(Object.hasOwn(baseline,'unit'),false);assert.equal(Object.hasOwn(baseline,'typecheck'),false);assert.equal(baseline.expectedCoreTests,65);assert.equal(baseline.captures.length,8);assert.equal(baseline.pass,true);assert.equal(baseline.sourceInputsUnchanged,true);assert.equal(previous.checks.sha256,baselineChecksRef.sha256);
assert.equal(previous.sourceManifest.sha256,baseline.sourceManifest.sha256);
assert.equal(baseline.sourceManifest.sha256,'4d53a85c2dd32846839022c4caa4477297ff55cfff2c5d896a2cac5be1855a70');
const prior=await checked(baseline.sourceManifest);assert.equal(prior.files.length,2101);assert.equal(new Set(prior.files.map(f=>f.path)).size,2101);
for(const f of prior.files){assert.ok(!path.isAbsolute(f.path)&&!f.path.split(/[\\/]/u).includes('..'));assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);}
const baselineBefore=await checked(baseline.sourceBefore),baselineAfter=await checked(baseline.sourceAfter);assert.deepEqual(baselineBefore,baselineAfter);assert.deepEqual(baselineBefore.files,prior.files);
const currentD239=baseline.retainedCurrentD239Unit,currentD239Typecheck=baseline.retainedCurrentD239Typecheck,validatedD239=await authenticateOriginalD239(currentD239.unit,currentD239.sourceManifest);
assert.deepEqual(currentD239,expectedD239UnitRetention(currentD239,validatedD239));assert.deepEqual(currentD239Typecheck,expectedD239TypecheckRetention(currentD239Typecheck));assert.equal(currentD239Typecheck.sourceManifest.sha256,currentD239.sourceManifest.sha256);const oldType=await authenticateOriginalD239Typecheck(currentD239Typecheck.result,currentD239Typecheck.sourceManifest);
const retainedHistoricalD239Unit=historicalD239Unit(currentD239,baseline.sourceManifest,prior),retainedHistoricalD239Typecheck=historicalD239Typecheck(currentD239Typecheck,baseline.sourceManifest),historicalD239Refs=await authenticateHistoricalD239(retainedHistoricalD239Unit,retainedHistoricalD239Typecheck,prior.files.map(f=>f.path));
const retainedHistoricalD237Unit=baseline.retainedHistoricalD237Unit,historicalD237Refs=await authenticateHistoricalD237(retainedHistoricalD237Unit,prior.files.map(f=>f.path));
const retainedHistoricalD230Unit=baseline.retainedHistoricalD230Unit,retainedHistoricalD230ErasureProof=baseline.retainedHistoricalD230ErasureProof;
const historicalRefs=await authenticateHistoricalD230(retainedHistoricalD230Unit,retainedHistoricalD230ErasureProof,prior.files.map(f=>f.path));
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
const retainedD232Typecheck={...previous.retainedD232Typecheck},retainedD232FixtureCorrection={...previous.retainedD232FixtureCorrection};
assert.equal(retainedD232Typecheck.decision,'D232');assert.equal(retainedD232Typecheck.historicalOnly,true);assert.equal(retainedD232Typecheck.rerun,false);assert.equal(retainedD232Typecheck.currentUiCoverageClaimed,false);assert.equal(retainedD232Typecheck.currentTypecheckCoverageClaimed,false);assert.equal(retainedD232Typecheck.result.sha256,'093adcc72420713216ca3e24f821fd9b6cab745e1da47f6e827eb22ccce5de5c');assert.equal(retainedD232Typecheck.sourceManifest.sha256,'f057794bbd417334f5d594dd764457ae15d927934bb73718be5499b482d22af5');
assert.equal(retainedD232FixtureCorrection.decision,'D232');assert.equal(retainedD232FixtureCorrection.historicalOnly,true);assert.equal(retainedD232FixtureCorrection.appliesToDecision,'D232');assert.equal(retainedD232FixtureCorrection.currentCorrectionClaimed,false);assert.equal(retainedD232FixtureCorrection.result.sha256,'cb3a6472317846cde089cc0243c18699e800fcdb72d6a6d7946fea13e6b285b6');
const historicalTypecheck=await checked(retainedD232Typecheck.result),historicalCorrection=await checked(retainedD232FixtureCorrection.result);assert.equal(historicalTypecheck.pass,true);assert.equal(historicalTypecheck.exitCode,0);assert.equal(historicalTypecheck.sourceManifest.sha256,retainedD232Typecheck.sourceManifest.sha256);assert.equal(historicalCorrection.pass,true);assert.equal(historicalCorrection.originalManifest.sha256,retainedD232Typecheck.sourceManifest.sha256);assert.equal(historicalCorrection.finalManifest.sha256,'9b709f9b53a2b22258074ec8961b6f51ff9380052cdc2b525b67cf2ac05bc787');assert.equal(historicalCorrection.typecheckRerun,false);assert.equal(historicalCorrection.unitRerun,false);

const retentionRefs=[...historicalRefs,...historicalD237Refs,...historicalD239Refs,...baseline.retentionRefs,retainedD232Typecheck.result,retainedD232Typecheck.sourceManifest,retainedD232FixtureCorrection.result,predecessorBinding,predecessorResult,baselineChecksRef,baseline.sourceManifest,baseline.sourceBefore,baseline.sourceAfter,currentD239.unit,validatedD239.run.report,validatedD239.run.stdout,validatedD239.run.stderr,currentD239Typecheck.result,oldType.stdout,oldType.stderr,retainedHelper.unit,retainedHelper.report,retainedHelper.sourceManifest,retainedAction.unit,retainedAction.report,smokeRef,smoke.sourceManifest,smoke.sourceBefore,smoke.sourceAfter,smoke.producer,baseline.producer];for(const r of retentionRefs)await bytes(r);
for(const f of proposalFiles){assert.equal(await hash(path.join(base,'proposed',f.path)),f.sha256,f.path);assert.notEqual(prior.files.find(p=>p.path===f.path)?.sha256,f.sha256);}
await fs.mkdir(out);for(const p of paths)await fs.copyFile(path.join(base,'proposed',p),path.join(root,p));
const manifest={schemaVersion:1,checkpoint:predecessor,files:await Promise.all(prior.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))};
for(const f of manifest.files)assert.equal(f.sha256,proposalFiles.find(p=>p.path===f.path)?.sha256??prior.files.find(p=>p.path===f.path).sha256,f.path);
assert.deepEqual(git(['diff','--name-only']).split('\n').filter(Boolean).sort(),paths);const sourceManifest=await write('source-manifest.json',manifest);
const snapshot=async()=>({head:git(['rev-parse','HEAD']),status:git(['status','--porcelain=v1','--untracked-files=all']),files:await Promise.all(manifest.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))});
const before=await snapshot();assert.equal(before.head,predecessor);assert.deepEqual(before.files,manifest.files);const sourceBefore=await write('source-before.json',before);
const temp=path.join(root,'.tmp/admin-journey-fact-subject-a1');await fs.mkdir(temp,{recursive:true});env.TEMP=temp;env.TMP=temp;
async function run(label,args){const stdoutPath=path.join(out,label+'.stdout.log'),stderrPath=path.join(out,label+'.stderr.log'),stdout=await fs.open(stdoutPath,'wx'),stderr=await fs.open(stderrPath,'wx'),started=Date.now();let error=null;
  console.log(JSON.stringify({started:label}));const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore',stdout.fd,stderr.fd]});child.once('error',e=>{error=e.message;});child.once('close',resolve);});await stdout.close();await stderr.close();
  return {pass:exitCode===0&&!error,exitCode,error,durationMs:Date.now()-started,command:[process.execPath,...args],sourceManifest,stdout:await ref(stdoutPath),stderr:await ref(stderrPath)};}
const [typecheck,unit]=await Promise.all([
  run('typecheck',[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(root,'apps/admin/tsconfig.json'),'--incremental','false','--pretty','false']),
  run('unit',[path.join(root,'node_modules/vitest/vitest.mjs'),'run',unitFile,'--reporter=json','--outputFile='+path.join(out,'unit-report.json')])
]);
try{const reportPath=path.join(out,'unit-report.json'),report=JSON.parse(await fs.readFile(reportPath,'utf8'));unit.report=await ref(reportPath);unit.files=[unitFile];unit.summary={total:report.numTotalTests,passed:report.numPassedTests,failed:report.numFailedTests,pending:report.numPendingTests};
  unit.pass&&=report.success===true&&report.numTotalTests===expectedCoreTests&&report.numPassedTests===expectedCoreTests&&report.numFailedTests===0&&report.numPendingTests===0&&report.testResults.length===1&&norm(report.testResults[0].name).endsWith('/'+unitFile)&&report.testResults[0].assertionResults.length===expectedCoreTests&&report.testResults[0].assertionResults.every(a=>a.status==='passed');
}catch(e){unit.pass=false;unit.error=String(e);}
const typeRef=await write('typecheck-result.json',typecheck),unitRef=await write('unit-result.json',unit);
if(unit.pass)await authenticateFreshD240(unitRef,sourceManifest,proposalFiles);
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
const pass=typecheck.pass&&unit.pass&&browser?.pass===true,result=await write('checks-result.json',{pass,decision:'D240',predecessorDocsCommit:predecessor,predecessorBinding,predecessorResult,
  sourceManifest,sourceBefore,sourceAfter,sourceInputsUnchanged:true,changedPaths:paths,newPaths:[],protectedInputCount:2097,proposalFiles,typecheck:typeRef,unit:unitRef,browser:browserRef,captures,expectedCoreTests,
  retainedHistoricalD239Unit,retainedHistoricalD239Typecheck,retainedHistoricalD237Unit,retainedHistoricalD230Unit,retainedHistoricalD230ErasureProof,retainedHelper,retainedAction,retainedHistoricalFactSmoke,retainedD232Typecheck,retainedD232FixtureCorrection,retainedD239Checks:baselineChecksRef,retentionRefs,
  typecheckExecuted:true,unitExecuted:true,historicalD239CoreAndTestChanged:true,historicalD239CurrentCoverageClaimed:false,historicalD239TypecheckCurrentCoverageClaimed:false,historicalD237CoreAndTestChanged:true,historicalD237CurrentCoverageClaimed:false,historicalD230CoreAndTestChanged:true,historicalD230CurrentCoverageClaimed:false,erasureProofTransformExecuted:false,helperUnitExecuted:false,catalogSmokeExecuted:false,mobileRuntimeUnchanged:true,mobileBuildExecuted:false,authenticatedAdminSession:false,liveSupabaseTested:false,stageAccepted:false,releaseReady:false,producer});
console.log(JSON.stringify({pass,result,sourceManifest,browserSummary:browser?.summary,captures:captures.length}));if(!pass)process.exitCode=1;
