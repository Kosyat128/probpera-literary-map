const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {setup,output,sources,sha,repo}=require('./catalog-review-full-seed-runtime.cjs');
const checks=[],traces=[];
async function check(kind,name,body){try{const value=await body();checks.push({kind,name,pass:true});traces.push({kind,name,...value});}catch(error){checks.push({kind,name,pass:false,error:error.stack||String(error)});}}
function preserve(view,before){assert.deepEqual(view.canonical(),before);assert.equal(view.writes.length,0);assert.equal(view.builds.length,0);assert.deepEqual(view.server.errors,[]);view.collect();}
function pending(value,canPromote){assert.equal(value.status,'pending');assert.equal(value.canPromote,canPromote);}
const draft=view=>[...view.privateCandidates.values()][0];
async function generated(kind,options){const view=setup(kind,options);assert.equal((await view.helper()).state,'translated');return view;}
async function main(){
  for(const kind of ['library','country']){
    await check(kind,'Viewing a current linked candidate is free and never probes or starts a provider',async()=>{
      const view=await generated(kind),before=view.canonical(),offset=view.wire.length;
      view.ai.run=async()=>{throw new Error('Viewing must never call a provider');};const first=await view.inspect(),second=await view.inspect();pending(first,true);pending(second,true);
      assert.equal(view.providerCalls.length,2);assert.equal(view.metadata.calls.length,2);
      assert.ok(view.metadata.calls.every(call=>call.response.linked&&call.response.reason===null));
      assert.equal(view.wire.slice(offset).some(call=>/translation_provider_self_tests|dispatch|artifacts/u.test(call.path||'')),false);
      const panel=view.render(second);assert.equal(panel.approvalForms,1);assert.equal(panel.discardForms,1);preserve(view,before);return{first,second,panel,metadata:view.metadata.calls};
    });
    await check(kind,'Rights-only drift keeps the exact preview and discard form while closing approval',async()=>{
      const view=await generated(kind),before=view.canonical(),first=await view.inspect();pending(first,true);
      if(kind==='library')view.rows[0].sources[0].license_name='Changed source licence with exact master timestamps';else view.rows[0].row.fields.rights='Changed opaque override rights with exact timestamp';
      const concurrent=view.canonical(),second=await view.inspect();pending(second,false);assert.deepEqual(second.candidateEnglish,first.candidateEnglish);assert.deepEqual(second.draft,first.draft);
      const panel=view.render(second);assert.equal(panel.approvalForms,0);assert.equal(panel.discardForms,1);assert.ok(panel.englishPreviews>=1);
      assert.equal(view.providerCalls.length,2);assert.equal(view.metadata.calls.at(-1).response.reason,'source_changed');preserve(view,concurrent);return{before,concurrent,first,second,panel,metadata:view.metadata.calls};
    });
    await check(kind,'Existing manual-ownership denial stays closed without an extra metadata read',async()=>{
      const view=await generated(kind);
      if(kind==='library')view.rows[0].english.translation_method='human-translation';else view.rows[0].row.fields.translations.en.method='human-translation';
      const before=view.canonical(),value=await view.inspect();pending(value,false);assert.equal(view.metadata.calls.length,0);assert.equal(view.providerCalls.length,2);
      assert.equal(view.render(value).approvalForms,0);preserve(view,before);return{value};
    });
    for(const [name,metadata]of [
      ['missing RPC',{error:'PGRST202'}],['permission error',{error:'42501'}],['transient failure',{error:'57014'}],
      ['null response',{mapResponse:()=>null}],['extra private body',{mapResponse:value=>({...value,body:'PRIVATE_FRESHNESS_DIAGNOSTIC'})}],
      ['wrong draft version',{mapResponse:value=>({...value,draftVersion:value.draftVersion+1})}],
      ['wrong candidate hash',{mapResponse:value=>({...value,candidateHash:'0'.repeat(64)})}],
      ['wrong source hash',{mapResponse:value=>({...value,sourceHash:'0'.repeat(64)})}],
      ['wrong textual entity',{mapResponse:value=>({...value,entityId:'wrong-entity'})}],
    ])await check(kind,`Metadata ${name} closes approval without hiding preview or permitting legacy fallback`,async()=>{
      const view=await generated(kind,{metadata}),before=view.canonical(),value=await view.inspect();pending(value,false);assert.ok(value.problem);assert.equal(String(value.problem).includes('PRIVATE_FRESHNESS_DIAGNOSTIC'),false);
      assert.equal(view.metadata.calls.length,1);const panel=view.render(value);assert.equal(panel.approvalForms,0);assert.equal(panel.discardForms,1);assert.ok(panel.englishPreviews>=1);
      assert.equal(view.providerCalls.length,2);preserve(view,before);return{value,panel,metadata:view.metadata.calls};
    });
    await check(kind,'A genuinely existing unlinked legacy draft retains the original review branch at zero provider cost',async()=>{
      const view=setup(kind),original=JSON.parse(Buffer.from(view.original.entries['report.json'])).initial.draft;
      view.privateCandidates.set(`${view.spec.type}:${view.identity(0)}`,structuredClone(original));const before=view.canonical(),value=await view.inspect();pending(value,true);
      assert.equal(view.metadata.calls.length,1);assert.deepEqual(view.metadata.calls[0].response,{version:1,entityType:original.entityType,entityId:original.entityId,draftId:original.id,
        draftVersion:original.version,candidateHash:original.candidateHash,sourceHash:original.sourceHash,linked:false,canPromote:true,reason:null});
      assert.equal(view.server.operations.size,0);assert.equal(view.providerCalls.length,0);assert.equal(view.render(value).approvalForms,1);preserve(view,before);return{value,metadata:view.metadata.calls};
    });
    await check(kind,'Candidate consumed between initial read and metadata keeps historical preview closed; a fresh read is empty',async()=>{
      let consumed=false;const view=await generated(kind,{metadata:{beforeRead(current){if(!consumed){current.privateCandidates.clear();consumed=true;}}}}),before=view.canonical();
      const first=await view.inspect();pending(first,false);assert.equal(view.metadata.calls[0].response.reason,'candidate_missing');
      const second=await view.inspect();assert.deepEqual(second,{status:'none'});assert.equal(view.metadata.calls.length,1);assert.equal(view.providerCalls.length,2);preserve(view,before);return{first,second,metadata:view.metadata.calls};
    });
    await check(kind,'Historical operation cannot borrow a different current private draft identity',async()=>{
      let replacement;const view=await generated(kind,{metadata:{beforeRead(current,args){if(!replacement){const old=draft(current);replacement={...structuredClone(old),id:'23232323-2323-4323-8323-232323232323',candidateHash:'d'.repeat(64)};
        current.privateCandidates.set(`${current.spec.type}:${current.identity(0)}`,replacement);}}}}),before=view.canonical(),oldId=draft(view).id;
      const first=await view.inspect();pending(first,false);assert.equal(first.draft.id,oldId);assert.equal(view.metadata.calls[0].response.reason,'candidate_missing');
      const second=await view.inspect();pending(second,true);assert.equal(second.draft.id,replacement.id);assert.equal(view.metadata.calls[1].response.linked,false);
      assert.deepEqual(draft(view),replacement);assert.equal(view.providerCalls.length,2);preserve(view,before);return{first,second,replacement,metadata:view.metadata.calls};
    });
    await check(kind,'Metadata remains a staff-independent read without actor-owned artifact access',async()=>{
      const view=await generated(kind),before=view.canonical(),offset=view.wire.length;view.sdk.auth.getUser=async()=>({data:{user:{id:'34343434-3434-4434-8434-343434343434'}},error:null});
      const value=await view.inspect();pending(value,true);const args=view.metadata.calls[0].args;
      assert.equal(Object.keys(args).some(key=>/actor|job|item|operation/u.test(key)),false);assert.equal(view.wire.slice(offset).some(call=>/get_catalog_translation_operation_artifacts/u.test(call.path||'')),false);
      assert.equal(view.providerCalls.length,2);preserve(view,before);return{value,metadata:view.metadata.calls,scope:'Actual staff/RLS authorization is independently covered by native SQL; no actor/body fields exposed by UI metadata requests.'};
    });
  }
  const report={checks,traces,sources:[...sources.values()],unchanged:true,
    limitations:['Actual review inspection, typed adapter, domain validators, private draft parser, real panel SSR and installed SDK execute. Only Auth/server/provider/clock transport boundaries are controlled.',
      'Generation is setup only; viewing makes zero additional provider/probe/dispatch calls. Native SQL independently proves staff authorization, real locks and atomic post-preflight promotion guards.',
      'No live services, provider invoice, production, normalizer/rule/direct-call/test changes or full module acceptance claim.']};
  fs.writeFileSync(path.join(output,'review-cases-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,checks}));process.exitCode=checks.some(value=>!value.pass)?1:0;
}
main().catch(error=>{console.error(error.stack||String(error));process.exitCode=2;});
