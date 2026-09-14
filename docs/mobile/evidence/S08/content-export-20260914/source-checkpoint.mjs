import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';
const base='docs/mobile', out=base+'/evidence/S08/content-export-20260914';
const json=value=>JSON.stringify(value,null,2)+'\n', sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async name=>JSON.parse(await fs.readFile(name,'utf8'));
const names=['unit-a1','unit-input-a1','static-a1'];
let passing=0, files=0;
const checked=new Map();
for(const name of names) {
  const record=await read(out+'/'+name+'/result.json'); assert.equal(record.pass,true,name);
  if(record.tests){passing+=record.tests.passed; files+=record.tests.files;}
  for(const input of record.after){assert.equal(sha(await fs.readFile(input.path)),input.sha256,input.path);checked.set(input.path,input);}
}
const sourceInputs=[...checked.values()].sort((a,b)=>a.path.localeCompare(b.path));
const result={schemaVersion:1,recordedAt:new Date().toISOString(),stage:'S08',status:'SOURCE_VALIDATION_PASSED',
 sourceInputs:sourceInputs.length,sourceInputsSha256:sha(json(sourceInputs)),sourceInputsCurrent:true,
 implementation:['src/planet/contentExportTypes.ts','src/planet/contentExportHash.ts','src/planet/contentExport.ts','src/planet/contentDependencies.ts','scripts/mobile/content-package-signature.mjs','scripts/mobile/content-export-input.mjs','scripts/mobile/export-content.mjs'],
 behavior:['Derive bounded adult RU/EN data candidates from the canonical locale-independent catalog and existing publication/evidence gates; preserve exact country/writer/work IDs.',
 'Hold unbound English country names, unreviewed biography pairs and work descriptions lacking existing immutable target review; held records expose IDs/reasons only.',
 'Retain unresolved staleness across subsequent unchanged exports using an exact previous candidate-unit hash and an independently pinned previous manifest/file inventory; source withdrawal produces ID-only tombstones.',
 'Data-only RU/EN files use a dedicated ES256/P1363 QA content contract, exact compatibility/context and per-file bytes/SHA; generated QA private key remains memory-only. No production/child activation.',
 'New contained CLI output appears atomically only after verification; previous generations cannot be overwritten. Package files exclude stale units and internal held diagnostics.'],
 validation:{passingCases:passing,files,reports:names.map(name=>name+'/result.json'),syntax:'Node --check scripts/mobile/export-content.mjs passed',
 reuse:'Only new export/dependency/signature/previous-input suites and affected static checks. Existing Android/PWA UI source and screenshots unchanged; no UI rebuild or search benchmark repeated.'},
 reviewCorrections:['Persist stale state across an identical later generation.','Hold English descriptions lacking an existing immutable target review binding.','Verify prior data against an independently retained manifest hash before carrying staleness.','Keep bounded package JSON separate from larger internal held diagnostics.'],
 canonicalFactsChanged:false,editorialApprovalCreated:false,stageAccepted:false,releaseReady:false,productionActionsPerformed:false,
 next:'Commit tested source; export one exact-source canonical adult candidate with ephemeral QA signing, preserve its manifest hash and inspect counts/held evidence. Validate the continuation path without repeating unchanged UI builds.'};
await fs.writeFile(out+'/source-inputs.json',json(sourceInputs),{flag:'wx'});
await fs.writeFile(out+'/source-result.json',json(result),{flag:'wx'});
await fs.writeFile(out+'/result.json',json(result),{flag:'wx'});
const state=await read(base+'/AUTOPILOT_STATE.json');
const acceptedHead=state.headSha, ios=JSON.stringify(state.verificationCache.s04IosGlobeProjection);
const stage=state.stages.find(value=>value.id==='S08');
const active=new Set(['S08.acceptance','S08.BIL-020','S08.BIL-021','S08.BIL-022','S08.BIL-099','S08.BIL-101','S08.CANON-004','S08.CONTENT-002','S08.CONTENT-003','S08.CONTENT-004','S08.CONTENT-005','S08.CONTENT-010','S08.SEC-003','S08.SEC-008','S08.PERF-007']);
for(const criterion of stage.criteria) if(active.has(criterion.id)) {assert.ok(['OPEN','IN_PROGRESS'].includes(criterion.status));criterion.status='IN_PROGRESS';}
stage.artifacts=[...new Set([...stage.artifacts,out+'/result.json'])];
stage.lastGreenCommands=[passing+' focused passing tests across'+files+' new files.','TypeScript and platform boundaries passed; new CLI syntax checked.'];
state.verificationCache.s08ContentExport={status:result.status,evidence:out+'/result.json',sha256:sha(json(result)),passingCases:passing,stageAccepted:false,releaseReady:false};
state.resume.nextAction=result.next+' First-open S03 unchanged; S08 remains partial.';
state.updatedAt=result.recordedAt;
assert.equal(state.headSha,acceptedHead); assert.equal(JSON.stringify(state.verificationCache.s04IosGlobeProjection),ios);
await fs.writeFile(base+'/AUTOPILOT_STATE.json',json(state));
const block='<!-- s08-content-export-20260914:begin -->\nS08 canonical candidate exporter, durable stale propagation and separate QA content\nsignature contract implemented. '+passing+' focused tests across'+files+' files and static checks passed.\nExact canonical IDs retained; no facts or approval created. Missing immutable\nreview bindings produce held IDs/reasons; stale units stay outside package files.\nPrevious generations require an independently retained manifest hash and exact\nfile inventory. Private QA keys are memory-only; activation remains disabled.\nNext: one committed-source canonical export and actual artifact inspection.\nEvidence: evidence/S08/content-export-20260914/result.json. No stage acceptance.\nFirst-open S03; Android8f32bb6c/PWAe5ff862c remain the unchanged UI artifacts.\n<!-- s08-content-export-20260914:end -->';
for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']) {
 const filename=base+'/'+name, text=(await fs.readFile(filename,'utf8')).replaceAll('\r\n','\n');
 assert.ok(text.includes('<!-- s08-content-export-20260914:begin -->'));
 await fs.writeFile(filename,text.replace(/<!-- s08-content-export-20260914:begin -->[\s\S]*?<!-- s08-content-export-20260914:end -->/u,block));
}
await fs.appendFile(base+'/DECISIONS.md','\n- D104: Canonical S08 exports retain persistent source-correction holds across\n  generations. Resuming requires an independently retained previous manifest\n  SHA and exact file inventory; observing a current hash cannot replace an\n  immutable review. English descriptions without target review remain held.\n  Dedicated QA content keys are ephemeral, unrelated to purchase authority.\n  Candidate signing is integrity evidence only, never editorial or release approval.\n');
const verification=await verifyExecutionFiles(process.cwd());
await fs.writeFile(out+'/source-state-verification.json',json(verification),{flag:'wx'});assert.equal(verification.pass,true,JSON.stringify(verification.errors));
for(const name of ['run-checks.mjs','source-checkpoint.mjs'])await fs.writeFile(out+'/'+name,await fs.readFile('.tmp/s08-content-export-20260914/'+name),{flag:'wx'});
console.log(json({status:result.status,passingCases:passing,files,stateVerification:verification.pass,firstOpen:state.currentCriterionId}));
