import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sourceCommit=process.argv[2];assert.match(sourceCommit,/^[a-f0-9]{40}$/u);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),sourceCommit);
const folder='docs/mobile/evidence/S13/antique-detail-20260919';
const json=v=>JSON.stringify(v,null,2)+'\n',sha=v=>createHash('sha256').update(v).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const runs={},nonExecutedFixtureDrift=[];
for(const name of ['unit','static','browser']) {
 const attempt=process.env['S13_'+name.toUpperCase()+'_ATTEMPT']??'a1';assert.match(attempt,/^a[1-9][0-9]*$/u);
 const p=folder+'/'+name+'-'+attempt+'/result.json',r=await read(p);assert.ok(r.pass&&r.sourceInputsUnchanged,p);
 for(const input of r.sourceInputs) {
  const currentSha256=sha(await fs.readFile(input.path));
  if(currentSha256!==input.sha256 && name!=='browser' && input.path==='tests/pwa/globe-antique-detail.spec.mjs') {
   // The common runner also fingerprints the browser fixture during unit/tsc.
   // That fixture was still being authored. Neither Vitest's explicit two-file
   // invocation nor tsconfig's src-only include executes this .mjs file. Keep
   // its historical hash and require exact bytes for the actual Chrome run.
   assert.deepEqual(r.executions.map(e=>e.name),[name==='unit'?'unit':'typecheck']);
   nonExecutedFixtureDrift.push({run:name,path:input.path,recordedSha256:input.sha256,currentSha256});
  } else assert.equal(currentSha256,input.sha256,input.path);
 }
 runs[name]={...await ref(p),tests:r.tests};
}
const nextAction='Continue S13 with a bounded runtime stand customization slice: preserve canonical default frame, add original included adult stand geometry only with safe bounds/picking, and same-scene preview/apply/cancel. Keep edition selection, quality and other semantic state with existing owners. Do not relabel current frame as a completed Starter Set stand. Child variants, full composition/rights/entitlement gates remain separate. Batch this geometry change into the next runtime build with further integrated work.';
const result={schemaVersion:1,recordedAt:new Date().toISOString(),sourceCommit,stage:'S13',status:'ANTIQUE_QUALITY_GEOMETRY_VALIDATED',pass:true,
 entry:await ref(folder+'/entry.json'),runs,nonExecutedFixtureDrift,highMatchesPreChangeGeometry:true,legacyWebsiteAntiqueDetailPreserved:true,
 resourceScope:'Actual antique body/ring replacement and unchanged shared static buffers; not a universal GPU leak certificate.',
 unchangedRuntimeArtifacts:await ref('docs/mobile/evidence/S13/edition-preference-20260919/result.json'),
 artifactsRefreshed:false,installedNativeDevice:false,iosCompiled:false,productionActionsPerformed:false,stageAccepted:false,releaseReady:false,nextAction};
await fs.writeFile(folder+'/result.json',json(result),{flag:'wx'});
const filename='docs/mobile/AUTOPILOT_STATE.json',state=await read(filename),statuses=state.stages.map(s=>[s.id,s.status]);
assert.equal(state.currentStageId,'S03');const stage=state.stages.find(s=>s.id==='S13');assert.equal(stage.status,'IN_PROGRESS');
stage.artifacts.push(folder+'/entry.json',folder+'/result.json');
for(const c of stage.criteria.filter(c=>['S13.CUSTOM-007','S13.CUSTOM-008'].includes(c.id))) {
 c.status='IN_PROGRESS';c.evidence.push(folder+'/result.json');c.commit=sourceCommit;c.lastValidatedAt=result.recordedAt;
 c.notes+=' Antique decoration now follows explicit app quality tiers. High body bytes match the original, while lower tiers reduce buffers. Focused actual Chrome evidence checks 30 quality switches and scoped geometry disposal; full catalog/stand/skin stress and device budgets remain open.';
}
state.updatedAt=result.recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;
state.resume.contextFiles.push(folder+'/result.json');
state.resume.doNotRepeat.push('S13 antique-detail-20260919 validates exact original High geometry, reduced detail, scoped disposal and 30 quality switches. Full optional catalog stress is not claimed; runtime artifacts await next accumulated batch.');
state.verificationCache.s13AntiqueDetail={...await ref(folder+'/result.json'),sourceCommit,status:result.status,stageAccepted:false,releaseReady:false};
assert.deepEqual(state.stages.map(s=>[s.id,s.status]),statuses);await fs.writeFile(filename,json(state));
const note=`<!-- s13-antique-detail-20260919:begin -->\nSource ${sourceCommit.slice(0,8)} makes the existing antique frame follow app graphics\nquality. High body data matches the previous source exactly; Balanced/Economy\nreduce body and ring detail. Static shared parts stay live during body replacement.\nFocused units, TypeScript and one actual Chrome case pass, including 30 quality\nswitches and scoped disposal checks. Evidence: evidence/S13/antique-detail-20260919/result.json.\nPWA 3a57411a and Android/dev 485eda7b remain exact preserved 8ca9f7e5 artifacts;\nthis later geometry slice awaits the next runtime batch. Full composition,\nStarter Set, installed-device and release acceptance stay open. Stage statuses\nunchanged; first open S03; releaseReady false. Continue included stand customization.\n<!-- s13-antique-detail-20260919:end -->\n\n`;
for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']){const p='docs/mobile/'+name;await fs.writeFile(p,note+await fs.readFile(p,'utf8'));}
await fs.appendFile('docs/mobile/DECISIONS.md','\n- D130: Existing app quality owns antique decoration detail too. High retains\n  original geometry and public-site legacy behavior stays unchanged. Replaced\n  shared body buffers have separate lifetime from static tail/fin/mouth buffers.\n  Measured source/Chrome geometry checks remain distinct from all-item GPU,\n  installed-device, full composition and Starter Set acceptance.\n');
console.log(json({pass:true,sourceCommit,runs,artifactsRefreshed:false,stageStatusesUnchanged:true,releaseReady:false}));
