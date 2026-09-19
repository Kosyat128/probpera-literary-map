import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sourceCommit=process.argv[2];assert.match(sourceCommit,/^[a-f0-9]{40}$/u);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),sourceCommit);
const folder='docs/mobile/evidence/S13/edition-preference-20260919';
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
const recordedAt=new Date().toISOString();
const nextAction='Continue S13 engine and composition work without repeating valid persistence checks. Existing antique frame still uses fixed geometry detail in all quality tiers; inspect and implement bounded tier-aware geometry while preserving exact high-quality default, canonical surface/picking and one renderer. Full preview/apply/revert, stands/accessories and child skins remain open. Keep QA packages inactive, D107 deferred and external device/editorial/store gates distinct.';
const result={schemaVersion:1,recordedAt,sourceCommit,stage:'S13',status:'CANONICAL_EDITION_PREFERENCE_RECOVERY_VALIDATED',pass:true,
 entry:await ref(folder+'/entry.json'),runs,pwa:await ref(folder+'/pwa-a1/result.json'),android:await ref(folder+'/android-a1/result.json'),
 pwaBuildId:pwa.buildId,androidBuildId:android.buildId,apk:android.apk,includesDossierNavigationCommit:'676d78f3b066f8c879766ddd9c45cd58a57ff5af',
 controlledPreferencePorts:true,actualSceneRenderedInChrome:true,installedNativeDevice:false,iosCompiled:false,
 fullCompositionTransactionImplemented:false,grantsEntitlement:false,productionActionsPerformed:false,stageAccepted:false,releaseReady:false,nextAction};
await fs.writeFile(folder+'/result.json',json(result),{flag:'wx'});
const filename='docs/mobile/AUTOPILOT_STATE.json',state=await read(filename);assert.equal(state.currentStageId,'S03');
const stage=state.stages.find(s=>s.id==='S13');assert.equal(stage.status,'NOT_STARTED');stage.status='IN_PROGRESS';
stage.lastGreenCommands=['unit','static','browser'].map(mode=>'node '+folder+'/run-checks.mjs '+mode+' '+(process.env['S13_'+mode.toUpperCase()+'_ATTEMPT']??'a1'));
stage.lastGreenCommands.push('node '+folder+'/run-pwa.mjs '+sourceCommit,'pwsh -File '+folder+'/build-android.ps1 '+sourceCommit);
stage.artifacts.push(folder+'/entry.json',folder+'/result.json',folder+'/pwa-a1/result.json',folder+'/android-a1/result.json');
const criterion=stage.criteria.find(c=>c.id==='S13.CUSTOM-003');criterion.status='IN_PROGRESS';criterion.evidence.push(folder+'/result.json');
criterion.commit=sourceCommit;criterion.lastValidatedAt=recordedAt;
criterion.notes+=' Existing edition persistence now follows the app platform port, successful render and explicit-intent fences. Local save recovery preserves one scene. This does not implement the full composition preview/apply/revert transaction.';
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;
state.resume.contextFiles.push(folder+'/entry.json',folder+'/result.json');
state.resume.doNotRepeat.push('S13 edition-preference-20260919 contains focused preference race/recovery and actual Chrome scene evidence, plus exact PWA/Android artifacts including dossier navigation. Best-effort acceptance is not durability or installed-device evidence.');
const entry=await read(folder+'/entry.json');
state.verificationCache.parallelSafeStages.S13={reason:entry.reason,evidence:[folder+'/entry.json']};
state.verificationCache.s13EditionPreference={...await ref(folder+'/result.json'),sourceCommit,status:result.status,stageAccepted:false,releaseReady:false};
await fs.writeFile(filename,json(state));
const note=`<!-- s13-edition-preference-20260919:begin -->\nSource ${sourceCommit.slice(0,8)} connects existing edition preferences to the app\nplatform port with explicit-intent fencing, rendered-success saves and RU/EN retry.\nFocused unit/adapter, TypeScript and actual Chrome checks pass. Failed confirmation\nkeeps the rendered globe; timeout does not pretend to cancel started native writes.\nPWA ${pwa.buildId.slice(0,8)} and Android/dev ${android.buildId.slice(0,8)} include this slice\nand dossier navigation. APK SHA256: ${android.apk.sha256}.\nEvidence: evidence/S13/edition-preference-20260919/result.json.\nS13 IN_PROGRESS through documented parallel-safe entry. Full composition, complete\nStarter Set, installed devices, iOS and release acceptance stay open. Only S00-S02\naccepted; first open S03; releaseReady false. Continue frame geometry tiers.\n<!-- s13-edition-preference-20260919:end -->\n\n`;
for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']) {const p='docs/mobile/'+name;await fs.writeFile(p,note+await fs.readFile(p,'utf8'));}
await fs.appendFile('docs/mobile/DECISIONS.md','\n- D129: Existing edition preferences use the application platform port. Explicit\n  intent supersedes late hydration; only the rendered successful target may save.\n  Save failure preserves that texture and offers RU/EN retry. Started port writes\n  remain ordered after confirmation timeout and remount; no cancellation or\n  durable-storage guarantee is inferred. This is partial S13 persistence work,\n  not the full composition transaction or a new catalog/entitlement authority.\n');
console.log(json({pass:true,sourceCommit,pwa:pwa.buildId,android:android.buildId,stage:'S13',status:stage.status,releaseReady:false}));
