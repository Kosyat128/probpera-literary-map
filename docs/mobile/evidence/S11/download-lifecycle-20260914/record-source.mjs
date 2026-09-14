import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const folder = 'docs/mobile/evidence/S11/download-lifecycle-20260914';
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const startedAt = new Date().toISOString();
const runs = [];
for (const name of ['unit-a4', 'static-a2', 'browser-a2', 'globe-a1']) {
  const file = folder + '/' + name + '/result.json', result = await read(file);
  assert.equal(result.pass, true);
  for (const input of result.sourceInputs) assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
  runs.push({ path: file, sha256: sha(await fs.readFile(file)), mode: result.mode, tests: result.tests });
}
const artifactRoot = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s11';
const images = [];
for (const name of ['downloads-paused-ru.png', 'downloads-saved-en.png']) {
  const file = artifactRoot + '/browser-a2/download-lifecycle-downloa-bb6e0-n-corrupt-bytes-and-restart/' + name;
  const bytes = await fs.readFile(file); images.push({ path: file, bytes: bytes.length, sha256: sha(bytes), viewedAtOriginalResolution: true });
}
const result = { schemaVersion: 1, recordedAt: startedAt, stage: 'S11', status: 'SOURCE_LIFECYCLE_AND_BROWSER_RECOVERY_VALIDATED',
  sourceBaseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  requirementIds: ['CONTENT-005', 'CONTENT-006', 'CONTENT-008', 'MOD-041', 'UX-006'],
  sourceInputs: (await read(folder + '/unit-a4/result.json')).sourceInputs, runs, passingUnitCases: 226, passingBrowserCases: 4,
  behavior: ['Manual pause, explicit resume and cancellation retain verified whole files.',
    'One platform subscription starts with the first available operation, survives pause/panel/locale changes and is removed on disposal.',
    'Background and known offline events pause transfers. Returning active/online never starts a transfer automatically.',
    'Offline local verification remains available. A late successful atomic commit is reported as saved.',
    'Actual HTTP/Chrome recovery rejects changed candidate bytes and reads the saved package offline after browser restart.',
    'Actual canonical App/R3F keeps Canvas, renderer, camera and scene through RUEN panels and injected native lifecycle events.'],
  images, visualReview: 'RU paused and EN saved panels are legible at 390px; actions wrap without clipping; existing theme tokens are retained.',
  priorAttempts: [
    { path: folder + '/unit-a1/result.json', classification: 'Sandbox esbuild startup denied ancestor directory access; no tests executed.' },
    { path: folder + '/unit-a2', classification: 'Git ownership guard stopped the harness before tests; retried with a process-scoped exact safe.directory.' },
    { path: folder + '/unit-a3/result.json', classification: '226 passes before the subsequently discovered native stale-snapshot correction; superseded by unit-a4.' },
    { path: folder + '/browser-a1/result.json', classification: '1 pass, 1 real failure: detaching native observation while paused missed foreground state. Fixed by retaining one lifetime observation.' },
    { path: folder + '/static-a1/result.json', classification: 'Passed earlier source; superseded by static-a2 after lifecycle correction.' }],
  nativeAvailability: { adbEvidence: folder + '/adb-devices.txt', attachedDevices: 0, emulatorInstalled: false, iosCompiled: false,
    notes: 'ADB could not initialize under the sandbox profile; normal-user read succeeded and listed no devices. No native execution claim.' },
  officialReference: { url: 'https://capacitorjs.com/docs/apis/app#addlistenerappstatechange-', checkedAt: startedAt,
    usage: 'Reuse existing Capacitor v8 appStateChange through shared platform services; do not add a second native listener owner.' },
  limitations: ['QA descriptors/trust remain empty in production; no candidate activation or catalog filling.',
    'Lifecycle callbacks are injected in Chrome. Native filesystem/process-death, physical devices and iOS compilation remain open.',
    'New bilingual copy is draft. Stage acceptance, final owner archive synchronization and release gates remain separate.'],
  stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
await fs.writeFile(folder + '/result.json', json(result), { flag: 'wx' });
await fs.writeFile(folder + '/entry.json', json({ schemaVersion: 1, recordedAt: startedAt, stage: 'S11',
  checkpoint: result.sourceBaseCommit, precedingEntry: 'docs/mobile/evidence/S11/download-controls-20260914/entry.json',
  scope: 'Continue the recorded S11 parallel-safe lifecycle/recovery step with existing canonical platform services and signed byte cache.',
  requirementIds: result.requirementIds, acceptedStateUnchanged: true, stageAccepted: false, releaseReady: false }), { flag: 'wx' });
const statePath = 'docs/mobile/AUTOPILOT_STATE.json', state = await read(statePath);
state.updatedAt = startedAt;
state.verificationCache.s11DownloadLifecycle = { status: result.status, evidence: folder + '/result.json',
  sha256: sha(await fs.readFile(folder + '/result.json')), sourceBaseCommit: result.sourceBaseCommit,
  passingUnitCases: 226, actualChromeCases: 4, sourceInputsCurrent: true, nativeDeviceTested: false, stageAccepted: false, releaseReady: false };
state.verificationCache.s11DownloadControls.sourceInputsCurrent = false;
state.verificationCache.s11DownloadControls.successor = folder + '/result.json';
const stage = state.stages.find(item => item.id === 'S11');
stage.artifacts.push(folder + '/entry.json', folder + '/result.json');
stage.lastGreenCommands.push(...['unit a4', 'static a2', 'browser a2', 'globe a1'].map(mode => 'node ' + folder + '/run-checks.mjs ' + mode));
for (const criterion of stage.criteria.filter(item => result.requirementIds.some(id => item.id === 'S11.' + id))) {
  criterion.status = 'IN_PROGRESS'; criterion.evidence.push(folder + '/result.json');
  criterion.notes += ' Download controls now pause on background/offline and resume explicitly from verified files; retained native observation fixes a browser-reproduced stale foreground state. Native device, complete content and full-stage acceptance remain open.';
}
state.resume.nextAction = 'Refresh and strictly audit one PWA artifact from the committed S11 lifecycle source, then test the actual offline RUEN globe/download panel and preserve exact bytes. Native storage/process-death execution needs an emulator or device; ADB currently lists none. Existing Android a83dfcd6 predates this lifecycle slice. Keep QA candidates inactive, D107 final archives deferred and all release/public CI actions gated.';
state.resume.contextFiles.push(folder + '/result.json');
await fs.writeFile(statePath, json(state));
const note = `<!-- s11-download-lifecycle-20260914:begin -->\nS11 download pause/recovery: 226 final unit cases, final type/platform checks and 4 actual\nChrome cases passed. Manual pause and background/offline stop preserve verified files; resume\nis explicit. A real stale native snapshot failure was fixed by retaining one platform observer\nuntil disposal. Atomic completion wins over concurrent pause/cancel. RUEN panel/focus, changed\ncandidate rejection, browser restart/offline and the canonical globe remain validated.\nEvidence: evidence/S11/download-lifecycle-20260914/result.json. Native callbacks were injected;\nADB lists no connected devices, and no emulator is installed. No native/iOS execution claim.\nNext: refresh one PWA artifact from this committed source. Android a83dfcd6 and PWA0381b95f\nretain their previous source boundaries. QA activation, first-open S03 and D107 remain unchanged.\n<!-- s11-download-lifecycle-20260914:end -->\n\n`;
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const file = 'docs/mobile/' + name; await fs.writeFile(file, note + await fs.readFile(file, 'utf8'));
}
await fs.appendFile('docs/mobile/DECISIONS.md', '\n- D118: S11 foreground downloads pause on manual request, background or known offline\n  state and resume only by explicit user action. Preserve verified candidate files and\n  report any late atomic selection success truthfully. Keep a single existing platform\n  observation from the first operation until disposal: detaching on pause missed native\n  foreground events in actual Chrome source verification. No UI observer owns transfers.\n  226 unit and four browser cases pass; native callbacks remain injected and ADB lists\n  no devices. Refresh one PWA next. D107 final owner archives and release gates remain.\n');
console.log(json({ recorded: folder + '/result.json', passingUnitCases: 226, passingBrowserCases: 4, stageAccepted: false }));
