// One atomic Git docs commit after real passing metadata verification.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {cwd,binding,ROOT,FOLDER,allGlobals,read,ref,verify,verifyAll,fresh,sha,json,git,gitText,lines,snapshot,walk} from './common.mjs';
const [boundFolder,attempt,...flags]=process.argv.slice(2);assert.match(attempt,/^a[1-9][0-9]*$/u);assert.ok(flags.length===0||(flags.length===1&&flags[0]==='--preflight'));const preflight=flags.length===1;
await cwd();const {b}=await binding(boundFolder,{globalsUnchanged:false}),verificationFile=FOLDER+'/verify-state-'+attempt+'/result.json',verification=await read(verificationFile);
assert.equal(verification.pass,true);assert.equal(verification.sourceCommit,b.sourceCommit);assert.equal(verification.inputsUnchanged,true);assert.deepEqual(verification.result,await ref(FOLDER+'/result.json'));assert.deepEqual(verification.checkpoint,await ref(FOLDER+'/checkpoint.json'));assert.deepEqual(verification.finalize,await ref(FOLDER+'/finalize.json'));await verifyAll(verification.inputs);await verify(verification.execution);await verify(verification.rawReport);
const execution=await read(verification.execution.path);assert.equal(execution.exitCode,0);assert.equal(execution.error,null);assert.equal(execution.applicationChecksRun,false);assert.equal(execution.oldCasesRun,false);assert.deepEqual(execution.command,[process.execPath,'scripts/mobile/verify-state.mjs']);await verifyAll([execution.stdout,execution.stderr]);
const tracked=lines(gitText(['diff','--name-only'])),untracked=lines(gitText(['ls-files','--others','--exclude-standard']));assert.deepEqual(tracked.sort(),[...allGlobals].sort());const evidenceFiles=await walk(FOLDER);assert.ok(evidenceFiles.length>0);
const ignored=lines(gitText(['ls-files','--others','--ignored','--exclude-standard','--',FOLDER])).sort(),ignoredSet=new Set(ignored);
const browserExecution=await read(FOLDER+'/browser-'+b.attempt+'/execution.json');
const allowedIgnored=[{path:FOLDER+'/browser-'+b.attempt+'/stdout.log',sha256:browserExecution.stdout.sha256},{path:FOLDER+'/browser-'+b.attempt+'/stderr.log',sha256:browserExecution.stderr.sha256},execution.stdout,execution.stderr];
for(const file of ignored){assert.ok(evidenceFiles.includes(file));const pin=allowedIgnored.find(r=>r.path===file);assert.ok(pin,'Only exact authenticated own browser/state execution logs may be force-added');await verify(pin);}
const visibleEvidence=evidenceFiles.filter(p=>!ignoredSet.has(p));assert.deepEqual(untracked.sort(),visibleEvidence);
const paths=[...tracked,...evidenceFiles].sort(),inputs=await snapshot(paths),receiptFile=boundFolder+'/docs-commit.json';await assert.rejects(fs.stat(receiptFile),{code:'ENOENT'});
if(preflight)console.log(json({kind:'DOCS_COMMIT_PREFLIGHT',sourceCommit:b.sourceCommit,pathCount:paths.length,paths,verification:await ref(verificationFile),writes:false}));
else{
 const startedAt=new Date().toISOString();let checkpoint=null,error=null,committedInputs=[];
 try{
  assert.deepEqual(await snapshot(paths),inputs);assert.equal(gitText(['diff','--cached','--name-only']),'');git(['add','--',...[...tracked,...visibleEvidence].sort()]);
  if(ignored.length)git(['add','--force','--',...ignored]);assert.deepEqual(lines(gitText(['diff','--cached','--name-only'])).sort(),paths);
  git(['commit','-m','Record '+b.decision+' scoped writer recovery lifecycle evidence']);checkpoint=gitText(['rev-parse','HEAD']);assert.equal(gitText(['rev-parse',checkpoint+'^']),b.sourceCommit);assert.deepEqual(lines(gitText(['diff','--name-only',b.sourceCommit,checkpoint])).sort(),paths);assert.equal(gitText(['status','--porcelain','--untracked-files=all']),'');assert.deepEqual(await snapshot(paths),inputs);
  for(const pin of inputs){const raw=await verify(pin),blob=git(['show',checkpoint+':'+pin.path]);if(!blob.equals(raw)){assert.ok(Buffer.from(raw.toString('utf8')).equals(raw)&&Buffer.from(blob.toString('utf8')).equals(blob),'Binary committed bytes differ');assert.equal(blob.toString('utf8').replaceAll('\r\n','\n'),raw.toString('utf8').replaceAll('\r\n','\n'),'Committed content differs');}committedInputs.push({path:pin.path,checkedOutSha256:pin.sha256,gitBlobSha256:sha(blob),lineEndingOnly:!blob.equals(raw)});}
 }catch(caught){error=String(caught.stack||caught);}
 await fresh(receiptFile,{schemaVersion:1,startedAt,finishedAt:new Date().toISOString(),success:!error,error,cwd:ROOT,sourceCommit:b.sourceCommit,checkpoint,decision:b.decision,result:await ref(FOLDER+'/result.json'),verification:await ref(verificationFile),inputs,committedInputs,actualHead:gitText(['rev-parse','HEAD']),status:gitText(['status','--porcelain','--untracked-files=all']),allStageAndCriterionStatusesUnchanged:true,releaseReady:false});if(error)throw Error(error);console.log(json({sourceCommit:b.sourceCommit,checkpoint,decision:b.decision,result:await ref(FOLDER+'/result.json'),receipt:await ref(receiptFile),releaseReady:false}));
}
