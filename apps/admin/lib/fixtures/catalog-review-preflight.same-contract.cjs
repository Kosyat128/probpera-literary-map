const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const [input,output]=process.argv.slice(2);assert.ok(input&&output);assert.equal(fs.existsSync(output),false);
const bytes=fs.readFileSync(input),report=JSON.parse(bytes),checks=[];
function check(kind,name,category,fn){try{fn();checks.push({kind,name,category,pass:true});}catch(error){checks.push({kind,name,category,pass:false,error:error.stack||String(error)});}}
for(const kind of ['library','country']){
  const item=report.cases.find(value=>value.kind===kind);assert.ok(item);
  check(kind,'Actual review/helper/premium/SDK algorithms execute before and after the same rights-only change','execution',()=>{
    assert.equal(item.executionFailure,null);assert.equal(item.generated.state,'translated');assert.equal(item.initial.status,'pending');assert.equal(item.initial.canPromote,true);
    assert.ok(item.sources.some(value=>value.module==='apps/admin/lib/premium-translation-review.ts'));
    assert.ok(item.sources.some(value=>value.module===(kind==='library'?'apps/admin/lib/auto-translate-literary-work.ts':'apps/admin/lib/auto-translate-country-profile.ts')));
    assert.ok(item.sources.some(value=>value.module==='apps/admin/lib/premium-english-translation.ts'));assert.ok(item.installedSdkVersion);
  });
  check(kind,'Only the controlled rights field changes; timestamps/manual/source/candidate data remain exact','preservation',()=>{
    assert.equal(item.onlyRightsChanged,true);assert.deepEqual(item.protectedAfter,item.protectedBefore);assert.deepEqual(item.draftAfter,item.draftBefore);
    assert.equal(item.providerCalls,2);assert.equal(item.canonicalWrites,0);assert.equal(item.publicBuildRequests,0);assert.equal(item.sourcesUnchanged,true);
  });
  check(kind,'The pending candidate remains visible with the same English body after rights drift','preservation',()=>{
    assert.equal(item.after.status,'pending');assert.deepEqual(item.after.candidateEnglish,item.initial.candidateEnglish);assert.equal(item.after.draft.id,item.initial.draft.id);
  });
  check(kind,'Approval must close after full rights drift despite unchanged timestamps','target',()=>assert.equal(item.after.canPromote,false));
}
const result={atUtc:new Date().toISOString(),contract:'SAME pending-candidate preflight full-seed rights invariants for book and country',
  inputSha256:crypto.createHash('sha256').update(bytes).digest('hex'),contractSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),checks,
  controlFailures:checks.filter(value=>!value.pass&&value.category!=='target').length,targetFailures:checks.filter(value=>!value.pass&&value.category==='target').length};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));process.exitCode=result.controlFailures?2:result.targetFailures?1:0;
