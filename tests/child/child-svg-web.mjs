/** Focused actual Edge static SVG proof; retained canonical RU/US flag bytes and own negative geometry. No application,
 * reviewed content, admission, OS persistence, playback or network authority. */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const CHECKOUT='C:\\Users\\User\\Documents\\ChatGPT\\Работа по сайту\\literary-planet-v12-work';
const BRANCH='codex/literary-planet-v12-bilingual-final-autopilot';
const MODULES=['childMediaDecode','childMedia','childDataNamespace','childProfile','childAccessPolicy','childPackage','childStaticSvg'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const insist=(yes,code)=>{if(yes!==true)throw new Error(code);};
const inside=(root,file)=>{const rel=path.relative(root,file);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
let output,root,context,server,ownedProfile,profileClosed=true,outputCreated=false;
const result={schemaVersion:1,kind:'literary-planet-child-static-svg-web-proof',startedAt:new Date().toISOString(),pass:false,
 checks:[],errors:[],sourceFiles:[],emittedModules:[],externalRequests:[],retainedFixtures:[],launches:0,
 codecBoundary:'actual-owned-BlobURL-Image-createImageBitmap-and-private-canvas-readback',
 admissionBoundary:'not-exercised-retained-canonical-source-bytes-only',lateSchedulingBoundary:'explicit-hold-of-actual-browser-bitmap',
 childContentActivated:false,installedOsRuntime:false,nativeAuthority:false,releaseReady:false};
function safeEnv(){const env={};for(const [key,value]of Object.entries(process.env))
 if(/^(?:SystemRoot|WINDIR|SystemDrive|PATH|PATHEXT|COMSPEC|ProgramFiles(?:\(x86\))?|ProgramW6432|LOCALAPPDATA|APPDATA|USERPROFILE|HOMEDRIVE|HOMEPATH|TEMP|TMP|NUMBER_OF_PROCESSORS|PROCESSOR_[A-Z_]+)$/iu.test(key))env[key]=value;return env;}
function guard(commit){
 const env=safeEnv();env.GIT_CONFIG_NOSYSTEM='1';env.GIT_CONFIG_GLOBAL='NUL';env.GIT_NO_LAZY_FETCH='1';env.GIT_TERMINAL_PROMPT='0';
 const git=args=>{const out=spawnSync('git',['--no-replace-objects','-c','core.fsmonitor=false','-C',root,...args],
  {env,encoding:'utf8',maxBuffer:1024*1024,windowsHide:true,timeout:10000});insist(out.status===0,'GIT_READ_ONLY_FAILED');return out.stdout.trim();};
 insist(path.resolve(git(['rev-parse','--show-toplevel'])).toLowerCase()===path.resolve(root).toLowerCase()
  &&git(['branch','--show-current'])===BRANCH&&git(['rev-parse','HEAD'])===commit,'EXACT_SOURCE_GUARD_FAILED');
}
async function regular(file,max=8*1024*1024){const stat=await fs.lstat(file);insist(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=max
 &&await fs.realpath(file)===file,'UNSAFE_SOURCE_FILE');return fs.readFile(file);}
async function browserProof(page,fixture){return page.evaluate(async(fixture)=>{
 const {createWebChildMediaCodec,preflightChildMedia}=await import('/modules/childMediaDecode.js');
 const checks=[],fixtures=[];const check=(id,yes)=>{checks.push({id,status:yes===true?'PASS':'FAIL'});if(yes!==true)throw new Error(id);};
 const hex=bytes=>crypto.subtle.digest('SHA-256',bytes).then(v=>[...new Uint8Array(v)].map(x=>x.toString(16).padStart(2,'0')).join(''));
 const signal=()=>new AbortController().signal,encode=source=>new TextEncoder().encode(source);
 const wrap=body=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10">'+body+'</svg>';
 const originalBitmap=globalThis.createImageBitmap,normalBitmap=originalBitmap.bind(globalThis);
 const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL,liveURLs=new Set();let allocations=0;
 URL.createObjectURL=function(blob){const url=originalCreate.call(this,blob);allocations++;liveURLs.add(url);return url;};
 URL.revokeObjectURL=function(url){check('revoke-only-owned-SVG-url-'+allocations,liveURLs.delete(url));return originalRevoke.call(this,url);};
 let heldBitmap,release;
 try{
  const binary=atob(fixture.base64),canonical=Uint8Array.from(binary,c=>c.charCodeAt(0));
  check('exact-retained-canonical-RU-source-digest',await hex(canonical)===fixture.sha256);
  fixtures.push({path:'public/assets/country-flags/ru.svg',mime:'image/svg+xml',bytes:canonical.length,sha256:fixture.sha256,childOrRightsApproval:false});
  const header=preflightChildMedia(canonical,'image/svg+xml');check('canonical-viewBox-intrinsic-budget',header?.kind==='image'&&header.width===512&&header.height===512);
  const codec=createWebChildMediaCodec(),resource=await codec.decode(canonical,'image/svg+xml',header,signal());
  check('actual-canonical-SVG-bitmap',resource.kind==='image'&&resource.bitmap instanceof ImageBitmap&&resource.bitmap.width===512&&resource.bitmap.height===512);
  check('actual-native-SVG-url-cleanup-after-rasterization',allocations===1&&liveURLs.size===0);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const drawing=canvas.getContext('2d');check('owned-fixture-drawing-context',drawing!==null);
  drawing.drawImage(resource.bitmap,0,0);
  const pixel=(x,y)=>[...drawing.getImageData(x,y,1,1).data];
  check('canonical-white-band-pixel',JSON.stringify(pixel(256,80))==='[255,255,255,255]');
  check('canonical-blue-band-pixel',JSON.stringify(pixel(256,250))==='[0,57,166,255]');
  check('canonical-red-band-pixel',JSON.stringify(pixel(256,430))==='[213,43,30,255]');
  let denied=false;try{await codec.decode(canonical,'image/svg+xml',header,signal());}catch{denied=true;}check('one-live-SVG-resource-per-codec',denied&&allocations===1);
  resource.close();resource.close();drawing.clearRect(0,0,512,512);check('released-real-SVG-bitmap',resource.bitmap.width===0&&resource.bitmap.height===0);
  const again=await codec.decode(canonical,'image/svg+xml',header,signal());again.close();check('SVG-factory-reuse-after-owned-release',liveURLs.size===0);
  const usBinary=atob(fixture.us.base64),usBytes=Uint8Array.from(usBinary,c=>c.charCodeAt(0));let usResource;
  try{
   check('exact-retained-canonical-US-source-digest',await hex(usBytes)===fixture.us.sha256);
   fixtures.push({path:'public/assets/country-flags/us.svg',mime:'image/svg+xml',bytes:usBytes.length,sha256:fixture.us.sha256,childOrRightsApproval:false});
   const usHeader=preflightChildMedia(usBytes,'image/svg+xml');check('canonical-US-marker-intrinsic-budget',usHeader?.kind==='image'&&usHeader.width===512&&usHeader.height===512);
   usResource=await createWebChildMediaCodec().decode(usBytes,'image/svg+xml',usHeader,signal());
   check('actual-canonical-US-marker-bitmap',usResource.kind==='image'&&usResource.bitmap instanceof ImageBitmap&&usResource.bitmap.width===512&&usResource.bitmap.height===512);
   drawing.clearRect(0,0,512,512);drawing.drawImage(usResource.bitmap,0,0);
   check('canonical-US-white-marker-star-pixel',JSON.stringify(pixel(33,20))==='[255,255,255,255]');
   check('canonical-US-nearby-blue-field-pixel',JSON.stringify(pixel(19,20))==='[25,47,93,255]');
   check('actual-US-marker-url-cleanup-after-rasterization',liveURLs.size===0);
   usResource.close();check('released-real-US-marker-bitmap',usResource.bitmap.width===0&&usResource.bitmap.height===0);
   check('original-canonical-US-marker-bytes-retained',await hex(usBytes)===fixture.us.sha256);
  }finally{usResource?.close();usBytes.fill(0);drawing.clearRect(0,0,512,512);}
  const before=allocations;let calls=0;globalThis.createImageBitmap=(...args)=>{calls++;return normalBitmap(...args);};
  for(const body of ['<image href="https://unowned.test/a.png"/>','<path onload="alert(1)" d="M0 0L1 1"/>','<style>path{fill:url(https://unowned.test)}</style>','<foreignObject/>','<animate attributeName="fill"/>','<g id="a"><use href="#a"/></g>']){
   let rejected=false;try{await createWebChildMediaCodec().decode(encode(wrap(body)),'image/svg+xml',{kind:'image',width:20,height:10},signal());}catch{rejected=true;}
   check('active-or-external-SVG-denied-'+checks.length,rejected&&calls===0&&allocations===before);
  }
  let rejected=false;try{await createWebChildMediaCodec().decode(canonical,'image/svg+xml',{kind:'image',width:2048,height:2048},signal());}catch{rejected=true;}
  check('SVG-header-substitution-denied-before-native',rejected&&calls===0&&allocations===before);
  const hold=new Promise(resolve=>release=resolve);let entered;const started=new Promise(resolve=>entered=resolve);
  globalThis.createImageBitmap=async(...args)=>{heldBitmap=await normalBitmap(...args);entered();await hold;return heldBitmap;};
  const abort=new AbortController(),lateCodec=createWebChildMediaCodec();const observed=lateCodec.decode(canonical,'image/svg+xml',header,abort.signal).then(()=>false,()=>true);await started;
  check('late-hold-is-actual-retained-SVG-bitmap',heldBitmap instanceof ImageBitmap&&heldBitmap.width===512);abort.abort();
  denied=false;try{await lateCodec.decode(canonical,'image/svg+xml',header,signal());}catch{denied=true;}
  check('aborted-unsettled-native-SVG-keeps-capacity',denied);release();check('late-SVG-abort-denied',await observed);
  check('late-SVG-bitmap-and-local-url-cleaned',heldBitmap.width===0&&liveURLs.size===0);
  check('original-canonical-SVG-bytes-retained',await hex(canonical)===fixture.sha256);canonical.fill(0);
  return{checks,fixtures,allPass:true};
 }catch(error){return{checks,fixtures,allPass:false,errorCode:typeof error?.message==='string'&&/^[a-zA-Z0-9_./-]{1,96}$/u.test(error.message)?error.message:'BROWSER_SVG_FAILURE'};}
 finally{release?.();heldBitmap?.close();globalThis.createImageBitmap=originalBitmap;for(const url of liveURLs)originalRevoke.call(URL,url);URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;}
},fixture);}
async function boundedProof(page,fixture){let timer;try{return await Promise.race([browserProof(page,fixture),new Promise((_,reject)=>{
 timer=setTimeout(()=>reject(new Error('BROWSER_PROOF_DEADLINE')),30000);})]);}finally{clearTimeout(timer);}}
try{
 insist(process.argv.length===3&&path.isAbsolute(process.argv[2]),'ONE_EXACT_INPUT_REQUIRED');root=await fs.realpath(CHECKOUT);
 const tmp=path.join(root,'.tmp'),tmpStat=await fs.lstat(tmp);insist(tmpStat.isDirectory()&&!tmpStat.isSymbolicLink()
  &&await fs.realpath(tmp)===path.resolve(tmp),'OWNED_TMP_PARENT_REQUIRED');
 const declaredInput=path.resolve(process.argv[2]),inputPath=await fs.realpath(declaredInput),inputStat=await fs.lstat(declaredInput);
 insist(inputStat.isFile()&&!inputStat.isSymbolicLink()&&inputStat.size<=1024*1024&&inputPath.endsWith('.json')&&inside(tmp,inputPath),'OWNED_BOUNDED_INPUT_REQUIRED');
 const inputBytes=await fs.readFile(inputPath),input=JSON.parse(inputBytes.toString('utf8'));
 insist(input&&Object.keys(input).sort().join(',')==='checkout,output,sourceCommit'&&input.checkout===CHECKOUT
  &&/^[a-f0-9]{40}$/u.test(input.sourceCommit),'EXACT_INPUT_SCHEMA_REQUIRED');guard(input.sourceCommit);
 const relative=path.relative(path.resolve(CHECKOUT),path.resolve(input.output)).replaceAll('\\','/');
 insist(/^\.tmp\/child-svg-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(relative),'OWNED_NEW_UUID_REQUIRED');
 output=path.join(root,relative);insist(await fs.lstat(output).then(()=>false,e=>e.code==='ENOENT'),'OUTPUT_ALREADY_EXISTS');
 const require=createRequire(path.join(root,'package.json')),ts=require('typescript'),{chromium}=require('playwright');
 const lockPath=path.join(root,'package-lock.json'),lockBytes=await regular(lockPath);
 result.lockSha256=sha(lockBytes);result.toolVersions={node:process.version,typescript:ts.version,playwright:require('playwright/package.json').version,edge:null};
 result.sourceCommit=input.sourceCommit;result.inputSha256=sha(inputBytes);result.scriptSha256=sha(await fs.readFile(fileURLToPath(import.meta.url)));
 const canonicalPath=path.join(root,'public/assets/country-flags/ru.svg'),canonicalBytes=await regular(canonicalPath,256*1024);
 result.canonicalAsset={path:'public/assets/country-flags/ru.svg',sha256:sha(canonicalBytes),bytes:canonicalBytes.length,contentOrRightsApproval:false};
 const usPath=path.join(root,'public/assets/country-flags/us.svg'),usBytes=await regular(usPath,256*1024);
 insist(sha(usBytes)==='43a00def4fa058cc317d79aba935eaf1622f2d215442bb35a6f8fbc6a01a4d5f','EXACT_RETAINED_US_ASSET_REQUIRED');
 result.canonicalAssets=[result.canonicalAsset,{path:'public/assets/country-flags/us.svg',sha256:sha(usBytes),bytes:usBytes.length,contentOrRightsApproval:false}];
 const fixture={base64:canonicalBytes.toString('base64'),sha256:sha(canonicalBytes),us:{base64:usBytes.toString('base64'),sha256:sha(usBytes)}};
 const emitted=new Map();
 for(const name of MODULES){const relative='src/child/'+name+'.ts',bytes=await regular(path.join(root,relative));result.sourceFiles.push({path:relative,sha256:sha(bytes)});
  const compiled=ts.transpileModule(bytes.toString('utf8'),{fileName:name+'.ts',reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020,strict:true}});
  insist(!compiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'FOCUSED_TRANSPILE_DIAGNOSTIC');
  const code=compiled.outputText.replace(/(from\s+["'])(\.\/(?:childMedia|childDataNamespace|childProfile|childAccessPolicy|childPackage|childStaticSvg))(["'])/gu,'$1$2.js$3');
  const ast=ts.createSourceFile(name+'.js',code,ts.ScriptTarget.ES2020,true,ts.ScriptKind.JS);
  for(const statement of ast.statements)if(ts.isImportDeclaration(statement))insist(MODULES.some(module=>statement.moduleSpecifier.text==='./'+module+'.js'),'NONLOCAL_MODULE_IMPORT');
  const javascript=Buffer.from(code);emitted.set('/modules/'+name+'.js',javascript);result.emittedModules.push({path:'modules/'+name+'.js',sha256:sha(javascript),bytes:javascript.length});
 }
 await fs.mkdir(output);outputCreated=true;const outputStat=await fs.lstat(output);
 insist(outputStat.isDirectory()&&!outputStat.isSymbolicLink()&&await fs.realpath(output)===path.resolve(output),'OWNED_OUTPUT_REALPATH_REQUIRED');
 await fs.mkdir(path.join(output,'modules'));for(const [url,bytes]of emitted)await fs.writeFile(path.join(output,url.slice(1)),bytes,{flag:'wx'});
 const html=Buffer.from('<!doctype html><meta charset="utf-8"><title>Owned child codec fixture</title><p>Actual canonical static SVG rasterization; no application/admission/rights activation.</p>');
 server=http.createServer((req,res)=>{if(req.method!=='GET'){res.writeHead(405);res.end();return;}const bytes=req.url==='/'?html:emitted.get(req.url);
  if(!bytes){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':req.url==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8',
   'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; img-src blob:; media-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(bytes);});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+server.address().port;ownedProfile=path.join(output,'owned-edge-profile');const env=safeEnv();
 for(const key of ['TMP','TEMP','TMPDIR'])env[key]=path.join(output,'browser-tmp');await fs.mkdir(env.TEMP);
 context=await chromium.launchPersistentContext(ownedProfile,{channel:'msedge',headless:true,env,serviceWorkers:'block',
  args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-extensions']});
 profileClosed=false;result.launches++;const edge=context.browser()?.version();insist(typeof edge==='string'&&edge.length>0&&edge.length<128,'ACTUAL_EDGE_VERSION_REQUIRED');result.toolVersions.edge=edge;
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==origin){result.externalRequests.push({protocol:url.protocol,hostname:url.hostname});await route.abort();}else await route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(origin,{waitUntil:'load',timeout:10000});
 const proof=await boundedProof(page,fixture);result.checks=proof.checks;result.retainedFixtures=proof.fixtures;insist(proof.allPass===true,'BROWSER_CODEC_PROOF_FAILED');
 insist(result.externalRequests.length===0&&context.browser()?.version()===edge,'BROWSER_IDENTITY_OR_NETWORK_CHANGED');
 await context.close();context=null;profileClosed=true;guard(input.sourceCommit);
 for(const file of result.sourceFiles)insist(sha(await regular(path.join(root,file.path)))===file.sha256,'SOURCE_BYTES_CHANGED');
 insist(sha(await regular(canonicalPath,256*1024))===result.canonicalAsset.sha256,'CANONICAL_ASSET_BYTES_CHANGED');
 insist(sha(await regular(usPath,256*1024))===result.canonicalAssets[1].sha256,'CANONICAL_US_ASSET_BYTES_CHANGED');
 insist(sha(await regular(lockPath))===result.lockSha256&&sha(await fs.readFile(inputPath))===result.inputSha256
  &&sha(await fs.readFile(fileURLToPath(import.meta.url)))===result.scriptSha256,'PROOF_TOOL_INPUT_CHANGED');result.pass=true;
}catch(error){result.errors.push({code:typeof error?.message==='string'&&/^[a-zA-Z0-9_-]{1,96}$/u.test(error.message)?error.message:'LOCAL_BROWSER_OR_IO_FAILURE'});}
finally{
 if(context){try{await context.close();profileClosed=true;}catch{result.errors.push({code:'OWNED_BROWSER_CLOSE_FAILED'});}}
 if(server)await new Promise(resolve=>server.close(resolve));
 if(ownedProfile&&profileClosed){try{const absolute=path.resolve(ownedProfile);insist(inside(output,absolute)&&path.basename(absolute)==='owned-edge-profile'
  &&await fs.realpath(absolute)===absolute,'PROFILE_CLEANUP_GUARD_FAILED');await fs.rm(absolute,{recursive:true});result.profileRemoved=true;}
  catch(error){if(error.code==='ENOENT')result.profileRemoved=true;else result.errors.push({code:'OWNED_PROFILE_CLEANUP_FAILED'});}}
 result.finishedAt=new Date().toISOString();result.pass=result.pass===true&&result.errors.length===0&&profileClosed;
 if(outputCreated)await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pass:result.pass,output,checks:result.checks.length,errors:result.errors,releaseReady:false}));if(!result.pass)process.exitCode=1;
}
