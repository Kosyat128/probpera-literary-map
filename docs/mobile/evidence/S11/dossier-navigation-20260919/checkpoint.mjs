import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sourceCommit=process.argv[2];assert.match(sourceCommit,/^[a-f0-9]{40}$/u);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),sourceCommit);
const folder='docs/mobile/evidence/S11/dossier-navigation-20260919';
const json=v=>JSON.stringify(v,null,2)+'\n',sha=v=>createHash('sha256').update(v).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const runs={};
for(const name of ['unit','static','browser']) {
 const attempt=process.env['DOSSIER_'+name.toUpperCase()+'_ATTEMPT']??'a1';assert.match(attempt,/^a[1-9][0-9]*$/u);
 const path=folder+'/'+name+'-'+attempt+'/result.json',r=await read(path);assert.ok(r.pass&&r.sourceInputsUnchanged,path);
 for(const input of r.sourceInputs) assert.equal(sha(await fs.readFile(input.path)),input.sha256,input.path);
 runs[name]={...await ref(path),tests:r.tests};
}
const nextAction='Continue internal V12 work from the verified dossier navigation checkpoint. Preserve completed offline package, reader and globe checks; refresh runtime artifacts in the next accumulated runtime batch. Keep QA packages inactive, production trust empty, D107 deferred, and full-stage acceptance open.';
const result={schemaVersion:1,recordedAt:new Date().toISOString(),sourceCommit,stage:'S11',
 status:'DOSSIER_NAVIGATION_LATE_LAYOUT_VALIDATED',pass:true,runs,
 unchangedRuntimeArtifacts:await ref('docs/mobile/evidence/S11/download-inspection-20260919/result.json'),
 artifactsRefreshed:false,controlledLayoutPort:true,controlledAccountPort:true,actualProductionAuth:false,
 savedBookPolicyUnchanged:true,installedNative:false,iosCompiled:false,productionActionsPerformed:false,
 stageAccepted:false,releaseReady:false,nextAction};
await fs.writeFile(folder+'/result.json',json(result),{flag:'wx'});
const filename='docs/mobile/AUTOPILOT_STATE.json',state=await read(filename),statuses=state.stages.map(s=>[s.id,s.status]);
state.updatedAt=result.recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;
state.resume.contextFiles.push(folder+'/result.json');
state.resume.doNotRepeat.push('dossier-navigation-20260919 records focused late-layout/failed-layout navigation, saved-book position and account-scope checks. No runtime artifact rebuild in this slice.');
state.verificationCache.s11DossierNavigation={...await ref(folder+'/result.json'),sourceCommit,status:result.status,releaseReady:false,stageAccepted:false};
const stage=state.stages.find(s=>s.id==='S11');stage.artifacts.push(folder+'/result.json');
for(const c of stage.criteria.filter(c=>['S11.CONTENT-007','S11.MOD-041','S11.UX-006'].includes(c.id))) {
 c.evidence.push(folder+'/result.json');c.notes+=' Accessible dossier navigation and existing saved-book progress no longer depend on successful physical pagination. Exact semantic identities and account ownership fence late results. Focused source/browser evidence is separate from full offline/device acceptance.';
}
assert.deepEqual(state.stages.map(s=>[s.id,s.status]),statuses);await fs.writeFile(filename,json(state));
const note=`<!-- s11-dossier-navigation-20260919:begin -->\nSource ${sourceCommit.slice(0,8)} preserves explicit dossier navigation across delayed\nphysical pagination and saves existing saved-book positions when layout fails.\nCanonical identities and account ownership fence restored and pending locations.\nFocused unit, TypeScript and actual component Chrome checks pass with controlled\nlayout/auth ports. Evidence: evidence/S11/dossier-navigation-20260919/result.json.\nPWA 5403f982 and Android/dev 8d8cb1ec remain exact preserved artifacts from 6bd52a5a;\nthis newer source slice awaits the next runtime build batch. No full-stage,\ninstalled-device, production auth or release acceptance is claimed.\n<!-- s11-dossier-navigation-20260919:end -->\n\n`;
for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']){const path='docs/mobile/'+name;await fs.writeFile(path,note+await fs.readFile(path,'utf8'));}
await fs.appendFile('docs/mobile/DECISIONS.md','\n- D127: Accessible dossier navigation is semantic user intent, independent of\n  font measurement and physical layout success. Exact public-document identities\n  validate restored locations; pending intent is consumed into physical pages\n  without taking ownership away from later page turns. Saved-book progress stays\n  local and follows its existing explicit-save policy and account ownership.\n');
console.log(json({pass:true,sourceCommit,runs,artifactsRefreshed:false,stageStatusesUnchanged:true,releaseReady:false}));
