// Actual current create/save/check modules and installed SDK; controlled Auth/native transport only.
// Real actions + actual installed SDK. Only finite local transport/platform boundaries are synthetic.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {createRequire} = require('node:module');
const repo = process.env.PAGE_CREATOR_REPO || path.resolve(__dirname, '../../../..');
const sourceRoot = process.env.PAGE_CREATOR_SOURCE_ROOT || repo;
const native = createRequire(path.join(repo, 'package.json'));
const copy = value => structuredClone(value);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const actorId = '22222222-2222-4222-8222-222222222222';
const previous = '2026-10-30T12:34:56.123456+00:00';
const next = '2026-10-30T12:34:56.123457+00:00';

function createPageActorRuntime(scenario, options={}) {
  const {createClient} = native('@supabase/supabase-js');
  const ts = native('typescript');
  const graph = new Map(), loaded = new Map(), ledger = new Map();
  const trace = {scenario, actionCalls:[], wire:[], canonicalWrites:[], createPayloads:[], audit:[], enqueue:[],
    auth:[], cache:[], after:[], external:[], protocolErrors:[], forbiddenTranslationCalls:[]};
  const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json'}});
  async function dbFetch(input, init={}) {
    const url = new URL(typeof input === 'string' ? input : input.url || String(input));
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const wire = {method, pathname:url.pathname, search:url.search, body:copy(body), response:null, status:null};
    trace.wire.push(wire);
    assert.equal(url.origin, 'https://m20-page.invalid', 'No live DB transport permitted');
    const respond = (data, status=200) => {wire.response=copy(data); wire.status=status; return json(data,status);};
    if (method === 'POST' && url.pathname === '/rest/v1/rpc/save_page_operation') {
      assert.deepEqual(Object.keys(body).sort(), ['p_expected_updated_at','p_operation_id','p_payload','p_submitted_intent']);
      const captured = trace.actionCalls.at(-1);
      const actualIntent = load('apps/admin/lib/page-operation-intent.ts').capturePageOperationIntent(form(captured.fields));
      assert.deepEqual(body.p_submitted_intent, actualIntent, 'Native input must be the actual original FormData intent');
      assert.equal(body.p_operation_id, new Map(captured.fields).get('page_operation_id'));
      assert.equal(body.p_expected_updated_at, previous, 'Keep raw six-digit source revision');
      assert.equal(body.p_payload.updated_by, actorId);
      if (scenario === 'known-refusal-newer-b') return respond({code:'40001',message:'PAGE_CONFLICT',details:null,hint:null},409);
      assert.equal(ledger.size, 0, 'This bounded producer permits only the initial canonical command, never a synthetic replay write');
      const envelope = {version:1, operationId:body.p_operation_id, entityType:'page',
        requestedEntityId:body.p_submitted_intent.entityId, intent:body.p_submitted_intent.intent,
        persistence:'page', replayed:false,
        receipt:{page_id:body.p_submitted_intent.entityId,page_updated_at:next,page_status:body.p_payload.status}};
      ledger.set(body.p_operation_id, {input:copy(body), envelope:copy(envelope)});
      trace.canonicalWrites.push({operationId:body.p_operation_id,payload:copy(body.p_payload),expectedUpdatedAt:body.p_expected_updated_at,receipt:copy(envelope.receipt)});
      // This is an explicitly controlled committed-response-loss fault, not a real database commit claim.
      if (scenario === 'committed-ack-lost-lookup-newer-b') return respond({code:'57014',message:'CONTROLLED_COMMITTED_ACK_LOST',details:null,hint:null},503);
      return respond(envelope);
    }
    if (method === 'POST' && url.pathname === '/rest/v1/rpc/get_editor_operation_result') {
      assert.deepEqual(Object.keys(body).sort(), ['p_operation_id','p_submitted_intent']);
      const saved = ledger.get(body.p_operation_id);
      assert(saved, 'Explicit lookup must address the actual initial operation');
      assert.deepEqual(body.p_submitted_intent, saved.input.p_submitted_intent, 'Lookup must retain original A, not current B');
      return respond({...saved.envelope,replayed:true});
    }
    if (method === 'POST' && url.pathname === '/rest/v1/admin_audit_log') {
      trace.audit.push(copy(body)); wire.response=null;wire.status=201;return new Response(null,{status:201});
    }
    if (options.allowCreate===true && method==='POST' && url.pathname==='/rest/v1/pages') {
      assert.equal(url.searchParams.get('select'),'id');
      assert.equal(body.created_by,actorId);assert.equal(body.updated_by,actorId);
      trace.createPayloads.push(copy(body));
      return respond({id:'11111111-1111-4111-8111-111111111111'},201);
    }
    if (method === 'POST' && url.pathname === '/rest/v1/rpc/enqueue_public_build_request') {
      assert.equal(body.p_entity_type,'page');
      assert.equal(body.p_entity_id,'11111111-1111-4111-8111-111111111111');
      assert.equal(body.p_reason,options.allowCreate===true?'page.created':'page.updated');
      trace.enqueue.push(copy(body)); return respond('1');
    }
    trace.protocolErrors.push({method,path:url.pathname,search:url.search,body:copy(body)});
    throw Error('Unmapped controlled SDK request');
  }
  const sdk = createClient('https://m20-page.invalid','synthetic-local-public-fixture-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},db:{retry:false},global:{fetch:dbFetch},
  });
  const mocks = {
    'apps/admin/lib/auth.ts':{requireStaff:async()=>{trace.auth.push({userId:actorId,role:'owner',kind:'synthetic fresh staff boundary'});return {user:{id:actorId},role:'owner'};}},
    'apps/admin/lib/supabase/server.ts':{createServerSupabaseClient:async()=>sdk},
    'apps/admin/lib/env.ts':{adminEnv:{publicSiteUrl:'https://public.invalid',deployHookUrl:'',deployHookToken:'',
      githubDeployToken:'',githubRepository:'',githubDeployWorkflow:'',githubDeployRef:''}},
    'apps/admin/lib/auto-translate-published-article-premium.ts':{ensurePublishedArticlePremiumEnglish:async()=>{
      trace.forbiddenTranslationCalls.push('unexpected article translation');throw Error('No translation is permitted in a page operation');}},
  };
  function resolve(request,parent) {
    const base=request.startsWith('@/')?'apps/admin/'+request.slice(2):request.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(parent),request)):null;
    if(base===null)return null;
    for(const suffix of ['','.ts','.tsx','.js','.jsx','.json','/index.ts','/index.tsx','/index.js']) {
      const file=base+suffix;
      if(file.startsWith('../')||path.posix.isAbsolute(file))throw Error('Local source escaped explicit sourceRoot');
      const actual=path.join(sourceRoot,file);if(fs.existsSync(actual)&&fs.statSync(actual).isFile())return file;
    }
    throw Error('Uncaptured local module '+request+' from '+parent);
  }
  function load(file) {
    if(Object.hasOwn(mocks,file))return mocks[file];
    if(loaded.has(file))return loaded.get(file).exports;
    const bytes=fs.readFileSync(path.join(sourceRoot,file));
    const binding={file,bytes:bytes.length,sha256:sha(bytes)};
    graph.set(file,{file,bytes:bytes.length,sha256:sha(bytes),role:'actual-action-runtime'});
    if(file.endsWith('.json')){const module={exports:JSON.parse(bytes)};loaded.set(file,module);return module.exports;}
    const module={exports:{}};loaded.set(file,module);
    const code=ts.transpileModule(bytes.toString(),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,
      target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    const localRequire=request=>{
      if(request==='server-only')return {};
      if(request==='next/cache')return {revalidatePath:value=>trace.cache.push(value)};
      if(request==='next/server')return {after:callback=>{trace.after.push('scheduled actual action callback');assert.equal(typeof callback,'function');}};
      const target=resolve(request,file);return target?load(target):native(request);
    };
    const externalFetch=async(input)=>{trace.external.push(String(input));throw Error('External fetch is forbidden');};
    new Function('require','module','exports','fetch','process',code)(localRequire,module,module.exports,externalFetch,
      {env:{NODE_ENV:'test',ADMIN_BASE_PATH:''}});
    return module.exports;
  }
  function form(fields) {const data=new FormData();for(const [key,value] of fields){assert.equal(typeof key,'string');assert.equal(typeof value,'string');data.append(key,value);}return data;}
  async function action(kind,fields) {
    assert(['save','check'].includes(kind));
    const actualForm=form(fields),intent=load('apps/admin/lib/page-operation-intent.ts').capturePageOperationIntent(actualForm);
    assert(intent,'Actual operation intent parser rejected the emitted FormData');
    const context={operationId:actualForm.get('page_operation_id'),submittedIntent:intent};
    const record={kind,fields:copy(fields),intent:copy(intent),context:copy(context),result:null};trace.actionCalls.push(record);
    const actual=load('apps/admin/app/(dashboard)/pages/actions.ts');
    const result=await (kind==='save'?actual.savePageAction(actualForm):actual.checkPageOperationAction(actualForm));
    const parsed=load('apps/admin/lib/page-save-result.ts').parsePageSaveResult(result,intent.entityId,intent.expectedUpdatedAt,context.operationId);
    assert(parsed,'Actual strict public result parser rejected the real action output');
    record.result=copy(result);return result;
  }
  // Actual create action; closed known-content return and native redirect both propagate unchanged.
  async function create(fields) {
    assert.equal(options.allowCreate,true,'Create is outside the default M20 scope');
    const record={kind:'create',fields:copy(fields),result:null,nativeSignalDigest:null};trace.actionCalls.push(record);
    try {const result=await load('apps/admin/app/(dashboard)/pages/actions.ts').createPageAction(form(fields));record.result=copy(result);return result;}
    catch(error){record.nativeSignalDigest=error?.digest||null;throw error;}
  }
  return {action,create,trace,graph,ledger,sdk};
}
module.exports={createPageActorRuntime,actorId,previous,next};
