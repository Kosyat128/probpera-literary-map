import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sourceCommit=process.argv[2];assert.match(sourceCommit,/^[a-f0-9]{40}$/u);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),sourceCommit);
const folder='docs/mobile/evidence/S13/stand-customization-20260919';
const json=v=>JSON.stringify(v,null,2)+'\n',sha=v=>createHash('sha256').update(v).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const runs={};
for(const name of ['unit','static','browser']) {
 const attempt=process.env['S13_'+name.toUpperCase()+'_ATTEMPT']??'a1';assert.match(attempt,/^a[1-9][0-9]*$/u);
 const p=folder+'/'+name+'-'+attempt+'/result.json',r=await read(p);assert.ok(r.pass&&r.sourceInputsUnchanged,p);
 for(const input of r.sourceInputs) assert.equal(sha(await fs.readFile(input.path)),input.sha256,input.path);
 runs[name]={...await ref(p),tests:r.tests};
}
const pwa=await read(folder+'/pwa-a1/result.json'),android=await read(folder+'/android-a1/result.json');
assert.ok(pwa.pass&&android.pass);assert.equal(pwa.sourceCommit,sourceCommit);assert.equal(android.sourceCommit,sourceCommit);
assert.equal(sha(await fs.readFile(pwa.artifact.path+'/artifact.json')),pwa.artifact.artifactSha256);
assert.equal(sha(await fs.readFile(android.artifact.path+'/artifact.json')),android.artifact.sha256);
assert.equal(sha(await fs.readFile(android.apk.path)),android.apk.sha256);
const inventoryPath=folder+'/starter-set-source-inventory-a2.json';
const inventory=await read(inventoryPath);
assert.equal(inventory.auditValid,true);assert.equal(inventory.acceptedCount,0);assert.equal(inventory.sourceBoundCount,10);
for(const input of inventory.sourceInputs)assert.equal(sha(await fs.readFile(input.path)),input.sha256,input.path);
const visual=await read(folder+'/visual-review.json');assert.equal(visual.pass,true);
for(const input of visual.sourceInputs)assert.equal(sha(await fs.readFile(input.path)),input.sha256,input.path);
const recordedAt=new Date().toISOString();
const nextAction='Continue S13 composition compatibility and included background implementation with the existing scene owners. Preserve validated adult stand preview, native preference ordering and canonical default frame. Optional/child catalog items must stay unavailable without actual assets and required checks. Full-composition persistence, installed-device and release acceptance remain open; do not rerun unchanged stand or antique geometry checks.';
const result={schemaVersion:1,recordedAt,sourceCommit,stage:'S13',status:'INCLUDED_ADULT_STAND_PREVIEW_VALIDATED',pass:true,
 entry:await ref(folder+'/entry.json'),runs,starterSetSourceInventory:await ref(inventoryPath),
 visualReview:await ref(folder+'/visual-review.json'),
 pwa:await ref(folder+'/pwa-a1/result.json'),android:await ref(folder+'/android-a1/result.json'),
 pwaBuildId:pwa.buildId,androidBuildId:android.buildId,apk:android.apk,
 includesAntiqueGeometryCommit:'2bdcdea1cdec5d89c828eb7f6d5566bb5812f1ea',
 includedStandIds:['stand.base.museum','stand.base.wood','stand.base.book-stack'],canonicalFrameRemainsDefault:true,
 sourceProvenance:'authored-in-project',rightsApproval:false,childApproval:false,controlledNativePorts:true,
 actualSceneRenderedInChrome:true,installedNativeDevice:false,iosCompiled:false,
 fullCompositionTransactionImplemented:false,grantsEntitlement:false,productionActionsPerformed:false,
 stageAccepted:false,releaseReady:false,nextAction};
