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
const folder='docs/mobile/evidence/S15/booky-journey-host-20260923';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const ref=async file=>({path:file,sha256:sha(await fs.readFile(file))});
const verify=async item=>assert.equal(sha(await fs.readFile(item.path)),item.sha256,item.path);
const git=args=>execFileSync('git',['-c','safe.directory='+root,...args],{windowsHide:true,encoding:'utf8'}).trim();
const gitBytes=args=>execFileSync('git',['-c','safe.directory='+root,...args],{windowsHide:true});
const entry=await read(folder+'/entry.json'); await verify(entry.previous); await verify(entry.priorSourceManifest);
const prior=await read(entry.previous.path),baseline=await read(entry.priorSourceManifest.path);
assert.equal(prior.pass,true); assert.equal(prior.releaseReady,false); assert.deepEqual(prior.sourceManifest,entry.priorSourceManifest);
assert.equal(baseline.files.length,1588); assert.equal(entry.priorSourceManifest.fileCount,1588);
const added=entry.newImplementationFiles;
assert.deepEqual(added,['src/host/bookyJourneyHost.ts','src/host/bookyJourneyHost.test.ts']);
assert.equal(git(['rev-parse','HEAD']),sourceCommit);
git(['merge-base','--is-ancestor',entry.checkpoint,sourceCommit]);
assert.deepEqual(git(['diff','--name-only',entry.checkpoint,sourceCommit,'--','src','scripts','tests']).split(/\r?\n/u).filter(Boolean).sort(),added.slice().sort());
const clean=()=>assert.equal(git(['status','--porcelain','--untracked-files=all','--','src','scripts','tests','package.json','package-lock.json','tsconfig.json']),'');
clean();
for(const item of [...entry.checkpointFiles,...baseline.files])await verify(item);
for(const item of baseline.files.filter(item=>item.path.startsWith('src/')&&/\.[cm]?[jt]sx?$/u.test(item.path))){
  assert.equal((await fs.readFile(item.path,'utf8')).includes('bookyJourneyHost'),false,'Unexpected existing host adapter import: '+item.path);
}
const runs={},attempts={unit:unitAttempt,static:staticAttempt},earlierAttempts=[];
let sourceManifest;
for(const [mode,attempt] of Object.entries(attempts)){
  const reportPath=`${folder}/${mode}-${attempt}/result.json`,report=await read(reportPath);
  assert.equal(report.pass,true); assert.equal(report.mode,mode); assert.equal(report.attempt,attempt);
  assert.equal(report.sourceInputsUnchanged,true); assert.equal(report.reportError,null); assert.equal(report.execution.exitCode,0);
  for(const flag of ['runtimeWiringImplemented','stageAccepted','ageAdaptiveJourneysAccepted','reviewedDialogueAccepted','childApproved','releaseReady'])assert.equal(report[flag],false);
  await verify(report.sourceManifest); const manifest=await read(report.sourceManifest.path);
  assert.equal(manifest.checkpoint,entry.checkpoint); assert.equal(manifest.files.length,1590); assert.equal(report.sourceManifest.fileCount,1590);
  assert.deepEqual(manifest.files.map(x=>x.path).sort(),[...baseline.files.map(x=>x.path),...added].sort());
  for(const item of manifest.files)await verify(item);
  for(const file of added)assert.equal(sha(gitBytes(['show',sourceCommit+':'+file])),manifest.files.find(x=>x.path===file).sha256);
  if(sourceManifest)assert.deepEqual(report.sourceManifest,sourceManifest);else sourceManifest=report.sourceManifest;
  for(const item of report.checkInputs)await verify(item);
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
  assert.equal(manifest.sourceInputs.sha256,build.sourceInputsSha256);
  for(const item of manifest.sourceInputs.files){assert.ok(!added.includes(item.path));await verify(item);}
  for(const item of manifest.inventory){const file=path.join(build.artifact.path,item.path),bytes=await fs.readFile(file);assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha256,file);}
  if(build.apk)await verify(build.apk);
  retainedBuilds.push({kind,buildId:build.buildId,sourceCommit:build.sourceCommit,priorResult:reference,artifactManifest,apk:build.apk??null,
    runtimeSourceInputsUnchanged:true,runtimePayloadRehashed:true,newHostAdapterIncluded:false,rebuilt:false});
}
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
assert.ok(!original.get(globals[1]).includes('- D161:'));assert.equal(state.verificationCache.s15BookyJourneyHost,undefined);
const recordedAt=new Date().toISOString(),resultPath=folder+'/result.json';
const nextAction='Continue S15 with the missing explicit host policy contract and guarded dialogue/journey integration. The current adult host has no exact age or reading-level policy; never infer those values from adult access, locale, navigation or behaviour. Keep all 34 inventory records draft. Invoke the host resolver at interaction time using immutable current snapshots, monotonic revision and a fresh registry after review changes. Preserve canonical scene, current catalog readiness, adult navigation/progress, explicit resume/reset and offline recovery. Child profiles, reviewed content/audio, full journeys, accessibility, installed-device, iOS and release acceptance remain pending; S03.acceptance is first unresolved.';
const limitations=['The adapter remains unimported by App. No production journey, profile policy, content review, navigation or persistence is enabled.',
  'Host integration must supply immutable current snapshots and revise them for profile/policy/catalog/review changes. Returned nodes are presentation data, not reusable authorization; resolve again when handling an action.',
  'Synthetic approvals and ages belong only to tests and confer no production approval.',
  'Existing PWA/Android artifacts and their source inputs were rehashed against source '+prior.sourceCommit+'. New host adapter code is not included; no new build/browser/device run is claimed.'];
