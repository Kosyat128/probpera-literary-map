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
const folder='docs/mobile/evidence/S15/journey-character-contract-20260923';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const ref=async file=>({path:file,sha256:sha(await fs.readFile(file))});
const verify=async item=>{const bytes=await fs.readFile(item.path);assert.equal(sha(bytes),item.sha256,item.path);if(item.bytes!==undefined)assert.equal(bytes.length,item.bytes,item.path);};
const git=args=>execFileSync('git',['-c','safe.directory='+root,...args],{windowsHide:true,encoding:'utf8'}).trim();
const gitBytes=args=>execFileSync('git',['-c','safe.directory='+root,...args],{windowsHide:true});
const entry=await read(folder+'/entry.json'); await verify(entry.previous); await verify(entry.priorSourceManifest);
const prior=await read(entry.previous.path),baseline=await read(entry.priorSourceManifest.path);
assert.equal(prior.pass,true); assert.equal(prior.releaseReady,false); assert.deepEqual(prior.sourceManifest,entry.priorSourceManifest);
assert.equal(baseline.files.length,1642); assert.equal(entry.priorSourceManifest.fileCount,1642);
const changed=entry.changedPaths,added=entry.newSourcePaths,required=[...changed,...added];
assert.deepEqual(changed,['src/host/bookyDossierCharacter.ts']);
const protectedFiles=baseline.files.filter(item=>!changed.includes(item.path));assert.equal(protectedFiles.length,1641);
assert.deepEqual(added,['src/host/bookyJourneyCharacter.ts','src/host/bookyJourneyCharacter.test.ts']);
assert.equal(git(['rev-parse','HEAD']),sourceCommit);
assert.equal(git(['rev-parse',sourceCommit+'^']),entry.checkpoint);
assert.deepEqual(git(['diff','--name-status',entry.checkpoint,sourceCommit]).split(/\r?\n/u).filter(Boolean).sort(),[...changed.map(file=>'M\t'+file),...added.map(file=>'A\t'+file)].sort());
assert.deepEqual(git(['diff','--name-only',entry.checkpoint,sourceCommit,'--','src','scripts','tests']).split(/\r?\n/u).filter(Boolean).sort(),required.slice().sort());
const clean=()=>assert.equal(git(['status','--porcelain','--untracked-files=all','--','src','scripts','tests','package.json','package-lock.json','tsconfig.json']),'');
clean();
for(const item of [...entry.checkpointFiles,...protectedFiles,...entry.supplementalTestInputs,...entry.supplementalBrowserInputs,...entry.currentSourceInputs])await verify(item);
const supplementalGitIdentity=[];
for(const item of entry.supplementalTestInputs){const committed=gitBytes(['show',entry.checkpoint+':'+item.path]),current=await fs.readFile(item.path);
  assert.equal(committed.toString('utf8').replaceAll('\r\n','\n'),current.toString('utf8').replaceAll('\r\n','\n'),item.path);
  supplementalGitIdentity.push({path:item.path,worktreeSha256:item.sha256,gitBlobSha256:sha(committed),lineEndingOnly:!committed.equals(current)});
}
const verifiedInputs=new Map(baseline.files.map(item=>[item.path,item.sha256]));
const verifyInputs=async items=>{for(const item of items){assert.ok(!added.includes(item.path),'New module must remain outside retained artifacts: '+item.path);if(verifiedInputs.has(item.path))assert.equal(verifiedInputs.get(item.path),item.sha256,item.path);else{await verify(item);verifiedInputs.set(item.path,item.sha256);}}};
for(const item of protectedFiles.filter(item=>item.path.startsWith('src/')&&/\.[cm]?[jt]sx?$/u.test(item.path)&&!/[.](test|spec)[.]/u.test(item.path))){
  const text=await fs.readFile(item.path,'utf8');for(const module of ['bookyDossierCharacter','bookyJourneyCharacter'])assert.equal(text.includes(module),false,'Unexpected production import: '+item.path);
}
const parserExport='/** Structural, immutable reference only; it supplies no publication or access authority. */\nexport function parseBookyDossierCharacterReference(input: unknown): BookyDossierCharacterReference | null {\n  try { return reference(input); } catch { return null; }\n}\n';
const adapterBefore=gitBytes(['show',entry.checkpoint+':'+changed[0]]),adapterAfter=await fs.readFile(changed[0]);
const normalize=bytes=>bytes.toString('utf8').replaceAll('\r\n','\n');assert.equal(normalize(adapterAfter).split(parserExport).length,2);assert.equal(normalize(adapterAfter).replace(parserExport,''),normalize(adapterBefore));
const adapterExportOnly={path:changed[0],beforeGitSha256:sha(adapterBefore),afterSha256:sha(adapterAfter),structuralParserExportOnly:true};
const runs={},attempts={unit:unitAttempt,static:staticAttempt},earlierAttempts=[];
let sourceManifest;
for(const [mode,attempt] of Object.entries(attempts)){
  const reportPath=`${folder}/${mode}-${attempt}/result.json`,report=await read(reportPath);
  assert.equal(report.pass,true); assert.equal(report.mode,mode); assert.equal(report.attempt,attempt);
  assert.equal(report.sourceInputsUnchanged,true); assert.equal(report.reportError,null); assert.equal(report.execution.exitCode,0);
  for(const flag of ['runtimeWiringImplemented','stageAccepted','ageAdaptiveJourneysAccepted','reviewedDialogueAccepted','childApproved','releaseReady'])assert.equal(report[flag],false);
  await verify(report.sourceManifest); const manifest=await read(report.sourceManifest.path);
  assert.equal(manifest.checkpoint,entry.checkpoint); assert.equal(manifest.files.length,1644); assert.equal(report.sourceManifest.fileCount,1644);
  assert.deepEqual(manifest.files.map(x=>x.path).sort(),[...baseline.files.map(x=>x.path),...added].sort());
  for(const item of manifest.files)await verify(item);
  for(const file of required)assert.equal(sha(gitBytes(['show',sourceCommit+':'+file])),manifest.files.find(x=>x.path===file).sha256);
  if(sourceManifest)assert.deepEqual(report.sourceManifest,sourceManifest);else sourceManifest=report.sourceManifest;
  assert.deepEqual(report.supplementalTestInputs,entry.supplementalTestInputs);assert.deepEqual(report.supplementalBrowserInputs,entry.supplementalBrowserInputs);
  for(const item of [...report.checkInputs,...report.supplementalTestInputs,...report.supplementalBrowserInputs])await verify(item);
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
    retainedArtifactSourceInputsAuthenticated:true,reachableRuntimeSourceInputsUnchanged:true,runtimePayloadRehashed:true,newJourneyCharacterContractIncluded:false,rebuilt:false});
}
// Retain original runs at their original source; no new browser/visual proof is claimed.
assert.deepEqual(entry.priorBrowser,prior.runs.browser);assert.deepEqual(entry.priorVisualReview,prior.visualReview);
const browser=entry.priorBrowser;
for(const item of [browser,browser.execution,browser.rawReport,...browser.checkInputs,entry.priorVisualReview])await verify(item);
const browserResult=await read(browser.path),browserExecution=await read(browser.execution.path),rawBrowser=await read(browser.rawReport.path);
assert.equal(browserResult.pass,true);assert.equal(browserResult.sourceInputsUnchanged,true);assert.equal(browserResult.reportError,null);
assert.deepEqual(browserResult.sourceManifest,entry.priorSourceManifest);assert.equal(browserExecution.exitCode,0);
await verify(browserExecution.stdout);await verify(browserExecution.stderr);
assert.deepEqual(browser.tests,{passed:32,failed:0,skipped:0,flaky:0});assert.deepEqual(browserResult.tests,browser.tests);
assert.deepEqual([rawBrowser.stats.expected,rawBrowser.stats.unexpected,rawBrowser.stats.skipped,rawBrowser.stats.flaky],[32,0,0,0]);assert.deepEqual(rawBrowser.errors,[]);
const specs=[],attachments=[];function visit(suite){specs.push(...(suite.specs??[]));for(const child of suite.suites??[])visit(child);}
for(const suite of rawBrowser.suites)visit(suite);assert.equal(specs.length,32);
for(const spec of specs)for(const test of spec.tests){assert.equal(test.status,'expected');for(const result of test.results){assert.equal(result.status,'passed');attachments.push(...(result.attachments??[]));}}
const appAttachments=attachments.filter(item=>item.contentType==='application/json'&&/^booky-(journey|reader-policy)-source-evidence$/u.test(item.name));
assert.equal(appAttachments.length,23);assert.equal(prior.actualAppCaptures.length,23);assert.equal(prior.componentAndArchiveCaptures.length,9);assert.equal(prior.captures.length,32);
assert.deepEqual(prior.captures,[...prior.actualAppCaptures,...prior.componentAndArchiveCaptures]);
assert.deepEqual(prior.appEvidenceAttachments.map(item=>item.sha256).sort(),prior.actualAppCaptures.map(item=>item.sha256).sort());
assert.deepEqual((await Promise.all(appAttachments.map(item=>ref(item.path)))).map(item=>item.sha256).sort(),prior.appEvidenceAttachments.map(item=>item.sha256).sort());
for(const item of prior.appEvidenceAttachments)await verify(item);
const forbiddenRuntimePaths=['src/host/bookyDossierCharacter.ts',...added],graphs=[],screenshots=[];
const baselineMap=new Map([...baseline.files,...entry.supplementalTestInputs,...entry.supplementalBrowserInputs].map(item=>[item.path,item.sha256]));
async function graphProof(reference,files){assert.ok(files.length>0);let dependencyCount=0,inlineFixtureCount=0;for(const file of files){assert.ok(!forbiddenRuntimePaths.includes(file),reference.path+': '+file);if(file.startsWith('node_modules/')){dependencyCount++;continue;}if(file==='<stdin>'){inlineFixtureCount++;continue;}assert.ok(baselineMap.has(file)||verifiedInputs.has(file),'Unpinned runtime input: '+file);}graphs.push({capture:reference,fileCount:files.length,dependencyCount,inlineFixtureCount,adapterAndContractAbsent:true});}
async function captureImage(file,metadata={}){const image=await ref(file),bytes=await fs.readFile(file);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(metadata.sha256)assert.equal(image.sha256,metadata.sha256);if(metadata.width)assert.equal(width,metadata.width);if(metadata.height)assert.equal(height,metadata.height);screenshots.push({...image,width,height});}
for(const item of prior.actualAppCaptures){await verify(item);const capture=await read(item.path);
  for(const flag of ['pass','actualApp','actualCss','actualGlobe'])assert.equal(capture[flag],true);
  for(const key of ['errors','externalRequests','missingResources'])assert.deepEqual(capture[key],[]);assert.equal(capture.releaseReady,false);
  await verifyInputs(capture.sourceInputs);await graphProof(item,capture.sourceInputs.map(input=>input.path));
  for(const shot of capture.screenshots??[])await captureImage(path.join(path.dirname(item.path),shot.filename),shot);
}
const componentCounts={'dossier-character-view.json':0,'dossier-character-archive.json':0,'dossier-navigation.json':0};
for(const item of prior.componentAndArchiveCaptures){await verify(item);const capture=await read(item.path),name=path.basename(item.path);assert.equal(capture.pass,true);assert.ok(Object.hasOwn(componentCounts,name));componentCounts[name]++;
  if(name==='dossier-character-view.json'){
    await graphProof(item,capture.sourceGraph);for(const key of ['remoteRequests','pageErrors'])assert.deepEqual(capture[key],[]);
    for(const shot of capture.captures)await captureImage(path.join(path.dirname(item.path),shot.filename),shot.viewport);
  }else if(name==='dossier-character-archive.json'){
    await verifyInputs(capture.sourceInputs);await graphProof(item,capture.sourceInputs.map(input=>input.path));
    for(const key of ['remoteRequests','pageErrors'])assert.deepEqual(capture[key],[]);
  }else{
    assert.equal(capture.actualArchive,true);assert.equal(capture.actualAccessibleReader,true);assert.equal(capture.actualReadingLibraryAndStorage,true);
    for(const key of ['pageErrors','remoteRequests'])assert.deepEqual(capture[key],[]);
    const pngs=(await fs.readdir(path.dirname(item.path))).filter(file=>file.endsWith('.png'));assert.equal(pngs.length,1);
    await captureImage(path.join(path.dirname(item.path),pngs[0]));
  }
}
assert.deepEqual(Object.values(componentCounts),[3,3,3]);assert.equal(graphs.length,29);assert.equal(screenshots.length,27);
const visual=await read(entry.priorVisualReview.path);assert.equal(visual.pass,true);assert.equal(visual.sourceCommit,prior.sourceCommit);assert.deepEqual(visual.sourceManifest,entry.priorSourceManifest);assert.equal(visual.images.length,27);
assert.deepEqual(visual.images.map(item=>normalized(item.path)+'|'+item.sha256).sort(),screenshots.map(item=>normalized(item.path)+'|'+item.sha256).sort());
for(const image of visual.images){await verify(image);assert.equal(image.inspected,true);assert.ok(image.reviewer&&image.findings.length);
  if(image.priorInspection){await verify(image.priorInspection);const old=await read(image.priorInspection.path),inspected=old.images.find(item=>item.path===image.priorInspection.imagePath&&item.sha256===image.priorInspection.imageSha256);assert.ok(inspected?.inspected);assert.equal(inspected.sha256,image.sha256);await verify(inspected);}
}
const retainedBrowser={sourceCommit:prior.sourceCommit,sourceManifest:entry.priorSourceManifest,run:browser,visualReview:entry.priorVisualReview,captures:prior.captures,appEvidenceAttachments:prior.appEvidenceAttachments,
  passedCases:32,actualAppCaseCount:23,componentAndArchiveCaseCount:9,inspectedImageCount:27,runtimeGraphs:graphs,ordinaryNavigationGraphNotRecorded:true,productionImportScanApplied:true,
  reachableRuntimeInputsUnchanged:true,rawReportsAndScreenshotsRehashed:true,adapterAndContractIncluded:false,rerun:false,visualInspectionRepeated:false};
