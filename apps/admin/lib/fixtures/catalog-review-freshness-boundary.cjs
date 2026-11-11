const assert=require('node:assert/strict');
const copy=value=>structuredClone(value);
const equal=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const fields=['p_entity_type','p_entity_id','p_draft_id','p_expected_version','p_candidate_hash','p_source_hash','p_catalog_source_hash','p_catalog_source_fields'];

// Server metadata effects only. The review inspector, typed receipt parser,
// human confirmation, domain validators and promotion algorithms stay actual.
function catalogCandidateFreshnessReceipt(args,input){
  assert.deepEqual(Object.keys(args).sort(),fields.slice().sort());
  assert.ok(['literary_work','country'].includes(args.p_entity_type));
  if(args.p_entity_type==='literary_work'){assert.equal(args.p_catalog_source_hash,null);assert.equal(args.p_catalog_source_fields,null);}
  const draft=input.findDraft(args),operation=draft?input.findOperation(draft):null,linked=Boolean(operation);
  let reason=null;
  if(!draft)reason='candidate_missing';
  else if(draft.entityType!==args.p_entity_type||draft.entityId!==args.p_entity_id||draft.version!==args.p_expected_version||
      draft.candidateHash!==args.p_candidate_hash||draft.sourceHash!==args.p_source_hash)reason='candidate_changed';
  else if(linked&&(!input.isSourceCurrent(operation,args)||operation.result?.draftVersion!==draft.version||operation.result?.candidateHash!==draft.candidateHash||operation.sourceHash!==draft.sourceHash||
      !equal(operation.candidate?.payload,draft.payload)||!equal(operation.candidate?.provenance,draft.provenance)))reason='source_changed';
  return{version:1,entityType:args.p_entity_type,entityId:args.p_entity_id,draftId:args.p_draft_id,draftVersion:args.p_expected_version,
    candidateHash:args.p_candidate_hash,sourceHash:args.p_source_hash,linked,canPromote:reason===null,reason};
}

function attachCatalogFreshnessBoundary(view,kind,createClient,options={}){
  const calls=[],identity=view.spec.type;
  const client=createClient(`https://${kind}-freshness.fixture.invalid`,'synthetic-no-auth-session',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(resource,init={})=>{
      const url=new URL(typeof resource==='string'?resource:resource.url),args=JSON.parse(init.body||'{}');
      assert.equal(url.pathname,'/rest/v1/rpc/get_catalog_translation_candidate_freshness');assert.equal(url.origin,`https://${kind}-freshness.fixture.invalid`);
      if(options.beforeRead)await options.beforeRead(view,args);
      const value=catalogCandidateFreshnessReceipt(args,{
        findDraft(request){return[...view.privateCandidates.values()].find(draft=>draft.id===request.p_draft_id)||null;},
        findOperation(draft){return[...view.server.operations.values()].find(operation=>operation.result?.draftId===draft.id)||null;},
        isSourceCurrent(operation,request){return!view.server.targetChanged(operation)&&(identity!=='country'||equal(operation.rawSeed.catalogFields,request.p_catalog_source_fields));},
      });
      calls.push({args:copy(args),response:copy(value)});
      if(options.error)return new Response(JSON.stringify({code:options.error,message:'PRIVATE_FRESHNESS_DIAGNOSTIC'}),{status:503,headers:{'Content-Type':'application/json'}});
      if(options.throwError)throw options.throwError;
      const response=options.mapResponse?options.mapResponse(copy(value),copy(args)):value;
      return new Response(JSON.stringify(response),{status:200,headers:{'Content-Type':'application/json'}});
    }}});
  const original=view.sdk.rpc.bind(view.sdk);
  view.sdk.rpc=function(name,args,config){return name==='get_catalog_translation_candidate_freshness'?client.rpc(name,args,config):original(name,args,config);};
  return{calls,endpoint:'get_catalog_translation_candidate_freshness'};
}
module.exports={catalogCandidateFreshnessReceipt,attachCatalogFreshnessBoundary};
