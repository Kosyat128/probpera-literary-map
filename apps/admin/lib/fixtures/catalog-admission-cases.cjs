const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setup, output, repo, sourceRoot, sha, sources, specifications } = require('./catalog-admission-runtime.cjs');
const checks = [], traces = [], views = [];
const create = (kind, options) => { const view = setup(kind, options); views.push(view); return view; };
const lastOperation = view => [...view.server.operations.values()].at(-1);
function preserve(view, before) {
  assert.deepEqual(view.canonical(), before, 'Canonical authored content, sources, rights and metadata remain exact');
  assert.equal(view.writes.length, 0); assert.equal(view.builds.length, 0); assert.deepEqual(view.server.errors, []);
}
async function check(kind, name, body) {
  try { const detail = await body(); checks.push({ kind, name, pass: true }); traces.push({ kind, name, ...detail }); }
  catch (error) { checks.push({ kind, name, pass: false, error: error.stack || String(error) }); }
}
async function main() {
  for (const kind of Object.keys(specifications)) {
    await check(kind, 'Unknown accepted request blocks fresh helper work without a duplicate paid attempt', async () => {
      const view = create(kind, { unknownFirst: true }), before = view.canonical();
      const first = await view.helper(), second = await view.helper();
      assert.equal(first.state, 'unconfirmed'); assert.equal(second.state, 'unconfirmed'); assert.equal(view.providerCalls.length, 1);
      assert.equal(view.server.operations.size, 1); assert.equal(view.privateCandidates.size, 0); assert.equal(lastOperation(view).calls[0].response, null);
      preserve(view, before); return { first, second, operation: lastOperation(view), calls: view.providerCalls };
    });
    await check(kind, 'Unknown entity admission remains exclusive after raw rights change without timestamp change', async () => {
      const view = create(kind, { unknownFirst: true }); await view.helper(); const cached = structuredClone(lastOperation(view).rawSeed);
      if (kind === 'library') view.rows[0].sources[0].license_name = 'Changed source licence with identical master revisions';
      else view.rows[0].fields.sourceMetadata.permission = 'Changed raw catalog permission with identical override revision';
      const current = view.canonical(), result = await view.helper(); assert.equal(result.state, 'unconfirmed');
      assert.equal(view.providerCalls.length, 1); assert.equal(view.server.operations.size, 1); assert.deepEqual(lastOperation(view).rawSeed, cached);
      preserve(view, current); return { result, operation: lastOperation(view) };
    });
    await check(kind, 'Unknown batch operation holds a nonzero cursor and creates no posthoc paid aggregate', async () => {
      const view = create(kind, { unknownFirst: true, candidates: kind === 'library' ? 5 : 3, noManual: true, startCursor: 1 }), before = view.canonical();
      const first = await view.action(), second = await view.action();
      assert.equal(first.addedSameSourceCalls, 1); assert.equal(second.addedSameSourceCalls, 0); assert.equal(view.runs.length, 0);
      assert.deepEqual(lastOperation(view).resumeCursor, { [`${kind}Cursor`]: 1 }); assert.deepEqual(lastOperation(view).nextCursor, { [`${kind}Cursor`]: 2 });
      assert.equal(first.params[`${kind}Cursor`], '1'); assert.equal(second.params[`${kind}Cursor`], '1'); preserve(view, before);
      return { first, second, operation: lastOperation(view) };
    });
    await check(kind, 'Zero-call budget closure retains the nonzero current cursor without committing next', async () => {
      const view = create(kind, { stopBeforeFirstCall: true, candidates: kind === 'library' ? 5 : 3, noManual: true, startCursor: 1 }), before = view.canonical(), result = await view.action();
      assert.equal(view.providerCalls.length, 0); assert.equal(view.privateCandidates.size, 0); assert.equal(result.params[`${kind}Cursor`], '1');
      assert.deepEqual(lastOperation(view).resumeCursor, { [`${kind}Cursor`]: 1 }); assert.equal(lastOperation(view).result.state, 'skipped');
      assert.equal(lastOperation(view).calls.length, 0); assert.equal(view.runs.length, 0); preserve(view, before); return { result, operation: lastOperation(view) };
    });
    await check(kind, 'Malformed BEGIN receipt cannot authorize an actual provider call', async () => {
      const view = create(kind, { malformedBegin: true }), before = view.canonical(), result = await view.helper();
      assert.equal(view.providerCalls.length, 0); assert.equal(view.privateCandidates.size, 0); assert.notEqual(result.state, 'translated');
      preserve(view, before); return { result, operations: [...view.server.operations.values()] };
    });
    await check(kind, 'Concurrent actual helpers admit only one provider operation for the same entity', async () => {
      let entered, release;
      const atProvider = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
      const view = create(kind, { onProvider: async ({ call }) => { if (call.serial === 1) { entered(); await held; } } }), before = view.canonical();
      const firstPromise = view.helper(); await Promise.race([atProvider, firstPromise.then(result => { throw new Error(`Helper returned before provider boundary: ${JSON.stringify(result)}`); })]);
      let second; try { second = await view.helper(); } finally { release(); }
      const first = await firstPromise;
      assert.equal(first.state, 'translated'); assert.equal(second.state, 'unconfirmed'); assert.equal(view.providerCalls.length, 2); assert.equal(view.server.operations.size, 1);
      preserve(view, before); return { first, second, operations: [...view.server.operations.values()] };
    });
    await check(kind, 'Lost BEGIN acknowledgement confirms zero calls before a safe fresh attempt', async () => {
      const view = create(kind, { lostAcks: ['begin_catalog_translation_operation'] }), before = view.canonical();
      const first = await view.helper(); assert.equal(view.providerCalls.length, 0); assert.equal(view.privateCandidates.size, 0);
      const second = await view.helper(); assert.equal(second.state, 'translated'); assert.equal(view.providerCalls.length, 2);
      assert.equal([...view.server.operations.values()].filter(item => item.calls.length).length, 1); preserve(view, before);
      return { first, second, operations: [...view.server.operations.values()] };
    });
    await check(kind, 'Lost dispatch acknowledgement never fabricates a response or repeats a request', async () => {
      const view = create(kind, { lostAcks: ['record_catalog_translation_operation_dispatch'] }), before = view.canonical();
      const first = await view.helper(), second = await view.helper();
      assert.equal(first.state, 'unconfirmed'); assert.equal(second.state, 'unconfirmed'); assert.equal(view.providerCalls.length, 0);
      assert.equal(lastOperation(view).calls.length, 1); assert.equal(lastOperation(view).calls[0].response, null); assert.equal(view.privateCandidates.size, 0);
      preserve(view, before); return { first, second, operation: lastOperation(view) };
    });
    await check(kind, 'Retained raw first response is incomplete and cannot automatically start a new paid pass', async () => {
      const view = create(kind, { incompleteFirstResponse: true }), before = view.canonical();
      const first = await view.helper(), second = await view.helper();
      assert.equal(first.state, 'unconfirmed'); assert.equal(second.state, 'unconfirmed'); assert.equal(view.providerCalls.length, 1);
      assert.ok(lastOperation(view).calls[0].artifact); assert.equal(lastOperation(view).candidate, null); assert.equal(view.privateCandidates.size, 0);
      preserve(view, before); return { first, second, operation: lastOperation(view) };
    });
    await check(kind, 'Complete paid response survives unavailable acknowledgement and recovers at zero further cost', async () => {
      const view = create(kind, { incompleteFinalResponse: true }), before = view.canonical();
      const first = await view.helper(); assert.equal(first.state, 'unconfirmed'); assert.equal(view.providerCalls.length, 2); assert.equal(view.privateCandidates.size, 0);
      const second = await view.helper(); assert.equal(second.state, 'translated'); assert.equal(view.providerCalls.length, 2); assert.equal(view.privateCandidates.size, 1);
      assert.ok(lastOperation(view).candidate); preserve(view, before); return { first, second, operation: lastOperation(view) };
    });
    await check(kind, 'Lost FINISH acknowledgement reconciles the existing completed private candidate', async () => {
      const view = create(kind, { lostAcks: ['finish_catalog_translation_operation'] }), before = view.canonical(), result = await view.helper();
      assert.equal(result.state, 'translated'); assert.equal(view.providerCalls.length, 2); assert.equal(view.privateCandidates.size, 1);
      const priorDraft = structuredClone([...view.privateCandidates.values()][0]); await view.helper();
      assert.equal(view.providerCalls.length, 2); assert.deepEqual([...view.privateCandidates.values()][0], priorDraft);
      preserve(view, before); return { result, operation: lastOperation(view) };
    });
    await check(kind, 'Cancellation after final accepted review retains complete paid output without claiming success', async () => {
      const view = create(kind, { onProvider: async ({ call, server }) => { if (call.pass === 'review') [...server.operations.values()].at(-1).cancelRequested = true; } }), before = view.canonical(), result = await view.helper();
      assert.equal(result.state, 'cancelled'); assert.equal(view.providerCalls.length, 2); assert.ok(lastOperation(view).candidate);
      assert.equal(view.privateCandidates.size, 1); assert.equal(lastOperation(view).result.publication, 'unchanged'); preserve(view, before); return { result, operation: lastOperation(view) };
    });
    for (const drift of ['source-revision', 'manual-English', 'rights-without-timestamp']) {
      await check(kind, `Completed paid body remains private after ${drift} takeover`, async () => {
        const view = create(kind, { onProvider: async ({ call, row }) => {
          if (call.pass !== 'review') return;
          if (kind === 'library') {
            if (drift === 'source-revision') row.russian.updated_at = view.laterStamp;
            else if (drift === 'manual-English') { row.english.translation_method = 'human-translation'; row.english.metadata.manualRights = 'New signed EN rights'; }
            else row.sources[0].license_name = 'Changed licence, master timestamps unchanged';
          } else {
            if (drift === 'source-revision') row.row.updated_at = view.laterStamp;
            else if (drift === 'manual-English') { row.row.fields.translations.en.method = 'human-translation'; row.row.fields.translations.en.rights = 'New signed EN rights'; }
            else row.fields.sourceMetadata.permission = 'Changed raw catalog rights without override timestamp';
          }
        } }), original = view.canonical();
        const result = await view.helper(), concurrent = view.canonical();
        assert.ok(['conflict', 'stale'].includes(result.state), JSON.stringify(result)); assert.equal(view.providerCalls.length, 2);
        assert.ok(lastOperation(view).candidate); assert.equal(view.privateCandidates.size, 1);
        assert.deepEqual(lastOperation(view).rawSeed[kind === 'library' ? 'work' : 'catalogFields'], kind === 'library' ? original[0].work : original[0].fields);
        if (kind === 'library' && drift === 'rights-without-timestamp') assert.deepEqual(lastOperation(view).rawSeed.sources, original[0].sources);
        preserve(view, concurrent); return { result, original, concurrent, operation: lastOperation(view) };
      });
    }
    await check(kind, 'Concurrent pending-slot takeover preserves the old slot and retains the new complete candidate', async () => {
      const slot = { id: '12121212-1212-4212-8212-121212121212', marker: 'Concurrent human pending candidate - preserve exact' };
      const view = create(kind, { onProvider: async ({ call, privateCandidates }) => { if (call.pass === 'review') privateCandidates.set(`${view.spec.type}:${call.entityId}`, structuredClone(slot)); } }), before = view.canonical();
      const result = await view.helper(); assert.equal(result.state, 'conflict'); assert.equal(view.providerCalls.length, 2);
      assert.deepEqual(view.privateCandidates.get(`${view.spec.type}:${view.identity(0)}`), slot);
      assert.ok(lastOperation(view).candidate); assert.equal(lastOperation(view).result.persistence, 'private-artifact'); assert.equal(lastOperation(view).result.draftId, null);
      preserve(view, before); return { result, slot, operation: lastOperation(view) };
    });
    await check(kind, 'Consumed completed draft remains historical and is never regenerated or restaged', async () => {
      const view = create(kind), before = view.canonical(); assert.equal((await view.helper()).state, 'translated');
      view.privateCandidates.clear(); const result = await view.helper(); assert.equal(result.state, 'skipped');
      assert.equal(view.providerCalls.length, 2); assert.equal(view.privateCandidates.size, 0); assert.equal(view.server.operations.size, 1);
      preserve(view, before); return { result, operation: lastOperation(view) };
    });
    for (const review of [false, true]) for (const repair of [false, true]) {
      await check(kind, `review=${review} repair=${repair} preserves existing provider passes, token limit and human-pending completion`, async () => {
        const view = create(kind, { review, repairBoth: review && repair, repairTranslation: !review && repair }), before = view.canonical(), result = await view.helper();
        const passes = review ? repair ? ['translation','repair','review','repair'] : ['translation','review'] : repair ? ['translation','repair'] : ['translation'];
        assert.equal(result.state, 'translated'); assert.deepEqual(view.providerCalls.map(call => call.pass), passes);
        assert.equal(lastOperation(view).configuration.maxOutputTokens, view.spec.tokens); assert.equal(lastOperation(view).configuration.twoPassReview, review);
        assert.equal(result.humanReview, 'pending'); assert.equal(result.publication, 'unchanged'); assert.equal(result.reviewerModel, passes.length === 1 ? null : lastOperation(view).configuration.reviewerModel);
        const measured = view.budgets[0]; assert.deepEqual({ maxAttempts: measured.input.maxAttempts, maxProviderCalls: measured.input.maxProviderCalls, deadlineMs: measured.input.deadlineMs }, { maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300000 });
        await view.helper(); assert.equal(view.providerCalls.length, passes.length); preserve(view, before); return { result, operation: lastOperation(view), passes };
      });
    }
    await check(kind, 'Deadline after raw translation holds current cursor and never claims complete output', async () => {
      const view = create(kind, { deadlineAfterTranslation: true }), before = view.canonical(), result = await view.helper(0, { operationCursor: { current: { [`${kind}Cursor`]: 7 }, next: { [`${kind}Cursor`]: 8 } } });
      assert.equal(result.state, 'unconfirmed'); assert.equal(view.providerCalls.length, 1); assert.equal(view.privateCandidates.size, 0);
      assert.deepEqual(lastOperation(view).resumeCursor, { [`${kind}Cursor`]: 7 }); assert.equal(lastOperation(view).candidate, null);
      preserve(view, before); return { result, operation: lastOperation(view) };
    });
    await check(kind, 'Full repair batch preserves its original shared attempt and provider-call limits', async () => {
      const view = create(kind, { repairBoth: true, noManual: true, candidates: kind === 'library' ? 5 : 3 }), before = view.canonical(), result = await view.action();
      assert.equal(view.providerCalls.length, view.spec.cap * 4); assert.equal(view.server.operations.size, view.spec.cap); assert.equal(view.privateCandidates.size, view.spec.cap);
      for (const operation of view.server.operations.values()) { assert.equal(operation.calls.length, 4); assert.equal(operation.result.state, 'translated'); }
      assert.equal(view.budgets[0].input.maxAttempts, view.spec.cap); assert.equal(view.budgets[0].input.maxProviderCalls, view.spec.cap * 4);
      assert.equal(lastOperation(view).resumeCursor[`${kind}Cursor`], view.spec.cap); assert.equal(view.runs.length, 0); preserve(view, before);
      return { result, operations: [...view.server.operations.values()], metrics: view.budgets[0].budget.snapshot() };
    });
    await check(kind, 'Acknowledged invalid paid responses stay held without a fresh implicit attempt', async () => {
      const view = create(kind, { invalidEveryPass: true }), before = view.canonical();
      const budget = view.load('apps/admin/lib/translation-operation-budget.ts').createTranslationOperationBudget({ maxAttempts: 2, maxProviderCalls: 3, deadlineMs: 300000 });
      const first = await view.helper(0, { operationBudget: budget }), second = await view.helper(0, { operationBudget: budget });
      assert.equal(first.state, 'unconfirmed'); assert.equal(second.state, 'unconfirmed'); assert.equal(view.providerCalls.length, 2);
      assert.equal(budget.snapshot().attempts, 1); assert.equal(view.privateCandidates.size, 0);
      assert.equal(view.server.operations.size, 1); assert.notEqual(lastOperation(view).phase, 'finished');
      assert.equal(lastOperation(view).result, null); assert.equal(lastOperation(view).candidate, null);
      assert.ok([...view.server.operations.values()].every(item => item.calls.every(call => call.response !== null)));
      preserve(view, before); return { first, second, operations: [...view.server.operations.values()], metrics: budget.snapshot() };
    });
    await check(kind, 'Oversize full raw server seed refuses admission before any provider expense', async () => {
      const view = create(kind);
      if (kind === 'library') view.rows[0].work.metadata.largePrivateSeed = 'x'.repeat(4 * 1024 * 1024);
      else view.rows[0].fields.sourceMetadata.largePrivateSeed = 'x'.repeat(4 * 1024 * 1024);
      const before = view.canonical(), result = await view.helper(); assert.notEqual(result.state, 'translated'); assert.equal(view.providerCalls.length, 0);
      assert.equal(view.server.operations.size, 0); assert.equal(view.privateCandidates.size, 0); preserve(view, before); return { result };
    });
    await check(kind, 'Oversize response cannot receive a false acknowledgement or start reviewer work', async () => {
      const view = create(kind), before = view.canonical(), run = view.ai.run;
      view.ai.run = async (model, input) => ({ ...(await run(model, input)), response: 'x'.repeat(1024 * 1024) });
      const first = await view.helper(), second = await view.helper();
      assert.equal(first.state, 'unconfirmed'); assert.equal(second.state, 'unconfirmed'); assert.equal(view.providerCalls.length, 1);
      assert.equal(lastOperation(view).calls[0].response, null); assert.equal(view.privateCandidates.size, 0); preserve(view, before);
      return { first, second, metadataAcknowledged: false, operation: { ...lastOperation(view), rawSeed: '[private seed retained]' } };
    });
    await check(kind, 'Ordinary source save and its durable build request precede optional paid admission', async () => {
      const view = create(kind, { ordinarySave: true }), original = view.canonical();
      const result = await view.ordinary();
      const firstProvider = view.timeline.findIndex(event => event.event === 'controlled-provider-accepted'); assert.ok(firstProvider > 0, JSON.stringify(result));
      const preceding = view.timeline.slice(0, firstProvider);
      assert.ok(preceding.some(event => event.event === 'sdk-boundary' && event.method === 'PATCH'));
      assert.ok(preceding.some(event => event.name === 'admin_audit_log' && event.method === 'POST'));
      assert.ok(preceding.some(event => event.name === 'enqueue_public_build_request' && event.method === 'POST'));
      assert.equal(view.builds.length, 1); assert.equal(view.providerCalls.length, 2); assert.equal(view.server.operations.size, 1);
      const sourceAudit = view.audits.find(row => ['country_profile.updated', 'literary_work_translation.updated'].includes(row.action)); assert.ok(sourceAudit);
      assert.equal(sourceAudit.metadata[kind === 'library' ? 'premiumEnglishStarted' : 'autoTranslationStarted'], false);
      assert.equal(view.builds[0].p_metadata[kind === 'library' ? 'premiumEnglishStarted' : 'translationStarted'], false);
      if (kind === 'library') { assert.deepEqual(view.rows[0].english, original[0].english); assert.deepEqual(view.rows[0].sources, original[0].sources); }
      else assert.deepEqual(view.rows[0].row.fields.translations, original[0].row.fields.translations);
      assert.equal(result.params.translation_operation, lastOperation(view).operationId); assert.deepEqual(view.server.errors, []);
      return { result, sourceAudit, buildRequest: view.builds[0], timeline: view.timeline, operation: lastOperation(view) };
    });
  }
  await check('library', 'Uppercase work UUID resolves the same canonical entity without changing authored fields or source projection', async () => {
    const view = create('library'), before = view.canonical(), result = await view.helper(0, { workId: view.identity(0).toUpperCase() });
    assert.equal(result.state, 'translated'); assert.equal(view.providerCalls.length, 2); assert.equal(lastOperation(view).entityId, view.identity(0));
    assert.equal(lastOperation(view).sourceHash, sha(JSON.stringify(view.providerCalls[0].source))); preserve(view, before); return { result, operation: lastOperation(view) };
  });
  for (const malformed of [null, [], 'invalid-map']) await check('country', `Malformed country translations ${JSON.stringify(malformed)} is rejected before expense`, async () => {
    const view = create('country'); view.rows[0].row.fields.translations = malformed;
    const before = view.canonical(), result = await view.helper(); assert.equal(view.providerCalls.length, 0); assert.equal(view.server.operations.size, 0);
    assert.notEqual(result.state, 'translated'); preserve(view, before); return { result, malformed };
  });
  for (const view of views) for (const entry of view.graph.values()) { assert.equal(sha(fs.readFileSync(path.join(sourceRoot, entry.module))), entry.sha256); sources.set(entry.module, entry); }
  const report = { checks, traces, sourceRoot, sources: [...sources.values()], unchanged: true, boundaryErrors: views.flatMap(view => view.server.errors),
    limitations: ['Actual helpers, configuration/probe/gate, premium transport/parser/repair/review, budgets, catalog adapter/coordinator and installed SDK execute.',
      'Only Auth/catalog records, clock input, provider and PostgREST transport are controlled. Server-side admission/cache effects are modeled separately from native SQL acceptance.',
      'Accepted dispatch is a controlled boundary assertion, not evidence of an external invoice. No live database/provider/network/build or normalizer execution.'] };
  fs.writeFileSync(path.join(output, 'catalog-admission-cases-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ report: path.join(output, 'catalog-admission-cases-report.json'), checks, sourceCount: sources.size }, null, 2));
  process.exitCode = checks.some(item => !item.pass) ? 1 : 0;
}
main().catch(error => { console.error(error.stack || String(error)); process.exitCode = 2; });
