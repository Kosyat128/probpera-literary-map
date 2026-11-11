const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {createRequire} = require('node:module');
const {createProfileTranslationScanRuntime, repo, sourceRoot, output} = require('./profile-translation-scan-runtime.cjs');
const native = createRequire(path.join(repo, 'package.json')), {unzipSync} = native('fflate');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const archiveBytes = fs.readFileSync(path.join(repo, 'docs/admin-r3-evidence/2026-10-30-stable-traversal/next-profile-traversal-before.zip'));
assert.equal(sha(archiveBytes), '5489cdc6aa59f823d69357b5b76f9be057300882696569f297632080cb3a261a');
const archived = unzipSync(archiveBytes), contractBytes = archived['same-contract.cjs'];
assert.equal(sha(contractBytes), 'a988d0df137b66ef6822450d0307fb76222e2c706cc341a2b04a6ee5e5378008');
const contractFile = path.join(output, 'same-contract.cjs'); fs.writeFileSync(contractFile, contractBytes);
const sameContract = require(contractFile), checks = [], traces = [], sources = new Map();
async function check(name, body) {
  try {const trace = await body(); checks.push({name, pass: true}); traces.push({name, ...trace});}
  catch (error) {checks.push({name, pass: false, error: error.stack || String(error)});}
}
function preserve(view, before) {
  assert.deepEqual(view.authorRows(), before); assert.equal(view.writes.length, 0); assert.equal(view.builds.length, 0);
  for (const row of view.graph.values()) {
    const bytes = fs.readFileSync(path.join(sourceRoot, row.module)); assert.equal(sha(bytes), row.sha256, row.module);
    const old = sources.get(row.module); if (old) assert.equal(old.sha256, row.sha256, 'One run must use one actual source version');
    sources.set(row.module, row);
  }
}
function originalBefore() {
  const raw = JSON.parse(Buffer.from(archived['work/m07-t12-profile-before-20261030-sol/run-2026-10-29T23-36-49-744Z/report.json']).toString());
  const observer = {executionFailures: raw.controls.executionFailures, providerCalls: raw.controls.providerCalls,
    cases: raw.cases.map(row => ({kind: `${row.kind}/${row.mutation}`, omittedInitialIdsAtCursorWrap: row.omitted,
      repeatedInitialIds: row.repeated.map(value => Array.isArray(value) ? value[0] : value)}))};
  const same = sameContract(observer); assert.equal(same.target.length, 8); assert.equal(same.targetFailures, 6);
  return {classification: 'GENUINE_ORIGINAL_BEFORE_EXPECTED_SIX_TARGET_FAILURES_NOT_ACCEPTANCE', same};
}
async function originalPair() {
  const cases = [];
  for (const kind of ['country', 'writer']) for (const mutation of ['move-visited-to-tail', 'delete-visited-insert-tail']) {
    const view = createProfileTranslationScanRuntime(kind), before = view.authorRows(), originalSources = view.sourceRows();
    const first = await view.invoke(), limit = kind === 'country' ? 30 : 120;
    assert.equal(first.helperIds.length, limit, JSON.stringify(first.params));
    if (mutation === 'move-visited-to-tail') view.entries.push(view.entries.shift());
    else {
      view.entries.shift(); const added = structuredClone(view.entries.at(-1)); added.id = kind === 'country' ? 'scan-country-new' : 'scan_writer_new';
      added.label = 'New synthetic catalog member';
      if (kind === 'country') {
        const row = structuredClone(view.countries.at(-1)); row.id = added.id; row.label = added.label;
        row.fields.id = row.id; row.row.country_id = row.id; row.row.id = 'dddddddd-dddd-4ddd-8ddd-999999999999';
        view.countries.push(row); added.fields = row.fields;
      } else {
        const row = structuredClone(view.rows.get(view.entries.at(-1).id)); row.writer_id = added.id;
        row.id = 'dddddddd-dddd-4ddd-8ddd-999999999999'; view.rows.set(added.id, row); view.writers.push(added);
      }
      view.entries.push(added);
    }
    const second = await view.invoke({resume: true}), seen = [...first.helperIds, ...second.helperIds], counts = new Map();
    for (const id of seen) counts.set(id, (counts.get(id) || 0) + 1);
    assert.equal(second.helperIds.length, limit, JSON.stringify(second.params));
    const protectedRows = view.authorRows().filter(row => kind === 'country' ? view.initialIds.includes(row.id) : view.initialIds.includes(row.writer_id));
    assert.deepEqual(protectedRows, before);
    for (const row of originalSources) {const now = view.sourceRows().find(value => value.id === row.id); if (now) assert.deepEqual(now, row);}
    assert.equal(view.providerCalls.length, 0); assert.equal(view.writes.length, 0); assert.equal(view.builds.length, 0);
    assert.equal(view.server.operations.size, 0);
    assert.equal(second.receipt.exhausted, true); assert.equal(second.receipt.nextPosition, view.initialIds.length);
    for (const row of view.graph.values()) sources.set(row.module, row);
    cases.push({kind: `${kind}/${mutation}`, omittedInitialIdsAtCursorWrap: view.initialIds.filter(id => !counts.has(id)),
      repeatedInitialIds: view.initialIds.filter(id => (counts.get(id) || 0) > 1), first, second, providerCalls: view.providerCalls.length,
      protectedAuthorRowsExact: true, survivingCatalogSourcesExact: true});
  }
  const same = sameContract({executionFailures: 0, providerCalls: 0, cases});
  assert.equal(same.target.length, 8); assert.equal(same.targetFailures, 0);
  return {same, cases};
}
async function eagerWindows(kind) {
  const view = createProfileTranslationScanRuntime(kind, {count: 501}), before = view.authorRows();
  const first = await view.invoke(); assert.equal(view.scans.windows.size, 2);
  const windows = [...view.scans.windows.values()], fixed = windows.map(window => window.members.map(member => member.entityId));
  assert.equal(windows[0].successorJobId, windows[1].jobId); assert.equal(windows[1].nextPosition, 0);
  assert.equal(first.receipt.windowIndex, 0); assert.equal(first.helperIds.length, kind === 'country' ? 30 : 120);
  const configuration = windows[0].configuration;
  const unfinished = await view.sdk.rpc('continue_profile_translation_scan', {p_window_job_id: windows[0].jobId,
    p_expected_version: String(windows[0].version), p_configuration: configuration});
  assert.equal(unfinished.error, null); assert.equal(unfinished.data.jobId, windows[0].jobId);
  const seen = [...first.helperIds], calls = [first];
  for (let index = 0; index < 30 && !calls.at(-1).receipt.exhausted; index++) {
    const result = await view.invoke(); seen.push(...result.helperIds); calls.push(result);
  }
  assert.equal(calls.at(-1).receipt.exhausted, true); assert.equal(seen.length, 501); assert.equal(new Set(seen).size, 501);
  assert.deepEqual(windows.map(window => window.members.map(member => member.entityId)), fixed);
  assert.equal(view.providerCalls.length, 0); preserve(view, before);
  return {calls: calls.map(row => ({processed: row.helperIds.length, windowIndex: row.receipt.windowIndex, nextPosition: row.receipt.nextPosition})),
    members: 501, windows: 2, providerCalls: 0, immutableMembership: true};
}
async function changedPending(kind) {
  const view = createProfileTranslationScanRuntime(kind), before = view.authorRows(); const first = await view.invoke();
  const index = kind === 'country' ? 30 : 120, changed = view.entries[index]; changed.fields.opaqueSourceRights = {consent: 'Changed after initial fixed manifest'};
  const second = await view.invoke();
  assert.equal(second.observations.filter(row => row.observation.reason === 'catalog_changed').length, 1);
  assert.equal(second.observations.find(row => row.observation.reason === 'catalog_changed').observation.state, 'stale');
  assert.equal(second.helperIds.includes(changed.id), false);
  assert.equal(second.helperIds.includes(view.entries[index + 1].id), true); assert.equal(second.receipt.exhausted, true);
  assert.equal(view.providerCalls.length, 0);
  // The declared catalog-source mutation is the only permitted fixture change.
  delete changed.fields.opaqueSourceRights; preserve(view, before);
  return {first, second, declaredSourceMutationOnly: true};
}
async function missingPending(kind) {
  const view = createProfileTranslationScanRuntime(kind), before = view.authorRows(); const first = await view.invoke();
  const index = kind === 'country' ? 30 : 120, missing = view.entries[index].id; view.entries.splice(index, 1);
  const second = await view.invoke();
  assert.equal(second.observations.filter(row => row.observation.reason === 'source_missing').length, 1);
  assert.equal(second.helperIds.includes(missing), false); assert.equal(second.helperIds.includes(view.entries[index].id), true);
  assert.equal(second.receipt.exhausted, true); assert.equal(view.providerCalls.length, 0); preserve(view, before);
  return {first, second, missing, declaredCatalogDeletionOnly: true};
}
async function savedGetFailure(kind) {
  const view = createProfileTranslationScanRuntime(kind), before = view.authorRows(); await view.invoke();
  const window = [...view.scans.windows.values()][0], position = window.nextPosition;
  view.scans.fault('get_profile_translation_scan', 'unavailable'); const second = await view.invoke();
  assert.equal(second.helperIds.length, 0); assert.equal(window.nextPosition, position); assert.equal(view.scans.windows.size, 1);
  assert.equal(second.params[`${kind}Job`], window.jobId); assert.equal(view.providerCalls.length, 0); preserve(view, before);
  return {second, position, noResetOrNewScan: true};
}
async function lostBegin(kind) {
  const view = createProfileTranslationScanRuntime(kind, {count: 2}), before = view.authorRows();
  view.scans.fault('begin_profile_translation_scan', 'lost-ack', 2); const first = await view.invoke();
  assert.equal(view.scans.windows.size, 1); assert.equal(first.params[`${kind}Job`], view.scanIntent);
  assert.equal([...view.scans.windows.values()][0].nextPosition, 0); assert.equal(first.helperIds.length, 0);
  const second = await view.invoke(); assert.equal(second.receipt.nextPosition, 2); assert.equal(second.receipt.exhausted, true);
  assert.equal(view.scans.windows.size, 1); assert.equal(view.providerCalls.length, 0); preserve(view, before);
  return {first, second, oneRecoverableOriginalIntent: true};
}
async function lostCheckpoint(kind) {
  const view = createProfileTranslationScanRuntime(kind, {count: 2}), before = view.authorRows();
  view.scans.fault('checkpoint_profile_translation_scan_item', 'lost-ack', 2); const first = await view.invoke();
  const requests = first.scanWire.filter(row => row.name === 'checkpoint_profile_translation_scan_item');
  assert.equal(requests.length, 2); assert.deepEqual(requests[0].args, requests[1].args);
  assert.equal([...view.scans.windows.values()][0].nextPosition, 1);
  const second = await view.invoke(); assert.equal(second.receipt.exhausted, true);
  const seen = [...first.helperIds, ...second.helperIds]; assert.equal(seen.length, 2); assert.equal(new Set(seen).size, 2);
  assert.equal(view.scans.observations.length, 2); assert.equal(new Set(view.scans.observations.map(row => row.transitionId)).size, 2);
  assert.equal(view.providerCalls.length, 0); preserve(view, before); return {first, second};
}
async function legacyRefusal(kind) {
  const rows = [];
  for (const token of ['1', '9999999999999999999999999999999999', '-1', 'not-a-cursor']) {
    const view = createProfileTranslationScanRuntime(kind, {count: 1, manualAll: false}), before = view.authorRows();
    const result = await view.invoke({form: {[`${kind}ScanIntent`]: null, [`${kind}Cursor`]: token}});
    assert.equal(view.scans.windows.size, 0); assert.equal(view.providerCalls.length, 0); assert.equal(view.server.operations.size, 0);
    assert.equal(result.helperIds.length, 0); assert.ok(['translation_resume_stale', 'invalid_input'].includes(result.params.errorCode));
    preserve(view, before); rows.push({token, result});
  }
  return {rows};
}
async function paidBound(kind) {
  const cap = kind === 'writer' ? 3 : 2, view = createProfileTranslationScanRuntime(kind, {count: cap + 1, manualAll: false}), before = view.authorRows();
  const result = await view.invoke();
  assert.equal(view.providerCalls.length, cap * 2, JSON.stringify(result.params)); assert.equal(view.server.operations.size, cap);
  assert.equal(view.privateCandidates.size, cap); assert.equal(result.receipt.nextPosition, cap);
  assert.equal(view.budgets[0].budget.snapshot().attempts, cap); assert.equal(view.budgets[0].budget.snapshot().maxProviderCalls, cap * 4);
  for (const op of view.server.operations.values()) {
    assert.equal(op.configuration.maxOutputTokens, kind === 'writer' ? 4000 : 12000);
    assert.equal(op.calls.length, 2); assert.equal(op.phase, 'finished');
    const attached = view.scans.events.find(event => event.event === 'committed' && event.name === 'attach_profile_translation_scan_operation' && event.data.child?.receipt.operationId === op.operationId);
    assert.ok(attached); assert.equal(attached.data.child.initialProviderCalls, 0); assert.equal(attached.data.child.receipt.providerCalls, 0);
    assert.equal(view.scans.observations.filter(row => row.operationId === op.operationId).length, 1);
  }
  preserve(view, before); return {result, cap, providerCalls: view.providerCalls.length, privateCandidates: view.privateCandidates.size, metadataAttachBeforeExpense: true};
}
async function unknownBeforeRuntime(kind) {
  const view = createProfileTranslationScanRuntime(kind, {count: 1, manualAll: false, unknownFirst: true}), before = view.authorRows();
  const first = await view.invoke(); assert.equal(view.providerCalls.length, 1); assert.equal(first.receipt.nextPosition, 0);
  const child = first.receipt.child.receipt, catalogReads = view.catalogReads.length;
  view.setCatalogUnavailable(); view.load('apps/admin/lib/env.ts').adminEnv.openAiAutoTranslateProfiles = false;
  const second = await view.invoke(); assert.equal(view.providerCalls.length, 1); assert.equal(view.server.operations.size, 1);
  assert.equal(second.receipt.child.receipt.operationId, child.operationId); assert.equal(second.receipt.nextPosition, 0);
  assert.equal(view.catalogReads.length, catalogReads); assert.equal(view.privateCandidates.size, 0); preserve(view, before);
  return {first, second, pinBeforeCatalogAndDisabledRuntime: true};
}
async function lostAttach(kind) {
  const view = createProfileTranslationScanRuntime(kind, {count: 1, manualAll: false}), before = view.authorRows();
  view.scans.fault('attach_profile_translation_scan_operation', 'lost-ack', 2); const first = await view.invoke();
  assert.equal(view.providerCalls.length, 0); assert.equal(first.receipt.nextPosition, 0);
  assert.equal(view.budgets[0].budget.snapshot().attempts, 0); assert.equal(view.budgets[0].budget.snapshot().providerCalls, 0);
  const zero = structuredClone([...view.server.operations.values()][0]); assert.equal(zero.calls.length, 0);
  const continuations = [];
  for (let index = 0; index < 3 && view.privateCandidates.size === 0; index++) continuations.push(await view.invoke());
  assert.equal(view.privateCandidates.size, 1); assert.equal(view.providerCalls.length, 2);
  assert.equal([...view.server.operations.values()].filter(op => op.calls.length > 0).length, 1);
  assert.equal([...view.scans.windows.values()][0].nextPosition, 1); preserve(view, before);
  return {first, zeroCallOperation: zero, continuations, noExpenseBeforeConfirmedAttachment: true};
}
async function cancellationRetention(kind) {
  const cases = [];
  for (const pass of ['translation', 'review']) {
    let view;
    view = createProfileTranslationScanRuntime(kind, {count: 1, manualAll: false, onProvider: async ({call}) => {
      if (call.pass === pass) view.scans.cancel([...view.scans.windows.values()][0].jobId);
    }});
    const before = view.authorRows(), first = await view.invoke(), calls = view.providerCalls.length;
    assert.equal(calls, pass === 'translation' ? 1 : 2); const op = [...view.server.operations.values()][0];
    assert.ok(op.calls.at(-1).artifact); assert.ok(op.calls.at(-1).response);
    const second = await view.invoke(); assert.equal(view.providerCalls.length, calls);
    assert.equal([...view.scans.windows.values()][0].nextPosition, 0); assert.equal(first.receipt.status, 'cancelled');
    if (pass === 'review') assert.equal(view.privateCandidates.size, 1);
    preserve(view, before); cases.push({pass, first, second, deliveredBodyRetained: true, privateCandidates: view.privateCandidates.size});
  }
  return {cases};
}
async function completeBodyRecovery(kind) {
  const view = createProfileTranslationScanRuntime(kind, {count: 1, manualAll: false, retainCompleteBody: true}), before = view.authorRows();
  const first = await view.invoke(); assert.equal(view.providerCalls.length, 2); assert.equal(view.privateCandidates.size, 0);
  const op = [...view.server.operations.values()][0]; assert.equal(op.phase, 'running');
  assert.equal(op.calls.length, 2); assert.ok(op.calls.every(call => call.response && call.artifact)); assert.equal(first.receipt.nextPosition, 0);
  const bodies = structuredClone(op.calls), paidBegins = view.wire.filter(row => /begin_(?:writer|catalog)_translation_operation$/u.test(row.path || '')).length;
  view.releaseRetainedBodyReadback(); view.setCatalogUnavailable();
  const environment = view.load('apps/admin/lib/env.ts').adminEnv;
  environment.openAiAutoTranslateProfiles = false; environment.premiumTranslationProvider = 'openai';
  const reads = view.catalogReads.length, second = await view.invoke();
  assert.equal(view.catalogReads.length, reads); assert.equal(view.providerCalls.length, 2); assert.equal(view.server.operations.size, 1);
  assert.equal(view.privateCandidates.size, 1); assert.equal(op.phase, 'finished'); assert.deepEqual(op.calls, bodies);
  assert.equal(second.receipt.nextPosition, 1); assert.equal(second.receipt.exhausted, true);
  assert.equal(view.scans.observations.length, 1); assert.equal(view.scans.observations[0].providerCalls, 0);
  assert.equal(view.scans.observations[0].observation.type, 'child-terminal');
  assert.equal(view.wire.filter(row => /begin_(?:writer|catalog)_translation_operation$/u.test(row.path || '')).length, paidBegins);
  const candidate = [...view.privateCandidates.values()][0];
  if (kind === 'writer') assert.equal(candidate.payload.text, view.englishText); else assert.deepEqual(candidate.payload.fields, view.countries[0].generated);
  preserve(view, before); return {first, second, originalCompleteCalls: bodies, privateCandidate: candidate,
    newPaidBegins: 0, additionalProviderCalls: 0, catalogReadsDuringRecovery: 0};
}
async function foreignActive(kind) {
  const view = createProfileTranslationScanRuntime(kind, {count: 1, manualAll: false, unknownFirst: true}), before = view.authorRows();
  await view.helper(); assert.equal(view.providerCalls.length, 1);
  const originalView = view.server.view, foreignActor = 'aaaaaaaa-aaaa-4aaa-8aaa-999999999999';
  view.server.view = op => ({...originalView(op), actorId: foreignActor});
  const offset = view.wire.length; view.entries[0].fields.opaqueCatalogChange = {permission: 'Changed while an unresolved foreign identity remains active'};
  const first = await view.invoke(), second = await view.invoke();
  assert.equal(view.providerCalls.length, 1); assert.equal(view.server.operations.size, 1); assert.equal(view.privateCandidates.size, 0);
  assert.equal(first.receipt.child.binding, 'observed-blocked'); assert.equal(first.receipt.child.receipt.actorId, foreignActor);
  assert.equal(second.receipt.nextPosition, 0); assert.equal(first.helperIds.length + second.helperIds.length, 0);
  assert.equal(view.wire.slice(offset).filter(row => /get_(?:writer|catalog)_translation_operation_artifacts$/u.test(row.path || '')).length, 0);
  delete view.entries[0].fields.opaqueCatalogChange; preserve(view, before);
  return {first, second, foreignPrivateArtifactReads: 0, duplicateProviderCalls: 0, newScanDespiteSourceHashChangeHeld: true};
}
async function historicalTerminal(kind) {
  const view = createProfileTranslationScanRuntime(kind, {count: 1, manualAll: false}), before = view.authorRows();
  const generated = await view.helper(); assert.equal(generated.state, 'translated'); assert.equal(view.providerCalls.length, 2);
  const op = [...view.server.operations.values()][0], candidate = structuredClone(op.candidate), calls = structuredClone(op.calls);
  assert.equal(op.phase, 'finished'); assert.equal(view.privateCandidates.size, 1);
  // Model an already explicitly consumed/discarded private slot. The paid
  // cache's immutable delivered artifact and terminal metadata remain intact.
  view.privateCandidates.clear(); const result = await view.invoke();
  assert.equal(view.providerCalls.length, 2); assert.equal(view.server.operations.size, 1); assert.equal(view.privateCandidates.size, 0);
  assert.equal(result.receipt.nextPosition, 1); assert.equal(result.receipt.exhausted, true); assert.equal(result.receipt.child, null);
  assert.deepEqual(op.candidate, candidate); assert.deepEqual(op.calls, calls);
  assert.equal(view.scans.observations.length, 1); const observation = view.scans.observations[0];
  assert.equal(observation.operationId, op.operationId); assert.equal(observation.providerCalls, 0); assert.equal(observation.observation.type, 'child-terminal');
  assert.equal(Object.hasOwn(observation, 'model'), false); assert.equal(Object.hasOwn(observation, 'inputTokens'), false);
  const repeated = await view.invoke(); assert.equal(repeated.helperIds.length, 0); assert.equal(view.scans.observations.length, 1);
  preserve(view, before); return {generated, result, repeated, retainedCandidate: candidate, noBorrowedExpenseFields: true};
}
async function duplicateWriterTuple() {
  const view = createProfileTranslationScanRuntime('writer', {count: 2, tupleCollision: true}), before = view.authorRows();
  const result = await view.invoke();
  assert.equal(result.receipt.exhausted, true); assert.equal(result.receipt.totalMembership, 2); assert.equal(result.receipt.nextPosition, 2);
  assert.deepEqual(result.receipt.members.map(member => member.entityId), ['russia:shared_writer', 'france:shared_writer']);
  const reads = result.legacyWire.filter(row => row.method === 'GET' && row.path.endsWith('/writer_profile_overrides'));
  assert.deepEqual(reads.map(row => [row.query.country_id, row.query.writer_id]), [['eq.russia', 'eq.shared_writer'], ['eq.france', 'eq.shared_writer']]);
  assert.notEqual(before[0].id, before[1].id); assert.notDeepEqual(before[0].fields.tupleRights, before[1].fields.tupleRights);
  assert.equal(view.providerCalls.length, 0); preserve(view, before);
  return {result, exactTupleRows: before, expense: 0};
}
async function exhaustedFresh(kind) {
  const view = createProfileTranslationScanRuntime(kind, {count: 1}); const first = await view.invoke();
  const originalWindow = [...view.scans.windows.values()][0], originalMembers = structuredClone(originalWindow.members);
  const added = structuredClone(view.entries[0]); added.id = kind === 'country' ? 'explicit-new-country' : 'explicit_new_writer';
  if (kind === 'country') {
    const row = structuredClone(view.countries[0]); row.id = added.id; row.fields.id = added.id; row.row.country_id = added.id;
    row.row.id = 'dddddddd-dddd-4ddd-8ddd-123456789012'; view.countries.push(row); added.fields = row.fields;
  } else {
    const row = structuredClone(view.rows.get(view.entries[0].id)); row.writer_id = added.id;
    row.id = 'dddddddd-dddd-4ddd-8ddd-123456789012'; view.rows.set(added.id, row); view.writers.push(added);
  }
  view.entries.push(added); const before = view.authorRows(), continued = await view.invoke();
  assert.equal(continued.helperIds.length, 0); assert.equal(view.scans.windows.size, 1); assert.deepEqual(originalWindow.members, originalMembers);
  const fresh = await view.invoke({fresh: true}); assert.equal(fresh.receipt.exhausted, true); assert.equal(fresh.receipt.totalMembership, 2);
  assert.notEqual(fresh.receipt.scanId, originalWindow.scanId); assert.equal(fresh.helperIds.length, 2); assert.equal(new Set(fresh.helperIds).size, 2);
  assert.ok(fresh.helperIds.includes(added.id)); assert.deepEqual(originalWindow.members, originalMembers); assert.equal(originalWindow.nextPosition, 1);
  assert.equal(view.providerCalls.length, 0); preserve(view, before);
  return {first, continued, fresh, originalHistoryUnchanged: true};
}
async function freshUnknownSameEntity(kind) {
  const view = createProfileTranslationScanRuntime(kind, {count: 1, manualAll: false, unknownFirst: true}), before = view.authorRows();
  const first = await view.invoke(); assert.equal(view.providerCalls.length, 1); assert.equal(first.receipt.nextPosition, 0);
  const originalWindow = [...view.scans.windows.values()][0], originalChild = first.receipt.child.receipt.operationId;
  view.entries[0].fields.explicitFreshCatalogChange = {permission: 'Changed after an accepted unknown request'};
  const second = await view.invoke({fresh: true});
  assert.notEqual(first.form[`${kind}ScanIntent`], second.form[`${kind}ScanIntent`]);
  assert.equal(Object.hasOwn(second.form, `${kind}Job`), false); assert.equal(view.scans.windows.size, 2);
  assert.notEqual(second.receipt.scanId, originalWindow.scanId); assert.equal(second.receipt.child.binding, 'observed-blocked');
  assert.equal(second.receipt.child.receipt.operationId, originalChild); assert.equal(second.receipt.nextPosition, 0);
  assert.equal(second.helperIds.length, 0); assert.equal(view.providerCalls.length, 1); assert.equal(view.server.operations.size, 1);
  assert.equal(originalWindow.nextPosition, 0); assert.equal(originalWindow.child.operationId, originalChild);
  const rows = [...view.entries]; view.entries.length = 0; view.setCatalogUnavailable(); const reads = view.catalogReads.length;
  const third = await view.invoke(); assert.equal(view.catalogReads.length, reads); assert.equal(third.receipt.nextPosition, 0);
  assert.equal(third.receipt.child.receipt.operationId, originalChild); assert.equal(view.providerCalls.length, 1);
  view.entries.push(...rows); delete view.entries[0].fields.explicitFreshCatalogChange; preserve(view, before);
  return {first, second, third, declaredNewSourceHashAndDeletionControls: true,
    distinctFreshIntentUuids: true, secondPostContainsNoOldJob: true, duplicateExpense: 0};
}
async function main() {
  await check('Original5489 retains six failures under the unchanged eight-target a988 contract', originalBefore);
  await check('CURRENT exact country and writer membership satisfies all eight original a988 targets', originalPair);
  for (const kind of ['country', 'writer']) {
    await check(`${kind}: eager successors never skip an unfinished window and all501 fixed members are inspected once`, () => eagerWindows(kind));
    await check(`${kind}: only a changed pending source becomes stale while later fixed members continue`, () => changedPending(kind));
    await check(`${kind}: deleted pending tuple is skipped once without substituting its former array neighbour`, () => missingPending(kind));
    await check(`${kind}: unavailable saved-window GET never resets progress or starts a new scan`, () => savedGetFailure(kind));
    await check(`${kind}: twice lost BEGIN acknowledgement preserves one recoverable scan intent`, () => lostBegin(kind));
    await check(`${kind}: twice lost checkpoint acknowledgement reuses one exact logical transition`, () => lostCheckpoint(kind));
    await check(`${kind}: raw legacy tokens cannot authorize an unobserved prefix`, () => legacyRefusal(kind));
    await check(`${kind}: actual bounded paid batch attaches metadata before dispatch and keeps original cap`, () => paidBound(kind));
    await check(`${kind}: accepted unknown child pins before catalog outage and disabled runtime`, () => unknownBeforeRuntime(kind));
    await check(`${kind}: twice lost attach acknowledgement costs zero calls until confirmed cleanup`, () => lostAttach(kind));
    await check(`${kind}: cancellation after accepted translation or review retains delivered bodies without repeat expense`, () => cancellationRetention(kind));
    await check(`${kind}: actual complete retained responses recover privately before catalog outage and changed runtime`, () => completeBodyRecovery(kind));
    await check(`${kind}: foreign unresolved identity pins a new changed-source scan without private artifact access`, () => foreignActive(kind));
    await check(`${kind}: historical retained terminal metadata advances once without another paid attempt`, () => historicalTerminal(kind));
    await check(`${kind}: exhausted Continue preserves original history and only explicit fresh includes new members`, () => exhaustedFresh(kind));
    await check(`${kind}: explicit new fresh intent after accepted unknown work observes the same entity before changed or absent source`, () => freshUnknownSameEntity(kind));
  }
  await check('Writer identical IDs in two countries retain distinct frozen tuples and exact override reads', duplicateWriterTuple);
  const report = {classification: 'PROFILE_STABLE_SCAN_CONTROLLED_ACTUAL_ACTION_AND_HELPER_INTEGRATION', checks, traces,
    archiveSha256: sha(archiveBytes), contractSha256: sha(contractBytes), sources: [...sources.values()],
    boundary: 'Actual actions/helpers/coordinators/strict adapters/budgets/catalog lookup and installed SDK execute. Auth/catalog transport and new profile RPC metadata effects are controlled; native DB/RLS/concurrency remain independent. No external provider/network or production execution.'};
  fs.writeFileSync(path.join(output, 'profile-scan-cases-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({output, passed: checks.filter(row => row.pass).length, failed: checks.filter(row => !row.pass).length,
    failures: checks.filter(row => !row.pass)}));
  if (checks.some(row => !row.pass)) process.exitCode = 2;
}
module.exports = {main};
if (require.main === module) main().catch(error => {fs.writeFileSync(path.join(output, 'execution-error.json'), JSON.stringify({error: error.stack || String(error)}, null, 2)); console.error(error.stack || error); process.exitCode = 2;});
