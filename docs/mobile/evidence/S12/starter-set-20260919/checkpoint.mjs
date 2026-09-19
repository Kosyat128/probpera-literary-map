import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sourceCommit=process.argv[2];assert.match(sourceCommit,/^[a-f0-9]{40}$/u);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),sourceCommit);
const folder='docs/mobile/evidence/S12/starter-set-20260919';
const json=v=>JSON.stringify(v,null,2)+'\n',sha=v=>createHash('sha256').update(v).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const runs={};
for(const name of ['unit','static','audit']) {
 const path=folder+'/'+name+'-a1/result.json',r=await read(path);assert.ok(r.pass&&r.sourceInputsUnchanged,path);
 for(const input of r.sourceInputs) assert.equal(sha(await fs.readFile(input.path)),input.sha256,input.path);
 runs[name]={...await ref(path),tests:r.tests,audit:r.audit};
}
const prior=await read(folder+'/result.json').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
const recordedAt=prior?.recordedAt??new Date().toISOString();
async function writeOnce(path,value) {
 const bytes=json(value);
 try {await fs.writeFile(path,bytes,{flag:'wx'});}
 catch(error) {if(error.code!=='EEXIST')throw error;assert.equal(await fs.readFile(path,'utf8'),bytes,'Existing checkpoint differs: '+path);}
}
const reason='Matrix69 permits documented parallel-safe entry. This local inclusion policy and honest Starter Set inventory grant no license, activate no content and depend on no outstanding editorial, native-device, child or store acceptance. First-open stage remains S03.';
const dependencies=await Promise.all(['08_PAID_APP_COMMERCIAL_MODEL_RU.md','09_BASE_EDITION_STARTER_SET_RU.md','10_STORE_IAP_ENTITLEMENTS_REFUNDS_RU.md','37_BASE_EDITION_STARTER_SET.csv','45_STORE_PRODUCT_SCHEMA.json','111_SAFE_PAID_BILINGUAL_V1_CONFIG.json'].map(p=>ref('docs/mobile/requirements/v12/'+p)));
const entry={schemaVersion:1,recordedAt,stage:'S12',sourceCommit,entryType:'documented-parallel-safe',reason,
 requirementsHash:'a3cfdba220ee667886d193c3fffc9a9eb144d3611a4ec65f106d519534166732',
 manifestSha256:'bb759162674bafe0a9baa87ee6adffd41527d6e38e979f5cf6a6d0445535acd8',dependencies,
 routingNote:'The coarse S11-S15 route omits commerce dependencies required by the S12 matrix and criterion bindings; only those exact dependencies were added to this scope.',
 grantsEntitlement:false,activationAllowed:false,stageAccepted:false,releaseReady:false};
await writeOnce(folder+'/entry.json',entry);
const nextAction='Continue runtime customization around the persistent canonical globe: inspect S13 bindings, preserve default edition and existing selections, implement the next bounded skin/stand interaction gap and validate affected behavior only. Batch runtime artifact refresh with the pending dossier navigation fix. Keep S12 full Starter Set acceptance open, D107 deferred, QA inactive and production trust empty.';
const result={schemaVersion:1,recordedAt,sourceCommit,stage:'S12',status:'INCLUSION_POLICY_AND_PARTIAL_SOURCE_INVENTORY_VALIDATED',pass:true,
 entry:await ref(folder+'/entry.json'),runs,completeness:await ref(folder+'/audit-a1/starter-set-completeness.json'),
 requiredCount:29,acceptedCount:0,sourceBoundCount:7,grandfatheredEditions:9,starterSetStatus:'INCOMPLETE',
 unchangedRuntimeArtifacts:await ref('docs/mobile/evidence/S11/download-inspection-20260919/result.json'),
 artifactsRefreshed:false,grantsEntitlement:false,activationAllowed:false,productionActionsPerformed:false,stageAccepted:false,releaseReady:false,nextAction};
await writeOnce(folder+'/result.json',result);
const filename='docs/mobile/AUTOPILOT_STATE.json',state=await read(filename);assert.equal(state.currentStageId,'S03');
const stage=state.stages.find(s=>s.id==='S12');assert.equal(stage.status,'NOT_STARTED');stage.status='IN_PROGRESS';
const commands=['unit','static','audit'].map(mode=>'node '+folder+'/run-checks.mjs '+mode+' a1');
stage.lastGreenCommands=commands;stage.artifacts.push(folder+'/entry.json',folder+'/result.json',folder+'/audit-a1/starter-set-completeness.json');
for(const c of stage.criteria.filter(c=>['S12.COMMERCE-002','S12.CUSTOM-001'].includes(c.id))) {
 c.status='IN_PROGRESS';c.evidence.push(folder+'/result.json');c.commit=sourceCommit;c.lastValidatedAt=recordedAt;
 c.notes+=' The 29 mandatory identities and nine grandfathered editions cannot become optional SKUs. Local source inventory is INCOMPLETE: seven source bindings, zero fully accepted items; rights, bilingual, child, visual, offline and platform acceptance remain open.';
}
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;
state.resume.contextFiles.push(folder+'/entry.json',folder+'/result.json');
state.resume.doNotRepeat.push('S12 starter-set-20260919: 11 units, TypeScript and source inventory pass. Inventory INCOMPLETE is expected, not Starter Set acceptance; no app activation or entitlement grant.');
state.verificationCache.parallelSafeStages.S12={reason,evidence:[folder+'/entry.json']};
state.verificationCache.s12StarterSetInventory={...await ref(folder+'/result.json'),sourceCommit,status:result.status,stageAccepted:false,releaseReady:false};
await fs.writeFile(filename,json(state));
const note=`<!-- s12-starter-set-20260919:begin -->\nSource ${sourceCommit.slice(0,8)} defines included Base Edition identities and rejects\noptional-SKU mappings for all mandatory and grandfathered items. Eleven units,\nTypeScript and the source inventory pass. Starter Set remains INCOMPLETE:\n29 required, seven source-bound, zero fully accepted; nine existing editions included.\nNo license, asset approval, content activation or store operation is inferred.\nS12 is IN_PROGRESS through documented parallel-safe entry; only S00-S02 accepted,\nfirst open S03, releaseReady false. Evidence: evidence/S12/starter-set-20260919/result.json.\nPWA 5403f982 and Android/dev 8d8cb1ec remain preserved; dossier navigation awaits\nthe next runtime build batch. Continue directly with bounded S13 runtime work.\n<!-- s12-starter-set-20260919:end -->\n\n`;
for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']) {const p='docs/mobile/'+name;await fs.writeFile(p,note+await fs.readFile(p,'utf8'));}
await fs.appendFile('docs/mobile/DECISIONS.md','\n- D128: S12 enters through a documented parallel-safe inclusion-policy slice.\n  Mandatory Starter Set and grandfathered site editions cannot become optional\n  products. A candidate SKU, alias or UI flag grants no entitlement. The inventory\n  records actual canonical sources and assets separately from full acceptance;\n  missing Starter Set items and rights/bilingual/child/platform gates stay open.\n');
console.log(json({pass:true,sourceCommit,stage:'S12',status:stage.status,starterSetStatus:'INCOMPLETE',releaseReady:false}));
