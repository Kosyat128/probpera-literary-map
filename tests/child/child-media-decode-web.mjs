/** Focused actual Edge codec proof; own canvas/PCM bytes only. No application,
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
const MODULES=['childMediaDecode','childMedia','childDataNamespace','childProfile','childAccessPolicy','childPackage'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const insist=(yes,code)=>{if(yes!==true)throw new Error(code);};
const inside=(root,file)=>{const rel=path.relative(root,file);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
let output,root,context,server,ownedProfile,profileClosed=true,outputCreated=false;
const result={schemaVersion:1,kind:'literary-planet-child-media-web-codec-proof',startedAt:new Date().toISOString(),pass:false,
 checks:[],errors:[],sourceFiles:[],emittedModules:[],externalRequests:[],generatedFixtures:[],launches:0,
 codecBoundary:'actual-createImageBitmap-and-AudioContext-decodeAudioData',
 admissionBoundary:'not-exercised-generated-owned-bytes-only',lateSchedulingBoundary:'explicit-hold-of-actual-browser-bitmap',
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
async function browserProof(page){return page.evaluate(async()=>{
 const {createWebChildMediaCodec,preflightChildMedia}=await import('/modules/childMediaDecode.js');
 const checks=[],fixtures=[];const check=(id,yes)=>{checks.push({id,status:yes===true?'PASS':'FAIL'});if(yes!==true)throw new Error(id);};
 const hex=bytes=>crypto.subtle.digest('SHA-256',bytes).then(v=>[...new Uint8Array(v)].map(x=>x.toString(16).padStart(2,'0')).join(''));
 const signal=()=>new AbortController().signal;
 try{
  const canvas=document.createElement('canvas');canvas.width=3;canvas.height=2;
  const drawing=canvas.getContext('2d');check('owned-canvas-context',drawing!==null);
  drawing.fillStyle='#336699';drawing.fillRect(0,0,3,2);drawing.fillStyle='#e2b26d';drawing.fillRect(1,0,1,1);
  const bytesByMime=new Map();
  for(const mime of ['image/png','image/jpeg','image/webp']){
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,0.8));check(mime+'-actual-encoder',blob!==null&&blob.type===mime);
   const bytes=new Uint8Array(await blob.arrayBuffer());bytesByMime.set(mime,bytes);fixtures.push({mime,bytes:bytes.length,sha256:await hex(bytes),source:'own-3x2-canvas'});
   const header=preflightChildMedia(bytes,mime);check(mime+'-actual-preflight',header?.kind==='image'&&header.width===3&&header.height===2);
   const codec=createWebChildMediaCodec(),resource=await codec.decode(bytes,mime,header,signal());
   check(mime+'-actual-bitmap',resource.kind==='image'&&resource.bitmap instanceof ImageBitmap&&resource.bitmap.width===3&&resource.bitmap.height===2);
   let denied=false;try{await codec.decode(bytes,mime,header,signal());}catch{denied=true;}check(mime+'-one-live-resource',denied);
   resource.close();resource.close();check(mime+'-close-releases-bitmap',resource.bitmap.width===0&&resource.bitmap.height===0);
   const next=await codec.decode(bytes,mime,header,signal());check(mime+'-reuse-after-release',next.bitmap.width===3);next.close();
  }
  const wave=new Uint8Array(44+480*2),view=new DataView(wave.buffer);
  const ascii=(p,s)=>[...s].forEach((c,i)=>wave[p+i]=c.charCodeAt(0));
  ascii(0,'RIFF');view.setUint32(4,wave.length-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,48000,true);view.setUint32(28,96000,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,480*2,true);
  for(let i=0;i<480;i++)view.setInt16(44+i*2,Math.round(Math.sin(i*2*Math.PI*440/48000)*4000),true);
  fixtures.push({mime:'audio/wav',bytes:wave.length,sha256:await hex(wave),source:'own-480-frame-PCM-sine-no-playback'});
  const audioHeader=preflightChildMedia(wave,'audio/wav'),audioCodec=createWebChildMediaCodec();
  const audio=await audioCodec.decode(wave,'audio/wav',audioHeader,signal());
  check('actual-audio-buffer',audio.kind==='audio'&&audio.buffer instanceof AudioBuffer&&audio.buffer.sampleRate===48000
   &&audio.buffer.numberOfChannels===1&&audio.buffer.length===480&&audio.buffer.duration===0.01);
  const samples=audio.buffer.getChannelData(0);check('decoded-owned-PCM-has-signal',samples.some(x=>x!==0));
  audio.close();check('audio-release-wipes-owned-buffer',samples.every(x=>x===0));
  const audioAgain=await audioCodec.decode(wave,'audio/wav',audioHeader,signal());audioAgain.close();check('audio-factory-reuse-after-release',true);
  const original=globalThis.createImageBitmap,normal=original.bind(globalThis);let release,entered,heldBitmap;
  const hold=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
  try{
   globalThis.createImageBitmap=async(...args)=>{heldBitmap=await normal(...args);entered();await hold;return heldBitmap;};
   const bytes=bytesByMime.get('image/png'),abort=new AbortController(),codec=createWebChildMediaCodec();
   const decoding=codec.decode(bytes,'image/png',preflightChildMedia(bytes,'image/png'),abort.signal);
   const observed=decoding.then(()=>false,()=>true);await started;
   check('late-hold-is-real-browser-bitmap',heldBitmap instanceof ImageBitmap&&heldBitmap.width===3);
   abort.abort();release();check('actual-late-abort-denied',await observed);check('actual-late-bitmap-closed',heldBitmap.width===0);
  }finally{release?.();heldBitmap?.close();globalThis.createImageBitmap=original;}
  let calls=0;
  try{
   globalThis.createImageBitmap=(...args)=>{calls++;return normal(...args);};
   const bomb=bytesByMime.get('image/png').slice();new DataView(bomb.buffer).setUint32(16,5000);
   const codec=createWebChildMediaCodec();let denied=false;
   try{await codec.decode(bomb,'image/png',{kind:'image',width:5000,height:2},signal());}catch{denied=true;}
   check('header-bomb-denied-before-codec',denied&&calls===0);
   const apng=bytesByMime.get('image/png').slice();let p=8;
   while(p<apng.length){const n=new DataView(apng.buffer).getUint32(p);if(String.fromCharCode(...apng.slice(p+4,p+8))==='IDAT')break;p+=n+12;}
   apng.set([97,99,84,76],p+4);denied=false;
   try{await codec.decode(apng,'image/png',{kind:'image',width:3,height:2},signal());}catch{denied=true;}
   check('APNG-marker-challenge-denied-before-codec',denied&&calls===0);
  }finally{globalThis.createImageBitmap=original;}
  return{checks,fixtures,allPass:true};
 }catch(error){return{checks,fixtures,allPass:false,errorCode:typeof error?.message==='string'&&/^[a-zA-Z0-9_./-]{1,96}$/u.test(error.message)?error.message:'BROWSER_CODEC_FAILURE'};}
});}
async function boundedProof(page){let timer;try{return await Promise.race([browserProof(page),new Promise((_,reject)=>{
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
 insist(/^\.tmp\/child-media-codec-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(relative),'OWNED_NEW_UUID_REQUIRED');
 output=path.join(root,relative);insist(await fs.lstat(output).then(()=>false,e=>e.code==='ENOENT'),'OUTPUT_ALREADY_EXISTS');
 const require=createRequire(path.join(root,'package.json')),ts=require('typescript'),{chromium}=require('playwright');
 const lockPath=path.join(root,'package-lock.json'),lockBytes=await regular(lockPath);
 result.lockSha256=sha(lockBytes);result.toolVersions={node:process.version,typescript:ts.version,playwright:require('playwright/package.json').version,edge:null};
 result.sourceCommit=input.sourceCommit;result.inputSha256=sha(inputBytes);result.scriptSha256=sha(await fs.readFile(fileURLToPath(import.meta.url)));
 const emitted=new Map();
 for(const name of MODULES){const relative='src/child/'+name+'.ts',bytes=await regular(path.join(root,relative));result.sourceFiles.push({path:relative,sha256:sha(bytes)});
  const compiled=ts.transpileModule(bytes.toString('utf8'),{fileName:name+'.ts',reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020,strict:true}});
  insist(!compiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'FOCUSED_TRANSPILE_DIAGNOSTIC');
  const code=compiled.outputText.replace(/(from\s+["'])(\.\/(?:childMedia|childDataNamespace|childProfile|childAccessPolicy|childPackage))(["'])/gu,'$1$2.js$3');
  const ast=ts.createSourceFile(name+'.js',code,ts.ScriptTarget.ES2020,true,ts.ScriptKind.JS);
  for(const statement of ast.statements)if(ts.isImportDeclaration(statement))insist(MODULES.some(module=>statement.moduleSpecifier.text==='./'+module+'.js'),'NONLOCAL_MODULE_IMPORT');
  const javascript=Buffer.from(code);emitted.set('/modules/'+name+'.js',javascript);result.emittedModules.push({path:'modules/'+name+'.js',sha256:sha(javascript),bytes:javascript.length});
 }
 await fs.mkdir(output);outputCreated=true;const outputStat=await fs.lstat(output);
 insist(outputStat.isDirectory()&&!outputStat.isSymbolicLink()&&await fs.realpath(output)===path.resolve(output),'OWNED_OUTPUT_REALPATH_REQUIRED');
 await fs.mkdir(path.join(output,'modules'));for(const [url,bytes]of emitted)await fs.writeFile(path.join(output,url.slice(1)),bytes,{flag:'wx'});
 const html=Buffer.from('<!doctype html><meta charset="utf-8"><title>Owned child codec fixture</title><p>Actual browser codecs, generated owned bytes; no application/admission activation.</p>');
 server=http.createServer((req,res)=>{if(req.method!=='GET'){res.writeHead(405);res.end();return;}const bytes=req.url==='/'?html:emitted.get(req.url);
  if(!bytes){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':req.url==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8',
   'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(bytes);});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+server.address().port;ownedProfile=path.join(output,'owned-edge-profile');const env=safeEnv();
 for(const key of ['TMP','TEMP','TMPDIR'])env[key]=path.join(output,'browser-tmp');await fs.mkdir(env.TEMP);
 context=await chromium.launchPersistentContext(ownedProfile,{channel:'msedge',headless:true,env,serviceWorkers:'block',
  args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-extensions']});
 profileClosed=false;result.launches++;const edge=context.browser()?.version();insist(typeof edge==='string'&&edge.length>0&&edge.length<128,'ACTUAL_EDGE_VERSION_REQUIRED');result.toolVersions.edge=edge;
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==origin){result.externalRequests.push({protocol:url.protocol,hostname:url.hostname});await route.abort();}else await route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(origin,{waitUntil:'load',timeout:10000});
 const proof=await boundedProof(page);result.checks=proof.checks;result.generatedFixtures=proof.fixtures;insist(proof.allPass===true,'BROWSER_CODEC_PROOF_FAILED');
 insist(result.externalRequests.length===0&&context.browser()?.version()===edge,'BROWSER_IDENTITY_OR_NETWORK_CHANGED');
 await context.close();context=null;profileClosed=true;guard(input.sourceCommit);
 for(const file of result.sourceFiles)insist(sha(await regular(path.join(root,file.path)))===file.sha256,'SOURCE_BYTES_CHANGED');
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
