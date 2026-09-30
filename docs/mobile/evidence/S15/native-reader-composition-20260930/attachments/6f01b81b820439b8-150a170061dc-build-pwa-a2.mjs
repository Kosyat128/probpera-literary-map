import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { guardBuild } from '../runtime-build-review-a1/guard-build.mjs';
import { pathToFileURL } from 'node:url';
const bound = await guardBuild(process.argv.slice(2));
const { root, expectedSource, sourceManifest, verifySource } = bound;
assert.equal(expectedSource,'5c66d6aa0061fe915e6c8fa6ef23fc6b1664a63c');
assert.equal(sourceManifest.sha256,'c785a629ec20371617288bc2edeafbb672a1a3fdb09b9c81466797623b45b1db');
const { startPwaQaServer } = await import(pathToFileURL(root + '/tests/pwa/support/local-server.mjs').href);
// Each standalone invocation owns its Git environment; no global config change.
Object.assign(process.env, { GIT_CONFIG_COUNT: '3', GIT_CONFIG_KEY_0: 'safe.directory',
  GIT_CONFIG_VALUE_0: 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work',
  GIT_CONFIG_KEY_1: 'core.autocrlf', GIT_CONFIG_VALUE_1: 'false',
  GIT_CONFIG_KEY_2: 'safe.directory', GIT_CONFIG_VALUE_2: 'D:/CodexProjects/Работа по сайту/literary-planet-v12-work' });

const folder = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-reader-foreground-review/runtime-build-diagnostic-review-a2', out = folder + '/pwa-a2';
await assert.rejects(fs.stat(out), { code: 'ENOENT' }); await fs.mkdir(out);
const artifactRoot = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-reader-foreground-runtime-build-evidence/attempt-a2/pwa';
const shortTemp = (await fs.realpath(root)) + '/.tmp/pwa-d217-a2-temp';
assert.ok(path.relative(await fs.realpath(root),shortTemp).startsWith('.tmp'+path.sep));
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const save = (name, value) => fs.writeFile(out + '/' + name, json(value), { flag: 'wx' });
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, maxBuffer:64*1024*1024 }).trim();
assert.equal(git(['rev-parse', 'HEAD']), expectedSource);
assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'index.html', 'package.json', 'package-lock.json',
  'tsconfig.json', 'vite.config.ts', 'vite.pwa.config.ts', 'data/book-canon-source-registry.json',
  'scripts/mobile/build-pwa.mjs', 'scripts/mobile/pwa-artifact.mjs', 'scripts/mobile/pwa-portrait-selection.mjs',
  'scripts/mobile/pwa-shell.mjs', 'scripts/mobile/native-base-assets.json']), '');
const requestedBrowserChannel=process.env.S15_BROWSER_CHANNEL ?? 'msedge';assert.equal(requestedBrowserChannel,'msedge');process.env.S15_BROWSER_CHANNEL=requestedBrowserChannel;
const priorRef={path:root+'/docs/mobile/evidence/S15/booky-globe-focus-race-20260930/pwa-a2/result.json',sha256:'0e38a7ca50083a17d4062eed7a0950681d97485c690cf699d5c33b64e3029463'};
assert.equal(sha(await fs.readFile(priorRef.path)),priorRef.sha256);
const prior=await read(priorRef.path);assert.equal(prior.pass,true);assert.equal(prior.sourceCommit,'dd041380a75da0c1349908c1dd7a8269f22cc981');assert.equal(prior.buildId,'a70b0aacb583e46bbb1936d373511d4a800f60e32abfc97cf657893f47266965');assert.equal(prior.artifact.exactCopiesVerified,true);
assert.ok((await fs.stat(prior.artifact.path)).isDirectory());
await save('prior-preservation.json',{priorResult:priorRef,sourceCommit:prior.sourceCommit,buildId:prior.buildId,artifactPath:prior.artifact.path,priorDirectoryPresent:true,priorPayloadHashesRechecked:false,originalAuthenticationRetained:true});
Object.assign(process.env, { TEMP: shortTemp, TMP: shortTemp,
  PWA_QA_CONTROL_PATH: '.tmp/pwa-qa/s15-booky-reader-foreground-runtime-20260930-a2-server.json', PWA_QA_ORIGIN: 'http://127.0.0.1:4301',
  S15_PWA_OUTPUT: artifactRoot + '/browser-a1', S15_PWA_REPORT: path.resolve(out, 'browser-a1-playwright.json') });
