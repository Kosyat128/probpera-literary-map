const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { createCatalogAdmissionBoundary } = require('./catalog-admission-boundary.cjs');
const { createLibraryTranslationScanBoundary } = require('./library-translation-scan-boundary.cjs');
const { createProfileTranslationScanBoundary, freshScanTriggerProof } = require('./profile-translation-scan-boundary.cjs');
const repo = process.env.CATALOG_ADMISSION_REPO || path.resolve(__dirname, '../../../..');
const nativeRequire = createRequire(path.join(repo, 'package.json'));
const { createClient } = nativeRequire('@supabase/supabase-js');
const { isRedirectError } = nativeRequire('next/dist/client/components/redirect-error');
const { getURLFromRedirectError } = nativeRequire('next/dist/client/components/redirect');
const { unzipSync } = nativeRequire('fflate');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const archiveBytes = fs.readFileSync(path.join(repo, 'docs/admin-r3-evidence/2026-10-30-writer-admission/next-library-country-admission-before.zip'));
assert.equal(sha(archiveBytes), '652bbe1367df8b92f267a418600d55ce76feb9fa1f9a69b969722a02c8f27cef');
const archived = unzipSync(archiveBytes);
assert.equal(sha(archived['admission-loss.same-contract.cjs']), '1032b8b03fa702b1ab44a22681a5db4630626cf4ac323841191dedc684a20d04');
const sourceRoot = process.env.CATALOG_ADMISSION_SOURCE_ROOT || repo;
const output = process.env.CATALOG_ADMISSION_OUTPUT_ROOT || fs.mkdtempSync(path.join(path.resolve(repo, '../work'), 'catalog-admission-current-'));
fs.mkdirSync(output, { recursive: true });
const sources = new Map();
let serial = 0;
const specifications = {
  library: { type: 'literary_work', prefix: 'LIBRARY_BUDGET', hash: '2b83662ac50f9c94d35c86e4a18ee5f778553bfaaddaa6e0f1cf7b7dadeefe22', cap: 4, tokens: 4000 },
  country: { type: 'country', prefix: 'COUNTRY_BUDGET', hash: '0599ab41ec2102a8db45a8a9716f9dad9564c04c9bafea8cb7d79236fcb8e377', cap: 2, tokens: 12000 },
};

