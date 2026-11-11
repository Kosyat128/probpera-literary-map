const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setup, output, repo, sha, sources } = require('./writer-admission-runtime.cjs');
const checks = [], traces = [], views = [];
const equal = (left, right) => assert.deepEqual(left, right);
const created = options => { const view = setup(options); views.push(view); return view; };
const calls = view => view.providerCalls.length;
const operation = view => [...view.server.operations.values()].at(-1);
function preserve(view, before) {
  equal(view.canonical(), before); assert.equal(view.writes.length, 0); assert.equal(view.builds.length, 0);
  equal(view.server.errors, []);
}
async function check(name, body) {
  if (process.env.WRITER_ADMISSION_DIRECT_ONLY === '1' && new Set([
    'Accepted unknown request blocks a fresh batch and creates no duplicate paid journal',
    'Unknown paid request retains a nonzero current cursor instead of committing next',
    'Deadline before the first provider dispatch keeps the nonzero cursor and costs zero calls',
    'Shared writer batch permits three four-pass candidates and no thirteenth provider call',
    'Structured writer save persists RU and requests its ordinary build before provider admission',
    'Generic writer save persists source and requests its ordinary build before provider admission',
  ]).has(name)) return;
  try { const detail = await body(); checks.push({ name, pass: true }); traces.push({ name, ...detail }); }
  catch (error) { checks.push({ name, pass: false, error: error.stack || String(error) }); }
}
async function main() {
  await check('Accepted unknown request blocks a fresh batch and creates no duplicate paid journal', async () => {
    const view = created({ unknownFirst: true }), before = view.canonical(), first = await view.action(), second = await view.action();
    assert.equal(first.addedProviderCalls, 1); assert.equal(second.addedProviderCalls, 0);
    assert.equal(view.server.operations.size, 1); assert.equal(view.privateCandidates.size, 0); assert.equal(view.runs.length, 0);
    assert.equal(operation(view).calls[0].response, null); preserve(view, before);
    return { first, second, operation: operation(view), calls: view.providerCalls };
  });
  await check('Unknown paid request retains a nonzero current cursor instead of committing next', async () => {
    const view = created({ unknownFirst: true, startCursor: 2, candidates: 5, noManual: true }), before = view.canonical();
    const first = await view.action(), second = await view.action();
    assert.equal(first.addedProviderCalls, 1); assert.equal(second.addedProviderCalls, 0);
    equal(operation(view).resumeCursor, { writerCursor: 2 }); equal(operation(view).nextCursor, { writerCursor: 3 });
    assert.equal(first.params.writerCursor, '2'); assert.equal(second.params.writerCursor, '2'); assert.equal(view.runs.length, 0);
    preserve(view, before); return { first, second, operation: operation(view) };
  });
  await check('Deadline before the first provider dispatch keeps the nonzero cursor and costs zero calls', async () => {
    const view = created({ stopBeforeFirstCall: true, startCursor: 2, candidates: 5, noManual: true }), before = view.canonical();
    const result = await view.action();
    assert.equal(calls(view), 0); assert.equal(result.params.writerCursor, '2'); assert.equal(view.privateCandidates.size, 0);
    for (const item of view.server.operations.values()) equal(item.resumeCursor, { writerCursor: 2 });
    preserve(view, before); return { result, operations: [...view.server.operations.values()] };
  });
  await check('A malformed BEGIN capability cannot authorize provider work in the actual helper', async () => {
    const view = created({ malformedBegin: true }), before = view.canonical(), result = await view.helper();
    assert.equal(calls(view), 0); assert.equal(view.privateCandidates.size, 0); assert.notEqual(result.state, 'translated');
    assert.equal(view.server.operations.size, 1); preserve(view, before); return { result, operation: operation(view) };
  });
  await check('Two concurrent helper admissions share one provider operation for the same revision', async () => {
    let entered, release;
    const atProvider = new Promise(resolve => { entered = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    const view = created({ onProvider: async ({ call }) => { if (call.serial === 1) { entered(); await held; } } }), before = view.canonical();
    const firstPromise = view.helper(); await atProvider;
    let second;
    try { second = await view.helper(); } finally { release(); }
    const first = await firstPromise;
    assert.equal(view.server.operations.size, 1); assert.equal(second.state, 'unconfirmed');
    assert.equal(first.state, 'translated'); assert.equal(calls(view), 2); preserve(view, before);
    return { first, second, operations: [...view.server.operations.values()] };
  });
  await check('Lost BEGIN acknowledgement confirms zero calls before a safe fresh attempt', async () => {
    const view = created({ lostAcks: ['begin_writer_translation_operation'] }), before = view.canonical(), first = await view.helper();
    assert.equal(calls(view), 0); const previous = structuredClone(operation(view)); assert.equal(previous.calls.length, 0);
    assert.equal(previous.phase, 'finished'); assert.equal(previous.result.state, 'skipped');
    const second = await view.helper(); assert.equal(calls(view), 2); assert.equal(second.state, 'translated'); assert.equal(view.server.operations.size, 2);
    preserve(view, before); return { first, second, confirmedZeroCallOperation: previous, operation: operation(view) };
  });
  for (const [name, rpc, expectedReservations] of [
    ['Lost dispatch acknowledgement never repeats or invents a provider request', 'record_writer_translation_operation_dispatch', 1],
  ]) {
    await check(name, async () => {
      const view = created({ lostAcks: [rpc] }), before = view.canonical(), first = await view.helper(), second = await view.helper();
      assert.equal(calls(view), 0); assert.equal(view.server.operations.size, 1); assert.equal(view.privateCandidates.size, 0);
      assert.equal(operation(view).calls.length, expectedReservations); assert.notEqual(first.state, 'translated'); assert.notEqual(second.state, 'translated');
      preserve(view, before); return { first, second, operation: operation(view), events: view.server.events };
    });
  }
  await check('A retained raw first response is not a complete reviewed candidate and is not automatically resumed', async () => {
    const view = created({ incompleteFirstResponse: true }), before = view.canonical();
    const first = await view.helper(), count = calls(view), second = await view.helper();
    assert.equal(count, 1); assert.equal(calls(view), count); assert.equal(view.privateCandidates.size, 0);
    assert.equal(operation(view).candidate, null); assert.ok(operation(view).calls[0].artifact);
    assert.notEqual(first.state, 'translated'); assert.notEqual(second.state, 'translated'); preserve(view, before);
    return { first, second, operation: operation(view) };
  });
  await check('A lost final response acknowledgement recovers the complete paid body with zero further provider calls', async () => {
    const view = created({ lostFinalResponseAck: true }), before = view.canonical(), first = await view.helper(), second = await view.helper();
    assert.equal(calls(view), 2); assert.equal(operation(view).phase, 'finished'); assert.ok(operation(view).candidate);
    assert.equal(operation(view).candidate.payload.text, view.englishText); assert.equal(view.privateCandidates.size, 1);
    assert.ok(['translated', 'review-pending'].includes(second.state)); preserve(view, before);
    return { first, second, operation: operation(view), events: view.server.events };
  });
  await check('A lost FINISH acknowledgement reconciles the existing complete candidate without regeneration', async () => {
    const view = created({ lostAcks: ['finish_writer_translation_operation'] }), before = view.canonical();
    const first = await view.helper(), saved = structuredClone([...view.privateCandidates.values()][0]), second = await view.helper();
    assert.equal(calls(view), 2); assert.equal(operation(view).phase, 'finished'); assert.ok(operation(view).candidate);
    equal([...view.privateCandidates.values()][0], saved); assert.equal(second.state, 'review-pending');
    preserve(view, before); return { first, second, operation: operation(view), saved };
  });
  for (const mode of ['target CAS', 'manual English']) {
    await check(`Completed paid candidate survives ${mode} takeover without changing canonical author data`, async () => {
      let concurrent;
      const view = created({ onProvider: async ({ call, runtime }) => {
        if (call.pass !== 'review') return;
        const row = runtime.rows.get(runtime.writers[0].id); row.updated_at = runtime.afterStamp;
        if (mode === 'manual English') row.fields.biographyTranslations = { ru: structuredClone(runtime.russian), en: {
          ...structuredClone(runtime.russian), locale: 'en', method: 'human-translation', text: runtime.englishText,
          authorRights: { consent: 'Exact concurrent manual author consent' } } };
        concurrent = structuredClone(row);
      } });
      const result = await view.helper(); assert.equal(calls(view), 2); assert.ok(operation(view).candidate);
      assert.equal(operation(view).result.persistence, 'working-draft'); assert.equal(view.privateCandidates.size, 1);
      equal(view.rows.get(view.writers[0].id), concurrent); assert.equal(operation(view).candidate.payload.text, view.englishText);
      const again = await view.helper(); assert.equal(calls(view), 2); equal(view.rows.get(view.writers[0].id), concurrent);
      assert.equal(view.writes.length, 0); assert.equal(view.builds.length, 0); equal(view.server.errors, []);
      return { result, again, operation: operation(view), canonicalAfter: view.canonical() };
    });
  }
  await check('Concurrent pending-slot takeover preserves both the existing slot and the new complete paid artifact', async () => {
    let foreign;
    const view = created({ onProvider: async ({ call, runtime, server, privateCandidates }) => {
      if (call.pass !== 'review') return;
      const item = [...server.operations.values()][0];
      foreign = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', version: 3, entityType: 'writer_biography', entityId: item.entityId,
        targetLocale: 'en', humanReview: 'pending', sourceHash: item.sourceHash, candidateHash: 'e'.repeat(64),
        sourceSnapshot: structuredClone(item.sourceSnapshot), sourceRevision: structuredClone(item.sourceRevision), targetRevision: structuredClone(item.targetRevision),
        payload: { text: runtime.englishText.replace('a Russian writer', 'the Russian novelist') },
        provenance: { provider: item.provider, translatorModel: 'existing-translator', reviewerModel: 'existing-reviewer',
          translatorRequestId: 'earlier-one', reviewerRequestId: 'earlier-two', generatedAt: '2026-10-29T21:00:00.000Z' },
        createdAt: '2026-10-29T21:00:00.000Z', createdBy: runtime.actorId };
      privateCandidates.set(`writer_biography:${item.entityId}`, structuredClone(foreign));
    } }), before = view.canonical();
    const result = await view.helper(); equal([...view.privateCandidates.values()][0], foreign);
    assert.equal(operation(view).result.persistence, 'private-artifact'); assert.equal(operation(view).candidate.payload.text, view.englishText);
    assert.equal(calls(view), 2); preserve(view, before); return { result, operation: operation(view), existingSlot: foreign };
  });
  await check('Cancellation after accepted final review retains the complete paid body without claiming completion', async () => {
    const view = created({ onProvider: async ({ call, server }) => {
      if (call.pass === 'review') [...server.operations.values()][0].cancelRequested = true;
    } }), before = view.canonical(), result = await view.helper();
    assert.equal(calls(view), 2); assert.equal(operation(view).result.state, 'cancelled');
    assert.ok(operation(view).candidate); assert.equal(view.privateCandidates.size, 1); assert.notEqual(result.state, 'translated');
    preserve(view, before); return { result, operation: operation(view) };
  });
  await check('Manual current and already pending records cost no additional admission or provider work', async () => {
    const manual = created(), original = manual.canonical(); const outcome = await manual.helper(1);
    assert.equal(outcome.state, 'manual'); assert.equal(calls(manual), 0); assert.equal(manual.server.operations.size, 0); preserve(manual, original);
    const pending = created(); await pending.helper(); const count = calls(pending), existing = structuredClone([...pending.privateCandidates.values()][0]);
    const repeated = await pending.helper(); assert.equal(repeated.state, 'review-pending'); assert.equal(calls(pending), count);
    assert.equal(pending.server.operations.size, 1); equal([...pending.privateCandidates.values()][0], existing); equal(pending.server.errors, []);
    const current = created(); await current.helper(); const generated = structuredClone([...current.privateCandidates.values()][0]);
    current.privateCandidates.clear(); const row = current.rows.get(current.writers[0].id);
    row.fields.biographyTranslations = { ru: structuredClone(current.russian), en: { ...structuredClone(current.russian),
      locale: 'en', text: current.englishText, method: 'machine-translation', status: 'reviewed', translatedFromLocale: 'ru', sourceTextRights: 'project-original',
      translationMeta: { sourceHash: generated.sourceHash, model: generated.provenance.translatorModel, reviewerModel: generated.provenance.reviewerModel,
        generatedAt: new Date(generated.provenance.generatedAt).toISOString() } } };
    const currentBefore = current.canonical(), currentCalls = calls(current), alreadyCurrent = await current.helper();
    assert.equal(alreadyCurrent.state, 'current'); assert.equal(calls(current), currentCalls); assert.equal(current.server.operations.size, 1); preserve(current, currentBefore);
    return { manual: outcome, current: alreadyCurrent, pending: repeated };
  });
  await check('A consumed completed draft remains historical and is not restaged or regenerated by a fresh helper', async () => {
    const view = created(), before = view.canonical(), first = await view.helper(); assert.equal(first.state, 'translated');
    const completed = structuredClone(operation(view)), finishCalls = view.server.events.filter(event => event.name === 'finish_writer_translation_operation' && event.event === 'request').length;
    view.privateCandidates.clear(); const again = await view.helper();
    assert.equal(again.state, 'skipped'); assert.equal(again.errorCode, 'translation_retry_blocked');
    assert.equal(calls(view), 2); assert.equal(view.privateCandidates.size, 0); assert.equal(view.server.operations.size, 1);
    equal(operation(view), completed); assert.equal(view.server.events.filter(event => event.name === 'finish_writer_translation_operation' && event.event === 'request').length, finishCalls);
    preserve(view, before); return { first, again, historicalOperation: completed };
  });
  await check('Default ordinary helper uses one four-pass attempt and repeats pending output at zero cost', async () => {
    const view = created({ repairBoth: true }), before = view.canonical(), first = await view.helper(), second = await view.helper();
    assert.equal(first.state, 'translated'); assert.equal(second.state, 'review-pending'); assert.equal(calls(view), 4);
    equal(view.providerCalls.map(call => call.pass), ['translation', 'repair', 'review', 'repair']);
    equal(view.budgets[0].input, { maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300_000 }); preserve(view, before);
    return { first, second, budget: view.budgets[0].budget.snapshot() };
  });
  await check('Shared writer batch permits three four-pass candidates and no thirteenth provider call', async () => {
    const view = created({ repairBoth: true, candidates: 5, noManual: true }), before = view.canonical(), result = await view.action();
    assert.equal(calls(view), 12); assert.equal(view.server.operations.size, 3); assert.equal(view.runs.length, 0);
    equal(view.budgets[0].budget.snapshot().attempts, 3); equal(operation(view).resumeCursor, { writerCursor: 3 });
    preserve(view, before); return { result, budget: view.budgets[0].budget.snapshot(), operations: [...view.server.operations.values()] };
  });

  // The two ordinary editor actions execute from the maintained actual-module
  // fixture; its provider observer records real prior saves/enqueues.
  const machineFile = path.join(repo, 'apps/admin/lib/fixtures/writer-biography-machine-review.cjs'), machineBytes = fs.readFileSync(machineFile, 'utf8');
  const boundary = machineBytes.indexOf('\nasync function main()'); assert.ok(boundary > 0);
  for (const [name, options, action] of [['Structured writer save persists RU and requests its ordinary build before provider admission', { admitted: true }, 'saveBiography'],
    ['Generic writer save persists source and requests its ordinary build before provider admission', {}, 'saveProfile']]) {
    await check(name, async () => {
      const env = { WRITER_REPO: repo, WRITER_SOURCE_ROOT: repo, WRITER_OUTPUT_ROOT: path.join(output, action) };
      const machine = new Function('require', '__dirname', '__filename', 'process', machineBytes.slice(0, boundary) + '\nreturn {fixture,graph};')
        (require, path.dirname(machineFile), machineFile, { env });
      const view = machine.fixture(options), redirect = await view[action]();
      for (const item of machine.graph.values()) sources.set(item.module, item);
      assert.equal(view.providerCalls.length, 2); assert.ok(view.providerCalls[0].mutationsBeforeDispatch > 0);
      assert.equal(view.providerCalls[0].publicEnqueuesBeforeDispatch, 1); assert.equal(view.enqueues.length, 1);
      assert.equal(view.admission.operations.size, 1); equal(view.admission.errors, []);
      return { redirect, firstProvider: view.providerCalls[0], enqueues: view.enqueues, actualAdmission: view.admission.events };
    });
  }
  for (const view of views) for (const item of view.graph.values()) sources.set(item.module, item);
  const sourceList = [...sources.values()];
  const result = { mode: process.env.WRITER_ADMISSION_DIRECT_ONLY === '1' ? 'Direct helper diagnostic subset only' : 'Full maintained scenario selection', checks, traces, sourceRoot: repo, sources: sourceList,
    unchanged: sourceList.every(item => sha(fs.readFileSync(path.join(repo, item.module))) === item.sha256),
    boundaryErrors: views.flatMap(view => view.server.errors),
    limitations: ['Actual application algorithms execute; only SDK/Auth/catalog/provider boundaries and the budget clock are controlled.',
      'The fixture models committed RPC effects before injected ACK loss. Native PostgreSQL verifies real schema behavior separately.',
      'No partial-pass auto-resume, T13 browser UI, live Auth/DB/RLS/provider/billing/network/public delivery or production acceptance is claimed.'] };
  fs.writeFileSync(path.join(output, 'writer-admission-cases-report.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ report: path.join(output, 'writer-admission-cases-report.json'), ...result, traces: undefined, sources: undefined }, null, 2));
  process.exitCode = checks.every(item => item.pass) && result.unchanged && result.boundaryErrors.length === 0 ? 0 : 1;
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 2; });
