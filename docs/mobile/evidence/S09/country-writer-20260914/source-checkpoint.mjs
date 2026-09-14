import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';
const base='docs/mobile',out=base+'/evidence/S09/country-writer-20260914';
const attempt=process.argv[2];assert.match(attempt,/^a[1-9][0-9]*$/);
const json=value=>JSON.stringify(value,null,2)+'\n',sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async filename=>JSON.parse(await fs.readFile(filename,'utf8'));
const unit=await read(out+'/unit-a1/result.json'),stat=await read(out+'/static-a1/result.json'),typecheck=await read(out+'/typecheck-a1/result.json'),browser=await read(out+'/browser-'+attempt+'/result.json');
for(const result of [unit,stat,typecheck,browser])assert.equal(result.pass,true);
const visual=await read(out+'/visual-review.json');assert.equal(visual.pass,true);
const inputs=new Map();
for(const result of [unit,stat,typecheck,await read(out+'/browser-'+attempt+'/source-inputs.json')])for(const input of result.after){
 // The second browser run exposed an App-only focus-token regression. Country
 // units and platform imports remain unchanged; final type/browser bind App.
 if(!([unit,stat].includes(result)&&input.path==='src/App.tsx')) assert.equal(sha(await fs.readFile(input.path)),input.sha256,input.path);
 inputs.set(input.path,input);
}
const sourceInputs=[...inputs.values()].sort((a,b)=>a.path.localeCompare(b.path));
const result={schemaVersion:1,recordedAt:new Date().toISOString(),stage:'S09',status:'SOURCE_VALIDATION_PASSED',
 sourceInputs:sourceInputs.length,sourceInputsSha256:sha(json(sourceInputs)),sourceInputsCurrent:true,
 implementation:['src/App.tsx','src/components/BookArchiveSection.tsx','src/components/WriterPanel.tsx','src/data/countryLocalization.ts',
  'src/data/countryCapitalReview.mjs','src/data/countryCapitalReview.d.mts','src/data/countries/types.ts','src/planet/selection.ts','scripts/export-premium-translations.mjs'],
 behavior:['Book-to-author action queues exact current country/writer IDs, closes the reader through existing history/shelf transitions, then reveals/focuses the same writer and clears a restrictive filter on the retained globe.',
  'Repeated Back is handled while the actual history restoration is pending. Unrelated navigation cancels the queued target; book search retains its focusAtlas=false behavior.',
  'One capital selector preserves Russian source fields and requires separately supplied exact source/target human review before displaying an English capital. Missing or stale approval uses the existing localized heritage label.',
  'Live proxies/snapshots retain raw canonical ownership; the existing translation exporter preserves normalized supplied approval/withdrawal metadata without creating review. No factual archive population.'],
 validation:{passingUnitCases:unit.tests.passed,unitFiles:unit.tests.files,units:'unit-a1/result.json',platformBoundaries:'static-a1/result.json',typecheck:'typecheck-a1/result.json',
  browser:'browser-'+attempt+'/result.json',visual:'visual-review.json',
  repairs:['The first browser run exposed an incorrect test expectation: the canonical Russia record has no capital field. The existing Russian fallback is preserved, and the final test uses Zambia for actual source-backed capital behavior.',
   'The second run found reuse of writer focus token1 after history cleared pending state. A monotonic ref now advances independently of pending focus, so a retained writer panel handles later author destinations.'],
  reuse:'Country/transport unit inputs and platform imports stayed unchanged; only typecheck and the affected browser case repeated after the App-only focus-token fix. No unchanged benchmark or broad browser suite.'},
 ownerCatalogWorkflow:'Owner populates archives; synchronize then-current canonical archives after app implementation and before final release evidence (D107).',
 catalogScopeCorrection:{evidence:'docs/mobile/evidence/S08/content-export-20260914/catalog-scope-audit.json',rawCanonicalExportCandidateWorks:46,
  note:'46 counts raw canonical export candidates, not browser-visible or release inventory. Runtime publication scope is audited separately; prior artifacts remain unchanged.'},
 canonicalFactsChanged:false,editorialApprovalCreated:false,stageAccepted:false,releaseReady:false,productionActionsPerformed:false,
 next:'Build one exact-source Android/dev and local-QA PWA. Verify actual offline RUEN book-to-writer return and country-field eligibility, then preserve artifacts. Owner archive final synchronization remains deferred as requested.'};
