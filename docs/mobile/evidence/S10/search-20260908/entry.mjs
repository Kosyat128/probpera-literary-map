import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = 'docs/mobile', evidence = `${base}/evidence/S10/search-20260908`;
const json = value => JSON.stringify(value, null, 2) + '\n';
const state = JSON.parse(await fs.readFile(`${base}/AUTOPILOT_STATE.json`, 'utf8'));
assert.equal(state.currentCriterionId, 'S03.acceptance');
const stage = state.stages.find(item => item.id === 'S10');
assert.equal(stage.status, 'NOT_STARTED');
const recordedAt = new Date().toISOString();
const entry = { schemaVersion: 1, recordedAt, stage: 'S10', status: 'IMPLEMENTATION_IN_PROGRESS',
  baselineSourceCommit: '3eee7d08e288f7f2d9ed4761c870d6cbac18a2d3',
  entryRule: 'Matrix69: previous stage complete or parallel-safe documented', route: 'S03-S10',
  packageIntegrity: { pass: true, checksumCount: 194, manifestFileCount: 191, bindingDocumentCount: 173,
    manifestSha256: 'bb759162674bafe0a9baa87ee6adffd41527d6e38e979f5cf6a6d0445535acd8', checksumFileSha256: state.requirementsHash },
  scope: 'Existing adult globe search: reveal selected writer in the mobile country sheet, accessible Escape focus return, and evidence-backed opposite-locale book-title aliases in the two existing search consumers.',
  mappedRequirements: ['S10.BIL-006', 'S10.BIL-036', 'S10.BIL-037', 'S10.BIL-039'],
  parallelSafety: ['Existing canonical catalog, globe and application hosts provide the complete implementation seam; no preceding-stage acceptance is inferred.',
    'This adult search slice does not depend on merchant credentials, signed release distribution or editorial translation completion.',
    'Keep existing country/writer/work IDs, one scene and global language state, publication/display gates and lazy catalog ownership.',
    'New opposite-locale title aliases require the existing strict localized title evidence contract; no factual data, translation or verification status is generated.',
    'Child policy/search isolation, complete native and verified transliteration aliases, collection/passport and 10k capacity remain explicit subsequent work.',
    'No production, store, database, remote runtime, native plugin or frozen iOS83 projection changes.'],
  acceptanceForSlice: ['A mobile writer search result immediately reveals its existing card and receives usable visible focus.',
    'Escape from the application combobox returns focus to its initiating control without changing scene or selection.',
    'An already evidence-backed second-locale book title resolves the same canonical book key while preserving the active-locale display label.',
    'Invalid, missing or conflicting second-locale title evidence adds no new alias; existing publication gates remain enforced.',
    'Focused data/static regression plus real source-browser mobile search navigation and RU/EN scene identity evidence.'],
  testsRunAtEntry: false, stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
await fs.mkdir(evidence, { recursive: true });
await fs.writeFile(`${evidence}/entry.json`, json(entry), { flag: 'wx' });
stage.status = 'IN_PROGRESS'; stage.criteria.find(item => item.id === 'S10.acceptance').status = 'IN_PROGRESS';
stage.artifacts.push(`${evidence}/entry.json`);
state.verificationCache.parallelSafeStages.S10 = { reason: entry.scope + ' ' + entry.parallelSafety[1], evidence: [`${evidence}/entry.json`, `${base}/GLOBE_APPLICATION_CONTRACT.md`] };
state.verificationCache.s10Search = { status: entry.status, evidence: `${evidence}/entry.json`, sha256: createHash('sha256').update(json(entry)).digest('hex'), stageAccepted: false, releaseReady: false };
state.verificationCache.s06GraphicsQuality.sourceInputsCurrent = false;
state.verificationCache.s06GraphicsQuality.nativeArtifact.currentSource = false;
state.verificationCache.s06GraphicsQuality.pwaArtifact.currentSource = false;
state.verificationCache.s04GlobeApplication.nativeArtifactCurrentSource = false;
state.verificationCache.s04GlobeApplication.nativeArtifact.currentSource = false;
state.verificationCache.s04GlobeApplication.nativeArtifact.runtimeEquivalentToCurrentSource = false;
state.updatedAt = recordedAt;
state.resume.nextAction = 'Complete parallel-safe S10 adult globe search result reveal, Escape focus return and strict evidence-backed cross-locale book aliases. Preserve first-open S03 and frozen iOS83. Prior Android9af7764d/PWA8521b4e5 remain historical once search sources change; no repeated unrelated green suites.';
await fs.writeFile(`${base}/AUTOPILOT_STATE.json`, json(state));
const block = '<!-- s10-search:begin -->\nS10 bounded work in progress: mobile search result reveal and focus,\nplus strict evidence-backed opposite-locale book titles in shared search.\nEntry: evidence/S10/search-20260908/entry.json.\nOne canonical globe/catalog; no generated title or editorial approval.\nFirst-open remains S03. Child search, collection/passport and full alias\ncoverage/capacity remain open. Existing Android/PWA artifacts predate this slice.\nFrozen iOS83 unchanged/pending; no production actions.\n<!-- s10-search:end -->';
for (const name of ['STATUS.md', 'NEXT_CODEX_PROMPT.txt', 'BLOCKERS.md']) {
  const content = (await fs.readFile(`${base}/${name}`, 'utf8')).replaceAll('\r\n', '\n');
  assert.ok(!content.includes('<!-- s10-search:begin -->'));
  const index = content.indexOf('\n\n'); assert.ok(index >= 0);
  await fs.writeFile(`${base}/${name}`, content.slice(0, index + 2) + block + '\n\n' + content.slice(index + 2));
}
const decisions = (await fs.readFile(`${base}/DECISIONS.md`, 'utf8')).replaceAll('\r\n', '\n');
assert.ok(!/^- D091:/mu.test(decisions));
await fs.writeFile(`${base}/DECISIONS.md`, decisions.trimEnd() + '\n\n- D091: Enter S10 using the matrix69 parallel-safe rule for the existing adult\n  globe search. Reveal selected mobile writer content before focus and return\n  Escape focus through the established application search controller. Share\n  only opposite-locale book titles that pass existing published-title evidence;\n  retain canonical IDs, current-language labels and all publication gates.\n  No factual catalog mutation, child-search acceptance, verified transliteration\n  coverage, 10k capacity or full S10 acceptance is implied by this slice.\n');
console.log(json({ stage: 'S10', status: stage.status, firstOpen: state.currentCriterionId, stageAccepted: false }));
