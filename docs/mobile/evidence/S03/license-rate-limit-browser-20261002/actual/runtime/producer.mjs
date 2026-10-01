import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url)), REVIEW=path.dirname(HERE), OUT=path.join(HERE,'actual-a1');
const ALIAS='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work', ROOT=await fs.realpath(ALIAS);
const TITLE='canonical 429 preserves saved access through early recheck and a full offline browser restart';
const CAPTURES=['pwa-rate-limit-saved-online.png','pwa-rate-limit-offline-ru.png','pwa-rate-limit-offline-en.png'];
const SUITES=['scripts/mobile/pwa-staging-package.test.mjs','server/planet/api.test.ts','server/planet/worker.test.ts','server/planet/integration.test.ts'];
const OWNERS={
  'tests/pwa/offline-catalog.spec.mjs':'6a55b1b2f79ebf6dfa44c3a0e3d4977f10ca0a686d1d67eb60d27119637b4a43',
  'tests/pwa/support/local-server.mjs':'e76cfdeec6ccc5119ccbbd6fc40a097e252191d44ae7e4dde6bd692d0edfb4c6',
  'tests/pwa/support/local-server.test.mjs':'0500b2614e7ef28bc85f9fd9bdb339170be2246a90f7605a9db642e07634cfea',
  'scripts/mobile/pwa-staging-package.mjs':'915b9e11dc306567819e1af5bf0d99308595647c08d678c765ece9f176559733',
  'scripts/mobile/prepare-pwa-staging.mjs':'169930a2c78d74128d4cdb3d1edd466f06c449365b9ac2358f8e5bf85b754e1f',
};
const sha=b=>createHash('sha256').update(b).digest('hex'), json=v=>JSON.stringify(v,null,2)+'\n';
const git=a=>execFileSync('git',['--no-optional-locks','-c','safe.directory='+ROOT,'-c','safe.directory='+ALIAS,...a],{cwd:ROOT,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}).trim();
const read=p=>fs.readFile(p), absent=p=>assert.rejects(fs.lstat(p),{code:'ENOENT'});
async function checked(r,limit=16*1024*1024){
  assert.ok(r&&path.isAbsolute(r.path));assert.match(r.sha256,/^[a-f0-9]{64}$/u);
  assert.equal(await fs.realpath(r.path),path.resolve(r.path));const s=await fs.lstat(r.path);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.size<=limit);
  const b=await read(r.path);assert.equal(sha(b),r.sha256,r.path);return b;
}
const reference=async p=>({path:p,sha256:sha(await read(p))});
const save=async(n,v)=>{const p=path.join(OUT,n);await fs.writeFile(p,Buffer.isBuffer(v)||typeof v==='string'?v:json(v),{flag:'wx'});return reference(p);};
assert.equal(process.argv.length,4,'node producer.mjs SELF_SHA ROOT_BINDING_SHA');
await checked({path:fileURLToPath(import.meta.url),sha256:process.argv[2]});
const bindingRef={path:path.join(HERE,'root-binding.json'),sha256:process.argv[3]}, binding=JSON.parse(await checked(bindingRef));
assert.equal(binding.schemaVersion,1);assert.equal(binding.kind,'d254-current-mobile-qa');assert.equal(binding.bindingReady,true);
assert.match(binding.sourceCommit,/^[a-f0-9]{40}$/u);assert.equal(binding.expectedSmokeTests,163);
assert.deepEqual(binding.helpers.map(r=>path.basename(r.path)).sort(),['producer.mjs','pwa.config.mjs']);
for(const r of binding.helpers){assert.equal(path.resolve(path.dirname(r.path)),HERE);await checked(r,1024*1024);}
assert.equal(binding.helpers.find(r=>path.basename(r.path)==='producer.mjs').sha256,process.argv[2]);
assert.equal(await fs.realpath('.'),ROOT);assert.equal(await fs.realpath(git(['rev-parse','--show-toplevel'])),ROOT);
const sourceBytes=await checked(binding.sourceManifest), source=JSON.parse(sourceBytes);
const sourceChecks=JSON.parse(await checked(binding.sourceChecks)), sourceCommit=JSON.parse(await checked(binding.sourceReceipt));
assert.equal(sourceCommit.pass,true);assert.equal(sourceCommit.clean,true);assert.equal(sourceCommit.checkpoint,binding.sourceCommit);
assert.deepEqual(sourceCommit.currentSourceManifest,binding.sourceManifest);assert.deepEqual(sourceCommit.checks,binding.sourceChecks);
assert.equal(sourceChecks.pass,true);assert.equal(sourceChecks.summary.total,13);assert.equal(sourceChecks.summary.passed,13);
assert.equal(sourceChecks.syntaxInvocations,3);assert.equal(sourceChecks.testInvocations,1);assert.equal(sourceChecks.pwaBuildExecuted,false);assert.equal(sourceChecks.browserInvocations,0);
assert.equal(source.sourceCommit,binding.sourceCommit);assert.equal(source.schemaVersion,1);
const hashes=new Map(source.files.map(r=>[r.path,r.sha256]));for(const [p,h] of Object.entries(OWNERS))assert.equal(hashes.get(p),h,p);
const {stagingSourceSnapshot,STAGING_SOURCE_ROOTS,LOCAL_SMOKE_SUITES}=await import(pathToFileURL(path.join(ROOT,'scripts/mobile/pwa-staging-package.mjs')));
assert.equal(STAGING_SOURCE_ROOTS.length,13);assert.deepEqual(LOCAL_SMOKE_SUITES,SUITES);
async function verifySource(){
  assert.equal(git(['rev-parse','HEAD']),binding.sourceCommit);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
  assert.deepEqual(await stagingSourceSnapshot(ROOT),source);await checked(bindingRef);await checked(binding.sourceManifest);await checked(binding.sourceChecks);await checked(binding.sourceReceipt);
  for(const r of binding.helpers)await checked(r,1024*1024);for(const r of binding.tools)await checked({...r,path:path.join(ROOT,r.path)},1024*1024);
}
await verifySource();await absent(OUT);await fs.mkdir(OUT);
await save('binding.json',await checked(bindingRef));await save('original-smoke-source-manifest.json',sourceBytes);
const smokeSourceRef=await reference(path.join(OUT,'original-smoke-source-manifest.json'));
const control='.tmp/pwa-qa/d254-a1-server.json',authority='.tmp/pwa-qa/d254-a1-authority.json',temporary=path.join(ROOT,'.tmp','d254-a1-temp'),packageOut='.tmp/pwa-staging-d254-a1';
for(const p of [path.join(ROOT,control),path.join(ROOT,authority),temporary,path.join(ROOT,packageOut)])await absent(p);
await fs.mkdir(path.join(ROOT,'.tmp'),{recursive:true});assert.equal(await fs.realpath(path.join(ROOT,'.tmp')),path.join(ROOT,'.tmp'));await fs.mkdir(temporary);
Object.assign(process.env,{TEMP:temporary,TMP:temporary,PWA_QA_CONTROL_PATH:control,S03_BROWSER_CHANNEL:'msedge',S03_PWA_OUTPUT:path.join(OUT,'browser'),S03_PWA_REPORT:path.join(OUT,'browser-playwright.json'),
  GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:ROOT,GIT_CONFIG_KEY_1:'safe.directory',GIT_CONFIG_VALUE_1:ALIAS});
