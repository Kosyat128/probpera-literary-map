// Actual Next React hydration + real Page/FormData/action/coordinator/SDK.
// Only Auth/DB/external deployment transport is controlled. Explicit local run.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import crypto from 'node:crypto';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),get=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
if(!args.includes('--execute-controlled'))throw Error('Explicit released execution required');
if(!get('--dependency-root')||!get('--output'))throw Error('Dependency root and fresh output required');
const dependencyRoot=path.resolve(get('--dependency-root')),sourceRoot=path.resolve(get('--source-root')||dependencyRoot),output=path.resolve(get('--output'));
if(!output.startsWith(path.resolve(dependencyRoot,'../work')+path.sep)||fs.existsSync(output))throw Error('Unsafe/existing parent output');
const here=path.dirname(fileURLToPath(import.meta.url)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),native=createRequire(path.join(dependencyRoot,'package.json'));
process.env.PUBLICATION_RETRY_REPO=dependencyRoot;process.env.PUBLICATION_RETRY_SOURCE_ROOT=sourceRoot;
const runtimePath=path.join(sourceRoot,'apps/admin/lib/fixtures/publication-retry-runtime.cjs');
const {createPublicationRetryRuntime,captureSources}=native(runtimePath),{build}=native('esbuild'),{chromium}=native('playwright');
const component='apps/admin/app/(dashboard)/publication/PublicationRetryForm.tsx',entry=path.join(here,'publication-retry-entry.jsx');
const browserGraph=new Map(),vendorGraph=new Map();
const bundle=await build({absWorkingDir:dependencyRoot,entryPoints:[entry],bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'strict-publication-retry-client',setup(builder){
  builder.onResolve({filter:/.*/},request=>{
    if(/^react(?:\/|$)|^react-dom(?:\/|$)/u.test(request.path))return{path:native.resolve('next/dist/compiled/'+request.path)};
    if(request.path.startsWith('@/')){const file='apps/admin/'+request.path.slice(2)+'.tsx';if(file!==component)throw Error('Unexpected client app dependency '+file);return{path:path.join(sourceRoot,file)};}
    if(/^node:|@supabase|\/lib\/auth|\/lib\/supabase/u.test(request.path))throw Error('Server/provider dependency cannot enter browser');
  });
  builder.onLoad({filter:/\.[jt]sx?$/},request=>{
    if(request.path===entry)return{contents:fs.readFileSync(entry,'utf8'),loader:'jsx',resolveDir:here};
    if(request.path.startsWith(path.join(dependencyRoot,'node_modules')+path.sep)){const b=fs.readFileSync(request.path);vendorGraph.set(request.path,{file:path.relative(dependencyRoot,request.path).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)});return;}
    if(!request.path.startsWith(sourceRoot+path.sep))throw Error('Unexpected non-vendor browser dependency '+request.path);
    const file=path.relative(sourceRoot,request.path).replaceAll('\\','/');if(file!==component)throw Error('Uncaptured local client dependency '+file);
    const b=fs.readFileSync(request.path);browserGraph.set(file,{file,bytes:b.length,sha256:sha(b)});return{contents:b.toString(),loader:'tsx'};
  });
}}]});
fs.mkdirSync(output);const code=bundle.outputFiles[0].text;fs.writeFileSync(path.join(output,'bundle.js'),code);
const packages=['next','esbuild','playwright','typescript','@supabase/supabase-js'].map(name=>{const b=fs.readFileSync(path.join(dependencyRoot,'node_modules',name,'package.json'));return{name,version:JSON.parse(b).version,sha256:sha(b)};});
const fixtureSources=[entry,fileURLToPath(import.meta.url),runtimePath].map(file=>{const b=fs.readFileSync(file);return{file:path.relative(sourceRoot,file).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)};});
let current=null;const blockedExternal=[],results=[];
function fromForm(form){return{outboxId:form.get('outbox_id'),operationId:form.get('retry_operation_id'),expectedUpdatedAt:form.get('expected_updated_at')};}
function json(res,value,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
const server=http.createServer(async(req,res)=>{
  const state=current;try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='GET'&&url.pathname==='/bundle.js'){res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});res.end(code);return;}
    if(req.method==='GET'&&url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
    if(req.method==='GET'&&url.pathname==='/'){
      const bootstrap=JSON.stringify(state.bootstrap).replaceAll('<','\\u003c');
      res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<!doctype html><meta charset="utf-8"><main><label>Editor source<textarea aria-label="Editor source">Exact manually authored source remains unchanged.</textarea></label><div id="publication-retry-root">'+state.formHtml+'</div></main><script type="application/json" id="publication-retry-bootstrap">'+bootstrap+'</script><script src="/bundle.js"></script>');return;
    }
    if(req.method==='POST'&&url.pathname==='/_fixture/retry'){
      let body='';for await(const chunk of req){body+=chunk;if(body.length>16000)throw Error('Oversized controlled form');}
      const form=new FormData();for(const[key,value]of new URLSearchParams(body))form.append(key,value);
      const posted={entries:[...form.entries()],externalBefore:state.runtime.trace.external.length,result:null};state.bridge.push(posted);
      posted.result=await state.runtime.action(form);posted.externalAfter=state.runtime.trace.external.length;
      if(state.bridge.length===1){state.firstResult=posted.result;await new Promise(resolve=>{state.release=resolve;});}
      json(res,posted.result);return;
    }
    throw Error('Unexpected controlled local HTTP route '+req.method+' '+url.pathname);
  }catch(error){state?.serverErrors.push(String(error.stack||error));if(!res.headersSent)json(res,{error:'Controlled bridge failed'},500);else res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:get('--chrome')||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const scenarios=[
  {name:'known accepted start and confirmed mark',options:{},first:'started',persistence:'confirmed',external:1},
  {name:'known accepted start with failed mark remains truthful',options:{markError:true},first:'started',persistence:'unconfirmed',external:1},
  {name:'external acknowledgement is unknown and cannot be repeated',options:{externalThrows:true},first:'queued',external:1},
  {name:'committed admission lost acknowledgement never starts blindly',options:{admissionAckLost:true},first:'unconfirmed',external:0},
  {name:'native observes active source after original Page read',options:{beforeAdmit:({rows})=>{rows.get('42').status='dispatched';}},first:'observed',outcome:'active',external:0},
  {name:'native observes completed source after original Page read',options:{beforeAdmit:({rows})=>{rows.get('42').status='deployed';}},first:'observed',outcome:'complete',external:0},
  {name:'native observes a one-microsecond stale source version',options:{beforeAdmit:({rows})=>{rows.get('42').updated_at='2026-10-30T12:34:56.123457+00:00';}},first:'observed',outcome:'stale',external:0},
];
try{for(const scenario of scenarios){
  const runtime=createPublicationRetryRuntime(scenario.options),checks=[],check=(name,pass,detail)=>checks.push({name,pass:Boolean(pass),...(detail===undefined?{}:{detail})});
  const originalPage=await runtime.page(),form=runtime.forms(originalPage)[0],nextPage=await runtime.page(),unrelatedForm=runtime.forms(nextPage)[0];
  if(!form||!unrelatedForm)throw Error('Actual Page did not render an eligible retry form');
  const request=fromForm(form),unrelatedRequest=fromForm(unrelatedForm),node=originalPage.$('form').filter((_i,element)=>originalPage.$(element).find('input[name="retry_operation_id"]').length===1).first();
  current={name:scenario.name,runtime,formHtml:originalPage.$.html(node),bootstrap:{request,unrelatedRequest,catalog:{term:form.get('catalog_q')||'',status:form.get('catalog_status')||'',page:Number(form.get('catalog_page')||1)}},bridge:[],serverErrors:[],release:null,firstResult:null};
  const state=current,context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(5000);const pageErrors=[],consoleErrors=[];
  page.on('pageerror',error=>pageErrors.push({name:error.name,message:error.message}));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/'))return route.continue();blockedExternal.push({scenario:scenario.name,url});return route.abort('blockedbyclient');});
  let failure=null;
  try{
    await page.goto(origin);await page.waitForFunction(()=>window.__publicationRetryClient?.hydrated===true);
    const fields=()=>page.locator('#publication-retry-root form').evaluate(element=>Object.fromEntries(new FormData(element)));
    const initial=await fields();check('actual hydrated form preserves the real SSR nonce and raw microsecond token',initial.retry_operation_id===request.operationId&&initial.expected_updated_at===runtime.stamp&&initial.outbox_id===request.outboxId);
    check('unrelated parent props originate from a distinct real server nonce',unrelatedRequest.operationId!==request.operationId&&unrelatedRequest.expectedUpdatedAt===request.expectedUpdatedAt);
    await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#publication-retry-root button')?.disabled===true);
    check('actual useActionState disables the pending submit button',await page.locator('#publication-retry-root button').isDisabled());
    await page.evaluate(()=>window.__publicationRetryClient.rerender());await page.waitForFunction(()=>window.__publicationRetryClient.parentRevision===1);
    check('pending unrelated parent rerender cannot replace original nonce or raw token',JSON.stringify(await fields())===JSON.stringify(initial));
    await page.locator('#publication-retry-root button').evaluate(button=>button.click());await page.waitForTimeout(60);
    check('disabled pending submit creates no second action request',state.bridge.length===1);
    if(!state.release)await page.waitForFunction(()=>window.__publicationRetryClient.posts.length===1);
    // Action work is real and already running; wait for its actual returned result
    // before releasing only the local response transport.
    const waitStart=Date.now();while(!state.release){if(Date.now()-waitStart>5000)throw Error('Actual action result did not reach bridge');await new Promise(resolve=>setTimeout(resolve,10));}
    state.release();state.release=null;
    await page.getByRole('status').waitFor();await page.waitForFunction(()=>document.querySelector('#publication-retry-root button')?.disabled===false);
    const firstText=await page.getByRole('status').textContent(),firstResult=state.firstResult;
    check('actual client renders the trusted actual action result',firstText===firstResult.message&&firstResult.state===scenario.first,{state:firstResult.state,text:firstText});
    if(scenario.persistence)check('known accepted start preserves precise mark persistence',firstResult.dispatchPersistence===scenario.persistence);
    if(scenario.outcome)check('native observation keeps its actual outcome',firstResult.outcome===scenario.outcome);
    check('message never claims this command publicly completed the site',!/сайт опубликован|публичная версия подтверждена|публикация подтверждена/iu.test(firstText));
    check('known start is claimed only for an accepted actual action result',firstResult.state==='started'?firstText.includes('Провайдер принял запуск'):!firstText.includes('Провайдер принял запуск'));
    await page.evaluate(()=>window.__publicationRetryClient.rerender());await page.waitForFunction(()=>window.__publicationRetryClient.parentRevision===2);
    check('completed action and later unrelated rerender retain identical form intent',JSON.stringify(await fields())===JSON.stringify(initial));
    await page.getByRole('button',{name:'Проверить это намерение',exact:true}).click();await page.waitForFunction(()=>window.__publicationRetryClient.results.length===2);
    await page.waitForFunction(()=>document.querySelector('#publication-retry-root button')?.disabled===false);
    check('both actual POSTs carry the same server-generated three identity fields',state.bridge.length===2&&state.bridge.every(post=>{const value=Object.fromEntries(post.entries);return value.retry_operation_id===request.operationId&&value.expected_updated_at===request.expectedUpdatedAt&&value.outbox_id===request.outboxId;}));
    check('replaying the same intention never repeats external deployment HTTP',runtime.trace.external.length===scenario.external&&state.bridge[1].externalBefore===state.bridge[1].externalAfter,{external:runtime.trace.external.length});
    check('ordinary generic enqueue is never used for retry',!runtime.trace.rpc.some(row=>row.name==='enqueue_public_build_request'));
    check('actual editor input is preserved through hydration and both action results',await page.getByRole('textbox',{name:'Editor source'}).inputValue()==='Exact manually authored source remains unchanged.');
    check('browser and controlled boundaries complete without hidden errors',pageErrors.length===0&&consoleErrors.length===0&&state.serverErrors.length===0&&runtime.trace.protocolErrors.length===0&&!blockedExternal.some(row=>row.scenario===scenario.name),{pageErrors,consoleErrors,serverErrors:state.serverErrors});
  }catch(error){failure={name:error.name,message:error.message};check('client scenario reaches its observation boundary',false,failure);}finally{state.release?.();await context.close();}
  results.push({name:scenario.name,checks,failure,sourceRequest:request,unrelatedServerRequest:unrelatedRequest,firstResult:state.firstResult,bridge:state.bridge,trace:runtime.trace,pageErrors,consoleErrors,serverErrors:state.serverErrors});
}}finally{current?.release?.();await browser.close();await new Promise(resolve=>server.close(resolve));}
const sources=captureSources(path.join(output,'actual-server-sources')),all=results.flatMap(row=>row.checks);
const drift=[...browserGraph.values(),...fixtureSources].filter(row=>{const b=fs.readFileSync(path.join(sourceRoot,row.file));return sha(b)!==row.sha256;});
const report={classification:'ACTUAL_PUBLICATION_RETRY_FORM_HYDRATION_AND_REAL_PAGE_POST_ACTION_SDK_CONTROLLED_TRANSPORT_NOT_NATIVE_OR_NEXT_RSC_E2E',checkedAt:new Date().toISOString(),results,browserSourceGraph:[...browserGraph.values()],serverSourceGraph:sources.sources,fixtureSources,vendorSourceGraph:[...vendorGraph.values()],packages,sourceDrift:drift,blockedExternal,
  summary:{scenarios:results.length,checks:all.length,passed:all.filter(row=>row.pass).length,failed:all.filter(row=>!row.pass).length,executionFailures:results.filter(row=>row.failure).length},
  scope:['Actual installed Next React hydration and actual PublicationRetryForm. Bootstrap identities come from the actual Page SSR, then actual FormData reaches actual retryAction/coordinator/installed SDK through a local HTTP bridge.','The bridge is controlled transport, not an actual Next RSC/server-action endpoint, managed Auth/PostgREST or native SQL. Native proof is independently owned.','The first local response is deferred only after actual action work returns, to inspect actual useActionState pending behavior. Action result values are never synthesized by the browser fixture.','Synthetic DB/deployment transport only; no external network, provider credentials, live deployment, lease/worker/exactly-once or full R3 acceptance claim.'],realProviderCalls:0,nativeConnections:0};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,summary:report.summary,sourceDrift:drift.length}));process.exitCode=report.summary.failed||drift.length?1:0;
