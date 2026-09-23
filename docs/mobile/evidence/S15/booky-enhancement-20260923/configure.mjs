import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Generate once, only after the final model, controls and fixture source is frozen.
// Copy these helpers into the evidence folder before invoking from the repo root.
const [checkpoint, ...extra] = process.argv.slice(2);
assert.equal(checkpoint, '9f448936cea0b7859b2d3b9a3585afce4436862c'); assert.equal(extra.length, 0);
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
assert.equal((await fs.realpath('.')).replaceAll('\\', '/'), root);
const folder = 'docs/mobile/evidence/S15/booky-enhancement-20260923';
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const verify = async item => { assert.equal((await ref(item.path)).sha256, item.sha256, item.path); };
const git = args => execFileSync('git', ['-c', 'safe.directory=' + root, '-c', 'core.quotePath=false', ...args], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(git(['rev-parse', 'HEAD']), checkpoint);
for (const name of ['entry.json', 'build-baseline.json']) await assert.rejects(fs.stat(folder + '/' + name), { code: 'ENOENT' });
const previousCheckpointResult = await ref('docs/mobile/evidence/S15/journey-character-contract-20260923/result.json');
const prior = await read(previousCheckpointResult.path); assert.equal(prior.pass, true); assert.equal(prior.releaseReady, false);
const state = await read('docs/mobile/AUTOPILOT_STATE.json'); assert.equal(state.headSha, prior.sourceCommit);
const cache = state.verificationCache.s15BookyJourneyCharacterContract;
assert.deepEqual({ path: cache.path, sha256: cache.sha256 }, previousCheckpointResult); assert.equal(cache.sourceCommit, prior.sourceCommit);
git(['merge-base', '--is-ancestor', prior.sourceCommit, checkpoint]);
await verify(prior.sourceManifest); const baseline = await read(prior.sourceManifest.path); assert.equal(baseline.files.length, 1644);
const previousRuntimeResult = prior.previousRuntime; await verify(previousRuntimeResult);
const runtime = await read(previousRuntimeResult.path); assert.equal(runtime.pass, true); assert.equal(runtime.releaseReady, false);
assert.equal(runtime.sourceCommit, 'd970b0dcc76f505b6d90e4fbe391a3e88bcf2eeb');
assert.equal(runtime.browserCases, 32); assert.equal(runtime.inspectedImageCount, 27);
await verify(runtime.entry); const runtimeEntry = await read(runtime.entry.path);
const allowedChanged = [
  'src/App.tsx', 'src/host/NativePlanetPanel.tsx', 'src/host/PlanetMascotAvatar.css', 'src/host/PlanetMascotAvatar.tsx',
  'src/host/PlanetMascotControls.css', 'src/host/PlanetMascotControls.tsx', 'src/host/bookyAnimation.ts',
  'src/host/bookyModel.test.ts', 'src/host/bookyModel.ts', 'src/host/planetMascot.test.ts', 'src/host/planetMascot.ts',
  'src/host/planetMascotRoutes.ts', 'src/host/useBookyRenderer.ts', 'tests/pwa/booky-live-character.spec.mjs',
].sort();
const allowedAdded = ['src/host/bookyAnimation.test.ts', 'src/host/bookyWalk.test.ts', 'src/host/bookyWalk.ts', 'src/host/useBookyWalk.ts'].sort();
const sourceRoots = ['src', 'scripts', 'tests', 'apps', 'public', 'data', 'index.html', 'native.html', 'package.json',
  'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vite.native.config.ts', 'vite.pwa.config.ts', 'capacitor.config.json'];
const rows = git(['diff', '--name-status', checkpoint, '--', ...sourceRoots]).split(/\r?\n/u).filter(Boolean).map(line => line.split('\t'));
assert.ok(rows.every(row => row.length === 2 && ['M', 'A'].includes(row[0])), 'Unexpected rename, removal or source change');
const changedPaths = rows.filter(([status]) => status === 'M').map(([, file]) => file).sort();
const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...sourceRoots]).split(/\r?\n/u).filter(Boolean);
const newSourcePaths = [...rows.filter(([status]) => status === 'A').map(([, file]) => file), ...untracked].sort();
assert.deepEqual(changedPaths, allowedChanged); assert.deepEqual(newSourcePaths, allowedAdded);
const baselineMap = new Map(baseline.files.map(item => [item.path, item.sha256]));
for (const file of changedPaths) assert.ok(baselineMap.has(file), file);
for (const file of newSourcePaths) assert.equal(baselineMap.has(file), false, file);
const protectedFiles = baseline.files.filter(item => !changedPaths.includes(item.path)); assert.equal(protectedFiles.length, 1630);
const supplementalTestInputs = prior.supplementalTestInputs, supplementalBrowserInputs = prior.supplementalBrowserInputs;
const supplementalArchiveInputs = runtime.supplementalArchiveInputs;
assert.deepEqual(supplementalArchiveInputs.map(item => item.path), ['data/book-canon-source-registry.json']);
for (const item of [...protectedFiles, ...supplementalTestInputs, ...supplementalBrowserInputs, ...supplementalArchiveInputs]) await verify(item);
const supplementalArchiveGitIdentity = [];
for (const item of supplementalArchiveInputs) {
  const previous = runtime.supplementalArchiveGitIdentity.find(value => value.path === item.path); assert.ok(previous);
  const blob = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', checkpoint + ':' + item.path], { windowsHide: true });
  const current = await fs.readFile(item.path); assert.equal(sha(blob), previous.sourceGitBlobSha256);
  assert.equal(blob.toString('utf8').replaceAll('\r\n', '\n'), current.toString('utf8').replaceAll('\r\n', '\n'));
  supplementalArchiveGitIdentity.push({ path: item.path, checkpoint, gitBlobSha256: sha(blob), checkedOutSha256: item.sha256, lineEndingOnly: !blob.equals(current) });
}
const unitFiles = ['src/host/bookyModel.test.ts', 'src/host/bookyAnimation.test.ts', 'src/host/bookyWalk.test.ts',
  'src/host/planetMascot.test.ts', 'src/host/planetMascotPreference.test.ts', 'src/host/planetMascotPersistence.test.ts',
  'src/host/bookySupport.test.ts', 'src/host/bookyTourProgress.test.ts'];