const retainedUnits=[];await verify(prior.previousRuntime);const originalJourney=await read(prior.previousRuntime.path);
assert.equal(originalJourney.pass,true);assert.equal(originalJourney.releaseReady,false);
for(const [label,record,expected,authority] of [['dossier-character-view',prior,64,entry.previous],['journey-fact',originalJourney,717,prior.previousRuntime]]){
  const run=record.runs.unit;for(const item of [run,run.execution,record.sourceManifest])await verify(item);
  const result=await read(run.path),execution=await read(run.execution.path);assert.equal(result.pass,true);assert.deepEqual(result.sourceManifest,record.sourceManifest);assert.equal(execution.exitCode,0);await verify(execution.stdout);await verify(execution.stderr);
  const rawReference=record.unitReport??run.rawReport;await verify(rawReference);const raw=await read(rawReference.path),oldCases=raw.testResults.flatMap(item=>item.assertionResults);
  assert.equal(oldCases.length,expected);assert.ok(oldCases.every(item=>item.status==='passed'));assert.deepEqual([raw.numPassedTests,raw.numFailedTests,raw.numPendingTests],[expected,0,0]);
  retainedUnits.push({label,sourceCommit:record.sourceCommit,authority,result:run,rawReport:rawReference,sourceManifest:record.sourceManifest,passed:expected,rerun:false});
}
const priorJourney=prior.retainedUnits.find(item=>item.label==='journey-fact');assert.ok(priorJourney);assert.equal(priorJourney.sourceCommit,originalJourney.sourceCommit);assert.deepEqual(priorJourney.result,originalJourney.runs.unit);

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
assert.ok(!original.get(globals[1]).includes('- D176:'));assert.equal(original.get(globals[1]).split('- D175:').length,2);
assert.deepEqual({path:state.verificationCache.s15BookyDossierCharacterView.path,sha256:state.verificationCache.s15BookyDossierCharacterView.sha256},entry.previous);assert.equal(state.verificationCache.s15BookyDossierCharacterView.sourceCommit,prior.sourceCommit);assert.equal(state.verificationCache.s15BookyJourneyCharacterContract,undefined);
assert.deepEqual([prior.productionJourneyCount,prior.approvedProductionDialogueCount,prior.combinedDraftCount],[0,0,34]);
assert.deepEqual([prior.productionSourcedFactCount,prior.productionActivityCount,prior.productionHistoricalDefinitionCount,prior.productionMigrationCount,prior.approvedProductionMigrationReceiptCount],[0,0,0,0,0]);
for(const item of prior.productionInventorySources)await verify(item);
for(const item of [prior.productionContentSource,prior.productionMigrationContentSource])await verify(item);
const recordedAt=new Date().toISOString(),resultPath=folder+'/result.json';
const nextAction='Continue S15 with current-only character admission and deliberate modal action composition, gated by real published-dossier capability while controlled remote delivery remains disabled. Independently admit the journey, dialogue and exact adult policy before issuing an ephemeral view token; revalidate current canonical work, locale, published item/source projection, lease and modal receipt before explicit acknowledgement. The static RU/EN contract supplies identity only, never review, availability, navigation or credit. Preserve existing history, sourced facts, passport and canonical scene. Do not invent production character content, remote availability, child approval, place/world entities, device or release acceptance; S03.acceptance remains first unresolved.';
const limitations=['The character contract and its leased composer remain unimported by production entry points. The existing unimported adapter only gains an exported structural reference parser.',
 'Both RU/EN references, projection hashes and exact dialogue bindings participate in identity. This proves neither independent editorial review nor availability of the other locale; only the current trusted published projection is resolved.',
 'Fresh focused tests and TypeScript cover the additive boundary. Historical 64 focused and 717 journey unit reports retain their original source identities; no new broad host-unit, browser, visual or build run is claimed.',
 'Prior 32 browser cases, 27 inspected captures and PWA/Android artifacts retain their original source '+prior.sourceCommit+'. Actual App/Reader/Map/Archive graphs exclude these host modules. Artifact source audits may list the old unimported adapter; its old hash is authenticated against the prior manifest and unchanged emitted payloads, not misrepresented as current source bytes.',
 'No character journey node, modal acknowledgement, compiler/runtime/storage wiring, production content, remote capability or child access was enabled.'];
