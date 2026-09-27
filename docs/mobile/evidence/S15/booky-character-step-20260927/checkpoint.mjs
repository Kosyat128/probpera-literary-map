import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {readCaseEvidence} from './read-case-evidence.mjs';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';
const root='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
assert.equal((await fs.realpath('.')).replaceAll('\\','/'),root);
const folder='docs/mobile/evidence/S15/booky-character-step-20260927';
const [sourceCommit,unitAttempt,staticAttempt,browserAttempt,...extra]=process.argv.slice(2);
assert.match(sourceCommit,/^[a-f0-9]{40}$/u);for(const a of [unitAttempt,staticAttempt,browserAttempt])assert.match(a,/^a[1-9][0-9]*$/u);assert.ok(extra.length===0||(extra.length===1&&extra[0]==='--preflight'));const preflight=extra.length===1;
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n',normal=p=>p.replaceAll('\\','/');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const verify=async r=>{const b=await fs.readFile(r.path);assert.equal(sha(b),r.sha256,r.path);return b;};
const verified=async r=>JSON.parse(await verify(r));
const verifyAll=async refs=>{for(const r of refs)await verify(r);};
const git=args=>execFileSync('git',['-c','safe.directory='+root,'-c','core.quotePath=false','-c','core.autocrlf=false',...args],{encoding:'utf8',windowsHide:true}).trim();
const entry=await read(folder+'/entry.json'),scope=await verified(entry.scopeConfiguration),prior=await verified(entry.previousCheckpointResult),priorRuntime=await verified(entry.previousRuntimeResult);
assert.equal(priorRuntime.sourceCommit,entry.previousRuntimeSourceCommit);assert.equal(priorRuntime.pass,true);assert.equal(priorRuntime.releaseReady,false);assert.deepEqual(entry.previousCheckpointResult,entry.previousRuntimeResult);
assert.equal(git(['rev-parse','HEAD']),sourceCommit);git(['merge-base','--is-ancestor',entry.checkpoint,sourceCommit]);
assert.equal(prior.pass,true);assert.equal(prior.releaseReady,false);
const expected=new Map([...entry.changedPaths.map(p=>[p,'M']),...entry.newSourcePaths.map(p=>[p,'A'])]);
const sourceDiff=git(['diff','--name-status',entry.checkpoint,sourceCommit,'--','src','tests','scripts','apps','public','data','index.html','native.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','vite.native.config.ts','vite.pwa.config.ts','capacitor.config.json']).split(/\r?\n/u).filter(Boolean).map(s=>s.split('\t'));
assert.deepEqual(sourceDiff.map(([status,p])=>[p,status]).sort(),[...expected].sort());
const priorEntry=await verified(prior.entry);const baseline=await verified(entry.priorSourceManifest),attempts={unit:unitAttempt,static:staticAttempt,browser:browserAttempt},runs={};let sourceManifest,manifest;
for(const [mode,attempt]of Object.entries(attempts)){
 const out=folder+'/'+mode+'-'+attempt,r=await read(out+'/result.json'),execution=await read(out+'/execution.json');
 assert.equal(r.pass,true);assert.equal(r.sourceInputsUnchanged,true);assert.equal(r.execution.exitCode,0);assert.equal(execution.exitCode,0);assert.equal(r.releaseReady,false);
 if(sourceManifest)assert.deepEqual(r.sourceManifest,sourceManifest);else {sourceManifest=r.sourceManifest;manifest=await verified(sourceManifest);}
 await verifyAll([...r.checkInputs,...r.supplementalTestInputs,...r.supplementalBrowserInputs,...r.supplementalArchiveInputs,execution.stdout,execution.stderr]);
 assert.ok(r.checkInputs.some(x=>x.path===folder+'/scope.json'&&x.sha256===entry.scopeConfiguration.sha256));
 runs[mode]={...await ref(out+'/result.json'),execution:await ref(out+'/execution.json'),tests:r.tests,rawReport:mode==='static'?null:await ref(out+'/'+(mode==='unit'?'vitest':'playwright')+'.json')};
}
const earlierAttempts=[];
for(const dir of await fs.readdir(folder,{withFileTypes:true})){
 const match=dir.name.match(/^(unit|static|browser)-(a[1-9][0-9]*)$/u);
 if(!dir.isDirectory()||!match||attempts[match[1]]===match[2])continue;
 const out=folder+'/'+dir.name,record=await read(out+'/result.json');await verify(record.sourceManifest);
 const execution=await read(out+'/execution.json');await verifyAll([execution.stdout,execution.stderr]);
 let rawReport=null,startupFailure=null;
 if(match[1]!=='static'){
  try {rawReport=await ref(out+'/'+(match[1]==='unit'?'vitest':'playwright')+'.json');}
  catch(error){
   assert.equal(error.code,'ENOENT');assert.equal(match[1],'unit');assert.equal(record.pass,false);
   assert.equal(record.tests,null);assert.equal(record.sourceInputsUnchanged,true);
   assert.equal(record.execution.exitCode,1);assert.equal(execution.exitCode,1);
   const stderr=await fs.readFile(execution.stderr.path,'utf8');
   assert.match(stderr,/failed to load config/u);assert.match(stderr,/Startup Error/u);
   assert.match(stderr,/Cannot read directory[^\r\n]+Access is denied/u);assert.match(stderr,/esbuild/u);
   startupFailure={classification:'unit-runner-startup-infrastructure-failure',testsExecuted:false,
    explanation:'esbuild could not read the parent directory while loading the Vitest config. No test report was produced and no unit cases executed.',
    missingReport:out+'/vitest.json'};
  }
 }
 earlierAttempts.push({result:await ref(out+'/result.json'),execution:await ref(out+'/execution.json'),rawReport,
  pass:record.pass,tests:record.tests,sourceManifest:record.sourceManifest,retainedOnly:true,...startupFailure});
}
assert.equal(manifest.files.length,entry.sourceInputCount);assert.equal(manifest.checkpoint,entry.checkpoint);await verifyAll(manifest.files);
const sourceMap=new Map(manifest.files.map(r=>[r.path,r.sha256]));
const retainedModelPhotoReview=null;
assert.equal(scope.retainPriorModelPhotos,false);assert.equal(scope.expectedRetainedModelPhotos,0);
const historicalModelPhotoReview=priorRuntime.historicalModelPhotoReview??priorRuntime.retainedModelPhotoReview??priorRuntime.newPhotoReview??priorRuntime.retainedContext?.photos??null;
if(historicalModelPhotoReview)await verify(historicalModelPhotoReview);
for(const modelInput of ['src/host/bookyModel.ts','src/host/bookyAnimation.ts','src/host/useBookyRenderer.ts','src/host/bookyMotionPreference.ts'])assert.equal(sourceMap.get(modelInput),baseline.files.find(item=>item.path===modelInput)?.sha256,modelInput+' remains unchanged');