const browserFiles = [...runtimeEntry.browserFiles, 'tests/pwa/booky-live-character.spec.mjs']; assert.equal(browserFiles.length, 6);
const sourcePaths = [...new Set([...baselineMap.keys(), ...newSourcePaths, ...unitFiles, ...browserFiles])].sort();
assert.equal(sourcePaths.length, 1648);
const currentSourceInputs = await Promise.all([...changedPaths, ...newSourcePaths].map(ref));
const runtimeRequired = [...changedPaths, ...newSourcePaths].filter(file => file.startsWith('src/') && !/\.(test|spec)\./u.test(file));
assert.equal(runtimeRequired.length, 13);
const checkpointFiles = await Promise.all(['AGENTS.md', ...['AUTOPILOT_STATE.json', 'DECISIONS.md', 'STATUS.md', 'BLOCKERS.md',
  'NEXT_CODEX_PROMPT.txt', 'REQUIREMENTS_TRACEABILITY.json', 'REQUIREMENTS_TRACEABILITY.csv'].map(name => 'docs/mobile/' + name)].map(ref));
const buildBaseline = { checkpoint };
for (const [kind, key] of [['pwa', 'priorPwa'], ['android', 'priorAndroid']]) {
  assert.deepEqual(prior[kind], runtime[kind]); await verify(runtime[kind]); const build = await read(runtime[kind].path);
  assert.equal(build.pass, true); assert.equal(build.sourceCommit, runtime.sourceCommit); assert.equal(build.releaseReady, false);
  buildBaseline[key] = { ...runtime[kind], buildId: build.buildId, sourceCommit: build.sourceCommit };
}
const entry = { schemaVersion: 1, recordedAt: new Date().toISOString(), stage: 'S15', checkpoint,
  previous: previousCheckpointResult.path, previousCheckpointResult, previousRuntimeResult, priorSourceManifest: prior.sourceManifest,
  checkpointFiles, changedPaths, newSourcePaths, newImplementationFiles: newSourcePaths.filter(file => !file.endsWith('.test.ts')),
  currentSourceInputs, sourceInputCount: sourcePaths.length, protectedInputCount: protectedFiles.length, runtimeRequired,
  supplementalTestInputs, supplementalBrowserInputs, supplementalArchiveInputs, supplementalArchiveGitIdentity,
  unitFiles, browserFiles, expectedBrowserTests: 36, expectedImages: 34,
  priorRuntimeUnitContext: { sourceCommit: runtime.sourceCommit, unitCount: runtime.unitCount, result: runtime.runs.unit },
  scope: 'Actual Booky 3D model, seven finite explicit reactions, deliberate bounded margin walking and canonical local utility actions; existing scene, policy, progress, dossier, preferences and source content retained.',
  runtimeWiringImplemented: true, characterJourneyNodeImplemented: false, childApproved: false, stageAccepted: false, releaseReady: false };
// Baseline is written first: checks cannot start from an entry without its build baseline.
await fs.writeFile(folder + '/build-baseline.json', json(buildBaseline), { flag: 'wx' });
await fs.writeFile(folder + '/entry.json', json(entry), { flag: 'wx' });
console.log(json({ entry: await ref(folder + '/entry.json'), buildBaseline: await ref(folder + '/build-baseline.json'),
  sourceInputs: sourcePaths.length, protectedInputs: protectedFiles.length, changed: changedPaths.length, added: newSourcePaths.length,
  unitFiles: unitFiles.length, browserFiles: browserFiles.length, browserCases: 36, images: 34 }));