function setup(kind, options = {}) {
  const spec = specifications[kind]; assert.ok(spec);
  const supportBytes = Buffer.from(archived[`support/${kind}-budget.cjs`]);
  assert.equal(sha(supportBytes), spec.hash);
  const original = supportBytes.toString(), boundary = original.indexOf('\nasync function main()'); assert.ok(boundary > 0);
  const outRoot = path.join(output, `scenario-${++serial}-${kind}`);
  const env = { [`${spec.prefix}_REPO`]: repo, [`${spec.prefix}_SOURCE_ROOT`]: sourceRoot, [`${spec.prefix}_OUTPUT_ROOT`]: outRoot };
  const names = kind === 'library' ? 'entries,description,actorId,stamp,laterStamp' : 'countries,beforeCatalog,russian,english,actorId,stamp,laterStamp';
  const runtime = new Function('require', '__dirname', '__filename', 'process', original.slice(0, boundary) +
    `\nreturn {load,mocks,ai,fetchBoundary,calls,wire,runs,writes,builds,revalidations,graph,controlledProcess,${names}};`)
    (require, __dirname, path.join(__dirname, `frozen-${kind}-budget.cjs`), { env });
  runtime.controlledProcess.env.OPENAI_PREMIUM_TRANSLATION_REVIEW = options.review === false ? 'false' : 'true';
  const rows = kind === 'library' ? runtime.entries : runtime.countries;
  rows.splice(options.candidates || 2);
  const identity = index => kind === 'library' ? rows[index].work.id : rows[index].id;
  const privateCandidates = new Map(), stages = [], audits = [], timeline = [], providerCalls = [], finishes = [];
  const clock = { now: 0 }, budgets = [];
  const canonical = () => structuredClone(rows);
  if (!options.noManual && rows[1]) {
    if (kind === 'library') rows[1].english.translation_method = 'human-translation';
    else rows[1].row.fields.translations.en.method = 'human-translation';
  }
  // Library-only protocol adaptation: a real cheap predecessor establishes
  // ordinal1; an unverified legacy numeric cursor never authorizes a prefix.
  if (kind === 'library' && options.startCursor === 1) rows[0].english.translation_method = 'human-translation';
  if (kind === 'country' && options.startCursor > 0) for (let index = 0; index < options.startCursor; index++) rows[index].row.fields.translations.en.method = 'human-translation';
  const server = createCatalogAdmissionBoundary({ actorId: runtime.actorId,
    getSeed(entityType, entityId) {
      const row = rows.find((_, index) => identity(index) === entityId);
      if (!row) return null;
      return kind === 'library' ? { work: structuredClone(row.work), russian: structuredClone(row.russian), english: structuredClone(row.english), sources: structuredClone(row.sources) }
        : { catalogFields: structuredClone(row.fields), override: structuredClone(row.row) };
    },
    getPrivateCandidate(entityType, entityId) { return privateCandidates.get(`${entityType}:${entityId}`) || null; },
    setPrivateCandidate(entityType, entityId, draft) { privateCandidates.set(`${entityType}:${entityId}`, structuredClone(draft)); stages.push({ protocol: 'catalog-finish', draft: structuredClone(draft) }); },
  });
  for (const name of options.lostAcks || []) server.fault(name);
  const libraryScans = kind === 'library' ? createLibraryTranslationScanBoundary({ actorId: runtime.actorId, getEntries: () => rows, catalogServer: server }) : null;
  const profileScans = kind === 'country' ? createProfileTranslationScanBoundary({actorId: runtime.actorId, catalogServer: server}) : null;
  const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  let phase = 'setup', providerSerial = 0, helperInvocations = 0, responseFaulted = false, rawResponseLostAt = null;
  const fetchBoundary = async (resource, init = {}) => {
    const url = new URL(typeof resource === 'string' ? resource : resource.url), name = url.pathname.split('/').at(-1);
    assert.equal(url.origin, `https://${kind}-budget.fixture.invalid`);
    const method = init.method || 'GET', body = init.body ? JSON.parse(init.body) : null;
    timeline.push({ phase, event: 'sdk-boundary', method, name });
    if (profileScans?.handles(name)) {runtime.wire.push({method, path: url.pathname, body: structuredClone(body)}); return profileScans.fetchRpc(name, body);}
    if (kind === 'country' && name === 'premium_machine_translation_ready') return response(true);
    if (name === 'record_catalog_translation_operation_dispatch' && profileScans?.attachedDispatchBlocked(body.p_operation_id)) return response({code: '42501', message: 'Controlled attached scan stopped'}, 409);
    if (libraryScans?.handles(name)) { runtime.wire.push({ method, path: url.pathname, body: structuredClone(body) }); return libraryScans.fetchRpc(name, body); }
    if (options.ordinarySave && method === 'PATCH' && ['literary_work_translations', 'country_profile_overrides'].includes(name)) {
      const row = kind === 'library' ? rows[0].russian : rows[0].row;
      assert.equal(url.searchParams.get('id'), `eq.${row.id}`); assert.equal(url.searchParams.get('updated_at'), `eq.${row.updated_at}`);
      Object.assign(row, structuredClone(body), { updated_at: runtime.laterStamp });
      runtime.writes.push({ method, table: name, body: structuredClone(body) }); return response([{ id: row.id }]);
    }
    if (options.ordinarySave && name === 'ensure_editorial_reference') return response(true);
    if (options.ordinarySave && name === 'enqueue_public_build_request') { runtime.builds.push(structuredClone(body)); return response('1'); }
    if (options.ordinarySave && name === 'mark_public_build_dispatched') return response(true);
    if (name === 'profile_translation_budget_ready') {
      runtime.wire.push({ method, path: url.pathname, body: structuredClone(body) }); return response(true);
    }
    if (server.handles(name)) {
      runtime.wire.push({ method, path: url.pathname, body: structuredClone(body) });
      if ((options.incompleteFirstResponse || options.incompleteFinalResponse) && rawResponseLostAt === helperInvocations && /reconcile|get_.*artifacts/u.test(name)) {
        return response({ code: '57014', message: 'Controlled private response readback unavailable in this invocation' }, 409);
      }
      if ((options.incompleteFirstResponse || options.incompleteFinalResponse && body?.p_metadata?.pass === 'review') && rawResponseLostAt === null && /record_.*_response/u.test(name)) {
        server.fault(name); rawResponseLostAt = helperInvocations;
      }
      if (options.lostFinalResponseAck && !responseFaulted && /record_.*_response/u.test(name) &&
          (body.p_metadata.pass === 'review' || options.review === false)) { server.fault(name); responseFaulted = true; }
      const result = await server.fetchRpc(name, body);
      if (options.malformedBegin && /begin_/u.test(name) && result.ok) return response({ ...(await result.json()), sourceHash: '0'.repeat(64) });
      if (/finish_/u.test(name)) finishes.push({ phase, args: structuredClone(body), reply: await result.clone().json() });
      return result;
    }
    if (name === 'get_premium_translation_working_draft') {
      runtime.wire.push({ method, path: url.pathname, body: structuredClone(body) });
      return response({ schemaVersion: 1, entityType: body.p_entity_type, entityId: body.p_entity_id, draft: privateCandidates.get(`${body.p_entity_type}:${body.p_entity_id}`) || null });
    }
    if (name === 'stage_premium_translation_working_draft') {
      const key = `${body.p_entity_type}:${body.p_entity_id}`; assert.equal(privateCandidates.has(key), false, 'Existing pending slot must not be overwritten');
      const draft = { id: crypto.randomUUID(), version: 1, entityType: body.p_entity_type, entityId: body.p_entity_id, targetLocale: 'en', humanReview: 'pending',
        sourceHash: body.p_source_hash, candidateHash: sha(JSON.stringify(body)), sourceSnapshot: body.p_source_snapshot,
        sourceRevision: body.p_source_revision, targetRevision: body.p_target_revision, payload: body.p_payload, provenance: body.p_provenance,
        createdAt: new Date().toISOString(), createdBy: runtime.actorId };
      privateCandidates.set(key, structuredClone(draft)); stages.push({ protocol: 'legacy-stage', body: structuredClone(body) });
      runtime.wire.push({ method, path: url.pathname, body: structuredClone(body) });
      return response({ schemaVersion: 1, entityType: body.p_entity_type, entityId: body.p_entity_id, draft });
    }
    if (name === 'admin_audit_log' && method === 'POST') { audits.push(structuredClone(body)); runtime.wire.push({ method, path: url.pathname, body: structuredClone(body) }); return response(null, 201); }
    const result = await runtime.fetchBoundary(resource, init);
    // PostgREST, rather than its SDK, applies SELECT projections. Frozen seed
    // fixtures retain complete rows; expose only the columns actually requested.
    const selected = url.searchParams.get('select');
    if (method === 'GET' && selected && selected !== '*') {
      const data = await result.clone().json();
      if (Array.isArray(data)) return new Response(JSON.stringify(data.map(row => Object.fromEntries(selected.split(',').map(column => [column, row[column]])))),
        { status: result.status, headers: result.headers });
    }
    return result;
  };
  const sdk = createClient(`https://${kind}-budget.fixture.invalid`, 'synthetic-no-auth-session', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchBoundary } });
  runtime.mocks['@/lib/supabase/server'] = { async createServerSupabaseClient() { return sdk; } };
  if (options.ordinarySave) {
    delete runtime.mocks['@/lib/publication'];
    runtime.mocks['@/lib/public-build'] = { async triggerPublicBuild() { return { configured: true, ok: true, provider: 'controlled-no-network' }; } };
    runtime.mocks['@/lib/auto-translate-published-article-premium'] = { async ensurePublishedArticlePremiumEnglish() { throw new Error('Ordinary profile/book save must not run article generation'); } };
  }
  if (kind === 'country') runtime.mocks['@/lib/editorial-catalog'] = { async loadEditorialCatalog() {
    return { version: 1, countries: structuredClone(rows.map(({ id, label, fields }) => ({ id, label, fields }))) };
  } };
  if (kind === 'country' && fs.existsSync(path.join(sourceRoot, 'apps/admin/lib/editorial-catalog.ts'))) {
    const actualCatalog = runtime.load('apps/admin/lib/editorial-catalog.ts'), catalogBoundary = runtime.mocks['@/lib/editorial-catalog'];
    actualCatalog.loadEditorialCatalog = catalogBoundary.loadEditorialCatalog;
    runtime.mocks['./editorial-catalog'] = {...actualCatalog, ...catalogBoundary};
  }
  const budgetApi = runtime.load('apps/admin/lib/translation-operation-budget.ts'), createActualBudget = budgetApi.createTranslationOperationBudget;
  budgetApi.createTranslationOperationBudget = input => {
    const budget = createActualBudget({ ...input, now: () => clock.now }); budgets.push({ input: structuredClone(input), budget }); return budget;
  };
  runtime.mocks['@/lib/translation-operation-budget'] = budgetApi;
  runtime.mocks['@opennextjs/cloudflare'] = { getCloudflareContext() {
    if (options.stopBeforeFirstCall && budgets.at(-1)?.budget.snapshot().attempts > 0 && budgets.at(-1).budget.snapshot().providerCalls === 0) clock.now = 300_000;
    return { env: { AI: runtime.ai } };
  } };
  runtime.ai.run = async (model, input) => {
    const content = JSON.parse(input.messages[1].content), source = content.SOURCE_DATA;
    const index = rows.findIndex(row => kind === 'library' ? row.russian.title === source.russianTitle : ({ ...row.fields, ...row.row.fields }).name === source.name);
    assert.ok(index >= 0, 'Actual domain projection identifies a controlled server seed');
    const pass = Object.hasOwn(content, 'INVALID_DRAFT_TRANSLATION') ? 'repair' : Object.hasOwn(content, 'DRAFT_TRANSLATION') ? 'review' : 'translation';
    const call = { phase, serial: ++providerSerial, entityId: identity(index), index, model, pass, source: structuredClone(source),
      requestSha256: sha(JSON.stringify(input)), sourceSha256: sha(JSON.stringify(source)), acceptedByControlledBoundary: true,
      delivery: options.unknownFirst && providerSerial === 1 ? 'lost-after-acceptance' : 'returned' };
    providerCalls.push(call); timeline.push({ phase, event: 'controlled-provider-accepted', serial: providerSerial, pass });
    if (options.onProvider) await options.onProvider({ call, runtime, server, privateCandidates, row: rows[index] });
    if (options.unknownFirst && providerSerial === 1) { const error = new Error('Controlled accepted request timed out; delivery lost'); error.name = 'TimeoutError'; throw error; }
    if (options.deadlineAfterTranslation && pass === 'translation' || options.deadlineAfterReview && pass === 'review') clock.now = 300_001;
    const invalid = options.invalidEveryPass || options.repairBoth && pass !== 'repair' || options.repairTranslation && providerSerial === 1;
    const value = invalid ? { invalid: true } : kind === 'library' ? { description: runtime.description } : rows[index].generated;
    return { id: `controlled-catalog-${providerSerial}`, response: JSON.stringify(value), usage: { prompt_tokens: 10, completion_tokens: 10 } };
  };
  const helper = (index = 0, extra = {}) => {
    helperInvocations++;
    return kind === 'library' ? runtime.load('apps/admin/lib/auto-translate-literary-work-safe.ts').ensureLiteraryWorkEnglishTranslation({
      supabase: sdk, actorId: runtime.actorId, workId: identity(index), ...extra })
      : runtime.load('apps/admin/lib/auto-translate-country-profile.ts').ensureCountryEnglishProfile({ supabase: sdk,
        actorId: runtime.actorId, countryId: identity(index), sourceFields: structuredClone(rows[index].fields), ...extra });
  };
  let libraryScanIntent = crypto.randomUUID(), countryScanIntent = crypto.randomUUID(), libraryWindowJob = null, countryWindowJob = null;
  async function action(label = 'batch', invocation = {}) {
    if (invocation.freshScan) {
      if (kind === 'library') {libraryScanIntent = crypto.randomUUID(); libraryWindowJob = null;}
      else {countryScanIntent = crypto.randomUUID(); countryWindowJob = null;}
    }
    phase = label; const beforeCalls = providerCalls.length, beforeRuns = runtime.runs.length;
    const actionFile = kind === 'library' ? 'apps/admin/app/(dashboard)/translations/actions.ts' : 'apps/admin/app/(dashboard)/translations/country-actions.ts';
    const actions = runtime.load(actionFile), form = new FormData();
    if (kind === 'library') { if (libraryWindowJob) form.set('libraryJob', libraryWindowJob); else form.set('libraryScanIntent', libraryScanIntent); }
    else if (options.startCursor !== undefined) form.set(`${kind}Cursor`, String(options.startCursor));
    if (kind === 'country') {if (countryWindowJob) form.set('countryJob', countryWindowJob); else form.set('countryScanIntent', countryScanIntent);}
    let redirect;
    try { await (kind === 'library' ? actions.translatePremiumLibraryBatchAction : actions.translatePremiumCountryBatchAction)(form); throw new Error('Actual action must redirect'); }
    catch (error) { assert.equal(isRedirectError(error), true, error.stack); redirect = getURLFromRedirectError(error); }
    const params = Object.fromEntries(new URL(redirect, 'https://fixture.invalid').searchParams); if (kind === 'library' && params.libraryJob) libraryWindowJob = params.libraryJob;
    if (kind === 'country' && params.countryJob) countryWindowJob = params.countryJob;
    return { phase, redirect, params, form: Object.fromEntries(form.entries()), addedSameSourceCalls: providerCalls.length - beforeCalls,
      newRuns: structuredClone(runtime.runs.slice(beforeRuns)), privateCandidates: privateCandidates.size };
  }
  async function ordinary() {
    assert.ok(options.ordinarySave); phase = 'ordinary-save'; const form = new FormData();
    if (kind === 'library') {
      const ru = rows[0].russian;
      for (const [name, value] of Object.entries({ work_id: identity(0), translation_id: ru.id, expected_updated_at: ru.updated_at, locale: 'ru',
        title: ru.title, description: ru.description, source_language: ru.source_language, translation_method: ru.translation_method,
        editorial_status: ru.editorial_status, source_urls: ru.source_urls.join('\n'), reviewed_at: ru.reviewed_at })) form.set(name, String(value));
    } else {
      for (const [name, value] of Object.entries({ entity_type: 'country', country_id: identity(0), expected_updated_at: rows[0].row.updated_at,
        name: rows[0].row.fields.name })) form.set(name, value);
      form.append('enabled_fields', 'name');
    }
    const module = runtime.load(kind === 'library' ? 'apps/admin/app/(dashboard)/library/premium-translation-actions.ts' : 'apps/admin/app/(dashboard)/editorial-database/actions.ts');
    let redirect;
    try { await (kind === 'library' ? module.saveWorkTranslationWithPremiumEnglishAction : module.saveEditorialProfileAction)(form); throw new Error('Actual ordinary save must redirect'); }
    catch (error) { assert.equal(isRedirectError(error), true, error.stack); redirect = getURLFromRedirectError(error); }
    return { redirect, params: Object.fromEntries(new URL(redirect, 'https://fixture.invalid').searchParams) };
  }
  return { ...runtime, kind, spec, rows, identity, sdk, server, privateCandidates, stages, audits, timeline, providerCalls, finishes, budgets, clock, canonical, helper, action, ordinary, libraryScans, profileScans, boundaryOptions: options };
}