const protectedFiles=baseline.files.filter(r=>!entry.changedPaths.includes(r.path));assert.equal(protectedFiles.length,entry.protectedInputCount);
for(const r of protectedFiles)assert.equal(sourceMap.get(r.path),r.sha256,r.path);
for(const r of entry.currentSourceInputs){assert.equal(sourceMap.get(r.path),r.sha256);const blob=execFileSync('git',['-c','safe.directory='+root,'show',sourceCommit+':'+r.path],{windowsHide:true});assert.equal(sha(blob),r.sha256,r.path+' Git blob');}
const supplemental=[...entry.supplementalTestInputs,...entry.supplementalBrowserInputs,...entry.supplementalArchiveInputs];await verifyAll(supplemental);
const inputs=new Map([...manifest.files,...supplemental].map(r=>[r.path,r.sha256]));
const units=await verified(runs.unit.rawReport),unitCases=units.testResults.flatMap(r=>r.assertionResults);
assert.deepEqual(units.testResults.map(r=>normal(path.relative(root,r.name))).sort(),[...entry.unitFiles].sort());assert.equal(entry.expectedUnitTests,null);assert.equal(entry.unitFiles.length,14);assert.ok(units.testResults.every(r=>r.assertionResults.length>0));assert.equal(units.numTotalTests,unitCases.length);assert.ok(unitCases.length>0&&unitCases.every(r=>r.status==='passed'));assert.deepEqual(runs.unit.tests,{passed:unitCases.length,failed:0,skipped:0});

