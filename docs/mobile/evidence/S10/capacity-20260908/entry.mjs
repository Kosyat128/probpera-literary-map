import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = 'docs/mobile', evidence = `${base}/evidence/S10/capacity-20260908`;
const json = value => JSON.stringify(value, null, 2) + '\n';
const state = JSON.parse(await fs.readFile(`${base}/AUTOPILOT_STATE.json`, 'utf8'));
assert.equal(state.currentCriterionId, 'S03.acceptance');
const stage = state.stages.find(item => item.id === 'S10');
assert.equal(stage.status, 'IN_PROGRESS');
const recordedAt = new Date().toISOString();
const entry = { schemaVersion: 1, recordedAt, stage: 'S10', status: 'IMPLEMENTATION_IN_PROGRESS',
  baselineSourceCommit: '89ce01c60fafb5067c997c7f130c432c3750ad04', route: 'S03-S10',
  entryRule: 'Continue the D091 matrix69 parallel-safe adult search slice',
  packageIntegrity: { pass: true, checksumCount: 194, manifestFileCount: 191, bindingDocumentCount: 173,
    manifestSha256: 'bb759162674bafe0a9baa87ee6adffd41527d6e38e979f5cf6a6d0445535acd8', checksumFileSha256: state.requirementsHash },
  scope: 'Prepare document tokens once and query tokens once for the existing adult globe/shared search; measure an explicitly synthetic 10000-record workload against the exact prior engine.',
  mappedRequirements: ['S10.BIL-006', 'S10.BIL-036', 'S10.BIL-037', 'S10.BIL-039'],
  parallelSafety: ['Single canonical catalog, IDs, globe and locale controller remain the authority.',
    'No change to publication/evidence gates, source content or approved title aliases.',
    'Derived indexes remain owned by their existing runtime; no unbounded query cache.',
    'Synthetic capacity fixtures are test-only and never become production book records.',
    'Full native aliases, child isolation, collection/passport, device latency and stage acceptance remain open.',
    'No store, production, remote runtime or frozen iOS83 mutations.'],
  acceptanceForSlice: ['Preserve documented matching and scoring, including short tokens, conservative fuzzy/transliteration and cross-field matches.',
    'Compile fields once at index creation/extension and each search query once.',
    'Use active-locale label ordering without changing canonical result actions.',
    'Record before/after query latency, preparation cost and memory for the same deterministic synthetic 10000-record corpus; explicitly report practical limits.',
    'Run focused unit/static regression and the affected actual globe book navigation browser scenario.'],
  testsRunAtEntry: false, stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
await fs.mkdir(evidence, { recursive: true });
await fs.writeFile(`${evidence}/entry.json`, json(entry), { flag: 'wx' });
stage.artifacts.push(`${evidence}/entry.json`);
state.verificationCache.s10SearchCapacity = { status: entry.status, evidence: `${evidence}/entry.json`, sha256: createHash('sha256').update(json(entry)).digest('hex'), stageAccepted: false, releaseReady: false };
state.verificationCache.s10Search.sourceInputsCurrent = false;
state.verificationCache.s10Search.nativeArtifact.currentSource = false;
state.verificationCache.s10Search.pwaArtifact.currentSource = false;
state.updatedAt = recordedAt;
state.resume.nextAction = 'Complete bounded S10 precompiled search and measured synthetic 10000-record capacity, preserving canonical identities, all evidence gates and first-open S03. Existing Android40d1a1b5/PWAa22183b0 predate these new search sources. Frozen iOS83 unchanged; no production actions.';
await fs.writeFile(`${base}/AUTOPILOT_STATE.json`, json(state));
const block = '<!-- s10-capacity:begin -->\nS10 search capacity implementation in progress: compile document/query fields once.\nSynthetic 10000-record benchmark must retain exact baseline matching and report\npreparation/memory costs. This is not production catalog coverage.\nEntry: evidence/S10/capacity-20260908/entry.json. First-open S03 remains.\nEarlier Android40d1a1b5/PWAa22183b0 are historical once sources change.\nFrozen iOS83 unchanged/pending; no production actions.\n<!-- s10-capacity:end -->';
for (const name of ['STATUS.md', 'NEXT_CODEX_PROMPT.txt', 'BLOCKERS.md']) {
  const content = (await fs.readFile(`${base}/${name}`, 'utf8')).replaceAll('\r\n', '\n');
  assert.ok(!content.includes('<!-- s10-capacity:begin -->'));
  const index = content.indexOf('\n\n'); assert.ok(index >= 0);
  await fs.writeFile(`${base}/${name}`, content.slice(0, index + 2) + block + '\n\n' + content.slice(index + 2));
}
const decisions = (await fs.readFile(`${base}/DECISIONS.md`, 'utf8')).replaceAll('\r\n', '\n');
assert.ok(!/^- D094:/mu.test(decisions));
await fs.writeFile(`${base}/DECISIONS.md`, decisions.trimEnd() + '\n\n- D094: Continue the parallel-safe S10 adult search slice with precompiled\n  document fields and one prepared query per execution. Preserve raw matching,\n  scoring, publication/title evidence and canonical actions. Compare the exact\n  prior engine with a deterministic synthetic10000-record workload, including\n  index preparation and memory. A capacity fixture establishes no factual\n  catalog coverage or installed-device latency acceptance. Keep first-open S03,\n  child/collection/full-alias gates and frozen iOS83 unchanged.\n');
console.log(json({ stage: 'S10', status: stage.status, firstOpen: state.currentCriterionId, stageAccepted: false }));
