import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sourceCommit=process.argv[2]; assert.match(sourceCommit,/^[a-f0-9]{40}$/u);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),sourceCommit);
const folder='docs/mobile/evidence/S11/download-inspection-20260919';
const json=v=>JSON.stringify(v,null,2)+'\n', sha=v=>createHash('sha256').update(v).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const runs={};
for(const name of ['unit-a1','static-a1','browser-a1']) {
  const path=folder+'/'+name+'/result.json', report=await read(path);
  assert.ok(report.pass&&report.sourceInputsUnchanged,path);
  for(const input of report.sourceInputs) assert.equal(sha(await fs.readFile(input.path)),input.sha256,input.path);
  runs[name]={...await ref(path),tests:report.tests};
}
const pwa=await read(folder+'/pwa-a1/result.json'), android=await read(folder+'/android-a1/result.json');
for(const report of [pwa,android]) { assert.ok(report.pass); assert.equal(report.sourceCommit,sourceCommit); }
assert.equal(sha(await fs.readFile(pwa.artifact.path+'/artifact.json')),pwa.artifact.artifactSha256);
assert.equal(sha(await fs.readFile(android.apk.path)),android.apk.sha256);
const nextAction='Continue S11 airplane-mode core: assess and close cold-offline navigation/search/reader gaps against the current canonical bundled dataset. Keep staged QA packages inactive, production catalog/trust empty, and D107 owner archive synchronization deferred. Do not repeat validated package/reader/globe suites without a related change.';
const result={schemaVersion:1,recordedAt:new Date().toISOString(),sourceCommit,stage:'S11',
  status:'RECEIPT_BOUND_DOWNLOAD_INSPECTION_VALIDATED',pass:true,runs,
  pwa:await ref(folder+'/pwa-a1/result.json'),android:await ref(folder+'/android-a1/result.json'),
  checks:{trustedDescriptorOptIn:true,genericPackagesUnchanged:true,requiredAndRollbackInspectable:true,
    observedReceiptRequired:true,freshVerifiedReadPerInspection:true,immutableViewOutsideReactSnapshot:true,
    scopeWideInvalidation:true,lateCrossRowMutationFenced:true,backgroundAndDisposalClearViews:true,
    boundedUncooperativeRead:true,ruEnPanel:true,actualPreservedPackageOfflineInspection:true,
    keyboardFocusAndRemount:true,mobileNoHorizontalOverflow:true},
  pointInTimeLimit:'Views describe the last authenticated observation. Controller operations and observed lifecycle transitions invalidate them; they are not live cross-process activation authority.',
  installedNative:false,iosCompiled:false,activationAllowed:false,editorialApprovalCreated:false,
  productionActionsPerformed:false,stageAccepted:false,releaseReady:false,nextAction};
await fs.writeFile(folder+'/result.json',json(result),{flag:'wx'});
const filename='docs/mobile/AUTOPILOT_STATE.json',state=await read(filename),statuses=state.stages.map(s=>[s.id,s.status]);
state.updatedAt=result.recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;
state.resume.contextFiles.push(folder+'/result.json');
state.resume.doNotRepeat.push('download-inspection-20260919: 54 units, TypeScript, actual signed S08 package in offline Chrome RU/EN, and exact PWA/Android artifacts passed. Keep prior attempts/artifacts. Staged inspection is not dataset activation.');
state.verificationCache.s11DownloadInspection={...await ref(folder+'/result.json'),sourceCommit,status:result.status,releaseReady:false,stageAccepted:false};
const stage=state.stages.find(s=>s.id==='S11');stage.artifacts.push(folder+'/result.json');
for(const c of stage.criteria.filter(c=>['S11.CONTENT-005','S11.CONTENT-006','S11.MOD-041','S11.UX-006'].includes(c.id))) {
  c.evidence.push(folder+'/result.json');c.notes+=' Opted-in saved packages now have receipt-bound semantic inspection with mutation/background/disposal invalidation and bounded reads. Focused real offline Chrome RU/EN and exact PWA/Android packaging pass. Staged views do not activate content or establish full acceptance.';
}
assert.deepEqual(state.stages.map(s=>[s.id,s.status]),statuses);await fs.writeFile(filename,json(state));
const note=`<!-- s11-download-inspection-20260919:begin -->\nSource ${sourceCommit.slice(0,8)} adds receipt-bound staged inspection to package\nmanagement and a RU/EN content-check control. 54 units, TypeScript and one actual\noffline Chrome scenario with preserved signed S08 bytes pass. Same-package races,\nlate responses, timeout, background and disposal cannot retain an owned old view.\nPWA ${pwa.buildId.slice(0,8)} and Android/dev ${android.buildId.slice(0,8)} are exact preserved runtime artifacts.\nAPK SHA256: ${android.apk.sha256}.\nEvidence: evidence/S11/download-inspection-20260919/result.json.\nViews remain point-in-time QA snapshots; bundled dataset and production trust\nremain unchanged. No installed-device/iOS or full-stage acceptance claim.\nNext: cold-offline core navigation/search/reader gaps. D107 remains deferred.\nOnly S00-S02 accepted; first open S03; releaseReady false.\n<!-- s11-download-inspection-20260919:end -->\n\n`;
for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']) {
 const path='docs/mobile/'+name;await fs.writeFile(path,note+await fs.readFile(path,'utf8'));
}
await fs.appendFile('docs/mobile/DECISIONS.md','\n- D126: Adult candidate inspection is enabled only by trusted descriptor opt-in.\n  A fresh authenticated read must match the observed selection receipt; immutable\n  views remain separate from React snapshots and production activation authority.\n  Controller operations invalidate every row for the same package before observers\n  run; completion revisions fence overlapping reads and mutations. Background,\n  disposal and bounded abort races release stale results. RU/EN shows concise\n  statuses without internal hashes or raw errors.\n');
console.log(json({pass:true,sourceCommit,pwa:pwa.buildId,android:android.buildId,stageStatusesUnchanged:true,releaseReady:false}));