await fs.writeFile(folder+'/result.json',json(result),{flag:'wx'});
const filename='docs/mobile/AUTOPILOT_STATE.json',state=await read(filename),statuses=state.stages.map(s=>[s.id,s.status]);
assert.equal(state.currentStageId,'S03');const stage=state.stages.find(s=>s.id==='S13');assert.equal(stage.status,'IN_PROGRESS');
stage.artifacts.push(folder+'/entry.json',folder+'/result.json',folder+'/pwa-a1/result.json',folder+'/android-a1/result.json');
stage.lastGreenCommands=['unit','static','browser'].map(mode=>'node '+folder+'/run-checks.mjs '+mode+' '+(process.env['S13_'+mode.toUpperCase()+'_ATTEMPT']??'a1'));
stage.lastGreenCommands.push('node '+folder+'/run-pwa.mjs '+sourceCommit,'pwsh -File '+folder+'/build-android.ps1 '+sourceCommit);
for(const c of stage.criteria.filter(c=>['S13.CUSTOM-001','S13.CUSTOM-003','S13.CUSTOM-007'].includes(c.id))) {
 c.status='IN_PROGRESS';c.evidence.push(folder+'/result.json');c.commit=sourceCommit;c.lastValidatedAt=recordedAt;
 c.notes+=' Three adult included procedural stands now use the canonical scene with rendered-preview acknowledgement, apply/cancel, ordered preference recovery and scoped resource disposal. Canonical default is retained. Full composition, child/optional catalogs, device budgets and release acceptance remain open.';
}
state.stages.find(s=>s.id==='S12').artifacts.push(inventoryPath);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;
state.resume.contextFiles.push(folder+'/result.json');
state.resume.doNotRepeat.push('S13 stand-customization-20260919 contains controller/geometry/adapter and real Chrome preview/cancel/persistence evidence plus an accumulated PWA/Android batch. Three original adult stands are source-bound, not legally/editorially/child or whole-stage accepted.');
state.verificationCache.s13IncludedStands={...await ref(folder+'/result.json'),sourceCommit,status:result.status,stageAccepted:false,releaseReady:false};
assert.deepEqual(state.stages.map(s=>[s.id,s.status]),statuses);await fs.writeFile(filename,json(state));
const note=`<!-- s13-stand-customization-20260919:begin -->\nSource ${sourceCommit.slice(0,8)} adds original museum, wood and unlettered book-stack\nstands around the same globe. Preview remains nonmodal; Apply follows a real frame;\nCancel/Back/background and other surfaces preserve the applied choice. Suspended\nrestoration resumes without fencing an untouched saved preference. Confirmation\nfailure keeps the applied session choice with RU/EN retry and ordered port writes.\nFocused units, TypeScript and three actual Chrome cases pass. Starter Set inventory\nis now 10 source-bound of 29 required, zero accepted. Evidence:\nevidence/S13/stand-customization-20260919/result.json. PWA ${pwa.buildId.slice(0,8)} and\nAndroid/dev ${android.buildId.slice(0,8)} include stands plus antique quality geometry.\nAPK SHA256: ${android.apk.sha256}. Earlier artifacts remain preserved.\nFull composition, child/optional content, device, iOS and release gates remain open.\nOnly S00-S02 accepted; first open S03; releaseReady false. Continue S13 composition.\n<!-- s13-stand-customization-20260919:end -->\n\n`;
for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']){const p='docs/mobile/'+name;await fs.writeFile(p,note+await fs.readFile(p,'utf8'));}
await fs.appendFile('docs/mobile/DECISIONS.md','\n- D131: Included adult procedural stands are a distinct slot around the canonical\n  scene. The original edition-specific frame remains the default. Preview is\n  acknowledged by a rendered frame; Apply commits the session choice and ordered\n  preference writes provide truthful retry after unconfirmed saving. Background\n  suspends untouched restoration and cancels explicit drafts. Source provenance\n  and bounded geometry evidence do not approve child use, rights, the full\n  composition transaction, installed devices, Starter Set or release readiness.\n');
console.log(json({pass:true,sourceCommit,runs,pwa:pwa.buildId,android:android.buildId,stageStatusesUnchanged:true,releaseReady:false}));