const result={schemaVersion:1,recordedAt,pass:true,sourceCommit,stage:'S15',status:'BOOKY_JOURNEY_CHARACTER_CONTRACT_VALIDATED',entry:await ref(folder+'/entry.json'),previous:entry.previous,previousRuntime:entry.previous,
 checkpointHelper:await ref(folder+'/checkpoint.mjs'),sourceManifest,runs,attempts,earlierAttempts,unitFiles:entry.unitFiles,unitCount:cases.length,unitRerun:true,unitReport:await ref(folder+'/unit-'+unitAttempt+'/vitest.json'),retainedUnits,supplementalTestInputs:entry.supplementalTestInputs,supplementalBrowserInputs:entry.supplementalBrowserInputs,supplementalGitIdentity,
 unchangedTrackedInputCount:1641,protectedInputsVerified:true,changedSourcePaths:changed,newSourcePaths:added,newImplementationFiles:entry.newImplementationFiles,adapterExportOnly,retainedBuilds,retainedBrowser,pwa:entry.priorPwa,android:entry.priorAndroid,pwaBuildId:prior.pwaBuildId,androidBuildId:prior.androidBuildId,
 browserCases:32,actualAppCaseCount:23,componentAndArchiveCaseCount:9,inspectedImageCount:27,visualReview:entry.priorVisualReview,buildsRebuilt:false,browserRerun:false,visualReviewRerun:false,runtimeUnchanged:true,runtimeSourceCommit:prior.sourceCommit,runtimeWiringImplemented:false,newContractIncludedInRetainedArtifacts:false,
 criterionChanges:[],requirementChanges:[],allStageAndCriterionStatusesUnchanged:true,counts,firstUnresolved:'S03.acceptance',decisionD176Recorded:true,nextAction,limitations,
 productionContentSource:prior.productionContentSource,productionMigrationContentSource:prior.productionMigrationContentSource,productionInventorySources:prior.productionInventorySources,productionInventorySourcesRehashed:true,
 productionJourneyCount:0,approvedProductionDialogueCount:0,combinedDraftCount:34,productionSourcedFactCount:0,productionActivityCount:0,productionHistoricalDefinitionCount:0,productionMigrationCount:0,approvedProductionMigrationReceiptCount:0,
 productionJourneysEnabled:false,reviewedDialogueAccepted:false,ageAdaptiveJourneysAccepted:false,childApproved:false,narrationEnabled:false,remoteDossierDeliveryEnabled:false,stageAccepted:false,productionActionsPerformed:false,releaseReady:false};
