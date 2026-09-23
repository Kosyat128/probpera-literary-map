import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parseCsv} from '../../../../../scripts/mobile/csv.mjs';
import {projectTraceabilityCsv} from '../../../../../scripts/mobile/verify-state.mjs';

const [sourceCommit,unitAttempt,staticAttempt,...extra]=process.argv.slice(2);
assert.match(sourceCommit,/^[a-f0-9]{40}$/u); assert.equal(extra.length,0);
for(const value of [unitAttempt,staticAttempt])assert.match(value,/^a[1-9][0-9]*$/u);
const root='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
assert.equal((await fs.realpath('.')).replaceAll('\\','/'),root);
const folder='docs/mobile/evidence/S15/dossier-character-20260923';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const ref=async file=>({path:file,sha256:sha(await fs.readFile(file))});
const verify=async item=>{const bytes=await fs.readFile(item.path);assert.equal(sha(bytes),item.sha256,item.path);if(item.bytes!==undefined)assert.equal(bytes.length,item.bytes,item.path);};
const git=args=>execFileSync('git',['-c','safe.directory='+root,...args],{windowsHide:true,encoding:'utf8'}).trim();
const gitBytes=args=>execFileSync('git',['-c','safe.directory='+root,...args],{windowsHide:true});
const entry=await read(folder+'/entry.json'); await verify(entry.previous); await verify(entry.priorSourceManifest);
const prior=await read(entry.previous.path),baseline=await read(entry.priorSourceManifest.path);
assert.equal(prior.pass,true); assert.equal(prior.releaseReady,false); assert.deepEqual(prior.sourceManifest,entry.priorSourceManifest);
assert.equal(baseline.files.length,1636); assert.equal(entry.priorSourceManifest.fileCount,1636);
const added=entry.newImplementationFiles;
assert.deepEqual(added,['src/host/bookyDossierCharacter.ts','src/host/bookyDossierCharacter.test.ts']);
assert.equal(git(['rev-parse','HEAD']),sourceCommit);
assert.equal(git(['rev-parse',sourceCommit+'^']),entry.checkpoint);
assert.deepEqual(git(['diff','--name-status',entry.checkpoint,sourceCommit]).split(/\r?\n/u).filter(Boolean).sort(),added.map(file=>'A\t'+file).sort());
assert.deepEqual(git(['diff','--name-only',entry.checkpoint,sourceCommit,'--','src','scripts','tests']).split(/\r?\n/u).filter(Boolean).sort(),added.slice().sort());
const clean=()=>assert.equal(git(['status','--porcelain','--untracked-files=all','--','src','scripts','tests','package.json','package-lock.json','tsconfig.json']),'');
clean();
for(const item of [...entry.checkpointFiles,...baseline.files,...entry.supplementalTestInputs,...entry.newSourceInputs])await verify(item);
const supplementalGitIdentity=[];
for(const item of entry.supplementalTestInputs){const committed=gitBytes(['show',entry.checkpoint+':'+item.path]),current=await fs.readFile(item.path);
  assert.equal(committed.toString('utf8').replaceAll('\r\n','\n'),current.toString('utf8').replaceAll('\r\n','\n'),item.path);
  supplementalGitIdentity.push({path:item.path,worktreeSha256:item.sha256,gitBlobSha256:sha(committed),lineEndingOnly:!committed.equals(current)});
}
const verifiedInputs=new Map(baseline.files.map(item=>[item.path,item.sha256]));
const verifyInputs=async items=>{for(const item of items){assert.ok(!added.includes(item.path),'Adapter must remain outside retained runtime: '+item.path);if(verifiedInputs.has(item.path))assert.equal(verifiedInputs.get(item.path),item.sha256,item.path);else{await verify(item);verifiedInputs.set(item.path,item.sha256);}}};
for(const item of baseline.files.filter(item=>item.path.startsWith('src/')&&/\.[cm]?[jt]sx?$/u.test(item.path))){
  assert.equal((await fs.readFile(item.path,'utf8')).includes('bookyDossierCharacter'),false,'Unexpected existing host adapter import: '+item.path);
}
const runs={},attempts={unit:unitAttempt,static:staticAttempt},earlierAttempts=[];
let sourceManifest;
for(const [mode,attempt] of Object.entries(attempts)){
  const reportPath=`${folder}/${mode}-${attempt}/result.json`,report=await read(reportPath);
  assert.equal(report.pass,true); assert.equal(report.mode,mode); assert.equal(report.attempt,attempt);
  assert.equal(report.sourceInputsUnchanged,true); assert.equal(report.reportError,null); assert.equal(report.execution.exitCode,0);
  for(const flag of ['runtimeWiringImplemented','stageAccepted','ageAdaptiveJourneysAccepted','reviewedDialogueAccepted','childApproved','releaseReady'])assert.equal(report[flag],false);
  await verify(report.sourceManifest); const manifest=await read(report.sourceManifest.path);
  assert.equal(manifest.checkpoint,entry.checkpoint); assert.equal(manifest.files.length,1638); assert.equal(report.sourceManifest.fileCount,1638);
  assert.deepEqual(manifest.files.map(x=>x.path).sort(),[...baseline.files.map(x=>x.path),...added].sort());
  for(const item of manifest.files)await verify(item);
  for(const file of added)assert.equal(sha(gitBytes(['show',sourceCommit+':'+file])),manifest.files.find(x=>x.path===file).sha256);
  if(sourceManifest)assert.deepEqual(report.sourceManifest,sourceManifest);else sourceManifest=report.sourceManifest;
  assert.deepEqual(report.supplementalTestInputs,entry.supplementalTestInputs);
  for(const item of [...report.checkInputs,...report.supplementalTestInputs])await verify(item);
  const executionPath=`${folder}/${mode}-${attempt}/execution.json`,execution=await read(executionPath);
  assert.equal(execution.exitCode,0);await verify(execution.stdout);await verify(execution.stderr);
  runs[mode]={...await ref(reportPath),tests:report.tests,execution:await ref(executionPath)};
  for(let n=1;n<Number(attempt.slice(1));n++){
    const file=`${folder}/${mode}-a${n}/result.json`,old=await read(file);
    await verify(old.sourceManifest); const execution=await read(`${folder}/${mode}-a${n}/execution.json`);
    await verify(execution.stdout);await verify(execution.stderr);
    earlierAttempts.push({...await ref(file),mode,pass:old.pass,reason:'Original attempt preserved; final matching source alone supports this checkpoint.'});
  }
}
const units=await read(`${folder}/unit-${unitAttempt}/vitest.json`),cases=units.testResults.flatMap(x=>x.assertionResults);
const normalized=x=>path.resolve(x).replaceAll('\\','/');
assert.deepEqual(units.testResults.map(x=>normalized(x.name)).sort(),entry.unitFiles.map(normalized).sort());
assert.ok(cases.length>0&&cases.every(x=>x.status==='passed'));
assert.deepEqual([units.numPassedTests,units.numFailedTests,units.numPendingTests],[cases.length,0,0]);
assert.deepEqual(runs.unit.tests,{passed:cases.length,failed:0,skipped:0});
const retainedBuilds=[];
for(const [kind,reference] of [['pwa',entry.priorPwa],['android',entry.priorAndroid]]){
  assert.deepEqual(reference,prior[kind]);await verify(reference);const build=await read(reference.path);
  assert.equal(build.pass,true);assert.equal(build.sourceCommit,prior.sourceCommit);
  const artifactManifest={path:build.artifact.path+'/artifact.json',sha256:build.artifact.artifactSha256??build.artifact.sha256};
  await verify(artifactManifest);const manifest=await read(artifactManifest.path);
  assert.equal(manifest.buildId,build.buildId);assert.equal(manifest.sourceCommit,build.sourceCommit);
  assert.equal(manifest.sourceInputs.sha256,build.sourceInputsSha256);assert.equal(sha(json(manifest.sourceInputs.files)),manifest.sourceInputs.sha256);
  await verifyInputs(manifest.sourceInputs.files);
  for(const item of manifest.inventory){const file=path.join(build.artifact.path,item.path),bytes=await fs.readFile(file);assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha256,file);}
  if(build.apk)await verify(build.apk);
  retainedBuilds.push({kind,buildId:build.buildId,sourceCommit:build.sourceCommit,priorResult:reference,artifactManifest,apk:build.apk??null,
    runtimeSourceInputsUnchanged:true,runtimePayloadRehashed:true,newDossierCharacterAdapterIncluded:false,rebuilt:false});
}
// Authenticate retained browser proof without rerunning or attributing it to this adapter.
assert.deepEqual(entry.priorBrowser,prior.runs.browser);assert.deepEqual(entry.priorVisualReview,prior.visualReview);
const browser=entry.priorBrowser;
for(const item of [browser,browser.execution,browser.rawReport,...browser.checkInputs,entry.priorVisualReview])await verify(item);
const browserResult=await read(browser.path),browserExecution=await read(browser.execution.path),rawBrowser=await read(browser.rawReport.path);
assert.equal(browserResult.pass,true);assert.equal(browserResult.sourceInputsUnchanged,true);assert.equal(browserResult.reportError,null);
assert.deepEqual(browserResult.sourceManifest,entry.priorSourceManifest);assert.equal(browserExecution.exitCode,0);
await verify(browserExecution.stdout);await verify(browserExecution.stderr);
assert.deepEqual(browser.tests,{passed:23,failed:0,skipped:0,flaky:0});assert.deepEqual(browserResult.tests,browser.tests);
assert.deepEqual([rawBrowser.stats.expected,rawBrowser.stats.unexpected,rawBrowser.stats.skipped,rawBrowser.stats.flaky],[23,0,0,0]);assert.deepEqual(rawBrowser.errors,[]);
const specs=[];const walk=suite=>{specs.push(...(suite.specs??[]));for(const child of suite.suites??[])walk(child);};for(const suite of rawBrowser.suites)walk(suite);
assert.equal(specs.length,23);for(const spec of specs){assert.equal(spec.ok,true);for(const test of spec.tests){assert.equal(test.status,'expected');assert.equal(test.results.length,1);assert.equal(test.results[0].status,'passed');}}
assert.equal(prior.actualAppCaptures.length,23);assert.equal(prior.browserAttachments.length,23);
assert.deepEqual(prior.actualAppCaptures.map(item=>item.sha256).sort(),prior.browserAttachments.map(item=>item.sha256).sort());
for(const item of prior.browserAttachments)await verify(item);
const screenshots=[];for(const item of prior.actualAppCaptures){await verify(item);const capture=await read(item.path);
  for(const flag of ['pass','actualApp','actualCss','actualGlobe'])assert.equal(capture[flag],true);
  for(const key of ['errors','externalRequests','missingResources'])assert.deepEqual(capture[key],[]);
  assert.equal(capture.releaseReady,false);await verifyInputs(capture.sourceInputs);
  for(const shot of capture.screenshots??[])screenshots.push({...shot,path:path.join(path.dirname(item.path),shot.filename)});
}
const visual=await read(entry.priorVisualReview.path);assert.equal(visual.pass,true);assert.equal(visual.sourceCommit,prior.sourceCommit);
assert.deepEqual(visual.sourceManifest,entry.priorSourceManifest);assert.deepEqual(visual.actualAppCaptures,prior.actualAppCaptures);
assert.equal(visual.images.length,22);assert.equal(screenshots.length,22);
assert.deepEqual(visual.images.map(item=>item.sha256).sort(),screenshots.map(item=>item.sha256).sort());
for(const image of visual.images){await verify(image);assert.equal(image.inspected,true);assert.ok(image.reviewer&&image.findings.length);
  const shot=screenshots.find(item=>item.sha256===image.sha256);await verify(shot);const bytes=await fs.readFile(image.path);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),shot.width);assert.equal(bytes.readUInt32BE(20),shot.height);
  if(image.priorInspection){await verify(image.priorInspection);const old=await read(image.priorInspection.path);
    const inspected=old.images.find(item=>item.path===image.priorInspection.imagePath&&item.sha256===image.priorInspection.imageSha256);
    assert.ok(inspected?.inspected);assert.equal(inspected.sha256,image.sha256);await verify(inspected);
  }
}
const retainedBrowser={sourceCommit:prior.sourceCommit,sourceManifest:entry.priorSourceManifest,run:browser,visualReview:entry.priorVisualReview,
  actualAppCaptures:prior.actualAppCaptures,browserAttachments:prior.browserAttachments,passedCases:23,inspectedImageCount:22,
  sourceInputsUnchanged:true,rawReportsAndScreenshotsRehashed:true,newDossierCharacterAdapterIncluded:false,rerun:false,visualInspectionRepeated:false};
