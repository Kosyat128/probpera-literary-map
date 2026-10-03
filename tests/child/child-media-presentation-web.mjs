/** Focused actual Edge DOM/audio presentation proof; own canvas/PCM only. No application,
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
const MODULES=['childMediaPresentation','childMediaDecode','childMedia','childDataNamespace','childProfile','childAccessPolicy','childPackage','childStaticSvg'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const insist=(yes,code)=>{if(yes!==true)throw new Error(code);};
const inside=(root,file)=>{const rel=path.relative(root,file);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
let output,root,context,server,ownedProfile,profileClosed=true,outputCreated=false;
const result={schemaVersion:1,kind:'literary-planet-child-media-web-presentation-proof',startedAt:new Date().toISOString(),pass:false,
 checks:[],errors:[],sourceFiles:[],emittedModules:[],externalRequests:[],generatedFixtures:[],launches:0,
 codecBoundary:'actual-browser-codec-and-owned-DOM-canvas',
 admissionBoundary:'explicit-synthetic-host-and-byte-loader-no-human-or-native-proof',audioBoundary:'actual-button-activation-muted-output-not-audible-sound-proof',
 childContentActivated:false,installedOsRuntime:false,nativeAuthority:false,releaseReady:false};
function safeEnv(){const env={};for(const [key,value]of Object.entries(process.env))
 if(/^(?:SystemRoot|WINDIR|SystemDrive|PATH|PATHEXT|COMSPEC|ProgramFiles(?:\(x86\))?|ProgramW6432|LOCALAPPDATA|APPDATA|USERPROFILE|HOMEDRIVE|HOMEPATH|TEMP|TMP|NUMBER_OF_PROCESSORS|PROCESSOR_[A-Z_]+)$/iu.test(key))env[key]=value;return env;}
function guard(commit){
 const env=safeEnv();env.GIT_CONFIG_NOSYSTEM='1';env.GIT_CONFIG_GLOBAL='NUL';env.GIT_NO_LAZY_FETCH='1';env.GIT_TERMINAL_PROMPT='0';
 const git=args=>{const out=spawnSync('git',['--no-replace-objects','-c','safe.directory='+root,'-c','core.fsmonitor=false','-C',root,...args],
  {env,encoding:'utf8',maxBuffer:1024*1024,windowsHide:true,timeout:10000});insist(out.status===0,'GIT_READ_ONLY_FAILED');return out.stdout.trim();};
 insist(path.resolve(git(['rev-parse','--show-toplevel'])).toLowerCase()===path.resolve(root).toLowerCase()
  &&git(['branch','--show-current'])===BRANCH&&git(['rev-parse','HEAD'])===commit,'EXACT_SOURCE_GUARD_FAILED');
}
async function regular(file,max=8*1024*1024){const stat=await fs.lstat(file);insist(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=max
 &&await fs.realpath(file)===file,'UNSAFE_SOURCE_FILE');return fs.readFile(file);}
async function browserProof(page){return page.evaluate(async()=>{
 const {createChildMediaDecoder,createWebChildMediaCodec}=await import('/modules/childMediaDecode.js');
 const {createWebChildMediaPresentation}=await import('/modules/childMediaPresentation.js');
 const checks=[],fixtures=[];const check=(id,yes)=>{checks.push({id,status:yes===true?'PASS':'FAIL'});if(yes!==true)throw new Error(id);};
 const hex=bytes=>crypto.subtle.digest('SHA-256',bytes).then(v=>[...new Uint8Array(v)].map(x=>x.toString(16).padStart(2,'0')).join(''));
 let presenter,host,portStarts=0,lastResource;
 try{
  const source=document.createElement('canvas');source.width=3;source.height=2;const drawing=source.getContext('2d');
  drawing.fillStyle='#336699';drawing.fillRect(0,0,3,2);
  const blob=await new Promise(resolve=>source.toBlob(resolve,'image/png'));const png=new Uint8Array(await blob.arrayBuffer());
  const wave=new Uint8Array(44+480*2),view=new DataView(wave.buffer),ascii=(p,s)=>[...s].forEach((c,i)=>wave[p+i]=c.charCodeAt(0));
  ascii(0,'RIFF');view.setUint32(4,wave.length-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,48000,true);view.setUint32(28,96000,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,960,true);
  for(let i=0;i<480;i++)view.setInt16(44+i*2,Math.round(Math.sin(i*2*Math.PI*440/48000)*4000),true);
  const pngHash=await hex(png),waveHash=await hex(wave),hash='a'.repeat(64),at=1_790_942_400_000;
  fixtures.push({mime:'image/png',bytes:png.length,sha256:pngHash,source:'own-3x2-canvas'},
   {mime:'audio/wav',bytes:wave.length,sha256:waveHash,source:'own-10ms-PCM-muted-output'});
  host={time:at,current:true,context:{generation:1,request:{locale:'ru',route:{kind:'home',entityId:null}},
   selection:{schemaVersion:1,mode:'child',selectionRevision:1,profileId:'synthetic-child',profileRevision:1,profileChecksum:hash,policyVersion:'synthetic-v1',policyChecksum:hash},
   profile:{id:'synthetic-child',label:'Synthetic fixture',exactAge:9,ageBand:'9-11',locale:'ru',ageConfirmedAt:'2026-10-01T00:00:00.000Z',
    readingLevel:null,allowedTopics:null,blockedTopics:[],soundEnabled:true,motion:'calm',narrationEnabled:true},
   scope:{schemaVersion:1,namespace:'child',profileId:'synthetic-child',profileRevision:1,exactAge:9,locale:'ru',policyVersion:'synthetic-v1',policyChecksum:hash,
    packageId:'synthetic-owned-package',packageVersion:1,packageChecksum:hash},validUntilEpochMs:at+60000}};
  const owner={kind:'work',id:'synthetic-owned-work',contentChecksum:hash},clock={nowEpochMs:()=>host.time};
  const container=document.createElement('div');container.id='owned-child-media-surface';document.body.appendChild(container);
  const realCodec=createWebChildMediaCodec(),codec={decode:async(...args)=>{const resource=await realCodec.decode(...args);lastResource=resource;return resource;}};
  let clearAtRead=true;
  const loader={async visitMedia(input,signal,visitor){
   if(signal.aborted||!host.current)return false;
   clearAtRead=clearAtRead&&presenter.element.width===0&&presenter.element.height===0;
   const audio=input.assetId==='own-wave';if(!audio&&input.assetId!=='own-png')return false;
   const bytes=audio?wave:png;
   visitor({scope:host.context.scope,asset:{assetId:input.assetId,owner,entity:{kind:audio?'narration':'image',id:'synthetic-owned-media',contentChecksum:hash},
    inventoryKey:audio?'owned.wav':'owned.png',mime:audio?'audio/wav':'image/png',sha256:audio?waveHash:pngHash,bytes:bytes.length},bytes:bytes.slice(),validUntilEpochMs:host.time+10000});
   return !signal.aborted;
  }};
  const context=()=>host.context,isCurrent=c=>host.current&&JSON.stringify(c)===JSON.stringify(host.context);
  const decoder=createChildMediaDecoder({loader,codec,context,isCurrent,clock,timeoutMs:10000,initialVisibility:'active'});
  presenter=createWebChildMediaPresentation({decoder,context,isCurrent,clock,initialVisibility:'active',container});
  const input=assetId=>({assetId,owner}),signal=()=>new AbortController().signal;
  check('actual-owned-canvas-created',container.querySelectorAll('canvas').length===1&&presenter.element.width===0);
  check('actual-bitmap-presentation',await presenter.request(input('own-png'),signal()));
  check('actual-owned-image-pixels',presenter.element.width===3&&presenter.element.height===2
   &&presenter.element.getContext('2d').getImageData(0,0,3,2).data.some(x=>x!==0));
  check('owned-pixels-clear-before-new-decoder',await presenter.request(input('own-png'),signal())&&clearAtRead);
  const borrowedImage=lastResource.bitmap;let erasedBeforeHostChange=false;
  check('synchronous-host-transition',presenter.beforeContextChange(()=>{
   erasedBeforeHostChange=presenter.element.width===0&&presenter.element.height===0&&borrowedImage.width===0;
   host.context={...host.context,generation:2};
  }));check('actual-clear-before-host-publication',erasedBeforeHostChange);
  check('new-generation-image',await presenter.request(input('own-png'),signal()));
  const expiring=lastResource.bitmap;host.time+=10000;check('trusted-expiry-presentation-sealed',presenter.getSnapshot().phase==='sealed');
  check('actual-expiry-clears-canvas-and-bitmap',presenter.element.width===0&&presenter.element.height===0&&expiring.width===0);
  check('background-first-image',await presenter.request(input('own-png'),signal()));presenter.background();
  check('actual-background-clear',presenter.element.width===0&&lastResource.bitmap.width===0);
  check('background-denies-fresh-render',await presenter.request(input('own-png'),signal())===false);presenter.foreground();
  check('foreground-needs-fresh-admission',presenter.getSnapshot().phase==='sealed');
  presenter.beforeContextChange(()=>{host.context={...host.context,profile:{...host.context.profile,soundEnabled:false}};});
  check('sound-disabled-narration-loads-silently',await presenter.request(input('own-wave'),signal()));
  check('captured-profile-sound-denies-play',await presenter.play()===false);
  presenter.beforeContextChange(()=>{host.context={...host.context,profile:{...host.context.profile,soundEnabled:true}};});
  check('enabled-narration-loads-without-autoplay',await presenter.request(input('own-wave'),signal()));
  const borrowedAudio=lastResource.buffer,originalStart=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){portStarts++;return originalStart.apply(this,args);};
  const button=document.createElement('button');button.id='play-owned-narration';button.textContent='Play owned muted fixture';document.body.appendChild(button);
  const state={presenter,checks,fixtures,container,button,borrowedAudio,originalStart,get starts(){return portStarts;},trustedClick:false,playSettled:false,playResult:null};
  button.addEventListener('click',async event=>{state.trustedClick=event.isTrusted;state.playResult=await presenter.play();state.playSettled=true;});
  globalThis.__ownedChildPresentation=state;check('no-source-start-before-user-click',portStarts===0);
  return{checks,fixtures,allPass:true};
 }catch(error){presenter?.dispose();return{checks,fixtures,allPass:false,errorCode:typeof error?.message==='string'&&/^[a-zA-Z0-9_-]{1,96}$/u.test(error.message)?error.message:'BROWSER_PRESENTATION_FAILURE'};}
});}
async function finishBrowserProof(page){return page.evaluate(()=>{
 const s=globalThis.__ownedChildPresentation,checks=[],check=(id,yes)=>{checks.push({id,status:yes===true?'PASS':'FAIL'});if(yes!==true)throw new Error(id);};
 try{
  check('actual-transient-trusted-button-action',s.trustedClick===true&&s.playSettled===true&&s.playResult===true);
  check('actual-one-source-start',s.starts===1);
  check('actual-ended-lease-cleared',s.presenter.getSnapshot().phase==='sealed');
  check('actual-narration-buffer-wiped',s.borrowedAudio.getChannelData(0).every(x=>x===0));
  s.presenter.dispose();check('actual-owned-canvas-removed',s.container.querySelectorAll('canvas').length===0);
  return{checks,allPass:true};
 }catch(error){return{checks,allPass:false,errorCode:typeof error?.message==='string'&&/^[a-zA-Z0-9_-]{1,96}$/u.test(error.message)?error.message:'BROWSER_PRESENTATION_FAILURE'};}
 finally{AudioBufferSourceNode.prototype.start=s.originalStart;s.presenter.dispose();s.button.remove();s.container.remove();delete globalThis.__ownedChildPresentation;}
});}
async function boundedProof(page,finish=false){let timer;try{return await Promise.race([finish?finishBrowserProof(page):browserProof(page),new Promise((_,reject)=>{
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
 insist(/^\.tmp\/child-media-presentation-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(relative),'OWNED_NEW_UUID_REQUIRED');
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
  const code=compiled.outputText.replace(/(from\s+["'])(\.\/(?:childMediaDecode|childMedia|childDataNamespace|childProfile|childAccessPolicy|childPackage|childStaticSvg))(["'])/gu,'$1$2.js$3');
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
  args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-extensions','--mute-audio']});
 profileClosed=false;result.launches++;const edge=context.browser()?.version();insist(typeof edge==='string'&&edge.length>0&&edge.length<128,'ACTUAL_EDGE_VERSION_REQUIRED');result.toolVersions.edge=edge;
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==origin){result.externalRequests.push({protocol:url.protocol,hostname:url.hostname});await route.abort();}else await route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(origin,{waitUntil:'load',timeout:10000});
 const proof=await boundedProof(page);result.checks=proof.checks;result.generatedFixtures=proof.fixtures;insist(proof.allPass===true,'BROWSER_PRESENTATION_PROOF_FAILED');
 await page.click('#play-owned-narration',{timeout:10000});
 await page.waitForFunction(()=>globalThis.__ownedChildPresentation?.playSettled===true,{},{timeout:10000});
 await page.waitForFunction(()=>globalThis.__ownedChildPresentation?.presenter.getSnapshot().phase==='sealed',{},{timeout:10000});
 const finished=await boundedProof(page,true);result.checks.push(...finished.checks);insist(finished.allPass===true,'BROWSER_PRESENTATION_FINISH_FAILED');
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
