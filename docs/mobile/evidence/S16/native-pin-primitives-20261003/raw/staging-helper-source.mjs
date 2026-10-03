/** B-only report proposals. Reads retained proofs; runs no Git, test, build or native operation. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const B = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const root = fs.realpathSync('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const PREVIOUS_SOURCE = '17843151ab0624b2b17102440d0eeb464381bdcb';
const PREVIOUS_REPORT = 'd82b5219604689102c31f8e6206929975bb0153c';
const F = 'docs/mobile/evidence/S16/native-pin-primitives-20261003';
const REGISTRY_SHA = '2b1aec64cfa083d3e01eaab50492c533e06e3ecb33b9294394298b237814e922';
const FIXED = new Map([
  ['apps/mobile/android/app/src/main/java/ru/probpera/literaryplanet/PlanetChildVault.java', '2bd6d4f14131d3c2db85b03c4226c78b2f0c37662673343071539f7fda1da7c0'],
  ['apps/mobile/ios/App/App/PlanetChildVault.swift', 'b0b18cadd68765491e7336308c719a1bf1447ecc5fc6c7062087e2f765f8949c'],
]);
const OWNED = [...FIXED.keys()].sort();
const DOCUMENTS = ['AGENTS.md', 'docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/NEXT_CODEX_PROMPT.txt', 'docs/mobile/STATUS.md'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const check = (ok, code) => { if (ok !== true) { const error = new Error(code); error.code = code; throw error; } };
const inside = (parent, filename) => { const rel = path.relative(parent, filename); return rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };
const safeRelative = value => typeof value === 'string' && value.length > 0 && value.length < 1024 && !/[\\:\u0000-\u001f]/u.test(value)
  && !value.startsWith('/') && value.split('/').every(piece => piece && piece !== '.' && piece !== '..' && piece !== '.git' && !piece.startsWith('.env'));
function regular(filename, parent, limit = 32 * 1024 * 1024) {
  const resolved = path.resolve(filename), stat = fs.lstatSync(resolved), real = fs.realpathSync(resolved);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.size <= limit && inside(parent, real) && real === resolved, 'BOUNDED_CONTAINED_FILE_REQUIRED');
  return fs.readFileSync(real);
}
function readRef(ref) {
  check(ref && typeof ref.path === 'string' && path.isAbsolute(ref.path) && /^[a-f0-9]{64}$/u.test(ref.sha256), 'EXACT_RAW_PROOF_REFERENCE_REQUIRED');
  const filename = path.resolve(ref.path), parent = inside(B, filename) ? B : path.join(root, '.tmp');
  const bytes = regular(filename, parent); check(sha(bytes) === ref.sha256, 'RAW_PROOF_BYTES_CHANGED');
  return { path: filename, sha256: ref.sha256, bytes, value: path.extname(filename) === '.json' ? JSON.parse(bytes) : null };
}
function rowMap(value, count) {
  check(Array.isArray(value) && value.length === count && value.every(row => safeRelative(row.path) && /^[a-f0-9]{64}$/u.test(row.sha256))
    && new Set(value.map(row => row.path)).size === count, 'EXACT_SOURCE_ROWS_REQUIRED');
  return new Map(value.map(row => [row.path, row.sha256]));
}
function spans(text, wanted) {
  let at = 0; const found = new Map(), space = () => { while (/[\t\r\n ]/u.test(text[at] ?? '!')) at++; };
  const string = () => { const begin = at++; while (at < text.length) { const c = text[at++]; if (c === '\\') at++; else if (c === '"') return JSON.parse(text.slice(begin, at)); } throw Error('UNTERMINATED_JSON_STRING'); };
  function value(route) {
    space(); const start = at, token = text[at];
    if (token === '"') string();
    else if (token === '{') { at++; space(); if (text[at] === '}') at++; else while (true) { const key = string(); space(); check(text[at++] === ':', 'JSON_COLON'); value([...route, key]); space(); const end = text[at++]; if (end === '}') break; check(end === ',', 'JSON_OBJECT_DELIMITER'); space(); } }
    else if (token === '[') { at++; space(); if (text[at] === ']') at++; else { let index = 0; while (true) { value([...route, index++]); space(); const end = text[at++]; if (end === ']') break; check(end === ',', 'JSON_ARRAY_DELIMITER'); } } }
    else { while (at < text.length && !/[\t\r\n ,}\]]/u.test(text[at])) at++; check(at > start, 'JSON_PRIMITIVE'); }
    const key = JSON.stringify(route); if (wanted.has(key)) { check(!found.has(key), 'DUPLICATE_TARGET_KEY'); found.set(key, { start, end: at }); }
  }
  value([]); space(); check(at === text.length && found.size === wanted.size, 'EXACT_JSON_TARGET_SPANS'); return found;
}
function patchState(before, state, source, updatedAt, nextAction, meaning, artifacts) {
  const text = before.toString('utf8'); check(Buffer.from(text).equals(before), 'STATE_UTF8_REQUIRED');
  const indexes = ['S03', 'S16'].map(id => { const matches = state.stages.map((stage, index) => stage.id === id ? index : -1).filter(index => index >= 0); check(matches.length === 1, 'EXACT_STAGE_REQUIRED'); return matches[0]; });
  const changes = [{ route: ['headSha'], value: source }, { route: ['updatedAt'], value: updatedAt }, { route: ['resume', 'nextAction'], value: nextAction },
    { route: ['verificationCache', 'headShaMeaning'], value: meaning }, ...indexes.map(index => ({ route: ['stages', index, 'artifacts'], append: artifacts }))];
  const locations = spans(text, new Set(changes.map(change => JSON.stringify(change.route)))), edits = [];
  for (const change of changes) {
    const spot = locations.get(JSON.stringify(change.route)); if (!change.append) { edits.push({ ...spot, text: JSON.stringify(change.value) }); continue; }
    const old = JSON.parse(text.slice(spot.start, spot.end)); check(Array.isArray(old) && old.every(value => typeof value === 'string') && change.append.every(value => !old.includes(value)), 'APPEND_NEW_ARTIFACTS_ONLY');
    let end = spot.end - 1; while (/[\t\r\n ]/u.test(text[end - 1])) end--;
    const eol = text.slice(spot.start, spot.end).includes('\r\n') ? '\r\n' : '\n';
    edits.push({ start: end, end, text: (old.length ? ',' : '') + eol + change.append.map(value => '        ' + JSON.stringify(value)).join(',' + eol) });
  }
  edits.sort((a, b) => a.start - b.start); check(edits.every((edit, index) => index === 0 || edits[index - 1].end <= edit.start), 'NONOVERLAPPING_STATE_SPANS');
  let output = '', last = 0; for (const edit of edits) { output += text.slice(last, edit.start) + edit.text; last = edit.end; } output += text.slice(last);
  const expected = structuredClone(state); expected.headSha = source; expected.updatedAt = updatedAt; expected.resume.nextAction = nextAction; expected.verificationCache.headShaMeaning = meaning;
  indexes.forEach(index => expected.stages[index].artifacts.push(...artifacts));
  check(isDeepStrictEqual(JSON.parse(output), expected), 'STATE_OUTSIDE_SIX_AUTHORIZED_SPANS_CHANGED'); return Buffer.from(output);
}

check(process.argv.length === 3 && path.isAbsolute(process.argv[2]), 'ONE_FINALIZED_INPUT_REQUIRED');
const inputBytes = regular(process.argv[2], B), input = JSON.parse(inputBytes);
const SOURCE = 'c992fefb0b110cf5d010da87aad2d124eace16ce';
check(input.schemaVersion === 1 && input.kind === 'literary-planet-native-pin-primitives-checkpoint-input'
  && input.finalized === true && input.sourceCommit === SOURCE && input.previousSource === PREVIOUS_SOURCE
  && input.previousReport === PREVIOUS_REPORT, 'EXACT_FINALIZED_PRIMITIVES_CHECKPOINT_INPUT_REQUIRED');
const selected = new Map();
function select(id, ref, copy = true) {
  check(/^[a-z0-9][a-z0-9-]{0,95}$/u.test(id) && !selected.has(id), 'UNIQUE_PROOF_ID_REQUIRED');
  const proof = { ...readRef(ref), copy }; selected.set(id, proof); return proof;
}
function observed(id, filename, recordedSha = null, copy = true) {
  const resolved = path.resolve(filename), parent = inside(B, resolved) ? B : path.join(root, '.tmp');
  const bytes = regular(resolved, parent); return select(id, { path: resolved, sha256: recordedSha ?? sha(bytes) }, copy);
}
const compactRef = ref => ({ path: ref.path, sha256: ref.sha256, bytes: ref.bytes.length });
const cpProof = select('source-checkpoint', input.sourceCheckpoint), cp = cpProof.value;
check(cpProof.sha256 === 'f42f2c9905d6b29c7d497e73c2eca67075f59ebf767e4a8c8dca829c47d7d11e'
  && cp.sourceCommit === SOURCE && cp.previousAppSource === PREVIOUS_SOURCE && cp.previousReport === PREVIOUS_REPORT
  && cp.binding.sourceCommit === SOURCE && cp.binding.sourceFingerprint === '2cb2747f55e202013609518a51f96be7d507d5e80de6af5b002519caee8afa71'
  && cp.childAppActivation === false && cp.stageAccepted === false && cp.releaseReady === false
  && cp.genuineAuthorityProvider === 'NOT_IMPLEMENTED' && cp.nativeInputUI === 'NOT_IMPLEMENTED'
  && cp.genuineRecoveryProvider === 'NOT_IMPLEMENTED' && cp.swiftCompilation === 'NOT_RUN'
  && cp.builds === 'NOT_RUN_FOR_THIS_SOURCE', 'CURRENT_PRIVATE_INACTIVE_SOURCE_CHECKPOINT_REQUIRED');
const currentRows = rowMap(cp.sourceFiles, 1780), changedRows = rowMap(cp.files, 2);
check(isDeepStrictEqual([...changedRows].sort(), [...FIXED].sort()), 'EXACT_TWO_NATIVE_PRIMITIVE_SOURCES_REQUIRED');
const previousProof = select('previous-source-checkpoint', input.previousCheckpoint, false), previous = previousProof.value;
check(previousProof.sha256 === '512117cfc729bcb90d64574d2a329d2b4bd93839b3806cc5d5fb3a10059cddab'
  && previous.sourceCommit === PREVIOUS_SOURCE, 'EXACT_PREVIOUS_NATIVE_SESSION_SOURCE_REQUIRED');
const previousRows = rowMap(previous.sourceFiles, 1780);
check([...previousRows].every(([relative, hash]) => OWNED.includes(relative) || currentRows.get(relative) === hash)
  && cp.files.every(row => row.beforeSha256 === previousRows.get(row.path)), 'UNCHANGED_OTHER_1778_CAPTURED_SOURCE_ROWS_REQUIRED');
for (const [relative, hash] of FIXED) check(sha(regular(path.join(root, relative), root)) === hash, 'CURRENT_NATIVE_SOURCE_BYTES_CHANGED');
select('source-integration-input', cp.input);
check(Array.isArray(cp.frozenProofs) && cp.frozenProofs.length === 13, 'EXACT_NEW_SOURCE_PROOF_REFERENCES_REQUIRED');
for (const [index, ref] of cp.frozenProofs.entries()) select('frozen-source-proof-' + (index + 1), ref);

const jvmProof = select('jvm-result', input.jvmResult), jvm = jvmProof.value, jvmBase = path.dirname(jvmProof.path);
check(jvmProof.sha256 === 'ca2982ebdfb0422960d99c5b3b6355de4998bc71bb173a9ae41980e07c005129'
  && cp.jvm.sha256 === jvmProof.sha256 && path.resolve(cp.jvm.path) === jvmProof.path
  && jvm.status === 'PASS_PURE_JVM_NATIVE_PIN_PRIMITIVES' && jvm.driverCount === 24 && jvm.assertionCount === 436
  && jvm.sessionRegression.status === 'PASS_PURE_JVM_SYNTHETIC_PIN_SESSION_MECHANICS'
  && jvm.sessionRegression.driverCount === 39 && jvm.sessionRegression.assertionCount === 2598
  && jvm.sessionRegression.driverSourceSha256 === '211472613d2dd79c18366f247966fc95455d6edad8dd79bd892a0ae736565ca9'
  && jvm.expectedSourceCommit === PREVIOUS_SOURCE && jvm.allowedHead === PREVIOUS_REPORT
  && Array.isArray(jvm.failures) && jvm.failures.length === 0 && Object.keys(jvm.checks).length === 10
  && Object.values(jvm.checks).every(value => value === 'PASS'), 'ACTUAL_DISTINCT_24_AND_39_JVM_SCOPES_REQUIRED');
check(jvm.scope.platformCrypto === 'HOST_JVM_JCA_PBKDF2_NOT_ANDROID_OS'
  && ['nativeInputUI','newInstrumentation','androidBuild','installedAndroid','vaultConstruction','androidStorage','nativeAuthority'].every(key => jvm.scope[key] === 'NOT_RUN')
  && ['providerActivation','appRegistration','admission','releaseAcceptance'].every(key => jvm.scope[key] === 'NONE'), 'NO_INSTALLED_NATIVE_OR_ADMISSION_INFERENCE');
function jvmFile(id, ref) {
  check(safeRelative(ref.path) && !ref.path.includes('/'), 'OWNED_JVM_FILENAME_REQUIRED');
  const proof = observed(id, path.join(jvmBase, ref.path), ref.sha256);
  check(ref.size === undefined || ref.size === proof.bytes.length, 'ACTUAL_JVM_FILE_SIZE_CHANGED'); return proof;
}
const beforeJvm = jvmFile('jvm-before', jvm.before), afterJvm = jvmFile('jvm-after', jvm.after);
for (const snapshot of [beforeJvm.value, afterJvm.value]) check(snapshot.source.repositoryHead === PREVIOUS_REPORT
  && snapshot.source.sourceCommit === PREVIOUS_SOURCE && snapshot.source.status === '' && snapshot.source.sourceStatus === ''
  && isDeepStrictEqual([...rowMap(snapshot.source.sourceFiles, 1780)].sort(), [...previousRows].sort()), 'PREINTEGRATION_JVM_SOURCE_BINDING_REQUIRED');
check(isDeepStrictEqual(beforeJvm.value.candidate, afterJvm.value.candidate) && isDeepStrictEqual(beforeJvm.value.tools, afterJvm.value.tools)
  && beforeJvm.value.candidate.some(row => row.base === 'candidate' && row.path === OWNED.find(value => value.includes('/android/')) && row.sha256 === FIXED.get(row.path))
  && beforeJvm.value.candidate.some(row => row.base === 'prior-core' && row.sha256 === jvm.sessionRegression.driverSourceSha256), 'EXACT_EXECUTED_JAVA_AND_RETAINED_DRIVER_BYTES_REQUIRED');
check(jvm.commands.length === 18 && jvm.commands.every(command => command.status === 'PASS' && command.exitCode === 0
  && command.signal === null && command.error === null && command.shell === false)
  && jvm.commands.filter(command => command.label === 'javac').length === 1
  && jvm.commands.filter(command => ['java-primitives-driver','java-session-regression-driver'].includes(command.label)).length === 2,
  'ONE_ACTUAL_COMPILE_AND_TWO_DISTINCT_JAVA_CALLS_REQUIRED');
for (const [index, command] of jvm.commands.entries()) for (const stream of ['stdout','stderr']) jvmFile('jvm-' + (index + 1) + '-' + stream, command[stream]);
const oracle = jvmFile('public-independent-oracle', jvm.oracle);
check(oracle.sha256 === '8d38b4954dd9edc235d2677d5fd8898c7a9cc23693678d61a53580ae365766d1'
  && oracle.value.status === 'PASS' && oracle.value.algorithm === 'PBKDF2-HMAC-SHA256' && oracle.value.iterations === 600000
  && oracle.value.keyLength === 32 && oracle.value.derivationsActuallyExecuted === 1 && oracle.value.privateSecretsRead === false
  && isDeepStrictEqual(oracle.value.passwordBytes, [49,50,51,52,53,54,55,56])
  && oracle.value.saltHex === Array.from({length:32},(_,index)=>index.toString(16).padStart(2,'0')).join('')
  && /^[0-9a-f]{64}$/u.test(oracle.value.expectedHashHex), 'ONE_ACTUAL_PUBLIC_NODE_ORACLE_REQUIRED');
const primitiveCount = observed('new24-count', path.join(jvmBase, 'driver-count.json'));
const coreCount = observed('affected39-count', path.join(jvmBase, 'session-regression-count.json'));
check(primitiveCount.value.status === 'PASS' && primitiveCount.value.count === 24 && primitiveCount.value.assertionCount === 436
  && new Set(primitiveCount.value.caseNames).size === 24 && coreCount.value.status === 'PASS' && coreCount.value.count === 39
  && coreCount.value.assertionCount === 2598 && new Set(coreCount.value.caseNames).size === 39, 'ACTUAL_DISTINCT_CASE_INVENTORIES_REQUIRED');
const mainCommand = jvm.commands.find(command => command.label === 'java-primitives-driver');
const coreCommand = jvm.commands.find(command => command.label === 'java-session-regression-driver');
check(Boolean(mainCommand) && Boolean(coreCommand) && mainCommand.stdout.sha256 === primitiveCount.value.stdoutRawSha256
  && coreCommand.stdout.sha256 === coreCount.value.stdoutRawSha256 && isDeepStrictEqual(jvm.sessionRegression.stdout, coreCommand.stdout)
  && isDeepStrictEqual(jvm.sessionRegression.stderr, coreCommand.stderr), 'DISTINCT_ACTUAL_DRIVER_RAW_STREAMS_REQUIRED');
const classesBefore = observed('jvm-classes-before', path.join(jvmBase, 'classes-before-driver.json'));
const classesAfter = observed('jvm-classes-after', path.join(jvmBase, 'classes-after-driver.json'));
check(isDeepStrictEqual(classesBefore.value, classesAfter.value), 'RETAINED_COMPILED_BYTE_INVENTORY_MATCH_REQUIRED');
observed('jvm-invocation', path.join(jvmBase, 'invocation.json'));
for (const extra of input.extraProofs) select(extra.id, extra.ref);

const beforeDocs = new Map(DOCUMENTS.map(relative => [relative, regular(path.join(root, relative), root)]));
check(Array.isArray(input.documents) && input.documents.length === 4 && isDeepStrictEqual(input.documents.map(row=>row.path).sort(), [...DOCUMENTS].sort())
  && input.documents.every(row => sha(beforeDocs.get(row.path)) === row.beforeSha256), 'EXACT_FOUR_DOCUMENT_BEFORE_BYTES_REQUIRED');
const state = JSON.parse(beforeDocs.get(DOCUMENTS[1]));
check(state.headSha === PREVIOUS_SOURCE && state.currentStageId === 'S03' && state.currentCriterionId === 'S03.acceptance'
  && ['S03','S16'].every(id=>state.stages.find(stage=>stage.id===id)?.status==='IN_PROGRESS')
  && state.stages.find(stage=>stage.id==='S03').criteria.filter(row=>row.status==='OPEN').length === 11
  && state.stages.find(stage=>stage.id==='S16').criteria.filter(row=>row.status==='OPEN').length === 36, 'ACCEPTANCE_MUST_REMAIN_OPEN');
const registryPath = path.join(root, 'docs/mobile/RELEASE_DECISIONS.json'), registryBytes = regular(registryPath, root), registry = JSON.parse(registryBytes);
check(sha(registryBytes) === REGISTRY_SHA && registry.ownerActions.length === 7 && registry.items.length === 5
  && registry.items.every(row=>row.humanReview.status==='PENDING' && row.humanReview.approved===false), 'OWNER_AND_LEGAL_APPROVALS_UNCHANGED');
check(input.previousEvidence.path === 'docs/mobile/evidence/S16/native-pin-session-20261003/result.json', 'EXACT_PREDECESSOR_EVIDENCE_FAMILY_REQUIRED');
const predecessorBytes = regular(path.join(root, input.previousEvidence.path), root), predecessor = JSON.parse(predecessorBytes);
check(sha(predecessorBytes) === input.previousEvidence.sha256 && predecessor.sourceCommit === PREVIOUS_SOURCE
  && predecessor.programmingContinuation.remainingInternalProgramming.length === 6
  && predecessor.programmingContinuation.remainingInternalProgramming.every(row=>row.status==='OPEN')
  && predecessor.fourOriginalConditions.conditions.length === 4 && isDeepStrictEqual(predecessor.ownerActions, registry.ownerActions),
  'ORIGINAL_FOUR_CONDITIONS_SEVEN_OWNERS_AND_SIX_CODEX_TASKS_REQUIRED');
const historicalReportProof = select('historical1784-report-checkpoint', input.previousReportCheckpoint, false), historicalReport = historicalReportProof.value;
check(historicalReport.sourceCommit === PREVIOUS_SOURCE && historicalReport.reportCommit === PREVIOUS_REPORT
  && historicalReport.archive.sha256 === '9b14bd1ad6167da436ce5f1151c5e787cb40d183e317c1f435069a011952e01b'
  && historicalReport.archive.bytes === 239667043, 'EXACT_HISTORICAL_DELIVERY_METADATA_REQUIRED');

const generatedAt = new Date().toISOString();
const nextAction = 'Continue the private native Android Dialog/keypad and Swift UIKit input work already in progress: exact original host/context/calibration/deadline, lifecycle cancellation and owned native PIN-buffer cleanup. Then complete genuine replay-resistant authority/trusted same-boot continuity, independent recovery, actual private host/coordinator reply settlement, Parent Gate verification and authenticated host-current mapping, admitted child data ports and clear-before-render App/account/profile/lifecycle wiring. These six tasks remain Codex-owned programming. Real private platform KDF/entropy and measured calibration mechanics are implemented inactive; host-JVM24 plus affected39 checks do not establish installed-device calibration, genuine authority, native input or admission. Keep S03 IN_PROGRESS11 OPEN and S16 IN_PROGRESS36 OPEN, four original conditions, seven owner actions, five pending legal reviews, RU/EN, Книжулик / Mr. Booky, 3D controls and one canonical globe. Prepare new builds once after the connected input/UI change is integrated; current c992 builds are NOT_RUN and the1784 delivery remains a separate historical checkpoint. No extra D stage, repeated passed scopes for reporting, historical FAIL/NOT_RUN rewriting or unapproved deployment/push/merge/publication.';
const meaning = 'Private inactive native PIN primitives source '+SOURCE+' follows source178431/reportd82b. Actual root host-JVM24 cases/436 assertions and affected original39 cases/2598 assertions ran once at clean reportd82b/source178431 on the exact frozen Java bytes now integrated. One independent public Node600000 PBKDF2 oracle was computed. No literal execution at this later commit, installed Android calibration/provider/input or App admission is claimed. Swift source and10 authored methods remain NOT_COMPILED/NOT_RUN. No new builds, TSC, browser, native OS or release-readiness runs for this source; prior178431 builds/package remain valid for their historical checkpoint. All original acceptance/approval criteria and failures remain preserved.';
const continuation = structuredClone(predecessor.programmingContinuation); continuation.nextIndependentAction = nextAction;
check(continuation.implementationOwner === 'Codex' && continuation.appActivation === false, 'CODEX_PROGRAMMING_OWNERSHIP_REQUIRED');
const pinTask = continuation.remainingInternalProgramming.find(row=>row.work==='Native PIN enrollment, verification and recovery');
check(Boolean(pinTask), 'EXACT_PIN_TASK_REQUIRED');
pinTask.responsibility = 'Private TypeScript coordinator, strict Android/Swift envelope codecs, native session ownership and real platform KDF/entropy/calibration mechanics are implemented inactive. Finish the private native input/UI work in progress, actual installed-device calibration and authenticated host/coordinator settlement, genuine replay-resistant authority/trusted time and independent recovery before PIN/Parent Gate App integration. Host-JVM platform crypto and synthetic sessions grant no admission. Factories remain null/nil; Swift compiler/10 authored tests and installed-native evidence are NOT_RUN.';
const acceptance = structuredClone(predecessor.acceptance);
check(acceptance.S03 === 'IN_PROGRESS' && acceptance.S03Open === 11 && acceptance.S16 === 'IN_PROGRESS' && acceptance.S16Open === 36
  && acceptance.stageAccepted === false && acceptance.releaseReady === false && acceptance.appChildActivation === false, 'ACCEPTANCE_SCOPE_MUST_NOT_ADVANCE');
const out = path.join(B, 'native-pin-primitives-staged-' + randomUUID()), inventory = [], proofs = [], externalProofs = [];
fs.mkdirSync(out);
function write(relative, bytes) {
  check(safeRelative(relative) && inside(out, path.resolve(out, relative)), 'STAGED_PATH_ESCAPE');
  const filename = path.join(out, relative); fs.mkdirSync(path.dirname(filename), {recursive:true});
  fs.writeFileSync(filename, bytes, {flag:'wx'}); inventory.push({path:relative, sha256:sha(bytes), bytes:bytes.length});
}
for (const [id, proof] of selected) {
  if (!proof.copy) { externalProofs.push({id, ...compactRef(proof), verifiedInPlace:true, copiedIntoDocumentation:false}); continue; }
  const relative = F + '/raw/' + id + (path.extname(proof.path) || '.txt'); write(relative, proof.bytes);
  proofs.push({id, path:relative, sourcePath:proof.path, sha256:proof.sha256, bytes:proof.bytes.length});
}
write(F+'/raw/staging-input.json', inputBytes);
const result = {
  schemaVersion:1, kind:'literary-planet-native-pin-primitives-evidence', status:'PARTIAL', sourceCommit:SOURCE,
  previousSourceCommit:PREVIOUS_SOURCE, previousReportCommit:PREVIOUS_REPORT, generatedAt, evidenceFamily:F, binding:cp.binding, sourceFiles:cp.files,
  implementation:{nativePinPrimitives:'IMPLEMENTED_PRIVATE_INACTIVE', platformKdf:{android:'Fixed SecretKeyFactory PBKDF2WithHmacSHA256/PBEKeySpec; available documented API26+; API24/25 fail closed without custom fallback', ios:'CommonCrypto source; NOT_COMPILED'},
    configuredIterationFloor:600000, saltCredentialVerifierBytesEach:32, ownedNativeInputsAndActualWorkerMaterialSettlement:true,
    calibration:{samples:3, eachDerivationBudgetMs:'1..5000', originalNativeDeadlineMs:'exclusive, at most60000; no reset', installedDevice:'NOT_RUN'},
    genuineAuthorityProvider:'NOT_IMPLEMENTED', genuineRecoveryProvider:'NOT_IMPLEMENTED', nativeInputUi:'IN_PROGRESS_PRIVATE_SOURCE_WORK',
    genuineHostAdapter:'NOT_IMPLEMENTED', productionFactories:{android:'null',ios:'nil'}, appActivation:false},
  jvmQualification:{status:jvm.status, newPrimitiveCases:24, newPrimitiveAssertions:436, affectedSessionCases:39, affectedSessionAssertions:2598,
    recordedRepositoryHead:PREVIOUS_REPORT, recordedLastCommittedAppSource:PREVIOUS_SOURCE, executedAtCurrentSourceCommit:false,
    preIntegrationFrozenJavaCandidate:true, executedJavaBytesExactlyMatchCurrent:true, receipt:F+'/raw/jvm-result.json',
    distinctScopes:jvm.scope, independentOracle:{path:F+'/raw/public-independent-oracle.json',sha256:oracle.sha256,derivationsActuallyExecuted:1},
    installedOsProviderInputOrAdmissionProved:false},
  iosSwiftCompilation:'NOT_COMPILED', iosXCTest:'NOT_RUN', authoredNewSwiftMethods:10,
  builds:{currentSourceStatus:'NOT_RUN_FOR_THIS_SOURCE', android:'NOT_RUN',pwa:'NOT_RUN',iosWeb:'NOT_RUN',iosNative:'NOT_COMPILED',
    historicalSource:PREVIOUS_SOURCE, historicalReport:PREVIOUS_REPORT, historicalArchive:historicalReport.archive,
    historicalReportReceipt:compactRef(historicalReportProof), historicalArchiveRehashedForThisReport:false,
    qualification:'Prior178431 artifacts/package remain valid for that exact historical checkpoint and do not contain the later primitive source. Prepare new builds once after the connected native input/UI programming change.'},
  retainedTypeScript:{rerun:false, compileInputBytesUnchanged:true, originalReceipt:predecessor.retainedTypeScript.originalReceipt, qualification:'All source rows other than the two native vault files are unchanged; the original qualified typecheck and its failures remain in predecessor evidence.'},
  newReleaseReadiness:'NOT_RUN_FOR_THIS_SOURCE', newBrowserChecks:'NOT_RUN', installedNativeRuntime:'NOT_RUN',
  preservation:{changedSourcePaths:2, unchangedOtherCapturedSourcePaths:1778, fourDocumentTailsOrSixStateSpansOnly:true,
    registryUnchanged:true, originalFailuresRetainedByPredecessor:true, oldCodec69Repeated:false, affectedCore39RepeatedForChangedWorkerClaim:true,
    noPrior330ProofsBuildsOrArchivesCopied:true, noNewDStage:true},
  priorEvidence:{path:input.previousEvidence.path,sha256:input.previousEvidence.sha256,sourceCommit:PREVIOUS_SOURCE},
  fourOriginalConditions:predecessor.fourOriginalConditions, ownerActions:registry.ownerActions, programmingContinuation:continuation, acceptance,
  proofs, externalProofs, checksExecutedByStager:0, checkoutWrites:false, gitCommands:0, buildsExecuted:0, releaseReady:false,
};
const note = ['<!-- native-pin-primitives-20261003:begin -->', 'Source checkpoint: '+SOURCE+'; previous source/report '+PREVIOUS_SOURCE+' / '+PREVIOUS_REPORT+'.',
  'Evidence: '+F+'/result.json. Private native platform KDF/entropy and measured calibration mechanics implemented inactive. Actual root host-JVM new24 cases/436 assertions and affected original39 cases/2598 assertions PASS on frozen Java bytes before integration at clean reportd82b/source178431; one public Node600000 oracle computed. No literal execution at this later commit is claimed.',
  'Swift compilation/10 authored methods and installed native provider/input/calibration/admission are NOT_RUN. No fresh builds, TSC, browser or release checker for this source. The178431 Android/PWA/iOSweb builds and239667043-byte packet remain a separately valid historical checkpoint. Original failures, four conditions, seven owner actions and five pending legal reviews are preserved. S03 IN_PROGRESS11 OPEN; S16 IN_PROGRESS36 OPEN; releaseReady=false.',
  'Next: '+nextAction, '<!-- native-pin-primitives-20261003:end -->', ''].join('\n');
const integrationRows = [], documentProposals = [], artifacts = ['entry.json','result.json','evidence-manifest.json'].map(name=>F+'/'+name);
for (const relative of DOCUMENTS) {
  const before = beforeDocs.get(relative); check(!before.toString('utf8').includes('<!-- native-pin-primitives-20261003:begin -->'), 'DUPLICATE_CHECKPOINT_PREFIX');
  const after = relative === DOCUMENTS[1] ? patchState(before,state,SOURCE,generatedAt,nextAction,meaning,artifacts) : Buffer.concat([Buffer.from(note+'\n'),before]);
  if (relative !== DOCUMENTS[1]) check(after.subarray(Buffer.byteLength(note+'\n')).equals(before), 'FULL_HISTORICAL_DOCUMENT_TAIL_CHANGED');
  write(relative,after); write('backups/'+relative.replaceAll('/','__')+'.before',before);
  const row = {path:relative,beforeSha256:sha(before),afterSha256:sha(after)}; integrationRows.push(row);
  documentProposals.push({...row,outsideAllowedSpansOrPrefixUnchanged:true});
}
write(F+'/result.json',Buffer.from(json(result)));
write(F+'/entry.json',Buffer.from(json({schemaVersion:1,kind:'literary-planet-native-pin-primitives-working-evidence',sourceCommit:SOURCE,status:'PARTIAL',result:F+'/result.json',acceptance})));
write(F+'/evidence-manifest.json',Buffer.from(json({schemaVersion:1,kind:'literary-planet-native-pin-primitives-evidence-inventory',sourceCommit:SOURCE,
  selfExcluded:true,files:inventory.filter(row=>row.path.startsWith(F+'/')),rawProofs:proofs,externalProofs,originalsUnmodified:true,releaseReady:false})));
for (const row of inventory.filter(row=>row.path.startsWith(F+'/'))) integrationRows.push({path:row.path,beforeSha256:null,afterSha256:row.sha256});
write('integration-manifest.json',Buffer.from(json(integrationRows)));
write('proposal-result.json',Buffer.from(json({schemaVersion:1,status:'PROPOSAL_READY',sourceCommit:SOURCE,evidenceFamily:F,integrationPaths:integrationRows.length,
  documents:documentProposals,documentTailsAndStateOutsideAuthorizedSpansUnchanged:true,stateChangedValueSpans:6,
  checksExecuted:false,checkoutWrites:false,refsChanged:false,gitCommands:0,buildsExecuted:0,releaseReady:false})));
for (const [relative,before] of beforeDocs) check(sha(regular(path.join(root,relative),root))===sha(before), 'DOCUMENT_CHANGED_DURING_STAGING');
for (const [relative,hash] of FIXED) check(sha(regular(path.join(root,relative),root))===hash, 'SOURCE_CHANGED_DURING_STAGING');
check(sha(regular(registryPath,root))===REGISTRY_SHA && sha(regular(path.join(root,input.previousEvidence.path),root))===input.previousEvidence.sha256, 'REGISTRY_OR_PREDECESSOR_CHANGED_DURING_STAGING');
for (const proof of selected.values()) check(sha(regular(proof.path,inside(B,proof.path)?B:path.join(root,'.tmp')))===proof.sha256, 'NEW_PROOF_CHANGED_DURING_STAGING');
const outputRef = relative=>({path:path.join(out,relative),sha256:sha(fs.readFileSync(path.join(out,relative)))});
const pointer = {schemaVersion:1,output:out,sourceCommit:SOURCE,family:F,proposal:outputRef('proposal-result.json'),result:outputRef(F+'/result.json'),
  manifest:outputRef(F+'/evidence-manifest.json'),integration:outputRef('integration-manifest.json')};
const pointerPath = path.join(B,path.basename(out)+'.pointer.json'); fs.writeFileSync(pointerPath,json(pointer),{flag:'wx'});
console.log(json({pointerPath,...pointer}));
