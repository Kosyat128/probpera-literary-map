import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {B,sha,json,equal,requireFact as check,repositoryRoot,processContext,capture} from './parent-pin-checks-common.mjs';

// Authoring this helper performs no work. Root supplies one sealed actual input
// after source/check/build receipts exist. All writes below are to a fresh B dir.
const FAMILY='docs/mobile/evidence/S16/child-local-parent-owner-20261004';
const DOCS=['AGENTS.md','docs/mobile/STATUS.md','docs/mobile/NEXT_CODEX_PROMPT.txt','docs/mobile/AUTOPILOT_STATE.json'];
const SUITES=['src/child/childProfile.test.ts','src/child/childStartup.test.ts','src/child/childProtectedState.test.ts','src/child/childIndex.test.ts'].sort();
const WORK=path.join(B,'child-local-parent-owner-work-20261004');
const REGISTRY_SHA='2b1aec64cfa083d3e01eaab50492c533e06e3ecb33b9294394298b237814e922';
const NEXT='Continue original S16 accountless-first/local child privacy. Implement explicit local first-install canonical unenrolled seed and protected AES-key provisioning with genuine native OS-owner proof; missing/corrupt state must never become an implicit seed. Then define a separately versioned conservative restart/re-anchor contract which persists charged attempt count and pending debt, gives zero cooldown credit for time outside the process, and denies unknown anchors. Preserve existing v1 stronger nonrollback/boot-UUID guarantees unchanged and unavailable; do not relabel encrypted storage or local booleans as that authority. Complete genuine original Gate/host and admitted durable child ports, then App clear-before-render/lifecycle integration before activation. Child labels/ages/topics/full records stay local; mandatory guardian backend sign-in and full-record upload are not prerequisites. Retained private ledger/transport/server validator stay optional and inactive. Factories remain null/nil, installed device-owner proof and Swift compilation/runtime NOT_RUN. These are Codex programming tasks; seven known owner inputs/five pending reviews and S03/S16 IN_PROGRESS11/36 OPEN remain unchanged. No old suite/build rerun, seventh AVD attempt, remote operation, push, merge, deploy or report-only D stage.';
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x);
const commit=x=>typeof x==='string'&&/^[a-f0-9]{40}$/u.test(x);
const relative=x=>typeof x==='string'&&x.length<1024&&!/[\\:\u0000-\u001f]/u.test(x)&&!x.startsWith('/')&&x.split('/').every(y=>y&&y!=='.'&&y!=='..'&&!y.startsWith('.env'));
const inside=(base,file)=>file.startsWith(base+path.sep);
const bind=x=>Object.fromEntries(['sourceCommit','sourceFingerprint','lockSha256','toolsFingerprint'].map(k=>[k,x[k]]));
let output=null;
try{
 check(process.argv.length===4,'USE_INPUT_PATH_SHA');
 const rootArgument='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
 const root=repositoryRoot(rootArgument),base=fs.realpathSync(B);
 function bytes(filename,maximum=16*1024*1024){
  const resolved=path.resolve(filename),real=fs.realpathSync(resolved),stat=fs.lstatSync(resolved);
  check(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=maximum&&real===resolved&&(inside(base,real)||inside(root,real)),'REGULAR_OWNED_INPUT_REQUIRED');
  check(!/(?:^|[\\/])(?:\.env(?:\.|$)|auth\.json|profiles?|credentials?|.*\.(?:apk|zip|jks|p12|p8|key|mobileprovision))$/iu.test(real),'SECRET_OR_ARTIFACT_COPY_DENIED');
  return fs.readFileSync(resolved);
 }
 const descriptor=(filename,raw)=>({path:filename,sha256:sha(raw),bytes:raw.length});
 function ref(value){check(value&&typeof value.path==='string'&&digest(value.sha256),'HASHED_INPUT_REQUIRED');
  const filename=path.isAbsolute(value.path)?path.resolve(value.path):path.resolve(root,value.path);
  const raw=bytes(filename);check(sha(raw)===value.sha256&&(value.bytes===undefined||raw.length===value.bytes),'REFERENCED_BYTES_CHANGED');
  return {...descriptor(filename,raw),raw,value:JSON.parse(raw.toString('utf8').replace(/^\uFEFF/u,''))};
 }
 const selected=ref({path:process.argv[2],sha256:process.argv[3]}),input=selected.value;
 check(input.schemaVersion===1&&input.kind==='literary-planet-child-local-parent-owner-report-input'&&input.finalized===true,'SEALED_ACTUAL_INPUT_REQUIRED');
 const cpRef=ref(input.sourceCheckpoint),cp=cpRef.value,baselineRef=ref(input.baseline),baseline=baselineRef.value;
 const {git}=processContext(root),before=await capture(root);
 check(cp.kind==='literary-planet-child-local-parent-owner-source-checkpoint'&&cp.status==='SOURCE_COMMITTED'&&commit(cp.sourceCommit)
  &&cp.checkedDirtyInputsCorrelatedByteExact===true&&cp.remoteActions===0&&cp.releaseReady===false,'CURRENT_SOURCE_CHECKPOINT_REQUIRED');
 check(before.sourceStatus===''&&before.sourceCommit===cp.sourceCommit&&before.repositoryHead===cp.sourceCommit
  &&git(['status','--porcelain=v1','--untracked-files=all'])===''&&equal(bind(before),bind(cp))&&equal(before.sourceFiles,cp.sourceFiles),'CLEAN_CURRENT_SOURCE_REQUIRED');
 check(cp.sourceRows===cp.sourceFiles.length&&cp.sourceRows===before.sourceFiles.length&&Array.isArray(cp.sourcePaths)&&cp.sourcePaths.length===15,'SCOPED_SOURCE_ROWS_REQUIRED');
 check(baseline.sourceStatus===''&&commit(baseline.sourceCommit)&&commit(baseline.repositoryHead)
  &&cp.lockSha256===baseline.lockSha256&&cp.toolsFingerprint===baseline.toolsFingerprint,'BASELINE_TOOLS_CHANGED');
 check(equal(cp.sourceFiles.filter(x=>!cp.sourcePaths.includes(x.path)),baseline.sourceFiles.filter(x=>!cp.sourcePaths.includes(x.path))),'SOURCE_OUTSIDE_15_PATHS_CHANGED');
 const checkedRef=ref(input.focusedChecks),checked=checkedRef.value;
 check(cp.focusedChecks.path===checkedRef.path&&cp.focusedChecks.sha256===checkedRef.sha256
  &&checked.kind==='literary-planet-child-local-parent-owner-focused-checks'&&checked.status==='PASS'&&checked.pass===true
  &&checked.inputsUnchanged===true&&checked.typeScript===true&&checked.reportError===null&&checked.guardError===null,'EXACT_FOCUSED_PASS_REQUIRED');
 const commands=checked.commands;
 check(commands?.length===5&&commands.every(x=>x.exitCode===0&&x.signal===null&&x.errorCode===null&&!x.timedOut&&!x.overflow),'ACTUAL_FIVE_COMMANDS_REQUIRED');
 check(equal(checked.affected.files.map(x=>x.path).sort(),SUITES)&&checked.affected.success===true
  &&Number.isSafeInteger(checked.affected.passed)&&checked.affected.passed>0&&checked.affected.failed===0&&checked.affected.pendingOrFiltered===0
  &&checked.serverPin.success===true&&checked.serverPin.passed===56&&checked.serverPin.failed===0&&checked.serverPin.pendingOrFiltered===0,'EXACT_SUITE_SCOPES_REQUIRED');
 const checkedBefore=ref(checked.before),checkedAfter=ref(checked.after);
 for(const point of [checkedBefore.value,checkedAfter.value])check(equal(point.sourceFiles,cp.sourceFiles)&&point.sourceFingerprint===cp.sourceFingerprint
  &&point.lockSha256===cp.lockSha256&&point.toolsFingerprint===cp.toolsFingerprint,'PRECOMMIT_CHECK_BYTES_CHANGED');
 check(equal(checkedBefore.value,checkedAfter.value),'CHECK_INPUTS_CHANGED');
 const previousRef=ref(input.previousEvidence),previous=previousRef.value;
 check(previous.kind==='literary-planet-child-checkpoint-pin-transition-evidence'&&previous.sourceCommit===baseline.sourceCommit
  &&previous.pendingLegalReviews===5&&previous.ownerActions?.length===7&&previous.fourConditionsRechecked===false&&previous.releaseReady===false,'EXACT_OLD_CONDITIONS_REQUIRED');
 check(sha(bytes(path.join(root,'docs/mobile/RELEASE_DECISIONS.json')))===REGISTRY_SHA,'OWNER_REGISTRY_CHANGED');
 const originals=new Map();
 for(const file of DOCS){const current=bytes(path.join(root,file)),saved=bytes(path.join(WORK,path.basename(file)+'.before'));
  const row=baseline.documentRows.find(x=>x.path===file);check(row&&sha(current)===row.sha256&&current.equals(saved),'OLD_HANDOFF_CHANGED');originals.set(file,current);}
 const stateText=originals.get(DOCS[3]).toString('utf8'),state=JSON.parse(stateText);
 check(state.headSha===baseline.sourceCommit&&!Object.prototype.hasOwnProperty.call(state.verificationCache,'childLocalParentOwner'),'STATE_BASELINE_OR_CACHE_COLLISION');
 for(const [id,count]of [['S03',11],['S16',36]]){const stage=state.stages.find(x=>x.id===id);check(stage?.status==='IN_PROGRESS'&&stage.criteria.filter(x=>x.status==='OPEN').length===count,'STAGE_ACCEPTANCE_CHANGED');}
 const prepRefs={};
 for(const mode of ['android','pwa']){
  const execution=ref(input.preparations[mode].execution),receipt=ref(input.preparations[mode].receipt),e=execution.value,p=receipt.value;
  check(e.kind==='literary-planet-child-local-parent-owner-build-execution'&&e.mode===mode&&e.status==='PASS'&&e.error===null
   &&e.inputsUnchanged===true&&e.exitCode===0&&e.signal===null&&e.parseError===null&&e.remoteActions===0
   &&equal(bind(e.binding),bind(cp))&&e.binding.repositoryHead===cp.sourceCommit&&e.sourceRows===cp.sourceRows,'CURRENT_BUILD_EXECUTION_REQUIRED');
  check(e.receipt.path===receipt.path&&e.receipt.sha256===receipt.sha256&&e.receipt.pass===true&&e.receipt.mode===mode
   &&p.kind==='literary-planet-local-release-preparation'&&p.mode===mode&&p.pass===true&&p.releaseReady===false
   &&equal(bind(p.inputs),bind(cp))&&p.inputs.repositoryHead===cp.sourceCommit&&p.deviceTested===false&&p.iosCompiled===false,'CURRENT_PREPARATION_REQUIRED');
  if(mode==='android')check(p.instrumentationCompiled===true&&p.mainBinaryPrepared===true,'ACTUAL_MAIN_AND_TEST_COMPILATION_REQUIRED');
  prepRefs[mode]={execution,receipt};
 }
 const codecRef=ref(input.nativeCodec.result),codec=codecRef.value,pbxRef=ref(input.pbxParser.result),pbx=pbxRef.value;
 check(codec.kind==='native-owner-locale-codec-jvm'&&codec.status==='PASS'&&codec.expectedSource===cp.sourceCommit
  &&equal(codec.inputs.sourceFiles,cp.sourceFiles)&&equal(bind(codec.inputs),bind(cp))&&codec.inputs.sourceStatus===''
  &&codec.attempts?.length===2&&codec.attempts.every(x=>x.exitCode===0&&x.signal===null&&x.error===null)
  &&codec.installedOS==='NOT_RUN'&&codec.deviceOwner==='NOT_RUN','CURRENT_CODEC_RESULT_REQUIRED');
 check(codec.cases===6&&codec.assertions===29,'EXACT_CODEC_6_29_REQUIRED');
 check(pbx.kind==='native-owner-xcode-project-structure'&&pbx.status==='PASS'&&equal(bind(pbx.inputs),bind(cp))
  &&equal(pbx.inputs.sourceFiles,cp.sourceFiles)&&pbx.inputs.sourceStatus===''
  &&pbx.swiftCompilation==='NOT_RUN'&&pbx.xcodeExecution==='NOT_RUN'&&pbx.installedOS==='NOT_RUN','CURRENT_PBX_PARSE_REQUIRED');
 for(const item of [pbx.project,pbx.test])check(item&&relative(item.path)&&cp.sourceFiles.some(x=>x.path===item.path&&x.sha256===item.sha256),'PBX_SOURCE_BYTES_CHANGED');
 output=path.join(B,'child-local-parent-owner-staged-'+randomUUID());fs.mkdirSync(output);
 const family=path.join(output,FAMILY);fs.mkdirSync(family,{recursive:true});const inventory=[],proofMap=[];
 function put(relativePath,raw){check(relative(relativePath),'SAFE_STAGE_PATH_REQUIRED');const filename=path.join(output,relativePath);
  fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,raw,{flag:'wx'});return {path:relativePath,sha256:sha(raw),bytes:raw.length};}
 function proof(value,name){check(relative(name)&&!inventory.some(x=>x.path===name),'UNIQUE_PROOF_PATH_REQUIRED');const raw=bytes(value.path);
  check(sha(raw)===value.sha256&&(value.bytes===undefined||raw.length===value.bytes),'PROOF_BYTES_CHANGED');const row=put(FAMILY+'/'+name,raw);
  inventory.push({...row,path:name});proofMap.push({original:{path:value.path,sha256:sha(raw),bytes:raw.length},evidencePath:FAMILY+'/'+name});}
 for(const [name,value]of [['source-checkpoint',cpRef],['baseline',baselineRef],['focused-checks',checkedRef],['checked-before',checkedBefore],['checked-after',checkedAfter],['native-codec',codecRef],['pbx-parser',pbxRef]])proof(value,'proofs/'+name+'.json');
 for(const mode of ['android','pwa'])for(const key of ['execution','receipt'])proof(prepRefs[mode][key],'proofs/'+mode+'-'+key+'.json');
 const patch=cp.patch;check(patch&&digest(patch.sha256),'CURRENT_SOURCE_PATCH_REQUIRED');proof(patch,'proofs/source-changes.patch');
 check(Array.isArray(input.preservedFailures)&&input.preservedFailures.length<=8,'EXPLICIT_PRESERVED_FAILURES_REQUIRED');
 check(input.preservedFailures.some(x=>x.path===path.join(WORK,'metadata-preparation-a1.failure.json')),'PRESERVE_ORIGINAL_METADATA_A1_FAILURE');
 for(const [index,item]of input.preservedFailures.entries()){const failure=ref(item);
  check(['FAIL','FAILED'].includes(failure.value.status)||failure.value.pass===false,'ORIGINAL_FAILED_RECEIPT_REQUIRED');proof(failure,'proofs/preserved-failure-'+index+'.json');}
 check(Array.isArray(input.rawProofs)&&input.rawProofs.length<=100,'BOUNDED_RAW_PROOFS_REQUIRED');
 for(const item of input.rawProofs){check(item&&relative(item.evidencePath)&&item.evidencePath.startsWith('proofs/raw/'),'EXACT_RAW_DESTINATION_REQUIRED');proof(item,item.evidencePath);}
 // Every actually executed focused command stream must be present, unchanged.
 for(const command of commands)for(const key of ['stdout','stderr']){
  const stream=command[key];check(proofMap.some(x=>x.original.path===stream.path&&x.original.sha256===stream.sha256&&x.original.bytes===stream.bytes),'MISSING_FOCUSED_RAW_STREAM');}
 for(const name of ['affected.vitest.json','server-pin.vitest.json'])check(proofMap.some(x=>x.original.path===path.join(path.dirname(checkedRef.path),name)),'MISSING_ACTUAL_VITEST_REPORT');
 for(const mode of ['android','pwa']){
  const e=prepRefs[mode].execution,p=prepRefs[mode].receipt;
  for(const key of ['stdout','stderr']){const stream=e.value[key];check(proofMap.some(x=>x.original.path===stream.path
   &&x.original.sha256===stream.sha256&&x.original.bytes===stream.bytes),'MISSING_BUILD_WRAPPER_STREAM');}
  for(const attempt of p.value.attempts)for(const key of ['stdout','stderr']){const stream=attempt[key];
   check(typeof stream==='string'&&relative(stream)&&stream.startsWith('.tmp/'),'EXACT_PREPARATION_STREAM_PATH_REQUIRED');
   const filename=path.resolve(root,stream);check(proofMap.some(x=>x.original.path===filename),'MISSING_PREPARATION_RAW_STREAM');}
 }
 for(const attempt of codec.attempts)for(const key of ['stdout','stderr']){
  const stream=attempt[key],filename=path.resolve(path.dirname(codecRef.path),stream.path);
  check(proofMap.some(x=>x.original.path===filename&&x.original.sha256===stream.sha256&&x.original.bytes===stream.bytes),'MISSING_CODEC_RAW_STREAM');}
 const generatedAt=new Date().toISOString(),binding=bind(cp),total=checked.affected.passed+checked.serverPin.passed;
 const meaning='Local accountless parent-owner/locale-lock source '+cp.sourceCommit+'; scoped affected units '+checked.affected.passed+' and server PIN56 plus three TypeScript commands PASS on exact precommit bytes, correlated to this commit. Fresh current Android/PWA preparations and codec6/29/PBX parser retain separate scopes. Genuine owner installed proof NOT_RUN, Swift NOT_COMPILED/NOT_RUN, factories null/nil, releaseReady=false; S03/S16 IN_PROGRESS11/36.';
 const continuation=structuredClone(previous.programmingContinuation);continuation.nextIndependentAction=NEXT;
 continuation.accountlessFirst=true;continuation.childProfilesLocalOnly=true;continuation.optionalBackend='INACTIVE_NOT_A_LOCAL_CHILD_PREREQUISITE';
 const responsibilityUpdates=new Map([
  ['Protected child admission','Implement genuine native original Gate/host ownership and an explicitly versioned local supported contract behind admitted durable child ports. Seed/AES provisioning and App clear-before-render remain Codex work. No mandatory guardian backend sign-in or child-record cloud upload is a prerequisite; local brands, callback flags and synthetic ports cannot grant admission. Factories remain null/nil until the actual chosen contract and installed host guarantees are supported.'],
  ['Supported native authority and trusted time','Implement a separately versioned local conservative restart/re-anchor contract: persist charged attempt count and pending debt, grant zero cooldown credit for time outside the process, and deny unknown anchors. Existing v1 stronger nonrollback and boot-UUID guarantees remain UNCHANGED and unavailable; do not weaken v1 or relabel ordinary encrypted storage/local booleans as that authority. Supported local host/time binding remains Codex work.'],
  ['Native PIN enrollment, verification and recovery','Private genuine OS-owner per-use signing/public verification prerequisites for enroll/recover and parent locale locks are implemented inactive at source '+cp.sourceCommit+'. Android13 owner scenarios are COMPILED_ONLY, installed owner proof NOT_RUN; Swift26 NOT_COMPILED/NOT_RUN. Existing PIN input/KDF, charged journals and connected durable transaction foundations retain their original separate scopes. Explicit local initial seed/AES provisioning, the separately versioned restart contract, genuine native Gate/host and admitted durable child ports remain OPEN Codex tasks; no complete bootstrap, legal guardian proof, recovery/checkpoint or production admission is claimed. Factories remain null/nil and App inactive.'],
 ]);
 const remaining=continuation.remainingInternalProgramming,originalRemaining=previous.programmingContinuation.remainingInternalProgramming;
 check(Array.isArray(remaining)&&remaining.length===6&&remaining.every(x=>x.status==='OPEN')&&new Set(remaining.map(x=>x.work)).size===6,'EXACT_SIX_OPEN_CODEX_TASKS_REQUIRED');
 for(const [work,responsibility]of responsibilityUpdates){const row=remaining.find(x=>x.work===work);check(row,'ORIGINAL_CODEX_TASK_REQUIRED');row.responsibility=responsibility;}
 check(equal(remaining.map(({work,status})=>({work,status})),originalRemaining.map(({work,status})=>({work,status})))
  &&equal(remaining.filter(x=>!responsibilityUpdates.has(x.work)),originalRemaining.filter(x=>!responsibilityUpdates.has(x.work))),'OTHER_TASK_TEXT_OR_STATUS_CHANGED');
 const planReferences=[
  {path:'docs/mobile/requirements/v12/108_CHILD_PRIVACY_JURISDICTION_GATE_RU.md',sha256:'8b3632fa50652ac768fc999818ba44735936f4e185cbe1582f206b75b9da578a',bytes:6927},
  {path:'docs/mobile/requirements/v12/85_SAFE_BILINGUAL_FIRST_RELEASE_PROFILE_RU_EN.md',sha256:'d668435e604f4cb97a3f568cd1841acb108694e996c940470cc84579caf18d84',bytes:3787},
  {path:'docs/mobile/requirements/v12/11_CHILD_MODE_PARENT_GATE_AGE_ASSURANCE_RU.md',sha256:'e465ec632eace6ce1dd964c085003140cb1247ddabe2136a757c9821409e8a76',bytes:10271},
 ];
 for(const reference of planReferences){const raw=bytes(path.join(root,reference.path));check(raw.length===reference.bytes&&sha(raw)===reference.sha256,'IMMUTABLE_ORIGINAL_PLAN_CHANGED');}
 const originalPlanFidelity={references:planReferences,accountlessFirst:true,childProfilesLocalOnly:true,mandatoryGuardianBackend:false,fullChildRecordCloudUpload:false,
  retainedNetworkMechanics:'Private ledger/transport/server validator remain optional and inactive; their historical proofs/bindings are preserved.',v1StrongerAuthorityAndBootUUID:'UNCHANGED_UNAVAILABLE'};
 const result={schemaVersion:1,kind:'literary-planet-child-local-parent-owner-evidence',status:'IN_PROGRESS',generatedAt,sourceCommit:cp.sourceCommit,binding,
  previousSource:baseline.sourceCommit,previousReport:baseline.repositoryHead,sourceCheckpoint:{path:cpRef.path,sha256:cpRef.sha256},
  localChecks:{status:'PASS',affectedSuites:checked.affected,serverPin:checked.serverPin,typeScript:'PASS',typeScriptCommands:3,passed:total,failed:0,
   executionRepositoryHead:checked.recordedRepositoryHead,executionLastCommittedSource:checked.recordedLastCommittedAppSource,precommitInputsExactlyMatchCommittedBytes:true},
  nativeCodec:{result:input.nativeCodec.result,cases:6,assertions:29,scope:'PURE_CODEC_ON_FRESH_SOURCE_BOUND_ANDROID_CLASSES_ONLY'},pbxParser:{result:input.pbxParser.result,swiftCompiled:false},
  preparations:Object.fromEntries(['android','pwa'].map(mode=>[mode,{execution:input.preparations[mode].execution,receipt:input.preparations[mode].receipt,outputs:prepRefs[mode].receipt.value.outputs,sourceCommit:cp.sourceCommit}])),
  nativeOwner:{androidAuthoredMethods:13,androidCompilation:'COMPILED_ONLY',androidInstalledProof:'NOT_RUN',swiftAuthoredMethods:26,swiftCompilation:'NOT_COMPILED',swiftRuntime:'NOT_RUN',legalGuardianProof:false},
  preservation:{fourOldDocumentTailsPreserved:true,stateOutsideDeclaredSpansUnchanged:true,stageObjectsUnchanged:true,ownerRegistryUnchanged:true,canonicalGlobeAndBookyUnchanged:true},
  fourOriginalConditions:previous.fourOriginalConditions,fourConditionsRechecked:false,pendingLegalReviews:previous.pendingLegalReviews,ownerActions:previous.ownerActions,
  programmingContinuation:continuation,originalPlanFidelity,admission:{nativeFactories:'null/nil',childAppActivation:false,initialLocalSeed:'OPEN_CODEX',protectedAESProvisioning:'OPEN_CODEX',separatelyVersionedConservativeRestart:'OPEN_CODEX',v1NonrollbackAndBootUUID:'UNCHANGED_UNAVAILABLE',authenticatedGateHost:'OPEN_CODEX',durableChildPorts:'OPEN_CODEX',optionalPrivateBackend:'INACTIVE'},
  commands:input.commands,proofMap,preservedFailures:input.preservedFailures,acceptance:[{id:'S03',status:'IN_PROGRESS',openCount:11},{id:'S16',status:'IN_PROGRESS',openCount:36}],
  executionNotRun:{browser:true,nativeOS:true,swift:true,pwaInstallationOfflineUpdate:true},stageAccepted:false,releaseReady:false,remoteOperations:0};
 check(input.commands&&fs.realpathSync(input.commands.workingDirectory)===root&&Object.values(input.commands).every(x=>typeof x==='string')
  &&typeof input.commands.qualification==='string','EXPLICIT_CURRENT_COMMANDS_REQUIRED');
 inventory.push({...put(FAMILY+'/result.json',Buffer.from(json(result))),path:'result.json'});
 const commandText=Buffer.from('PowerShell; cwd '+input.commands.workingDirectory+'\r\n\r\n'+Object.entries(input.commands).filter(([k])=>k!=='workingDirectory').map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\nCommands are exact supplied local receipts/runbook; no command is executed by this stager. Installed owner proof, browser/offline/update and Swift acceptance NOT_RUN.\r\n');
 inventory.push({...put(FAMILY+'/RUN_COMMANDS.txt',commandText),path:'RUN_COMMANDS.txt'});
 const manifest={generatedAt,sourceCommit:cp.sourceCommit,selfExcluded:true,files:inventory,releaseReady:false};put(FAMILY+'/evidence-manifest.json',Buffer.from(json(manifest)));
 let nextState=stateText;const stateSpans=[];
 for(const [key,old,value]of [['headSha',state.headSha,cp.sourceCommit],['updatedAt',state.updatedAt,generatedAt],['nextAction',state.resume.nextAction,NEXT],['headShaMeaning',state.verificationCache.headShaMeaning,meaning]]){
  const from=JSON.stringify(key)+': '+JSON.stringify(old),to=JSON.stringify(key)+': '+JSON.stringify(value);check(nextState.split(from).length===2,'UNIQUE_STATE_VALUE_SPAN');nextState=nextState.replace(from,to);stateSpans.push({key,before:from,after:to});}
 const cache={sourceCommit:cp.sourceCommit,evidence:FAMILY+'/result.json',localUnits:total,android:'COMPILED_ONLY',pwa:'PREPARED_ONLY',codecCases:6,codecAssertions:29,pbx:'PARSED_ONLY',swift:'NOT_COMPILED_NOT_RUN',installedOwnerProof:'NOT_RUN',factories:'null/nil',releaseReady:false};
 const marker='  "verificationCache": {',nl=stateText.includes('\r\n')?'\r\n':'\n',added=nl+'    "childLocalParentOwner": '+JSON.stringify(cache,null,2).replaceAll('\n',nl+'    ')+',';
 check(nextState.split(marker).length===2,'UNIQUE_CACHE_INSERTION');nextState=nextState.replace(marker,marker+added);stateSpans.push({key:'childLocalParentOwner',before:marker,after:marker+added});
 const restored=stateSpans.toReversed().reduce((text,span)=>{check(text.split(span.after).length===2,'STATE_INVERSE_SPAN');return text.replace(span.after,span.before);},nextState);
 check(restored===stateText&&equal(JSON.parse(nextState).stages,state.stages),'STATE_OUTSIDE_SPANS_CHANGED');
 const prefix=['<!-- child-local-parent-owner-20261004:begin -->','Source '+cp.sourceCommit+'; evidence '+FAMILY+'/result.json.',
  'Implemented private genuine local OS-owner credential proof prerequisites and optional parent locale lock, inactive behind existing private native contracts. No profile cloud upload or mandatory guardian account is required.',
  'Actual scoped units '+checked.affected.passed+' +server PIN56 and three TypeScript commands PASS; exact precommit bytes correlate to this commit. Fresh current Android/PWA preparations; separate pure codec6/29 and PBX parse only. Android13 new OS-owner cases compiled only; Swift26 NOT_COMPILED/NOT_RUN; genuine installed OS-owner proof NOT_RUN.',
  'Old condition snapshot retains older source/artifact bindings, unrechecked. S03/S16 IN_PROGRESS11/36 OPEN; seven owner inputs/five pending reviews unchanged. Factory null/nil, App activation inactive, releaseReady=false.',
  'Next: '+NEXT,'<!-- child-local-parent-owner-20261004:end -->',''].join(nl)+nl;
 const files=[];
 for(const file of DOCS){const old=originals.get(file),raw=file===DOCS[3]?Buffer.from(nextState):Buffer.concat([Buffer.from(prefix),old]);
  put(file,raw);put('backups/'+file.replaceAll('/','__')+'.before',old);files.push({path:file,beforeSha256:sha(old),afterSha256:sha(raw),bytes:raw.length,stagedPath:path.join(output,file)});}
 const after=await capture(root);check(equal(before,after),'STAGING_CHANGED_SOURCE_OR_BINDING');
 for(const file of DOCS)check(bytes(path.join(root,file)).equals(originals.get(file)),'PROJECT_HANDOFF_CHANGED');
 const proposal={schemaVersion:1,kind:'literary-planet-child-local-parent-owner-report-proposal',status:'STAGED_ONLY',sourceCommit:cp.sourceCommit,binding,
  input:{path:selected.path,sha256:selected.sha256},output,relative:FAMILY,files,prefixBytes:Buffer.byteLength(prefix),stateSpans,sourceUnchanged:true,
  evidenceManifest:{path:path.join(output,FAMILY,'evidence-manifest.json'),sha256:sha(Buffer.from(json(manifest)))},result:{path:path.join(output,FAMILY,'result.json'),sha256:sha(Buffer.from(json(result)))},
  runCommands:{path:path.join(output,FAMILY,'RUN_COMMANDS.txt'),sha256:sha(commandText),bytes:commandText.length},
  stateObjectsUnchanged:true,ownerRegistrySha256:REGISTRY_SHA,oldConditionSnapshotRechecked:false,checksExecuted:false,releaseReady:false};
 put('proposal.json',Buffer.from(json(proposal)));console.log(json({status:'STAGED_ONLY',output,proposal:descriptor(path.join(output,'proposal.json'),Buffer.from(json(proposal))),sourceCommit:cp.sourceCommit,releaseReady:false}));
}catch(error){if(output)fs.writeFileSync(path.join(output,'failure.json'),json({status:'FAIL',errorCode:error.code??'STAGING_INPUT_OR_IO_FAILED',projectWrites:0,checksExecuted:false,releaseReady:false}),{flag:'wx'});throw error;}
