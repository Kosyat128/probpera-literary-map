// Apply the single reviewed D228 parser correction; preserve failed a1 evidence.
// Rerun current TS/core36, then run the existing browsers for the first time.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const self=fileURLToPath(import.meta.url),base=path.dirname(self),old=path.join(base,'actual-a1'),out=path.join(base,'actual-a2');
const root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work'),predecessor='b923f1d66eb957539cc500c58dde54e2bba3665a';
const relative='apps/admin/lib/booky-journey-draft.ts',correctedSha='ffcb6b2ef5564ae161df7fd89022fd400de592ae548824530f421f4d5878b2a1';
const sha=b=>createHash('sha256').update(b).digest('hex'),norm=p=>path.normalize(p).replaceAll('\\','/'),at=p=>path.isAbsolute(p)?p:path.join(root,p);
const hash=async p=>sha(await fs.readFile(p)),ref=async p=>({path:norm(p),sha256:await hash(p)});
const bytes=async r=>{assert.match(r.sha256,/^[a-f0-9]{64}$/u);const b=await fs.readFile(at(r.path));assert.equal(sha(b),r.sha256,r.path);return b;},checked=async r=>JSON.parse(await bytes(r));
const write=async(n,v)=>{const p=path.join(out,n);await fs.writeFile(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(p);};
const checksRef={path:path.join(old,'checks-result.json'),sha256:'f6970da3d146d2604f67b67b156e0b182ae796b1ad9be0b260726c85144a762a'},checks=await checked(checksRef),manifest=await checked(checks.sourceManifest),producer=await ref(self);
assert.equal(checks.pass,false);assert.equal(checks.decision,'D228');assert.equal(checks.predecessorDocsCommit,predecessor);assert.equal(checks.sourceInputsUnchanged,true);
assert.equal(checks.sourceManifest.sha256,'97f2bdb3222a0592122b2c9e4d5ccf1a01e975e79b9f4e9ec6ab710cb05d32b5');assert.equal(manifest.files.length,2101);assert.equal(new Set(manifest.files.map(f=>f.path)).size,2101);
assert.equal(checks.expectedCoreTests,36);assert.equal(checks.protectedInputCount,2097);assert.equal(checks.producer.sha256,'470e79bacde575ca0ca1de9986d58afbc476d789f5d2fd79bb4e54f4abdbd47d');await bytes(checks.producer);
assert.deepEqual(checks.changedPaths,['apps/admin/components/BookyJourneyDraftEditor.tsx','apps/admin/lib/booky-journey-draft.test.ts',relative,'tests/host/booky-journey-authoring.spec.mjs']);assert.deepEqual(checks.newPaths,[]);
const expectedProposal=[
  {path:checks.changedPaths[0],sha256:'23f9388f558e26315e6cfae4ff90ef8fe02c9e99d878fd8c224da622865a07a7'},
  {path:checks.changedPaths[1],sha256:'7e48bc4080029f4143466f20be1232f158a98269238ca8ebc12c60ba73d8de41'},
  {path:relative,sha256:'998eb8c1bb89f535381a31c5410e6b074d6c5b684982dc77dbd098f645e959aa'},
  {path:checks.changedPaths[3],sha256:'f6c086469a650cb193ea5a7b978694c81b2d160ae9cca80b1b5790fdee162ed9'},
];assert.deepEqual(checks.proposalFiles,expectedProposal);for(const f of expectedProposal)assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);
for(const f of manifest.files){assert.ok(!path.isAbsolute(f.path)&&!f.path.split(/[\\/]/u).includes('..'));assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);}
const oldBefore=await checked(checks.sourceBefore),oldAfter=await checked(checks.sourceAfter);assert.deepEqual(oldBefore,oldAfter);assert.equal(oldBefore.head,predecessor);assert.deepEqual(oldBefore.files,manifest.files);
const oldType=await checked(checks.typecheck),failedUnit=await checked(checks.unit),failedReport=await checked(failedUnit.report);
assert.equal(oldType.pass,true);assert.equal(oldType.exitCode,0);assert.equal(oldType.error,null);assert.equal(failedUnit.pass,false);assert.equal(failedUnit.exitCode,1);
for(const run of [oldType,failedUnit]){assert.equal(run.sourceManifest.sha256,checks.sourceManifest.sha256);await bytes(run.stdout);await bytes(run.stderr);}
assert.deepEqual(failedUnit.summary,{total:36,passed:35,failed:1,pending:0});assert.equal(failedReport.success,false);assert.deepEqual([failedReport.numTotalTests,failedReport.numPassedTests,failedReport.numFailedTests,failedReport.numPendingTests],[36,35,1,0]);assert.equal(checks.browser,null);assert.deepEqual(checks.captures,[]);
for(const r of checks.retentionRefs)await bytes(r);assert.equal(checks.retainedHelper.coreDependencyChanged,true);assert.equal(checks.retainedHelper.currentParserCoverageClaimed,false);assert.equal(checks.retainedHistoricalFactSmoke.historicalOnly,true);assert.equal(checks.retainedHistoricalFactSmoke.currentCoreCompatibilityClaimed,false);
const env={...process.env,CI:'1',NEXT_TELEMETRY_DISABLED:'1',GIT_CONFIG_PARAMETERS:"'core.autocrlf=true'",BOOKY_JOURNEY_BROWSER_OUTPUT:path.join(out,'captures'),BOOKY_JOURNEY_BROWSER_REPORT:path.join(out,'browser-report.json')};
const git=args=>{const r=spawnSync('git',args,{cwd:root,env,windowsHide:true,encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout.trim();};
assert.equal(git(['rev-parse','HEAD']),predecessor);assert.equal(git(['diff','--cached','--name-only']),'');assert.equal(git(['ls-files','--others','--exclude-standard']),'');assert.deepEqual(git(['diff','--name-only']).split('\n').filter(Boolean).sort(),checks.changedPaths);
const corrected=path.join(base,'proposed',relative);assert.equal(await hash(corrected),correctedSha);
await fs.mkdir(out);await fs.copyFile(corrected,path.join(root,relative));
const next={...manifest,files:manifest.files.map(f=>f.path===relative?{...f,sha256:correctedSha}:{...f})};
for(const f of next.files)assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);const sourceManifest=await write('source-manifest.json',next);
const effectiveProposalFiles=checks.proposalFiles.map(f=>f.path===relative?{...f,sha256:correctedSha}:{...f});
const runtimeCorrection=await write('runtime-correction.json',{pass:true,path:relative,beforeSha256:expectedProposal[2].sha256,afterSha256:correctedSha,
  originalManifest:checks.sourceManifest,finalManifest:sourceManifest,failedChecks:checksRef,failedUnit:checks.unit,originalTypecheck:checks.typecheck,
  originalApplyProducer:checks.producer,testSourceUnchanged:true,uiSourceUnchanged:true,browserSourceUnchanged:true,typecheckRerun:true,coreUnitRerun:true,browserFirstRun:true,
  reason:'Keep base-node shape checks in the parser and defer text validation to the compiler, preserving existing leaf error fields; no test changes or type erasure.',producer});
const snapshot=async()=>({head:git(['rev-parse','HEAD']),status:git(['status','--porcelain=v1','--untracked-files=all']),files:await Promise.all(next.files.map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})))});
const before=await snapshot();assert.equal(before.head,predecessor);assert.deepEqual(before.files,next.files);const sourceBefore=await write('source-before.json',before);
const temp=path.join(root,'.tmp/admin-journey-copy-variants-a2');await fs.mkdir(temp,{recursive:true});env.TEMP=temp;env.TMP=temp;
async function run(label,args){const stdoutPath=path.join(out,label+'.stdout.log'),stderrPath=path.join(out,label+'.stderr.log'),stdout=await fs.open(stdoutPath,'wx'),stderr=await fs.open(stderrPath,'wx'),started=Date.now();let error=null;
  console.log(JSON.stringify({started:label}));const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore',stdout.fd,stderr.fd]});child.once('error',e=>{error=e.message;});child.once('close',resolve);});await stdout.close();await stderr.close();
  return {pass:exitCode===0&&!error,exitCode,error,durationMs:Date.now()-started,command:[process.execPath,...args],sourceManifest,stdout:await ref(stdoutPath),stderr:await ref(stderrPath)};}