await fs.writeFile(out+'/source-inputs.json',json(sourceInputs),{flag:'wx'});await fs.writeFile(out+'/source-result.json',json(result),{flag:'wx'});await fs.writeFile(out+'/result.json',json(result),{flag:'wx'});
const state=await read(base+'/AUTOPILOT_STATE.json'),stage=state.stages.find(value=>value.id==='S09');
stage.artifacts=[...new Set([...stage.artifacts,out+'/result.json'])];
stage.lastGreenCommands=[unit.tests.passed+' focused country localization/export transport tests passed.','TypeScript/platform boundaries passed.','One actual native source-browser RUEN scenario: book-to-author, held history/Back boundary, same scene, focus and actual Zambia capital eligibility passed.'];
state.verificationCache.s09CountryWriter={status:result.status,evidence:out+'/result.json',sha256:sha(json(result)),passingUnitCases:unit.tests.passed,stageAccepted:false,releaseReady:false};
state.verificationCache.currentCatalogGate={sourceCommit:'89cf558d7be310503672420568b1c7a045bd8325',rawCanonicalExportCandidateWorks:46,evidence:result.catalogScopeCorrection.evidence,scope:'raw canonical export candidates; runtime visibility separately audited',finalScopeOwnedByUser:true};
state.updatedAt=result.recordedAt;state.resume.nextAction=result.next+' First-open S03 remains; no stage acceptance.';
await fs.writeFile(base+'/AUTOPILOT_STATE.json',json(state));
const block='<!-- s09-country-writer-20260914:begin -->\nS09 source validated: book-to-author return closes reader/history, restores the\ncanonical writer and focus on the same globe, including repeated Back.\nCapital fields use one source/target review gate across RUEN/proxy/export.\n'+unit.tests.passed+' focused tests, static and 1 actual native-source RUEN browser passed.\nReal Zambia capital round trip verified; no guessed Russia capital added.\nOwner fills archives; final canonical sync follows app implementation (D107).\nRaw export includes 46 candidate works; browser/release scope is separate.\nEvidence: evidence/S09/country-writer-20260914/result.json. No stage acceptance.\nNext: one exact-source Android/dev and local-QA PWA, then offline return proof.\nFirst-open S03; child/full content/commerce/device/release gates remain open.\n<!-- s09-country-writer-20260914:end -->';
for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']){
 const p=base+'/'+name,text=(await fs.readFile(p,'utf8')).replaceAll('\r\n','\n');assert.ok(text.includes('<!-- s09-country-writer-20260914:begin -->'));
 await fs.writeFile(p,text.replace(/<!-- s09-country-writer-20260914:begin -->[\s\S]*?<!-- s09-country-writer-20260914:end -->/u,block));
}
await fs.appendFile(base+'/DECISIONS.md','\n- D108: Book-to-writer selection follows the actual reader/history close\n  boundary; repeated Back cannot consume it early. Capital review binds exact\n  country/source/target values and survives existing export transport without\n  promotion of generation provenance into approval. Canonical Russia lacks a\n  capital field; tests preserve that fallback and use actual Zambia source\n  for the RUEN field check. The raw export has 46 candidate works; browser\n  visibility is separate. Owner final archives determine release scope.\n');
const verification=await verifyExecutionFiles(process.cwd());await fs.writeFile(out+'/source-state-verification.json',json(verification),{flag:'wx'});assert.equal(verification.pass,true,JSON.stringify(verification.errors));
for(const name of ['run-checks.mjs','run-browser.mjs','source-checkpoint.mjs','entry.mjs','owner-steering.mjs'])await fs.writeFile(out+'/'+name,await fs.readFile('.tmp/s09-country-writer-20260914/'+name),{flag:'wx'});
console.log(json({status:result.status,passingUnitCases:unit.tests.passed,stateVerification:verification.pass,firstOpen:state.currentCriterionId}));
