const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const repo=process.env.PUBLICATION_RETRY_REPO||path.resolve(__dirname,'../../../..');
const sourceRoot=process.env.PUBLICATION_RETRY_SOURCE_ROOT||repo,native=createRequire(path.join(repo,'package.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),copy=value=>structuredClone(value);
const graph=new Map(),compiled=new Map();
const actorId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',stamp='2026-10-30T12:34:56.123456+00:00';
const canonical={ru:{title:'Exact authored RU',body:'Original body',sources:['https://source.invalid/one']},en:{title:'Manual English',method:'human-translation'},rights:{owner:'Synthetic editor',license:'permission'}};
function event(id='42',status='failed',extra={}) {
 return {id,actor_id:actorId,entity_type:'article',entity_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',reason:'article.updated',status,
  metadata:{authored:copy(canonical)},attempt_count:1,last_error:null,provider:null,requested_at:stamp,dispatched_at:null,deployed_at:null,
  deployment_run_id:null,created_at:stamp,updated_at:stamp,retry_operation_id:null,retry_of_outbox_id:null,...extra};
}
function createPublicationRetryRuntime(options={}) {
 const {createClient}=native('@supabase/supabase-js'),ts=native('typescript');
 const React=native('next/dist/compiled/react'),ReactDOM=native('next/dist/compiled/react-dom/server');
 const rows=new Map((options.rows||[event()]).map(row=>[String(row.id),copy(row)]));let nextId=1001n;
 const trace={wire:[],rpc:[],external:[],audit:[],editorialWrites:[],translationCalls:[],auth:[],reads:[],commands:[],revalidation:[],protocolErrors:[],boundaries:['fresh staff session','server SDK client','public deployment HTTP','Next Link primitive','Next cache invalidation','synthetic env configuration']};
 const json=(data,status=200,count)=>new Response(data===null?null:JSON.stringify(data),{status,headers:{'content-type':'application/json',...(count===undefined?{}:{'content-range':`0-${Math.max(0,count-1)}/${count}`})}});
 const receipt=(body,outcome,source,observed=source)=>({version:1,requested:{outboxId:body.p_outbox_id,operationId:body.p_retry_operation_id,expectedUpdatedAt:body.p_expected_updated_at},outcome,canDispatch:outcome==='admitted',
  source:{outboxId:String(source.id),retryOfOutboxId:source.retry_of_outbox_id===null?null:String(source.retry_of_outbox_id),status:source.status,updatedAt:source.updated_at},rootOutboxId:String(source.retry_of_outbox_id??source.id),
  observed:observed?{outboxId:String(observed.id),retryOfOutboxId:observed.retry_of_outbox_id===null?null:String(observed.retry_of_outbox_id),operationId:observed.retry_operation_id,actorId:observed.actor_id,status:observed.status,updatedAt:observed.updated_at,provider:observed.provider}:null,
  dispatch:outcome==='admitted'?{entityType:observed.entity_type,entityId:observed.entity_id,reason:observed.reason}:null});
 function admit(body) {
  // Controlled transport state model only. Native concurrency/authorization is
  // proved separately by the actual SQL fixture and its untouched wire export.
  const old=[...rows.values()].find(row=>row.retry_operation_id===body.p_retry_operation_id);
  const source=rows.get(body.p_outbox_id);
  if(options.admitDenied)return {error:{code:'42501',message:'Controlled admission denied'}};
  if(old) {
   if(old.actor_id!==(options.actorId||actorId)||String(old.retry_of_outbox_id)!==body.p_outbox_id||old.metadata.native_publication_retry.expectedUpdatedAt!==body.p_expected_updated_at)return {error:{code:'22023',message:'Controlled immutable command mismatch'}};
   if(!source)return {error:{code:'P0002',message:'Controlled source unavailable'}};
   return {data:receipt(body,'replay',source,old)};
  }
  if(!source)return {error:{code:'P0002',message:'Controlled source unavailable'}};
  if(source.retry_of_outbox_id!==null)return {data:receipt(body,'root-required',source)};
  if(source.status==='deployed')return {data:receipt(body,'complete',source)};
  if(['requested','dispatched'].includes(source.status))return {data:receipt(body,'active',source)};
  if(['retry_of_outbox_id','retry_operation_id','native_publication_retry'].some(key=>Object.hasOwn(source.metadata,key)))return {error:{code:'22023',message:'Controlled legacy retry binding unconfirmed'}};
  const children=[...rows.values()].filter(row=>String(row.retry_of_outbox_id)===String(source.id));
  const child=children.find(row=>row.status==='deployed')||children.find(row=>['requested','dispatched','failed'].includes(row.status));
  if(child)return {data:receipt(body,child.status==='deployed'?'complete':'active',source,child)};
  const equal=load('apps/admin/lib/publication-retry-contract.ts').publicationRetryTimestampEqual;
  if(!equal(source.updated_at,body.p_expected_updated_at))return {data:receipt(body,'stale',source)};
  if(options.requiredAuditFailure)return {error:{code:'23514',message:'Controlled required audit failure'}};
  const id=String(nextId++),childRow=event(id,'requested',{actor_id:options.actorId||actorId,entity_type:source.entity_type,entity_id:source.entity_id,
   reason:Array.from('manual-retry:'+source.reason).slice(0,240).join(''),metadata:{...copy(source.metadata),retry_of_outbox_id:String(source.id),native_publication_retry:{version:1,expectedUpdatedAt:body.p_expected_updated_at}},
   retry_operation_id:body.p_retry_operation_id,retry_of_outbox_id:String(source.id),attempt_count:0});
  rows.set(id,childRow);trace.audit.push({action:'public_build.retry_admitted',outbox_id:id,retry_operation_id:body.p_retry_operation_id});
  return {data:receipt(body,'admitted',source,childRow)};
 }
 const dbFetch=async(input,init={})=>{
  const url=new URL(String(input)),method=init.method||'GET',body=init.body?JSON.parse(String(init.body)):null;
  const wire={method,pathname:url.pathname,search:url.search,body:copy(body),response:null};trace.wire.push(wire);
  assert.equal(url.origin,'https://m04-retry.invalid','No live DB transport is permitted');
  if(url.pathname==='/rest/v1/public_build_outbox'&&['GET','HEAD'].includes(method)) {
   trace.reads.push({method,search:url.search});
   if(options.readFailure){wire.response={code:'42501'};return json({code:'42501',message:'Controlled read refused'},403);}
   let list=[...rows.values()];const id=url.searchParams.get('id'),status=url.searchParams.get('status');
   if(id?.startsWith('eq.'))list=list.filter(row=>String(row.id)===id.slice(3));
   if(status?.startsWith('eq.'))list=list.filter(row=>row.status===status.slice(3));
   if(status?.startsWith('in.('))list=list.filter(row=>status.slice(4,-1).split(',').includes(row.status));
   list.sort((a,b)=>BigInt(a.id)<BigInt(b.id)?1:-1);const count=list.length;
   list=list.slice(Number(url.searchParams.get('offset')||0),Number(url.searchParams.get('offset')||0)+Number(url.searchParams.get('limit')||1000));
   wire.response=method==='HEAD'?null:copy(list);return json(method==='HEAD'?null:list,200,options.countUnavailable?'*':count);
  }
  if(url.pathname.startsWith('/rest/v1/rpc/')&&method==='POST') {
   const name=url.pathname.slice('/rest/v1/rpc/'.length);trace.rpc.push({name,args:copy(body)});
   if(name==='admit_public_build_retry') {
    await options.beforeAdmit?.({body,rows,trace});
    const result=options.admissionResponse?await options.admissionResponse({body,rows,trace,admit}):admit(body);
    if(options.admissionAckLost&&result.data?.outcome==='admitted'){wire.response={code:'57014'};return json({code:'57014',message:'Controlled committed admission ACK lost'},503);}
    if(result.error){wire.response=copy(result.error);return json(result.error,400);}
    wire.response=copy(result.data);return json(result.data);
   }
   if(name==='mark_public_build_dispatched') {
    if(options.markThrows)throw new Error('Controlled mark transport failure');
    if(options.markError){wire.response={code:'57014'};return json({code:'57014',message:'Controlled mark unavailable'},503);}
    if(Object.hasOwn(options,'markData')){wire.response=copy(options.markData);return json(options.markData);}
    const row=rows.get(String(body.p_outbox_id)),found=Boolean(row&&['requested','dispatched','failed'].includes(row.status));
    if(found){row.status='dispatched';row.provider=body.p_provider;row.attempt_count++;row.dispatched_at=stamp;}
    wire.response=found;return json(found);
   }
   if(name==='enqueue_public_build_request') {
    if(['retry_of_outbox_id','retry_operation_id','native_publication_retry'].some(key=>Object.hasOwn(body.p_metadata||{},key))){wire.response={code:'22023'};return json({code:'22023',message:'Retry requires atomic admission'},400);}
    const id=String(nextId++),row=event(id,'requested',{entity_type:body.p_entity_type,entity_id:body.p_entity_id,reason:body.p_reason,metadata:copy(body.p_metadata),attempt_count:0});
    rows.set(id,row);wire.response=id;return json(id);
   }
   trace.protocolErrors.push('Unexpected RPC '+name);throw Error('Unexpected RPC '+name);
  }
  if(url.pathname==='/rest/v1/admin_audit_log'&&method==='POST'){trace.audit.push(copy(body));wire.response=null;return new Response(null,{status:201});}
  trace.editorialWrites.push({method,path:url.pathname,body:copy(body)});trace.protocolErrors.push('Unexpected SDK operation');throw Error('Unexpected SDK operation');
 };
 const externalFetch=async(input,init={})=>{
  const url=new URL(String(input));assert.equal(url.href,'https://api.cloudflare.com/fixture/no-network-deploy-hook');assert.equal(init.method,'POST');
  const record={url:url.href,method:init.method,body:JSON.parse(String(init.body)),accepted:!options.externalFailure};trace.external.push(record);
  await options.onExternal?.({record,rows,trace});
  if(options.externalThrows)throw Error('Controlled provider acceptance is unknown');return json({accepted:!options.externalFailure},options.externalFailure?503:200);
 };
 const sdk=createClient('https://m04-retry.invalid','synthetic-local-public-fixture-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},db:{retry:false},global:{fetch:dbFetch}});
 const env={deployHookUrl:options.notConfigured?'':'https://api.cloudflare.com/fixture/no-network-deploy-hook',deployHookToken:'',githubDeployToken:'',githubRepository:'',githubDeployWorkflow:'',githubDeployRef:''};
 const mocks={
  'apps/admin/lib/auth.ts':{requireStaff:async()=>{trace.auth.push('fresh staff');return options.noSession?null:{user:{id:options.actorId||actorId},role:'owner'};}},
  'apps/admin/lib/supabase/server.ts':{createServerSupabaseClient:async()=>options.clientMissing?null:sdk},
  'apps/admin/lib/env.ts':{adminEnv:env},
  'apps/admin/lib/auto-translate-published-article-premium.ts':{ensurePublishedArticlePremiumEnglish:async()=>{trace.translationCalls.push('unexpected');throw Error('Retry/full build must not translate article');}},
 };
 const loaded=new Map();
 function resolve(request,parent) {
  const base=request.startsWith('@/')?'apps/admin/'+request.slice(2):request.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(parent),request)):null;
  if(base===null)return null;
  for(const suffix of ['','.ts','.tsx','.js','.json','/index.ts','/index.tsx'])if(fs.existsSync(path.join(sourceRoot,base+suffix))&&fs.statSync(path.join(sourceRoot,base+suffix)).isFile())return base+suffix;
  throw Error('Unresolved actual local source '+request+' from '+parent);
 }
 function load(file) {
  if(Object.hasOwn(mocks,file))return mocks[file];if(loaded.has(file))return loaded.get(file).exports;
  const bytes=fs.readFileSync(path.join(sourceRoot,file)),binding={file,bytes:bytes.length,sha256:sha(bytes)};
  if(graph.has(file))assert.deepEqual(binding,graph.get(file),'Source changed during controlled proof');graph.set(file,binding);
  if(file.endsWith('.json')){const value=JSON.parse(bytes);loaded.set(file,{exports:value});return value;}
  let code=compiled.get(binding.sha256);if(!code){code=ts.transpileModule(bytes.toString(),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;compiled.set(binding.sha256,code);}
  const module={exports:{}};loaded.set(file,module);
  const localRequire=request=>{
   if(request==='react')return React;if(request==='react/jsx-runtime')return native('next/dist/compiled/react/jsx-runtime');
   if(request==='next/link')return {__esModule:true,default:({children,prefetch,...props})=>React.createElement('a',props,children)};
   if(request==='next/cache')return {revalidatePath:value=>trace.revalidation.push(value)};
   if(request==='server-only')return {};
   const target=resolve(request,file);return target?load(target):native(request);
  };
  const fixtureProcess={env:{NODE_ENV:'test',ADMIN_BASE_PATH:''}};
  new Function('require','module','exports','fetch','process',code)(localRequire,module,module.exports,externalFetch,fixtureProcess);return module.exports;
 }
 async function page(query={}) {
  const Page=load('apps/admin/app/(dashboard)/publication/page.tsx').default;
  const html=ReactDOM.renderToStaticMarkup(await Page({searchParams:Promise.resolve(query)}));
  return {html,$:native('cheerio').load(html)};
 }
 function forms(view) {
  return view.$('form').toArray().filter(node=>view.$(node).find('input[name="retry_operation_id"]').length).map(node=>{
   const form=new FormData();view.$(node).find('input[name]').each((_i,input)=>form.append(view.$(input).attr('name'),view.$(input).attr('value')||''));return form;
  });
 }
 async function action(form) {
  const command={form:[...form.entries()],wireBefore:trace.wire.length,externalBefore:trace.external.length,result:null,error:null};
  try{command.result=await load('apps/admin/app/(dashboard)/publication/actions.ts').retryPublicationAction(form);}
  catch(error){command.error={name:error?.name,message:String(error?.message||error),digest:error?.digest};throw error;}
  finally{command.wireAfter=trace.wire.length;command.externalAfter=trace.external.length;command.wire=copy(trace.wire.slice(command.wireBefore));trace.commands.push(command);}
  return command.result;
 }
 return {rows,trace,sdk,load,page,forms,action,event,actorId:options.actorId||actorId,stamp,canonical:copy(canonical),receipt,admit,React,ReactDOM};
}
function captureSources(output) {
 fs.mkdirSync(output,{recursive:true});for(const row of graph.values()) {
  const bytes=fs.readFileSync(path.join(sourceRoot,row.file));assert.equal(sha(bytes),row.sha256,'Actual source drift: '+row.file);
  const target=path.join(output,'captured-current',row.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
 }
 const report={classification:'ACTUAL_PAGE_ACTION_HELPERS_INSTALLED_SDK_CONTROLLED_TRANSPORT_NOT_NATIVE_DB_AUTH_OR_PROVIDER',sources:[...graph.values()].sort((a,b)=>a.file.localeCompare(b.file)),sourceDrift:false,realNetwork:0,nativeConnections:0,realProviderCalls:0};
 fs.writeFileSync(path.join(output,'source-graph.json'),JSON.stringify(report,null,2)+'\n');return report;
}
module.exports={createPublicationRetryRuntime,captureSources,repo,sourceRoot,actorId,stamp,event,canonical,sha};
