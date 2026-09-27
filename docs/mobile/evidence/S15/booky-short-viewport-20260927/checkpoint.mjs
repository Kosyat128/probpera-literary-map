import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';
const root='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
assert.equal((await fs.realpath('.')).replaceAll('\\','/'),root);
const folder='docs/mobile/evidence/S15/booky-short-viewport-20260927';
const [sourceCommit,staticAttempt,browserAttempt,...extra]=process.argv.slice(2);
assert.match(sourceCommit,/^[a-f0-9]{40}$/u);for(const a of [staticAttempt,browserAttempt])assert.match(a,/^a[1-9][0-9]*$/u);assert.ok(extra.length===0||(extra.length===1&&extra[0]==='--preflight'));const preflight=extra.length===1;
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
const priorEntry=await verified(prior.entry);const baseline=await verified(entry.priorSourceManifest),attempts={static:staticAttempt,browser:browserAttempt},runs={};let sourceManifest,manifest;
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
const browser=await verified(runs.browser.rawReport);assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[entry.expectedBrowserTests,0,0,0]);assert.deepEqual(browser.errors,[]);
const flatten=suites=>suites.flatMap(s=>[...(s.specs??[]),...flatten(s.suites??[])]),specs=flatten(browser.suites);
assert.equal(specs.length,entry.expectedBrowserTests);assert.deepEqual(specs.map(spec=>spec.title).sort(),[...entry.browserTestTitles].sort());assert.deepEqual([...new Set(specs.map(s=>s.file))].sort(),entry.browserFiles.map(p=>p.split('/').at(-1)).sort());
const priorTitles=priorRuntime.captures.map(capture=>capture.test);assert.equal(new Set(priorTitles).size,priorRuntime.browserCases);
const allPriorSelectedCasesRerun=priorTitles.every(title=>specs.some(spec=>spec.title===title));
const captures=[],screenshots=[],behavior=[];
for(const spec of specs){
 assert.equal(spec.ok,true);assert.equal(spec.tests.length,1);const t=spec.tests[0];assert.equal(t.status,'expected');assert.equal(t.results.length,1);const run=t.results[0];assert.equal(run.status,'passed');assert.equal(run.retry,0);assert.deepEqual(run.errors,[]);
 const attachments=run.attachments.filter(a=>a.contentType==='application/json'&&a.name.endsWith('-source-evidence'));assert.equal(attachments.length,1,spec.title);
 const attachment=attachments[0],capture=await read(attachment.path);assert.equal(capture.pass,true);assert.equal(capture.actualApp,true);assert.equal(capture.actualCss,true);assert.equal(capture.actualGlobe,true);assert.equal(capture.releaseReady,false);
 for(const key of ['errors','externalRequests','missingResources'])assert.deepEqual(capture[key],[],spec.title+' '+key);
 for(const r of capture.sourceInputs){assert.equal(inputs.get(r.path),r.sha256,r.path+' capture');}
 for(const required of entry.runtimeRequired)assert.ok(capture.sourceInputs.some(r=>r.path===required),required+' captured');
 const capturePath=path.join(path.dirname(path.dirname(attachment.path)),attachment.name.replace('-source-evidence','')+'.json');
 assert.equal(sha(await fs.readFile(capturePath)),sha(await fs.readFile(attachment.path)));
 captures.push({...await ref(capturePath),attachment:await ref(attachment.path),test:spec.title});
 for(const image of capture.screenshots){const filename=path.join(path.dirname(capturePath),image.filename),bytes=await verify({path:filename,sha256:image.sha256});assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),image.width);assert.equal(bytes.readUInt32BE(20),image.height);screenshots.push({...image,path:normal(filename)});}
 behavior.push({test:spec.title,scenario:capture.scenario??null,flags:Object.fromEntries(Object.entries(capture).filter(([,v])=>typeof v==='boolean'))});
 for(const contract of scope.requiredPreferencePolicies??[])if(capture.scenario===contract.scenario){
  const policy=contract.policy;for(const field of ['unexpectedPreferenceWrites','customizationWrites'])assert.deepEqual(capture[field],policy[field],contract.scenario+' '+field);
  if(Object.hasOwn(policy,'bookyWrites'))assert.deepEqual(capture.bookyWrites,policy.bookyWrites,contract.scenario+' Booky writes');
  else{
   assert.equal(capture.bookyWrites.length,policy.bookyWriteCount);assert.equal(policy.bookyWriteCount,1);
   const write=capture.bookyWrites[0];assert.equal(write.operation,'set');assert.equal(write.key,'probpera-booky-adult-v1');assert.deepEqual(JSON.parse(write.value),policy.bookyWriteValue);assert.deepEqual(capture.finalBookyPreference,policy.bookyWriteValue);
   const operations=capture.observations[contract.observation].retryOperations;assert.deepEqual(operations.map(r=>r.operation),policy.retryOperations);assert.ok(operations.every(r=>r.key==='probpera-booky-adult-v1'));assert.deepEqual(operations.filter(r=>r.operation==='set'),capture.bookyWrites);
   const all=capture.preferenceOperations.filter(r=>r.key==='probpera-booky-adult-v1');assert.deepEqual(all.slice(-operations.length),operations);assert.deepEqual(all.slice(0,-operations.length).filter(r=>r.operation==='set'),policy.preRetryBookyWrites);
  }
  behavior.at(-1).preferencePolicyValidated=policy;
 }
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
for(const contract of scope.requiredPreferencePolicies??[])assert.equal(behavior.filter(x=>x.scenario===contract.scenario).length,1,contract.scenario);
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
 if(diagnostics.capabilityProbe){const probe=diagnostics.capabilityProbe;await verifyAll(probe.evidence);assert.equal(probe.classification,'successful-negative-capability-measurement');assert.equal(probe.applicationTest,false);assert.equal(probe.realVisualViewportContractionObserved,false);assert.equal(probe.nativeKeyboardEquivalent,false);await verify(probe.execution);}
 assert.deepEqual(diagnostics.amendmentProvenance,scope.runtimeAmendmentProvenance);await verifyAll(diagnostics.amendmentProvenance);
 if(Object.hasOwn(diagnostics,'supersededPreparations'))assert.ok(Array.isArray(diagnostics.supersededPreparations));for(const preparation of diagnostics.supersededPreparations??[]){assert.equal(preparation.status,'superseded-before-execution');assert.equal(preparation.executed,false);assert.equal(preparation.browserStarted,false);assert.equal(preparation.nodeExit,null);assert.equal(preparation.tests,null);assert.ok(!diagnostics.attempts.some(attempt=>attempt.id===preparation.id));await verifyAll(preparation.evidence);for(const filename of preparation.absentExecutionPaths)await assert.rejects(fs.stat(filename),{code:'ENOENT'});}

 if(diagnostics.retainedEarlierSameTaskHistory){const earlier=await verified(diagnostics.retainedEarlierSameTaskHistory);assert.equal(earlier.currentTaskAttemptsOnly,true);for(const attempt of earlier.attempts)assert.deepEqual(diagnostics.attempts.find(item=>item.id===attempt.id),attempt);assert.deepEqual(diagnostics.supersededPreparations,earlier.supersededPreparations);await verifyAll([earlier.recorder,earlier.inputSpecification]);}
 for(const item of [diagnostics.initialFreezeArchive,diagnostics.formalA1Provenance,diagnostics.supplementalUnitProvenance].filter(Boolean))await verify(item);
 if(diagnostics.previousTaskHistory){const previousHistory=await verified(diagnostics.previousTaskHistory);assert.equal(previousHistory.currentTaskAttemptsOnly,true);await verifyAll([previousHistory.recorder,previousHistory.inputSpecification]);}
 for(const a of diagnostics.attempts){
  const executionRef=a.execution;assert.ok(executionRef,'Original execution receipt is required');
  const singleLog=a.executionEvidence.log,logs=singleLog?[singleLog]:[a.executionEvidence.stdout,a.executionEvidence.stderr];
  if(singleLog){assert.equal(a.executionEvidence.streamSeparation,'not-recorded');assert.equal(a.executionEvidence.stdout,null);assert.equal(a.executionEvidence.stderr,null);}
  else {assert.ok(logs.every(Boolean),'Original separate raw logs are required');assert.equal(a.executionEvidence.streamSeparation,'recorded');}
  assert.ok(['vitest','playwright','typescript'].includes(a.reportFormat));assert.equal(a.diagnosticOnly,true);assert.ok(typeof a.interpretation==='string'&&a.interpretation.trim());
  await verifyAll([executionRef,...logs,...[a.report].filter(Boolean),...(a.additionalEvidence??[])]);
  const execution=await verified(executionRef),nodeExit=execution.nodeExit??execution.nodeExitCode??execution.exitCode??execution.trueExit??execution.observedNodeExit;
  assert.ok(Number.isInteger(nodeExit),'Original Node exit is required');assert.equal(nodeExit,a.executionEvidence.nodeExit);
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
assert.equal(state.headSha,prior.sourceCommit);assert.equal(state.currentCriterionId,'S03.acceptance');assert.equal(state.resume.firstOpenCriterion,'S03.acceptance');assert.equal(state.verificationCache.s15BookyShortViewport,undefined);assert.equal(state.verificationCache.s15BookyInitialGlobeLoad.sha256,entry.previousCheckpointResult.sha256);
const counts=Object.fromEntries(['COMPLETE','IN_PROGRESS','NOT_STARTED'].map(status=>[status,state.stages.filter(s=>s.status===status).length]));assert.deepEqual(counts,{COMPLETE:3,IN_PROGRESS:12,NOT_STARTED:26});
assert.equal(/^- D205:/mu.test(originals.get(globals[1])),false);assert.equal([...originals.get(globals[1]).matchAll(/^- D204:/gmu)].length,1);
const recordedAt=new Date().toISOString(),resultPath=folder+'/result.json',criteriaUpdated=['PLANETKA-002'],criterionTargets=['S15.PLANETKA-002'];
assert.deepEqual(scope.requirementEvidenceTargets,criteriaUpdated);assert.deepEqual(scope.criterionEvidenceTargets,criterionTargets);
const nextAction='Resume S15 current-only character-step admission and deliberate dossier modal action composition: fail-closed adult integration using real published-dossier capability, a fresh identity/locale lease and rendered acknowledgement before Next, without opening-only progress or populating the empty production inventory. Batch-rebind stale historical Controls whole-file provenance when runtime editing settles; preserve all 34 unchanged draft records without approving dialogue. S03.acceptance remains first unresolved.';
const summary=scope.description+' TypeScript and '+entry.expectedBrowserTests+' selected actual-App browser cases pass with '+screenshots.length+' authenticated captures; '+visual.images.length+' images are directly reviewed. No unit suite was run for this presentation change. PWA '+pwa.buildId.slice(0,8)+' and Android-dev '+android.buildId.slice(0,8)+' are rebuilt and byte-audited; '+protectedFiles.length+' prior source inputs remain exact. No native keyboard, large-text, tablet-194 branch or full accessibility acceptance is claimed.';
const limitations=['The original a1 failure demonstrated clipped disabled Walk status only. Move and Hide remained enabled and exposed; it did not demonstrate loss of an enabled action.','The blank-page CDP visible-size probe measured no real visualViewport contraction. Actual-App stress injects observed viewport height and a labelled occluder; this is not native keyboard behavior or native lifecycle equivalence.','Only final source-bound cases support the compact/restored presentation, RU 144px help branch and genuine persistence-failure outer-scroll/Retry claims. The tablet 194px and enlarged-text branches are not claimed.','No unit suite or inventory audit is rerun. Walking authority, geometry, model, animation, renderer and saved-motion source remain unchanged.','All 34 historical draft records and exact copy remain unchanged and unapproved. Controls whole-file provenance from D203 is now stale; a later explicit batch rebind is pending. No current inventory-source audit success is claimed.','Only bounded S15.PLANETKA-002 presentation evidence is added under specification 12 section 2. All statuses and acceptance gates remain unchanged; no standalone model-photo, installed-device or full accessibility acceptance is claimed.',...visual.limitations];
const result={schemaVersion:1,recordedAt,pass:true,stage:'S15',status:'BOOKY_SHORT_VIEWPORT_SCOPED_VALIDATION',sourceCommit,entry:await ref(folder+'/entry.json'),checkpointHelper:await ref(folder+'/checkpoint.mjs'),previous:entry.previousCheckpointResult,previousRuntimeResult:entry.previousRuntimeResult,previousRuntimeSourceCommit:priorRuntime.sourceCommit,sourceManifest,sourceCommits:[sourceCommit],attempts,runs,earlierAttempts,diagnosticHistory,checkpointGuardHistory,directSpecificationEvidence:scope.directSpecificationEvidence,historicalDialogueInputs:scope.historicalDialogueInputs,newUiCopyStatus:scope.newUiCopyStatus,unitCount:null,unitFiles:entry.unitFiles,unitValidation:scope.unitValidation,unitSuitesRerun:false,browserCases:entry.expectedBrowserTests,actualAppCaseCount:specs.length,captures,validatedBehavior:behavior,visualReview:await ref(visualPath),newPhotoReview,newModelPhotoCount,retainedModelPhotoReview,historicalModelPhotoReview,inspectedImageCount:visual.images.length,totalCapturedImageCount:screenshots.length,visualReviewScope:visual.scope,visualReviewLimitations:visual.limitations,unchangedTrackedInputCount:protectedFiles.length,protectedInputsVerified:true,changedSourcePaths:entry.changedPaths,newSourcePaths:entry.newSourcePaths,supplementalTestInputs:entry.supplementalTestInputs,supplementalBrowserInputs:entry.supplementalBrowserInputs,supplementalArchiveInputs:entry.supplementalArchiveInputs,supplementalArchiveGitIdentity:entry.supplementalArchiveGitIdentity,productionInventorySources,productionJourneyCount:0,approvedProductionDialogueCount:0,combinedDraftCount:34,productionMigrationCount:0,pwa:await ref(pwaPath),android:await ref(androidPath),pwaBuildId:pwa.buildId,androidBuildId:android.buildId,apk:android.apk,buildManifests,buildAudits,buildBaseline:await ref(folder+'/build-baseline.json'),copyVerification:await ref(folder+'/pwa-a1/copy-verification.json'),pwaBrowserReport:await ref(folder+'/pwa-a1/playwright.json'),buildsRebuilt:true,browserRerun:true,retainedCheckpoint:{result:entry.previousCheckpointResult,sourceCommit:prior.sourceCommit,sourceManifest:prior.sourceManifest,unitCount:prior.unitCount,inventory:prior.inventory},retainedContext:{sourceCommit:priorRuntime.sourceCommit,result:entry.previousRuntimeResult,unitCount:priorRuntime.unitCount,browserCases:priorRuntime.browserCases,allPriorSelectedCasesRerun,priorSelectedBrowserCaseCount:priorRuntime.browserCases,currentSelectedBrowserCaseCount:entry.expectedBrowserTests,formerLargerSuitesRerun:false,photos:historicalModelPhotoReview,photosHistoricalOnly:true,photosClaimCurrentRenderer:false},criteriaUpdated,criterionEvidenceTargets:criterionTargets,criterionChanges:[],requirementChanges:[],allStageAndCriterionStatusesUnchanged:true,counts,firstUnresolved:'S03.acceptance',decisionD205Recorded:true,nextAction,limitations,bookyShortViewportImplemented:true,runtimeWiringImplemented:true,characterJourneyNodeImplemented:false,productionJourneysEnabled:false,reviewedDialogueAccepted:false,childApproved:false,narrationEnabled:false,installedNativeDevice:false,iosCompiled:false,fullAccessibilityAccepted:false,artAccepted:false,brandingApproved:false,rightsApproved:false,stageAccepted:false,productionActionsPerformed:false,releaseReady:false};

const push=(items,item)=>{if(!items.includes(item))items.push(item);},stage=state.stages.find(s=>s.id==='S15');

for(const id of criteriaUpdated){const requirement=trace.requirements.find(r=>r.id===id);assert.ok(requirement);requirement.commit=sourceCommit;requirement.notes+=' '+summary;push(requirement.evidence,resultPath);for(const p of entry.runtimeRequired)push(requirement.implementationFiles,p);for(const p of [...entry.unitFiles,...entry.browserFiles])push(requirement.tests,p);}
for(const target of criterionTargets){const matches=state.stages.flatMap(owner=>owner.criteria.filter(c=>c.id===target));assert.equal(matches.length,1,target);const criterion=matches[0];criterion.commit=sourceCommit;criterion.notes+=' '+summary;push(criterion.evidence,resultPath);criterion.lastValidatedAt=recordedAt;}
for(const owner of state.stages)for(const criterion of owner.criteria)if(!criterionTargets.includes(criterion.id))assert.deepEqual(criterion,beforeState.stages.find(item=>item.id===owner.id).criteria.find(item=>item.id===criterion.id),criterion.id+' unchanged');
for(const p of [resultPath,folder+'/README.md',folder+'/entry.json',sourceManifest.path,visualPath,...(newPhotoReview?[newPhotoPath]:[]),...Object.values(runs).map(r=>r.path),pwaPath,androidPath])push(stage.artifacts,p);
for(const [mode,attempt]of Object.entries(attempts))push(stage.lastGreenCommands,'node '+folder+'/check.mjs '+mode+' '+attempt);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;push(state.resume.contextFiles,resultPath);push(state.resume.doNotRepeat,'Preserve compact observed-space status visibility, existing 44px controls, genuine persistence Retry, saved position and collection dock ownership; keep controlled stress distinct from native keyboard behavior.');
state.verificationCache.s15BookyShortViewport={path:resultPath,sha256:sha(json(result)),sourceCommit,status:result.status,pwa:result.pwa,android:result.android,stageAccepted:false,releaseReady:false};
const statuses=s=>s.stages.map(stage=>[stage.id,stage.status,stage.criteria.map(c=>[c.id,c.status])]);assert.deepEqual(statuses(state),statuses(beforeState));assert.deepEqual(trace.requirements.map(r=>[r.id,r.status]),beforeTrace.requirements.map(r=>[r.id,r.status]));assert.deepEqual(trace.requirements.filter(r=>!criteriaUpdated.includes(r.id)),beforeTrace.requirements.filter(r=>!criteriaUpdated.includes(r.id)));
const marker='<!-- s15-booky-short-viewport-20260927:begin -->',note=marker+'\nSource '+sourceCommit+': '+summary+'\nEvidence: evidence/S15/booky-short-viewport-20260927/result.json. D205. All statuses unchanged: 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\n'+nextAction+'\n<!-- s15-booky-short-viewport-20260927:end -->\n\n';
const rows=parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv','utf8'));assert.equal(originals.get(globals[6]).replaceAll('\r\n','\n'),projectTraceabilityCsv(beforeTrace,rows));
const updates=new Map([[globals[0],json(state)],[globals[1],originals.get(globals[1])+'\n- D205: Source '+sourceCommit+'. '+summary+' Evidence: evidence/S15/booky-short-viewport-20260927/result.json.\n'],...globals.slice(2,5).map(p=>{assert.ok(!originals.get(p).includes(marker));return [p,note+originals.get(p)];}),[globals[5],json(trace)],[globals[6],projectTraceabilityCsv(trace,rows)]]);
await verifyAll(entry.checkpointFiles);await verifyAll(manifest.files);for(const [p,b]of originals)assert.equal(await fs.readFile(p,'utf8'),b);
for(const p of [resultPath,folder+'/README.md'])await assert.rejects(fs.stat(p),{code:'ENOENT'});
if(preflight){console.log(json({pass:true,kind:'READ_ONLY_CHECKPOINT_PREFLIGHT',acceptanceRecorded:false,globalWrites:false,sourceCommit,sourceManifest,unitCount:null,browserCases:specs.length,protectedInputs:protectedFiles.length}));process.exit(0);}
await fs.writeFile(resultPath,json(result),{flag:'wx'});await fs.writeFile(folder+'/README.md','# S15 Booky controlled observed-space presentation\n\nSource: '+sourceCommit+'.\n\n'+summary+'\n\n'+limitations.map(s=>'- '+s).join('\n')+'\n',{flag:'wx'});for(const [p,b]of updates)await fs.writeFile(p,b);
console.log(json({pass:true,sourceCommit,unitCount:null,browserCases:specs.length,capturedImages:screenshots.length,inspectedImages:visual.images.length,sourceInputs:manifest.files.length,protectedInputs:protectedFiles.length,releaseReady:false}));