assert.equal(scope.caseEvidenceContractsComplete,true,'Final component/App evidence schema must be configured');
await verify(scope.evidenceAdapter);
assert.ok(scope.checkpointNextAction&&scope.checkpointNextAction!=='PENDING_FINAL_REVIEW');
const browser=await verified(runs.browser.rawReport);assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[entry.expectedBrowserTests,0,0,0]);assert.deepEqual(browser.errors,[]);
const flatten=suites=>suites.flatMap(s=>[...(s.specs??[]),...flatten(s.suites??[])]),specs=flatten(browser.suites);
assert.equal(specs.length,entry.expectedBrowserTests);assert.deepEqual(specs.map(spec=>spec.title).sort(),[...entry.browserTestTitles].sort());assert.deepEqual([...new Set(specs.map(s=>s.file))].sort(),entry.browserFiles.map(p=>p.split('/').at(-1)).sort());
const priorTitles=priorRuntime.captures.map(capture=>capture.test);assert.equal(new Set(priorTitles).size,priorRuntime.browserCases);
const allPriorSelectedCasesRerun=priorTitles.every(title=>specs.some(spec=>spec.title===title));
const captures=[],screenshots=[],behavior=[];
for(const spec of specs){
 assert.equal(spec.ok,true);assert.equal(spec.tests.length,1);const t=spec.tests[0];assert.equal(t.status,'expected');assert.equal(t.results.length,1);const run=t.results[0];assert.equal(run.status,'passed');assert.equal(run.retry,0);assert.deepEqual(run.errors,[]);
 const {contract:caseContract,capture,capturePath,attachment,images}=await readCaseEvidence(spec,browser,scope.caseEvidenceContracts);
 const records=caseContract.sourceBinding==='emitted-hashes'?capture.sourceInputs:capture.sourceGraph.filter(p=>/^(src|scripts|public|data)\//u.test(p)).map(p=>({path:p,sha256:inputs.get(p)}));
 assert.ok(Array.isArray(records)&&records.length>0);
 for(const r of records){assert.match(r.sha256,/^[a-f0-9]{64}$/u);assert.equal(inputs.get(r.path),r.sha256,r.path+' capture');}
 for(const required of caseContract.requiredSourcePaths)assert.ok(records.some(r=>r.path===required),required+' captured');
 captures.push({...await ref(capturePath),attachment:attachment?await ref(attachment.path):null,test:spec.title,actualApp:capture.actualApp===true,evidenceKind:caseContract.evidenceKind,sourceBinding:caseContract.sourceBinding,sourceGraphBindings:caseContract.sourceBinding==='manifest-bound-paths'?records:undefined});
 for(const image of images){const filename=path.join(path.dirname(capturePath),image.filename),bytes=await verify({path:filename,sha256:image.sha256});assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),image.width);assert.equal(bytes.readUInt32BE(20),image.height);screenshots.push({...image,path:normal(filename)});}
 behavior.push({test:spec.title,scenario:capture.scenario??null,scope:caseContract.scope??null,phaseScopedValues:caseContract.phaseScopedValues??null,flags:Object.fromEntries(Object.entries(capture).filter(([,v])=>typeof v==='boolean'))});
 for(const contract of scope.requiredCaptureFlags??[])if(capture.scenario===contract.scenario)for(const flag of contract.flags)assert.equal(capture[flag],true,flag);
 for(const contract of scope.requiredCaptureValues??[])if(capture.scenario===contract.scenario)for(const [key,value]of Object.entries(contract.values))assert.deepEqual(capture[key],value,contract.scenario+' '+key);
 for(const contract of scope.requiredObservationChecks??[])if(capture.scenario===contract.scenario){
  const observation=capture.observations?.[contract.observation];assert.ok(observation,contract.scenario+' observations');
  if(Object.hasOwn(observation,'findings'))assert.deepEqual(observation.findings,[],contract.scenario+' findings');
  assert.ok(Array.isArray(observation.checks));
  assert.equal(observation.checks.length,contract.checks.length,contract.scenario+' check count');
  assert.deepEqual(observation.checks.map(check=>check.name).sort(),[...contract.checks].sort(),contract.scenario+' check names');
  for(const check of observation.checks)assert.equal(check.pass,true,contract.scenario+' '+check.name);
  behavior.at(-1).observationChecks={observation:contract.observation,checks:observation.checks,...(Object.hasOwn(observation,'findings')?{findings:observation.findings}:{})};
 }
}
for(const contract of scope.requiredCaptureFlags??[])assert.equal(behavior.filter(x=>x.scenario===contract.scenario).length,1,contract.scenario);
for(const contract of scope.requiredCaptureValues??[])assert.equal(behavior.filter(x=>x.scenario===contract.scenario).length,1,contract.scenario);
for(const contract of scope.requiredObservationChecks??[])assert.equal(behavior.filter(x=>x.scenario===contract.scenario).length,1,contract.scenario);
assert.equal(screenshots.length,entry.expectedImages);assert.equal(new Set(screenshots.map(x=>x.path)).size,screenshots.length);
const visualPath=folder+'/visual-review.json',visual=await read(visualPath);assert.equal(visual.pass,true);assert.equal(visual.sourceCommit,sourceCommit);assert.deepEqual(visual.sourceManifest,sourceManifest);assert.equal(visual.releaseReady,false);
assert.equal(visual.inspectedCount,visual.images.length);assert.ok(visual.inspectedCount>0&&visual.inspectedCount<=screenshots.length);
assert.equal(visual.totalCapturedCount,screenshots.length);assert.ok(typeof visual.scope==='string'&&visual.scope.trim().length>0);assert.ok(Array.isArray(visual.limitations)&&visual.limitations.length>0&&visual.limitations.every(x=>typeof x==='string'&&x.trim().length>0));
const capturedImages=new Map(screenshots.map(x=>[x.path,x.sha256]));assert.equal(new Set(visual.images.map(x=>normal(x.path))).size,visual.images.length);
for(const image of visual.images)assert.equal(capturedImages.get(normal(image.path)),image.sha256,'Visual review must be a subset of authenticated final captures');
for(const image of visual.images){await verify(image);assert.equal(image.inspected,true);assert.ok(image.reviewer&&image.findings?.length);}
assert.deepEqual(visual.images.map(image=>path.basename(image.path)).sort(),[...scope.requiredVisualFilenames].sort());
assert.equal(scope.requireNewPhotoReview,false);assert.equal(scope.expectedNewModelPhotos,0);assert.equal(scope.retainPriorModelPhotos,false);
const newPhotoPath=folder+'/new-model-photo-review.json',newPhotoReview=null,newModelPhotoCount=0;
const pwaPath=folder+'/pwa-a1/result.json',androidPath=folder+'/android-a1/result.json',pwa=await read(pwaPath),android=await read(androidPath),buildManifests=[];
for(const [kind,build]of [['pwa',pwa],['android',android]]){
 assert.equal(build.pass,true);assert.equal(build.sourceCommit,sourceCommit);assert.equal(build.releaseReady,false);const manifestPath=build.artifact.path+'/artifact.json',bytes=await fs.readFile(manifestPath),a=JSON.parse(bytes);assert.equal(sha(bytes),kind==='pwa'?build.artifact.artifactSha256:build.artifact.sha256);assert.equal(a.sourceCommit,sourceCommit);assert.equal(a.buildId,build.buildId);
 for(const item of a.inventory){const b=await fs.readFile(path.join(build.artifact.path,item.path));assert.equal(b.length,item.bytes);assert.equal(sha(b),item.sha256,item.path);}
 for(const item of a.sourceInputs.files){assert.equal(sha(await fs.readFile(item.path)),item.sha256,item.path);if(inputs.has(item.path))assert.equal(inputs.get(item.path),item.sha256);}
 for(const required of entry.runtimeRequired)assert.ok(a.sourceInputs.files.some(r=>r.path===required&&r.sha256===inputs.get(required)),required+' built');
 buildManifests.push(await ref(manifestPath));
}
await verify(android.apk);assert.equal((await fs.stat(android.apk.path)).size,android.apk.bytes);assert.equal(android.checks.exactCopiedBytes,true);assert.equal(pwa.artifact.exactCopiesVerified,true);
const auditPaths=['pwa-a1/strict-audit.json','android-a1/native-artifact-audit.json','android-a1/android-dev-apk-verification.json','android-a1/build-run.json'];const buildAudits=[];
for(const name of auditPaths){const file=folder+'/'+name,a=await read(file);assert.equal(a.pass,true);buildAudits.push(await ref(file));}
const apkAudit=await read(folder+'/android-a1/android-dev-apk-verification.json');assert.equal(apkAudit.apk.sha256,android.apk.sha256);assert.equal(apkAudit.sourceArtifact.buildId,android.buildId);assert.equal(apkAudit.sourceArtifact.sourceCommit,sourceCommit);
for(const r of apkAudit.rawReports)await verify(r);await verify(apkAudit.zip.ledger);
const pwaBrowser=await read(folder+'/pwa-a1/playwright.json');assert.deepEqual([pwaBrowser.stats.expected,pwaBrowser.stats.unexpected,pwaBrowser.stats.skipped,pwaBrowser.stats.flaky],[1,0,0,0]);assert.deepEqual(pwaBrowser.errors,[]);
const copy=await read(folder+'/pwa-a1/copy-verification.json');assert.equal(copy.pass,true);await verifyAll([copy.detailedLedger,copy.artifactManifest]);
const buildBaseline=await read(folder+'/build-baseline.json');assert.equal(buildBaseline.checkpoint,entry.checkpoint);assert.deepEqual(buildBaseline.previousCheckpointResult,entry.previousCheckpointResult);assert.deepEqual(buildBaseline.previousRuntimeResult,entry.previousRuntimeResult);assert.equal(buildBaseline.runtimeSourceCommit,priorRuntime.sourceCommit);
for(const [kind,key]of [['pwa','priorPwa'],['android','priorAndroid']]){const r=buildBaseline[key];assert.deepEqual({path:r.path,sha256:r.sha256},prior[kind]);const old=await verified(r);assert.equal(old.sourceCommit,priorRuntime.sourceCommit);assert.equal(old.buildId,r.buildId);}
const diagnosticPath=folder+'/diagnostic-history.json';let diagnosticHistory=null;
const hasDiagnostics=await fs.stat(diagnosticPath).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
if(scope.requireDiagnosticHistory)assert.equal(hasDiagnostics,true,'Record original diagnostic attempts before checkpoint');
if(hasDiagnostics){
 const diagnostics=await read(diagnosticPath);assert.equal(diagnostics.schemaVersion,2);assert.equal(diagnostics.recordingComplete,true);assert.equal(diagnostics.currentTaskAttemptsOnly,true);assert.equal(diagnostics.retainedPriorHistory,null);assert.deepEqual(diagnostics.priorResult,entry.previousCheckpointResult);assert.ok(Array.isArray(diagnostics.attempts));assert.ok(diagnostics.attempts.length>0||(diagnostics.supersededPreparations??[]).length>0,'Diagnostic history must contain actual evidence');assert.equal(new Set(diagnostics.attempts.map(a=>a.id)).size,diagnostics.attempts.length);
 await verifyAll([diagnostics.priorResult,diagnostics.recorder,diagnostics.inputSpecification]);
 assert.deepEqual(diagnostics.amendmentProvenance,scope.runtimeAmendmentProvenance);await verifyAll(diagnostics.amendmentProvenance);
 if(Object.hasOwn(diagnostics,'supersededPreparations'))assert.ok(Array.isArray(diagnostics.supersededPreparations));for(const preparation of diagnostics.supersededPreparations??[]){assert.equal(preparation.status,'superseded-before-execution');assert.equal(preparation.executed,false);assert.equal(preparation.browserStarted,false);assert.equal(preparation.nodeExit,null);assert.equal(preparation.tests,null);assert.ok(!diagnostics.attempts.some(attempt=>attempt.id===preparation.id));await verifyAll(preparation.evidence);for(const filename of preparation.absentExecutionPaths)await assert.rejects(fs.stat(filename),{code:'ENOENT'});}

 if(diagnostics.retainedEarlierSameTaskHistory){const earlier=await verified(diagnostics.retainedEarlierSameTaskHistory);assert.equal(earlier.currentTaskAttemptsOnly,true);for(const attempt of earlier.attempts)assert.deepEqual(diagnostics.attempts.find(item=>item.id===attempt.id),attempt);assert.deepEqual(diagnostics.supersededPreparations,earlier.supersededPreparations);await verifyAll([earlier.recorder,earlier.inputSpecification]);}
 for(const item of [diagnostics.initialFreezeArchive,diagnostics.formalA1Provenance,diagnostics.supplementalUnitProvenance].filter(Boolean))await verify(item);
 if(diagnostics.previousTaskHistory){const previousHistory=await verified(diagnostics.previousTaskHistory);assert.equal(previousHistory.currentTaskAttemptsOnly,true);await verifyAll([previousHistory.recorder,previousHistory.inputSpecification]);}
 for(const a of diagnostics.attempts){
  const executionRef=a.execution;assert.ok(executionRef,'Original execution receipt is required');
  const toolOnly=a.executionEvidence.streamSeparation==='tool-return-only';const singleLog=a.executionEvidence.log,logs=toolOnly?[]:singleLog?[singleLog]:[a.executionEvidence.stdout,a.executionEvidence.stderr];
  if(toolOnly){assert.equal(a.executionEvidence.stdout,null);assert.equal(a.executionEvidence.stderr,null);assert.equal(a.executionEvidence.log,null);}else if(singleLog){assert.equal(a.executionEvidence.streamSeparation,'not-recorded');assert.equal(a.executionEvidence.stdout,null);assert.equal(a.executionEvidence.stderr,null);}
  else {assert.ok(logs.every(Boolean),'Original separate raw logs are required');assert.equal(a.executionEvidence.streamSeparation,'recorded');}
  assert.ok(['vitest','playwright','typescript'].includes(a.reportFormat));assert.equal(a.diagnosticOnly,true);assert.ok(typeof a.interpretation==='string'&&a.interpretation.trim());
  await verifyAll([executionRef,...logs,...[a.report].filter(Boolean),...(a.additionalEvidence??[])]);
  const execution=await verified(executionRef),nodeExit=execution.nodeExit??execution.nodeExitCode??execution.exitCode??execution.trueExit??execution.observedNodeExit;
  if(toolOnly){assert.ok(execution.toolChunkId);assert.equal(execution.independentProcessLog,null);assert.ok(execution.provenance.includes('tool return'));}assert.ok(Number.isInteger(nodeExit),'Original Node exit is required');assert.equal(nodeExit,a.executionEvidence.nodeExit);
  if(a.report){const report=await verified(a.report);if(a.reportFormat==='vitest'){assert.equal(a.browserStarted,false);assert.equal(report.numPassedTests,a.tests.passed);assert.equal(report.numFailedTests,a.tests.failed);assert.equal(report.numPendingTests,a.tests.skipped);assert.equal(report.testResults.flatMap(result=>result.assertionResults).length,a.tests.passed+a.tests.failed+a.tests.skipped);}else{assert.equal(a.reportFormat,'playwright');assert.equal(a.browserStarted,true);assert.deepEqual({passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,flaky:report.stats.flaky},a.tests);}}
  else {assert.equal(a.report,null);assert.equal(a.tests,null);assert.equal(a.browserStarted,false);assert.ok(a.reportFormat==='typescript'||(a.reportFormat==='vitest'&&nodeExit===1),'Only original static checks or failed unit startup may lack a test report');}
 }
 diagnosticHistory=await ref(diagnosticPath);
}
const checkpointGuardHistory=[];for(const name of (await fs.readdir(folder)).filter(name=>/^checkpoint-guard-a[1-9][0-9]*\.json$/u.test(name)).sort()){const item=await read(folder+'/'+name);assert.equal(item.classification,'checkpoint-helper-contract-schema-guard-failure');assert.equal(item.testFailure,false);assert.equal(item.receipt.exitCode,1);await verify(item.failedHelper);checkpointGuardHistory.push(await ref(folder+'/'+name));}
await verifyAll([...scope.historicalDialogueInputs,...scope.directSpecificationEvidence,...scope.runtimeAmendmentProvenance]);
const productionInventorySources=prior.productionInventorySources;await verifyAll(productionInventorySources);for(const r of productionInventorySources)assert.equal(sourceMap.get(r.path),r.sha256);
const globals=['AUTOPILOT_STATE.json','DECISIONS.md','STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt','REQUIREMENTS_TRACEABILITY.json','REQUIREMENTS_TRACEABILITY.csv'].map(n=>'docs/mobile/'+n),originals=new Map(await Promise.all(globals.map(async p=>[p,await fs.readFile(p,'utf8')])));
const state=JSON.parse(originals.get(globals[0])),trace=JSON.parse(originals.get(globals[5])),beforeTrace=structuredClone(trace),beforeState=structuredClone(state);
assert.equal(state.headSha,prior.sourceCommit);assert.equal(state.currentCriterionId,'S03.acceptance');assert.equal(state.resume.firstOpenCriterion,'S03.acceptance');assert.equal(state.verificationCache.s15BookyCharacterStep,undefined);assert.equal(state.verificationCache.s15BookyShortViewport.sha256,entry.previousCheckpointResult.sha256);
const counts=Object.fromEntries(['COMPLETE','IN_PROGRESS','NOT_STARTED'].map(status=>[status,state.stages.filter(s=>s.status===status).length]));assert.deepEqual(counts,{COMPLETE:3,IN_PROGRESS:12,NOT_STARTED:26});
assert.equal(/^- D206:/mu.test(originals.get(globals[1])),false);assert.equal([...originals.get(globals[1]).matchAll(/^- D205:/gmu)].length,1);
const recordedAt=new Date().toISOString(),resultPath=folder+'/result.json',criteriaUpdated=['PLANETKA-004'],criterionTargets=['S15.PLANETKA-004'];
assert.deepEqual(scope.requirementEvidenceTargets,criteriaUpdated);assert.deepEqual(scope.criterionEvidenceTargets,criterionTargets);
const nextAction=scope.checkpointNextAction;
const summary=scope.description+' Fresh '+unitCases.length+' focused units across '+entry.unitFiles.length+' full files, TypeScript and '+entry.expectedBrowserTests+' selected component/App browser cases pass with '+screenshots.length+' authenticated captures; '+visual.images.length+' screenshots are directly reviewed. PWA '+pwa.buildId.slice(0,8)+' and Android-dev '+android.buildId.slice(0,8)+' are rebuilt and byte-audited from this source. '+protectedFiles.length+' prior source inputs remain exact. D205 source/build records retain their original attribution. Production publication delivery and journey inventories remain disabled/empty; no editorial, device, full accessibility or stage acceptance is granted.';
const limitations=['The unit count is observed from all assertions in the exact 14 selected full files; no skipped cases or manufactured expected count.','Static route admission uses independently reviewed synthetic contracts and a true service capability; only the current live leased projection can open a character, and only a separate exact committed in-modal acknowledgement grants character credit.','Component tests and actual-App tests retain their own declared scopes. Controlled publication fixture data is not enabled production delivery, real editorial approval or installed-device evidence.','All 34 historical draft records remain unchanged and unapproved. The existing Controls whole-file source provenance is pending an explicit batch rebind; no current inventory-audit pass is claimed.','No character history migration is enabled. Saved progress contains only semantic character identity, never modal token, receipt, lease, cached projection or source prose.','Only bounded S15.PLANETKA-004 evidence is added; all requirement/stage statuses and acceptance gates remain unchanged.',...(scope.browserScopeNotes??[]),...visual.limitations];
const result={schemaVersion:1,recordedAt,pass:true,stage:'S15',status:'BOOKY_CHARACTER_STEP_SCOPED_VALIDATION',sourceCommit,entry:await ref(folder+'/entry.json'),checkpointHelper:await ref(folder+'/checkpoint.mjs'),previous:entry.previousCheckpointResult,previousRuntimeResult:entry.previousRuntimeResult,previousRuntimeSourceCommit:priorRuntime.sourceCommit,sourceManifest,sourceCommits:[sourceCommit],attempts,runs,earlierAttempts,diagnosticHistory,checkpointGuardHistory,directSpecificationEvidence:scope.directSpecificationEvidence,historicalDialogueInputs:scope.historicalDialogueInputs,newUiCopyStatus:scope.newUiCopyStatus,unitCount:unitCases.length,unitFiles:entry.unitFiles,unitValidation:scope.unitValidation,unitSuitesRerun:true,browserCases:entry.expectedBrowserTests,actualAppCaseCount:captures.filter(c=>c.actualApp===true).length,componentCaseCount:captures.filter(c=>c.actualApp!==true).length,captures,validatedBehavior:behavior,visualReview:await ref(visualPath),newPhotoReview,newModelPhotoCount,retainedModelPhotoReview,historicalModelPhotoReview,inspectedImageCount:visual.images.length,totalCapturedImageCount:screenshots.length,visualReviewScope:visual.scope,visualReviewLimitations:visual.limitations,unchangedTrackedInputCount:protectedFiles.length,protectedInputsVerified:true,changedSourcePaths:entry.changedPaths,newSourcePaths:entry.newSourcePaths,supplementalTestInputs:entry.supplementalTestInputs,supplementalBrowserInputs:entry.supplementalBrowserInputs,supplementalArchiveInputs:entry.supplementalArchiveInputs,supplementalArchiveGitIdentity:entry.supplementalArchiveGitIdentity,productionInventorySources,productionJourneyCount:0,approvedProductionDialogueCount:0,combinedDraftCount:34,productionMigrationCount:0,pwa:await ref(pwaPath),android:await ref(androidPath),pwaBuildId:pwa.buildId,androidBuildId:android.buildId,apk:android.apk,buildManifests,buildAudits,buildBaseline:await ref(folder+'/build-baseline.json'),copyVerification:await ref(folder+'/pwa-a1/copy-verification.json'),pwaBrowserReport:await ref(folder+'/pwa-a1/playwright.json'),buildsRebuilt:true,browserRerun:true,retainedCheckpoint:{result:entry.previousCheckpointResult,sourceCommit:prior.sourceCommit,sourceManifest:prior.sourceManifest,unitCount:prior.unitCount,inventory:prior.inventory},retainedContext:{sourceCommit:priorRuntime.sourceCommit,result:entry.previousRuntimeResult,unitCount:priorRuntime.unitCount,browserCases:priorRuntime.browserCases,allPriorSelectedCasesRerun,priorSelectedBrowserCaseCount:priorRuntime.browserCases,currentSelectedBrowserCaseCount:entry.expectedBrowserTests,formerLargerSuitesRerun:false,photos:historicalModelPhotoReview,photosHistoricalOnly:true,photosClaimCurrentRenderer:false},criteriaUpdated,criterionEvidenceTargets:criterionTargets,criterionChanges:[],requirementChanges:[],allStageAndCriterionStatusesUnchanged:true,counts,firstUnresolved:'S03.acceptance',decisionD206Recorded:true,nextAction,limitations,bookyCharacterStepImplemented:true,runtimeWiringImplemented:true,characterJourneyNodeImplemented:true,productionJourneysEnabled:false,reviewedDialogueAccepted:false,childApproved:false,narrationEnabled:false,installedNativeDevice:false,iosCompiled:false,fullAccessibilityAccepted:false,artAccepted:false,brandingApproved:false,rightsApproved:false,stageAccepted:false,productionActionsPerformed:false,releaseReady:false};

