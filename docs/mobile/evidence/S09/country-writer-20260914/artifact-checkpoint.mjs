import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {verifyExecutionFiles} from '../../scripts/mobile/verify-state.mjs';
const base='docs/mobile',out=base+'/evidence/S09/country-writer-20260914',android=base+'/evidence/S04/country-writer-android-20260914';
const [flag,sourceCommit,...rest]=process.argv.slice(2);
assert.equal(flag,'--source-commit');assert.match(sourceCommit,/^[a-f0-9]{40}$/);assert.equal(rest.length,0);
const json=v=>JSON.stringify(v,null,2)+'\n',sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
assert.equal(execFileSync('git',['-c','safe.directory='+process.cwd().replaceAll('\\','/'),'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),sourceCommit);
const source=await read(out+'/source-result.json'),apk=await read(android+'/result.json'),pwa=await read(out+'/pwa/result.json'),visual=await read(out+'/pwa/visual-review.json');
assert.equal(source.status,'SOURCE_VALIDATION_PASSED');assert.equal(apk.sourceCommit,sourceCommit);assert.equal(pwa.sourceCommit,sourceCommit);
assert.equal(apk.validation.nativeStrictAudit.pass,true);assert.equal(apk.validation.build.pass,true);assert.equal(apk.validation.binaryAudit.pass,true);
assert.equal(pwa.strictArtifactAuditPassed,true);assert.equal(pwa.sourceUnchanged,true);assert.equal(pwa.statistics.expected,1);assert.equal(pwa.statistics.unexpected,0);assert.equal(pwa.statistics.flaky,0);assert.equal(pwa.artifact.exactCopiesVerified,true);
assert.equal(visual.pass,true);assert.equal(visual.sourceCommit,sourceCommit);assert.equal(visual.buildId,pwa.buildId);assert.equal(visual.images.length,2);
for(const f of visual.images){assert.equal(f.viewedAtOriginalResolution,true);assert.equal(sha(await fs.readFile(f.path)),f.sha256);}
const union=new Map();
for(const [artifactPath,expectedHash,buildId] of [[apk.artifact.path+'/artifact.json',apk.artifact.sha256,apk.buildId],[pwa.artifact.path+'/artifact.json',pwa.artifact.artifactSha256,pwa.buildId]]){
 const bytes=await fs.readFile(artifactPath);assert.equal(sha(bytes),expectedHash);const artifact=JSON.parse(bytes);assert.equal(artifact.sourceCommit,sourceCommit);assert.equal(artifact.buildId,buildId);
 for(const input of artifact.sourceInputs.files){if(union.has(input.path))assert.equal(union.get(input.path),input.sha256);union.set(input.path,input.sha256);}
}
for(const input of await read(out+'/pwa/support-after.json')){if(union.has(input.path))assert.equal(union.get(input.path),input.sha256);union.set(input.path,input.sha256);}
for(const [path,expected] of union)assert.equal(sha(await fs.readFile(path)),expected,path);
assert.equal(sha(await fs.readFile(apk.apk.path)),apk.apk.sha256);
const next='Continue bounded S10 opposite-locale canonical writer-name search on existing data. Preserve current artifacts; rebuild only after the next validated runtime checkpoint. Owner fills archives; final canonical sync and full content validation follow app implementation (D107).';
const result={...source,recordedAt:new Date().toISOString(),status:'LOCAL_SOURCE_AND_ARTIFACT_VALIDATION_PASSED',sourceCommit,
 artifacts:{android:{buildId:apk.buildId,evidence:android+'/result.json',sha256:sha(await fs.readFile(android+'/result.json')),apk:apk.apk},pwa:{buildId:pwa.buildId,evidence:out+'/pwa/result.json',sha256:sha(await fs.readFile(out+'/pwa/result.json')),artifact:pwa.artifact}},
 currentInputsVerified:union.size,actualPwaBrowserPasses:1,artifactVisualReview:out+'/pwa/visual-review.json',next};
const state=await read(base+'/AUTOPILOT_STATE.json');
const protect=s=>JSON.stringify({head:s.headSha,currentStage:s.currentStageId,currentCriterion:s.currentCriterionId,stages:s.stages.map(({artifacts,lastGreenCommands,...x})=>x),ios:s.verificationCache.s04IosGlobeProjection,owner:s.verificationCache.ownerCatalogWorkflow});
const protectedState=protect(state);
state.verificationCache.s09CountryWriter={status:result.status,evidence:out+'/result.json',sha256:sha(json(result)),sourceCommit,passingUnitCases:source.validation.passingUnitCases,sourceBrowserPasses:1,pwaBrowserPasses:1,sourceInputsCurrent:true,stageAccepted:false,releaseReady:false};
state.verificationCache.s04CountryWriterAndroid={status:apk.status,evidence:android+'/result.json',sha256:sha(await fs.readFile(android+'/result.json')),sourceCommit,buildId:apk.buildId,stageAccepted:false,releaseReady:false};
const s04=state.stages.find(s=>s.id==='S04'),s09=state.stages.find(s=>s.id==='S09');s04.artifacts=[...new Set([...s04.artifacts,android+'/result.json'])];s09.artifacts=[...new Set([...s09.artifacts,out+'/pwa/result.json'])];
s09.lastGreenCommands=[...s09.lastGreenCommands,'Exact-source Android dev APK compiled and byte-inspected; actual local-QA PWA offline RUEN country/writer case passed.'];
state.updatedAt=result.recordedAt;state.resume.nextAction=next+' First-open S03 unchanged; no stage acceptance or production action. Frozen iOS83 remains pending.';
assert.equal(protect(state),protectedState);
const block='<!-- s09-country-writer-20260914:begin -->\nSource '+sourceCommit+': book-to-author return closes reader/history,\nrestores the canonical writer and focus on the same globe, including repeated Back.\nCountry capital fields share exact source/target review eligibility across RUEN/proxy/export.\n26 focused tests, type/platform checks and 1 actual native-source browser passed.\nAndroid/dev '+apk.buildId.slice(0,8)+': compiled APK, debug signature and exact runtime bytes inspected.\nAPK: '+apk.apk.path+'.\nLocal-QA PWA '+pwa.buildId.slice(0,8)+': strict artifact audit and 1 actual offline RUEN\nbook-to-writer/country-field case passed; 2 original-resolution screenshots inspected.\nBoth artifacts bind the same source. No installed-device or release acceptance.\nOwner fills archives; final canonical sync follows app implementation (D107).\nRaw export includes 46 candidate works; source fixture/browser/release scope is separate.\nEvidence: evidence/S09/country-writer-20260914/result.json. No stage acceptance.\nNext: bounded S10 opposite-locale writer-name search on existing canonical data.\nFirst-open S03; child/full content/commerce/device/release gates remain open.\n<!-- s09-country-writer-20260914:end -->';
const docs=[];for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']){const filename=base+'/'+name,text=(await fs.readFile(filename,'utf8')).replaceAll('\r\n','\n');assert.ok(text.includes('<!-- s09-country-writer-20260914:begin -->'));docs.push([filename,text.replace(/<!-- s09-country-writer-20260914:begin -->[\s\S]*?<!-- s09-country-writer-20260914:end -->/u,block)]);}
const decisions=base+'/DECISIONS.md',previous=await fs.readFile(decisions,'utf8');assert.ok(!/^- D109:/mu.test(previous));
await fs.writeFile(out+'/result.json',json(result));await fs.writeFile(base+'/AUTOPILOT_STATE.json',json(state));for(const [filename,text] of docs)await fs.writeFile(filename,text);
await fs.writeFile(decisions,previous.trimEnd()+'\n\n- D109: Source604f919 produced exact Android/dev0ecb9b49 and local-QA\n  PWA84163b52. The real PWA passed offline RUEN book-to-author return and\n  source-backed country-capital eligibility on the retained scene. Android\n  compilation/signature/byte audits passed. These are development/QA artifacts,\n  not installed-device or release acceptance. Owner archive filling continues\n  independently; final canonical synchronization follows app implementation.\n');
const verification=await verifyExecutionFiles(process.cwd());await fs.writeFile(out+'/final-state-verification.json',json(verification),{flag:'wx'});assert.equal(verification.pass,true,JSON.stringify(verification.errors));
for(const name of ['artifact-checkpoint.mjs','record-visual.mjs','record-pwa-visual.mjs'])await fs.writeFile(out+'/'+name,await fs.readFile('.tmp/s09-country-writer-20260914/'+name),{flag:'wx'});
console.log(json({status:result.status,sourceCommit,android:apk.buildId,pwa:pwa.buildId,currentInputsVerified:union.size,stateVerification:verification.pass,firstOpen:state.currentCriterionId}));