const globals=['AUTOPILOT_STATE.json','DECISIONS.md','STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt','REQUIREMENTS_TRACEABILITY.json','REQUIREMENTS_TRACEABILITY.csv'].map(x=>'docs/mobile/'+x);
const original=new Map(await Promise.all(globals.map(async file=>[file,await fs.readFile(file,'utf8')])));
const state=JSON.parse(original.get(globals[0])),trace=JSON.parse(original.get(globals[5]));
const priorStatuses=state.stages.map(stage=>[stage.id,stage.status,stage.criteria.map(item=>[item.id,item.status])]);
const priorTrace=structuredClone(trace);
const stage=state.stages.find(x=>x.id==='S15'),criterion=stage.criteria.find(x=>x.id==='S15.PLANETKA-004'),requirement=trace.requirements.find(x=>x.id==='PLANETKA-004');
assert.equal(state.headSha,prior.sourceCommit);assert.equal(state.currentCriterionId,'S03.acceptance');
assert.equal(state.resume.firstOpenCriterion,'S03.acceptance');assert.equal(stage.status,'IN_PROGRESS');
assert.equal(criterion.status,'IN_PROGRESS');assert.equal(requirement.status,'IN_PROGRESS');assert.deepEqual(entry.requirements,['PLANETKA-004']);
const counts=Object.fromEntries(['COMPLETE','IN_PROGRESS','NOT_STARTED'].map(status=>[status,state.stages.filter(x=>x.status===status).length]));
assert.deepEqual(counts,{COMPLETE:3,IN_PROGRESS:12,NOT_STARTED:26});
assert.ok(!original.get(globals[1]).includes('- D174:'));assert.equal(original.get(globals[1]).split('- D173:').length,2);
assert.deepEqual({path:state.verificationCache.s15BookyJourneyFact.path,sha256:state.verificationCache.s15BookyJourneyFact.sha256},entry.previous);assert.equal(state.verificationCache.s15BookyJourneyFact.sourceCommit,prior.sourceCommit);assert.equal(state.verificationCache.s15BookyDossierCharacter,undefined);
assert.deepEqual([prior.productionJourneyCount,prior.approvedProductionDialogueCount,prior.combinedDraftCount],[0,0,34]);
assert.deepEqual([prior.productionSourcedFactCount,prior.productionActivityCount,prior.productionHistoricalDefinitionCount,prior.productionMigrationCount,prior.approvedProductionMigrationReceiptCount],[0,0,0,0,0]);
for(const item of prior.productionInventorySources)await verify(item);
for(const item of [prior.productionContentSource,prior.productionMigrationContentSource])await verify(item);
const recordedAt=new Date().toISOString(),resultPath=folder+'/result.json';
const nextAction='Continue S15 with an exact-item dossier panel view contract before connecting characters to journey nodes. Reuse the actual published reader, canonical work, current dossier version/locale/section/block/item, source binding and live publication lease. Opening a book alone never proves its character item is visible or acknowledged. Do not enable remote delivery or infer editorial, child, place or story-world approval. Preserve current explicit journey progress, sourced-fact fingerprints, review guards, confirmed passport and canonical scene. Accessibility, installed-device, iOS, age-adaptive/child, narration, stage and release acceptance remain pending; S03.acceptance is first unresolved.';
const limitations=['The new adapter is unimported. No character journey node, exact-item navigation/view contract, UI, persistence, production content or remote service was enabled.',
  'It admits only exact visible character items from a currently valid published dossier and freshly checks the immutable adult host snapshot. Returned data is not reusable authorization or proof that an item was viewed.',
  'Synthetic RU/EN dossier fixtures and approvals test the boundary and confer no editorial or production authority. Existing document/compiler/delivery, symbolic-map and controlled-public-client behavior was retested.',
  'Prior 23 actual-App browser cases and 22 inspected screenshots are authenticated unchanged at source '+prior.sourceCommit+'; they do not exercise the new adapter. No fresh browser or visual inspection is claimed.',
  'Retained PWA/Android runtime source inputs, payloads and APK were rehashed at their original source '+prior.sourceCommit+'. The adapter is absent; no rebuild, installed-device or release acceptance is claimed.'];
