/** Read-only historical artifact probe. Intentionally contains no PWA install/uninstall command. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, mkdtemp, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { containedFile, pwaAuthoritySha256 } from '../../scripts/mobile/pwa-artifact.mjs';

const root = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const base = path.join(root, '.tmp', 'native-bootstrap');
assert.equal(await realpath(base), base);
assert.equal((await lstat(base)).isSymbolicLink(), false);
const output = await mkdtemp(path.join(base, 'pwa-cdp-capability-'));
// Keep CacheStorage's additional hash/UUID filenames below legacy Windows path limits.
const profile = await mkdtemp(path.join(root, '.tmp', 'cdp-'));
assert.equal(await realpath(profile), profile);
const hash = value => createHash('sha256').update(value).digest('hex');
const artifactRoot = path.join(root, 'dist-pwa');
assert.equal(await realpath(artifactRoot), artifactRoot);
const artifactBytes = (await containedFile(artifactRoot, 'artifact.json')).bytes;
const artifact = JSON.parse(artifactBytes);
assert.equal(artifact.buildId, 'b006c2757ee7e5bacc6b946d8c7dcd880c0760da74ff3d39d752095b38b26c6d');
assert.equal(hash(artifactBytes), '6dc25b0b7fcc472efb69b19cbcf274ed79204134f92cc13b742ce2a555699f37');
assert.equal(artifact.localQaAuthority, true);
assert.equal(artifact.releaseReady, false);
const files = new Map();
for (const entry of artifact.inventory) {
  const bytes = (await containedFile(artifactRoot, entry.path)).bytes;
  assert.equal(bytes.length, entry.bytes, entry.path);
  assert.equal(hash(bytes), entry.sha256, entry.path);
  files.set(entry.path, bytes);
}
const authorityPath = '.tmp/pwa-qa/authority.json';
const authorityBytes = (await containedFile(root, authorityPath)).bytes;
assert.equal(pwaAuthoritySha256(JSON.parse(authorityBytes)), artifact.authoritySha256);
assert.equal(pwaAuthoritySha256(JSON.parse(files.get('license-authority.json'))), artifact.authoritySha256);
const report = {
  schemaVersion: 1, kind: 'historical-pwa-cdp-capability-and-locked-shell', startedAt: new Date().toISOString(),
  output: path.relative(root, output).replaceAll('\\', '/'), profile: path.relative(root, profile).replaceAll('\\', '/'),
  buildId: artifact.buildId, artifactSha256: hash(artifactBytes), authoritySha256: artifact.authoritySha256,
  authorityFileSha256: hash(authorityBytes), inventoryFilesVerified: files.size,
  harnessSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  nativeInstallationVerified: false, osIntegrationPerformed: false, authorizedGlobeVerified: false,
  limitations: ['Historical signer key was memory-only and its server is closed. All license endpoints deliberately respond 503.',
    'No grant injected and no artifact bytes changed. This can verify cached locked shell, not paid globe access.',
    'No PWA.install/uninstall call: separate Chrome profile does not itself isolate Windows shortcuts/registry.',
    'Headless Windows Chrome only; not physical mobile, Safari, user-visible install UI or stage acceptance.'],
  checks: [], errors: [], cleanup: {},
};
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.geojson':'application/geo+json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png',
  '.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon','.txt':'text/plain'};
const csp = "default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'";
const requests = [], deniedExternalRequests = [], browserConsole = [], workerDiagnostics = [], workerErrors = [], sockets = new Set();
let origin, context;
const server = http.createServer((req,res) => {
  try {
    if (req.headers.host !== new URL(origin).host || !req.url?.startsWith('/') || req.url.startsWith('//')) throw Error('Invalid loopback request');
    const url = new URL(req.url, origin);
    const requestRecord = { method: req.method, pathname: url.pathname };
    requests.push(requestRecord);
    res.once('finish',()=>{requestRecord.status=res.statusCode;requestRecord.contentType=res.getHeader('Content-Type');});
    if (!url.pathname.startsWith('/planet/') || /[%\\]/u.test(url.pathname) || url.pathname.split('/').some(p=>p==='..'||p==='.')) throw Error('Invalid path');
    const headers = {'Content-Security-Policy': csp, 'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'};
    if (url.pathname.startsWith('/planet/api/')) {res.writeHead(503, {...headers,'Content-Type':'application/json'});res.end('{}');return;}
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,headers);res.end();return;}
    let relative = url.pathname.slice('/planet/'.length);
    if (['','ru/','en/'].includes(relative)) relative += 'index.html';
    const bytes = files.get(relative);
    if (!bytes) {res.writeHead(404,headers);res.end();return;}
    const actualHeaders = {...headers,'Content-Type': MIME[path.extname(relative)]??'application/octet-stream','Content-Length':bytes.length,
      ...(relative==='sw.js'?{'Service-Worker-Allowed':'/planet/','Cache-Control':'no-cache'}:{'Cache-Control':'public, max-age=0, must-revalidate'})};
    requestRecord.responseHeaders=actualHeaders;
    res.writeHead(200,actualHeaders);
    res.end(req.method==='HEAD'?undefined:bytes);
  } catch {res.writeHead(400,{'Cache-Control':'no-store'});res.end();}
});
server.on('connection', socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
origin='http://127.0.0.1:'+server.address().port;
report.origin=origin;
try {
  context = await chromium.launchPersistentContext(profile, {channel:'chrome',headless:true,viewport:{width:1280,height:900},
    args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--no-default-browser-check','--no-first-run']});
  context.on('console',message=>browserConsole.push({type:message.type(),text:message.text()}));
  context.on('serviceworker',worker=>{
    workerDiagnostics.push({event:'created',url:worker.url()});
    worker.on('close',()=>workerDiagnostics.push({event:'closed',url:worker.url()}));
  });
  await context.route('**/*',async route=>{
    const url = new URL(route.request().url());
    if (url.origin === origin) await route.continue();
    else {deniedExternalRequests.push(url.origin+url.pathname);await route.abort('blockedbyclient');}
  });
  const page=context.pages()[0]??await context.newPage();
  const session=await context.newCDPSession(page);
  session.on('ServiceWorker.workerErrorReported',event=>workerErrors.push(event));
  await session.send('ServiceWorker.enable');
  report.browser=await session.send('Browser.getVersion');
  await page.goto(origin+'/planet/ru/?country=russia#atlas');
  await expect(page.locator('[data-pwa-access-state="closed"]')).toBeVisible({timeout:30_000});
  await expect(page.locator('[data-pwa-authorized]')).toHaveCount(0);
  report.checks.push({name:'real-historical-app-remains-closed-without-grant',pass:true});
  report.manifest=await session.send('Page.getAppManifest');
  report.installability=await session.send('Page.getInstallabilityErrors');
  try {report.pwaState=await session.send('PWA.getOsAppState',{manifestId:origin+'/planet/'});}
  catch(error){report.pwaCapability={methodRecognized: !String(error.message).includes("wasn't found"), outcome:'not-installed-or-unavailable',message:String(error.message)};}
  await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL??''),{timeout:60_000}).toBe(origin+'/planet/sw.js');
  report.cacheMarker=await page.evaluate(async()=>{
    for(const name of await caches.keys())if(name.startsWith('literary-planet-pwa-v1-')){
      const item=await (await caches.open(name)).match('/planet/__pwa_complete__');if(item)return item.json();
    }return null;
  });
  assert.equal(report.cacheMarker?.state,'COMPLETE');
  assert.equal(report.cacheMarker?.manifest?.buildId,artifact.buildId);
  report.checks.push({name:'actual-service-worker-core-complete',pass:true});
  await page.locator('.interface-language-control button').filter({hasText:'EN'}).click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  assert.equal(new URL(page.url()).pathname,'/planet/en/');
  assert.equal(new URL(page.url()).search,'?country=russia');
  assert.equal(new URL(page.url()).hash,'#atlas');
  report.checks.push({name:'locked-shell-global-language-preserves-url-state',pass:true});
  report.online={language:await page.locator('html').getAttribute('lang'),title:await page.title(),status:await page.locator('.pwa-access__status').innerText(),standalone:await page.evaluate(()=>matchMedia('(display-mode: standalone)').matches)};
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-pwa-access-state="closed"]')).toBeVisible({timeout:30_000});
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  report.offline={language:await page.locator('html').getAttribute('lang'),status:await page.locator('.pwa-access__status').innerText(),navigatorOnline:await page.evaluate(()=>navigator.onLine),contextTransportOffline:true};
  await page.locator('.interface-language-control button').filter({hasText:'RU'}).click();
  await expect(page.locator('html')).toHaveAttribute('lang','ru');
  await expect(page.locator('[data-pwa-authorized]')).toHaveCount(0);
  report.checks.push({name:'cold-offline-real-locked-shell-en-ru',pass:true});
  await page.screenshot({path:path.join(output,'locked-offline-ru.png')});
  report.completed=true;
}catch(error){report.errors.push(String(error.stack??error));report.completed=false;process.exitCode=1;}
finally{
  if(context){await context.close();report.cleanup.ownedBrowserContextClosed=true;}
  for(const socket of sockets)socket.destroy();
  await new Promise(resolve=>server.close(resolve));report.cleanup.loopbackServerClosed=true;
  report.cleanup.profileRetainedForEvidence=true;report.cleanup.systemCleanupPerformed=false;
  report.requests=requests;report.deniedExternalRequests=deniedExternalRequests;
  report.browserConsole=browserConsole;report.workerDiagnostics=workerDiagnostics;report.workerErrors=workerErrors;
  report.preservedArtifactUnchanged=hash((await containedFile(artifactRoot,'artifact.json')).bytes)===report.artifactSha256;
  report.preservedAuthorityUnchanged=hash((await containedFile(root,authorityPath)).bytes)===report.authorityFileSha256;
  report.completedAt=new Date().toISOString();
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({output:report.output,completed:report.completed,checks:report.checks,errors:report.errors,
    pwaCapability:report.pwaCapability,installability:report.installability,nativeInstallationVerified:false,
    preservedArtifactUnchanged:report.preservedArtifactUnchanged,preservedAuthorityUnchanged:report.preservedAuthorityUnchanged},null,2));
}
