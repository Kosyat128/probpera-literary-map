import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = 'docs/mobile', evidence = `${base}/evidence/S10/history-20260908`;
const json = value => JSON.stringify(value, null, 2) + '\n';
const state = JSON.parse(await fs.readFile(`${base}/AUTOPILOT_STATE.json`, 'utf8'));
assert.equal(state.currentCriterionId, 'S03.acceptance');
const stage = state.stages.find(item => item.id === 'S10');
assert.equal(stage.status, 'IN_PROGRESS');
const recordedAt = new Date().toISOString();
const entry = { schemaVersion: 1, recordedAt, stage: 'S10', status: 'IMPLEMENTATION_IN_PROGRESS',
  baselineSourceCommit: '641f18f57ca9877be912ad6231705541c188dd64', route: 'S03-S10',
  entryRule: 'Continue the D091 matrix69 parallel-safe adult search/collection/resume slice',
  packageIntegrity: { pass: true, checksumCount: 194, manifestFileCount: 191, bindingDocumentCount: 173,
    manifestSha256: 'bb759162674bafe0a9baa87ee6adffd41527d6e38e979f5cf6a6d0445535acd8', checksumFileSha256: state.requirementsHash },
  scope: 'Connect the existing Recently opened collection panel to bounded native adult history through the already installed preference bridge; restore the existing writer/work route, reveal and focus without replacing the globe.',
  mappedRequirements: ['S10.BIL-006', 'S10.BIL-037'],
  parallelSafety: ['One canonical catalog/locale/globe and existing history UI/selection callbacks; no extra factual database.',
    'Fixed native adult namespace stores at most20 canonical references and opening times, never labels, entitlements, child profiles or source content.',
    'Existing PWA identity-scoped history retains its provider and storage; public website remains unchanged.',
    'Native persistence errors and bounded pending operations are exposed honestly with retry; no claim of secure or durable secret storage.',
    'Native adult history is not reusable by future child mode, and no child-policy acceptance is claimed.',
    'No production, store, database, remote runtime or frozen iOS83 mutations.'],
  acceptanceForSlice: ['Native opening of canonical writers/works updates the same bounded list; RUEN resolves current labels by the same IDs.',
    'Cold native-host document restores saved history; clear supersedes delayed reads/writes and retries preserve the latest session intent.',
    'Unavailable, rejected, malformed or timed-out persistence never freezes the app or silently claims success.',
    'Selecting a recent writer returns to the persistent globe, resets an incompatible filter, opens the mobile card and focuses it.',
    'Focused store/adapter/panel regression, static boundaries and actual mobile source-browser persistence/locale/navigation evidence.'],
  testsRunAtEntry: false, stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
await fs.mkdir(evidence, { recursive: true });
await fs.writeFile(`${evidence}/entry.json`, json(entry), { flag: 'wx' });
stage.artifacts.push(`${evidence}/entry.json`);
state.verificationCache.s10NativeHistory = { status: entry.status, evidence: `${evidence}/entry.json`, sha256: createHash('sha256').update(json(entry)).digest('hex'), stageAccepted: false, releaseReady: false };
state.verificationCache.s10SearchCapacity.sourceInputsCurrent = false;
state.verificationCache.s10SearchCapacity.nativeArtifact.currentSource = false;
state.verificationCache.s10SearchCapacity.pwaArtifact.currentSource = false;
state.updatedAt = recordedAt;
state.resume.nextAction = 'Complete bounded S10 native Recently opened history, honest persistence retry and direct writer reveal/focus. Keep first-open S03 and unchanged PWA scoped history; existing Android7e302703/PWAb13ec20e predate this slice once sources change. No repeated unchanged search benchmark or broad suites. Frozen iOS83 unchanged; no production actions.';
await fs.writeFile(`${base}/AUTOPILOT_STATE.json`, json(state));
const block = '<!-- s10-history:begin -->\nS10 native Recently opened implementation in progress. Connect the existing\ncollection history to bounded native adult preferences; restore canonical\nwriter/work IDs and reveal/focus the writer on the same globe.\nEntry: evidence/S10/history-20260908/entry.json. Persistence failures need\nexplicit status/retry; future child history remains separate and unimplemented.\nFirst-open S03; earlier Android7e302703/PWAb13ec20e become historical.\nFrozen iOS83 unchanged/pending; no production actions.\n<!-- s10-history:end -->';
for (const name of ['STATUS.md', 'NEXT_CODEX_PROMPT.txt', 'BLOCKERS.md']) {
  const content = (await fs.readFile(`${base}/${name}`, 'utf8')).replaceAll('\r\n', '\n');
  assert.ok(!content.includes('<!-- s10-history:begin -->'));
  const index = content.indexOf('\n\n'); assert.ok(index >= 0);
  await fs.writeFile(`${base}/${name}`, content.slice(0, index + 2) + block + '\n\n' + content.slice(index + 2));
}
const decisions = (await fs.readFile(`${base}/DECISIONS.md`, 'utf8')).replaceAll('\r\n', '\n');
assert.ok(!/^- D097:/mu.test(decisions));
await fs.writeFile(`${base}/DECISIONS.md`, decisions.trimEnd() + '\n\n- D097: Continue S10 through the existing adult collection/history seam.\n  Native hosts currently use the disabled history context; connect a bounded\n  adult-only store to the installed preferences bridge and canonical IDs.\n  Do not broaden generic preference keys or reuse the PWA license namespace.\n  Show pending/error/retry honestly; clear supersedes delayed work. Opening a\n  recent writer must reveal/focus its existing card and preserve the globe.\n  No new content/approval, child isolation, durable-secret, device or stage\n  acceptance is implied. Keep first-open S03 and frozen iOS83 unchanged.\n');
console.log(json({ stage: 'S10', status: stage.status, firstOpen: state.currentCriterionId, stageAccepted: false }));