const result={schemaVersion:1,recordedAt,pass:true,sourceCommit,stage:'S15',status:'BOOKY_DOSSIER_CHARACTER_BOUNDARY_VALIDATED',entry:await ref(folder+'/entry.json'),previous:entry.previous,previousRuntime:entry.previous,
  checkpointHelper:await ref(folder+'/checkpoint.mjs'),sourceManifest,runs,attempts,earlierAttempts,unitFiles:entry.unitFiles,unitCount:cases.length,unitRerun:true,unitReport:await ref(folder+'/unit-'+unitAttempt+'/vitest.json'),supplementalTestInputs:entry.supplementalTestInputs,supplementalGitIdentity,
  unchangedTrackedInputCount:1636,protectedInputsVerified:true,newImplementationFiles:added,retainedBuilds,retainedBrowser,pwa:entry.priorPwa,android:entry.priorAndroid,pwaBuildId:prior.pwaBuildId,androidBuildId:prior.androidBuildId,
  buildsRebuilt:false,browserRerun:false,visualReviewRerun:false,runtimeUnchanged:true,runtimeSourceCommit:prior.sourceCommit,runtimeWiringImplemented:false,newAdapterIncludedInRetainedArtifacts:false,
  criterionChanges:[],requirementChanges:[],allStageAndCriterionStatusesUnchanged:true,counts,firstUnresolved:'S03.acceptance',decisionD174Recorded:true,nextAction,limitations,
  productionContentSource:prior.productionContentSource,productionMigrationContentSource:prior.productionMigrationContentSource,productionInventorySources:prior.productionInventorySources,productionInventorySourcesRehashed:true,
  productionJourneyCount:0,approvedProductionDialogueCount:0,combinedDraftCount:34,productionSourcedFactCount:0,productionActivityCount:0,productionHistoricalDefinitionCount:0,productionMigrationCount:0,approvedProductionMigrationReceiptCount:0,
  productionJourneysEnabled:false,reviewedDialogueAccepted:false,ageAdaptiveJourneysAccepted:false,childApproved:false,narrationEnabled:false,stageAccepted:false,productionActionsPerformed:false,releaseReady:false};