const result={schemaVersion:1,recordedAt,pass:true,sourceCommit,stage:'S15',status:'BOOKY_JOURNEY_HOST_BOUNDARY_VALIDATED',entry:await ref(folder+'/entry.json'),previous:entry.previous,previousRuntime:entry.previous,
  checkpointHelper:await ref(folder+'/checkpoint.mjs'),sourceManifest,runs,attempts,earlierAttempts,unitFiles:entry.unitFiles,unitReport:await ref(`${folder}/unit-${unitAttempt}/vitest.json`),
  unchangedTrackedInputCount:1588,protectedInputsVerified:true,newImplementationFiles:added,retainedBuilds,buildsRebuilt:false,browserRerun:false,
  runtimeWiringImplemented:false,criterionChanges:[],requirementChanges:[],allStageAndCriterionStatusesUnchanged:true,counts,firstUnresolved:'S03.acceptance',nextAction,limitations,
  productionJourneysEnabled:false,reviewedDialogueAccepted:false,ageAdaptiveJourneysAccepted:false,childApproved:false,narrationEnabled:false,stageAccepted:false,productionActionsPerformed:false,releaseReady:false};
const scoped=' Fresh host admission binds exact journey/node identity and revision, explicit adult policy, current catalog readiness, full reviewed-route validation and the unchanged host snapshot after compilation. '+cases.length+' host/journey/registry tests and TypeScript passed. Existing 1,588 implementation/test files remain exact; retained PWA/Android builds do not contain this unimported adapter. No stage or release acceptance.';
const push=(items,value)=>{if(!items.includes(value))items.push(value);};
for(const item of [criterion,requirement]){item.commit=sourceCommit;item.notes+=scoped;push(item.evidence,resultPath);}
criterion.lastValidatedAt=recordedAt;push(requirement.implementationFiles,added[0]);push(requirement.tests,added[1]);
for(const file of [resultPath,folder+'/README.md',folder+'/entry.json',sourceManifest.path,...Object.values(runs).map(x=>x.path)])push(stage.artifacts,file);
for(const [mode,attempt] of Object.entries(attempts))push(stage.lastGreenCommands,`node ${folder}/check.mjs ${mode} ${attempt}`);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;push(state.resume.contextFiles,resultPath);
push(state.resume.doNotRepeat,'S15 host admission adapter validated without App wiring: exact route/node/revision, fresh explicit policy/catalog/review checks. Prior PWA/Android retained; no rebuild or full stage acceptance.');
state.verificationCache.s15BookyJourneyHost={path:resultPath,sha256:sha(json(result)),sourceCommit,status:result.status,stageAccepted:false,releaseReady:false};
assert.deepEqual(state.stages.map(stage=>[stage.id,stage.status,stage.criteria.map(item=>[item.id,item.status])]),priorStatuses);
assert.deepEqual(trace.requirements.map(item=>[item.id,item.status]),priorTrace.requirements.map(item=>[item.id,item.status]));
assert.deepEqual(trace.requirements.filter(item=>item.id!=='PLANETKA-004'),priorTrace.requirements.filter(item=>item.id!=='PLANETKA-004'));
const marker='<!-- s15-booky-journey-host-20260923:begin -->';
const note=marker+'\nSource '+sourceCommit.slice(0,8)+':'+scoped+'\nPLANETKA-004 stays IN_PROGRESS; 3 complete, 12 in progress, 26 unstarted; releaseReady:false.\nEvidence: evidence/S15/booky-journey-host-20260923/result.json.\n'+nextAction+'\n<!-- s15-booky-journey-host-20260923:end -->\n\n';
const rows=parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv','utf8'));
assert.equal(original.get(globals[6]).replaceAll('\r\n','\n'),projectTraceabilityCsv(JSON.parse(original.get(globals[5])),rows));
const updates=new Map([[globals[0],json(state)],[globals[1],original.get(globals[1])+'\n- D161:'+scoped+' Evidence: evidence/S15/booky-journey-host-20260923/result.json.\n'],
  ...globals.slice(2,5).map(file=>{assert.ok(!original.get(file).includes(marker));return[file,note+original.get(file)]}),[globals[5],json(trace)],[globals[6],projectTraceabilityCsv(trace,rows)]]);
for(const [file,bytes]of original)assert.equal(await fs.readFile(file,'utf8'),bytes);clean();
await assert.rejects(fs.stat(resultPath),{code:'ENOENT'});await assert.rejects(fs.stat(folder+'/README.md'),{code:'ENOENT'});
await fs.writeFile(resultPath,json(result),{flag:'wx'});
await fs.writeFile(folder+'/README.md','# S15 Booky journey host admission\n\nSource: '+sourceCommit+'.\n\n'+scoped.trim()+'\n\n'+limitations.map(x=>'- '+x).join('\n')+'\n\nNext: '+nextAction+'\n',{flag:'wx'});
for(const [file,contents]of updates)await fs.writeFile(file,contents);
console.log(json({pass:true,sourceCommit,unitCount:cases.length,protectedInputs:1588,retainedBuilds:retainedBuilds.map(x=>({kind:x.kind,buildId:x.buildId,sourceCommit:x.sourceCommit})),releaseReady:false}));
