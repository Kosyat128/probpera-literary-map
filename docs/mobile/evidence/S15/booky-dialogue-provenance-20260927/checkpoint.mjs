import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parseCsv} from '../../../../../scripts/mobile/csv.mjs';
import {projectTraceabilityCsv} from '../../../../../scripts/mobile/verify-state.mjs';

// --preflight executes every guard and byte authentication, then exits before writes.
const [sourceCommit,unitAttempt,staticAttempt,inventoryAttempt,...extra]=process.argv.slice(2);
assert.match(sourceCommit,/^[a-f0-9]{40}$/u);assert.ok(extra.length===0||(extra.length===1&&extra[0]==='--preflight'));
const preflight=extra.length===1;
for(const attempt of [unitAttempt,staticAttempt,inventoryAttempt])assert.match(attempt,/^a[1-9][0-9]*$/u);
const root='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const folder='docs/mobile/evidence/S15/booky-dialogue-provenance-20260927';
assert.equal((await fs.realpath('.')).replaceAll('\\','/'),root);
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const verify=async r=>assert.equal((await ref(r.path)).sha256,r.sha256,r.path);
const verifyRef=async r=>{await verify(r);return read(r.path);};
const git=args=>execFileSync('git',['-c','safe.directory='+root,'-c','core.quotePath=false',...args],{encoding:'utf8',windowsHide:true}).trim();
const gitBytes=args=>execFileSync('git',['-c','safe.directory='+root,...args],{windowsHide:true,maxBuffer:8*1024*1024});
const normalized=p=>path.resolve(p).replaceAll('\\','/');
const noApproval=(v,keys=['stageAccepted','releaseReady'])=>{for(const key of keys)assert.equal(v[key],false,key);};
const sourceRoots=['src','scripts','tests','apps','public','data','index.html','native.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','vite.native.config.ts','vite.pwa.config.ts','capacitor.config.json'];
const clean=()=>{assert.equal(git(['rev-parse','HEAD']),sourceCommit);assert.equal(git(['status','--porcelain','--untracked-files=all','--',...sourceRoots]),'');};
const entry=await read(folder+'/entry.json'),scope=await verifyRef(entry.scopeConfiguration),changed=entry.changedPaths;
assert.deepEqual([...changed].sort(),['scripts/mobile/verify-booky-navigation-drafts.mjs','src/host/bookyNavigationDrafts.test.ts','src/host/bookyNavigationDrafts.ts']);
assert.deepEqual(entry.newSourcePaths,[]);assert.equal(scope.sourceFrozen,true);assert.equal(entry.expectedUnitTests,60);noApproval(entry);
assert.deepEqual(scope.requirementEvidenceTargets,['PLANETKA-003']);assert.deepEqual(scope.criterionEvidenceTargets,['S15.PLANETKA-003']);
assert.equal(git(['rev-parse',sourceCommit+'^']),entry.checkpoint);clean();
assert.deepEqual(git(['diff','--name-status',entry.checkpoint,sourceCommit]).split(/\r?\n/u).filter(Boolean).sort(),changed.map(p=>'M\t'+p).sort());
const prior=await verifyRef(entry.previousCheckpointResult),baseline=await verifyRef(entry.priorSourceManifest);
assert.equal(prior.pass,true);noApproval(prior);assert.equal(prior.sourceCommit,entry.runtimeSourceCommit);assert.equal(entry.runtimeSourceCommit,'798c072e61176cc191ceaacff0e18f1b6622dbd2');
assert.deepEqual(prior.sourceManifest,entry.priorSourceManifest);assert.equal(baseline.files.length,1660);
const baselineMap=new Map(baseline.files.map(r=>[r.path,r.sha256]));assert.equal(baselineMap.size,1660);
const protectedFiles=baseline.files.filter(r=>!changed.includes(r.path));assert.equal(protectedFiles.length,1657);
for(const r of [...protectedFiles,...entry.currentSourceInputs,...entry.checkpointFiles,...entry.proposalEvidence])await verify(r);
const attempts={unit:unitAttempt,static:staticAttempt,inventory:inventoryAttempt},runs={},earlierAttempts=[];
let sourceManifest,sourceFiles;
const checkPaths=['check.mjs','entry.json','unit.config.mjs','configure.mjs','scope.json'].map(n=>folder+'/'+n).sort();
for(const [mode,attempt]of Object.entries(attempts)){
 const prefix=folder+'/'+mode+'-'+attempt,report=await read(prefix+'/result.json');
 assert.equal(report.pass,true);assert.equal(report.mode,mode);assert.equal(report.attempt,attempt);assert.equal(report.sourceInputsUnchanged,true);assert.equal(report.reportError,null);assert.equal(report.execution.exitCode,0);assert.equal(report.runtimeUnchanged,true);noApproval(report);
 assert.deepEqual(report.checkInputs.map(r=>r.path).sort(),checkPaths);for(const r of report.checkInputs)await verify(r);
 const manifest=await verifyRef(report.sourceManifest);assert.equal(manifest.checkpoint,entry.checkpoint);assert.equal(manifest.files.length,1660);assert.equal(report.sourceManifest.fileCount,1660);
 assert.deepEqual(manifest.files.map(r=>r.path).sort(),baseline.files.map(r=>r.path).sort());
 if(sourceManifest)assert.deepEqual(report.sourceManifest,sourceManifest);else{sourceManifest=report.sourceManifest;sourceFiles=manifest.files;for(const r of sourceFiles){await verify(r);if(changed.includes(r.path))assert.equal(sha(gitBytes(['show',sourceCommit+':'+r.path])),r.sha256);else assert.equal(r.sha256,baselineMap.get(r.path));}}
 const execution=await read(prefix+'/execution.json');assert.equal(execution.exitCode,0);await verify(execution.stdout);await verify(execution.stderr);
 const rawName=mode==='unit'?'vitest.json':mode==='inventory'?'inventory.json':null;
 runs[mode]={...await ref(prefix+'/result.json'),tests:report.tests,execution:await ref(prefix+'/execution.json'),rawReport:rawName?await ref(prefix+'/'+rawName):null};
 for(let n=1;n<Number(attempt.slice(1));n++){const p=folder+'/'+mode+'-a'+n;let old;try{old=await read(p+'/result.json');}catch(error){if(error.code==='ENOENT')continue;throw error;}const execution=await read(p+'/execution.json');await verify(old.sourceManifest);await verify(execution.stdout);await verify(execution.stderr);let rawReport=null;if(rawName){try{rawReport=await ref(p+'/'+rawName);}catch(error){if(error.code!=='ENOENT')throw error;}}earlierAttempts.push({...await ref(p+'/result.json'),mode,attempt:'a'+n,pass:old.pass,tests:old.tests,sourceManifest:old.sourceManifest,execution:await ref(p+'/execution.json'),rawReport,reason:'Original attempt retained without changing its outcome; only selected matching reports support this checkpoint.'});}
}
const sourceMap=new Map(sourceFiles.map(r=>[r.path,r.sha256]));
const units=await verifyRef(runs.unit.rawReport),cases=units.testResults.flatMap(r=>r.assertionResults);
assert.deepEqual(units.testResults.map(r=>normalized(r.name)).sort(),entry.unitFiles.map(normalized).sort());assert.equal(cases.length,60);assert.ok(cases.every(r=>r.status==='passed'));
assert.deepEqual([units.numPassedTests,units.numFailedTests,units.numPendingTests],[60,0,0]);assert.deepEqual(runs.unit.tests,{passed:60,failed:0,skipped:0});
const inventory=await verifyRef(runs.inventory.rawReport);assert.equal(inventory.kind,'booky-navigation-draft-inventory');assert.equal(inventory.pass,true);assert.deepEqual(inventory.errors,[]);
for(const [key,value]of Object.entries({recordCount:22,navigationRecordCount:14,contextualRecordCount:8,combinedRecordCount:34,draftCount:22,notReviewedCount:22,combinedDraftCount:34,approvedCount:0,availableAdultCount:0,availableChildCount:0}))assert.equal(inventory[key],value,key);
noApproval(inventory,['changesExistingHelp','narrationEnabled','childApproved','humanReviewed','factualEditorialEvidenceClaimed','stageAccepted','releaseReady']);
for(const r of [...inventory.sourceFiles,...inventory.sourceInputs])await verify(r);
const proposal=name=>entry.proposalEvidence.find(r=>r.path.endsWith('/'+name));
const bindings=await verifyRef(proposal('source-bindings.json')),semantic=await verifyRef(proposal('semantic-invariants.json')),importProof=await verifyRef(proposal('runtime-import-proof.json')),applied=await verifyRef(proposal('apply-receipt.json'));
assert.equal(bindings.sourceCommit,entry.runtimeSourceCommit);assert.equal(bindings.checkpoint,entry.checkpoint);assert.equal(bindings.copyChanged,false);assert.equal(bindings.humanReviewed,false);
assert.deepEqual([...bindings.allowedChangedFiles].sort(),[...changed].sort());assert.equal(bindings.semanticInvariantsSha256,proposal('semantic-invariants.json').sha256);assert.equal(bindings.runtimeImportProofSha256,proposal('runtime-import-proof.json').sha256);
for(const r of bindings.files){assert.equal(r.beforeSha256,baselineMap.get(r.path));assert.equal(r.afterSha256,sourceMap.get(r.path));}
for(const r of bindings.protectedFiles)await verify(r);
assert.equal(applied.success,true);assert.equal(applied.testsExecuted,false);assert.deepEqual([...applied.writtenFiles].sort(),[...changed].sort());
assert.equal(importProof.runtimeReferences,0);assert.equal(importProof.matchingRuntimeGlobs,0);assert.equal(importProof.rebuildRequiredForTheseThreeFiles,false);for(const r of importProof.globSourceBindings)await verify(r);
assert.equal(semantic.runtimeToursUnchanged,true);assert.equal(semantic.support12Unchanged,true);assert.equal(semantic.records.length,22);noApproval(semantic);
const key=r=>r.id+':'+r.locale;assert.deepEqual(semantic.records.map(key).sort(),inventory.records.map(key).sort());
for(const source of inventory.sources){const expected=bindings.sourceDeclarations[source.sourcePath];assert.ok(expected);for(const [k,v]of Object.entries(expected))assert.equal(source[k],v);assert.equal(source.sourceCommit,entry.runtimeSourceCommit);assert.equal(source.sourceSha256,sha((await fs.readFile(source.sourcePath,'utf8')).replaceAll('\r\n','\n')));assert.equal(source.sourceHashEncoding,'sha256:utf8:lf');}
const revisions=[];
for(const record of inventory.records){const proof=semantic.records.find(r=>key(r)===key(record));assert.equal(proof.exactExistingCopyAndScope,true);assert.equal(proof.runtimeTextMatches,true);assert.equal(proof.copySha256,record.copySha256);const version=record.id.startsWith('navigation.')?2:3;assert.equal(record.version,version);assert.equal(record.sourceVersion,version);assert.equal(record.status,'draft');for(const k of ['runtimeTextMatches','contentChecksumMatches','recordChecksumMatches'])assert.equal(record[k],true);for(const k of ['reviewedDialogueAvailable','childDialogueAvailable'])assert.equal(record[k],false);revisions.push({id:record.id,locale:record.locale,priorVersion:version-1,version,copySha256:record.copySha256});}

