/** Maintained controlled AFTER adapter. Explicit parent release is required for execution.
 * Future usage: node producer.mjs --execute-controlled --output=<NEW parent directory>
 * Runs actual captured PageEditor/TipTap/Next React + actual current save/check actions + installed SDK.
 * Synthetic Auth, finite DB/publication transport and autosave-read boundary are explicitly separate.
 */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {observeRealPageSubmitter} from './fixtures/page-pending-submitter-cases.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const values=process.argv.slice(2);
if(!values.includes('--execute-controlled'))throw Error('PREPARED ONLY: explicit parent release and --execute-controlled are required; no bundle/browser/server has started.');
const args={};
for(const value of values){
  if(value==='--execute-controlled')continue;
  const match=/^--(output|chrome|inputs)=(.+)$/u.exec(value);
  if(!match||Object.hasOwn(args,match[1]))throw Error('Unsupported/duplicate producer argument');
  args[match[1]]=match[2];
}
if(!args.output||!path.isAbsolute(args.output))throw Error('A fresh absolute parent output path is required');
if(!args.inputs||!path.isAbsolute(args.inputs))throw Error('Explicit fresh captured-current --inputs path required');
const freezeBytes=await fs.readFile(args.inputs);
const freeze=JSON.parse(freezeBytes),repo=freeze.repo,capture=freeze.captureRoot;
const output=path.resolve(args.output),parentWork=path.join(path.dirname(repo),'work');
const workRelative=path.relative(parentWork,output);
if(path.isAbsolute(workRelative)||workRelative.startsWith('..')||output===parentWork||existsSync(output))throw Error('Output must be a new directory inside parent work');
if(path.relative(repo,output)===''||!path.relative(repo,output).startsWith('..'))throw Error('No output writes inside the repository');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const copy=value=>structuredClone(value);
const now=()=>new Date().toISOString();
async function physicalInputs(){
  const rows=[];
  for(const row of freeze.sources){
    const live=await fs.readFile(path.join(repo,row.file)),saved=await fs.readFile(path.join(capture,row.file));
    if(live.length!==row.bytes||sha(live)!==row.sha256||!live.equals(saved))throw Error('Prepared current/captured source drift: '+row.file);
    rows.push({file:row.file,bytes:live.length,sha256:sha(live),roles:row.roles});
  }
  for(const row of freeze.packages){
    const bytes=await fs.readFile(path.join(repo,row.file));
    if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)throw Error('Installed package identity drift: '+row.file);
  }
  return rows;
}
const before=await physicalInputs();
await fs.mkdir(output,{recursive:false});
const native=createRequire(path.join(repo,'package.json'));
const {build}=native('esbuild'),{chromium}=native('playwright');
const {createPageActorRuntime:createFrozenPageActorRuntime,actorId,previous,next}=native(path.join(here,'fixtures/page-pending-action-runtime.cjs'));
const createPageActorRuntime=scenario=>createFrozenPageActorRuntime(scenario,{freeze});
const sourceMap=new Map(freeze.sources.map(row=>[row.file,row]));
const graph=new Map(),runtimeGraphs=new Map(),contexts=new Map(),results=[],externalRequests=[];
const cases=['own-a-no-newer-b','own-a-newer-b','known-refusal-newer-b','committed-ack-lost-lookup-newer-b','post-submit-storage-failure'];
const additionalResults=[];
const startedAt=now();
await fs.writeFile(path.join(output,'source-before.json'),JSON.stringify({at:startedAt,freezeSha256:sha(freezeBytes),validationSourceSha256:freeze.validationSourceSha256,sources:before,packages:freeze.packages},null,2));
const virtual={
  'next/link':'import React from "react";export default function Link({children,prefetch,...props}){return React.createElement("a",props,children)}',
  'next/navigation':'export {unstable_rethrow} from "next/dist/client/components/unstable-rethrow.browser";export function useRouter(){return{refresh(){throw Error("Unexpected fixture refresh")}}}',
  'next/dynamic':'import React from "react";export default function dynamic(loader,options={}){const C=React.lazy(async()=>{const m=await loader();return{default:m.default||m}});return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(C,props))}',
  '@/app/(dashboard)/pages/actions':'export async function savePageAction(data){return window.__m20PageActor.action("save",data)}export async function checkPageOperationAction(data){return window.__m20PageActor.action("check",data)}',
  '@/app/(dashboard)/editor-links/actions':'export async function searchEditorInternalLinksAction(){throw Error("Internal links are outside this finite fixture")}',
  '@/app/(dashboard)/editor-autosave/actions':'export async function loadLatestEditorAutosaveAction(input){window.__m20PageActor.autosave.push({kind:"load",input});return{ok:true,recovery:null}}export async function saveEditorAutosaveAction(input){window.__m20PageActor.autosave.push({kind:"save",input});return{ok:false,error:"CONTROLLED_AUTOSAVE_UNAVAILABLE"}}export async function deleteExactEditorAutosaveAction(input){window.__m20PageActor.autosave.push({kind:"delete",input});throw Error("Unexpected autosave deletion")}',
};
let server,browser,origin,terminalError=null,cleanup={browserClosed:false,loopbackClosed:false};
try{
  const bundle=await build({absWorkingDir:repo,entryPoints:[path.join(here,'fixtures/page-pending-entry.jsx')],nodePaths:[path.join(repo,'node_modules')],
    bundle:true,write:false,metafile:true,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic',
    define:{'process.env.NODE_ENV':'"development"','process.env.ADMIN_BASE_PATH':'"/admin"'},
    plugins:[{name:'strict-captured-actual-page-editor',setup(builder){
      builder.onResolve({filter:/.*/},request=>{
        if(Object.hasOwn(virtual,request.path))return{path:request.path,namespace:'m20-platform'};
        if(/^react(?:\/|$)|^react-dom(?:\/|$)/u.test(request.path))return{path:native.resolve('next/dist/compiled/'+request.path)};
        if(/@supabase|(?:^|\/)server-only$|\/lib\/auth(?:\.|\/)|\/lib\/supabase\/|^node:/u.test(request.path))throw Error('Server/provider import forbidden in actual client bundle: '+request.path);
        if(request.path.startsWith('@/')){
          const base='apps/admin/'+request.path.slice(2),file=['','.ts','.tsx','.js','.jsx','/index.ts','/index.tsx'].map(suffix=>base+suffix).find(file=>sourceMap.has(file));
          if(!file)throw Error('Uncaptured admin import: '+request.path);
          return{path:path.join(capture,file)};
        }
      });
      builder.onLoad({filter:/.*/,namespace:'m20-platform'},request=>({contents:virtual[request.path],loader:'js',resolveDir:repo}));
      builder.onLoad({filter:/\.[jt]sx?$/},async request=>{
        if(!request.path.startsWith(capture+path.sep))return;
        const file=path.relative(capture,request.path).replaceAll('\\','/'),binding=sourceMap.get(file);
        if(!binding)throw Error('Uncaptured relative source: '+file);
        const bytes=await fs.readFile(request.path);
        if(bytes.length!==binding.bytes||sha(bytes)!==binding.sha256)throw Error('Captured source changed: '+file);
        if(/^["']use server["'];/u.test(bytes.toString().trimStart()))throw Error('Unmocked server action in browser: '+file);
        graph.set(file,{file,bytes:bytes.length,sha256:sha(bytes),role:'actual-browser-runtime'});
        return{contents:bytes.toString(),loader:request.path.endsWith('tsx')?'tsx':request.path.endsWith('jsx')?'jsx':request.path.endsWith('ts')?'ts':'js'};
      });
      builder.onLoad({filter:/\.css$/},()=>({contents:'export default {}',loader:'js'}));
    }}],
  });
  const code=bundle.outputFiles[0].text;
  await fs.writeFile(path.join(output,'bundle.js'),code);
  await fs.writeFile(path.join(output,'bundle-metafile.json'),JSON.stringify(bundle.metafile,null,2));
  const vendor=[];
  for(const name of Object.keys(bundle.metafile.inputs)){
    if(name.startsWith('m20-platform:'))continue;
    const file=path.isAbsolute(name)?name:path.resolve(repo,name);
    if(file.startsWith(capture+path.sep)||file.startsWith(here+path.sep)||!existsSync(file))continue;
    const bytes=await fs.readFile(file);vendor.push({file:path.relative(repo,file).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes),role:'actual-bundle-vendor-input'});
  }
  await fs.writeFile(path.join(output,'vendor-inputs.json'),JSON.stringify(vendor,null,2));
  const bodyLimit=8*1024*1024;
  server=http.createServer(async(request,response)=>{
    try{
      const url=new URL(request.url,'http://127.0.0.1');
      if(request.method==='GET'&&url.pathname==='/bundle.js'){response.writeHead(200,{'content-type':'text/javascript'});response.end(code);return;}
      if(request.method==='POST'&&url.pathname==='/action'){
        const scenario=url.searchParams.get('scenario'),kind=url.searchParams.get('kind'),context=contexts.get(scenario);
        if(!context||!['save','check'].includes(kind))throw Error('Unknown finite action request');
        let raw='';for await(const chunk of request){raw+=chunk;if(raw.length>bodyLimit)throw Error('Oversized action request');}
        const fields=JSON.parse(raw);if(!Array.isArray(fields))throw Error('Invalid form serialization');
        const transport={kind,fields:copy(fields),receivedAt:now(),result:null,delivered:false};context.transport.push(transport);
        const result=await context.runtime.action(kind,fields);transport.result=copy(result);transport.actionSettledAt=now();
        if(kind==='save'&&context.transport.filter(row=>row.kind==='save').length===1){context.ready=true;await context.gate;}
        response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify({ok:true,result}));transport.delivered=true;transport.deliveredAt=now();return;
      }
      if(request.method==='GET'&&url.pathname==='/'){
        response.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
        response.end('<!doctype html><meta charset="utf-8"><title>Actual actor-bound PageEditor controlled boundary</title><style>body{font-family:Arial}.ProseMirror{min-height:90px;border:1px solid;padding:8px}button,input,textarea{margin:4px}</style><div id="root"></div><script src="/bundle.js"></script>');return;
      }
      response.writeHead(404);response.end();
    }catch(error){response.writeHead(500,{'content-type':'application/json'});response.end(JSON.stringify({ok:false,error:{name:error.name,message:error.message}}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  const executablePath=args.chrome||'C:/Program Files/Google/Chrome/Application/chrome.exe';
  if(!existsSync(executablePath))throw Error('Installed Chrome unavailable; no download or installation is performed');
  browser=await chromium.launch({headless:true,executablePath});
  const poll=async(predicate,message)=>{const deadline=Date.now()+5000;while(!predicate()){if(Date.now()>deadline)throw Error(message);await new Promise(resolve=>setTimeout(resolve,20));}};
  for(const scenario of cases){
    let release;const runtime=createPageActorRuntime(scenario),bridge={runtime,transport:[],ready:false,gate:new Promise(resolve=>{release=resolve;})};contexts.set(scenario,bridge);
    const context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block'});
    const checks=[],pageErrors=[],consoleErrors=[];
    const check=(name,pass,details)=>checks.push({name,pass:Boolean(pass),...(details===undefined?{}:{details})});
    let beforeA=null,sentA=null,pendingState=null,authoredB=null,final=null,firstUnknown=null;
    try{
      await context.route('**/*',route=>{
        const request=route.request(),url=new URL(request.url());
        if(url.origin===origin)return route.continue();
        externalRequests.push({scenario,url:request.url(),method:request.method()});return route.abort('blockedbyclient');
      });
      await context.addInitScript(({scenario,actorId})=>{
        const h=window.__m20PageActor={scenario,actorId,calls:[],autosave:[],storageFaults:[],storageFaultEnabled:false};
        h.action=async(kind,data)=>{
          const fields=[...data.entries()];
          if(fields.some(([,value])=>typeof value!=='string'))throw Error('Only real textual FormData fields are supported');
          const call={kind,fields,state:'pending'};h.calls.push(call);
          const response=await fetch('/action?scenario='+encodeURIComponent(scenario)+'&kind='+kind,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(fields)});
          const body=await response.json();if(!response.ok||!body.ok){call.state='transport-error';throw Error(body.error?.message||'Controlled action bridge failed');}
          call.state=body.result.outcome;call.result=body.result;return body.result;
        };
        const originalSet=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value){
          if(h.storageFaultEnabled&&(String(key).startsWith('probpera-page-operation:')||String(key).startsWith('probpera-page-editor-'))){
            h.storageFaults.push({key:String(key),kind:'post-submit-setItem',actionCount:h.calls.length,valueBytes:String(value).length});
            throw new DOMException('CONTROLLED_POST_SUBMIT_STORAGE_UNAVAILABLE','SecurityError');
          }
          return originalSet.call(this,key,value);
        };
        window.confirm=()=>true;window.alert=()=>{};
      },{scenario,actorId});
      const page=await context.newPage();page.setDefaultTimeout(5000);
      page.on('pageerror',error=>pageErrors.push({name:error.name,message:error.message}));
      page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
      await page.goto(origin+'/',{waitUntil:'networkidle'});
      await page.locator('.ProseMirror[contenteditable="true"]').waitFor();
      await page.waitForFunction(()=>[...document.querySelectorAll('button[name="intent"][value="save"]')].some(button=>!button.disabled));
      const state=()=>page.evaluate(()=>{
        const form=document.querySelector('form'),fields=form?[...new FormData(form).entries()]:null;
        const local={},session={};for(let index=0;index<localStorage.length;index++){const key=localStorage.key(index);local[key]=localStorage.getItem(key);}
        for(let index=0;index<sessionStorage.length;index++){const key=sessionStorage.key(index);session[key]=sessionStorage.getItem(key);}
        return{fields,title:document.querySelector('[name="title"]')?.value??null,
          json:document.querySelector('[name="content_json"]')?.value??null,html:document.querySelector('[name="content_html"]')?.value??null,
          cas:document.querySelector('[name="expected_updated_at"]')?.value??null,
          dirty:document.body.innerText.includes('Есть несохранённые изменения'),text:document.body.innerText,
          lookup:[...document.querySelectorAll('button')].some(button=>button.innerText.trim()==='Проверить результат сохранения'),
          submitDisabled:[...document.querySelectorAll('button[name="intent"]')].every(button=>button.disabled),
          local,session,calls:window.__m20PageActor.calls,autosave:window.__m20PageActor.autosave,
          storageFaults:window.__m20PageActor.storageFaults,reactVersion:window.__m20PageActor.reactVersion};
      });
      const author=state=>Object.fromEntries((state.fields||[]).filter(([key])=>['title','excerpt','slug','content_html','content_json','status','seo_title','seo_description','canonical_url','allow_indexing'].includes(key)));
      const edit=async suffix=>{
        await page.locator('[name="title"]').fill('Exact authored title '+suffix);
        await page.locator('[name="excerpt"]').fill('Exact authored excerpt '+suffix);
        await page.locator('.ProseMirror[contenteditable="true"]').fill('Exact authored rich text '+suffix+'.');
        await page.locator('[name="slug"]').fill('exact-page-'+suffix.toLowerCase());
        await page.locator('[name="seo_title"]').fill('Exact SEO '+suffix);
        await page.locator('[name="seo_description"]').fill('Exact SEO description '+suffix);
        await page.locator('[name="canonical_url"]').fill('https://public.invalid/manual-'+suffix.toLowerCase()+'/');
        await page.locator('[name="status"]').selectOption(suffix==='B'?'hidden':'draft');
        await page.locator('[name="allow_indexing"]').setChecked(suffix!=='B');
        await page.waitForFunction(suffix=>document.querySelector('[name="content_json"]')?.value.includes('Exact authored rich text '+suffix+'.'),suffix);
      };
      await edit('A');beforeA=await state();
      await page.locator('button[name="intent"][value="save"]').click();
      await poll(()=>bridge.ready,'Actual action/SDK bridge did not reach its gated response');
      pendingState=await state();sentA=runtime.trace.actionCalls[0];
      check('actual actor-bound component emitted exactly one save request',sentA?.kind==='save'&&pendingState.calls.length===1&&runtime.trace.actionCalls.length===1);
      const fields=new Map(sentA.fields),operationId=fields.get('page_operation_id');
      check('operation UUID comes from real component FormData, with receipt mode',typeof operationId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(operationId)&&fields.get('page_result_mode')==='receipt');
      check('raw microsecond version and actual intent A are retained',fields.get('expected_updated_at')===previous&&sentA.intent.expectedUpdatedAt===previous&&sentA.intent.intent==='save'&&new Map(sentA.intent.fields).get('title')===beforeA.title);
      check('actual request contains exact authored A document and controls',JSON.stringify(author({fields:sentA.fields}))===JSON.stringify(author(beforeA)),{submitted:author({fields:sentA.fields}),before:author(beforeA)});
      const journalKey='probpera-page-operation:'+actorId+':11111111-1111-4111-8111-111111111111';
      const initialJournal=JSON.parse(pendingState.session[journalKey]||'null');
      check('real session journal binds A to actor, operation and exact original form',initialJournal?.actorId===actorId&&initialJournal.context?.operationId===operationId&&initialJournal.context.expectedUpdatedAt===previous&&JSON.stringify(initialJournal.formFields)===JSON.stringify([...sentA.fields].sort(([a],[b])=>a<b?-1:a>b?1:0))&&initialJournal.snapshotA.title===beforeA.title&&initialJournal.snapshotA.contentJson===beforeA.json);
      check('first response is actually held while component is pending',pendingState.submitDisabled&&bridge.transport[0].delivered===false);
      if(scenario!=='own-a-no-newer-b'){
        if(scenario==='post-submit-storage-failure'){
          check('storage fault starts only after actual POST and durable A journal',initialJournal!==null&&runtime.trace.actionCalls.length===1&&pendingState.storageFaults.length===0);
          await page.evaluate(()=>{window.__m20PageActor.storageFaultEnabled=true;});
        }
        await edit('B');authoredB=await state();
        check('actual input B differs from submitted A in title, TipTap body and status',authoredB.title!==beforeA.title&&authoredB.json!==beforeA.json&&new Map(authoredB.fields).get('status')==='hidden'&&authoredB.dirty);
        if(scenario==='post-submit-storage-failure'){
          await page.waitForFunction(()=>window.__m20PageActor.storageFaults.length>0);
        }else{
          await page.waitForFunction(({key,title,json})=>{try{const j=JSON.parse(sessionStorage.getItem(key));return j.latestSnapshotB.title===title&&j.latestSnapshotB.contentJson===json;}catch{return false;}},{key:journalKey,title:authoredB.title,json:authoredB.json});
        }
      }
      release();
      await page.waitForFunction(()=>window.__m20PageActor.calls[0].state!=='pending');
      await page.waitForFunction(()=>!document.body.innerText.includes('Сохранение страницы...'));
      if(scenario==='committed-ack-lost-lookup-newer-b'){
        firstUnknown=await state();
        check('actual committed ACK-loss result is unknown with original CAS and blind writes blocked',firstUnknown.calls[0].result.outcome==='unknown-outcome'&&firstUnknown.cas===previous&&firstUnknown.lookup&&firstUnknown.submitDisabled);
        check('controlled commit precedes lost response and no second save was invoked',runtime.trace.canonicalWrites.length===1&&runtime.trace.actionCalls.length===1&&runtime.trace.enqueue.length===0);
        await page.getByRole('button',{name:'Проверить результат сохранения',exact:true}).click();
        await page.waitForFunction(()=>window.__m20PageActor.calls.length===2&&window.__m20PageActor.calls[1].state!=='pending');
        await page.waitForFunction(stamp=>document.querySelector('[name="expected_updated_at"]')?.value===stamp,next);
        check('explicit real lookup sends frozen original A FormData',runtime.trace.actionCalls[1]?.kind==='check'&&JSON.stringify(runtime.trace.actionCalls[1].fields)===JSON.stringify(sentA.fields));
        check('lookup uses the actual readonly RPC and cannot mutate canonical/audit/outbox again',runtime.trace.wire.filter(row=>row.pathname.endsWith('/get_editor_operation_result')).length===1&&runtime.trace.wire.filter(row=>row.pathname.endsWith('/save_page_operation')).length===1&&runtime.trace.canonicalWrites.length===1&&runtime.trace.audit.length===0&&runtime.trace.enqueue.length===0);
      }
      final=await state();
      if(scenario==='known-refusal-newer-b'){
        check('known refusal from actual action does not acknowledge a save',final.calls[0].result.outcome==='conflict'&&final.cas===previous&&runtime.trace.canonicalWrites.length===0&&!final.text.includes('Отправленная версия сохранена.'));
        check('known refusal preserves exact current B and dirty state',JSON.stringify(author(final))===JSON.stringify(author(authoredB))&&final.dirty);
        const localKey='probpera-page-editor-11111111-1111-4111-8111-111111111111:actor:'+actorId;
        const local=JSON.parse(final.local[localKey]||'null');
        check('known refusal removes journal only with confirmed full actor-owned B backup',final.session[journalKey]===undefined&&local?.title===authoredB.title&&local.contentJson===authoredB.json&&local.recoveryActorId===actorId);
      }else{
        check('own strict action receipt advances raw CAS by one microsecond',final.cas===next&&runtime.trace.canonicalWrites.length===1&&runtime.trace.canonicalWrites[0].operationId===operationId);
        if(scenario==='own-a-no-newer-b')check('positive own A receipt clears only the unchanged A dirty state',!final.dirty&&JSON.stringify(author(final))===JSON.stringify(author(beforeA))&&final.text.includes('Отправленная версия сохранена.'));
        else check('late own A receipt preserves exact B document and every authored control as dirty',final.dirty&&JSON.stringify(author(final))===JSON.stringify(author(authoredB))&&final.text.includes('В форме остались новые несохранённые изменения.'));
        check('canonical controlled boundary contains A only, never later B',runtime.trace.canonicalWrites[0].payload.title===beforeA.title&&JSON.stringify(runtime.trace.canonicalWrites[0].payload.content_json)===beforeA.json&&runtime.trace.canonicalWrites[0].payload.status==='draft');
      }
      if(scenario==='post-submit-storage-failure'){
        check('actual post-submit metadata writes failed and original journal A survived',final.storageFaults.length>0&&final.storageFaults.every(row=>row.actionCount===1)&&JSON.parse(final.session[journalKey]||'null')?.context.operationId===operationId);
        check('storage denial stays visible separately from confirmed own canonical receipt',final.text.includes('Браузер не подтвердил сохранение полной локальной копии')&&final.cas===next&&final.dirty);
      }
      check('no automatic navigation, extra canonical command or autosave deletion',page.url()===origin+'/'&&runtime.trace.actionCalls.filter(row=>row.kind==='save').length===1&&final.autosave.every(row=>row.kind!=='delete'));
      check('installed Next React runtime is active',typeof final.reactVersion==='string'&&final.reactVersion.startsWith('19.'));
      check('no native/client protocol error, real external HTTP or translation call',runtime.trace.protocolErrors.length===0&&runtime.trace.external.length===0&&runtime.trace.forbiddenTranslationCalls.length===0);
    }catch(error){checks.push({name:'scenario reaches its actual finite oracle',pass:false,classification:'EXECUTION_OR_OBSERVER_FAILURE_REQUIRES_CLASSIFICATION',details:{name:error.name,message:error.message,stack:error.stack}});}
    finally{
      release();
      const row={scenario,checks,pageErrors,consoleErrors,beforeA,sentA,pendingState,authoredB,firstUnknown,final,transport:bridge.transport,trace:runtime.trace};
      row.checks.push({name:'no unhandled actual component error',pass:pageErrors.length===0,details:pageErrors});
      results.push(row);for(const [file,binding]of runtime.graph)runtimeGraphs.set(file,binding);
      await context.close();contexts.delete(scenario);
    }
  }

  for(const addition of ['actual-save-submitter-through-urgent-pending','actual-publish-submitter-through-urgent-pending','preflight-storage-refusal-releases-visual-pending']){
    const scenario=addition;let release;const runtime=createPageActorRuntime(scenario),bridge={runtime,transport:[],ready:false,gate:new Promise(resolve=>{release=resolve;})};contexts.set(scenario,bridge);
    const context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block'});
    const checks=[],pageErrors=[],consoleErrors=[];let evidence=null;
    const check=(name,pass,details)=>checks.push({name,pass:Boolean(pass),...(details===undefined?{}:{details})});
    try{
      await context.route('**/*',route=>{
        const request=route.request(),url=new URL(request.url());
        if(url.origin===origin)return route.continue();
        externalRequests.push({scenario,url:request.url(),method:request.method()});return route.abort('blockedbyclient');
      });
      await context.addInitScript(({scenario,actorId})=>{
        const h=window.__m20PageActor={scenario,actorId,calls:[],autosave:[],storageFaults:[],storageFaultEnabled:false};
        h.action=async(kind,data)=>{
          const fields=[...data.entries()];
          if(fields.some(([,value])=>typeof value!=='string'))throw Error('Only real textual FormData fields are supported');
          const call={kind,fields,state:'pending'};h.calls.push(call);
          const response=await fetch('/action?scenario='+encodeURIComponent(scenario)+'&kind='+kind,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(fields)});
          const body=await response.json();if(!response.ok||!body.ok){call.state='transport-error';throw Error(body.error?.message||'Controlled action bridge failed');}
          call.state=body.result.outcome;call.result=body.result;return body.result;
        };
        const originalSet=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value){
          if(h.storageFaultEnabled&&(String(key).startsWith('probpera-page-operation:')||String(key).startsWith('probpera-page-editor-'))){
            h.storageFaults.push({key:String(key),kind:'post-submit-setItem',actionCount:h.calls.length,valueBytes:String(value).length});
            throw new DOMException('CONTROLLED_POST_SUBMIT_STORAGE_UNAVAILABLE','SecurityError');
          }
          return originalSet.call(this,key,value);
        };
        window.confirm=()=>true;window.alert=()=>{};
      },{scenario,actorId});
      const page=await context.newPage();page.setDefaultTimeout(5000);
      page.on('pageerror',error=>pageErrors.push({name:error.name,message:error.message}));
      page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
      await page.goto(origin+'/',{waitUntil:'networkidle'});
      await page.locator('.ProseMirror[contenteditable="true"]').waitFor();
      await page.waitForFunction(()=>[...document.querySelectorAll('button[name="intent"][value="save"]')].some(button=>!button.disabled));

      if(addition.startsWith('actual-')){
        const intent=addition.includes('-publish-')?'publish':'save';
        evidence=await observeRealPageSubmitter({page,bridge,waitUntil:poll,releaseFirstResponse:release,intent});
        check('actual clicked submitter contributes exactly one raw intent',JSON.stringify(evidence.rawIntents)===JSON.stringify([intent]));
        check('actual action parser retains the emitted intent and original raw CAS',evidence.submitted.intent.intent===intent&&evidence.submitted.intent.expectedUpdatedAt===evidence.before.cas);
        check('installed SDK mutation keeps actual submitted intent and canonical target status',evidence.native.body.p_submitted_intent.intent===intent&&evidence.native.body.p_payload.status===(intent==='publish'?'published':'draft'));
        check('before response release both buttons are disabled and Saving is visible',evidence.pending.buttons.length===2&&evidence.pending.buttons.every(row=>row.disabled)&&evidence.pending.savingNotice&&evidence.pending.calls[0].state==='pending');
        check('actual second pointer click on disabled submitter creates no second action',evidence.secondClick.attempted&&evidence.secondClick.actionCalls===1&&evidence.secondClick.browserCalls===1);
        check('one strict own receipt sets matching canonicalStatus and clears unchanged dirty state',!evidence.final.dirty&&evidence.final.calls[0].result.receipt.canonicalStatus===(intent==='publish'?'published':'draft'));
        check('exactly one actual action and one controlled canonical command',runtime.trace.actionCalls.length===1&&runtime.trace.canonicalWrites.length===1);
      }else{
        await page.locator('[name="title"]').fill('Preflight storage refusal retained title');
        await page.locator('.ProseMirror[contenteditable="true"]').fill('Preflight storage refusal retained body.');
        await page.waitForFunction(()=>document.querySelector('[name="content_json"]')?.value.includes('Preflight storage refusal retained body.'));
        const before=await page.evaluate(()=>({title:document.querySelector('[name="title"]').value,json:document.querySelector('[name="content_json"]').value,cas:document.querySelector('[name="expected_updated_at"]').value}));
        await page.evaluate(()=>{window.__m20PageActor.storageFaultEnabled=true;});
        await page.locator('button[name="intent"][value="save"]').click();
        await page.waitForFunction(()=>document.body.innerText.includes('Браузер не подтвердил сохранение полной копии исходного запроса.'));
        await page.waitForFunction(()=>!document.body.innerText.includes('Сохранение страницы...')&&[...document.querySelectorAll('button[name="intent"]')].every(button=>!button.disabled));
        const final=await page.evaluate(()=>({title:document.querySelector('[name="title"]').value,json:document.querySelector('[name="content_json"]').value,cas:document.querySelector('[name="expected_updated_at"]').value,dirty:document.body.innerText.includes('Есть несохранённые изменения'),saving:document.body.innerText.includes('Сохранение страницы...'),calls:window.__m20PageActor.calls,faults:window.__m20PageActor.storageFaults}));
        evidence={before,final};
        check('actual pre-admission storage denial occurs with zero submitted action calls',final.faults.length>0&&final.faults.every(row=>row.actionCount===0)&&final.calls.length===0&&runtime.trace.actionCalls.length===0);
        check('preflight failure releases visual pending and keeps dirty authored values',!final.saving&&final.dirty&&final.title===before.title&&final.json===before.json&&final.cas===before.cas);
        check('preflight storage refusal dispatches no SDK or canonical mutation',runtime.trace.wire.length===0&&runtime.trace.canonicalWrites.length===0&&bridge.transport.length===0);
      }
      check('no controlled protocol error or forbidden provider/external calls',runtime.trace.protocolErrors.length===0&&runtime.trace.external.length===0&&runtime.trace.forbiddenTranslationCalls.length===0);
    }catch(error){check('additive scenario reaches actual finite oracle',false,{name:error.name,message:error.message,stack:error.stack});}
    finally{
      release();
      check('no unhandled actual component error',pageErrors.length===0,pageErrors);
      additionalResults.push({scenario,checks,evidence,pageErrors,consoleErrors,transport:bridge.transport,trace:runtime.trace});
      for(const [file,binding]of runtime.graph)runtimeGraphs.set(file,binding);
      await context.close();contexts.delete(scenario);
    }
  }
}catch(error){terminalError={name:error.name,message:error.message,stack:error.stack};}
finally{
  if(browser){await browser.close();cleanup.browserClosed=true;}
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));cleanup.loopbackClosed=true;}
}
let after=[],driftError=null;try{after=await physicalInputs();}catch(error){driftError={name:error.name,message:error.message};}
await fs.writeFile(path.join(output,'source-after.json'),JSON.stringify({at:now(),sources:after,error:driftError},null,2));
const checks=results.flatMap(row=>row.checks);
const additionalChecks=additionalResults.flatMap(row=>row.checks);
const report={classification:'ACTUAL_PAGE_PENDING_AFTER_ORIGINAL_FIVE_PLUS_ADDITIVE_CONTROLS_NOT_NATIVE_DB_OR_MANAGED_AUTH',stage:'AFTER',
  sourceAge:freeze.sourceAge,additional:{actualCases:additionalResults.length,plannedCases:3,checks:additionalChecks.length,passed:additionalChecks.filter(row=>row.pass).length,failed:additionalChecks.filter(row=>!row.pass).length,results:additionalResults},
  startedAt,endedAt:now(),validationSourceSha256:freeze.validationSourceSha256,freezeSha256:sha(freezeBytes),
  actualCases:results.length,plannedCases:cases.length,checks:checks.length,passed:checks.filter(row=>row.pass).length,
  failed:checks.filter(row=>!row.pass).length,terminalError,driftError,externalRequests,cleanup,results,
  browserSources:[...graph.values()].sort((a,b)=>a.file.localeCompare(b.file)),
  serverSources:[...runtimeGraphs.values()].sort((a,b)=>a.file.localeCompare(b.file)),
  boundaryQualification:['Actual PageEditor/TipTap/hooks, current save/check action bodies, strict parsers and installed SDK execute.',
    'Auth/session, native DB responses and autosave transport are controlled; ledger observations are not real SQL commits, RLS or concurrency proof.',
    'No actual Next RSC action transport, external publication, provider or full M20 acceptance is claimed.',
    'Original five declarations and76 oracle check expressions are preserved from genuine BEFORE; additive controls are separately reported.'],
};
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
const inputFiles=['page-pending-browser.mjs','fixtures/page-pending-entry.jsx','fixtures/page-pending-action-runtime.cjs','fixtures/page-pending-submitter-cases.mjs'];
const producerInputs=[];for(const file of inputFiles){const bytes=await fs.readFile(path.join(here,file));producerInputs.push({file,bytes:bytes.length,sha256:sha(bytes)});}
await fs.writeFile(path.join(output,'producer-inputs.json'),JSON.stringify(producerInputs,null,2));
await fs.writeFile(path.join(output,'inputs.freeze.json'),freezeBytes);
const verdict=!terminalError&&!driftError&&results.length===cases.length&&report.failed===0&&additionalResults.length===3&&report.additional.failed===0&&externalRequests.length===0&&cleanup.browserClosed&&cleanup.loopbackClosed;
const receipt={classification:verdict?'CONTROLLED_AFTER_ORIGINAL_FIVE_AND_ADDITIVE_ORACLES_PASS':'CONTROLLED_AFTER_REQUIRES_FAILURE_CLASSIFICATION',
  report:{file:'report.json',bytes:(await fs.stat(path.join(output,'report.json'))).size,sha256:sha(await fs.readFile(path.join(output,'report.json')))},
  cases:report.actualCases,checks:report.checks,passed:report.passed,failed:report.failed,additional:{cases:report.additional.actualCases,checks:report.additional.checks,passed:report.additional.passed,failed:report.additional.failed},terminalError,driftError,cleanup,
  validationSourceSha256:freeze.validationSourceSha256,producerInputs};
await fs.writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2));
process.stdout.write(JSON.stringify({output,...receipt})+'\n');
process.exitCode=terminalError||driftError?2:verdict?0:1;
