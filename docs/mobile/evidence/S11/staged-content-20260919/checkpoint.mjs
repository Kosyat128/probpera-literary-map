import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const sourceCommit = process.argv[2];
assert.match(sourceCommit, /^[a-f0-9]{40}$/u);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), sourceCommit);
const folder = 'docs/mobile/evidence/S11/staged-content-20260919';
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const reference = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const runs = {};
for (const attempt of ['unit-a2', 'static-a2', 'intake-a2']) {
  const file = folder + '/' + attempt + '/result.json', record = await read(file);
  assert.ok(record.pass, file);
  assert.ok(record.sourceInputsUnchanged || record.sourceAndPreservedInputsUnchanged, file);
  for (const input of [...record.sourceInputs, ...(record.preservedInputs ?? [])]) {
    assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
  }
  runs[attempt] = { ...await reference(file), ...(record.tests ? { tests: record.tests } : {}) };
}
const intake = await read(folder + '/intake-a2/result.json');
assert.deepEqual(intake.inspections.map(item => item.selectionRole), ['current', 'rollback']);
assert.equal(intake.productionCatalogEntries, 0); assert.equal(intake.productionTrustKeys, 0);
const nextAction = 'Continue S11 staged-content integration by connecting receipt-bound inspection to package management, so replaced or removed generations cannot retain an available inspection. Preserve the bundled canonical dataset and current globe; keep local-QA snapshots inactive, production catalog/trust empty and D107 final archive synchronization deferred. Reuse current PWA 4e0de9b2 and Android 77d74c1f artifacts until the next runtime-changing batch.';
const result = { schemaVersion: 1, recordedAt: new Date().toISOString(), stage: 'S11', sourceCommit,
  status: 'STAGED_CONTENT_SEMANTIC_INSPECTION_VALIDATED', pass: true, runs,
  priorAttempt: { path: folder + '/static-a1/result.json', pass: false, reason: 'TypeScript did not narrow after a const arrow returning never. Replacing it with a function declaration preserves rejection behavior and enables narrowing; exact corrected bytes passed all a2 checks.' },
  inspectedGenerations: intake.inspections,
  checks: { exactReceiptAndManifestBinding: true, currentAndRollbackDistinguished: true,
    immutableDetachedSnapshot: true, strictRuEnPayloadContract: true, canonicalIdentityAndDependencyValidation: true,
    fullCandidateAndDeliveredHashesSeparated: true, heldAndStaleDataNotPromoted: true, localeGapsRemainDiagnostics: true },
  realInputLimit: 'Preserved S08 generations contain no stale units. Stale/tombstone rejection is covered by focused synthetic cases.',
  unchangedRuntimeArtifacts: await reference('docs/mobile/evidence/S11/reader-progress-20260919/result.json'),
  moduleWiredToAppDataset: false, artifactsRefreshed: false, actualBrowserStorageTestedInThisSlice: false,
  installedNative: false, iosCompiled: false, activationAllowed: false, editorialApprovalCreated: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction };
await fs.writeFile(folder + '/result.json', json(result), { flag: 'wx' });
const filename = 'docs/mobile/AUTOPILOT_STATE.json', state = await read(filename);
const stageStates = state.stages.map(item => [item.id, item.status]);
state.updatedAt = result.recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction;
state.resume.contextFiles.push(folder + '/result.json');
state.resume.doNotRepeat.push('Staged content semantic inspection: focused units, TypeScript and actual cache/intake of both preserved S08 generations are recorded in staged-content-20260919/result.json. No archive regeneration or artifact rebuild occurred.');
state.verificationCache.s11StagedContentInspection = { ...await reference(folder + '/result.json'), sourceCommit,
  status: result.status, moduleWiredToAppDataset: false, stageAccepted: false, releaseReady: false };
const stage = state.stages.find(item => item.id === 'S11'); stage.artifacts.push(folder + '/result.json');
for (const criterion of stage.criteria.filter(item => ['S11.CONTENT-005', 'S11.CONTENT-006'].includes(item.id))) {
  criterion.evidence.push(folder + '/result.json');
  criterion.notes += ' Verified adult candidate bytes now have a strict immutable staged RU/EN view bound to the exact manifest/selection receipt. Real preserved generations pass semantic intake; locale gaps stay diagnostic. This does not activate the dataset or satisfy full criterion acceptance.';
}
assert.deepEqual(state.stages.map(item => [item.id, item.status]), stageStates);
await fs.writeFile(filename, json(state));
const note = `<!-- s11-staged-content-20260919:begin -->\nSource ${sourceCommit.slice(0, 8)} adds typed semantic inspection after verified cache reads.\nFocused units and TypeScript pass; real preserved S08 current/rollback packages pass\nreceipt, RU/EN, unit identity and dependency validation without regeneration.\nThe full candidate hash and delivered subset hash have separate explicit meanings.\nMissing approved counterparts remain diagnostics; no held text or new approval is added.\nEvidence: evidence/S11/staged-content-20260919/result.json.\nThe module remains staged and does not replace the app dataset. PWA 4e0de9b2 and\nAndroid/dev 77d74c1f remain the current exact preserved runtime artifacts.\nNext: receipt-bound inspection lifecycle in package management, with QA activation off.\nStage statuses unchanged; only S00-S02 accepted, first open S03, releaseReady false.\n<!-- s11-staged-content-20260919:end -->\n\n`;
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const file = 'docs/mobile/' + name; await fs.writeFile(file, note + await fs.readFile(file, 'utf8'));
}
await fs.appendFile('docs/mobile/DECISIONS.md', '\n- D125: Verified package bytes are decoded into a detached immutable staged view\n  bound to the exact observed selection receipt. Signed full-candidate metadata is\n  kept separate from the digest of delivered units, because export omits stale data.\n  Shared canonical unit validation governs the payload; missing locale counterparts\n  remain diagnostic and never create translation approval. Preserved S08 inputs\n  establish actual cache/semantic intake, not app activation or native persistence.\n');
console.log(json({ pass: true, sourceCommit, stageStatusesUnchanged: true, releaseReady: false }));