async function sameScenario() {
  const cases = [];
  for (const kind of Object.keys(specifications)) {
    const view = setup(kind, { unknownFirst: true }), before = view.canonical();
    const first = await view.action('first-action', {freshScan: true}), second = await view.action('second-fresh-action', {freshScan: true});
    const triggerProof = freshScanTriggerProof(kind, first, second);
    assert.equal(first.addedSameSourceCalls, 1); assert.equal(first.privateCandidates, 0);
    assert.deepEqual(view.canonical(), before); assert.equal(view.writes.length, 0); assert.equal(view.builds.length, 0);
    const actionSources = [...view.graph.values()], journalModule = 'apps/admin/lib/translation-run-record.ts';
    const profileAction = kind === 'country' && actionSources.some(row => row.module === 'apps/admin/lib/profile-translation-scan.ts');
    let compatibilityProbe = null;
    if (profileAction) {
      assert.ok(actionSources.some(row => row.module === 'apps/admin/lib/profile-translation-scan-rpc.ts'));
      assert.ok(view.wire.some(row => row.path?.endsWith('/get_profile_translation_scan')));
      assert.equal(view.wire.filter(row => row.path?.endsWith('/record_translation_sync_run')).length, 0);
      if (!actionSources.some(row => row.module === journalModule) && fs.existsSync(path.join(sourceRoot, journalModule))) {
        const counts = () => ({wire: view.wire.length, runs: view.runs.length, writes: view.writes.length, builds: view.builds.length, providerCalls: view.providerCalls.length});
        const beforeProbe = counts();
        const result = await view.load(journalModule).recordTranslationSyncRun({supabase: view.sdk, kind: 'country', items: []});
        const afterProbe = counts(), probeWireDelta = structuredClone(view.wire.slice(beforeProbe.wire));
        assert.equal(result, null); assert.deepEqual(counts(), beforeProbe);
        compatibilityProbe = {version: 1, role: 'separate-empty-journal-compatibility-probe', module: journalModule,
          reason: 'Original1032 control requires the retained legacy adapter in the verification graph; durable country scans correctly use their typed metadata journal instead of a posthoc legacy aggregate.',
          input: {kind: 'country', items: []}, result, beforeProbe, afterProbe, probeWireDelta,
          actualAddedCounts: Object.fromEntries(Object.keys(beforeProbe).map(key => [key, afterProbe[key] - beforeProbe[key]])),
          addedRpcOrProviderCalls: 0, canonicalWritesOrBuilds: 0,
          boundary: 'Support-only empty-input API probe after actual action execution. This module was not loaded by the country action. Original actionSources is retained separately.'};
      }
    }
    const actionModules = new Set(actionSources.map(row => row.module));
    const graph = [...view.graph.values()].map(row => ({...row, sourceRole: actionModules.has(row.module) ? 'action-dependency' : 'separate-empty-journal-compatibility-probe'})).sort((a,b) => a.module.localeCompare(b.module));
    for (const item of graph) { assert.equal(sha(fs.readFileSync(path.join(sourceRoot, item.module))), item.sha256); sources.set(item.module, item); }
    const packages = ['@supabase/supabase-js', 'typescript', 'next', 'zod'].map(name => ({ name, version: JSON.parse(fs.readFileSync(path.join(repo, 'node_modules', name, 'package.json'), 'utf8')).version }));
    cases.push({ kind, sources: graph, actionSources, compatibilityProbe, triggerProof, packages, snapshots: [first, second], providerCalls: view.providerCalls, timeline: view.timeline,
      canonicalBefore: before, canonicalAfter: view.canonical(), canonicalMachineWrites: view.writes.length, publicBuildRequests: view.builds.length,
      manualId: view.identity(1), executionFailures: 0, operations: [...view.server.operations.values()], finishes: view.finishes, rawLegacyRuns: view.runs });
  }
  const report = { sourceRoot, cases, adaptation: { originalArchiveSha256: sha(archiveBytes), originalInvariantSha256: sha(archived['admission-loss.same-contract.cjs']),
    originalSupportSha256: Object.fromEntries(Object.keys(specifications).map(kind => [kind, sha(archived[`support/${kind}-budget.cjs`])])),
    boundary: 'Versioned controlled SDK transport implements new catalog RPC effects only when requested. Archived BEFORE algorithms retain their original legacy RPC path.',
    observer: 'Version2 verification graph separates original actual actionSources from an explicitly declared CURRENT country empty legacy-journal compatibility probe. The original1032 contract bytes and all four target assertions stay unchanged. Unadapted original graph control failure is retained separately; no probe is labeled an action dependency and no legacy RPC is fabricated.' } };
  fs.writeFileSync(path.join(output, 'same-scenario-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); return report;
}
module.exports = { setup, sameScenario, specifications, sources, output, archived, archiveBytes, sha, sourceRoot, repo };
if (require.main === module) sameScenario().then(report => console.log(JSON.stringify({ report: path.join(output, 'same-scenario-report.json'),
  cases: report.cases.map(item => ({ kind: item.kind, calls: item.providerCalls.length, snapshots: item.snapshots })) }, null, 2)))
  .catch(error => { console.error(error.stack || error); process.exitCode = 2; });
