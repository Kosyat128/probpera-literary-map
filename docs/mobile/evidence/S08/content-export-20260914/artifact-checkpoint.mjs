import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';
const base='docs/mobile',out=base+'/evidence/S08/content-export-20260914';
const json=value=>JSON.stringify(value,null,2)+'\n',sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async filename=>JSON.parse(await fs.readFile(filename,'utf8'));
const source=await read(out+'/source-result.json'),inspection=await read(out+'/artifact-inspection.json');assert.equal(inspection.pass,true);
const generations=await Promise.all(['a1','a2'].map(attempt=>read(out+'/export-'+attempt+'/result.json')));
const sourceCommit=generations[0].sourceCommit;assert.equal(generations[1].sourceCommit,sourceCommit);
for(const input of await read(out+'/source-inputs.json'))assert.equal(sha(await fs.readFile(input.path)),input.sha256,input.path);
for(const generation of generations)assert.equal(sha(await fs.readFile(generation.output+'/manifest.json')),generation.manifestSha256);
const result={...source,recordedAt:new Date().toISOString(),status:'LOCAL_SOURCE_AND_DATA_ARTIFACT_VALIDATION_PASSED',sourceCommit,
 canonicalCandidate:{units:4701,heldUnits:41479,fields:inspection.versions[0].breakdown,
  scope:'Adult data candidates, including work archive records; counts are field units, not approved books or bilingual release coverage.',
  reviewedEnglishBiographyUnits:0,englishDescriptionUnits:0},
 artifacts:generations.map(generation=>({version:generation.version,output:generation.output,manifestSha256:generation.manifestSha256,
  sourceInputs:generation.sourceInputs,sourceInputsSha256:generation.sourceInputsSha256,files:generation.files,
  signatureVerified:true,activationAllowed:false,releaseReady:false})),
 artifactEvidence:out+'/artifact-inspection.json',
 validation:{...source.validation,realExports:2,continuationVerified:true,retainedPreviousGeneration:true,
  exactLocaleBytesStable:true,diskSignaturesVerified:true,heldOrStaleTextInPackages:false},
 limits:['Adult candidates only; general/child production export and compatible runtime atomic activation/rollback remain open.',
  'English names and published-title candidates are not comprehensive immutable bilingual editorial approval; country/biography/description missing bindings remain held.',
  'Dedicated local QA signatures do not confer production authority; actual npm package bytes are not a hermetic audit, while imported repository bytes and dependency locks are recorded.',
  'Current Android/PWA UI artifacts remain source aac56087, builds8f32bb6c/e5ff862c; export-only modules have no runtime import.'],
 next:'S09: fix existing book-to-writer navigation in the retained scene and remove unreviewed Russian capital fallback from English country details. Keep S08 runtime/child/complete review gates open; do not rebuild unchanged UI until an actual runtime change is tested.'};
await fs.writeFile(out+'/result.json',json(result));
const state=await read(base+'/AUTOPILOT_STATE.json');
state.verificationCache.s08ContentExport={status:result.status,sourceCommit,evidence:out+'/result.json',sha256:sha(json(result)),passingCases:112,
 canonicalUnits:4701,heldUnits:41479,versions:result.artifacts.map(({version,output,manifestSha256})=>({version,output,manifestSha256})),stageAccepted:false,releaseReady:false};
const stage=state.stages.find(value=>value.id==='S08');stage.lastGreenCommands.push('Two real canonical exports: actual disk signature/files/source inputs passed; exact pinned continuation preserves prior version and unchanged locale bytes.');
state.updatedAt=result.recordedAt;state.resume.nextAction=result.next+' First-open S03 remains.';
await fs.writeFile(base+'/AUTOPILOT_STATE.json',json(state));
const block='<!-- s08-content-export-20260914:begin -->\nSource '+sourceCommit+': S08 canonical candidate export,\ndurable correction holds and dedicated QA content signatures validated.\n112 focused tests/static passed. Two real exports passed actual disk signature,\nfile and source checks; pinned continuation retains the original version.\n4701 candidate fields;41479 held fields. These are not book/approval counts.\nEN biographies/descriptions with missing review bindings stay outside packages.\nLatest: .tmp/content-exports/s08-20260914-a2 (version2, QA only).\nEvidence: evidence/S08/content-export-20260914/result.json. No stage acceptance.\nNext: S09 existing book-to-writer return and English country-field eligibility.\nFirst-open S03. Child/runtime atomic update/rollback/full editorial gates remain.\nAndroid8f32bb6c/PWAe5ff862c still bind unchanged UI sourceaac56087.\n<!-- s08-content-export-20260914:end -->';
for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']){
 const filename=base+'/'+name,text=(await fs.readFile(filename,'utf8')).replaceAll('\r\n','\n');
 assert.ok(text.includes('<!-- s08-content-export-20260914:begin -->'));
 await fs.writeFile(filename,text.replace(/<!-- s08-content-export-20260914:begin -->[\s\S]*?<!-- s08-content-export-20260914:end -->/u,block));
}
await fs.appendFile(base+'/DECISIONS.md','\n- D105: Source89cf558 produced two real adult canonical data generations.\n  Independent disk verification rechecks files and public-key signatures;\n  manifest-pinned continuation retains the prior version and identical RUEN\n  payload bytes without artificial invalidations. Field counts are candidate\n  scope, not book counts, English review coverage or production acceptance.\n  Existing Android/PWA builds need no repeat for unused export-only tooling.\n');
const verification=await verifyExecutionFiles(process.cwd());await fs.writeFile(out+'/final-state-verification.json',json(verification),{flag:'wx'});assert.equal(verification.pass,true,JSON.stringify(verification.errors));
for(const name of ['run-export.mjs','inspect-exports.mjs','artifact-checkpoint.mjs'])await fs.writeFile(out+'/'+name,await fs.readFile('.tmp/s08-content-export-20260914/'+name),{flag:'wx'});
console.log(json({status:result.status,sourceCommit,stateVerification:verification.pass,stageAccepted:false}));
