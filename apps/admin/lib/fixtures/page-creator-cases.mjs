// Actual current action/SDK runtime; original three creator cases below remain byte-exact BEFORE declarations.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=process.env.PAGE_CREATOR_REPO||path.resolve(here,'../../../..');
const native=createRequire(path.join(repo,'package.json'));
const {createPageActorRuntime,actorId,previous}=native(path.join(here,'page-creator-runtime.cjs'));
const {isRedirectError}=native('next/dist/client/components/redirect-error');
const {getURLFromRedirectError}=native('next/dist/client/components/redirect');
const {createClient}=native('@supabase/supabase-js');
const copy=value=>structuredClone(value);
export const cases=[
  {id:'creator-two-paragraphs',role:'M19-T01 target',kind:'actual-create',title:'Exact authored plain page',
    paragraphs:['First exact authored paragraph.','Second exact authored paragraph.']},
  {id:'creator-literal-tags',role:'M19-T05 target',kind:'actual-create',title:'Exact authored literal page',
    paragraphs:['Literal <em>example</em> and <script>window.__m19ActiveMarkupProbe = 1</script> are plain author text.',
      'Second exact paragraph: A < B & C > D.']},
  {id:'coherent-html-json-control',role:'positive actual component/read control, synthetic persisted row',kind:'coherent-control',title:'Exact coherent control page',
    paragraphs:['First exact coherent control paragraph.','Second exact coherent control paragraph.']},
];
export async function prepareCreatorCase(scenario){
  const runtime=createPageActorRuntime('m19-'+scenario.id,{allowCreate:true});
  const trace={kind:scenario.kind,actualCreator:false,creationFormFields:null,nativeRedirect:null,SDKReadWire:[],browserActionCalls:[]};
  let row;
  if(scenario.kind==='actual-create'){
    const fields=[['title',scenario.title],['slug',scenario.id],['excerpt','Exact authored creator excerpt'],['content',scenario.paragraphs.join('\n\n')],
      ['catalog_q',''],['catalog_status','all'],['catalog_page','1'],['editor_revision_page','1']];
    trace.creationFormFields=copy(fields);
    try{await runtime.create(fields);throw Error('Actual create action must produce its native redirect');}
    catch(error){if(!isRedirectError(error))throw error;trace.nativeRedirect={digest:error.digest,url:getURLFromRedirectError(error)};}
    trace.actualCreator=true;
    assert.equal(runtime.trace.createPayloads.length,1);
    const insert=runtime.trace.wire.find(call=>call.pathname==='/rest/v1/pages'&&call.method==='POST');
    assert(insert&&insert.status===201&&typeof insert.response?.id==='string');
    // Only the actual emitted payload is reopened. ID comes from the controlled
    // actual-SDK response. Timestamp/deleted_at are declared synthetic row defaults,
    // never a real DB receipt/version claim.
    row={...copy(insert.body),id:insert.response.id,updated_at:previous,deleted_at:null};
  }else{
    row={id:'11111111-1111-4111-8111-111111111111',updated_at:previous,title:scenario.title,excerpt:'Exact coherent control excerpt',slug:scenario.id,
      content_html:scenario.paragraphs.map(text=>'<p>'+text+'</p>').join(''),
      content_json:{type:'doc',content:scenario.paragraphs.map(text=>({type:'paragraph',content:[{type:'text',text}]}))},
      status:'draft',seo_title:'',seo_description:'',canonical_url:'https://public.invalid/control/',allow_indexing:true,deleted_at:null,
      created_by:actorId,updated_by:actorId};
  }
  const sdk=createClient('https://m19-read.invalid','synthetic-local-public-fixture-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},db:{retry:false},global:{fetch:async(input,init={})=>{
      const url=new URL(typeof input==='string'?input:input.url||String(input));
      const wire={method:init.method||'GET',pathname:url.pathname,search:url.search,response:null};trace.SDKReadWire.push(wire);
      assert.equal(url.origin,'https://m19-read.invalid');assert.equal(url.pathname,'/rest/v1/pages');assert.equal(wire.method,'GET');
      assert.equal(url.searchParams.get('id'),'eq.'+row.id);assert.equal(url.searchParams.get('deleted_at'),'is.null');
      wire.response=[copy(row)];return new Response(JSON.stringify(wire.response),{status:200,headers:{'content-type':'application/json'}});
    }},
  });
  // A declared installed-SDK read of the controlled persistence projection,
  // not execution of the real Next route's query-builder or managed PostgREST.
  const read=await sdk.from('pages').select('*').eq('id',row.id).is('deleted_at',null).maybeSingle();
  assert.equal(read.error,null);assert.deepEqual(read.data,row);
  return{scenario,row:read.data,trace,runtime};
}

// Additive real CreatePageForm controls. These are not part of the original three cases/42 checks.
export const formCases=Object.freeze([
  'known-content-refusal','extra-key-result','empty-message-result','whitespace-message-result',
  'missing-message-result','null-result','overlong-message-result','wrong-outcome-result','committed-response-lost',
]);
export function createFormCase(id){
  assert(formCases.includes(id));
  return{scenario:id,runtime:createPageActorRuntime('form-'+id,{allowCreate:true}),transport:[],ready:false};
}
export function controlledFormDelivery(id,result){
  if(id==='known-content-refusal')return result;
  if(id==='extra-key-result')return{...result,canExecute:true};
  if(id==='empty-message-result')return{...result,message:''};
  if(id==='whitespace-message-result')return{...result,message:' \n\t'};
  if(id==='missing-message-result'){const {message,...rest}=result;return rest;}
  if(id==='null-result')return null;
  if(id==='overlong-message-result')return{...result,message:'x'.repeat(501)};
  if(id==='wrong-outcome-result')return{...result,outcome:'saved'};
  throw Error('Transport-loss control never delivers a successful result');
}
