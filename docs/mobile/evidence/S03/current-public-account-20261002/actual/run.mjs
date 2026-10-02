import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const BASE='32977495c0721a01408d331e9f6a203dae695c62';
const CASE='tests/e2e/planet-account-pages.spec.mjs';
const TITLE='built canonical account routes remain private, bilingual and outside the globe runtime';
const RUN=path.join(HERE,'actual-a5'),OUTPUT=path.join(ROOT,'.tmp/d262-public-account-a2');
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
const git=args=>execFileSync('git',['-c','safe.directory='+ROOT,'-c','core.autocrlf=true','-c','core.whitespace=cr-at-eol',...args],{cwd:ROOT,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024}).trim();
const require=createRequire(path.join(ROOT,'package.json'));
const at=f=>path.isAbsolute(f)?f:path.join(ROOT,f);
async function fresh(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'||Buffer.isBuffer(value)?value:json(value),{flag:'wx'});}
async function ref(file){const bytes=await fs.readFile(file);return {path:file,bytes:bytes.length,sha256:sha(bytes)};}
async function tree(directory,prefix=''){
 const result=[];
 for(const item of await fs.readdir(path.join(directory,prefix),{withFileTypes:true})){
  const relative=[prefix,item.name].filter(Boolean).join('/');assert.ok(!item.isSymbolicLink()&&!/^\.env(?:\.|$)/u.test(item.name),relative);
  if(item.isDirectory())result.push(...await tree(directory,relative));
  else{assert.ok(item.isFile());const r=await ref(path.join(directory,relative));result.push({...r,path:relative});}
 }
 return result.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
async function snapshot(){
 const {stagingSourceSnapshot,STAGING_SOURCE_ROOTS}=await import(pathToFileURL(path.join(ROOT,'scripts/mobile/pwa-staging-package.mjs')));
 const source=await stagingSourceSnapshot(ROOT),records=new Map(source.files.map(r=>[r.path,r]));
 for(const directory of ['public','apps/admin/catalog-assets'])for(const r of await tree(ROOT,directory))records.set(r.path,r);
 for(const name of ['reports/public-image-delivery.json','playwright.config.mjs'])records.set(name,{...await ref(at(name)),path:name});
 return {sourceCommit:source.sourceCommit,roots:[...STAGING_SOURCE_ROOTS,'public','apps/admin/catalog-assets','reports/public-image-delivery.json','playwright.config.mjs'],files:[...records.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'))};
}
async function apply(){
 assert.equal(git(['rev-parse','HEAD']),BASE);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
 const filename=at(CASE),original=await fs.readFile(filename,'utf8');assert.equal(sha(original),'3d6f859567ba363e0f2eb4db5bc4a20432477ebc44501c6be27cd66cbff89262');
 let revised=original.replace('async ({ page, request }) => {','async ({ page, request }, testInfo) => {');
 const needle='      expect(await page.locator("main[data-planet-account]").evaluate((node, previous) => node === previous, original)).toBe(true);';
 assert.equal(revised.split(needle).length,2);
 revised=revised.replace(needle,needle+'\n      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);\n      for (const flag of await page.locator(".planet-account__header [data-interface-language]").all()) {\n        const box = await flag.boundingBox(); expect(box).not.toBeNull();\n        expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);\n      }\n      if (process.env.PLANET_ACCOUNT_CAPTURES === "1") {\n        const capture = testInfo.outputPath(`${name}-${locale}.png`);\n        await page.screenshot({ path: capture, fullPage: true });\n        await testInfo.attach(`${name}-${locale}`, { path: capture, contentType: "image/png" });\n      }');
 assert.notEqual(revised,original);await fresh(path.join(HERE,'original.spec.mjs'),original);await fresh(path.join(HERE,'proposed.spec.mjs'),revised);
 await fs.writeFile(filename,revised);git(['diff','--check']);assert.equal(git(['diff','--name-only']),CASE);
 git(['add','--',CASE]);git(['diff','--cached','--check']);assert.equal(git(['diff','--cached','--name-only']),CASE);
 git(['commit','-m','test: capture current public account mobile language states']);
 assert.equal(git(['rev-parse','HEAD^']),BASE);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
 await fresh(path.join(HERE,'source-commit.json'),{sourceCommit:git(['rev-parse','HEAD']),parent:BASE,changedFiles:[CASE],testsPending:true,originalSha256:sha(original),fixtureSha256:sha(revised)});
 console.log(json({mode:'apply',sourceCommit:git(['rev-parse','HEAD']),testsPending:true}));
}
async function run(){
 const sourceCommit=JSON.parse(await fs.readFile(path.join(HERE,'source-commit.json'))).sourceCommit;
 assert.equal(git(['rev-parse','HEAD']),sourceCommit);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
 await fs.mkdir(RUN);assert.ok(path.relative(ROOT,OUTPUT).startsWith('.tmp'+path.sep));assert.equal(await fs.realpath(OUTPUT),OUTPUT);
 const cache=path.join(RUN,'cache');await fs.mkdir(cache);const before=await snapshot();await fresh(path.join(RUN,'source-before.json'),before);
 const helpers=await Promise.all(['run.mjs','compile.mjs','public.config.mjs'].map(name=>ref(path.join(HERE,name))));
 const tools=await Promise.all(['vite','@vitejs/plugin-react','vitest','typescript','esbuild','cheerio','@playwright/test','playwright','playwright-core'].map(async name=>{const p=path.join(ROOT,'node_modules',name,'package.json');return {name,version:JSON.parse(await fs.readFile(p)).version,...await ref(p)};}));
 const env={};for(const key of ['PATH','SystemRoot','WINDIR','COMSPEC','PATHEXT','USERPROFILE','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)'])if(process.env[key]!==undefined)env[key]=process.env[key];
 Object.assign(env,{TEMP:RUN,TMP:RUN,NODE_ENV:'production',PUBLIC_SITE_ORIGIN:'https://probpera.ru',PUBLIC_SITE_BASE_PATH:'/',VITE_PUBLIC_SITE_URL:'https://probpera.ru'});
 const commands=[];async function command(name,args,extra={}){
  const start=new Date().toISOString();let result;
  try{result={...await promisify(execFile)(process.execPath,args,{cwd:cache,windowsHide:true,timeout:600000,maxBuffer:32*1024*1024,env:{...env,...extra}}),exitCode:0};}
  catch(error){result={stdout:error.stdout??'',stderr:error.stderr??'',exitCode:error.code,failure:error.message};}
  for(const stream of ['stdout','stderr'])await fresh(path.join(RUN,name+'.'+stream+'.txt'),result[stream]);
  const row={name,executable:process.execPath,args,cwd:cache,start,exitCode:result.exitCode,...result.failure?{failure:result.failure}:{}};
  commands.push(row);await fresh(path.join(RUN,name+'.execution.json'),row);assert.equal(result.exitCode,0,name);
 }
 const outcome={schemaVersion:1,decision:'D262',kind:'current-public-account-mobile-fallback',sourceCommit,pass:false,stageAccepted:false,releaseReady:false,output:OUTPUT,helpers,tools,commands,scope:{publicEdition:true,localQa:false,environmentFilesRead:false,providerValidated:false,legalApproved:false,actualOsInstallation:false,fullVisualAcceptance:false,productionActionsPerformed:false}};
 let server;
 try{
  const earlier=path.join(HERE,'actual-a2');assert.deepEqual(before,JSON.parse(await fs.readFile(path.join(earlier,'source-before.json'))));
  const compiledExecution=JSON.parse(await fs.readFile(path.join(earlier,'compile.execution.json')));assert.equal(compiledExecution.exitCode,0);
  const compileBytes=await fs.readFile(path.join(earlier,'compile-report.json'));await fresh(path.join(RUN,'compile-report.json'),compileBytes);
  outcome.retainedFreshCompilation={execution:await ref(path.join(earlier,'compile.execution.json')),report:await ref(path.join(earlier,'compile-report.json')),recompiled:false,browserWasNotPreviouslyRun:true};
  const report=JSON.parse(compileBytes),sourceNames=new Set(before.files.map(r=>r.path)),observed=[];
  for(const module of report.modules){const id=module.id.split('?')[0];if(!path.isAbsolute(id))continue;const relative=path.relative(ROOT,id).split(path.sep).join('/');assert.ok(relative&&!relative.startsWith('../')&&!path.isAbsolute(relative),id);assert.ok(relative.startsWith('node_modules/')||sourceNames.has(relative),'Unbound source module: '+relative);observed.push({...await ref(id),path:relative});}
  await fresh(path.join(RUN,'observed-modules.json'),observed);
  assert.deepEqual(observed,JSON.parse(await fs.readFile(path.join(earlier,'observed-modules.json'))));
  await fresh(path.join(RUN,'output-resume-before.json'),await tree(OUTPUT));
  const manifestSource=(await fs.readFile(at('scripts/build-article-pages.mjs'),'utf8')).replace(/\r\n/gu,'\n');
  const start=manifestSource.indexOf('await fs.writeFile(\n  path.join(distDirectory, "site.webmanifest"),');assert.ok(start>=0);
  const end=manifestSource.indexOf('\nawait fs.writeFile(',start+1);assert.ok(end>start);const manifestBlock=manifestSource.slice(start,end);
  await fresh(path.join(RUN,'canonical-manifest-statement.mjs'),manifestBlock+'\n');
  const manifestFs={writeFile:async(filename,bytes,encoding)=>{assert.equal(filename,path.join(OUTPUT,'site.webmanifest'));assert.equal(encoding,'utf8');assert.equal(await fs.readFile(filename,'utf8'),bytes);}};
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;await new AsyncFunction('fs','path','distDirectory','siteRootPath','siteBasePath',manifestBlock)(manifestFs,path,OUTPUT,'/','');
  outcome.manifestQualification='Exact source-bound site.webmanifest write statement from canonical build-article-pages.mjs, using canonical base / variables; no full article/SEO/export pipeline or source writes.';
  assert.deepEqual(await tree(OUTPUT),JSON.parse(await fs.readFile(path.join(HERE,'actual-a4/output-before.json'))));
  const compiled=JSON.parse(await fs.readFile(path.join(HERE,'actual-a4/compiled-snapshot.json')));await fresh(path.join(RUN,'compiled-snapshot.json'),compiled);
  const {generatePlanetAccountPages}=await import(pathToFileURL(at('scripts/mobile/account-pages.mjs')));
  const generated=generatePlanetAccountPages({builtHtml:await fs.readFile(path.join(OUTPUT,'index.html'),'utf8')});
  for(const [relative,content]of Object.entries(generated.files)){assert.ok(/^(?:ru|en)\/(?:planet-account|delete-account)\/index\.html$/u.test(relative));assert.equal(await fs.readFile(path.join(OUTPUT,relative),'utf8'),content);}
  const routes={releaseReady:generated.releaseReady,accountRoutes:generated.routes,excluded:generated.excluded,files:Object.keys(generated.files)};assert.equal(routes.releaseReady,false);assert.equal(routes.accountRoutes.length,4);await fresh(path.join(RUN,'route-manifest.json'),routes);
  const files=await tree(OUTPUT);await fresh(path.join(RUN,'output-before.json'),files);
  const mimes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
  server=http.createServer(async(req,res)=>{try{const relative=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,''),target=path.resolve(OUTPUT,relative);assert.ok(target===OUTPUT||target.startsWith(OUTPUT+path.sep));const stat=await fs.stat(target),filename=stat.isDirectory()?path.join(target,'index.html'):target;assert.equal(await fs.realpath(filename),filename);const bytes=await fs.readFile(filename);res.writeHead(200,{'Content-Type':mimes[path.extname(filename)]??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});const origin='http://127.0.0.1:'+server.address().port;
  const {load}=require('cheerio'),heads=[];
  for(const route of routes.accountRoutes){const response=await fetch(origin+route.pathname),bytes=await response.text(),$=load(bytes);assert.equal(response.status,200);assert.equal($('html').attr('lang'),route.locale);assert.equal($('meta[name="robots"]').attr('content'),'noindex,nofollow');assert.equal($('link[rel="canonical"]').attr('href'),route.canonical);assert.equal($('script[type="module"]').length,1);assert.equal(JSON.parse($('script[data-planet-account-structured-data]').text()).inLanguage,route.locale);for(const locale of ['ru','en'])assert.equal($(`link[hreflang="${locale}"]`).attr('href'),`https://probpera.ru/${locale}/${route.mode==='access'?'planet-account':'delete-account'}/`);heads.push({pathname:route.pathname,status:response.status,title:$('title').text(),sha256:sha(bytes),noindex:true});}
  await fresh(path.join(RUN,'http-head-content.json'),heads);
  await command('browser',[require.resolve('@playwright/test/cli'),'test','--config',path.join(HERE,'public.config.mjs'),'--grep',TITLE,'--workers=1'],{D262_ROOT:ROOT,D262_RUN:RUN,D262_ORIGIN:origin,PLANET_ACCOUNT_CAPTURES:'1',PLAYWRIGHT_JSON_OUTPUT_FILE:path.join(RUN,'playwright.json')});
  const browser=JSON.parse(await fs.readFile(path.join(RUN,'playwright.json')));assert.equal(browser.stats.expected,1);assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.skipped,0);
  const after=await snapshot();await fresh(path.join(RUN,'source-after.json'),after);assert.deepEqual(after,before);assert.deepEqual(await tree(OUTPUT),files);await fresh(path.join(RUN,'output-after.json'),files);
  const captures=(await tree(path.join(RUN,'browser-output'))).filter(r=>r.path.endsWith('.png'));assert.equal(captures.length,4);
  Object.assign(outcome,{pass:true,origin,publicSourceFiles:before.files.length,compiledModules:observed.length,builtFiles:files.length,publicBuildSha256:sha(json(files)),browserCases:1,httpRoutes:heads.length,captures,qualification:'Source-bound canonical site compilation and public HTTP unavailable fallback only. No controlled QA edition, Auth/API stubs, configured provider, live deletion, checked-consent paint, installed-device or stage acceptance. Existing 13-root snapshot extended with copied public assets, admin catalog assets and image-delivery report; observed compiled modules checked against this inventory. Installed-tool metadata and observed module bytes are recorded, not an exhaustive installed dependency closure.'});
 }catch(error){outcome.failure=error.stack;throw error;}
 finally{if(server)await new Promise(resolve=>server.close(resolve));await fresh(path.join(RUN,'result.json'),outcome);}
 console.log(json({mode:'run',pass:outcome.pass,sourceCommit,publicBuildSha256:outcome.publicBuildSha256,browserCases:outcome.browserCases,captures:outcome.captures.length}));
}
const mode=process.argv[2];assert.equal(process.argv.length,3);if(mode==='apply')await apply();else if(mode==='run')await run();else throw new Error('Unknown mode');
