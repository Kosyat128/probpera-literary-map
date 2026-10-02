import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const SOURCE='938e61b1aa08f156833fd772eac1c4e644d4b727';
const RUN=path.join(HERE,'actual-a1'),CACHE=path.join(RUN,'cache');
const OUTPUT=path.join(ROOT,'.tmp','d266-public-account-a1');
const REUSE=path.resolve(HERE,'../s03-account-public-d262');
const TITLE='built canonical account routes remain private, bilingual and outside the globe runtime';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const require=createRequire(path.join(ROOT,'package.json'));
const git=args=>execFileSync('git',['--no-optional-locks','-c','safe.directory='+ROOT,...args],{cwd:ROOT,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024}).trim();
async function ref(file){const bytes=await fs.readFile(file);return{path:file,bytes:bytes.length,sha256:sha(bytes)};}
async function fresh(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'||Buffer.isBuffer(value)?value:json(value),{flag:'wx'});}
async function tree(directory,prefix=''){
 const rows=[];
 for(const item of await fs.readdir(path.join(directory,prefix),{withFileTypes:true})){
  const relative=[prefix,item.name].filter(Boolean).join('/'),file=path.join(directory,relative);
  assert.ok(!item.isSymbolicLink()&&!/^\.env(?:\.|$)/iu.test(item.name),relative);
  assert.equal(await fs.realpath(file),file);
  if(item.isDirectory())rows.push(...await tree(directory,relative));
  else{assert.ok(item.isFile());rows.push({...await ref(file),path:relative});}
 }
 return rows.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}

assert.equal(process.argv.length,2);
assert.equal(await fs.realpath(HERE),HERE);
assert.equal(git(['rev-parse','HEAD']),SOURCE);
assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
const pins={
 'src/pwa/account.css':'d6cfc6362e80052c83408c33b7dca1173f2da0766d624b5a4dd0f83f507e09b8',
 'tests/e2e/planet-account-pages.spec.mjs':'072f6be4f98375250704009183891faa72ace92ad385c05f03e728a34221571e',
};
for(const[name,hash]of Object.entries(pins))assert.equal((await ref(path.join(ROOT,name))).sha256,hash,name);
const helpers=[];
for(const[name,hash]of Object.entries({
 'compile.mjs':'f1cdc2e3a1a3fbcdde8b958a5d9db39be13915ec2ae758e85dbd6629bd06ba91',
 'public.config.mjs':'7cf5a3e4c236e4cd9584703a25290ebbd0a1e6539c504856ee6123df7ac0a9c8',
})){const r=await ref(path.join(REUSE,name));assert.equal(r.sha256,hash,name);helpers.push(r);}
helpers.push(await ref(fileURLToPath(import.meta.url)));
const {stagingSourceSnapshot,STAGING_SOURCE_ROOTS}=await import(pathToFileURL(path.join(ROOT,'scripts/mobile/pwa-staging-package.mjs')));
assert.equal(STAGING_SOURCE_ROOTS.length,13);
async function snapshot(){
 const source=await stagingSourceSnapshot(ROOT),rows=new Map(source.files.map(row=>[row.path,row]));
 const additionalRoots=['public','apps/admin/catalog-assets','reports/public-image-delivery.json','playwright.config.mjs'];
 for(const directory of additionalRoots.slice(0,2))for(const row of await tree(ROOT,directory))rows.set(row.path,row);
 for(const name of additionalRoots.slice(2))rows.set(name,{...await ref(path.join(ROOT,name)),path:name});
 return{sourceCommit:source.sourceCommit,roots:[...STAGING_SOURCE_ROOTS],additionalRoots,files:[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'))};
}
const before=await snapshot();assert.equal(before.sourceCommit,SOURCE);
assert.equal(path.dirname(OUTPUT),path.join(ROOT,'.tmp'));
await fs.mkdir(RUN);await fs.mkdir(CACHE);
await fs.mkdir(path.dirname(OUTPUT),{recursive:true});assert.equal(await fs.realpath(path.dirname(OUTPUT)),path.dirname(OUTPUT));
await fs.mkdir(OUTPUT);assert.equal(await fs.realpath(OUTPUT),OUTPUT);
await fresh(path.join(RUN,'source-before.json'),before);
const env={};
for(const key of['PATH','SystemRoot','WINDIR','COMSPEC','PATHEXT','USERPROFILE','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)'])if(process.env[key]!==undefined)env[key]=process.env[key];
Object.assign(env,{TEMP:RUN,TMP:RUN,NODE_ENV:'production',PUBLIC_SITE_ORIGIN:'https://probpera.ru',PUBLIC_SITE_BASE_PATH:'/',VITE_PUBLIC_SITE_URL:'https://probpera.ru'});
const commands=[];
async function command(name,args,extra={}){
 const start=new Date().toISOString();let execution;
 try{execution={...await promisify(execFile)(process.execPath,args,{cwd:CACHE,env:{...env,...extra},windowsHide:true,timeout:600000,maxBuffer:32*1024*1024}),exitCode:0};}
 catch(error){execution={stdout:error.stdout??'',stderr:error.stderr??'',exitCode:error.code,failure:error.message};}
 for(const stream of['stdout','stderr'])await fresh(path.join(RUN,name+'.'+stream+'.txt'),execution[stream]);
 const record={name,executable:process.execPath,args,cwd:CACHE,start,exitCode:execution.exitCode,...execution.failure?{failure:execution.failure}:{}};
 commands.push(record);await fresh(path.join(RUN,name+'.execution.json'),record);assert.equal(execution.exitCode,0,name);
}
const result={schemaVersion:1,decision:'D266',kind:'current-public-account-final-css',sourceCommit:SOURCE,nodeVersion:process.version,pass:false,stageAccepted:false,releaseReady:false,output:OUTPUT,helpers,commands,
 scope:{publicEdition:true,localQa:false,environmentFilesRead:false,publicDisabledFallback:true,configuredConsent:false,providerValidated:false,actualOsInstallation:false,fullVisualAcceptance:false,productionActionsPerformed:false,approvalsChanged:false},
 qualification:'One fresh source-bound canonical public Vite compilation and one existing mobile public-account fallback case. Final checkbox CSS is measured through observed compiled source modules. Four unique RU/EN account-route captures require ROOT review. Configured checked-consent paint remains separate evidence; no TSC, React/Auth/API fixture, CMS/article/SEO pipeline or stage acceptance.'};
let server,outputBefore,failure;
try{
 await command('compile',[path.join(REUSE,'compile.mjs'),ROOT,OUTPUT,CACHE,path.join(RUN,'compile-report.json')]);
 const compiler=JSON.parse(await fs.readFile(path.join(RUN,'compile-report.json'))),inputs=new Map(before.files.map(row=>[row.path,row])),observed=new Map();
 for(const module of compiler.modules){
  const id=module.id.split('?')[0];if(!path.isAbsolute(id))continue;
  const relative=path.relative(ROOT,id).split(path.sep).join('/');
  assert.ok(relative&&!relative.startsWith('../')&&!path.isAbsolute(relative),id);
  assert.ok(relative.startsWith('node_modules/')||inputs.has(relative),'Unbound compiled source: '+relative);
  const row={...await ref(id),path:relative};if(inputs.has(relative))assert.equal(row.sha256,inputs.get(relative).sha256,relative);
  observed.set(relative,row);
 }
 for(const name of['src/pwa/account.css','src/pwa/PlanetAccountPage.tsx'])assert.ok(observed.has(name),'Missing account module: '+name);
 await fresh(path.join(RUN,'observed-modules.json'),[...observed.values()].sort((a,b)=>a.path.localeCompare(b.path,'en')));
 result.observedModules=observed.size;result.accountCss=observed.get('src/pwa/account.css');

 const manifestSource=(await fs.readFile(path.join(ROOT,'scripts/build-article-pages.mjs'),'utf8')).replace(/\r\n/gu,'\n');
 const marker='await fs.writeFile(\n  path.join(distDirectory, "site.webmanifest"),';
 assert.equal(manifestSource.split(marker).length,2);
 const start=manifestSource.indexOf(marker),end=manifestSource.indexOf('\nawait fs.writeFile(',start+1);assert.ok(start>=0&&end>start);
 const block=manifestSource.slice(start,end);await fresh(path.join(RUN,'canonical-manifest-statement.mjs'),block+'\n');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 await new AsyncFunction('fs','path','distDirectory','siteRootPath','siteBasePath',block)({writeFile:async(file,bytes,encoding)=>{assert.equal(file,path.join(OUTPUT,'site.webmanifest'));assert.equal(encoding,'utf8');await fresh(file,bytes);}},path,OUTPUT,'/','');
 result.manifest={source:inputs.get('scripts/build-article-pages.mjs'),statementSha256:sha(block+'\n'),qualification:'Exact canonical site.webmanifest write statement only, with siteRootPath / and empty siteBasePath; no broader generator/writer pipeline.'};
 const {capturePublicLocaleSourceSnapshot}=await import(pathToFileURL(path.join(ROOT,'scripts/mobile/write-public-locale-pages.mjs')));
 await fresh(path.join(RUN,'compiled-snapshot.json'),await capturePublicLocaleSourceSnapshot({directory:OUTPUT}));
 const {generatePlanetAccountPages}=await import(pathToFileURL(path.join(ROOT,'scripts/mobile/account-pages.mjs')));
 const generated=generatePlanetAccountPages({builtHtml:await fs.readFile(path.join(OUTPUT,'index.html'),'utf8')});
 const expectedRoutes=['en/delete-account/index.html','en/planet-account/index.html','ru/delete-account/index.html','ru/planet-account/index.html'];
 assert.deepEqual(Object.keys(generated.files).sort(),expectedRoutes);assert.equal(generated.routes.length,4);assert.equal(generated.releaseReady,false);
 for(const[name,bytes]of Object.entries(generated.files))await fresh(path.join(OUTPUT,name),bytes);
 await fresh(path.join(RUN,'route-manifest.json'),{releaseReady:generated.releaseReady,routes:generated.routes,excluded:generated.excluded,files:expectedRoutes});
 outputBefore=await tree(OUTPUT);await fresh(path.join(RUN,'output-before.json'),outputBefore);
 result.publicBuildSha256=sha(json(outputBefore));result.builtFiles=outputBefore.length;

 const mimes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.json':'application/json','.ico':'image/x-icon'};
 server=http.createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),target=path.resolve(OUTPUT,pathname.replace(/^\/+/,''));
   assert.ok(target===OUTPUT||target.startsWith(OUTPUT+path.sep));
   const stat=await fs.stat(target),file=stat.isDirectory()?path.join(target,'index.html'):target;assert.equal(await fs.realpath(file),file);
   const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':mimes[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store','Content-Length':bytes.length,'X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const origin='http://127.0.0.1:'+server.address().port;result.origin=origin;
 await command('browser',[require.resolve('@playwright/test/cli'),'test','--config',path.join(REUSE,'public.config.mjs'),'--grep',TITLE,'--workers=1'],{D262_ROOT:ROOT,D262_RUN:RUN,D262_ORIGIN:origin,PLANET_ACCOUNT_CAPTURES:'1',PLAYWRIGHT_JSON_OUTPUT_FILE:path.join(RUN,'playwright.json')});
 const browser=JSON.parse(await fs.readFile(path.join(RUN,'playwright.json')));
 assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[1,0,0,0]);
 const images=(await tree(path.join(RUN,'browser-output'))).filter(row=>row.path.endsWith('.png'));
 const captures=images.filter(row=>!row.path.split('/').includes('attachments'));
 assert.equal(captures.length,4);assert.deepEqual(captures.map(row=>path.basename(row.path)).sort(),['delete-account-en.png','delete-account-ru.png','planet-account-en.png','planet-account-ru.png']);
 const captureHashes=new Set(captures.map(row=>row.sha256));assert.equal(captureHashes.size,4);
 for(const row of images)assert.ok(captureHashes.has(row.sha256),'Unexpected capture bytes: '+row.path);
 result.captures=captures;result.browserCases=1;
 result.captureAttachmentCopies=images.length-captures.length;
 result.captureQualification='Four unique PNG files counted once; Playwright copied attachments are not counted as additional images.';
}catch(error){failure=error;result.failure=error.stack;}
finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 try{
  const after=await snapshot();await fresh(path.join(RUN,'source-after.json'),after);assert.deepEqual(after,before);
  assert.equal(git(['rev-parse','HEAD']),SOURCE);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
  for(const helper of helpers)assert.equal((await ref(helper.path)).sha256,helper.sha256,helper.path);
  result.sourceBeforeAfterEqual=true;
  const outputAfter=await tree(OUTPUT);await fresh(path.join(RUN,'output-after.json'),outputAfter);
  if(outputBefore){assert.deepEqual(outputAfter,outputBefore);result.outputBeforeAfterEqual=true;}
 }catch(error){failure??=error;result.guardFailure=error.stack;}
 result.pass=!failure;result.checks={freshPublicCompilations:commands.filter(row=>row.name==='compile').length,existingPublicMobileCases:result.browserCases??0,declaredSnapshotRoots:13,additionalSnapshotInputs:before.additionalRoots.length,sourceRows:before.files.length,sourceBeforeAfterEqual:result.sourceBeforeAfterEqual??false,outputBeforeAfterEqual:result.outputBeforeAfterEqual??false};
 await fresh(path.join(RUN,'result.json'),result);
}
if(failure)throw failure;
console.log(json({pass:result.pass,sourceCommit:SOURCE,publicBuildSha256:result.publicBuildSha256,browserCases:result.browserCases,uniqueCaptures:result.captures.length}));
