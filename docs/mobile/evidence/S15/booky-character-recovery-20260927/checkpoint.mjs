import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';
const root='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
assert.equal((await fs.realpath('.')).replaceAll('\\','/'),root);
const folder='docs/mobile/evidence/S15/booky-character-recovery-20260927';
const [sourceCommit,staticAttempt,browserAttempt,...extra]=process.argv.slice(2);
assert.match(sourceCommit,/^[a-f0-9]{40}$/u);for(const a of [staticAttempt,browserAttempt])assert.match(a,/^a[1-9][0-9]*$/u);assert.equal(extra.length,0);
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n',normal=p=>p.replaceAll('\\','/');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const verify=async r=>{const b=await fs.readFile(r.path);assert.equal(sha(b),r.sha256,r.path);return b;};
const verified=async r=>JSON.parse(await verify(r));
const verifyAll=async refs=>{for(const r of refs)await verify(r);};
const git=args=>execFileSync('git',['-c','safe.directory='+root,'-c','core.quotePath=false','-c','core.autocrlf=false',...args],{encoding:'utf8',windowsHide:true}).trim();
const entry=await read(folder+'/entry.json'),scope=await verified(entry.scopeConfiguration),prior=await verified(entry.previousCheckpointResult);
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
 runs[mode]={...await ref(out+'/result.json'),execution:await ref(out+'/execution.json'),tests:r.tests,rawReport:mode==='static'?null:await ref(out+'/'+'playwright'+'.json')};
}
const earlierAttempts=[];
for(const dir of await fs.readdir(folder,{withFileTypes:true})){const match=dir.name.match(/^(static|browser)-(a[1-9][0-9]*)$/u);if(!dir.isDirectory()||!match||attempts[match[1]]===match[2])continue;const out=folder+'/'+dir.name;const record=await read(out+'/result.json');await verify(record.sourceManifest);const execution=await read(out+'/execution.json');await verifyAll([execution.stdout,execution.stderr]);earlierAttempts.push({result:await ref(out+'/result.json'),execution:await ref(out+'/execution.json'),rawReport:match[1]==='static'?null:await ref(out+'/'+'playwright'+'.json'),pass:record.pass,sourceManifest:record.sourceManifest,retainedOnly:true});}
assert.equal(manifest.files.length,entry.sourceInputCount);assert.equal(manifest.checkpoint,entry.checkpoint);await verifyAll(manifest.files);
const sourceMap=new Map(manifest.files.map(r=>[r.path,r.sha256]));
const retainedModelPhotoReview=null;
assert.equal(scope.retainPriorModelPhotos,false);assert.equal(scope.expectedRetainedModelPhotos,0);
const historicalModelPhotoReview=prior.historicalModelPhotoReview??prior.retainedModelPhotoReview??prior.newPhotoReview??prior.retainedContext?.photos??null;
if(historicalModelPhotoReview)await verify(historicalModelPhotoReview);
for(const modelInput of ['src/host/bookyModel.ts','src/host/bookyAnimation.ts','src/host/useBookyWalk.ts','src/host/bookyMotionPreference.ts'])assert.equal(sourceMap.get(modelInput),baseline.files.find(item=>item.path===modelInput)?.sha256,modelInput+' remains unchanged');

const protectedFiles=baseline.files.filter(r=>!entry.changedPaths.includes(r.path));assert.equal(protectedFiles.length,entry.protectedInputCount);
for(const r of protectedFiles)assert.equal(sourceMap.get(r.path),r.sha256,r.path);
for(const r of entry.currentSourceInputs){assert.equal(sourceMap.get(r.path),r.sha256);const blob=execFileSync('git',['-c','safe.directory='+root,'show',sourceCommit+':'+r.path],{windowsHide:true});assert.equal(sha(blob),r.sha256,r.path+' Git blob');}
const supplemental=[...entry.supplementalTestInputs,...entry.supplementalBrowserInputs,...entry.supplementalArchiveInputs];await verifyAll(supplemental);
const inputs=new Map([...manifest.files,...supplemental].map(r=>[r.path,r.sha256]));
assert.equal(entry.expectedUnitTests,0);assert.deepEqual(entry.unitFiles,[]);assert.equal(scope.unitValidation,'not-run-no-changed-pure-unit-source');

