import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {root,review,artifactBase,fixture,sha,read,ref,pin,save,checkout,snapshot,checkedRefs,loadEntry} from './execution-review-a1/common.mjs';
const [proposedPath,proposedSha,proposalPath,proposalSha,...extra]=process.argv.slice(2);assert.equal(extra.length,0);
const before=review+'/execution-review-a1/bound-a1',out=review+'/ru-correction-a2',artifacts=artifactBase+'/attempt-a2/browser';
const {entry:original,entryRef:originalEntry,manifest:originalManifest}=await loadEntry(before+'/entry.json','e97613f1231343b9f528374b342e96d5e96b986fae6914948c851d3ce59447fb');
const failedResult=await pin(before+'/browser-a1/result.json','79b79883081adec8a810b9a8200ae5482074c82bbe3f0e20109ad763be41c578'),failed=await read(failedResult.path);
assert.equal(failed.pass,false);assert.deepEqual(failed.tests,{passed:1,failed:1,skipped:0,flaky:0});await checkedRefs([failed.rawReport]);
const staticResult=await pin(before+'/static-a1/result.json','51c8ed81a9ab756f5b4d0240ef8f1e1c291beeec09dd90be97f96cefc853aced');assert.equal((await read(staticResult.path)).pass,true);
const proposed=await pin(proposedPath,proposedSha),proposal=await pin(proposalPath,proposalSha),producer=await ref(fileURLToPath(import.meta.url));
const priorFixture=originalManifest.files.find(f=>f.path===fixture);assert.equal(priorFixture.sha256,'471ed8066a7fbf5d817e41ab14ba103d20d891d0fd574d510a6cdcfafe334656');assert.notEqual(proposed.sha256,priorFixture.sha256);
for(const p of [out,artifacts])await assert.rejects(fs.stat(p),{code:'ENOENT'});
const specs=report=>{const all=[];const walk=s=>{for(const v of s??[]){all.push(...v.specs??[]);walk(v.suites)}};walk(report.suites);return all;};
const oldReport=await read(failed.rawReport.path),enSpec=specs(oldReport).find(s=>s.title==='Booky explicit writer filter recovery en');
assert.ok(enSpec);assert.equal(enSpec.tests.length,1);assert.equal(enSpec.tests[0].results.length,1);assert.equal(enSpec.tests[0].results[0].status,'passed');assert.equal(enSpec.tests[0].results[0].retry,0);
await fs.mkdir(out);await fs.mkdir(out+'/runner');for(const p of ['temp','profiles'])await fs.mkdir(artifacts+'/'+p,{recursive:true});
await save(out+'/before.json',{originalEntry,sourceManifest:original.sourceManifest,failedResult,staticResult,proposed,proposal,producer});
await fs.writeFile(root+'/'+fixture,await fs.readFile(proposed.path));
const files=await snapshot(originalManifest.files),differences=files.filter((f,i)=>f.sha256!==originalManifest.files[i].sha256);assert.deepEqual(differences.map(f=>f.path),[fixture]);assert.equal(differences[0].sha256,proposed.sha256);
await save(out+'/source-manifest.json',{...originalManifest,files,fixtureCorrection:{prior:original.sourceManifest,proposal,producer,changedPaths:[fixture]}});const sourceManifest={...await ref(out+'/source-manifest.json'),fileCount:1665};
await save(out+'/fixture-correction.json',{pass:true,sourceManifest,priorSourceManifest:original.sourceManifest,changedPaths:[fixture],productionInputsUnchanged:true,protectedInputCount:1662,proposed,proposal,producer,failedResult,staticResult,staticNotRepeated:true,englishNotRepeated:true});
const fixtureCorrection=await ref(out+'/fixture-correction.json'),entry={...original,sourceManifest,fixtureCorrection,originalEntry,staticResult,helperInputs:[...original.helperInputs,producer,proposal,proposed,failedResult,failed.rawReport,staticResult],acceptedEnglishFrom:failedResult};
await save(out+'/entry.json',entry);const entryRef=await ref(out+'/entry.json');
await save(out+'/runner/entry.json',{browserFiles:entry.browserFiles,browserTestTitles:['Booky explicit writer filter recovery ru']});
const runHelpers=[...entry.helperInputs,entryRef,await ref(out+'/runner/entry.json')],reportPath=out+'/playwright-ru.json',args=['node_modules/@playwright/test/cli.js','test','--config='+review+'/execution-review-a1/playwright.config.mjs'];
const stdout=[],stderr=[],startedAt=new Date().toISOString(),start=Date.now();let launchError=null;
const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,TEMP:artifacts+'/temp',TMP:artifacts+'/temp',S15_BROWSER_CHANNEL:'msedge',S15_BROWSER_OUTPUT:artifacts+'/browser-a1',S15_BROWSER_PROFILE_ROOT:artifacts+'/profiles',S11_BROWSER_PROFILE_ROOT:artifacts+'/profiles',S15_BROWSER_REPORT:reportPath,S15_FOCUS_EVIDENCE_FOLDER:out+'/runner'}});child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>stderr.push(b));child.once('error',e=>launchError=e.message);child.once('close',resolve)});
const durationMs=Date.now()-start;for(const [name,chunks]of [['stdout',stdout],['stderr',stderr]])await fs.writeFile(out+'/'+name+'.log',Buffer.concat(chunks),{flag:'wx'});
await save(out+'/execution.json',{command:[process.execPath,...args],cwd:root,startedAt,durationMs,exitCode,producer,runnerEntry:await ref(out+'/runner/entry.json'),stdout:await ref(out+'/stdout.log'),stderr:await ref(out+'/stderr.log')});
let validationError=launchError,ruReportRef=null,sourceInputsUnchanged=false,helperInputsUnchanged=false,boundaryInputsUnchanged=false;const captureRefs=[],evidenceRefs=[],components=[];
try{
  ruReportRef=await ref(reportPath);const ruReport=await read(reportPath);assert.deepEqual(ruReport.errors,[]);assert.deepEqual({passed:ruReport.stats.expected,failed:ruReport.stats.unexpected,skipped:ruReport.stats.skipped,flaky:ruReport.stats.flaky},{passed:1,failed:0,skipped:0,flaky:0});
  const ruSpecs=specs(ruReport);assert.deepEqual(ruSpecs.map(s=>s.title),['Booky explicit writer filter recovery ru']);
  for(const [language,spec,manifestRef,rawReport,artifactRoot,runResult]of [['en',enSpec,original.sourceManifest,failed.rawReport,artifactBase+'/attempt-a1/browser/browser-a1',failedResult],['ru',ruSpecs[0],sourceManifest,ruReportRef,artifacts+'/browser-a1',null]]){
    assert.equal(spec.tests.length,1);assert.equal(spec.tests[0].results.length,1);const actual=spec.tests[0].results[0];assert.equal(actual.status,'passed');assert.equal(actual.retry,0);
    const attachment=actual.attachments.find(a=>a.name==='booky-writer-filter-recovery-source-evidence');assert.ok(attachment?.path);const evidence=await ref(attachment.path),raw=await read(evidence.path);assert.equal(raw.pass,true);assert.equal(raw.nativeReaderCompositionExercised,true);if(language==='ru')assert.equal(raw.nativeManyBookCatalogNavigationVerified,true);
    const expected=['filtered-empty','recovered','reader-foreground'].map(s=>'booky-writer-filter-recovery-'+language+'-'+s+'.png');if(language==='ru')expected.push('native-reader-composition-many-books-ru.png');assert.deepEqual(raw.screenshots.map(s=>s.filename).sort(),expected.sort());
    const paths=[];async function visit(dir){for(const f of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await visit(p);else if(f.isFile())paths.push(p);else throw Error('Unexpected linked artifact '+p);}}await visit(artifactRoot);
    for(const s of raw.screenshots){const found=paths.filter(p=>path.basename(p)===s.filename);assert.equal(found.length,1);const image=await ref(found[0]);assert.equal(image.sha256,s.sha256);captureRefs.push({...image,filename:s.filename,width:s.width,height:s.height,language});}
    evidenceRefs.push(evidence);components.push({language,title:spec.title,acceptedTestStatus:'passed',sourceManifest:manifestRef,rawReport,evidence,originalRunResult:runResult,repeated:language==='ru'});
  }
  assert.equal(captureRefs.length,7);
}catch(e){validationError=[validationError,e.message].filter(Boolean).join('; ');}
try{assert.deepEqual(await snapshot(files),files);await checkout(entry.checkpoint,true);await checkedRefs([sourceManifest,original.sourceManifest]);sourceInputsUnchanged=true;await checkedRefs(runHelpers);helperInputsUnchanged=true;await checkedRefs(entry.boundaryInputs);boundaryInputsUnchanged=true;}catch(e){validationError=[validationError,e.message].filter(Boolean).join('; ');}
const pass=exitCode===0&&!validationError&&sourceInputsUnchanged&&helperInputsUnchanged&&boundaryInputsUnchanged;
const result={schemaVersion:1,kind:'native-reader-composition-accepted-case-aggregate',pass,mode:'browser',attempt:'ru-correction-a2',checkpoint:entry.checkpoint,sourceManifest,priorSourceManifest:original.sourceManifest,sourceInputCount:1665,protectedInputCount:1662,changedPaths:entry.changedPaths,entry:entryRef,sourceApply:entry.sourceApply,fixtureCorrection,actualProducer:producer,helperInputs:runHelpers,boundaryInputs:entry.boundaryInputs,sourceInputsUnchanged,helperInputsUnchanged,boundaryInputsUnchanged,tests:pass?{passed:2,failed:0,skipped:0,flaky:0}:null,components,rawReport:ruReportRef,priorFailedRun:failedResult,execution:{exitCode,durationMs,executedTests:1,language:'ru'},executionReceipt:await ref(out+'/execution.json'),staticResult,staticRepeated:false,englishRepeated:false,validationError,captureRefs,evidenceRefs,expectedSuccessfulCaptures:7,inspectedImageCount:0,directImageViewsPerformed:false,fixtureOnly:false,runtimeUnchanged:false,productionImplementationChanged:true,sourceCommit:null,runtimeSourceCommit:null,sourceBeforeCommit:true,checksExecutedByThisRunner:{static:false,browser:true,unit:false,pwa:false,android:false},stageAccepted:false,releaseReady:false};
await save(out+'/result.json',result);console.log(JSON.stringify({pass,tests:result.tests,execution:result.execution,validationError,sourceManifest,entry:entryRef,result:await ref(out+'/result.json')},null,2));if(!pass)process.exitCode=1;
