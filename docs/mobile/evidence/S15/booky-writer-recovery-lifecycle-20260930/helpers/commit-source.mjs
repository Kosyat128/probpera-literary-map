// Future root invocation only. --observe records an actual already-made commit.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {cwd,packet,execution,realReviews,ref,verify,json,fresh,git,gitText,lines,FIXTURE} from './common.mjs';
const [executionFolder,attempt,reviewReceiptPath,...flags]=process.argv.slice(2);assert.match(attempt,/^a[1-9][0-9]*$/u);assert.ok(reviewReceiptPath);assert.ok(flags.length===0||(flags.length===2&&flags[0]==='--observe'));const observed=flags.length===2,observedCommit=flags[1];
await cwd();await packet();const c=await execution(executionFolder,{sourceCommit:observed?observedCommit:null});assert.equal(c.attempt,attempt);
assert.equal(gitText(['diff','--cached','--name-only']),'');assert.equal(gitText(['ls-files','--others','--exclude-standard']),'');
if(!observed){assert.equal(gitText(['rev-parse','HEAD']),c.entry.checkpoint);assert.deepEqual(lines(gitText(['diff','--name-status'])),['M\t'+FIXTURE]);}else assert.equal(gitText(['diff','--name-only']),'');
const reviewed=await realReviews(c,reviewReceiptPath,observed?observedCommit:null),receiptFile=executionFolder+'/source-commit.json',boundReviewFile=executionFolder+'/review-receipt-bound.json';
for(const p of [receiptFile,boundReviewFile])await assert.rejects(fs.stat(p),{code:'ENOENT'});
const startedAt=new Date().toISOString(),before=c.entry.checkpoint;let sourceCommit=observedCommit??null,error=null;
try{
 await verify(reviewed.input);
 if(!observed){
  // One exact approved fixture path; the commit contains no evidence or globals.
  git(['add','--',FIXTURE]);assert.deepEqual(lines(gitText(['diff','--cached','--name-status'])),['M\t'+FIXTURE]);
  git(['commit','-m','Verify current-only Booky writer recovery lifecycle']);sourceCommit=gitText(['rev-parse','HEAD']);
 }
 assert.equal(gitText(['rev-parse',sourceCommit+'^']),before);assert.deepEqual(lines(gitText(['diff','--name-status',before,sourceCommit])),['M\t'+FIXTURE]);
 await execution(executionFolder,{sourceCommit});assert.equal(gitText(['status','--porcelain','--untracked-files=all']),'');
 await verify(reviewed.input);
 // Bind only the now-observed source identity. Reviewer, methods and findings
 // remain the actual four-view input; no inspection or approval is invented.
 await fresh(boundReviewFile,{...reviewed.receipt,sourceCommit,sourceManifest:c.run.sourceManifest,sourceCommitBinding:{kind:observed?'OBSERVED_EXISTING_SINGLE_FIXTURE_COMMIT':'OWNED_SINGLE_FIXTURE_COMMIT',parent:before,originalInspectionReceipt:reviewed.input}});
}catch(caught){error=String(caught.stack||caught);}
const receipt={schemaVersion:1,kind:observed?'OBSERVED_SOURCE_COMMIT_RECEIPT':'SOURCE_COMMIT_RECEIPT',startedAt,finishedAt:new Date().toISOString(),success:!error,error,parent:before,sourceCommit,changedPaths:[FIXTURE],entry:await ref(executionFolder+'/entry.json'),run:await ref(executionFolder+'/browser-'+attempt+'/result.json'),originalInspectionReceipt:reviewed.input,reviewReceipt:!error?await ref(boundReviewFile):null,actualHead:gitText(['rev-parse','HEAD']),status:gitText(['status','--porcelain','--untracked-files=all']),releaseReady:false};
await fresh(receiptFile,receipt);if(error)throw Error(error);console.log(json({sourceCommit,receipt:await ref(receiptFile),boundFourViewReceipt:receipt.reviewReceipt,sourcePaths:[FIXTURE],observedExistingCommit:observed}));
