const fs=require('node:fs'),assert=require('node:assert/strict');
const report=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),checks=[];
function check(name,category,body){try{body();checks.push({name,category,pass:true});}catch(error){checks.push({name,category,pass:false,error:error.message});}}
assert.deepEqual(report.cases.map(row=>row.kind),['writer','library','country','site_copy']);
for(const row of report.cases){
 const category=row.kind==='site_copy'?'control':'target';
 check(row.kind+' ordinary repeat does not regenerate acknowledged valid translator output',category,()=>{assert.deepEqual(row.newLogicalOperationIds,[]);assert.deepEqual(row.newDispatchCallIds,[]);assert.equal(row.deltas.translationCalls,0);assert.equal(row.deltas.providerCalls,0);});
 check(row.kind+' actual trigger retained valid translation then known invalid review and repair','control',()=>{assert.deepEqual(row.firstProviderCalls.map(call=>call.pass),['translation','review','repair']);assert.ok(row.validatedFirstTranslation);assert.ok(Object.hasOwn(row.firstRawTranslatorBody,'body'));assert.deepEqual(row.knownEditorialFailures.map(row=>[row.pass,row.rejected]),[['review',true],['repair',true]]);assert.equal(row.firstCounts.response,3);assert.equal(row.firstCounts.candidates,0);});
 check(row.kind+' canonical manual data and publication remain exact','preservation',()=>{assert.deepEqual(row.canonicalAfter,row.canonicalBefore);assert.equal(row.after.canonicalWrites,0);assert.equal(row.after.publicBuilds,0);});
 check(row.kind+' original accepted raw bodies and identities remain retained','preservation',()=>{for(const old of row.firstOperations){const current=row.finalOperations.find(op=>(op.operationId||op.receipt?.operationId)===(old.operationId||old.receipt?.operationId));assert.ok(current);for(const call of old.calls){const retained=current.calls.find(next=>(next.id||next.metadata?.callId)===(call.id||call.metadata?.callId));assert.ok(retained);assert.deepEqual(retained.responseArtifact||retained.artifact,call.responseArtifact||call.artifact);}}});
}
const summary={checks:checks.length,pass:checks.filter(c=>c.pass).length,fail:checks.filter(c=>!c.pass).length,targetFail:checks.filter(c=>!c.pass&&c.category==='target').length,controlFail:checks.filter(c=>!c.pass&&c.category==='control').length,preservationFail:checks.filter(c=>!c.pass&&c.category==='preservation').length};
console.log(JSON.stringify({checks,summary}));process.exitCode=summary.fail?1:0;
