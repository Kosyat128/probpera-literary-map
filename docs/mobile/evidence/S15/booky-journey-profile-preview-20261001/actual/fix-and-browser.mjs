// Apply only the accepted D229 browser fixture correction; retain original TS/core41.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
assert.equal(process.argv.length,2);
const self=fileURLToPath(import.meta.url),base=path.dirname(self),root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const old=path.join(base,'actual-a1'),out=path.join(base,'actual-a2'),predecessor='6aaafb5dffa21e801cb3bbd9a927df0f4283b451';
const relative='tests/host/booky-journey-authoring.spec.mjs',correctedSha='4336d877a7a18f6d098d8b917ec70f11f2934110e8cc672e00dbdea909277696';
const proposalFiles=[
  {path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'9da1138c63c5ac359bbb2eb00062ba77c3470269d4c9979e08aceab01b43e96f'},
  {path:'apps/admin/lib/booky-journey-draft.test.ts',sha256:'d8194aafa18cf84122bf5530dca29c97aeeb9c0512036bcb7e7fd080f69196a0'},
  {path:'apps/admin/lib/booky-journey-draft.ts',sha256:'b64f22c366477da8188a2dce1651be337903babd67c3621b89a3e944d1a5a835'},
  {path:relative,sha256:'51908b117ac3f588eab818d0e2e7e59467bd6834d95b2fe1a3acd924e13693b8'},
];
const paths=proposalFiles.map(f=>f.path),preservedOwners=proposalFiles.filter(f=>f.path!==relative),effectiveProposalFiles=proposalFiles.map(f=>f.path===relative?{...f,sha256:correctedSha}:{...f});
const sha=b=>createHash('sha256').update(b).digest('hex'),norm=p=>path.normalize(p).replaceAll('\\','/'),at=p=>path.isAbsolute(p)?p:path.join(root,p);
const hash=async p=>sha(await fs.readFile(p)),ref=async p=>({path:norm(p),sha256:await hash(p)});
const bytes=async r=>{assert.match(r.sha256,/^[a-f0-9]{64}$/u);const b=await fs.readFile(at(r.path));assert.equal(sha(b),r.sha256,r.path);return b;},checked=async r=>JSON.parse(await bytes(r));
const write=async(n,v)=>{const p=path.join(out,n);await fs.writeFile(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(p);};
const checksRef=await ref(path.join(old,'checks-result.json'));assert.equal(checksRef.sha256,'cc2cb09c77cf16cfd1db497013c1782807c1f35fd1a24a03240b33c66934006f');
const checks=await checked(checksRef),manifest=await checked(checks.sourceManifest),producer=await ref(self);
assert.equal(checks.pass,false);assert.equal(checks.decision,'D229');assert.equal(checks.predecessorDocsCommit,predecessor);assert.equal(checks.sourceInputsUnchanged,true);
assert.equal(checks.sourceManifest.sha256,'cb41b01c18ad47ebfa73fa2820ce7ce323ede2c7d2bc7f684c9a00931c6766e2');assert.equal(manifest.files.length,2101);assert.equal(new Set(manifest.files.map(f=>f.path)).size,2101);
assert.deepEqual(checks.proposalFiles,proposalFiles);assert.deepEqual(checks.changedPaths,paths);assert.deepEqual(checks.newPaths,[]);assert.equal(checks.protectedInputCount,2097);assert.equal(checks.expectedCoreTests,41);
assert.equal(checks.producer.sha256,'7855c7d7c4b09c475c4752966a3b1f373fbdf1eb10ca875b29132340d3cf46d4');await bytes(checks.producer);
for(const f of manifest.files){assert.ok(!path.isAbsolute(f.path)&&!f.path.split(/[\\/]/u).includes('..'));assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);}
for(const f of proposalFiles){assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);assert.equal(await hash(path.join(base,'proposed',f.path)),f.sha256);}
const priorBefore=await checked(checks.sourceBefore),priorAfter=await checked(checks.sourceAfter);assert.deepEqual(priorBefore,priorAfter);assert.equal(priorBefore.head,predecessor);assert.deepEqual(priorBefore.files,manifest.files);
assert.equal(checks.typecheck.sha256,'397b9c62dcebebba3d4a8478ada3dd7560cf2697de183e38e45efc36e707cd7a');assert.equal(checks.unit.sha256,'422bc4e98da1af86c785626324786da0d50cac052b1e2e63866018e16ada94da');
for(const r of [checks.typecheck,checks.unit]){const run=await checked(r);assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);assert.deepEqual(run.sourceManifest,checks.sourceManifest);await bytes(run.stdout);await bytes(run.stderr);}
const unit=await checked(checks.unit),unitReport=await checked(unit.report);assert.deepEqual(unit.summary,{total:41,passed:41,failed:0,pending:0});assert.deepEqual(unit.files,['apps/admin/lib/booky-journey-draft.test.ts']);assert.equal(unitReport.success,true);assert.equal(unitReport.testResults.length,1);assert.equal(unitReport.testResults[0].assertionResults.length,41);assert(unitReport.testResults[0].assertionResults.every(a=>a.status==='passed'));
const failed=await checked(checks.browser);assert.equal(failed.pass,false);assert.equal(failed.exitCode,1);assert.deepEqual(failed.summary,{cases:3,passed:1,failed:2,skipped:0,flaky:0});await bytes(failed.report);await bytes(failed.stdout);await bytes(failed.stderr);
const failedDiagnosticRefs=[failed.report,failed.stdout,failed.stderr,...checks.captures];
const failedCaptureRoot=path.join(old,'captures');for(const p of (await fs.readdir(failedCaptureRoot,{recursive:true})).filter(p=>p.endsWith('error-context.md')).sort())failedDiagnosticRefs.push(await ref(path.join(failedCaptureRoot,p)));
assert.equal(failedDiagnosticRefs.filter(r=>r.path.endsWith('error-context.md')).length,2);for(const r of failedDiagnosticRefs)await bytes(r);for(const r of checks.retentionRefs)await bytes(r);
const env={...process.env,CI:'1',NEXT_TELEMETRY_DISABLED:'1',GIT_CONFIG_PARAMETERS:"'core.autocrlf=true'",BOOKY_JOURNEY_BROWSER_OUTPUT:path.join(out,'captures'),BOOKY_JOURNEY_BROWSER_REPORT:path.join(out,'browser-report.json')};
const git=args=>{const r=spawnSync('git',args,{cwd:root,env,windowsHide:true,encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout.trim();};
assert.equal(git(['rev-parse','HEAD']),predecessor);assert.equal(git(['diff','--cached','--name-only']),'');assert.equal(git(['ls-files','--others','--exclude-standard']),'');assert.deepEqual(git(['diff','--name-only']).split('\n').filter(Boolean).sort(),paths);
const corrected=path.join(base,'corrected',relative);assert.equal(await hash(corrected),correctedSha);await fs.mkdir(out);await fs.copyFile(corrected,path.join(root,relative));
const next={...manifest,files:manifest.files.map(f=>f.path===relative?{...f,sha256:correctedSha}:{...f})};for(const f of next.files)assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);
const sourceManifest=await write('source-manifest.json',next),fixtureCorrection=await write('fixture-correction.json',{
  pass:true,path:relative,beforeSha256:proposalFiles[3].sha256,afterSha256:correctedSha,originalManifest:checks.sourceManifest,finalManifest:sourceManifest,
  failedChecks:checksRef,failedBrowser:checks.browser,failedDiagnosticRefs,retainedCurrentTypecheck:checks.typecheck,retainedCurrentUnit:checks.unit,preservedOwners,
  applicationSourceUnchanged:true,typecheckRerun:false,unitRerun:false,helperUnitRerun:false,catalogSmokeRerun:false,supplementalProbeExecuted:false,
  reason:'Use three exact native AX combobox locators; relocate existing RU/EN preview captures to the expanded matching/outside adult profile controls and report. Preserve all application and core-test bytes.',originalApplyProducer:checks.producer,producer});
const snapshot=async()=>({head:git(['rev-parse','HEAD']),status:git(['status','--porcelain=v1','--untracked-files=all']),files:await Promise.all(next.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))});
const before=await snapshot();assert.deepEqual(before.files,next.files);const sourceBefore=await write('source-before.json',before);
const temp=path.join(root,'.tmp/admin-journey-profile-preview-browser-a2');await fs.mkdir(temp,{recursive:true});env.TEMP=temp;env.TMP=temp;
const args=[path.join(root,'node_modules/@playwright/test/cli.js'),'test','--config='+path.join(path.dirname(base),'s15-booky-journey-authoring-review/playwright.config.mjs')];
const stdoutPath=path.join(out,'browser.stdout.log'),stderrPath=path.join(out,'browser.stderr.log'),stdout=await fs.open(stdoutPath,'wx'),stderr=await fs.open(stderrPath,'wx'),started=Date.now();let error=null;
const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore',stdout.fd,stderr.fd]});child.once('error',e=>{error=e.message;});child.once('close',resolve);});await stdout.close();await stderr.close();
const reportPath=path.join(out,'browser-report.json'),report=JSON.parse(await fs.readFile(reportPath,'utf8')),summary={cases:report.stats.expected+report.stats.unexpected+report.stats.skipped+report.stats.flaky,passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,flaky:report.stats.flaky};
const captures=await Promise.all((await fs.readdir(path.join(out,'captures'),{recursive:true})).filter(p=>p.endsWith('.png')).sort().map(p=>ref(path.join(out,'captures',p))));
const browser={pass:exitCode===0&&!error&&summary.cases===3&&summary.passed===3&&summary.failed===0&&summary.skipped===0&&summary.flaky===0&&captures.length===8,exitCode,error,durationMs:Date.now()-started,command:[process.execPath,...args],sourceManifest,summary,report:await ref(reportPath),stdout:await ref(stdoutPath),stderr:await ref(stderrPath)},browserRef=await write('browser-result.json',browser);
const after=await snapshot(),sourceAfter=await write('source-after.json',after);assert.deepEqual(after,before);await bytes(checksRef);for(const r of failedDiagnosticRefs)await bytes(r);for(const r of checks.retentionRefs)await bytes(r);assert.equal(await hash(self),producer.sha256);assert.equal(await hash(corrected),correctedSha);
const result=await write('checks-result.json',{...checks,pass:browser.pass,sourceManifest,sourceBefore,sourceAfter,sourceInputsUnchanged:true,browser:browserRef,captures,
  fixtureCorrection,failedAttempt:checksRef,effectiveProposalFiles,preservedOwners,retainedCurrentTypecheck:checks.typecheck,retainedCurrentUnit:checks.unit,
  typecheckExecuted:false,unitExecuted:false,typecheckRetainedAtOriginalManifest:true,unitRetainedAtOriginalManifest:true,supplementalProbeExecuted:false,producer});
console.log(JSON.stringify({pass:browser.pass,result,sourceManifest,fixtureCorrection,summary,captures:captures.length}));if(!browser.pass)process.exitCode=1;