const scoped=' Added an unimported bounded RU/EN character contract with exact canonical work, localized dossier/item projection hashes and dialogue payload references, composed with the existing fresh leased adult resolver. The old adapter only exports its immutable structural parser. '+cases.length+' focused tests from '+entry.unitFiles.length+' files and TypeScript passed; 1,641 protected inputs remain exact. Prior 32 browser cases, 27 inspected captures and PWA/Android payloads are authenticated at source '+prior.sourceCommit.slice(0,8)+', without including the new contract. Independent review, current-only admission, capability gating and modal acknowledgement wiring remain separate pending work. No stage or release acceptance.';
const push=(items,value)=>{if(!items.includes(value))items.push(value);};
for(const item of [criterion,requirement]){item.commit=sourceCommit;item.notes+=scoped;push(item.evidence,resultPath);}
criterion.lastValidatedAt=recordedAt;for(const file of [...changed,...entry.newImplementationFiles])push(requirement.implementationFiles,file);push(requirement.tests,added[1]);
for(const file of [resultPath,folder+'/README.md',folder+'/entry.json',sourceManifest.path,...Object.values(runs).map(x=>x.path)])push(stage.artifacts,file);
for(const [mode,attempt] of Object.entries(attempts))push(stage.lastGreenCommands,`node ${folder}/check.mjs ${mode} ${attempt}`);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;push(state.resume.contextFiles,resultPath);
push(state.resume.doNotRepeat,'S15 static bilingual character contract and leased composer validated without production imports or journey/modal wiring; parser export only in prior adapter. Original browser/visual/artifact evidence retained; no remote or editorial approval.');
state.verificationCache.s15BookyJourneyCharacterContract={path:resultPath,sha256:sha(json(result)),sourceCommit,status:result.status,stageAccepted:false,releaseReady:false};
assert.deepEqual(state.stages.map(stage=>[stage.id,stage.status,stage.criteria.map(item=>[item.id,item.status])]),priorStatuses);
assert.deepEqual(trace.requirements.map(item=>[item.id,item.status]),priorTrace.requirements.map(item=>[item.id,item.status]));
assert.deepEqual(trace.requirements.filter(item=>item.id!=='PLANETKA-004'),priorTrace.requirements.filter(item=>item.id!=='PLANETKA-004'));
const marker='<!-- s15-journey-character-contract-20260923:begin -->';
const note=marker+'\nSource '+sourceCommit.slice(0,8)+':'+scoped+'\nPLANETKA-004 stays IN_PROGRESS; 3 complete, 12 in progress, 26 unstarted; releaseReady:false.\nEvidence: evidence/S15/journey-character-contract-20260923/result.json.\n'+nextAction+'\n<!-- s15-journey-character-contract-20260923:end -->\n\n';
const rows=parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv','utf8'));
assert.equal(original.get(globals[6]).replaceAll('\r\n','\n'),projectTraceabilityCsv(JSON.parse(original.get(globals[5])),rows));
const updates=new Map([[globals[0],json(state)],[globals[1],original.get(globals[1])+'\n- D176:'+scoped+' Evidence: evidence/S15/journey-character-contract-20260923/result.json.\n'],
  ...globals.slice(2,5).map(file=>{assert.ok(!original.get(file).includes(marker));return[file,note+original.get(file)]}),[globals[5],json(trace)],[globals[6],projectTraceabilityCsv(trace,rows)]]);
for(const [file,bytes]of original)assert.equal(await fs.readFile(file,'utf8'),bytes);
for(const item of [...entry.checkpointFiles,...(await read(sourceManifest.path)).files,...entry.supplementalTestInputs,...entry.supplementalBrowserInputs])await verify(item);clean();
await assert.rejects(fs.stat(resultPath),{code:'ENOENT'});await assert.rejects(fs.stat(folder+'/README.md'),{code:'ENOENT'});
await fs.writeFile(resultPath,json(result),{flag:'wx'});
await fs.writeFile(folder+'/README.md','# S15 Booky bilingual character contract\n\nSource: '+sourceCommit+'.\n\n'+scoped.trim()+'\n\n'+limitations.map(x=>'- '+x).join('\n')+'\n\nNext: '+nextAction+'\n',{flag:'wx'});
for(const [file,contents]of updates)await fs.writeFile(file,contents);
console.log(json({pass:true,sourceCommit,unitCount:cases.length,protectedInputs:1641,retainedBuilds:retainedBuilds.map(x=>({kind:x.kind,buildId:x.buildId,sourceCommit:x.sourceCommit})),releaseReady:false}));