for(const p of [process.env.S15_PWA_OUTPUT,artifactRoot+'/profiles']){assert.ok(path.resolve(p).startsWith(path.resolve(artifactRoot)+path.sep));await assert.rejects(fs.stat(p),{code:'ENOENT'});}
await assert.rejects(fs.stat(shortTemp),{code:'ENOENT'});
Object.assign(process.env,{S15_BROWSER_PROFILE_ROOT:artifactRoot+'/profiles',S11_BROWSER_PROFILE_ROOT:artifactRoot+'/profiles'});
await fs.mkdir(process.env.TEMP, { recursive: true });
for (const filename of [process.env.PWA_QA_CONTROL_PATH, '.tmp/pwa-qa/s15-booky-reader-foreground-runtime-20260930-a2-authority.json']) await assert.rejects(fs.stat(filename), { code: 'ENOENT' });
async function command(name, args, allowFailure = false) {
  const began = Date.now(), stdout = [], stderr = [];
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', bytes => stdout.push(bytes)); child.stderr.on('data', bytes => stderr.push(bytes));
    child.once('error', reject); child.once('close', resolve);
  });
  const logs = {};
  for (const [stream, chunks] of [['stdout', stdout], ['stderr', stderr]]) {
    const file = out + '/' + name + '-' + stream + '.log', bytes = Buffer.concat(chunks);
    await fs.writeFile(file, bytes, { flag: 'wx' }); logs[stream] = { path: file, bytes: bytes.length, sha256: sha(bytes) };
  }
  await save(name + '-execution.json', { command: [process.execPath, ...args], exitCode: code, durationMs: Date.now() - began, ...logs });
  if (!allowFailure) assert.equal(code, 0, name + ' failed'); return Buffer.concat(stdout).toString('utf8');
}
let server, artifact, failure = null, preserved = null, browser = null;
const browserAttempts=[]; const handledCommands=new Set();
const commandPath=out+'/owner-command.json';
const requests=()=>({observedAt:new Date().toISOString(),safeFields:['method','pathname'],retentionLimit:2000,rows:server.getRequests()});
async function browserAttempt(number){
  const label='browser-a'+number;
  process.env.S15_PWA_OUTPUT=artifactRoot+'/'+label;process.env.S15_PWA_REPORT=out+'/'+label+'-playwright.json';
  await assert.rejects(fs.stat(process.env.S15_PWA_OUTPUT),{code:'ENOENT'});
  process.env.DEBUG='pw:browser';
  await command(label,['node_modules/@playwright/test/cli.js','test','--config='+folder+'/pwa-a2.config.mjs'],true);
  const execution=await read(out+'/'+label+'-execution.json');let report=null,stats=null,reportError=null;
  try{const bytes=await fs.readFile(process.env.S15_PWA_REPORT);report={path:process.env.S15_PWA_REPORT,sha256:sha(bytes)};stats=JSON.parse(bytes).stats;}catch(error){reportError={name:error.name,message:error.message};}
  const pass=execution.exitCode===0&&stats?.expected===1&&stats?.unexpected===0&&stats?.skipped===0&&stats?.flaky===0;
  await save(label+'-result.json',{pass,sourceCommit:expectedSource,sourceManifest,buildId:artifact.buildId,recordedAt:new Date().toISOString(),
    execution:{path:out+'/'+label+'-execution.json',sha256:sha(await fs.readFile(out+'/'+label+'-execution.json'))},report,stats,reportError,
    serverRequests:requests(),originalAssertionsUnchanged:true,rootControlledRetryOnly:true});
  browserAttempts.push({attempt:number,pass,result:{path:out+'/'+label+'-result.json',sha256:sha(await fs.readFile(out+'/'+label+'-result.json'))}});
  return{pass,stats};
}
async function rootAction(deadline){
  let notice=0;
  while(Date.now()<deadline){
    try{const value=await read(commandPath);
      assert.deepEqual(Object.keys(value).sort(),['action','id']);assert.ok(Number.isSafeInteger(value.id)&&value.id>0);assert.ok(['diagnose','retry','close'].includes(value.action));
      if(!handledCommands.has(value.id)){handledCommands.add(value.id);await save('owner-command-'+value.id+'-receipt.json',{...value,sourceCommit:expectedSource,buildId:artifact.buildId,serverRequests:requests()});if(value.action!=='diagnose')return value.action;}
    }catch(error){if(error.code!=='ENOENT')throw error;}
    if(Date.now()-notice>=30000){notice=Date.now();console.log(json({qaOwnerAlive:true,buildId:artifact.buildId,expiresAt:new Date(deadline).toISOString(),commandPath,retainedSafeRequests:server.getRequests().length}));}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  return'close';
}

try {
  server = await startPwaQaServer({ port: 4301, buildQa: true,
    authorityPath: '.tmp/pwa-qa/s15-booky-reader-foreground-runtime-20260930-a2-authority.json', controlPath: process.env.PWA_QA_CONTROL_PATH });
  artifact = await read('dist-pwa/artifact.json'); assert.equal(artifact.sourceCommit, expectedSource);
  const artwork = { path: 'src/assets/mascots/knizhulyk-green-v1.png', sha256: '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed', bytes: 1895595 };
  assert.ok(artifact.sourceInputs.files.some(item => item.path === artwork.path && item.sha256 === artwork.sha256));
  assert.equal(artifact.inventory.filter(item => item.sha256 === artwork.sha256 && item.bytes === artwork.bytes && item.path.endsWith('.png')).length, 1);
  const audit = JSON.parse(await command('strict-audit', [await fs.realpath(root+'/scripts/mobile/verify-pwa-artifact.mjs'), '--allow-qa']));
  assert.equal(audit.pass, true); await save('strict-audit.json', audit);
  const deadline=Date.now()+10*60*1000;
  for(let number=1;;number++){
    const actual=await browserAttempt(number);if(actual.pass){browser=actual.stats;break;}
    if(number===1)await save('live-owner.json',{localQaOnly:true,pid:process.pid,sourceCommit:expectedSource,sourceManifest,buildId:artifact.buildId,
      origin:server.origin,controlPath:server.controlPath,authorityPath:server.authorityPath,commandPath,expiresAt:new Date(deadline).toISOString(),privateKeyPersisted:false});
    if(await rootAction(deadline)!=='retry')throw new Error('Actual smoke failed; root closed owner or bounded diagnostic window expired');
    assert.ok(Date.now()<deadline);await verifySource();
  }
  const destination = artifactRoot + '/pwa-' + artifact.buildId.slice(0, 8);
  assert.ok(path.resolve(destination).startsWith(path.resolve(artifactRoot) + path.sep));
  await assert.rejects(fs.stat(destination), { code: 'ENOENT' }); await fs.cp('dist-pwa', destination, { recursive: true, errorOnExist: true, force: false });
  const files = [];
  for (const entry of [...artifact.inventory, { path: 'artifact.json', sha256: sha(await fs.readFile('dist-pwa/artifact.json')) }]) {
    const bytes = await fs.readFile(path.join(destination, entry.path)); assert.equal(sha(bytes), entry.sha256);
    files.push({ path: entry.path, bytes: bytes.length, sha256: entry.sha256 });
  }
  for (const input of artifact.sourceInputs.files) assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
  assert.equal(git(['rev-parse', 'HEAD']), expectedSource);
  await verifySource();
  preserved = { path: destination, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    artifactSha256: sha(await fs.readFile(destination + '/artifact.json')), exactCopiesVerified: true };
  const ledgerPath = artifactRoot + '/pwa-a2-copy-verification.json', ledgerBytes = json({ pass: true, files });
  await fs.writeFile(ledgerPath, ledgerBytes, { flag: 'wx' });
  await save('copy-verification.json', { pass: true, files: preserved.files, bytes: preserved.bytes,
    detailedLedger: { path: ledgerPath, sha256: sha(ledgerBytes) }, artifactManifest: { path: destination + '/artifact.json', sha256: preserved.artifactSha256 } });
} catch (error) { failure = { name: error.name, message: error.message }; }
finally {
  if (server) await server.close();
  const result = { schemaVersion: 1, recordedAt: new Date().toISOString(), sourceCommit: expectedSource, buildId: artifact?.buildId,
    sourceManifest, sourceInputsSha256: artifact?.sourceInputs?.sha256, artifact: preserved, browser, pass: !failure && !!preserved, failure,
    browserAttempts, localQaAuthority: true, requestedBrowserChannel, stageAccepted: false, installedDevice: false, releaseReady: false, productionActionsPerformed: false };
  await save('result.json', result); console.log(json({pass:result.pass,sourceCommit:result.sourceCommit,buildId:result.buildId,files:preserved?.files,bytes:preserved?.bytes,browser:result.browser,failure:result.failure})); if (!result.pass) process.exitCode = 1;
}
