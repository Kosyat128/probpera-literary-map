import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {B,sha,json,requireFact as check,equal,capture,readB,rawFile} from './parent-pin-checks-common.mjs';
import {loadFinalInput,guard,preserve,reference,OWNED} from './integrate-child-local-parent-owner.mjs';

const suites=['src/child/childProfile.test.ts','src/child/childStartup.test.ts','src/child/childProtectedState.test.ts','src/child/childIndex.test.ts'];
const serverTest='server/planet/childCheckpointPinTransition.test.ts';
const readRef=ref=>{check(ref&&typeof ref.path==='string'&&/^[a-f0-9]{64}$/u.test(ref.sha256),'EXACT_HASHED_REFERENCE_REQUIRED');return readB(ref.path,ref.sha256);};
function tools(root){return [process.execPath,path.join(root,'node_modules/vitest/vitest.mjs'),path.join(root,'node_modules/typescript/bin/tsc'),path.join(root,'node_modules/@types/node/package.json')].map(filename=>{const stat=fs.lstatSync(filename);check(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<256*1024*1024,'REGULAR_TOOL_REQUIRED');return {path:filename,sha256:sha(fs.readFileSync(filename)),bytes:stat.size};});}
function summary(filename,expectedFiles,root){
 const report=JSON.parse(rawFile(filename)),files=report.testResults;
 check(Array.isArray(files)&&files.length===expectedFiles.length,'EXACT_EXECUTED_TEST_FILES_REQUIRED');
 const normalized=files.map(file=>path.relative(root,file.name).replaceAll('\\','/')).sort();
 check(equal(normalized,[...expectedFiles].sort()),'UNEXPECTED_UNIT_FILE_EXECUTED');
 const assertions=files.flatMap(file=>file.assertionResults);
 check(assertions.length===report.numTotalTests&&Number.isSafeInteger(report.numTotalTests)&&report.numTotalTests>0,'ACTUAL_UNIT_ASSERTIONS_REQUIRED');
 const passed=assertions.filter(row=>row.status==='passed').length,failed=assertions.filter(row=>row.status==='failed').length;
 check(report.numPassedTests===passed&&report.numFailedTests===failed&&report.numPendingTests===assertions.length-passed-failed,'UNIT_COUNTS_DISAGREE');
 return {total:assertions.length,passed,failed,pendingOrFiltered:assertions.length-passed-failed,success:report.success===true,
  files:files.map(file=>({path:path.relative(root,file.name).replaceAll('\\','/'),executed:file.assertionResults.length,
   passed:file.assertionResults.filter(row=>row.status==='passed').length,failed:file.assertionResults.filter(row=>row.status==='failed').length,
   titles:file.assertionResults.map(row=>row.fullName??row.title)})),scope:'ENTIRE_EXPLICIT_TEST_FILES_WITHOUT_NAME_FILTER'};
}
async function run(root,env,dir,name,args){
 const stdoutPath=path.join(dir,name+'.stdout.txt'),stderrPath=path.join(dir,name+'.stderr.txt');
 const output=fs.createWriteStream(stdoutPath,{flags:'wx'}),errors=fs.createWriteStream(stderrPath,{flags:'wx'});
 const startedAt=new Date().toISOString();let timedOut=false,overflow=false,errorCode=null,stdoutBytes=0,stderrBytes=0;
 return await new Promise(resolve=>{
  const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const timer=setTimeout(()=>{timedOut=true;child.kill();},120_000);
  const limit=8*1024*1024;
  child.stdout.on('data',chunk=>{const allowed=Math.max(0,limit-stdoutBytes-stderrBytes);stdoutBytes+=chunk.length;if(allowed)output.write(chunk.subarray(0,allowed));if(stdoutBytes+stderrBytes>limit){overflow=true;child.kill();}});
  child.stderr.on('data',chunk=>{const allowed=Math.max(0,limit-stdoutBytes-stderrBytes);stderrBytes+=chunk.length;if(allowed)errors.write(chunk.subarray(0,allowed));if(stdoutBytes+stderrBytes>limit){overflow=true;child.kill();}});
  child.on('error',error=>{errorCode=error.code??'SPAWN_FAILED';});
  child.on('close',async(exitCode,signal)=>{
   clearTimeout(timer);
   await Promise.all([new Promise(done=>output.end(done)),new Promise(done=>errors.end(done))]);
   const receipt={command:[process.execPath,...args],startedAt,finishedAt:new Date().toISOString(),exitCode,signal,errorCode,timedOut,overflow,
    observedStdoutBytes:stdoutBytes,observedStderrBytes:stderrBytes,rawStreamsComplete:!overflow,stdout:reference(stdoutPath,limit),stderr:reference(stderrPath,limit)};
   fs.writeFileSync(path.join(dir,name+'.execution.json'),json(receipt),{flag:'wx'});resolve(receipt);
  });
 });
}
let dir=null;
try{
 check(process.argv.length===4,'USE_CHECK_HELPER_FINAL_INPUT_SHA');
 const selected=readB(process.argv[2],process.argv[3]),input=selected.value;
 check(input.schemaVersion===1&&input.kind==='literary-planet-child-local-parent-owner-check-input'&&input.finalized===true&&/^a[1-9][0-9]*$/u.test(input.attempt),'FINAL_CHECK_INPUT_REQUIRED');
 const integration=readRef(input.integration),value=integration.value;
 check(value.kind==='literary-planet-child-local-parent-owner-integration'&&value.status==='INTEGRATED'&&value.checksExecuted===false&&value.files?.length===15,'EXACT_UNCHECKED_INTEGRATION_REQUIRED');
 const data=loadFinalInput(value.input.path,value.input.sha256);
 check(equal(value.files,data.input.files)&&value.sourceRows===1790&&value.previousAppSource===data.baseline.sourceCommit&&value.previousHead===data.baseline.repositoryHead,'INTEGRATION_INPUT_BINDING_CHANGED');
 guard(data,true);const before=await capture(data.root);preserve(data,before,true);
 const integrated=readRef(value.after).value;
 check(equal(before,integrated),'EXACT_REVIEWED_DIRTY_INPUTS_REQUIRED');
 dir=path.join(B,'child-local-parent-owner-work-20261004','checks-'+input.attempt);fs.mkdirSync(dir);
 fs.writeFileSync(path.join(dir,'inputs-before.json'),json(before),{flag:'wx'});
 const beforeTools=tools(data.root),registry='docs/mobile/RELEASE_DECISIONS.json',registryHash=sha(rawFile(path.join(data.root,registry)));
 fs.writeFileSync(path.join(dir,'tool-inputs.json'),json(beforeTools),{flag:'wx'});
 const testConfig=path.join(dir,'server-test.tsconfig.json');
 fs.writeFileSync(testConfig,json({extends:path.join(data.root,'server/planet/tsconfig.json'),compilerOptions:{typeRoots:[path.join(data.root,'node_modules/@types')],types:['node']},include:[path.join(data.root,serverTest)],exclude:[]}),{flag:'wx'});
 // No imports/dependency resolution or environment-file loading in this owned
 // configuration. The explicit Node worker threads belong to the launched PID.
 const unitConfig=path.join(dir,'vitest.config.mjs');
 fs.writeFileSync(unitConfig,'export default '+JSON.stringify({root:data.root,envDir:false,envPrefix:[],test:{include:[...suites,serverTest],pool:'threads'}},null,2)+';\n',{flag:'wx'});
 const plan=[
  ['affected-units',['node_modules/vitest/vitest.mjs','run',...suites,'--config',unitConfig,'--maxWorkers=1','--reporter=json','--outputFile='+path.join(dir,'affected.vitest.json')]],
  ['server-pin-units',['node_modules/vitest/vitest.mjs','run',serverTest,'--config',unitConfig,'--maxWorkers=1','--reporter=json','--outputFile='+path.join(dir,'server-pin.vitest.json')]],
  ['application-typescript',['node_modules/typescript/bin/tsc','--noEmit','--project','tsconfig.json']],
  ['server-test-typescript',['node_modules/typescript/bin/tsc','--noEmit','--project',testConfig]],
  ['server-typescript',['node_modules/typescript/bin/tsc','--noEmit','--project','server/planet/tsconfig.json']],
 ];
 const commands=[];
 // At most two processes. Complete each bounded batch before another starts;
 // both Vitest jobs finish before the full application typecheck is launched.
 for(let offset=0;offset<plan.length;offset+=2){
  const completed=await Promise.allSettled(plan.slice(offset,offset+2).map(([name,args])=>run(data.root,data.env,dir,name,args)));
  for(const item of completed){check(item.status==='fulfilled','COMMAND_RECEIPT_WRITE_FAILED');commands.push(item.value);}
 }
 let reportError=null,affected=null,serverPin=null;
 try{affected=summary(path.join(dir,'affected.vitest.json'),suites,data.root);serverPin=summary(path.join(dir,'server-pin.vitest.json'),[serverTest],data.root);
  check(serverPin.total===56,'EXACT_SERVER_PIN_56_REQUIRED');
 }catch(error){reportError=error.code??'ACTUAL_UNIT_REPORT_MISSING_OR_INVALID';}
 let after=null,guardError=null;
 try{guard(data,true);after=await capture(data.root);preserve(data,after,true);check(equal(before,after)&&equal(beforeTools,tools(data.root))&&sha(rawFile(path.join(data.root,registry)))===registryHash,'EXECUTION_INPUTS_OR_TOOLS_CHANGED');}
 catch(error){guardError=error.code??'POSTFLIGHT_GUARD_FAILED';}
 if(after)fs.writeFileSync(path.join(dir,'inputs-after.json'),json(after),{flag:'wx'});
 const pass=guardError===null&&reportError===null&&commands.every(row=>row.exitCode===0&&row.signal===null&&row.errorCode===null&&!row.timedOut&&!row.overflow)
  &&affected?.success&&affected.failed===0&&affected.pendingOrFiltered===0&&serverPin?.success&&serverPin.passed===56&&serverPin.failed===0&&serverPin.pendingOrFiltered===0;
 const result={schemaVersion:1,kind:'literary-planet-child-local-parent-owner-focused-checks',status:pass?'PASS':'FAIL',pass,
  input:{path:selected.path,sha256:selected.sha256},integration:{path:integration.path,sha256:integration.sha256},recordedRepositoryHead:before.repositoryHead,
  recordedLastCommittedAppSource:before.sourceCommit,dirtySourceFiles:OWNED,binding:Object.fromEntries(['sourceCommit','repositoryHead','sourceFingerprint','lockSha256','toolsFingerprint'].map(key=>[key,before[key]])),
  before:reference(path.join(dir,'inputs-before.json')),after:after?reference(path.join(dir,'inputs-after.json')):null,toolInputs:reference(path.join(dir,'tool-inputs.json')),
  commands,affected,serverPin,typeScript:commands.slice(2).every(row=>row.exitCode===0&&!row.errorCode&&!row.signal&&!row.timedOut&&!row.overflow),
  reportError,guardError,inputsUnchanged:guardError===null,configurations:[reference(testConfig),reference(unitConfig)],failedAttemptsPreserved:true,
  nativeBuilds:'ROOT_SEPARATE_NOT_RUN_BY_THIS_HELPER',installedNativeRuntime:'NOT_RUN',swiftCompiler:'NOT_RUN',appActivation:false,stageAccepted:false,releaseReady:false,remoteRequests:0};
 fs.writeFileSync(path.join(dir,'result.json'),json(result),{flag:'wx'});
 console.log(json({status:result.status,output:dir,result:reference(path.join(dir,'result.json')),affectedPassed:affected?.passed??null,serverPinPassed:serverPin?.passed??null,typeScript:result.typeScript,inputsUnchanged:result.inputsUnchanged}));
 process.exitCode=pass?0:1;
}catch(error){
 if(dir)fs.writeFileSync(path.join(dir,'failure.json'),json({status:'FAIL',phase:'focused-checks',errorCode:error.code??'LOCAL_INPUT_OR_IO_FAILED',releaseReady:false}),{flag:'wx'});
 console.error(json({status:'FAIL',output:dir,errorCode:error.code??'LOCAL_INPUT_OR_IO_FAILED'}));process.exitCode=1;
}
