import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';
const root='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
assert.equal((await fs.realpath('.')).replaceAll('\\','/'),root);
const folder='docs/mobile/evidence/S15/booky-help-placement-20260923';
const [sourceCommit,unitAttempt,staticAttempt,browserAttempt,...extra]=process.argv.slice(2);
assert.match(sourceCommit,/^[a-f0-9]{40}$/u);for(const a of [unitAttempt,staticAttempt,browserAttempt])assert.match(a,/^a[1-9][0-9]*$/u);assert.equal(extra.length,0);
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n',normal=p=>p.replaceAll('\\','/');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const verify=async r=>{const b=await fs.readFile(r.path);assert.equal(sha(b),r.sha256,r.path);return b;};
const verified=async r=>JSON.parse(await verify(r));
const verifyAll=async refs=>{for(const r of refs)await verify(r);};
const git=args=>execFileSync('git',['-c','safe.directory='+root,'-c','core.quotePath=false','-c','core.autocrlf=false',...args],{encoding:'utf8',windowsHide:true}).trim();
const entry=await read(folder+'/entry-a3.json'),scope=await verified(entry.scopeConfiguration),prior=await verified(entry.previousCheckpointResult);
assert.equal(git(['rev-parse','HEAD']),sourceCommit);git(['merge-base','--is-ancestor',entry.checkpoint,sourceCommit]);
assert.equal(prior.pass,true);assert.equal(prior.releaseReady,false);
const expected=new Map([...entry.changedPaths.map(p=>[p,'M']),...entry.newSourcePaths.map(p=>[p,'A'])]);
const sourceDiff=git(['diff','--name-status',entry.checkpoint,sourceCommit,'--','src','tests','scripts','apps','public','data','index.html','native.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','vite.native.config.ts','vite.pwa.config.ts','capacitor.config.json']).split(/\r?\n/u).filter(Boolean).map(s=>s.split('\t'));
assert.deepEqual(sourceDiff.map(([status,p])=>[p,status]).sort(),[...expected].sort());
const baseline=await verified(entry.priorSourceManifest),attempts={unit:unitAttempt,static:staticAttempt,browser:browserAttempt},runs={};let sourceManifest,manifest;
for(const [mode,attempt]of Object.entries(attempts)){
 const out=folder+'/'+mode+'-'+attempt,r=await read(out+'/result.json'),execution=await read(out+'/execution.json');
 assert.equal(r.pass,true);assert.equal(r.sourceInputsUnchanged,true);assert.equal(r.execution.exitCode,0);assert.equal(execution.exitCode,0);assert.equal(r.releaseReady,false);
 if(sourceManifest)assert.deepEqual(r.sourceManifest,sourceManifest);else {sourceManifest=r.sourceManifest;manifest=await verified(sourceManifest);}
 await verifyAll([...r.checkInputs,...r.supplementalTestInputs,...r.supplementalBrowserInputs,...r.supplementalArchiveInputs,execution.stdout,execution.stderr]);
 assert.ok(r.checkInputs.some(x=>x.path===folder+'/scope.json'&&x.sha256===entry.scopeConfiguration.sha256));
 runs[mode]={...await ref(out+'/result.json'),execution:await ref(out+'/execution.json'),tests:r.tests,rawReport:mode==='static'?null:await ref(out+'/'+(mode==='unit'?'vitest':'playwright')+'.json')};
}
const earlierAttempts=[];
for(const dir of await fs.readdir(folder,{withFileTypes:true})){const match=dir.name.match(/^(unit|static|browser)-(a[1-9][0-9]*)$/u);if(!dir.isDirectory()||!match||attempts[match[1]]===match[2])continue;const out=folder+'/'+dir.name;const record=await read(out+'/result.json');await verify(record.sourceManifest);const execution=await read(out+'/execution.json');await verifyAll([execution.stdout,execution.stderr]);earlierAttempts.push({result:await ref(out+'/result.json'),execution:await ref(out+'/execution.json'),rawReport:match[1]==='static'?null:await ref(out+'/'+(match[1]==='unit'?'vitest':'playwright')+'.json'),pass:record.pass,sourceManifest:record.sourceManifest,retainedOnly:true});}
assert.equal(manifest.files.length,entry.sourceInputCount);assert.equal(manifest.checkpoint,entry.checkpoint);await verifyAll(manifest.files);
const sourceMap=new Map(manifest.files.map(r=>[r.path,r.sha256]));
const protectedFiles=baseline.files.filter(r=>!entry.changedPaths.includes(r.path));assert.equal(protectedFiles.length,entry.protectedInputCount);
for(const r of protectedFiles)assert.equal(sourceMap.get(r.path),r.sha256,r.path);
for(const r of entry.currentSourceInputs){assert.equal(sourceMap.get(r.path),r.sha256);const blob=execFileSync('git',['-c','safe.directory='+root,'show',sourceCommit+':'+r.path],{windowsHide:true});assert.equal(sha(blob),r.sha256,r.path+' Git blob');}
const supplemental=[...entry.supplementalTestInputs,...entry.supplementalBrowserInputs,...entry.supplementalArchiveInputs];await verifyAll(supplemental);
const inputs=new Map([...manifest.files,...supplemental].map(r=>[r.path,r.sha256]));
const units=await verified(runs.unit.rawReport),unitCases=units.testResults.flatMap(r=>r.assertionResults);
assert.deepEqual(units.testResults.map(r=>normal(path.relative(root,r.name))).sort(),[...entry.unitFiles].sort());assert.ok(unitCases.length>0&&unitCases.every(r=>r.status==='passed'));assert.deepEqual(runs.unit.tests,{passed:unitCases.length,failed:0,skipped:0});
const browser=await verified(runs.browser.rawReport);assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[entry.expectedBrowserTests,0,0,0]);assert.deepEqual(browser.errors,[]);
const flatten=suites=>suites.flatMap(s=>[...(s.specs??[]),...flatten(s.suites??[])]),specs=flatten(browser.suites);
assert.equal(specs.length,entry.expectedBrowserTests);assert.deepEqual([...new Set(specs.map(s=>s.file))].sort(),entry.browserFiles.map(p=>p.split('/').at(-1)).sort());
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
}
for(const contract of scope.requiredCaptureFlags??[])assert.equal(behavior.filter(x=>x.scenario===contract.scenario).length,1,contract.scenario);
assert.equal(screenshots.length,entry.expectedImages);assert.equal(new Set(screenshots.map(x=>x.path)).size,screenshots.length);
const visualPath=folder+'/visual-review.json',visual=await read(visualPath);assert.equal(visual.pass,true);assert.equal(visual.sourceCommit,sourceCommit);assert.deepEqual(visual.sourceManifest,sourceManifest);assert.equal(visual.releaseReady,false);
assert.deepEqual(visual.images.map(x=>normal(x.path)+'|'+x.sha256).sort(),screenshots.map(x=>x.path+'|'+x.sha256).sort());
for(const image of visual.images){await verify(image);assert.equal(image.inspected,true);assert.ok(image.reviewer&&image.findings?.length);}
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
if(hasDiagnostics){const diagnostics=await read(diagnosticPath);assert.equal(diagnostics.recordingComplete,true);assert.ok(Array.isArray(diagnostics.attempts));for(const a of diagnostics.attempts){await verifyAll([a.report,a.sourceEvidence,a.attachment,a.executionEvidence.stdout,a.executionEvidence.stderr]);const r=await verified(a.report);assert.equal(r.stats.expected,a.tests.passed);assert.equal(r.stats.unexpected,a.tests.failed);}diagnosticHistory=await ref(diagnosticPath);}
const productionInventorySources=prior.productionInventorySources;await verifyAll(productionInventorySources);for(const r of productionInventorySources)assert.equal(sourceMap.get(r.path),r.sha256);
const globals=['AUTOPILOT_STATE.json','DECISIONS.md','STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt','REQUIREMENTS_TRACEABILITY.json','REQUIREMENTS_TRACEABILITY.csv'].map(n=>'docs/mobile/'+n),originals=new Map(await Promise.all(globals.map(async p=>[p,await fs.readFile(p,'utf8')])));
const state=JSON.parse(originals.get(globals[0])),trace=JSON.parse(originals.get(globals[5])),beforeTrace=structuredClone(trace),beforeState=structuredClone(state);
assert.equal(state.headSha,prior.sourceCommit);assert.equal(state.currentCriterionId,'S03.acceptance');assert.equal(state.resume.firstOpenCriterion,'S03.acceptance');assert.equal(state.verificationCache.s15BookyHelpPlacement,undefined);assert.equal(state.verificationCache.s15GlobeLandscapeControls.sha256,entry.previousCheckpointResult.sha256);
const counts=Object.fromEntries(['COMPLETE','IN_PROGRESS','NOT_STARTED'].map(status=>[status,state.stages.filter(s=>s.status===status).length]));assert.deepEqual(counts,{COMPLETE:3,IN_PROGRESS:12,NOT_STARTED:26});
assert.equal(/^- D180:/mu.test(originals.get(globals[1])),false);assert.equal([...originals.get(globals[1]).matchAll(/^- D179:/gmu)].length,1);
const recordedAt=new Date().toISOString(),resultPath=folder+'/result.json',criteriaUpdated=['PLANETKA-002','PLANETKA-005'];
const nextAction='Continue the user-prioritized companion work from this open-help placement checkpoint. Preserve finite gestures, deliberate interruptible walking, sticky accessible help dismissal, reduced-motion stillness, saved progress and canonical scene ownership. Review concrete remaining interaction defects before adding behavior. S03.acceptance remains first unresolved; device, full accessibility and stage/release acceptance remain open.';
const summary=scope.description+' Fresh '+unitCases.length+' focused unit cases, TypeScript and '+entry.expectedBrowserTests+' actual-App browser cases pass with '+screenshots.length+' inspected screenshots; PWA '+pwa.buildId.slice(0,8)+' and Android-dev '+android.buildId.slice(0,8)+' are freshly rebuilt and byte-audited. '+protectedFiles.length+' source inputs remain exact. This is a bounded layout/interaction fix, not full accessibility, installed-device, art or stage acceptance.';
const limitations=['The open-help placement searches finite gaps and retains readable scrolling; crowded small screens can still require overlap with underlying navigation. Strict navigation reachability is claimed only for the tested desktop/open-help and small-screen/closed-help states.','Fresh browser evidence covers the configured companion and reader-policy fixtures only; earlier broader suites remain attributed to their original sources.','Native OS/preference ports are controlled browser test ports. No installed device, nonzero OS-safe-area validation or iOS compilation was used.','Companion geometry and animation are unchanged; retained real model photographs remain original-source renders.','Production journey and migration inventories remain empty; all 34 dialogue drafts remain unapproved.','All requirement and stage statuses remain unchanged; no release or production action is performed.'];
const result={schemaVersion:1,recordedAt,pass:true,stage:'S15',status:'BOOKY_HELP_PLACEMENT_SCOPED_VALIDATION',sourceCommit,entry:await ref(folder+'/entry-a3.json'),checkpointHelper:await ref(folder+'/checkpoint.mjs'),previous:entry.previousCheckpointResult,sourceManifest,sourceCommits:[sourceCommit],attempts,runs,earlierAttempts,diagnosticHistory,unitCount:unitCases.length,unitFiles:entry.unitFiles,browserCases:entry.expectedBrowserTests,actualAppCaseCount:specs.length,captures,validatedBehavior:behavior,visualReview:await ref(visualPath),inspectedImageCount:screenshots.length,unchangedTrackedInputCount:protectedFiles.length,protectedInputsVerified:true,changedSourcePaths:entry.changedPaths,newSourcePaths:entry.newSourcePaths,supplementalTestInputs:entry.supplementalTestInputs,supplementalBrowserInputs:entry.supplementalBrowserInputs,supplementalArchiveInputs:entry.supplementalArchiveInputs,supplementalArchiveGitIdentity:entry.supplementalArchiveGitIdentity,productionInventorySources,productionJourneyCount:0,approvedProductionDialogueCount:0,combinedDraftCount:34,productionMigrationCount:0,pwa:await ref(pwaPath),android:await ref(androidPath),pwaBuildId:pwa.buildId,androidBuildId:android.buildId,apk:android.apk,buildManifests,buildAudits,buildBaseline:await ref(folder+'/build-baseline.json'),copyVerification:await ref(folder+'/pwa-a1/copy-verification.json'),pwaBrowserReport:await ref(folder+'/pwa-a1/playwright.json'),buildsRebuilt:true,browserRerun:true,retainedContext:{sourceCommit:prior.sourceCommit,result:entry.previousCheckpointResult,unitCount:prior.unitCount,browserCases:prior.browserCases,allPriorSelectedCasesRerun:true,formerLargerSuitesRerun:false,photos:prior.retainedContext?.photos??null},criteriaUpdated,criterionChanges:[],requirementChanges:[],allStageAndCriterionStatusesUnchanged:true,counts,firstUnresolved:'S03.acceptance',decisionD180Recorded:true,nextAction,limitations,bookyHelpPlacementImplemented:true,runtimeWiringImplemented:true,characterJourneyNodeImplemented:false,productionJourneysEnabled:false,reviewedDialogueAccepted:false,childApproved:false,narrationEnabled:false,installedNativeDevice:false,iosCompiled:false,fullAccessibilityAccepted:false,artAccepted:false,brandingApproved:false,rightsApproved:false,stageAccepted:false,productionActionsPerformed:false,releaseReady:false};
const push=(items,item)=>{if(!items.includes(item))items.push(item);},stage=state.stages.find(s=>s.id==='S15');
for(const id of criteriaUpdated){const criterion=stage.criteria.find(c=>c.id==='S15.'+id),requirement=trace.requirements.find(r=>r.id===id);assert.ok(criterion&&requirement);for(const item of [criterion,requirement]){item.commit=sourceCommit;item.notes+=' '+summary;push(item.evidence,resultPath);}criterion.lastValidatedAt=recordedAt;for(const p of entry.runtimeRequired)push(requirement.implementationFiles,p);for(const p of [...entry.unitFiles,...entry.browserFiles])push(requirement.tests,p);}
for(const p of [resultPath,folder+'/README.md',folder+'/entry-a3.json',sourceManifest.path,visualPath,...Object.values(runs).map(r=>r.path),pwaPath,androidPath])push(stage.artifacts,p);
for(const [mode,attempt]of Object.entries(attempts))push(stage.lastGreenCommands,'node '+folder+'/check-a3.mjs '+mode+' '+attempt);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;push(state.resume.contextFiles,resultPath);push(state.resume.doNotRepeat,'Open companion help placement and scrolled dismissal were checked with actual App and reader-policy regression evidence; retain finite movement and no automatic progress or target activation.');
state.verificationCache.s15BookyHelpPlacement={path:resultPath,sha256:sha(json(result)),sourceCommit,status:result.status,pwa:result.pwa,android:result.android,stageAccepted:false,releaseReady:false};
const statuses=s=>s.stages.map(stage=>[stage.id,stage.status,stage.criteria.map(c=>[c.id,c.status])]);assert.deepEqual(statuses(state),statuses(beforeState));assert.deepEqual(trace.requirements.map(r=>[r.id,r.status]),beforeTrace.requirements.map(r=>[r.id,r.status]));assert.deepEqual(trace.requirements.filter(r=>!criteriaUpdated.includes(r.id)),beforeTrace.requirements.filter(r=>!criteriaUpdated.includes(r.id)));
const marker='<!-- s15-booky-help-placement-20260923:begin -->',note=marker+'\nSource '+sourceCommit+': '+summary+'\nEvidence: evidence/S15/booky-help-placement-20260923/result.json. D180. All statuses unchanged: 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\n'+nextAction+'\n<!-- s15-booky-help-placement-20260923:end -->\n\n';
const rows=parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv','utf8'));assert.equal(originals.get(globals[6]).replaceAll('\r\n','\n'),projectTraceabilityCsv(beforeTrace,rows));
const updates=new Map([[globals[0],json(state)],[globals[1],originals.get(globals[1])+'\n- D180: Source '+sourceCommit+'. '+summary+' Evidence: evidence/S15/booky-help-placement-20260923/result.json.\n'],...globals.slice(2,5).map(p=>{assert.ok(!originals.get(p).includes(marker));return [p,note+originals.get(p)];}),[globals[5],json(trace)],[globals[6],projectTraceabilityCsv(trace,rows)]]);
await verifyAll(entry.checkpointFiles);await verifyAll(manifest.files);for(const [p,b]of originals)assert.equal(await fs.readFile(p,'utf8'),b);
for(const p of [resultPath,folder+'/README.md'])await assert.rejects(fs.stat(p),{code:'ENOENT'});
await fs.writeFile(resultPath,json(result),{flag:'wx'});await fs.writeFile(folder+'/README.md','# S15 open companion help placement\n\nSource: '+sourceCommit+'.\n\n'+summary+'\n\n'+limitations.map(s=>'- '+s).join('\n')+'\n',{flag:'wx'});for(const [p,b]of updates)await fs.writeFile(p,b);
console.log(json({pass:true,sourceCommit,unitCount:unitCases.length,browserCases:specs.length,images:screenshots.length,sourceInputs:manifest.files.length,protectedInputs:protectedFiles.length,releaseReady:false}));
