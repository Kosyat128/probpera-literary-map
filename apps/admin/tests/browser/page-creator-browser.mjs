// Actual creator AFTER regression and additive real form controls; controlled action/SDK transport, no managed DB/Auth.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const values=process.argv.slice(2);if(!values.includes('--execute-controlled'))throw Error('PREPARED ONLY: parent release and --execute-controlled are required');
const args={};for(const value of values){if(value==='--execute-controlled')continue;const match=/^--(output|chrome|source-manifest)=(.+)$/u.exec(value);if(!match||Object.hasOwn(args,match[1]))throw Error('Unsupported/duplicate argument');args[match[1]]=match[2];}
if(!args['source-manifest']||!path.isAbsolute(args['source-manifest']))throw Error('Explicit prepared source manifest required');
const freezeBytes=await fs.readFile(args['source-manifest']),freeze=JSON.parse(freezeBytes),repo=freeze.repo,capture=freeze.captureRoot,work=path.resolve(repo,'../work');
if(!args.output||!path.isAbsolute(args.output))throw Error('Fresh absolute parent output required');
const output=path.resolve(args.output),relative=path.relative(work,output);
if(path.isAbsolute(relative)||relative.startsWith('..')||output===work||existsSync(output))throw Error('Fresh parent work output only');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixtureInputs(){return freeze.sources.filter(row=>row.roles.includes('fixture')).map(row=>({file:row.file,bytes:row.bytes,sha256:row.sha256}));}
async function physical(){
 const rows=[];
 for(const row of freeze.sources){const bytes=await fs.readFile(path.join(repo,row.file)),saved=await fs.readFile(path.join(capture,row.file));if(!bytes.equals(saved)||bytes.length!==row.bytes||sha(bytes)!==row.sha256)throw Error('Current/captured input drift: '+row.file);rows.push({file:row.file,bytes:bytes.length,sha256:sha(bytes)});}
 for(const row of freeze.packages){const bytes=await fs.readFile(path.join(repo,row.file));if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)throw Error('Package identity drift: '+row.file);}
 return rows;
}
const before=await physical(),fixtureBefore=await fixtureInputs();await fs.mkdir(output,{recursive:false});const startedAt=new Date().toISOString();
await fs.writeFile(path.join(output,'source-before.json'),JSON.stringify({sources:before,packages:freeze.packages},null,2));
await fs.writeFile(path.join(output,'fixture-before.json'),JSON.stringify(fixtureBefore,null,2));
// Deferred until explicit flag/source preflight. The reused action loader is never copied or modified.
process.env.PAGE_CREATOR_REPO=repo;process.env.PAGE_CREATOR_SOURCE_ROOT=capture;
const {cases,prepareCreatorCase,formCases,createFormCase,controlledFormDelivery}=await import((await import('node:url')).pathToFileURL(path.join(capture,'apps/admin/lib/fixtures/page-creator-cases.mjs')).href);
const native=createRequire(path.join(repo,'package.json')),evaluate=native(path.join(capture,'apps/admin/lib/fixtures/page-creator-original-oracle.cjs'));
const {build}=native('esbuild'),{chromium}=native('playwright');
const sourceMap=new Map(freeze.sources.map(row=>[row.file,row])),browserGraph=new Map(),serverGraph=new Map(),rows=new Map(),results=[],formResults=[],formContexts=new Map();
const pageSource=await fs.readFile(path.join(capture,'apps/admin/app/(dashboard)/pages/page.tsx'),'utf8');
const fieldStart='{canMutate && <CreatePageForm action={createPageAction}>';
const fieldEnd='        </CreatePageForm>}';
if(pageSource.split(fieldStart).length!==2||pageSource.split(fieldEnd).length!==2)throw Error('Actual current creator field boundary changed');
const fieldChildren=pageSource.slice(pageSource.indexOf(fieldStart)+fieldStart.length,pageSource.indexOf(fieldEnd));
await fs.writeFile(path.join(output,'actual-creator-field-children.json'),JSON.stringify({file:'apps/admin/app/(dashboard)/pages/page.tsx',pageSha256:sha(Buffer.from(pageSource)),fieldChildrenSha256:sha(Buffer.from(fieldChildren)),fieldChildren,scope:'Actual server-page JSX children extracted unchanged; standalone component, not full Next Page/Auth execution'},null,2));
const virtual={
 'page-creator-current-field-children':'import React from "react";export function FieldChildren({catalog}){return <>'+fieldChildren+'</>}',

 'next/link':'import React from "react";export default function Link({children,prefetch,...props}){return React.createElement("a",props,children)}',
 'next/navigation':'export {unstable_rethrow} from "next/dist/client/components/unstable-rethrow.browser";export function useRouter(){return{refresh(){throw Error("Unexpected initial refresh")}}}',
 'next/dynamic':'import React from "react";export default function dynamic(loader,options={}){const C=React.lazy(async()=>{const m=await loader();return{default:m.default||m}});return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(C,props))}',
 '@/app/(dashboard)/pages/actions':'export async function savePageAction(data){return window.__m19Creator.unexpectedAction("save",data)}export async function checkPageOperationAction(data){return window.__m19Creator.unexpectedAction("check",data)}',
 '@/app/(dashboard)/editor-links/actions':'export async function searchEditorInternalLinksAction(){throw Error("Links outside this initial-reopen scope")}',
 '@/app/(dashboard)/editor-autosave/actions':'export async function loadLatestEditorAutosaveAction(input){window.__m19Creator.autosave.push({kind:"load",input});return{ok:true,recovery:null}}export async function saveEditorAutosaveAction(input){window.__m19Creator.autosave.push({kind:"save",input});return{ok:false,error:"CONTROLLED_AUTOSAVE_UNAVAILABLE"}}export async function deleteExactEditorAutosaveAction(input){window.__m19Creator.autosave.push({kind:"delete",input});throw Error("Unexpected initial autosave deletion")}',
};
let browser,server,origin,terminalError=null;const cleanup={browserClosed:false,loopbackClosed:false};
try{
 for(const scenario of cases)rows.set(scenario.id,await prepareCreatorCase(scenario));
 for(const id of formCases){const context=createFormCase(id);context.gate=new Promise(resolve=>{context.release=resolve;});formContexts.set(id,context);}
 const bundle=await build({absWorkingDir:repo,entryPoints:[path.join(capture,'apps/admin/tests/browser/fixtures/page-creator-entry.jsx')],nodePaths:[path.join(repo,'node_modules')],bundle:true,write:false,metafile:true,
  format:'iife',platform:'browser',target:'chrome120',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env.ADMIN_BASE_PATH':'"/admin"'},
  plugins:[{name:'strict-current-M19-read-loader-boundary',setup(builder){
   builder.onResolve({filter:/.*/},request=>{
    if(Object.hasOwn(virtual,request.path))return{path:request.path,namespace:'m19-boundary'};
    if(/^react(?:\/|$)|^react-dom(?:\/|$)/u.test(request.path))return{path:native.resolve('next/dist/compiled/'+request.path)};
    if(/@supabase|(?:^|\/)server-only$|\/lib\/auth(?:\.|\/)|\/lib\/supabase\/|^node:/u.test(request.path))throw Error('Forbidden client server/provider import '+request.path);
    if(request.path.startsWith('@/')){const base='apps/admin/'+request.path.slice(2),file=['','.ts','.tsx','.js','.jsx','/index.ts','/index.tsx'].map(suffix=>base+suffix).find(file=>sourceMap.has(file));if(!file)throw Error('Uncaptured local import '+request.path);return{path:path.join(capture,file)};}
   });
   builder.onLoad({filter:/.*/,namespace:'m19-boundary'},request=>({contents:virtual[request.path],loader:request.path==='page-creator-current-field-children'?'jsx':'js',resolveDir:repo}));
   builder.onLoad({filter:/\.[jt]sx?$/},async request=>{
    if(!request.path.startsWith(capture+path.sep))return;const file=path.relative(capture,request.path).replaceAll('\\','/'),binding=sourceMap.get(file);if(!binding)throw Error('Uncaptured relative source '+file);
    const bytes=await fs.readFile(request.path);if(bytes.length!==binding.bytes||sha(bytes)!==binding.sha256)throw Error('Captured source drift '+file);
    if(/^["']use server["'];/u.test(bytes.toString().trimStart()))throw Error('Unmocked server action in browser '+file);
    browserGraph.set(file,{file,bytes:bytes.length,sha256:sha(bytes),role:'actual-browser-runtime'});
    return{contents:bytes.toString(),loader:request.path.endsWith('tsx')?'tsx':request.path.endsWith('jsx')?'jsx':request.path.endsWith('ts')?'ts':'js'};
   });
   builder.onLoad({filter:/\.css$/},()=>({contents:'export default {}',loader:'js'}));
  }}]});
 const code=bundle.outputFiles[0].text;await fs.writeFile(path.join(output,'bundle.js'),code);await fs.writeFile(path.join(output,'bundle-metafile.json'),JSON.stringify(bundle.metafile,null,2));
 const vendorInputs=[];
 for(const name of Object.keys(bundle.metafile.inputs)){
  if(name.startsWith('m19-boundary:'))continue;
  const file=path.isAbsolute(name)?name:path.resolve(repo,name);
  if(file.startsWith(capture+path.sep)||file.startsWith(here+path.sep)||!existsSync(file))continue;
  const bytes=await fs.readFile(file);vendorInputs.push({file:path.relative(repo,file).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)});
 }
 await fs.writeFile(path.join(output,'actual-bundle-vendor-inputs.json'),JSON.stringify(vendorInputs,null,2));
 server=http.createServer(async(request,response)=>{
  try{
   const url=new URL(request.url,'http://127.0.0.1');
   if(request.method==='POST'&&url.pathname==='/create'){
    const context=formContexts.get(url.searchParams.get('case'));if(!context)throw Error('Unknown finite form case');
    let body='';for await(const bytes of request){body+=bytes;if(body.length>8*1024*1024)throw Error('Oversized form transport');}
    const fields=JSON.parse(body);const record={fields,receivedAt:new Date().toISOString(),actualResult:null,deliveredResult:null,nativeRedirect:null,delivery:null};context.transport.push(record);
    try{record.actualResult=await context.runtime.create(fields);}
    catch(error){const native=createRequire(path.join(repo,'package.json'));if(!native('next/dist/client/components/redirect-error').isRedirectError(error))throw error;record.nativeRedirect={digest:error.digest,url:native('next/dist/client/components/redirect').getURLFromRedirectError(error)};}
    if(context.scenario==='committed-response-lost'){
      if(!record.nativeRedirect||context.runtime.trace.createPayloads.length!==1)throw Error('Lost-response control must first execute actual successful create');
      record.delivery='CONTROLLED_ACCEPTED_CREATE_RESPONSE_LOST';
    }else{
      if(record.actualResult?.outcome!=='rejected'||record.actualResult.reason!=='content'||context.runtime.trace.createPayloads.length!==0)throw Error('Malformed delivery controls require actual known pre-insert refusal');
      record.deliveredResult=controlledFormDelivery(context.scenario,record.actualResult);record.delivery='ACTUAL_RESULT_OR_LABELLED_MALFORMED_CLIENT_DELIVERY';
    }
    if(context.transport.length===1){context.ready=true;await context.gate;}
    record.deliveredAt=new Date().toISOString();
    response.writeHead(context.scenario==='committed-response-lost'?503:200,{'content-type':'application/json','cache-control':'no-store'});
    response.end(JSON.stringify(context.scenario==='committed-response-lost'?{ok:false,error:'Controlled accepted create response delivery lost'}:{ok:true,result:record.deliveredResult}));return;
   }
   if(request.method==='GET'&&url.pathname==='/bundle.js'){response.writeHead(200,{'content-type':'text/javascript'});response.end(code);return;}
   if(request.method==='GET'&&url.pathname==='/fixture'){
    const prepared=rows.get(url.searchParams.get('case'));if(!prepared)throw Error('Unknown finite case');response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(prepared.row));return;
   }
   if(request.method==='POST'&&url.pathname==='/unexpected-editor-action'){
    const prepared=rows.get(url.searchParams.get('case'));if(!prepared)throw Error('Unknown case');let raw='';for await(const bytes of request){raw+=bytes;if(raw.length>8*1024*1024)throw Error('Oversized unexpected action');}
    prepared.trace.browserActionCalls.push({kind:url.searchParams.get('kind'),fields:JSON.parse(raw)});response.writeHead(409);response.end('Unexpected initial canonical action');return;
   }
   if(request.method==='GET'&&url.pathname==='/'){response.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});response.end('<!doctype html><meta charset="utf-8"><style>body{font-family:Arial}.ProseMirror{border:1px solid;min-height:80px;padding:8px}</style><div id="root"></div><script src="/bundle.js"></script>');return;}
   response.writeHead(404);response.end();
  }catch(error){response.writeHead(500);response.end(JSON.stringify({name:error.name,message:error.message}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 const executablePath=args.chrome||'C:/Program Files/Google/Chrome/Application/chrome.exe';if(!existsSync(executablePath))throw Error('Installed Chrome unavailable; no install is performed');
 browser=await chromium.launch({headless:true,executablePath});
 for(const scenario of cases){
  const prepared=rows.get(scenario.id),context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block'}),pageErrors=[],consoleErrors=[],externalRequests=[];
  let observation={pageErrors,externalRequests},executionError=null;
  try{
   await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();externalRequests.push({url:route.request().url(),method:route.request().method()});return route.abort('blockedbyclient');});
   await context.addInitScript(scenario=>{
    window.__m19ActiveMarkupProbe=0;
    const h=window.__m19Creator={scenario,autosave:[],entryLoaded:false};
    h.unexpectedAction=async(kind,data)=>{await fetch('/unexpected-editor-action?case='+encodeURIComponent(scenario)+'&kind='+kind,{method:'POST',body:JSON.stringify([...data.entries()])});throw Error('No initial editor save/check is permitted');};
   },scenario.id);
   const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>pageErrors.push({name:error.name,message:error.message}));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
   await page.goto(origin+'/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__m19Creator.entryLoaded||window.__m19Creator.entryError);
   await page.waitForFunction(()=>Boolean(document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('[data-m19-read-unavailable]')));
   observation={...await page.evaluate(()=>{
    const h=window.__m19Creator,editor=document.querySelector('.ProseMirror[contenteditable="true"]');
    const htmlParagraphs=html=>[...new DOMParser().parseFromString(html,'text/html').body.querySelectorAll(':scope > p')].map(node=>node.textContent);
    const jsonParagraphs=value=>Array.isArray(value?.content)?value.content.filter(node=>node.type==='paragraph').map(node=>(node.content||[]).map(part=>part.text||'').join('')):null;
    const hiddenHTML=document.querySelector('[name="content_html"]')?.value??null,hiddenJSON=document.querySelector('[name="content_json"]')?.value??null;
    return{readValidation:h.readValidation,entryError:h.entryError||null,reactVersion:h.reactVersion,editorAvailable:Boolean(editor),guardUnavailable:Boolean(document.querySelector('[data-m19-read-unavailable]')),
     storedHTMLParagraphs:htmlParagraphs(h.row.content_html),storedJSONParagraphs:jsonParagraphs(h.row.content_json),
     editorParagraphs:editor?[...editor.querySelectorAll(':scope > p')].map(node=>node.textContent):null,
     hiddenHTMLParagraphs:hiddenHTML===null?null:htmlParagraphs(hiddenHTML),hiddenJSONParagraphs:hiddenJSON===null?null:jsonParagraphs(JSON.parse(hiddenJSON)),
     bodyText:document.body.innerText,hiddenHTML,hiddenJSON,dirty:document.body.innerText.includes('Есть несохранённые изменения'),
     activeMarkupProbe:window.__m19ActiveMarkupProbe,editorScriptNodes:editor?.querySelectorAll('script').length||0,editorEmNodes:editor?.querySelectorAll('em').length||0,
     autosave:h.autosave};
   }),pageErrors,externalRequests,executionError:null};
  }catch(error){executionError={name:error.name,message:error.message,stack:error.stack};observation={...observation,pageErrors,externalRequests,executionError};}
  finally{
   const checks=executionError?[{name:'finite actual creator/reopen observation completes',pass:false,classification:'EXECUTION_OR_OBSERVER_FAILURE_REQUIRES_CLASSIFICATION',details:executionError}]:evaluate(scenario,prepared,observation);
   results.push({scenario,checks,observation,consoleErrors,creationAndRead:prepared.trace,actualServerTrace:prepared.runtime.trace,controlledPersistedRow:prepared.row});
   for(const [file,row]of prepared.runtime.graph)serverGraph.set(file,row);await context.close();
  }
 }
 for(const id of formCases){
  const prepared=formContexts.get(id),context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block'}),checks=[],pageErrors=[],consoleErrors=[],externalRequests=[];
  const check=(name,pass,details)=>checks.push({name,pass:Boolean(pass),...(details===undefined?{}:{details})});
  let initial=null,pending=null,final=null,second=null,executionError=null;
  try{
   await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();externalRequests.push({url:route.request().url(),method:route.request().method()});return route.abort('blockedbyclient');});
   await context.addInitScript(id=>{
    const h=window.__m19Creator={scenario:id,mode:'form',calls:[],resets:[],autosave:[],entryLoaded:false};
    h.createAction=async data=>{const call={fields:[...data.entries()],state:'pending'};h.calls.push(call);
      const response=await fetch('/create?case='+encodeURIComponent(id),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(call.fields)});
      const body=await response.json();if(!response.ok||!body.ok){call.state='transport-error';throw new Error(body.error||'Controlled create transport failed');}
      call.state='returned';call.result=body.result;return body.result;};
   },id);
   const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>pageErrors.push({name:error.name,message:error.message}));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
   await page.goto(origin+'/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__m19Creator.entryLoaded||window.__m19Creator.entryError);
   await page.locator('form textarea[name="content"]').waitFor();
   await page.evaluate(()=>document.querySelector('form').addEventListener('reset',event=>queueMicrotask(()=>window.__m19Creator.resets.push({defaultPrevented:event.defaultPrevented})),true));
   const captureForm=()=>page.evaluate(()=>({fields:[...new FormData(document.querySelector('form')).entries()],buttonDisabled:document.querySelector('button[type="submit"]').disabled,
     text:document.body.innerText,calls:window.__m19Creator.calls,resets:window.__m19Creator.resets,reactVersion:window.__m19Creator.reactVersion}));
   await page.locator('[name="title"]').fill('Exact original form title '+id);await page.locator('[name="slug"]').fill('exact-form-'+id);
   await page.locator('[name="excerpt"]').fill('Exact original form excerpt '+id);
   await page.locator('[name="content"]').fill(id==='committed-response-lost'?'Exact accepted paragraph.\n\nExact accepted second paragraph.':'&'.repeat(400000));
   initial=await captureForm();
   check('actual original creator field children and all catalog values are present',JSON.stringify(initial.fields.map(([name])=>name).sort())===JSON.stringify(['catalog_page','catalog_q','catalog_status','content','excerpt','slug','title'].sort()));
   check('no initial create or canonical SDK mutation',prepared.runtime.trace.actionCalls.length===0&&prepared.runtime.trace.createPayloads.length===0);
   await page.getByRole('button',{name:'Создать черновик',exact:true}).click();
   const until=Date.now()+5000;while(!prepared.ready){if(Date.now()>until)throw Error('Actual create bridge did not reach held first response');await new Promise(resolve=>setTimeout(resolve,20));}
   await page.waitForFunction(()=>document.querySelector('button[type="submit"]').disabled&&document.body.innerText.includes('Создание черновика...'));
   pending=await captureForm();
   check('actual CreatePageForm is visibly pending before response',pending.buttonDisabled&&pending.calls[0].state==='pending');
   check('actual submitted FormData retains ALL original fields',JSON.stringify(prepared.transport[0].fields)===JSON.stringify(initial.fields));
   prepared.release();
   await page.waitForFunction(()=>window.__m19Creator.calls[0].state!=='pending');
   await page.getByRole('alert').waitFor();await page.waitForFunction(()=>window.__m19Creator.resets.length>0);
   final=await captureForm();
   check('native React reset was actually prevented',final.resets.length>0&&final.resets.every(row=>row.defaultPrevented));
   check('ALL author and hidden catalog fields remain exact',JSON.stringify(final.fields)===JSON.stringify(initial.fields));
   if(id==='known-content-refusal'){
    check('known actual pre-insert rejection is shown inline',prepared.transport[0].actualResult.outcome==='rejected'&&final.text.includes(prepared.transport[0].actualResult.message)&&!final.buttonDisabled);
    check('known content rejection performed no insert audit or outbox write',prepared.runtime.trace.createPayloads.length===0&&prepared.runtime.trace.audit.length===0&&prepared.runtime.trace.enqueue.length===0);
    await page.locator('[name="title"]').fill('Exact corrected title retained');await page.locator('[name="content"]').fill('&'.repeat(400001));
    const beforeAgain=await captureForm();await page.getByRole('button',{name:'Создать черновик',exact:true}).click();
    await page.waitForFunction(()=>window.__m19Creator.calls.length===2&&window.__m19Creator.calls[1].state!=='pending'&&window.__m19Creator.resets.length===2);
    second=await captureForm();
    check('known no-write refusal permits an explicit corrected attempt retaining ALL fields',prepared.transport.length===2&&JSON.stringify(second.fields)===JSON.stringify(beforeAgain.fields)&&!second.buttonDisabled);
    check('second known refusal still has zero canonical audit or outbox writes',prepared.runtime.trace.createPayloads.length===0&&prepared.runtime.trace.audit.length===0&&prepared.runtime.trace.enqueue.length===0);
   }else{
    check('malformed or unknown delivery causes a visible no-retry hold',final.buttonDisabled&&final.text.includes('Результат создания не подтверждён'));
    const count=prepared.transport.length;await page.evaluate(()=>document.querySelector('form').requestSubmit());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    const afterBlocked=await captureForm();check('actual attempted resubmit is blocked with ALL fields intact',prepared.transport.length===count&&JSON.stringify(afterBlocked.fields)===JSON.stringify(initial.fields));
    if(id==='committed-response-lost')check('lost response follows one actual accepted create with no duplicate',prepared.transport[0].nativeRedirect&&prepared.runtime.trace.createPayloads.length===1&&prepared.runtime.trace.actionCalls.length===1);
    else check('malformed reply control starts from genuine known zero-write rejection',prepared.transport[0].actualResult.outcome==='rejected'&&prepared.runtime.trace.createPayloads.length===0&&prepared.runtime.trace.audit.length===0&&prepared.runtime.trace.enqueue.length===0);
   }
   check('installed Next React rendered the actual component',final.reactVersion?.startsWith('19.'));
   check('no actual component or undeclared network error',pageErrors.length===0&&externalRequests.length===0&&prepared.runtime.trace.external.length===0&&prepared.runtime.trace.protocolErrors.length===0);
  }catch(error){executionError={name:error.name,message:error.message,stack:error.stack};checks.push({name:'actual form finite controls complete',pass:false,classification:'EXECUTION_OR_OBSERVER_FAILURE_REQUIRES_CLASSIFICATION',details:executionError});}
  finally{prepared.release();formResults.push({scenario:id,checks,initial,pending,final,second,transport:prepared.transport,actualServerTrace:prepared.runtime.trace,pageErrors,consoleErrors,externalRequests,executionError});for(const[file,row]of prepared.runtime.graph)serverGraph.set(file,row);await context.close();}
 }
}catch(error){terminalError={name:error.name,message:error.message,stack:error.stack};}
finally{
 if(browser){await browser.close();cleanup.browserClosed=true;}
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));cleanup.loopbackClosed=true;}
}
let after=[],fixtureAfter=[],driftError=null;try{after=await physical();fixtureAfter=await fixtureInputs();}catch(error){driftError={name:error.name,message:error.message};}
await fs.writeFile(path.join(output,'source-after.json'),JSON.stringify({sources:after,error:driftError},null,2));
await fs.writeFile(path.join(output,'fixture-after.json'),JSON.stringify({inputs:fixtureAfter,error:driftError},null,2));
const coreChecks=results.flatMap(row=>row.checks),formChecks=formResults.flatMap(row=>row.checks),checks=[...coreChecks,...formChecks],report={classification:'GENUINE_CURRENT_CREATOR_READ_GUARD_LOADER_CONTROLLED_AFTER_NO_RAW_MOUNT_OR_DATA_LOSS_INFERENCE',startedAt,endedAt:new Date().toISOString(),sourceFingerprint:freeze.sourceFingerprint,freezeSha256:sha(freezeBytes),cases:results.length,expectedCases:cases.length,checks:checks.length,passed:checks.filter(check=>check.pass).length,failed:checks.filter(check=>!check.pass).length,terminalError,driftError,cleanup,results,formResults,originalCreatorScope:{cases:results.length,checks:coreChecks.length,passed:coreChecks.filter(row=>row.pass).length,failed:coreChecks.filter(row=>!row.pass).length},additiveFormScope:{cases:formResults.length,plannedCases:formCases.length,checks:formChecks.length,passed:formChecks.filter(row=>row.pass).length,failed:formChecks.filter(row=>!row.pass).length},
 browserSources:[...browserGraph.values()],serverSources:[...serverGraph.values()],guardQualifier:freeze.guardQualifier,
 limits:['Two actual creator action/SDK cases plus one coherent synthetic-row positive control; no fabricated successful creator receipt.','Actual bundle/read guard and PageEditorLoader decide availability. A refused creator row is guarded unavailability/incoherence, not established source data loss.','Installed SDK reads synthetic persistence; actual Next route query-builder/managedAuth/PostgREST/nativeDB are not executed.','No initial save/check is requested. Browser action boundary records/refuses attempted unexpected writes rather than silently mocking success.']};
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
const verdict=!terminalError&&!driftError&&results.length===cases.length&&formResults.length===formCases.length&&report.failed===0&&cleanup.browserClosed&&cleanup.loopbackClosed;
const bytes=await fs.readFile(path.join(output,'report.json')),receipt={classification:verdict?'CONTROLLED_AFTER_FINITE_ORACLES_PASS':'CONTROLLED_AFTER_REQUIRES_CLASSIFICATION_NOT_AUTOMATIC_DEFECT_PROOF',report:{bytes:bytes.length,sha256:sha(bytes)},cases:results.length+formResults.length,originalCases:results.length,additiveFormCases:formResults.length,checks:checks.length,passed:report.passed,failed:report.failed,terminalError,driftError,cleanup};
await fs.writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2));process.stdout.write(JSON.stringify({output,...receipt})+'\n');process.exitCode=terminalError||driftError?2:verdict?0:1;
