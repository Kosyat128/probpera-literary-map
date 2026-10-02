import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const BASE = '787723adc0b4082febe4b7de8d46b4418b19e71e';
const FOLDER = 'docs/mobile/evidence/S03/premium-interface-round2-20261002';
const GLOBALS = ['AGENTS.md', 'docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt'];
const RUN = path.join(HERE, 'checkpoint-a1');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const inside = (base, target) => { const rel = path.relative(base, target); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); };
const at = filename => path.isAbsolute(filename) ? filename : path.join(ROOT, filename);
const git = args => execFileSync('git', ['-c', 'safe.directory=' + ROOT, '-c', 'core.autocrlf=true', '-c', 'core.whitespace=cr-at-eol', ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }).trim();
async function bytes(filename, pinned) {
  const target = at(filename), stat = await fs.lstat(target), real = await fs.realpath(target);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 8 * 1024 * 1024 && (inside(ROOT, real) || inside(HERE, real)), filename);
  const value = await fs.readFile(target); if (pinned) assert.equal(hash(value), pinned, filename); return value;
}
const read = async filename => JSON.parse(await bytes(filename));
const ref = async filename => ({ path: filename, sha256: hash(await bytes(filename)) });
async function fresh(filename, value) {
  const target = at(filename); assert.ok(inside(at(FOLDER), target) || inside(RUN, target));
  await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, typeof value === 'string' || Buffer.isBuffer(value) ? value : json(value), { flag: 'wx' });
}
function protectedState(state) {
  const copy = structuredClone(state); delete copy.headSha; delete copy.updatedAt;
  for (const key of ['nextAction', 'contextFiles', 'doNotRepeat']) delete copy.resume[key];
  const stage = copy.stages.find(row => row.id === 'S03'); delete stage.artifacts;
  const criterion = stage.criteria.find(row => row.id === 'S03.acceptance'); delete criterion.notes; delete criterion.evidence;
  return copy;
}
const push = (list, value) => { if (!list.includes(value)) list.push(value); };
const bindingFile = path.join(HERE, 'checkpoint-binding.json');
async function prepare() {
  assert.equal(git(['rev-parse', 'HEAD']), BASE); assert.equal(git(['status', '--porcelain=v1', '--untracked-files=all']), '');
  const entries = [];
  const add = async (name, source) => entries.push({ name, ...(await ref(source)) });
  for (const name of ['proposal.json', 'source-commit.json']) await add(name, path.join(HERE, name));
  for (const attempt of ['native-a1', 'native-a2']) {
    for (const name of ['receipt.json', 'results.json', 'source-before.json', 'source-after.json', 'browser-execution.json', 'browser.stdout.txt', 'browser.stderr.txt']) await add(attempt + '/' + name, path.join(HERE, attempt, name));
  }
  for (const name of ['application-typescript-execution.json', 'fixture-syntax-execution.json']) await add('native-a1/' + name, path.join(HERE, 'native-a1', name));
  for (const name of ['producer.mjs', 'pwa.config.mjs', 'root-binding.json', 'current-source-manifest.json']) await add('runtime/' + name, path.join(HERE, 'runtime', name));
  for (const name of ['result.json', 'binding.json', 'source-before.json', 'source-after.json', 'browser-playwright.json', 'browser-observation.json', 'browser-command.json', 'browser-execution.json', 'browser.stdout.txt', 'browser.stderr.txt', 'build-execution.json', 'strict-audit.json', 'strict-audit-command.json', 'strict-audit-execution.json', 'strict-audit.stdout.txt', 'strict-audit.stderr.txt']) await add('runtime/actual-a1/' + name, path.join(HERE, 'runtime/actual-a1', name));
  const pwa = await read(path.join(HERE, 'runtime/actual-a1/result.json'));
  for (const capture of pwa.browser.screenshots) await add('captures/' + capture.name, capture.path);
  const nativeFolder = path.join(ROOT, '.tmp/native-planet-browser-results/d258-premium-interface-a2/artifacts/native-planet-compact-prem-49478-locale-and-edition-controls');
  const nativeNames = (await fs.readdir(nativeFolder)).filter(name => name.endsWith('.png')).sort(); assert.equal(nativeNames.length, 14);
  for (const name of nativeNames) await add('captures/' + name, path.join(nativeFolder, name));
  const verifier = await ref('scripts/mobile/verify-state.mjs'); assert.equal(verifier.sha256, 'f31e2b86d3e415a541a9186cac35ec1765ce4ae235eeecb310038cee46260ebf');
  const binding = { base: BASE, globals: await Promise.all(GLOBALS.map(ref)), entries, verifier, captureReview: { reviewer: 'ROOT', nativeCapturesViewed: nativeNames, pwaCapturesViewed: pwa.browser.screenshots.map(row => row.name), scope: 'Manual review of actual final native and QA PWA captures; no full visual, accessibility or installed-device acceptance.', findings: ['Final menu row hierarchy, icon tiles, locale flags, wrapping, Collection content-first ordering and settings shortcut are readable in reviewed captures.', 'The RU About/Downloads captures contain a transient cyan rectangle immediately after touch; user-select:none did not eliminate it. Chrome touch feedback is a hypothesis, not a proved text-selection bug or confirmed repair.', 'Touch/reset end-frame Booky trigger is partly clipped at the right edge; this is not full Booky/mobile visual acceptance and needs separate focused diagnosis if persistent.'] } };
  await fs.writeFile(bindingFile, json(binding), { flag: 'wx' });
  console.log(json({ mode: 'prepare', entries: entries.length, captures: nativeNames.length + pwa.browser.screenshots.length, helper: await ref(fileURLToPath(import.meta.url)), binding: await ref(bindingFile) }));
}
async function loadBinding() {
  assert.equal(process.argv.length, 5); await bytes(fileURLToPath(import.meta.url), process.argv[3]);
  const binding = JSON.parse(await bytes(bindingFile, process.argv[4])); assert.equal(binding.base, BASE);
  assert.deepEqual(binding.globals.map(row => row.path), GLOBALS);
  for (const row of [...binding.globals, ...binding.entries, binding.verifier]) await bytes(row.path, row.sha256);
  return binding;
}
async function record() {
  const binding = await loadBinding(); assert.equal(git(['rev-parse', 'HEAD']), BASE); assert.equal(git(['status', '--porcelain=v1', '--untracked-files=all']), '');
  await assert.rejects(fs.lstat(at(FOLDER)), { code: 'ENOENT' }); await assert.rejects(fs.lstat(RUN), { code: 'ENOENT' });
  const input = async name => { const row = binding.entries.find(row => row.name === name); assert.ok(row, name); return JSON.parse(await bytes(row.path, row.sha256)); };
  const a1 = await input('native-a1/receipt.json'), a2 = await input('native-a2/receipt.json'), pwa = await input('runtime/actual-a1/result.json'), committed = await input('runtime/current-source-manifest.json');
  assert.equal(a1.pass, true); assert.equal(a2.pass, true); assert.equal(a1.typeScript.exitCode, 0); assert.equal(a1.syntax.exitCode, 0); assert.equal(a2.onlyCssChangedSinceA1, true);
  assert.equal(a2.typeScriptInvocations, 0); assert.equal(a2.syntaxInvocations, 0); assert.equal(a2.viewports, 7); assert.equal(a2.largeText, '200%');
  const before1 = await input('native-a1/source-before.json'), before2 = await input('native-a2/source-before.json');
  assert.deepEqual(before1.files, (await input('native-a1/source-after.json')).files); assert.deepEqual(before2.files, (await input('native-a2/source-after.json')).files); assert.deepEqual(before2.files, committed.files);
  assert.deepEqual(before1.files.filter(row => row.path !== 'src/host/host.css'), before2.files.filter(row => row.path !== 'src/host/host.css'));
  assert.equal(committed.sourceCommit, BASE); assert.equal((await input('source-commit.json')).nativeTestedWorkingRowsPreserved, true);
  for (const name of ['native-a1/results.json', 'native-a2/results.json', 'runtime/actual-a1/browser-playwright.json']) {
    const report = await input(name); assert.equal(report.stats.expected, 1); for (const key of ['unexpected', 'flaky', 'skipped']) assert.equal(report.stats[key], 0);
  }
  assert.equal(pwa.pass, true); assert.equal(pwa.failure, null); assert.equal(pwa.sourceCommit, BASE); assert.equal(pwa.buildInvocations, 1); assert.equal(pwa.browserInvocations, 1);
  assert.equal(pwa.browser.capturesReviewed, false); assert.equal(pwa.smokeInvocations, 0); assert.equal(pwa.packagingInvocations, 0); assert.equal(pwa.liveQaAuthority.signerClosed, true); assert.equal(pwa.liveQaAuthority.privateKeyPersisted, false);
  const audit = await input('runtime/actual-a1/strict-audit.json'); assert.equal(audit.pass, true); assert.equal(audit.identity.buildId, pwa.buildId);
  assert.deepEqual((await input('runtime/actual-a1/source-before.json')).files, committed.files); assert.deepEqual((await input('runtime/actual-a1/source-after.json')).files, committed.files);
  const originals = new Map(); for (const row of binding.globals) originals.set(row.path, await bytes(row.path, row.sha256));
  const state = JSON.parse(originals.get(GLOBALS[1])), protectedBefore = protectedState(state); assert.equal(state.currentStageId, 'S03'); assert.equal(state.currentCriterionId, 'S03.acceptance');
  const stage = state.stages.find(row => row.id === 'S03'), criterion = stage.criteria.find(row => row.id === 'S03.acceptance'); assert.equal(stage.status, 'IN_PROGRESS'); assert.equal(stage.criteria.length, 12);
  for (const row of stage.criteria) assert.equal(row.status, row.id === 'S03.acceptance' ? 'IN_PROGRESS' : 'OPEN');
  const evidence = [], copied = new Map(), files = [];
  for (const row of binding.entries) {
    const data = await bytes(row.path, row.sha256), target = copied.get(row.sha256) ?? FOLDER + '/actual/' + row.name;
    if (!copied.has(row.sha256)) { await fresh(target, data); copied.set(row.sha256, target); files.push(target); }
    evidence.push({ ...row, canonicalCopy: { path: target, sha256: row.sha256 } });
  }
  const recordedAt = new Date().toISOString(), resultFile = FOLDER + '/result.json', reviewFile = FOLDER + '/capture-review.json';
  const result = { schemaVersion: 1, decision: 'D258', kind: 'focused-premium-interface-working-evidence', sourceCommit: BASE, criterionIds: ['S03.acceptance'], recordedAt, pass: true, stageAccepted: false, releaseReady: false, buildId: pwa.buildId,
    implementation: ['App-only grouped icon menu and quieter rows, retained RU/GB flags and actual handlers.', 'Collection books and reading before secondary settings/help; direct focus-and-scroll settings shortcut.', 'Localized short archive introduction, genuine disclosure retaining original editorial paragraph, compact actual count and consistent typography/buttons/focus.'],
    checks: { applicationTypeScriptInvocations: 1, fixtureSyntaxInvocations: 1, nativeBrowserInvocations: 2, finalNativeViewports: 7, finalMenuTextScale: '200%', pwaBuildInvocations: 1, pwaStrictAudit: true, pwaOfflineBrowserCases: 1, freshPackageInvocations: 0, nativeFinalFileRowsEqualCommitted: true, sourceRows: committed.files.length, unchangedTsAfterFirstRun: true },
    qualification: 'Native a1 passed functionally but required CSS specificity follow-up after visual review. Final a2 reran only the same affected actual-App browser case after CSS changes; TypeScript/syntax are retained from a1 with all other source rows equal. Raw producer capturesReviewed:false remains unchanged; manual review is separate. Touch paint and Booky end-frame clipping observations are not full visual acceptance.',
    scope: { realAppAndCanonicalGlobe: true, focusedRuEnOfflineSearchAndReturn: true, actualOsInstallation: false, realPurchase: false, providerValidated: false, publicAccountCurrentBuild: false, fullAccessibility: false, fullVisualAcceptance: false, productionActionsPerformed: false }, sourceFiles: (await input('source-commit.json')).files.map(row => ({ path: row.path, sha256: row.proposedSha256 })), evidence };
  await fresh(resultFile, result); await fresh(reviewFile, { schemaVersion: 1, sourceCommit: BASE, buildId: pwa.buildId, ...binding.captureReview, evidence: evidence.filter(row => row.name.startsWith('captures/')) }); files.push(resultFile, reviewFile);
  const summary = 'D258 at source787723 refines the app Menu into two ordered action groups with icon tiles, quieter rows, locale flags and clear focus; Collection puts books before utilities, offers a real settings/help jump, and retains editorial archive detail in an accessible disclosure. One TypeScript and fixture syntax check passed; native a1 functionally passed and exposed older CSS specificity, corrected before final a2 PASS on seven viewports and 200% Menu text. All non-CSS source rows stayed equal after a1, and final tested rows equal the committed13-root snapshot. One fresh QA PWA build/strict audit and one existing offline RU/EN author-search/book-return case passed at build' + pwa.buildId.slice(0, 8) + '. ROOT directly reviewed14 final native and4 PWA captures; raw capture-review flags remain separate. The RU touch-feedback rectangle and partly clipped Booky reset end-frame remain scoped visual observations, not confirmed repairs/full visual acceptance. All criteria, approvals, cache and stage/release statuses stay unchanged.';
  const nextAction = state.resume.nextAction;
  const marker = 's03-premium-interface-round2-20261002';
  const note = '<!-- ' + marker + ':begin -->\n' + summary + '\nEvidence: ' + resultFile + '\nNext: ' + nextAction + '\n<!-- ' + marker + ':end -->\n\n';
  push(criterion.evidence, resultFile); criterion.notes += ' ' + summary;
  const provenance = FOLDER + '/checkpoint-inputs.json', helper = FOLDER + '/actual/checkpoint.mjs', readme = FOLDER + '/README.md';
  await fresh(provenance, { binding, helper: await ref(fileURLToPath(import.meta.url)), previousNextActionRetained: nextAction, verificationExecutedAtRecordTime: false }); await fresh(helper, await bytes(fileURLToPath(import.meta.url))); await fresh(readme, note.trimEnd() + '\n'); files.push(provenance, helper, readme);
  for (const filename of files) push(stage.artifacts, filename); state.headSha = BASE; state.updatedAt = recordedAt; push(state.resume.contextFiles, resultFile); push(state.resume.contextFiles, reviewFile);
  push(state.resume.doNotRepeat, 'D258 retains one app TypeScript/fixture syntax run, two affected native invocations (CSS-only final retry), one source-bound QA PWA compilation/audit and one offline RU/EN case. Do not repeat these checks, old units, packaging or APK builds for documentation. Current-public mobile account case remains the next pending plan item; full visual/device/provider/stage/release acceptance stays open.');
  assert.deepEqual(protectedState(state), protectedBefore);
  const updates = new Map([[GLOBALS[1], json(state)]]);
  for (const filename of GLOBALS.filter(filename => !updates.has(filename))) {
    const old = originals.get(filename).toString('utf8'); assert.equal(old.includes('<!-- ' + marker + ':begin -->'), false);
    if (filename === 'AGENTS.md') { const position = old.indexOf('<!-- s03-'); assert.ok(position > 0); updates.set(filename, old.slice(0, position) + note + old.slice(position)); }
    else if (filename.endsWith('/DECISIONS.md')) updates.set(filename, old.trimEnd() + '\n\n- ' + summary + ' Evidence: ' + resultFile + '.\n');
    else updates.set(filename, note + old);
  }
  for (const [filename, data] of originals) await fresh(path.join(RUN, 'originals', filename), data);
  for (const [filename, data] of updates) await fs.writeFile(at(filename), data);
  await fresh(path.join(RUN, 'plan.json'), { base: BASE, protectedBefore, files: await Promise.all([...GLOBALS, ...files].sort().map(ref)) });
  console.log(json({ mode: 'record', copiedUniqueFiles: copied.size, files: GLOBALS.length + files.length, statusesPreserved: true, resultFile, buildId: pwa.buildId }));
}
async function verify() {
  assert.equal(process.argv.length, 5); await bytes(fileURLToPath(import.meta.url), process.argv[3]); await bytes(bindingFile, process.argv[4]);
  const plan = await read(path.join(RUN, 'plan.json')); assert.equal(git(['rev-parse', 'HEAD']), BASE); assert.equal(git(['diff', '--cached', '--name-only']), '');
  for (const row of plan.files) await bytes(row.path, row.sha256); assert.deepEqual(protectedState(await read(GLOBALS[1])), plan.protectedBefore);
  assert.deepEqual(git(['diff', '--name-only']).split(/\r?\n/u).filter(Boolean).sort(), GLOBALS.slice().sort());
  assert.deepEqual(git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/u).filter(Boolean).sort(), plan.files.map(row => row.path).filter(filename => !GLOBALS.includes(filename)).sort());
  const binding = await read(bindingFile); await bytes(binding.verifier.path, binding.verifier.sha256);
  Object.assign(process.env, { GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: ROOT, GIT_CONFIG_KEY_1: 'core.autocrlf', GIT_CONFIG_VALUE_1: 'true' });
  const { verifyExecutionFiles } = await import(pathToFileURL(path.join(ROOT, binding.verifier.path)));
  const report = await verifyExecutionFiles(ROOT); const verification = FOLDER + '/verification.json'; await fresh(verification, report); assert.equal(report.pass, true); assert.deepEqual(report.errors, []); assert.equal(report.releaseReady, false);
  for (const row of plan.files) await bytes(row.path, row.sha256); git(['diff', '--check']);
  await fresh(path.join(RUN, 'verified-plan.json'), { base: BASE, files: [...plan.files, await ref(verification)].sort((a, b) => a.path.localeCompare(b.path)) });
  console.log(json({ mode: 'verify', pass: report.pass, releaseReady: report.releaseReady, errors: report.errors, verification }));
}
async function commit() {
  assert.equal(process.argv.length, 5); await bytes(fileURLToPath(import.meta.url), process.argv[3]); await bytes(bindingFile, process.argv[4]);
  const plan = await read(path.join(RUN, 'verified-plan.json')); assert.equal(git(['rev-parse', 'HEAD']), BASE); assert.equal(git(['diff', '--cached', '--name-only']), '');
  for (const row of plan.files) await bytes(row.path, row.sha256); assert.deepEqual(protectedState(await read(GLOBALS[1])), (await read(path.join(RUN, 'plan.json'))).protectedBefore);
  git(['add', '--', ...plan.files.map(row => row.path)]); git(['diff', '--cached', '--check']);
  assert.deepEqual(git(['diff', '--cached', '--name-only']).split(/\r?\n/u).filter(Boolean).sort(), plan.files.map(row => row.path).sort());
  git(['commit', '-m', 'docs: record D258 premium interface and focused mobile QA']);
  const head = git(['rev-parse', 'HEAD']); assert.equal(git(['rev-parse', 'HEAD^']), BASE); assert.equal(git(['status', '--porcelain=v1', '--untracked-files=all']), '');
  await fresh(path.join(RUN, 'commit.json'), { sourceCommit: BASE, checkpointCommit: head, clean: true, files: plan.files.length, verification: await ref(FOLDER + '/verification.json'), stageAccepted: false, releaseReady: false });
  console.log(json({ mode: 'commit', checkpointCommit: head, clean: true, files: plan.files.length }));
}
const mode = process.argv[2];
if (mode === 'prepare') await prepare(); else if (mode === 'record') await record(); else if (mode === 'verify') await verify(); else if (mode === 'commit') await commit(); else throw new Error('Expected prepare/record/verify/commit');