const scoped=' Added unimported adult admission for an exact sourced character item in a current published dossier, binding canonical work, dossier version/locale/section/block/item, source references, live publication lease and current host revision. '+cases.length+' focused adapter/document/compiler/delivery/diagram/public-client tests and TypeScript passed. All 1,636 previous implementation/test inputs plus two unchanged supplemental fixture inputs remain exact. Prior 23 browser cases, 22 inspected images and PWA/Android payloads are retained at source '+prior.sourceCommit.slice(0,8)+'; the new adapter is absent. Exact-item panel integration remains pending; no stage or release acceptance.';
const push=(items,value)=>{if(!items.includes(value))items.push(value);};
for(const item of [criterion,requirement]){item.commit=sourceCommit;item.notes+=scoped;push(item.evidence,resultPath);}
criterion.lastValidatedAt=recordedAt;push(requirement.implementationFiles,added[0]);push(requirement.tests,added[1]);
for(const file of [resultPath,folder+'/README.md',folder+'/entry.json',sourceManifest.path,...Object.values(runs).map(x=>x.path)])push(stage.artifacts,file);
for(const [mode,attempt] of Object.entries(attempts))push(stage.lastGreenCommands,`node ${folder}/check.mjs ${mode} ${attempt}`);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;push(state.resume.contextFiles,resultPath);
push(state.resume.doNotRepeat,'S15 dossier character admission validated without App wiring: exact published character, canonical work, source/version/locale/lease and fresh host revision. Prior browser/visual/PWA/Android evidence retained unchanged; no rebuilt adapter or full stage acceptance.');
state.verificationCache.s15BookyDossierCharacter={path:resultPath,sha256:sha(json(result)),sourceCommit,status:result.status,stageAccepted:false,releaseReady:false};
assert.deepEqual(state.stages.map(stage=>[stage.id,stage.status,stage.criteria.map(item=>[item.id,item.status])]),priorStatuses);
assert.deepEqual(trace.requirements.map(item=>[item.id,item.status]),priorTrace.requirements.map(item=>[item.id,item.status]));
assert.deepEqual(trace.requirements.filter(item=>item.id!=='PLANETKA-004'),priorTrace.requirements.filter(item=>item.id!=='PLANETKA-004'));
const marker='<!-- s15-dossier-character-20260923:begin -->';
const note=marker+'\nSource '+sourceCommit.slice(0,8)+':'+scoped+'\nPLANETKA-004 stays IN_PROGRESS; 3 complete, 12 in progress, 26 unstarted; releaseReady:false.\nEvidence: evidence/S15/dossier-character-20260923/result.json.\n'+nextAction+'\n<!-- s15-dossier-character-20260923:end -->\n\n';
const rows=parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv','utf8'));
assert.equal(original.get(globals[6]).replaceAll('\r\n','\n'),projectTraceabilityCsv(JSON.parse(original.get(globals[5])),rows));
const updates=new Map([[globals[0],json(state)],[globals[1],original.get(globals[1])+'\n- D174:'+scoped+' Evidence: evidence/S15/dossier-character-20260923/result.json.\n'],
  ...globals.slice(2,5).map(file=>{assert.ok(!original.get(file).includes(marker));return[file,note+original.get(file)]}),[globals[5],json(trace)],[globals[6],projectTraceabilityCsv(trace,rows)]]);
for(const [file,bytes]of original)assert.equal(await fs.readFile(file,'utf8'),bytes);
for(const item of [...entry.checkpointFiles,...(await read(sourceManifest.path)).files,...entry.supplementalTestInputs])await verify(item);clean();
await assert.rejects(fs.stat(resultPath),{code:'ENOENT'});await assert.rejects(fs.stat(folder+'/README.md'),{code:'ENOENT'});
await fs.writeFile(resultPath,json(result),{flag:'wx'});
await fs.writeFile(folder+'/README.md','# S15 Booky published dossier character admission\n\nSource: '+sourceCommit+'.\n\n'+scoped.trim()+'\n\n'+limitations.map(x=>'- '+x).join('\n')+'\n\nNext: '+nextAction+'\n',{flag:'wx'});
for(const [file,contents]of updates)await fs.writeFile(file,contents);
console.log(json({pass:true,sourceCommit,unitCount:cases.length,protectedInputs:1636,retainedBuilds:retainedBuilds.map(x=>({kind:x.kind,buildId:x.buildId,sourceCommit:x.sourceCommit})),releaseReady:false}));