const [typecheck,unit]=await Promise.all([
  run('typecheck',[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--project',path.join(root,'apps/admin/tsconfig.json'),'--incremental','false','--pretty','false']),
  run('unit',[path.join(root,'node_modules/vitest/vitest.mjs'),'run',checks.changedPaths[1],'--reporter=json','--outputFile='+path.join(out,'unit-report.json')]),
]);
try{const reportPath=path.join(out,'unit-report.json'),report=JSON.parse(await fs.readFile(reportPath,'utf8'));unit.report=await ref(reportPath);unit.files=[checks.changedPaths[1]];unit.summary={total:report.numTotalTests,passed:report.numPassedTests,failed:report.numFailedTests,pending:report.numPendingTests};
  unit.pass&&=report.success&&report.numTotalTests===36&&report.numPassedTests===36&&report.numFailedTests===0&&report.numPendingTests===0&&report.testResults.length===1&&report.testResults[0].assertionResults.length===36&&report.testResults[0].assertionResults.every(a=>a.status==='passed');
}catch(e){unit.pass=false;unit.error=String(e);}const typeRef=await write('typecheck-result.json',typecheck),unitRef=await write('unit-result.json',unit);
let browser=null,browserRef=null,captures=[];if(typecheck.pass&&unit.pass){
  browser=await run('browser',[path.join(root,'node_modules/@playwright/test/cli.js'),'test','--config='+path.join(path.dirname(base),'s15-booky-journey-authoring-review/playwright.config.mjs')]);
  try{const reportPath=path.join(out,'browser-report.json'),report=JSON.parse(await fs.readFile(reportPath,'utf8'));browser.report=await ref(reportPath);browser.summary={cases:report.stats.expected+report.stats.unexpected+report.stats.skipped+report.stats.flaky,passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,flaky:report.stats.flaky};
    browser.pass&&=browser.summary.cases===3&&browser.summary.passed===3&&browser.summary.failed===0&&browser.summary.skipped===0&&browser.summary.flaky===0;
    const captureRoot=path.join(out,'captures'),pngs=(await fs.readdir(captureRoot,{recursive:true})).filter(p=>p.endsWith('.png')).sort();captures=await Promise.all(pngs.map(p=>ref(path.join(captureRoot,p))));browser.pass&&=captures.length===8;
  }catch(e){browser.pass=false;browser.error=String(e);}browserRef=await write('browser-result.json',browser);
}
const after=await snapshot(),sourceAfter=await write('source-after.json',after);assert.deepEqual(after,before);await bytes(checksRef);await bytes(checks.sourceManifest);for(const r of checks.retentionRefs)await bytes(r);assert.equal(await hash(corrected),correctedSha);assert.equal(await hash(self),producer.sha256);
const pass=typecheck.pass&&unit.pass&&browser?.pass===true,result=await write('checks-result.json',{...checks,pass,sourceManifest,sourceBefore,sourceAfter,sourceInputsUnchanged:true,typecheck:typeRef,unit:unitRef,browser:browserRef,captures,runtimeCorrection,effectiveProposalFiles,failedAttempt:checksRef,producer});
console.log(JSON.stringify({pass,result,sourceManifest,runtimeCorrection,unitSummary:unit.summary,browserSummary:browser?.summary,captures:captures.length}));if(!pass)process.exitCode=1;