const browser=await verified(runs.browser.rawReport);assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[entry.expectedBrowserTests,0,0,0]);assert.deepEqual(browser.errors,[]);
const flatten=suites=>suites.flatMap(s=>[...(s.specs??[]),...flatten(s.suites??[])]),specs=flatten(browser.suites);
assert.equal(specs.length,entry.expectedBrowserTests);assert.deepEqual(specs.map(spec=>spec.title).sort(),[...entry.browserTestTitles].sort());assert.deepEqual([...new Set(specs.map(s=>s.file))].sort(),entry.browserFiles.map(p=>p.split('/').at(-1)).sort());
const priorTitles=prior.captures.map(capture=>capture.test);assert.equal(new Set(priorTitles).size,prior.browserCases);
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
 for(const contract of scope.requiredCaptureFlags??[])if(capture.scenario===contract.scenario)for(const flag of contract.flags)assert.equal(capture[flag],true,flag);
 for(const contract of scope.requiredCaptureValues??[])if(capture.scenario===contract.scenario)for(const [key,value]of Object.entries(contract.values))assert.deepEqual(capture[key],value,contract.scenario+' '+key);
 for(const contract of scope.requiredObservationChecks??[])if(capture.scenario===contract.scenario){
  assert.equal(capture.observationsComplete,true,contract.scenario+' complete');
  const observation=capture.observations?.[contract.observation];assert.ok(observation,contract.scenario+' observations');
  assert.deepEqual(observation.findings,[],contract.scenario+' findings');assert.ok(Array.isArray(observation.checks));
  assert.equal(observation.checks.length,contract.checks.length,contract.scenario+' check count');
  assert.deepEqual(observation.checks.map(check=>check.name).sort(),[...contract.checks].sort(),contract.scenario+' check names');
  for(const check of observation.checks)assert.equal(check.pass,true,contract.scenario+' '+check.name);
  behavior.at(-1).observationChecks={observation:contract.observation,checks:observation.checks,findings:observation.findings};
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
const buildBaseline=await read(folder+'/build-baseline.json');assert.equal(buildBaseline.checkpoint,entry.checkpoint);
for(const [kind,key]of [['pwa','priorPwa'],['android','priorAndroid']]){const r=buildBaseline[key];assert.deepEqual({path:r.path,sha256:r.sha256},prior[kind]);const old=await verified(r);assert.equal(old.sourceCommit,prior.sourceCommit);assert.equal(old.buildId,r.buildId);}
const diagnosticPath=folder+'/diagnostic-history.json';let diagnosticHistory=null;
const hasDiagnostics=await fs.stat(diagnosticPath).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
if(scope.requireDiagnosticHistory)assert.equal(hasDiagnostics,true,'Record original diagnostic attempts before checkpoint');
if(hasDiagnostics){
 const diagnostics=await read(diagnosticPath);assert.equal(diagnostics.schemaVersion,2);assert.equal(diagnostics.recordingComplete,true);assert.equal(diagnostics.currentTaskAttemptsOnly,true);assert.equal(diagnostics.retainedPriorHistory,null);assert.deepEqual(diagnostics.priorResult,entry.previousCheckpointResult);assert.ok(Array.isArray(diagnostics.attempts)&&diagnostics.attempts.length>0);assert.equal(new Set(diagnostics.attempts.map(a=>a.id)).size,diagnostics.attempts.length);
 await verifyAll([diagnostics.priorResult,diagnostics.recorder,diagnostics.inputSpecification]);
 assert.ok(Array.isArray(diagnostics.supersededPreparations)&&diagnostics.supersededPreparations.length>0);for(const preparation of diagnostics.supersededPreparations){assert.equal(preparation.status,'superseded-before-execution');assert.equal(preparation.executed,false);assert.equal(preparation.browserStarted,false);assert.equal(preparation.nodeExit,null);assert.equal(preparation.tests,null);assert.ok(!diagnostics.attempts.some(attempt=>attempt.id===preparation.id));await verifyAll(preparation.evidence);for(const filename of preparation.absentExecutionPaths)await assert.rejects(fs.stat(filename),{code:'ENOENT'});}

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
const productionInventorySources=prior.productionInventorySources;await verifyAll(productionInventorySources);for(const r of productionInventorySources)assert.equal(sourceMap.get(r.path),r.sha256);
const globals=['AUTOPILOT_STATE.json','DECISIONS.md','STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt','REQUIREMENTS_TRACEABILITY.json','REQUIREMENTS_TRACEABILITY.csv'].map(n=>'docs/mobile/'+n),originals=new Map(await Promise.all(globals.map(async p=>[p,await fs.readFile(p,'utf8')])));
const state=JSON.parse(originals.get(globals[0])),trace=JSON.parse(originals.get(globals[5])),beforeTrace=structuredClone(trace),beforeState=structuredClone(state);
assert.equal(state.headSha,prior.sourceCommit);assert.equal(state.currentCriterionId,'S03.acceptance');assert.equal(state.resume.firstOpenCriterion,'S03.acceptance');assert.equal(state.verificationCache.s15BookyCharacterRecovery,undefined);assert.equal(state.verificationCache.s15BookyLargeText.sha256,entry.previousCheckpointResult.sha256);
const counts=Object.fromEntries(['COMPLETE','IN_PROGRESS','NOT_STARTED'].map(status=>[status,state.stages.filter(s=>s.status===status).length]));assert.deepEqual(counts,{COMPLETE:3,IN_PROGRESS:12,NOT_STARTED:26});
assert.equal(/^- D200:/mu.test(originals.get(globals[1])),false);assert.equal([...originals.get(globals[1]).matchAll(/^- D199:/gmu)].length,1);
const recordedAt=new Date().toISOString(),resultPath=folder+'/result.json',criteriaUpdated=['PLANETKA-002'],criterionTargets=['S15.PLANETKA-002'];
assert.deepEqual(scope.requirementEvidenceTargets,criteriaUpdated);assert.deepEqual(scope.criterionEvidenceTargets,criterionTargets);
const nextAction='Continue the user-prioritized mobile companion refinement from this verified checkpoint. Preserve explicit localized graphics recovery without hiding help, current context, Calm movements, gestures and progress, truthful recovery availability and canonical globe ownership. Keep actual WebGL context-loss evidence distinct from controlled pending/timeout failure coverage. Full journey integration remains deferred. S03.acceptance remains first unresolved; installed-device, full accessibility and stage/release acceptance remain open.';
const summary=scope.description+' TypeScript and '+entry.expectedBrowserTests+' selected actual-App browser cases pass with '+screenshots.length+' authenticated captures; '+visual.images.length+' selected screenshots are visually reviewed. No unit suite is newly run because the scoped change adds no pure-unit source change; earlier unit evidence retains its original source. PWA '+pwa.buildId.slice(0,8)+' and Android-dev '+android.buildId.slice(0,8)+' are freshly rebuilt and byte-audited. '+protectedFiles.length+' source inputs remain exact. Actual WebGL context-loss recovery is distinguished from controlled timeout/pending failure coverage. No standalone model-photo, installed-device, full accessibility or stage acceptance is claimed.';
const limitations=['Fresh validation consists of TypeScript and the selected actual-App browser cases. No unit suite is freshly run or counted; earlier pure-unit evidence retains its original source and scope.','Real WebGL context-loss recovery and controlled timeout/pending failure coverage are recorded separately. Controlled failures do not prove native GPU faults, broad hardware recovery or installed-device behavior.','Recovery claims are limited to the tested companion renderer and selected help, motion and viewport states. The canonical globe remains separately owned. Full device, performance, accessibility, art, stage and release acceptance remain open.','Model geometry and animation definitions remain unchanged; renderer lifecycle behavior changes. Older standalone model photos remain historical evidence only, and current-model visual claims use selected actual-App screenshots.','Only S15.PLANETKA-002 receives scoped evidence references. All requirement and stage statuses remain unchanged. Production journey and migration inventories remain empty; all 34 dialogue drafts remain unapproved.',...visual.limitations];
const result={schemaVersion:1,recordedAt,pass:true,stage:'S15',status:'BOOKY_CHARACTER_RECOVERY_SCOPED_VALIDATION',sourceCommit,entry:await ref(folder+'/entry.json'),checkpointHelper:await ref(folder+'/checkpoint.mjs'),previous:entry.previousCheckpointResult,sourceManifest,sourceCommits:[sourceCommit],attempts,runs,earlierAttempts,diagnosticHistory,unitCount:0,unitFiles:entry.unitFiles,unitValidation:scope.unitValidation,unitSuitesRerun:false,browserCases:entry.expectedBrowserTests,actualAppCaseCount:specs.length,captures,validatedBehavior:behavior,visualReview:await ref(visualPath),newPhotoReview,newModelPhotoCount,retainedModelPhotoReview,historicalModelPhotoReview,inspectedImageCount:visual.images.length,totalCapturedImageCount:screenshots.length,visualReviewScope:visual.scope,visualReviewLimitations:visual.limitations,unchangedTrackedInputCount:protectedFiles.length,protectedInputsVerified:true,changedSourcePaths:entry.changedPaths,newSourcePaths:entry.newSourcePaths,supplementalTestInputs:entry.supplementalTestInputs,supplementalBrowserInputs:entry.supplementalBrowserInputs,supplementalArchiveInputs:entry.supplementalArchiveInputs,supplementalArchiveGitIdentity:entry.supplementalArchiveGitIdentity,productionInventorySources,productionJourneyCount:0,approvedProductionDialogueCount:0,combinedDraftCount:34,productionMigrationCount:0,pwa:await ref(pwaPath),android:await ref(androidPath),pwaBuildId:pwa.buildId,androidBuildId:android.buildId,apk:android.apk,buildManifests,buildAudits,buildBaseline:await ref(folder+'/build-baseline.json'),copyVerification:await ref(folder+'/pwa-a1/copy-verification.json'),pwaBrowserReport:await ref(folder+'/pwa-a1/playwright.json'),buildsRebuilt:true,browserRerun:true,retainedContext:{sourceCommit:prior.sourceCommit,result:entry.previousCheckpointResult,unitCount:prior.unitCount,browserCases:prior.browserCases,allPriorSelectedCasesRerun,priorSelectedBrowserCaseCount:prior.browserCases,currentSelectedBrowserCaseCount:entry.expectedBrowserTests,formerLargerSuitesRerun:false,photos:historicalModelPhotoReview,photosHistoricalOnly:true,photosClaimCurrentRenderer:false},criteriaUpdated,criterionEvidenceTargets:criterionTargets,criterionChanges:[],requirementChanges:[],allStageAndCriterionStatusesUnchanged:true,counts,firstUnresolved:'S03.acceptance',decisionD200Recorded:true,nextAction,limitations,bookyCharacterRecoveryImplemented:true,runtimeWiringImplemented:true,characterJourneyNodeImplemented:false,productionJourneysEnabled:false,reviewedDialogueAccepted:false,childApproved:false,narrationEnabled:false,installedNativeDevice:false,iosCompiled:false,fullAccessibilityAccepted:false,artAccepted:false,brandingApproved:false,rightsApproved:false,stageAccepted:false,productionActionsPerformed:false,releaseReady:false};

const push=(items,item)=>{if(!items.includes(item))items.push(item);},stage=state.stages.find(s=>s.id==='S15');

for(const id of criteriaUpdated){const requirement=trace.requirements.find(r=>r.id===id);assert.ok(requirement);requirement.commit=sourceCommit;requirement.notes+=' '+summary;push(requirement.evidence,resultPath);for(const p of entry.runtimeRequired)push(requirement.implementationFiles,p);for(const p of [...entry.unitFiles,...entry.browserFiles])push(requirement.tests,p);}
for(const target of criterionTargets){const matches=state.stages.flatMap(owner=>owner.criteria.filter(c=>c.id===target));assert.equal(matches.length,1,target);const criterion=matches[0];criterion.commit=sourceCommit;criterion.notes+=' '+summary;push(criterion.evidence,resultPath);criterion.lastValidatedAt=recordedAt;}
for(const owner of state.stages)for(const criterion of owner.criteria)if(!criterionTargets.includes(criterion.id))assert.deepEqual(criterion,beforeState.stages.find(item=>item.id===owner.id).criteria.find(item=>item.id===criterion.id),criterion.id+' unchanged');
for(const p of [resultPath,folder+'/README.md',folder+'/entry.json',sourceManifest.path,visualPath,...(newPhotoReview?[newPhotoPath]:[]),...Object.values(runs).map(r=>r.path),pwaPath,androidPath])push(stage.artifacts,p);
for(const [mode,attempt]of Object.entries(attempts))push(stage.lastGreenCommands,'node '+folder+'/check.mjs '+mode+' '+attempt);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;push(state.resume.contextFiles,resultPath);push(state.resume.doNotRepeat,'Preserve explicit Booky graphics recovery without hiding help, synthetic large-text reflow, automatic WebView text scaling, all fifteen gestures, Surprise and Stop, saved Calm movements, adult progress and canonical scene ownership.');
state.verificationCache.s15BookyCharacterRecovery={path:resultPath,sha256:sha(json(result)),sourceCommit,status:result.status,pwa:result.pwa,android:result.android,stageAccepted:false,releaseReady:false};
const statuses=s=>s.stages.map(stage=>[stage.id,stage.status,stage.criteria.map(c=>[c.id,c.status])]);assert.deepEqual(statuses(state),statuses(beforeState));assert.deepEqual(trace.requirements.map(r=>[r.id,r.status]),beforeTrace.requirements.map(r=>[r.id,r.status]));assert.deepEqual(trace.requirements.filter(r=>!criteriaUpdated.includes(r.id)),beforeTrace.requirements.filter(r=>!criteriaUpdated.includes(r.id)));
const marker='<!-- s15-booky-character-recovery-20260927:begin -->',note=marker+'\nSource '+sourceCommit+': '+summary+'\nEvidence: evidence/S15/booky-character-recovery-20260927/result.json. D200. All statuses unchanged: 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\n'+nextAction+'\n<!-- s15-booky-character-recovery-20260927:end -->\n\n';
const rows=parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv','utf8'));assert.equal(originals.get(globals[6]).replaceAll('\r\n','\n'),projectTraceabilityCsv(beforeTrace,rows));
const updates=new Map([[globals[0],json(state)],[globals[1],originals.get(globals[1])+'\n- D200: Source '+sourceCommit+'. '+summary+' Evidence: evidence/S15/booky-character-recovery-20260927/result.json.\n'],...globals.slice(2,5).map(p=>{assert.ok(!originals.get(p).includes(marker));return [p,note+originals.get(p)];}),[globals[5],json(trace)],[globals[6],projectTraceabilityCsv(trace,rows)]]);
await verifyAll(entry.checkpointFiles);await verifyAll(manifest.files);for(const [p,b]of originals)assert.equal(await fs.readFile(p,'utf8'),b);
for(const p of [resultPath,folder+'/README.md'])await assert.rejects(fs.stat(p),{code:'ENOENT'});
await fs.writeFile(resultPath,json(result),{flag:'wx'});await fs.writeFile(folder+'/README.md','# S15 explicit Booky character recovery\n\nSource: '+sourceCommit+'.\n\n'+summary+'\n\n'+limitations.map(s=>'- '+s).join('\n')+'\n',{flag:'wx'});for(const [p,b]of updates)await fs.writeFile(p,b);
console.log(json({pass:true,sourceCommit,unitCount:0,browserCases:specs.length,capturedImages:screenshots.length,inspectedImages:visual.images.length,sourceInputs:manifest.files.length,protectedInputs:protectedFiles.length,releaseReady:false}));