// These reports/builds retain their original runtime source, never D203 attribution.
const retainedValidation={sourceCommit:prior.sourceCommit,result:entry.previousRuntimeResult,unit:prior.runs.unit,static:prior.runs.static,browser:prior.runs.browser,unitCount:prior.unitCount,browserCases:prior.browserCases,capturedImages:prior.totalCapturedImageCount,unitRerun:false,browserRerun:false,visualReview:prior.visualReview};
assert.equal(retainedValidation.unitCount,66);assert.equal(retainedValidation.browserCases,2);assert.equal(retainedValidation.capturedImages,6);
for(const mode of ['unit','static','browser']){const r=prior.runs[mode],run=await verifyRef(r);assert.equal(run.pass,true);assert.deepEqual(run.sourceManifest,entry.priorSourceManifest);const execution=await verifyRef(r.execution);assert.equal(execution.exitCode,0);await verify(execution.stdout);await verify(execution.stderr);if(r.rawReport)await verify(r.rawReport);}
await verify(prior.visualReview);
for(const r of [...prior.supplementalTestInputs,...prior.supplementalBrowserInputs,...prior.supplementalArchiveInputs,...prior.productionInventorySources])await verify(r);
const buildBaseline=await read(folder+'/build-baseline.json');assert.equal(buildBaseline.runtimeSourceCommit,prior.sourceCommit);assert.equal(buildBaseline.rebuilt,false);
const retainedBuilds=[];
for(const [kind,reference]of [['pwa',prior.pwa],['android',prior.android]]){
 const saved=buildBaseline[kind==='pwa'?'priorPwa':'priorAndroid'];assert.equal(saved.path,reference.path);assert.equal(saved.sha256,reference.sha256);
 const build=await verifyRef(reference);assert.equal(build.pass,true);assert.equal(build.sourceCommit,entry.runtimeSourceCommit);noApproval(build);
 const artifactManifest={path:build.artifact.path+'/artifact.json',sha256:build.artifact.artifactSha256??build.artifact.sha256};const manifest=await verifyRef(artifactManifest);
 assert.equal(manifest.sourceCommit,build.sourceCommit);assert.equal(manifest.buildId,build.buildId);assert.equal(manifest.sourceInputs.sha256,build.sourceInputsSha256);
 const sourceInventoryDifferences=[];
 for(const r of manifest.sourceInputs.files){if(changed.includes(r.path)){assert.equal(r.path,'src/host/bookyNavigationDrafts.ts');assert.equal(r.sha256,baselineMap.get(r.path));sourceInventoryDifferences.push({path:r.path,artifactSourceSha256:r.sha256,currentSourceSha256:sourceMap.get(r.path),unimportedDraftInventory:true});}else await verify(r);}
 assert.equal(sourceInventoryDifferences.length,1);
 for(const r of manifest.inventory){const p=path.join(build.artifact.path,r.path),bytes=await fs.readFile(p);assert.equal(bytes.length,r.bytes);assert.equal(sha(bytes),r.sha256,p);}
 if(build.apk){await verify(build.apk);assert.equal((await fs.stat(build.apk.path)).size,build.apk.bytes);}
 retainedBuilds.push({kind,priorResult:reference,artifactManifest,apk:build.apk??null,sourceCommit:build.sourceCommit,buildId:build.buildId,runtimePayloadRehashed:true,sourceInventoryDifferences,unchangedOtherCapturedSourceInputs:true,dialogueProvenanceRepairIncluded:false,rebuilt:false});
}

