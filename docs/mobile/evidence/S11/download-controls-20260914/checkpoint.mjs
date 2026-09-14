import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const base = 'docs/mobile', out = base + '/evidence/S11/download-controls-20260914';
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const head = execFileSync('git', ['-c', 'safe.directory=' + root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(head, '29a66af79931d7efec85bc84e9330c52988fcb65');
const reports = ['unit-a1', 'static-a1', 'browser-a1', 'globe-a1', 'android-compile-a1'];
const records = await Promise.all(reports.map(name => read(out + '/' + name + '/result.json')));
const finalInputs = new Map(), progressed = [];
for (let i = 0; i < records.length; i++) {
 const record = records[i]; assert.equal(record.pass, true); assert.equal(record.sourceInputsUnchanged, true);
 for (const input of record.sourceInputs) {
  const current = sha(await fs.readFile(input.path));
  if (current !== input.sha256) {
   assert.equal(input.path, 'apps/mobile/android/app/src/main/java/ru/probpera/literaryplanet/PlanetContentStorePlugin.java');
   assert.equal(i < 4, true); progressed.push({ report: reports[i], path: input.path, before: input.sha256, after: current });
  }
  if (!input.path.startsWith('.tmp/')) finalInputs.set(input.path, { path: input.path, sha256: current });
 }
}
assert.equal(records[0].tests.passed, 216); assert.equal(records[0].tests.files, 8);
assert.equal(records[2].tests.passed, 3); assert.equal(records[3].tests.passed, 1);
const preserved = [];
async function preserve(source, filename) {
 const bytes = await fs.readFile(source); await fs.writeFile(out + '/' + filename, bytes, { flag: 'wx' });
 const result = { path: out + '/' + filename, bytes: bytes.length, sha256: sha(bytes) }; preserved.push(result); return result;
}
const proofs = [];
for (const reportName of ['browser-a1', 'globe-a1']) {
 const report = await read(out + '/' + reportName + '/playwright.json');
 const visit = async suites => { for (const suite of suites) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests) for (const result of test.results) for (const a of result.attachments ?? []) {
   if (a.contentType !== 'application/json') continue;
   const bytes = a.body ? Buffer.from(a.body, 'base64') : await fs.readFile(a.path), value = JSON.parse(bytes);
   const filename = reportName + '-' + a.name.replace(/[^a-zA-Z0-9_-]/gu, '_') + '.json';
   await fs.writeFile(out + '/' + filename, bytes, { flag: 'wx' }); proofs.push({ path: out + '/' + filename, sha256: sha(bytes) });
   if (a.name === 'content-download-panel-result') { assert.equal(value.pass, true); assert.equal(value.offlineAfterBrowserRestart, true); assert.equal(value.accessibilityViolations, 0); }
  }
  await visit(suite.suites ?? []);
 } }; await visit(report.suites ?? []);
}
await preserve('.tmp/s11-download-controls-20260914/browser-output-a1/content-download-panel-dow-f89fd-fline-after-browser-restart/downloads-ru-source.png', 'downloads-ru-source.png');
await preserve('.tmp/s11-download-controls-20260914/browser-output-a1/content-download-panel-dow-f89fd-fline-after-browser-restart/downloads-en-source.png', 'downloads-en-source.png');
await preserve('.tmp/s11-download-controls-20260914/globe-output-a1/native-planet-downloads-li-bca83--through-RUEN-and-reopening/downloads-canonical-globe-source.png', 'downloads-canonical-globe-source.png');
const recordedAt = new Date().toISOString(), inputs = [...finalInputs.values()].sort((a,b) => a.path.localeCompare(b.path));
const entry = { schemaVersion: 1, recordedAt, stage: 'S11', route: 'S11-S15', checkpoint: head,
 precedingEntry: 'docs/mobile/evidence/S11/content-download-20260914/entry.json', requirementIds: ['CONTENT-005', 'CONTENT-006', 'CONTENT-008'],
 basis: 'Continue the documented parallel-safe signed byte transport scope through platform-lifetime controls and native private storage. No child, editorial, rights, purchase or stage acceptance is granted.',
 scope: ['RUEN downloads in the existing globe collection; retain the platform controller through locale and panel changes.',
 'Browser cache adapter and app-private Android/iOS byte ports; native serial IO, CAS receipts and protected current/previous pruning.',
 'Actual HTTP/Chrome cancellation, recovery, offline browser restart, accessibility and canonical Canvas/renderer/camera continuity.'],
 acceptedStateUnchanged: true, stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
const next = 'Build one refreshed Android/dev artifact from this committed source and inspect its actual APK bytes; preserve the earlier Android/PWA checkpoints. Continue S11 installed-host storage/recovery and platform pause/update handling. iOS source requires an authorized macOS build and native runtime checks, including crypto capability; current source/browser evidence is not installed-device acceptance. No production QA activation. Final canonical owner archive synchronization remains after app implementation under D107.';
const result = { schemaVersion: 1, recordedAt, stage: 'S11', status: 'DOWNLOAD_UI_SOURCE_BROWSER_AND_ANDROID_JAVA_VALIDATION_PASSED', sourceBaseCommit: head,
 requirementIds: entry.requirementIds, sourceInputs: inputs, sourceInputsSha256: sha(json(inputs)),
 validation: { reports: reports.map(name => out + '/' + name + '/result.json'), passingUnitCases: 216, unitFiles: 8,
   typecheck: true, platformBoundaries: true, realHttpChromeCases: 3, actualCanonicalAppChromeCases: 1, androidJavaCompiled: true,
   iosCompiled: false, deviceTested: false, proof: proofs, sourceScreenshots: preserved,
   androidChangeAfterJsChecks: { progressed, reason: 'Use already installed AndroidX core 1.17.0 AtomicFile to protect interrupted first writes on API 24. No shared JS or browser inputs changed; final native source passed Gradle compilation.' },
   notRepeated: 'No full catalog/editorial/worker rerun or device/store acceptance inferred; unchanged JavaScript checks reused after the native-only correction.' },
 behavior: ['Constructors do not open storage or fetch. Platform services retain downloads across panel and language changes.',
   'Explicit check, download, retry and cancel; full verification before saved state; late atomic completion reported truthfully. Stable keyboard controls and themed RUEN copy.',
   'Native plugin confines hashed files to app-private no-backup storage. CAS rechecks every signed data file and metadata receipt inside the native serial queue before atomic pointer replacement. Selected and previous generations are protected from pruning.',
   'No approved package descriptors or keys bundled. QA descriptors remain in test harnesses; data activation stays false and existing canonical facts stay intact.'],
 references: ['https://capacitorjs.com/docs/ios/custom-code', 'https://capacitorjs.com/docs/android/custom-code',
   'https://developer.android.com/reference/kotlin/androidx/core/util/AtomicFile', 'https://developer.apple.com/documentation/foundation/nsdata/writingoptions/atomic'],
 remaining: ['Native filesystem execution/crash/low-storage evidence on Android and iOS; iOS compile and WebCrypto capability verification.',
   'Native background/restart UX, production package authority/content acceptance, child-scoped downloads, final RC builds and full stage/release gates.'],
 nextAction: next, acceptedStateUnchanged: true, stageAccepted: false, releaseReady: false, productionActivation: false };
const state = await read(base + '/AUTOPILOT_STATE.json');
const protect = value => json({ headSha: value.headSha, currentStageId: value.currentStageId, currentCriterionId: value.currentCriterionId,
 stages: value.stages.map(stage => ({ id: stage.id, status: stage.status, criteria: stage.criteria.map(item => ({ id: item.id, status: item.status, commit: item.commit })) })) });
const protectedState = protect(state); assert.equal(state.currentCriterionId, 'S03.acceptance');
const stage = state.stages.find(stage => stage.id === 'S11');
stage.artifacts = [...new Set([...stage.artifacts, out + '/entry.json', out + '/result.json'])];
stage.lastGreenCommands = [...new Set([...stage.lastGreenCommands, ...reports.slice(0, 4).map(name => 'node .tmp/s11-download-controls-20260914/run-checks.mjs ' + name.replace(/-(a\d+)$/u, ' $1')), '.tmp/s11-download-controls-20260914/compile-android.ps1'])];
state.verificationCache.parallelSafeStages.S11.evidence.push(out + '/entry.json');
state.verificationCache.s11ContentDownload.sourceInputsCurrent = false; state.verificationCache.s11ContentDownload.successor = out + '/result.json';
state.verificationCache.s11DownloadControls = { status: result.status, evidence: out + '/result.json', sha256: sha(json(result)),
 sourceInputsSha256: result.sourceInputsSha256, sourceBaseCommit: head, passingUnitCases: 216, actualChromeCases: 4, androidJavaCompiled: true, iosCompiled: false, stageAccepted: false, releaseReady: false };
state.updatedAt = recordedAt; state.resume.nextAction = next; state.resume.contextFiles = [...new Set([...state.resume.contextFiles, out + '/entry.json', out + '/result.json'])];
assert.equal(protect(state), protectedState);
const marker = 's11-download-controls-20260914';
const block = '<!-- ' + marker + ':begin -->\nS11 downloads are integrated into the existing planet collection in RU/EN, with shared theme tokens.\nThe platform-lifetime controller survives locale/panel changes; explicit check/download/retry/cancel\nuses verified whole-file recovery. Native Android/iOS app-private storage source adds serial IO,\nCAS byte receipts and protected pruning. Android Java compiled offline; iOS and installed-device\nexecution remain unverified. 216 focused unit cases, type/platform checks, 3 actual HTTP/Chrome\ncases and 1 actual canonical globe case passed; Canvas/renderer/camera identity stayed intact.\nAll packages remain QA-only, with an empty production descriptor/key catalog. No factual filling.\nEvidence: evidence/S11/download-controls-20260914/result.json. Next: one refreshed Android/dev APK\nand actual byte inspection, then native pause/restart/recovery. D107 archive sync is deferred until\napp implementation. First-open S03 and all stage/release/owner gates remain unchanged.\n<!-- ' + marker + ':end -->\n\n';
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
 const file = base + '/' + name, text = await fs.readFile(file, 'utf8'); assert.ok(!text.includes('<!-- ' + marker + ':begin -->'));
 await fs.writeFile(file, block + text);
}
const decisionsPath = base + '/DECISIONS.md', decisions = await fs.readFile(decisionsPath, 'utf8'); assert.ok(!/^- D116:/mu.test(decisions));
await fs.writeFile(decisionsPath, decisions.trimEnd() + '\n\n- D116: Keep downloads in the existing themed globe collection and own transfers at\n  platform lifetime, independent of RUEN and panel lifecycle. Add private Android/iOS\n  byte ports; native serial IO rechecks signed byte receipts before atomic CAS, and\n  pruning protects current/previous generations. AndroidX AtomicFile covers first-write\n  interruption on API 24. Actual Chrome verifies UI recovery/accessibility and the\n  canonical scene; Android Java compilation passes. These do not certify native\n  execution, iOS compilation or content activation. Keep production descriptor/trust\n  catalogs empty and final owner archive sync after app implementation under D107.\n');
await fs.writeFile(out + '/entry.json', json(entry), { flag: 'wx' }); await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
await fs.writeFile(base + '/AUTOPILOT_STATE.json', json(state));
for (const name of ['run-checks.mjs', 'playwright.config.mjs', 'globe.config.mjs', 'compile-android.ps1', 'checkpoint.mjs']) await preserve('.tmp/s11-download-controls-20260914/' + name, name);
const verification = await verifyExecutionFiles(root); await fs.writeFile(out + '/state-verification.json', json(verification), { flag: 'wx' });
assert.equal(verification.pass, true, json(verification.errors));
console.log(json({ status: result.status, firstOpen: state.currentCriterionId, stages: state.stages.reduce((all, stage) => ({ ...all, [stage.status]: (all[stage.status] ?? 0) + 1 }), {}), stateVerified: true, evidence: out + '/result.json' }));
