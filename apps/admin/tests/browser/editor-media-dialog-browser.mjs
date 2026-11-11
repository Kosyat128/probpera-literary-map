// Actual EditorMediaDialog + GET/installed-SDK controlled browser regression. Explicit execution only.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import crypto from 'node:crypto';import{createRequire}from'node:module';import{fileURLToPath}from'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),args=process.argv.slice(2),get=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];},hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(!args.includes('--execute-controlled')){console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',builds:0,browsers:0,scenarios:0}));process.exit(0);}
if(!get('--dependency-root')||!get('--output'))throw Error('Require installed --dependency-root and fresh --output');
const dependencyRoot=path.resolve(get('--dependency-root')),sourceRoot=path.resolve(get('--source-root')||dependencyRoot),output=path.resolve(get('--output'));
const work=path.resolve(dependencyRoot,'../work');
if(!output.startsWith(work+path.sep)||fs.existsSync(output))throw Error('Unsafe or existing parent output');
const files=['apps/admin/components/EditorMediaDialog.tsx','apps/admin/components/useEditorDialogFocus.ts','apps/admin/lib/admin-path.ts','apps/admin/lib/editor-media-assets-contract.ts','apps/admin/app/api/media/assets/route.ts'];
const manifest={classification:'CURRENT_ACTUAL_MEDIA_COMPONENT_ROUTE_SDK_CONTROLLED_BROWSER_NOT_DB_RLS_FULL_EDITOR_SAVE_OR_REAL_UPLOAD',files:files.map(file=>{const b=fs.readFileSync(path.join(sourceRoot,file));return{file,bytes:b.length,sha256:hash(b),role:'actual-runtime-source'};}),limitations:[
 'Actual component, focus hook, API route and installed SDK through controlled permitted-asset transport. No database/RLS or full editor persisted-reference claim.',
 'Original twelve BEFORE scenario inputs and target/control assertions retained. Only bounded wire control is adapted from <=60 to <=61 for legitimate single-row lookahead; UI remains <=60.',
 'Queue-done refresh uses the real existing signal with a synthetic confirmed transport row, not an actual upload workflow. T11 actual upload and T12 native concurrent availability remain separate.',
 'No author text, protected normalizer, provider network, production service, commit or deployment.'
]};
const captured=new Map(manifest.files.map(row=>[row.file,row]));
const require=createRequire(path.join(dependencyRoot,'package.json'));
manifest.packages=['@supabase/supabase-js','typescript','next','esbuild','playwright'].map(name=>{const b=fs.readFileSync(path.join(dependencyRoot,'node_modules',name,'package.json'));return{name,version:JSON.parse(b).version,sha256:hash(b)};});
const{build}=require('esbuild'),{chromium}=require('playwright');
const runtimeFile=path.join(sourceRoot,'apps/admin/lib/fixtures/editor-media-dialog-runtime.cjs'),{createMediaRouteRuntime}=require(runtimeFile);
manifest.controlledTransport={file:'apps/admin/lib/fixtures/editor-media-dialog-runtime.cjs',bytes:fs.statSync(runtimeFile).size,sha256:hash(fs.readFileSync(runtimeFile))};
manifest.entrySha256=hash(fs.readFileSync(path.join(here,'editor-media-dialog-entry.jsx')));
manifest.producerSha256=hash(fs.readFileSync(fileURLToPath(import.meta.url)));
const graph=new Map(),entry=path.join(here,'editor-media-dialog-entry.jsx');
const bundle=await build({absWorkingDir:dependencyRoot,entryPoints:[entry],bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'strict-captured-media-source',setup(builder){
  builder.onResolve({filter:/.*/},request=>{
    if(/^react(?:\/|$)|^react-dom(?:\/|$)/u.test(request.path))return{path:require.resolve('next/dist/compiled/'+request.path)};
    if(request.path.startsWith('@/')){const name='apps/admin/'+request.path.slice(2),file=[name,name+'.ts',name+'.tsx'].find(file=>captured.get(file)?.role==='actual-runtime-source');if(!file)throw Error('Uncaptured local browser source '+request.path);return{path:path.join(sourceRoot,file)};}
    if(/^node:|@supabase|\/lib\/auth|\/lib\/supabase/u.test(request.path))throw Error('Server/provider import forbidden in browser');
  });
  builder.onLoad({filter:/\.[jt]sx?$/},request=>{
    if(request.path===entry){const bytes=fs.readFileSync(entry);if(hash(bytes)!==manifest.entrySha256)throw Error('Entry changed');return{contents:bytes.toString(),loader:'jsx',resolveDir:here};}
    if(request.path.startsWith(path.join(dependencyRoot,'node_modules')+path.sep))return;
    if(!request.path.startsWith(sourceRoot+path.sep))return;
    const file=path.relative(sourceRoot,request.path).replaceAll('\\','/'),bytes=fs.readFileSync(request.path),row=captured.get(file);
    if(!row||hash(bytes)!==row.sha256)throw Error('Uncaptured source/changed dependency '+file);graph.set(file,{file,sha256:hash(bytes),bytes:bytes.length});return{contents:bytes.toString(),loader:file.endsWith('tsx')?'tsx':'ts'};
  });
}}]});
fs.mkdirSync(output);fs.writeFileSync(path.join(output,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');const bundleCode=bundle.outputFiles[0].text;fs.writeFileSync(path.join(output,'bundle.js'),bundleCode);
let current=null,releaseOld=null;const apiResponses=[],external=[];
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/bundle.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(bundleCode);return;}
  if(url.pathname==='/api/media/assets'){
    const response=await current.runtime.handle(new Request('http://127.0.0.1'+req.url)),actual=await response.text();let body=actual;
    if(current.mode==='missing-assets')body=JSON.stringify({ok:true});
    if(current.mode==='invalid-asset')body=JSON.stringify({ok:true,assets:[{id:'malformed-record',src:17,alt:{bad:true}}]});
    apiResponses.push({scenario:current.name,url:req.url,status:response.status,actualRouteBody:actual,sentBody:body,corrupted:body!==actual});
    if(current.mode==='late'&&url.searchParams.get('q')==='Asset 001')await new Promise(resolve=>{releaseOld=resolve;});
    res.writeHead(response.status,{'content-type':'application/json'});res.end(body);return;
  }
  res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><body data-admin-base-path=""><div id="root"></div><script src="/bundle.js"></script></body>');
}catch(error){if(!res.headersSent)res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:'Controlled fixture failure'}));current?.errors.push(String(error.stack||error));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:get('--chrome')||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[];
const scenarios=[
  {name:'reach and select unsearched asset061',mode:'page',target:61},
  {name:'reach and select unsearched asset137',mode:'page',target:137},
  {name:'first visible selection positive control',mode:'select',target:1},
  {name:'search actual original filename',mode:'search',q:'filename-needle-137',target:137},
  {name:'search actual alt positive control',mode:'search',q:'Asset 137',target:137},
  {name:'search caption',mode:'search',q:'caption-needle-136',target:136},
  {name:'search collection',mode:'search',q:'collection-needle-135',target:135},
  {name:'literal percent underscore backslash positive control',mode:'search',q:'literal %_\\ item',target:134,literal:true},
  {name:'HTTP200 missing assets is unavailable',mode:'missing-assets'},
  {name:'HTTP200 malformed asset is unavailable',mode:'invalid-asset'},
  {name:'confirmed empty response positive control',mode:'empty'},
  {name:'actual focus hook and delayed query positive control',mode:'late'},
  {name:'confirmed queue completion refreshes the open dialog',mode:'queue'},
  {name:'previous media page remains reachable',mode:'previous'},
];
try{for(const scenario of scenarios){
  current={...scenario,runtime:createMediaRouteRuntime({dependencyRoot,sourceRoot,manifest,empty:scenario.mode==='empty'}),errors:[]};
  const state=current,checks=[],check=(name,pass,role='control',details)=>checks.push({name,pass:Boolean(pass),role,...(details===undefined?{}:{details})});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1200,height:1000}}),page=await context.newPage();page.setDefaultTimeout(5000);
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push({name:error.name,message:error.message}));
  await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/'))return route.continue();if(url.startsWith('https://m11-media.invalid/storage/v1/object/public/'))return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>'});external.push({scenario:scenario.name,url});return route.abort('blockedbyclient');});
  let failure=null;try{
    await page.goto(origin);const initialRead=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/media/assets');
    await page.locator('#open-media').click();await page.getByRole('dialog').waitFor();await initialRead;
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const search=page.getByRole('searchbox'),cards=page.getByRole('listitem');
    if(scenario.mode==='page'||scenario.mode==='select'||scenario.mode==='search'){
      if(scenario.mode==='search'){const searched=page.waitForResponse(response=>new URL(response.url()).searchParams.get('q')===scenario.q);await search.fill(scenario.q);await searched;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
      const label=scenario.target===134?'literal %_\\ item':`Asset ${String(scenario.target).padStart(3,'0')}`;
      let card=cards.filter({has:page.getByRole('img',{name:label,exact:true})});const visited=[];
      for(let turn=0;scenario.mode==='page'&&await card.count()===0&&turn<10;turn++){
        visited.push(await cards.locator('img').evaluateAll(nodes=>nodes.map(node=>node.alt)));
        const next=page.getByRole('button',{name:/следующ|далее|ещ[её]/i}).or(page.getByRole('link',{name:/следующ|далее|ещ[её]/i}));
        if(await next.count()!==1||!await next.isEnabled())break;
        const response=page.waitForResponse(value=>value.url().includes('/api/media/assets'));await next.click();await response;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      }
      const reachable=await card.count()===1;check('required actual dialog card is reachable',reachable,scenario.mode==='select'||scenario.name.includes('positive')?'control':'target',{target:scenario.target,visited});
      if(reachable){await card.getByRole('button',{name:'Вставить',exact:true}).click();await page.waitForFunction(()=>window.__mediaFixture.selected.length===1);
        const selected=await page.evaluate(()=>window.__mediaFixture.selected);check('actual selection callback receives the exact requested asset',selected[0].id===`00000000-0000-4000-8000-${String(scenario.target).padStart(12,'0')}`,'control',selected);}
      if(scenario.literal)check('literal wildcard query does not expose a decoy',state.runtime.wire.at(-1)?.responseIds.length===1);
    }else if(scenario.mode==='empty'){check('confirmed empty has honest empty state',await page.getByRole('dialog').getByRole('status').textContent()==='Изображения не найдены.');check('confirmed empty has no card',await cards.count()===0);}
    else if(scenario.mode==='missing-assets'||scenario.mode==='invalid-asset'){
      const body=await page.locator('body').innerText();check('malformed200 is explicit unavailable, not confirmed empty',/не удалось|недоступ|ошиб|поврежд/i.test(body)&&!body.includes('Изображения не найдены.'),'target');check('malformed record is not selectable',await cards.count()===0,'target');check('malformed200 does not crash actual dialog',pageErrors.length===0,'target');
    }else if(scenario.mode==='late'){
      check('existing focus hook initially focuses actual search',await search.evaluate(element=>document.activeElement===element));
      const focusables=page.getByRole('dialog').locator('button:enabled,input:enabled');await focusables.first().focus();await page.keyboard.press('Shift+Tab');
      check('existing focus hook wraps reverse Tab',await focusables.last().evaluate(element=>document.activeElement===element));await page.keyboard.press('Tab');
      check('existing focus hook wraps forward Tab',await focusables.first().evaluate(element=>document.activeElement===element));await search.focus();
      const awaited=page.waitForRequest(request=>new URL(request.url()).searchParams.get('q')==='Asset 001');await search.fill('Asset 001');await awaited;
      const newer=page.waitForResponse(response=>new URL(response.url()).searchParams.get('q')==='Asset 137');await search.fill('Asset 137');await newer;
      releaseOld?.();releaseOld=null;await page.waitForTimeout(80);
      check('late old query cannot replace the current query',await search.inputValue()==='Asset 137'&&await page.getByRole('img',{name:'Asset 137',exact:true}).count()===1);
      await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});check('existing focus hook returns focus to trigger',await page.locator('#open-media').evaluate(element=>document.activeElement===element));
    }else if(scenario.mode==='queue'){
      await search.focus();const readsBefore=state.runtime.wire.length;
      await page.evaluate(()=>window.__mediaFixture.setQueue([{id:'confirmed-upload-138',name:'Uploaded.png',status:'upload',progress:10}]));
      await page.waitForTimeout(260);
      await page.evaluate(()=>window.__mediaFixture.setQueue([{id:'confirmed-upload-138',name:'Uploaded.png',status:'upload',progress:80}]));
      await page.waitForTimeout(260);
      check('upload progress alone never refreshes the catalogue',state.runtime.wire.length===readsBefore);
      state.runtime.rows.unshift({...state.runtime.rows[0],id:'00000000-0000-4000-8000-000000000138',alt_text:'Confirmed upload 138',created_at:'2027-01-01T00:00:00.123456+00:00'});
      const refreshed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/media/assets');
      await page.evaluate(()=>window.__mediaFixture.setQueue([{id:'confirmed-upload-138',name:'Uploaded.png',status:'done',progress:100}]));await refreshed;
      await page.getByRole('img',{name:'Confirmed upload 138',exact:true}).waitFor();
      check('confirmed new asset is available without closing the actual dialog',await page.getByRole('dialog').count()===1&&state.runtime.wire.length===readsBefore+1);
      check('confirmed upload refresh preserves actual search focus',await search.evaluate(element=>document.activeElement===element));
      await page.evaluate(()=>window.__mediaFixture.setQueue([{id:'confirmed-upload-138',name:'Uploaded.png',status:'done',progress:100}]));await page.waitForTimeout(260);
      check('the same confirmed queue ID cannot cause repeated refreshes',state.runtime.wire.length===readsBefore+1);
    }else if(scenario.mode==='previous'){
      let changed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/media/assets');await page.getByRole('button',{name:'Следующие изображения',exact:true}).click();await changed;
      await page.getByRole('img',{name:'Asset 061',exact:true}).waitFor();
      changed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/media/assets');await page.getByRole('button',{name:'Предыдущие изображения',exact:true}).click();await changed;
      await page.getByRole('img',{name:'Asset 001',exact:true}).waitFor();
      check('previous page uses the original bounded identity window',await page.getByRole('img',{name:'Asset 001',exact:true}).count()===1&&state.runtime.wire.length===3);
    }
    const manualInput=page.getByRole('textbox',{name:'Article draft',exact:true}),manualInputCount=await manualInput.count();
    const manualInputValue=manualInputCount===1?await manualInput.inputValue():null;
    check('manual article input remains unchanged',manualInputValue==='Exact manually authored source and rights remain unchanged.','preservation',{inputCount:manualInputCount,actualValue:manualInputValue});
    check('actual GET retains bounded61-or-smaller lookahead instead of loading the whole137 corpus',state.runtime.wire.length>0&&state.runtime.wire.every(row=>Number(new URLSearchParams(row.query).get('limit')||1000)<=61));
    check('actual dialog displays at most60 permitted cards',await cards.count()<=60);
    check('no uncontrolled SDK or external transport',state.runtime.protocolErrors.length===0&&state.errors.length===0&&!external.some(row=>row.scenario===scenario.name));
    if(!['missing-assets','invalid-asset'].includes(scenario.mode))check('ordinary controls do not crash the actual dialog',pageErrors.length===0);
  }catch(error){failure={name:error.name,message:error.message};check('browser scenario reaches its observation boundary',false,'execution',failure);}finally{releaseOld?.();releaseOld=null;}
  const observations=await page.evaluate(()=>({selected:window.__mediaFixture?.selected,text:document.body.innerText,active:document.activeElement?.outerHTML,open:window.__mediaFixture?.open})).catch(()=>null);
  results.push({scenario,checks,failure,observations,pageErrors,wire:state.runtime.wire,serverSourceGraph:state.runtime.sourceGraph,protocolErrors:state.runtime.protocolErrors,serverErrors:state.errors});
  await context.close();
}}finally{releaseOld?.();await browser.close();await new Promise(resolve=>server.close(resolve));}
const checks=results.flatMap(row=>row.checks),report={checkedAt:new Date().toISOString(),classification:'ACTUAL_EDITOR_MEDIA_DIALOG_BROWSER_AND_GET_SDK_CONTROLLED_CURRENT_REGRESSION_NOT_AUTHENTICATED_DB_E2E',manifestSha256:hash(fs.readFileSync(path.join(output,'source-manifest.json'))),browserSourceGraph:[...graph.values()],results,apiResponses,external,summary:{scenarios:results.length,checks:checks.length,failed:checks.filter(row=>!row.pass).length,targetFailures:checks.filter(row=>!row.pass&&row.role==='target').length,executionFailures:checks.filter(row=>!row.pass&&row.role==='execution').length},limits:manifest.limitations,realDbConnections:0,realProviderRequests:0};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,summary:report.summary}));process.exitCode=report.summary.executionFailures?2:report.summary.failed?1:0;