const globals=['AUTOPILOT_STATE.json','DECISIONS.md','STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt','REQUIREMENTS_TRACEABILITY.json','REQUIREMENTS_TRACEABILITY.csv'].map(n=>'docs/mobile/'+n);
const original=new Map(await Promise.all(globals.map(async p=>[p,await fs.readFile(p,'utf8')])));
const state=JSON.parse(original.get(globals[0])),trace=JSON.parse(original.get(globals[5])),beforeTrace=structuredClone(trace);
const statuses=()=>state.stages.map(s=>[s.id,s.status,s.criteria.map(c=>[c.id,c.status])]),beforeStatuses=statuses();
const counts=Object.fromEntries(['COMPLETE','IN_PROGRESS','NOT_STARTED'].map(v=>[v,state.stages.filter(s=>s.status===v).length]));assert.deepEqual(counts,{COMPLETE:3,IN_PROGRESS:12,NOT_STARTED:26});
assert.equal(state.headSha,prior.sourceCommit);assert.equal(state.currentStageId,'S03');assert.equal(state.currentCriterionId,'S03.acceptance');assert.equal(state.resume.firstOpenCriterion,'S03.acceptance');
assert.deepEqual({path:state.verificationCache.s15BookyGlobeGuidance.path,sha256:state.verificationCache.s15BookyGlobeGuidance.sha256},entry.previousCheckpointResult);assert.equal(state.verificationCache.s15BookyDialogueProvenance,undefined);
const stage=state.stages.find(s=>s.id==='S15'),criterion=stage.criteria.find(c=>c.id==='S15.PLANETKA-003'),requirement=trace.requirements.find(r=>r.id==='PLANETKA-003');for(const item of [stage,criterion,requirement])assert.equal(item.status,'IN_PROGRESS');
assert.equal(/^- D203:/mu.test(original.get(globals[1])),false);assert.equal([...original.get(globals[1]).matchAll(/^- D202:/gmu)].length,1);
const marker='<!-- s15-booky-dialogue-provenance-20260927:begin -->';for(const p of globals.slice(2,5))assert.equal(original.get(p).includes(marker),false);
const recordedAt=new Date().toISOString(),resultPath=folder+'/result.json',readmePath=folder+'/README.md';
const nextAction='D204: provide truthful Booky support for initial globe loading/error before the first scene sample and gate later reload help on current observed load status. Report committed status from the existing LiteraryWorldMap fallback and LiteraryGlobe atlas loader through an optional callback, separate from resource creation; preserve one renderer, existing retry ownership and Search/Collection. First bounded RU/EN checks should fail initial countries.geojson while the country catalog is ready, restore the response and use the genuine retry. No native equivalence or full loading acceptance is claimed. Preserve all 34 unapproved historical drafts; S03.acceptance remains first unresolved.';
const limitations=[
 'Only the historical navigation/contextual inventory, its focused test and the read-only audit changed. No runtime, interface copy, scene, preference, route order or tour-version change is included.',
 'Fourteen navigation drafts advance from revision 1 to 2 and eight contextual drafts from 2 to 3; exact text and non-provenance fields are preserved. Twelve support drafts remain byte-identical. All 34 remain unapproved and unavailable to adult/child reviewed-dialogue resolution.',
 'Source identity, copy equality and checksums establish provenance, not independent editorial, factual, rights or human approval. Current globe guidance and unavailable-state UI remains unreviewed and outside the historical inventory.',
 'The source-only import proof covers tracked direct references and literal import.meta.glob targets; no new runtime graph/build is executed.',
 'D202 66 unit cases, two browser cases and six captures retain source '+entry.runtimeSourceCommit+' attribution. They are not rerun or newly reviewed here.',
 'D202 PWA/Android runtime payloads and APK are rehashed and retained at their original source. Their broad source inventories contain the former unimported navigation inventory hash; that one captured-source difference is explicitly recorded. D203 changes are not included in those builds.',
 'Only bounded S15.PLANETKA-003 provenance evidence is attached, with all statuses unchanged. No browser run, rebuild, narration, reviewed journey, child access, installed-device, full accessibility, stage or release acceptance is claimed.'
];
const scoped=' Rebound 22 historical RU/EN navigation/contextual draft records to the final D202 runtime sources: navigation revisions 1→2 and contextual revisions 2→3, with identical copy and unchanged non-provenance fields. Twelve support records remain exact; all 34 remain draft and unavailable. 60 focused units, TypeScript and the read-only source inventory audit passed. Runtime code is unchanged. D202 66-unit/two-case/six-capture evidence and PWA 3d3e0760 / Android a69e7541 remain at source 798c072e; retained payload/APK bytes are rehashed and the older unimported inventory hash is explicit. No rebuild or stage/release acceptance.';
const result={schemaVersion:1,recordedAt,pass:true,stage:'S15',status:'BOOKY_DIALOGUE_DRAFT_PROVENANCE_VALIDATED',sourceCommit,runtimeSourceCommit:entry.runtimeSourceCommit,entry:await ref(folder+'/entry.json'),checkpointHelper:await ref(folder+'/checkpoint.mjs'),previous:entry.previousCheckpointResult,previousRuntimeResult:entry.previousRuntimeResult,sourceManifest,runs,attempts,earlierAttempts,unitFiles:entry.unitFiles,unitCount:60,inventory:runs.inventory.rawReport,proposalEvidence:entry.proposalEvidence,revisions,recordCount:22,navigationRecordCount:14,contextualRecordCount:8,combinedRecordCount:34,combinedDraftCount:34,approvedCount:0,availableAdultCount:0,availableChildCount:0,unchangedTrackedInputCount:1657,protectedInputsVerified:true,protectedSourceAuthority:entry.priorSourceManifest,changedSourcePaths:changed,newSourcePaths:[],changedSourceGitBlobCount:3,supplementalTestInputs:prior.supplementalTestInputs,supplementalBrowserInputs:prior.supplementalBrowserInputs,supplementalArchiveInputs:prior.supplementalArchiveInputs,supplementalArchiveGitIdentity:prior.supplementalArchiveGitIdentity,productionInventorySources:prior.productionInventorySources,productionJourneyCount:0,approvedProductionDialogueCount:0,productionMigrationCount:0,retainedValidation,retainedBuilds,pwa:prior.pwa,android:prior.android,buildBaseline:await ref(folder+'/build-baseline.json'),buildsRebuilt:false,browserRerun:false,runtimeUnchanged:true,runtimeWiringImplemented:false,dialogueProvenanceRepairIncludedInBuilds:false,requirementEvidenceTargets:scope.requirementEvidenceTargets,criterionEvidenceTargets:scope.criterionEvidenceTargets,criterionChanges:[],requirementChanges:[],stageChanges:[],allStageAndCriterionStatusesUnchanged:true,counts,firstUnresolved:'S03.acceptance',decisionD203Recorded:true,nextAction,limitations,reviewedDialogueAccepted:false,productionJourneysEnabled:false,ageAdaptiveJourneysAccepted:false,childApproved:false,narrationEnabled:false,stageAccepted:false,productionActionsPerformed:false,releaseReady:false};
const push=(items,v)=>{if(!items.includes(v))items.push(v);};for(const item of [criterion,requirement]){item.commit=sourceCommit;item.notes+=scoped;push(item.evidence,resultPath);}criterion.lastValidatedAt=recordedAt;
for(const p of changed.filter(p=>!p.endsWith('.test.ts')))push(requirement.implementationFiles,p);for(const p of entry.unitFiles)push(requirement.tests,p);
for(const p of [folder+'/entry.json',resultPath,readmePath,sourceManifest.path,...Object.values(runs).map(r=>r.path)])push(stage.artifacts,p);
for(const [mode,attempt]of Object.entries(attempts))push(stage.lastGreenCommands,`node ${folder}/check.mjs ${mode} ${attempt}`);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;push(state.resume.contextFiles,resultPath);push(state.resume.doNotRepeat,'D203 repaired current routes/Controls provenance for 22 existing drafts without changing copy or approving any of 34 records. Runtime/builds remain D202; do not rerun browser/builds solely for this unimported inventory repair.');
state.verificationCache.s15BookyDialogueProvenance={path:resultPath,sha256:sha(json(result)),sourceCommit,runtimeSourceCommit:entry.runtimeSourceCommit,status:result.status,pwa:prior.pwa,android:prior.android,stageAccepted:false,releaseReady:false};
assert.deepEqual(statuses(),beforeStatuses);assert.deepEqual(trace.requirements.map(r=>[r.id,r.status]),beforeTrace.requirements.map(r=>[r.id,r.status]));assert.deepEqual(trace.requirements.filter(r=>r.id!=='PLANETKA-003'),beforeTrace.requirements.filter(r=>r.id!=='PLANETKA-003'));
const rows=parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv','utf8'));assert.equal(original.get(globals[6]).replaceAll('\r\n','\n'),projectTraceabilityCsv(beforeTrace,rows));
const note=marker+'\nSource '+sourceCommit.slice(0,8)+':'+scoped+'\nPLANETKA-003 stays IN_PROGRESS; 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\nEvidence: '+resultPath+'.\n'+nextAction+'\n<!-- s15-booky-dialogue-provenance-20260927:end -->\n\n';
const updates=new Map([[globals[0],json(state)],[globals[1],original.get(globals[1])+'\n- D203: Source '+sourceCommit+scoped+' Evidence: '+resultPath+'.\n'],...globals.slice(2,5).map(p=>[p,note+original.get(p)]),[globals[5],json(trace)],[globals[6],projectTraceabilityCsv(trace,rows)]]);
await assert.rejects(fs.stat(resultPath),{code:'ENOENT'});await assert.rejects(fs.stat(readmePath),{code:'ENOENT'});clean();for(const [p,bytes]of original)assert.equal(await fs.readFile(p,'utf8'),bytes,p+': changed during preflight');
if(preflight){console.log(json({pass:true,kind:'READ_ONLY_CHECKPOINT_PREFLIGHT',acceptanceRecorded:false,globalWrites:false,sourceCommit,runtimeSourceCommit:entry.runtimeSourceCommit,unitCount:60,retainedBuilds:retainedBuilds.map(r=>({kind:r.kind,buildId:r.buildId,runtimePayloadRehashed:r.runtimePayloadRehashed})),sourceManifest,protectedInputs:1657}));}
else{await fs.writeFile(resultPath,json(result),{flag:'wx'});await fs.writeFile(readmePath,'# S15 historical dialogue provenance repair\n\nSource: '+sourceCommit+'. Runtime/build source: '+entry.runtimeSourceCommit+'.\n\n'+scoped.trim()+'\n\n'+limitations.map(v=>'- '+v).join('\n')+'\n\nNext: '+nextAction+'\n',{flag:'wx'});for(const [p,contents]of updates)await fs.writeFile(p,contents);console.log(json({pass:true,sourceCommit,runtimeSourceCommit:entry.runtimeSourceCommit,unitCount:60,combinedDraftCount:34,protectedInputs:1657,counts,releaseReady:false,result:resultPath}));}