const push=(items,item)=>{if(!items.includes(item))items.push(item);},stage=state.stages.find(s=>s.id==='S15');

for(const id of criteriaUpdated){const requirement=trace.requirements.find(r=>r.id===id);assert.ok(requirement);requirement.commit=sourceCommit;requirement.notes+=' '+summary;push(requirement.evidence,resultPath);for(const p of entry.runtimeRequired)push(requirement.implementationFiles,p);for(const p of [...entry.unitFiles,...entry.browserFiles])push(requirement.tests,p);}
for(const target of criterionTargets){const matches=state.stages.flatMap(owner=>owner.criteria.filter(c=>c.id===target));assert.equal(matches.length,1,target);const criterion=matches[0];criterion.commit=sourceCommit;criterion.notes+=' '+summary;push(criterion.evidence,resultPath);criterion.lastValidatedAt=recordedAt;}
for(const owner of state.stages)for(const criterion of owner.criteria)if(!criterionTargets.includes(criterion.id))assert.deepEqual(criterion,beforeState.stages.find(item=>item.id===owner.id).criteria.find(item=>item.id===criterion.id),criterion.id+' unchanged');
for(const p of [resultPath,folder+'/README.md',folder+'/entry.json',sourceManifest.path,visualPath,...(newPhotoReview?[newPhotoPath]:[]),...Object.values(runs).map(r=>r.path),pwaPath,androidPath])push(stage.artifacts,p);
for(const [mode,attempt]of Object.entries(attempts))push(stage.lastGreenCommands,'node '+folder+'/check.mjs '+mode+' '+attempt);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;push(state.resume.contextFiles,resultPath);push(state.resume.doNotRepeat,'Preserve current-only character authority: static admission does not require a future dossier; generic Next never acknowledges character; only the current committed in-modal receipt and explicit action grant credit.');
state.verificationCache.s15BookyCharacterStep={path:resultPath,sha256:sha(json(result)),sourceCommit,status:result.status,pwa:result.pwa,android:result.android,stageAccepted:false,releaseReady:false};
const statuses=s=>s.stages.map(stage=>[stage.id,stage.status,stage.criteria.map(c=>[c.id,c.status])]);assert.deepEqual(statuses(state),statuses(beforeState));assert.deepEqual(trace.requirements.map(r=>[r.id,r.status]),beforeTrace.requirements.map(r=>[r.id,r.status]));assert.deepEqual(trace.requirements.filter(r=>!criteriaUpdated.includes(r.id)),beforeTrace.requirements.filter(r=>!criteriaUpdated.includes(r.id)));
const marker='<!-- s15-booky-character-step-20260927:begin -->',note=marker+'\nSource '+sourceCommit+': '+summary+'\nEvidence: evidence/S15/booky-character-step-20260927/result.json. D206. All statuses unchanged: 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\n'+nextAction+'\n<!-- s15-booky-character-step-20260927:end -->\n\n';
const rows=parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv','utf8'));assert.equal(originals.get(globals[6]).replaceAll('\r\n','\n'),projectTraceabilityCsv(beforeTrace,rows));
const updates=new Map([[globals[0],json(state)],[globals[1],originals.get(globals[1])+'\n- D206: Source '+sourceCommit+'. '+summary+' Evidence: evidence/S15/booky-character-step-20260927/result.json.\n'],...globals.slice(2,5).map(p=>{assert.ok(!originals.get(p).includes(marker));return [p,note+originals.get(p)];}),[globals[5],json(trace)],[globals[6],projectTraceabilityCsv(trace,rows)]]);
await verifyAll(entry.checkpointFiles);await verifyAll(manifest.files);for(const [p,b]of originals)assert.equal(await fs.readFile(p,'utf8'),b);
for(const p of [resultPath,folder+'/README.md'])await assert.rejects(fs.stat(p),{code:'ENOENT'});
if(preflight){console.log(json({pass:true,kind:'READ_ONLY_CHECKPOINT_PREFLIGHT',acceptanceRecorded:false,globalWrites:false,sourceCommit,sourceManifest,unitCount:unitCases.length,browserCases:specs.length,protectedInputs:protectedFiles.length}));process.exit(0);}
await fs.writeFile(resultPath,json(result),{flag:'wx'});await fs.writeFile(folder+'/README.md','# S15 current-only adult character step\n\nSource: '+sourceCommit+'.\n\n'+summary+'\n\n'+limitations.map(s=>'- '+s).join('\n')+'\n',{flag:'wx'});for(const [p,b]of updates)await fs.writeFile(p,b);
console.log(json({pass:true,sourceCommit,unitCount:unitCases.length,browserCases:specs.length,capturedImages:screenshots.length,inspectedImages:visual.images.length,sourceInputs:manifest.files.length,protectedInputs:protectedFiles.length,releaseReady:false}));
