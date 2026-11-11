// Actual RecoveryController regression: real React effects/events, controlled server actions.
// node apps/admin/tests/browser/recovery-controller-browser.mjs --output <fresh-work-directory> [--snapshot <frozen-root.json>] [--source-root <captured-repo>]
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const own=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(own,'../../../..'),require=createRequire(path.join(repo,'package.json'));
const scenarios=['lookup-resolved-failure','lookup-rejection-control','lookup-empty-control','discard-deleted-false','discard-deleted-true-control','discard-rejection-control','locator-late-failure-control','discard-late-old-scope-control'];
const option=name=>{const at=process.argv.indexOf(name);return at>=0?process.argv[at+1]:undefined;};
const sourceRoot=await realpath(option('--source-root')||repo),snapshotFile=option('--snapshot'),output=option('--output');
assert.ok(output,'An explicit fresh output under an existing work or .tmp directory is required');
const requested=path.resolve(output),parent=await realpath(path.dirname(requested)),out=path.join(parent,path.basename(requested));
const roots=await Promise.all([path.join(repo,'../work'),path.join(repo,'.tmp')].filter(existsSync).map(value=>realpath(value)));
assert.ok(roots.some(root=>{const relative=path.relative(root,out);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);}), 'Output must stay under the task work/.tmp directories');
assert.equal(existsSync(out),false,'Never replace an earlier observation');await mkdir(out);
const sha=b=>createHash('sha256').update(b).digest('hex'),snapshotBytes=snapshotFile?await readFile(snapshotFile):null;
const snapshot=snapshotBytes?JSON.parse(snapshotBytes.toString().replace(/^\uFEFF/u,'')):null;
if(snapshot)assert.match(snapshot.validationSourceSha256||'',/^[a-f0-9]{64}$/u);
const frozen=new Map(snapshot?.files.map(row=>[row.path,row])||[]);
const sources=new Map(),capture=async file=>{const bytes=await readFile(path.join(sourceRoot,file));if(snapshot&&!file.startsWith('apps/admin/tests/browser/'))assert.equal(sha(bytes),frozen.get(file)?.sha256,'Actual source differs from frozen root: '+file);sources.set(file,{file,bytes:bytes.length,sha256:sha(bytes)});const dest=path.join(out,'sources',file);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes);return bytes.toString();};
const callsites={};
for(const file of['apps/admin/components/PageEditor.tsx','apps/admin/components/ArticleEditor.tsx']){
 const text=await capture(file),at=text.indexOf('<RecoveryController');assert.ok(at>=0);const end=text.indexOf('/>',at),wiring=text.slice(at,end+2);
 assert.ok(wiring.includes('savedAfterSubmit={false}'),'Do not assume automatic canonical-cleanup is a live caller path');callsites[file]={line:text.slice(0,at).split('\n').length,wiring,scope:'Source binding only; the complete editor is not mounted by this component fixture.'};
}
const serverActionSource=await capture('apps/admin/app/(dashboard)/editor-autosave/actions.ts');
assert.ok(serverActionSource.includes('deleted: Boolean(data?.id)'),'Controlled resolved deleted:false must match actual declared action contract');
const {build}=require('esbuild'),{chromium}=require('playwright');
const virtual={
 'next/navigation':'export {unstable_rethrow} from "next/dist/client/components/unstable-rethrow.browser";',
 '@/app/(dashboard)/editor-autosave/actions':'export function loadLatestEditorAutosaveAction(input){return window.__m20Recovery.action("load",input)}export function deleteExactEditorAutosaveAction(input){return window.__m20Recovery.action("delete",input)}export function saveEditorAutosaveAction(){throw new Error("Unexpected autosave; fixture uses isDirty=false")}',
};
const bundle=await build({absWorkingDir:repo,entryPoints:[path.join(own,'fixtures/recovery-controller-entry.jsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'actual-recovery-controlled-actions',setup(builder){
 builder.onResolve({filter:/.*/},request=>{
  if(Object.hasOwn(virtual,request.path))return{path:request.path,namespace:'boundary'};
  if(/^react(?:\/|$)|^react-dom(?:\/|$)/u.test(request.path))return{path:require.resolve('next/dist/compiled/'+request.path)};
  if(/@supabase|(?:^|\/)server-only$|\/lib\/auth(?:\.|\/)|\/lib\/supabase\/|^node:/u.test(request.path))throw new Error('Unmocked server/provider import forbidden: '+request.path);
  if(request.path.startsWith('@/')){const base=path.join(sourceRoot,'apps/admin',request.path.slice(2)),file=[base,base+'.ts',base+'.tsx'].find(existsSync);assert.ok(file,request.path);return{path:file};}
 });
 builder.onLoad({filter:/.*/,namespace:'boundary'},request=>({contents:virtual[request.path],loader:'js',resolveDir:repo}));
 builder.onLoad({filter:/\.[jt]sx?$/},async request=>{if(!request.path.startsWith(path.join(sourceRoot,'apps/admin')+path.sep))return;const file=path.relative(sourceRoot,request.path).replaceAll('\\','/'),contents=await capture(file);assert.ok(!/^["']use server["'];/u.test(contents.trimStart()));return{contents,loader:request.path.endsWith('.tsx')?'tsx':request.path.endsWith('.jsx')?'jsx':request.path.endsWith('.ts')?'ts':'js'};});
}}]});
const code=bundle.outputFiles[0].text;await writeFile(path.join(out,'actual-bundle.js'),code);
const server=http.createServer((request,response)=>{if(request.url==='/bundle.js'){response.writeHead(200,{'Content-Type':'text/javascript'});response.end(code);}else if(request.url==='/'){response.writeHead(200,{'Content-Type':'text/html'});response.end('<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script>');}else{response.writeHead(404);response.end();}});
let browser,origin,serverStarted=false;const observations=[],externalRequests=[];
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});serverStarted=true;origin='http://127.0.0.1:'+server.address().port;
 const chromeAt=process.argv.indexOf('--chrome'),chrome=chromeAt>=0?process.argv[chromeAt+1]:'C:/Program Files/Google/Chrome/Application/chrome.exe';
 browser=await chromium.launch({headless:true,executablePath:chrome});
 for(const scenario of scenarios){
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push({name:error.name,message:error.message}));
  try{
   await context.route('**/*',route=>{if(route.request().url().startsWith(origin+'/'))return route.continue();externalRequests.push({scenario,url:route.request().url()});return route.abort('blockedbyclient');});
   await context.addInitScript(()=>{window.IS_REACT_ACT_ENVIRONMENT=true;const h=window.__m20Recovery={calls:[],restores:[],action(kind,input){const call={kind,input,state:'pending'};h.calls.push(call);return new Promise((resolve,reject)=>{call.resolve=resolve;call.reject=reject;});},settle(index,value,reject=false){const call=h.calls[index];call.state=reject?'rejected':'resolved';call.result=value;if(reject)call.reject(new Error('SAFE_CONTROLLED_TRANSPORT'));else call.resolve(value);}};window.fetch=async()=>{throw new Error('Network forbidden')};});
   await page.goto(origin+'/');await page.waitForFunction(()=>window.__m20Recovery?.calls.length===1);
   const settle=(index,value,reject=false)=>page.evaluate(({index,value,reject})=>window.__m20Recovery.flush(index,value,reject),{index,value,reject});
   const recovery={id:'11111111-1111-4111-8111-111111111111',clientSessionId:'22222222-2222-4222-8222-222222222222',sequence:7,snapshotHash:'f'.repeat(64),state:'saved',baseUpdatedAt:'2026-10-30T10:00:00.123456Z',updatedAt:'2026-10-30T10:01:00Z',expiresAt:'2026-11-29T10:01:00Z',snapshot:{title:'Earlier exact recovery A'}};
   const before=await page.getByRole('textbox',{name:'Current authored input'}).inputValue();let newScopeDeleteInput=null;
   if(scenario==='discard-late-old-scope-control'){
    await settle(0,{ok:true,recovery});await page.getByRole('button',{name:'Удалить автокопию',exact:true}).click();await page.waitForFunction(()=>window.__m20Recovery.calls.length===2);
    assert.deepEqual(await page.evaluate(()=>window.__m20Recovery.calls[1].input),{id:recovery.id,clientSessionId:recovery.clientSessionId,sequence:recovery.sequence,snapshotHash:recovery.snapshotHash});
    await page.getByRole('button',{name:'Switch actual locator'}).click();await page.waitForFunction(()=>window.__m20Recovery.calls.length===3);
    const nextRecovery={...recovery,id:'33333333-3333-4333-8333-333333333333',clientSessionId:'44444444-4444-4444-8444-444444444444',sequence:8,snapshotHash:'e'.repeat(64),updatedAt:'2026-10-30T11:22:00Z',snapshot:{title:'New locator exact recovery C'}};
    await settle(2,{ok:true,recovery:nextRecovery});await page.getByRole('button',{name:'Удалить автокопию',exact:true}).waitFor();
    await settle(1,{ok:true,deleted:true});
    // A second real button event observes which exact recovery is retained.
    // Its action is left pending, so no second deletion is acknowledged.
    if(await page.getByRole('button',{name:'Удалить автокопию',exact:true}).count()){
     await page.getByRole('button',{name:'Удалить автокопию',exact:true}).click();await page.waitForFunction(()=>window.__m20Recovery.calls.length===4);newScopeDeleteInput=await page.evaluate(()=>window.__m20Recovery.calls[3].input);
    }
   }else if(scenario.startsWith('discard-')){
    await settle(0,{ok:true,recovery});await page.getByRole('button',{name:'Удалить автокопию',exact:true}).waitFor();
    await page.getByRole('button',{name:'Удалить автокопию',exact:true}).click();await page.waitForFunction(()=>window.__m20Recovery.calls.length===2);
    const args=await page.evaluate(()=>window.__m20Recovery.calls[1].input);assert.deepEqual(args,{id:recovery.id,clientSessionId:recovery.clientSessionId,sequence:recovery.sequence,snapshotHash:recovery.snapshotHash});
    await settle(1,scenario==='discard-rejection-control'?null:{ok:true,deleted:scenario==='discard-deleted-true-control'},scenario==='discard-rejection-control');
   }else if(scenario==='locator-late-failure-control'){
    await page.getByRole('button',{name:'Switch actual locator'}).click();await page.waitForFunction(()=>window.__m20Recovery.calls.length===2);await settle(1,{ok:true,recovery:null});await settle(0,{ok:false,error:'OLD_SCOPE_LOOKUP_UNAVAILABLE'});
   }else await settle(0,scenario==='lookup-rejection-control'?null:scenario==='lookup-resolved-failure'?{ok:false,error:'CONTROLLED_LOOKUP_UNAVAILABLE'}:{ok:true,recovery:null},scenario==='lookup-rejection-control');
   // Real React.act has flushed the deferred action and effect updates. No
   // timeout/RAF sampling is used to decide whether a known BEFORE failed.
   const state=await page.evaluate(()=>({statusClass:document.querySelector('.editor-autosave-status')?.className,text:document.body.innerText,recoveryVisible:Boolean(document.querySelector('.editor-recovery-panel')),locator:document.querySelector('[data-current-locator]')?.textContent,calls:window.__m20Recovery.calls.map(({resolve,reject,...call})=>call),restores:window.__m20Recovery.restores}));
   observations.push({name:scenario,criterion:scenario==='discard-late-old-scope-control'?'M20-T08':scenario.startsWith('discard')?'M20-T10':'M20-T07',category:['lookup-resolved-failure','discard-deleted-false'].includes(scenario)?'target':scenario==='discard-late-old-scope-control'?'scope-control':'control',state,newScopeDeleteInput,inputBefore:before,inputAfter:await page.getByRole('textbox',{name:'Current authored input'}).inputValue(),pageErrors:errors});
  }finally{await context.close();}
 }
 for(const row of sources.values())assert.equal(sha(await readFile(path.join(sourceRoot,row.file))),row.sha256,'Executed source drift');
 assert.deepEqual(externalRequests,[]);
 const packages=await Promise.all(['next','playwright','esbuild'].map(async name=>({name,version:JSON.parse(await readFile(require.resolve(name+'/package.json'),'utf8')).version})));
 const report={classification:'ACTUAL_REACT_RECOVERY_COMPONENT_ONLY_CONTROLLED_ACTIONS_NOT_DB_OR_FULL_ADMIN_E2E',checkedAt:new Date().toISOString(),sourceBinding:{snapshotSha256:snapshotBytes?sha(snapshotBytes):null,validationSourceSha256:snapshot?.validationSourceSha256||null,loadedSourceFingerprint:sha(Buffer.from(JSON.stringify([...sources.values()].sort((a,b)=>a.file.localeCompare(b.file)))))},producerSha256:sha(await readFile(fileURLToPath(import.meta.url))),entrySha256:sha(await readFile(path.join(own,'fixtures/recovery-controller-entry.jsx'))),reactResolution:'Actual next/dist/compiled/react and react-dom; React.act flushes effects, no hook clone',packages,callsites,observations,sources:[...sources.values()],externalRequests,
  limits:['Only actual RecoveryController/Panel/metadata helpers and React effect/event wiring execute. Deferred server actions return the actual declared DTO shapes; no actual Auth/DB/receipt mutation is claimed.',
  'Both current editor callsites set savedAfterSubmit=false. Automatic cleanup and canonical-commit receipt semantics are deliberately not targets; only reachable explicit-discard deleted:false and resolved lookup failure are targeted.',
  'Current input uses parent React state; no helper/React hook clone or source-string assertion decides runtime correctness. Exact delete identity and locator-late-response controls remain required.']};
 const reportPath=path.join(out,'report.json');await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 const oracleFile=path.join(own,'recovery-controller-contract.cjs'),oracle=spawnSync(process.execPath,[oracleFile,reportPath],{encoding:'utf8',windowsHide:true,timeout:5000});
 await writeFile(path.join(out,'contract.raw.log'),(oracle.stdout||'')+(oracle.stderr||''));
 assert.equal(oracle.error,undefined,'Regression oracle did not execute');
 let contract;try{contract=JSON.parse(oracle.stdout);}catch{throw new Error('Regression oracle returned no valid assertion report');}
 await writeFile(path.join(out,'contract.json'),JSON.stringify({...contract,oracleSha256:sha(await readFile(oracleFile)),exitCode:oracle.status},null,2)+'\n');
 console.log(JSON.stringify({output:out,scenarios:observations.length,passed:contract.pass,failed:contract.fail,scope:report.classification}));
 process.exitCode=oracle.status===0?0:1;
}finally{
 if(browser)await browser.close();if(serverStarted)await new Promise(resolve=>server.close(resolve));
 await writeFile(path.join(out,'cleanup.json'),JSON.stringify({browserCloseAwaited:Boolean(browser),ownLoopbackServerClosed:!server.listening,productionWrites:0,databaseConnections:0,providerCalls:0})+'\n');
}
