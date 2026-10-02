/** Focused real IndexedDB proof in a fresh owned Edge profile. No App, native
 * authority, actual child materials, provider or personal browser is activated.
 * Transpiles five exact pure source modules for this harness only, not the app. */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const CHECKOUT='C:\\Users\\User\\Documents\\ChatGPT\\Работа по сайту\\literary-planet-v12-work';
const BRANCH='codex/literary-planet-v12-bilingual-final-autopilot';
const MODULES=['childDurableData','childDataNamespace','childProfile','childAccessPolicy','childPackage'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const insist=(yes,code)=>{if(yes!==true)throw new Error(code);};
const inside=(root,file)=>{const rel=path.relative(root,file);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
let output,root,context,server,ownedProfile,profileClosed=true,outputCreated=false;
const result={schemaVersion:1,kind:'literary-planet-child-durable-indexeddb-proof',startedAt:new Date().toISOString(),
  pass:false,cases:[],errors:[],sourceFiles:[],emittedModules:[],externalRequests:[],launches:0,restarts:0,
  storageBoundary:'actual-browser-indexeddb',admissionBoundary:'explicit-synthetic-host-and-index-request',
  childContentActivated:false,installedOsRuntime:false,nativeAuthority:false,releaseReady:false};
function scrubEnv(){const env={...process.env};for(const key of Object.keys(env))if(/^(?:GIT_|NODE_OPTIONS$|VITE_|SUPABASE|PLANET_|LITERARY_PLANET_|CLOUDFLARE|YOOKASSA|PSP_|AUTH_|PAYMENT_|TURNSTILE|YANDEX_|CMS_|JAVA_TOOL_OPTIONS$|_JAVA_OPTIONS$|JDK_JAVA_OPTIONS$)/iu.test(key))delete env[key];return env;}
function guard(commit){
 const env=scrubEnv();env.GIT_CONFIG_NOSYSTEM='1';env.GIT_CONFIG_GLOBAL='NUL';env.GIT_NO_LAZY_FETCH='1';env.GIT_TERMINAL_PROMPT='0';
 const git=args=>{const out=spawnSync('git',['--no-replace-objects','-c','core.fsmonitor=false','-C',root,...args],{env,encoding:'utf8',maxBuffer:1024*1024,windowsHide:true});insist(out.status===0,'GIT_READ_ONLY_FAILED');return out.stdout.trim();};
 insist(path.resolve(git(['rev-parse','--show-toplevel'])).toLowerCase()===path.resolve(root).toLowerCase()
  &&git(['branch','--show-current'])===BRANCH&&git(['rev-parse','HEAD'])===commit,'EXACT_SOURCE_GUARD_FAILED');
}
async function regular(file,max=8*1024*1024){const stat=await fs.lstat(file);insist(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=max&&await fs.realpath(file)===file,'UNSAFE_SOURCE_FILE');return fs.readFile(file);}
async function browserPhase(page,phase){
 return page.evaluate(async phase=>{
  const {createChildDurableData,createIndexedDbChildTransactionPort,CHILD_DURABLE_DATABASE}=await import('/modules/childDurableData.js');
  const {childDataNamespace}=await import('/modules/childDataNamespace.js');
  const checks=[];const check=(id,yes)=>{checks.push({id,status:yes===true?'PASS':'FAIL'});if(yes!==true)throw new Error(id);};
  try{
  const scope=Object.freeze({schemaVersion:1,namespace:'child',profileId:'synthetic-owned-browser-child',profileRevision:1,
   exactAge:8,locale:'ru',policyVersion:'synthetic-policy-v1',policyChecksum:'b'.repeat(64),
   packageId:'synthetic-only-package',packageVersion:1,packageChecksum:'c'.repeat(64)});
  const lease=Object.freeze({});const ref=(kind='work',id='synthetic-item')=>({kind,id,contentChecksum:'a'.repeat(64)});
  const payload={title:'Synthetic storage fixture',text:'No editorial approval or child activation',terms:[],references:[]};
  const value=purpose=>purpose==='search'||purpose==='history'?{schemaVersion:1,scope,references:[ref(purpose==='search'?'search-result':'recent')]}
   :{schemaVersion:1,scope,entries:[{reference:ref(purpose==='offline'?'offline-package':'work'),payload}]};
  const request=(purpose,selected=scope,selectedLease=lease)=>({purpose,scope:selected,lease:selectedLease,
   key:childDataNamespace(selected,purpose)+(purpose==='cache'||purpose==='offline'?'/item/'+(purpose==='offline'?'offline-package':'work')+'/synthetic-item':''),isCurrent:()=>true});
  const signal=()=>new AbortController().signal;
  const real=createIndexedDbChildTransactionPort(indexedDB);check('real-backend-created',real!==null);
  let abortAfterPut=null,transitionAfterPut=null,transition=null,observedPut=false;
  const boundary={close:()=>real.close(),transaction:(work,operationSignal,current)=>real.transaction(tx=>work({
   get:(...args)=>tx.get(...args),abort:()=>tx.abort(),put:(purpose,key,record,done)=>tx.put(purpose,key,record,()=>{
    if(purpose==='history'&&abortAfterPut){const abort=abortAfterPut;abortAfterPut=null;observedPut=true;abort.abort();}
    if(purpose==='history'&&transitionAfterPut){const change=transitionAfterPut;transitionAfterPut=null;observedPut=true;transition=change();}
    done();
   })}),operationSignal,current)};
  const data=createChildDurableData({backend:boundary,clock:{nowMs:()=>performance.now()},timeoutMs:5000});
  check('explicit-scope-activation',await data.activate(scope));
  const rawDatabase=()=>new Promise((resolve,reject)=>{const opening=indexedDB.open(CHILD_DURABLE_DATABASE,1);opening.onerror=()=>reject(new Error('owned-db-open'));opening.onsuccess=()=>resolve(opening.result);});
  const db=await rawDatabase();check('only-four-child-purpose-stores',JSON.stringify([...db.objectStoreNames].sort())===JSON.stringify(['child-search','child-history','child-cache','child-offline'].sort()));
  const hint=db.transaction(['child-search'],'readwrite',{durability:'strict'});check('strict-durability-hint-observed',hint.durability==='strict');await new Promise((resolve,reject)=>{hint.oncomplete=resolve;hint.onabort=reject;});db.close();
  if(phase==='write'){
   // Observer instrumentation only: original native transactions still run.
   // A complete-event observer marks the precise boundary before backend's own
   // oncomplete handler invokes current; it then closes that separate backend.
   const originalTransaction=IDBDatabase.prototype.transaction;
   let completing=false;
   const closingBackend=createIndexedDbChildTransactionPort(indexedDB);
   try{
    IDBDatabase.prototype.transaction=function(...args){const tx=originalTransaction.apply(this,args);tx.addEventListener('complete',()=>{completing=true;});return tx;};
    const revokedAtComplete=await closingBackend.transaction(()=>{},signal(),()=>{if(completing)closingBackend.close();return true;});
    check('reentrant-close-at-real-complete-denied',revokedAtComplete===false&&completing);
   }finally{IDBDatabase.prototype.transaction=originalTransaction;closingBackend.close();}
   for(const purpose of ['search','history','cache','offline']){
    const req=request(purpose);check(purpose+'-initially-empty',(await data.ports[purpose].read(req,signal()))?.revision===0);
    check(purpose+'-actual-cas-and-readback',await data.ports[purpose].compareAndSet(req,0,value(purpose),signal()));
    check(purpose+'-stored-envelope',(await data.ports[purpose].read(req,signal()))?.revision===1);
   }
   const history=request('history');
   const cas=await Promise.all([data.ports.history.compareAndSet(history,1,value('history'),signal()),
    data.ports.history.compareAndSet(history,1,{schemaVersion:1,scope,references:[]},signal())]);
   check('concurrent-cas-one-winner',cas.filter(v=>v===true).length===1);
   check('history-revision-after-concurrency',(await data.ports.history.read(history,signal()))?.revision===2);
   const abort=new AbortController();abortAfterPut=abort;observedPut=false;
   check('actual-tx-abort-after-put-denies',await data.ports.history.compareAndSet(history,2,value('history'),abort.signal)===false&&observedPut);
   check('actual-tx-abort-rolls-back',(await data.ports.history.read(history,signal()))?.revision===2);
   observedPut=false;transitionAfterPut=()=>data.activate({...scope,locale:'en'}).then(ok=>ok&&data.activate(scope));
   check('actual-aba-retires-pending-put',await data.ports.history.compareAndSet(history,2,value('history'),signal())===false&&observedPut);
   check('actual-aba-fresh-context-established',await transition===true);
   const fresh=Object.freeze({}), freshHistory=request('history',scope,fresh);
   check('aba-old-lease-denied',await data.ports.history.read(history,signal())===null);
   check('aba-original-history-restored',(await data.ports.history.read(freshHistory,signal()))?.revision===2);
   check('locale-en-new-namespace',await data.activate({...scope,locale:'en'}));
   check('locale-en-does-not-inherit',(await data.ports.history.read(request('history',{...scope,locale:'en'},Object.freeze({})),signal()))?.revision===0);
   check('locale-ru-restored',await data.activate(scope));
   // Deliberate corruption writes only this fresh owned browser's child DB.
   const corruptDb=await rawDatabase();const corruptTx=corruptDb.transaction(['child-cache'],'readwrite',{durability:'strict'});
   corruptTx.objectStore('child-cache').put({revision:0,value:null},request('cache').key);
   await new Promise((resolve,reject)=>{corruptTx.oncomplete=resolve;corruptTx.onabort=reject;});corruptDb.close();
   const currentLease=Object.freeze({});check('corrupt-record-not-an-empty-slot',await data.ports.cache.read(request('cache',scope,currentLease),signal())===null);
   check('corrupt-record-not-repaired',await data.ports.cache.compareAndSet(request('cache',scope,currentLease),0,value('cache'),signal())===false);
  }else{
   const fresh=Object.freeze({});
   check('new-process-search-readback',(await data.ports.search.read(request('search',scope,fresh),signal()))?.revision===1);
   check('new-process-history-readback',(await data.ports.history.read(request('history',scope,fresh),signal()))?.revision===2);
   check('new-process-offline-readback',(await data.ports.offline.read(request('offline',scope,fresh),signal()))?.revision===1);
   check('new-process-corruption-remains-denied',await data.ports.cache.read(request('cache',scope,fresh),signal())===null);
   const age={...scope,exactAge:7};check('different-exact-age-same-band-activation',await data.activate(age));
   check('different-exact-age-no-inheritance',(await data.ports.history.read(request('history',age,Object.freeze({})),signal()))?.revision===0);
   check('original-exact-age-restored',await data.activate(scope));
   check('original-exact-age-history-persisted',(await data.ports.history.read(request('history',scope,Object.freeze({})),signal()))?.revision===2);
  }
  check('durable-retirement',await data.dispose());return{phase,checks,allPass:true};
  }catch(error){return{phase,checks,allPass:false,errorCode:typeof error?.message==='string'&&/^[a-zA-Z0-9_-]{1,96}$/u.test(error.message)?error.message:'BROWSER_STORAGE_FAILURE'};}
 },phase);
}
async function boundedBrowserPhase(page,phase){
 let timer;
 try{return await Promise.race([browserPhase(page,phase),new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('BROWSER_PHASE_DEADLINE')),30000);})]);}
 finally{clearTimeout(timer);}
}
try{
 insist(process.argv.length===3&&path.isAbsolute(process.argv[2]),'ONE_EXACT_INPUT_REQUIRED');
 root=await fs.realpath(CHECKOUT);
 const declaredInput=path.resolve(process.argv[2]),inputPath=await fs.realpath(declaredInput),inputStat=await fs.lstat(declaredInput);
 insist(inputStat.isFile()&&!inputStat.isSymbolicLink()&&inputStat.size<=1024*1024&&inputPath.endsWith('.json')
  &&inside(path.join(root,'.tmp'),inputPath),'OWNED_BOUNDED_INPUT_REQUIRED');
 const inputBytes=await fs.readFile(inputPath),input=JSON.parse(inputBytes.toString('utf8'));
 insist(input&&Object.keys(input).sort().join(',')==='checkout,output,sourceCommit'&&input.checkout===CHECKOUT&&/^[a-f0-9]{40}$/u.test(input.sourceCommit),'EXACT_INPUT_SCHEMA_REQUIRED');
 guard(input.sourceCommit);
 const relative=path.relative(path.resolve(CHECKOUT),path.resolve(input.output)).replaceAll('\\','/');
 insist(/^\.tmp\/child-durable-indexeddb-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(relative),'OWNED_NEW_UUID_REQUIRED');
 output=path.join(root,relative);insist(await fs.lstat(output).then(()=>false,e=>e.code==='ENOENT'),'OUTPUT_ALREADY_EXISTS');
 const tmp=path.join(root,'.tmp'),tmpStat=await fs.lstat(tmp);
 insist(tmpStat.isDirectory()&&!tmpStat.isSymbolicLink()&&await fs.realpath(tmp)===path.resolve(tmp),'OWNED_TMP_PARENT_REQUIRED');
 const require=createRequire(path.join(root,'package.json')),ts=require('typescript'),{chromium}=require('playwright');
 const lockPath=path.join(root,'package-lock.json'),lockBytes=await regular(lockPath);
 result.lockSha256=sha(lockBytes);result.toolVersions={node:process.version,typescript:ts.version,playwright:require('playwright/package.json').version,edge:[]};
 result.sourceCommit=input.sourceCommit;result.repositoryHead=input.sourceCommit;result.inputSha256=sha(inputBytes);
 result.scriptSha256=sha(await fs.readFile(fileURLToPath(import.meta.url)));
 const emitted=new Map();
 for(const name of MODULES){const relative='src/child/'+name+'.ts',bytes=await regular(path.join(root,relative));
  result.sourceFiles.push({path:relative,sha256:sha(bytes)});
  const compiled=ts.transpileModule(bytes.toString('utf8'),{fileName:name+'.ts',reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020,strict:true}});
  insist(!compiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'FOCUSED_TRANSPILE_DIAGNOSTIC');
  const code=compiled.outputText.replace(/(from\s+["'])(\.\/(?:childDataNamespace|childProfile|childAccessPolicy|childPackage))(["'])/gu,'$1$2.js$3');
  const ast=ts.createSourceFile(name+'.js',code,ts.ScriptTarget.ES2020,true,ts.ScriptKind.JS);
  for(const statement of ast.statements)if(ts.isImportDeclaration(statement))insist(MODULES.some(module=>statement.moduleSpecifier.text==='./'+module+'.js'),'NONLOCAL_MODULE_IMPORT');
  const javascript=Buffer.from(code);emitted.set('/modules/'+name+'.js',javascript);result.emittedModules.push({path:'modules/'+name+'.js',sha256:sha(javascript),bytes:javascript.length});
 }
 await fs.mkdir(output);outputCreated=true;const outputStat=await fs.lstat(output);
 insist(outputStat.isDirectory()&&!outputStat.isSymbolicLink()&&await fs.realpath(output)===path.resolve(output),'OWNED_OUTPUT_REALPATH_REQUIRED');
 await fs.mkdir(path.join(output,'modules'));for(const [url,bytes]of emitted)await fs.writeFile(path.join(output,url.slice(1)),bytes,{flag:'wx'});
 const html=Buffer.from('<!doctype html><meta charset="utf-8"><title>Owned synthetic child storage fixture</title><p>Real IndexedDB; synthetic admission. No application activation.</p>');
 server=http.createServer((req,res)=>{if(req.method!=='GET'){res.writeHead(405);res.end();return;}const bytes=req.url==='/'?html:emitted.get(req.url);if(!bytes){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':req.url==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(bytes);});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const port=server.address().port,origin='http://127.0.0.1:'+port;ownedProfile=path.join(output,'owned-edge-profile');
 const env=scrubEnv();for(const key of ['TMP','TEMP','TMPDIR'])env[key]=path.join(output,'browser-tmp');await fs.mkdir(env.TEMP);
 for(const phase of ['write','restart']){
  context=await chromium.launchPersistentContext(ownedProfile,{channel:'msedge',headless:true,env,
   serviceWorkers:'block',args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-extensions']});
  profileClosed=false;result.launches++;if(phase==='restart')result.restarts++;
  const edgeVersion=context.browser()?.version();insist(typeof edgeVersion==='string'&&edgeVersion.length>0&&edgeVersion.length<128,'ACTUAL_EDGE_VERSION_REQUIRED');result.toolVersions.edge.push(edgeVersion);
  await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==origin){result.externalRequests.push({protocol:url.protocol,hostname:url.hostname});await route.abort();}else await route.continue();});
  const page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(origin,{waitUntil:'load',timeout:10000});
  const phaseResult=await boundedBrowserPhase(page,phase);result.cases.push(phaseResult);insist(phaseResult.allPass===true,'BROWSER_PHASE_FAILED');
  await context.close();context=null;profileClosed=true;
 }
 insist(result.externalRequests.length===0&&result.cases.length===2&&result.cases.every(c=>c.allPass===true),'BROWSER_PROOF_FAILED');
 guard(input.sourceCommit);for(const file of result.sourceFiles)insist(sha(await regular(path.join(root,file.path)))===file.sha256,'SOURCE_BYTES_CHANGED');
 insist(sha(await regular(lockPath))===result.lockSha256&&sha(await fs.readFile(inputPath))===result.inputSha256
  &&sha(await fs.readFile(fileURLToPath(import.meta.url)))===result.scriptSha256,'PROOF_TOOL_INPUT_CHANGED');
 insist(result.toolVersions.edge.length===2&&result.toolVersions.edge[0]===result.toolVersions.edge[1],'BROWSER_VERSION_CHANGED');result.pass=true;
}catch(error){result.errors.push({code:typeof error?.message==='string'&&/^[a-zA-Z0-9_-]{1,96}$/u.test(error.message)?error.message:'LOCAL_BROWSER_OR_IO_FAILURE'});}
finally{
 if(context){try{await context.close();profileClosed=true;}catch{result.errors.push({code:'OWNED_BROWSER_CLOSE_FAILED'});}}
 if(server)await new Promise(resolve=>server.close(resolve));
 if(ownedProfile&&profileClosed){try{const absolute=path.resolve(ownedProfile);insist(inside(output,absolute)&&path.basename(absolute)==='owned-edge-profile'&&await fs.realpath(absolute)===absolute,'PROFILE_CLEANUP_GUARD_FAILED');await fs.rm(absolute,{recursive:true});result.profileRemoved=true;}catch(error){if(error.code==='ENOENT')result.profileRemoved=true;else result.errors.push({code:'OWNED_PROFILE_CLEANUP_FAILED'});}}
 result.finishedAt=new Date().toISOString();result.pass=result.pass===true&&result.errors.length===0&&profileClosed;
 if(outputCreated){await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
 console.log(JSON.stringify({pass:result.pass,output,phases:result.cases.length,launches:result.launches,restarts:result.restarts,errors:result.errors,releaseReady:false}));if(!result.pass)process.exitCode=1;
}