const commandExecutions=[];
async function command(label,args){
  const approved=await save(label+'-command.json',{executable:process.execPath,cwd:ROOT,args}), chunks={stdout:[],stderr:[]};let code=null,signal=null,error=null;
  const started=Date.now();await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:ROOT,windowsHide:true,stdio:['ignore','pipe','pipe']});
    for(const stream of ['stdout','stderr'])child[stream].on('data',b=>chunks[stream].push(b));
    child.once('error',e=>{error=e.message;resolve();});child.once('close',(c,s)=>{code=c;signal=s;resolve();});});
  const stdout=Buffer.concat(chunks.stdout),stderr=Buffer.concat(chunks.stderr);
  const execution={command:approved,exitCode:code,signal,error,durationMs:Date.now()-started,stdout:await save(label+'.stdout.txt',stdout),stderr:await save(label+'.stderr.txt',stderr)};
  const executionRef=await save(label+'-execution.json',execution);commandExecutions.push({label,execution:executionRef});
  return {...execution,execution:executionRef,stdoutText:stdout.toString('utf8')};
}
let server,artifact,smoke,audit,browser,packageEvidence,failure=null,requests=[],buildInvocations=0,browserInvocations=0,smokeInvocations=0,packageInvocations=0,signerClosed=false;
try{
  smokeInvocations++;const smokePath=path.join(OUT,'packaging-smoke-report.json');
  const smokeArgs=['node_modules/vitest/vitest.mjs','run',...SUITES,'--maxWorkers=1','--reporter=json','--outputFile='+smokePath];
  const run=await command('packaging-smoke',smokeArgs);assert.equal(run.exitCode,0);
  const smokeReport=JSON.parse(await read(smokePath)), results=smokeReport.testResults;
  assert.equal(smokeReport.success,true);assert.equal(smokeReport.numTotalTests,binding.expectedSmokeTests);assert.equal(smokeReport.numPassedTests,smokeReport.numTotalTests);
  for(const p of ['numFailedTests','numPendingTests','numTodoTests'])assert.equal(smokeReport[p],0);
  assert.equal(results.length,4);assert.deepEqual(results.map(r=>path.relative(ROOT,r.name).replaceAll('\\','/')).sort(),[...SUITES].sort());
  assert.ok(results.every(r=>r.status==='passed'&&r.assertionResults.length&&r.assertionResults.every(a=>a.status==='passed')));
  assert.equal(results.reduce((n,r)=>n+r.assertionResults.length,0),smokeReport.numTotalTests);
  smoke={report:await reference(smokePath),execution:run.execution,stdout:run.stdout,stderr:run.stderr,command:['node',...smokeArgs],sourceManifest:smokeSourceRef,total:smokeReport.numTotalTests,passed:smokeReport.numPassedTests};
  await verifySource();
  const {startPwaQaServer}=await import(pathToFileURL(path.join(ROOT,'tests/pwa/support/local-server.mjs')));
  buildInvocations++;const buildStarted=Date.now();
  // This call is the only PWA compiler invocation. Its inherited build streams
  // are retained in the ROOT launcher stdout/stderr, never by another build.
  server=await startPwaQaServer({root:ROOT,port:0,buildQa:true,authorityPath:authority,controlPath:control});process.env.PWA_QA_ORIGIN=server.origin;
  artifact=JSON.parse(await read(path.join(ROOT,'dist-pwa','artifact.json')));
  assert.equal(artifact.sourceCommit,binding.sourceCommit);assert.equal(artifact.localQaAuthority,true);assert.equal(artifact.releaseReady,false);assert.equal(artifact.productionActionsAuthorized,false);
  const {pwaAuthoritySha256}=await import(pathToFileURL(path.join(ROOT,'scripts/mobile/pwa-artifact.mjs')));
  assert.equal(artifact.authoritySha256,pwaAuthoritySha256(server.authority));assert.ok(!Object.hasOwn(server.authority.trustedKeys[0].jwk,'d'));
  await save('build-execution.json',{pass:true,sourceCommit:binding.sourceCommit,buildId:artifact.buildId,durationMs:Date.now()-buildStarted,producer:'startPwaQaServer({buildQa:true}) -> build-pwa.mjs --qa-authority',buildInvocations:1,origin:server.origin,authorityPath:server.authorityPath,privateKeyPersisted:false});
  await verifySource();const strict=await command('strict-audit',['scripts/mobile/verify-pwa-artifact.mjs','--allow-qa']);
  const report=JSON.parse(strict.stdoutText);audit={report:await save('strict-audit.json',report),execution:strict.execution};
  assert.equal(strict.exitCode,0);assert.equal(report.pass,true);assert.equal(report.identity.buildId,artifact.buildId);assert.equal(report.identity.sourceCommit,binding.sourceCommit);assert.equal(report.identity.localQaAuthority,true);
  browserInvocations++;const browserRun=await command('browser',['node_modules/@playwright/test/cli.js','test','--config='+path.join(HERE,'pwa.config.mjs')]);
  const browserReport=JSON.parse(await read(process.env.S03_PWA_REPORT)), specs=[];
  const visit=s=>{specs.push(...(s.specs??[]));for(const child of s.suites??[])visit(child);};for(const s of browserReport.suites??[])visit(s);
  assert.equal(browserRun.exitCode,0);assert.equal(browserReport.stats.expected,1);for(const p of ['unexpected','skipped','flaky'])assert.equal(browserReport.stats[p],0);
  assert.equal(specs.length,1);assert.equal(specs[0].title,TITLE);assert.equal(specs[0].tests.length,1);assert.equal(specs[0].tests[0].projectName,'d254-msedge-390');
  const runs=specs[0].tests[0].results;assert.equal(runs.length,1);assert.equal(runs[0].status,'passed');
  const attachment=runs[0].attachments.find(a=>a.name==='canonical-429-offline-cold-restart');assert.equal(attachment?.contentType,'application/json');
  const body=Buffer.from(attachment.body,'base64');assert.ok(body.length<=64*1024);const observation=JSON.parse(body);
  for(const p of ['completed','profileRemoved','firstContextClosed','sameDisposableProfile','offlineBeforeFirstNavigation','validSavedProofAfter429'])assert.equal(observation[p],true);
  assert.equal(observation.sourceCommit,binding.sourceCommit);assert.equal(observation.buildId,artifact.buildId);assert.equal(observation.persistentLaunches,2);assert.equal(observation.restarts,1);
  for(const p of ['earlyRetryExtraSessionPosts','offlineLicenseRequests','offlineLicensePostAttempts'])assert.equal(observation[p],0);
  assert.equal(observation.earlyRetryIdentityStatus,200);assert.ok(Number.isInteger(observation.earlyRetryObservationMs)&&observation.earlyRetryObservationMs>=0&&observation.earlyRetryObservationMs<60000);
  assert.deepEqual(observation.blockedRequests,[]);assert.deepEqual(observation.locales.map(r=>r.locale),['ru','en','ru']);assert.ok(observation.locales.every(r=>r.savedVerification&&r.singleSceneWithinReopenedDocument));
  const found=new Map();async function walk(dir,depth=0){assert.ok(depth<=6);for(const entry of await fs.readdir(dir,{withFileTypes:true})){assert.ok(!entry.isSymbolicLink());const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p,depth+1);else if(CAPTURES.includes(entry.name)){assert.ok(!found.has(entry.name));found.set(entry.name,p);}}}
  await walk(process.env.S03_PWA_OUTPUT);assert.deepEqual([...found.keys()].sort(),[...CAPTURES].sort());const screenshots=[];
  for(const name of CAPTURES){const p=found.get(name),b=await read(p);assert.ok(b.length>24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));assert.equal(b.readUInt32BE(16),390);assert.equal(b.readUInt32BE(20),844);screenshots.push({name,path:p,sha256:sha(b),bytes:b.length,width:390,height:844});}
  browser={caseTitle:TITLE,report:await reference(process.env.S03_PWA_REPORT),execution:browserRun.execution,stats:browserReport.stats,observation:await save('browser-observation.json',body),screenshots,capturesReviewed:false};
  requests=server.getRequests();for(const pathname of ['/__pwa_qa__/control','/planet/api/license/identity','/planet/api/license/session'])assert.ok(requests.some(r=>r.method==='POST'&&r.pathname===pathname));
  await verifySource();const current=await stagingSourceSnapshot(ROOT);assert.deepEqual(current,source);const currentRef=await save('current-package-source-manifest.json',current);
  const artifactRef=await reference(path.join(ROOT,'dist-pwa','artifact.json'));
  const receipt=await save('local-validation.json',{schemaVersion:1,kind:'planet-local-preparation-validation',sourceCommit:binding.sourceCommit,artifact:artifactRef,pwaReport:audit.report,sourceManifest:smokeSourceRef,currentSourceManifest:currentRef,
    smokeReport:smoke.report,smokeCommand:smoke.command,exitCode:0,stdout:smoke.stdout,stderr:smoke.stderr,localOnly:true,stagingValidated:false,providerValidated:false});
  const packageArgs=['scripts/mobile/prepare-pwa-staging.mjs','--expected-sha',binding.sourceCommit,'--build-id',artifact.buildId,'--dir','dist-pwa','--out',packageOut,'--receipt',receipt.path,'--receipt-sha256',receipt.sha256,'--validation-root',REVIEW,'--allow-qa'];
  const parseCli=t=>{const n=t.indexOf('\n');assert.ok(n>0);return {header:JSON.parse(t.slice(0,n)),report:JSON.parse(t.slice(n+1))};};
  packageInvocations++;const dry=await command('staging-dryrun',packageArgs),dryResult=parseCli(dry.stdoutText);assert.equal(dry.exitCode,0);assert.equal(dryResult.report.pass,true);assert.equal(dryResult.report.dryRun,true);assert.equal(dryResult.report.packageWritten,false);await absent(path.join(ROOT,packageOut));
  packageInvocations++;const write=await command('staging-write',[...packageArgs,'--write-package']);assert.equal(write.exitCode,0);const written=parseCli(write.stdoutText).report;
  assert.equal(written.pass,true);assert.equal(written.dryRun,false);assert.equal(written.packageWritten,true);assert.equal(written.buildId,artifact.buildId);assert.equal(written.sourceCommit,binding.sourceCommit);
  const packageResultRef=await reference(path.join(ROOT,packageOut,'result.json'));assert.deepEqual(JSON.parse(await checked(packageResultRef)),written);
  for(const r of written.inventory){const p=path.join(ROOT,packageOut,r.path);assert.equal(await fs.realpath(p),p);const b=await read(p);assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256,r.path);}
  packageEvidence={localValidation:receipt,dryrun:dry.execution,write:write.execution,output:path.join(ROOT,packageOut),result:packageResultRef,buildId:artifact.buildId,exactPackageCopiesVerified:true};
  await verifySource();
}catch(error){failure={name:error.name,message:error.message};}
finally{
  if(server){requests=server.getRequests();try{await server.close();signerClosed=true;}catch(e){failure??={name:e.name,message:e.message};}}
  const result={schemaVersion:1,decision:'D254',recordedAt:new Date().toISOString(),sourceCommit:binding.sourceCommit,sourceManifest:binding.sourceManifest,binding:bindingRef,sourceChecks:binding.sourceChecks,sourceReceipt:binding.sourceReceipt,
    smoke:smoke??null,buildId:artifact?.buildId??null,strictAudit:audit??null,browser:browser??null,localPackage:packageEvidence??null,pass:!failure&&Boolean(packageEvidence),failure,
    buildInvocations,browserInvocations,smokeInvocations,packageInvocations,rawCommandExecutions:commandExecutions,liveQaAuthority:{privateKeyPersisted:false,sameAuthorityForBuildAndBrowser:Boolean(browser),signerClosed},
    serverRequests:{safeFields:['method','pathname'],retentionLimit:2000,rows:requests},scope:{currentControlledQaArtifact:Boolean(artifact),canonical429:Boolean(browser),signedCacheFallback:Boolean(browser),browserProcessReopened:Boolean(browser),browserProfileReopened:Boolean(browser),offlineBeforeFirstNavigation:Boolean(browser),sameCandidateLocalPackage:Boolean(packageEvidence),
      capturesReviewed:false,actualOsInstallation:false,realPurchase:false,providerValidated:false,liveStagingValidated:false,stageAccepted:false,releaseReady:false,productionActionsPerformed:false,old139Rerun:false,old141Rerun:false,appTypeScriptExecuted:false}};
  await save('result.json',result);console.log(json({pass:result.pass,sourceCommit:binding.sourceCommit,buildId:result.buildId,captures:browser?.screenshots.length??0,failure}));if(!result.pass)process.exitCode=1;
}
