const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { createWriterAdmissionBoundary } = require('./writer-admission-boundary.cjs');
const { createCatalogAdmissionBoundary, catalogAdmissionObservation } = require('./catalog-admission-boundary.cjs');
const { createLibraryTranslationScanBoundary, libraryScanObservation } = require('./library-translation-scan-boundary.cjs');
const { createProfileTranslationScanBoundary, profileScanObservation } = require('./profile-translation-scan-boundary.cjs');
const repo = path.resolve(__dirname, '../../../..');
const work = path.resolve(repo, '../work');
fs.mkdirSync(work, { recursive: true });
const output = process.env.PROFILE_LIBRARY_BUDGET_OUTPUT_ROOT || fs.mkdtempSync(path.join(work, 'm07-profile-budget-controls-'));
fs.mkdirSync(output, { recursive: true });
const nativeRequire = createRequire(path.join(repo, 'package.json'));
const { createClient } = nativeRequire('@supabase/supabase-js');
const { isRedirectError } = nativeRequire('next/dist/client/components/redirect-error');
const { getURLFromRedirectError } = nativeRequire('next/dist/client/components/redirect');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const specifications = {
  writer: { file: 'writer-batch-budget-cap.cjs', hash: '42546f807423531e30fdc7491e73f0096f5b7cdb88e5b870152d256d269787f3', prefix: 'PROFILE_BUDGET', type: 'writer_biography', cap: 3 },
  library: { file: 'library-batch-budget-cap.cjs', hash: '2918441e4e14361cc8f4ff7571bf488e2f0876c2000152ef0e64eef57675badf', prefix: 'LIBRARY_BUDGET', type: 'literary_work', cap: 4 },
  country: { file: 'country-batch-budget-cap.cjs', hash: 'e067f3c14ec361766c7cd704edbb2104813d3188d22c940470d0360a5167f98d', prefix: 'COUNTRY_BUDGET', type: 'country', cap: 2 },
};
let serial = 0;
const checks = [], traces = [], sources = new Map();

// Reuse only the frozen fixture's synthetic records, SDK transport and actual
// module loader. Its main/assertions stay untouched in the separate SAME suite.
// Current controls always force canonical repository sources; no BEFORE override.
function setup(domain, options = {}) {
  const spec = specifications[domain], filename = path.join(__dirname, spec.file);
  const original = fs.readFileSync(filename, 'utf8');
  assert.equal(sha(Buffer.from(original)), spec.hash);
  const boundary = original.indexOf('\nasync function main()');
  assert.ok(boundary > 0, 'Frozen declaration boundary exists');
  const names = domain === 'writer'
    ? 'rows,writers,catalog,englishText,russian,actorId,stamp,afterStamp,get activeWriter(){return activeWriter;}'
    : domain === 'library' ? 'entries,description,actorId,stamp,laterStamp' : 'countries,beforeCatalog,russian,english,actorId,stamp,laterStamp';
  const env = { [`${spec.prefix}_REPO`]: repo, [`${spec.prefix}_SOURCE_ROOT`]: repo,
    [`${spec.prefix}_OUTPUT_ROOT`]: path.join(output, `case-${++serial}-${domain}`) };
  const runtime = new Function('require', '__dirname', '__filename', 'process',
    original.slice(0, boundary) + `\nreturn {load,mocks,ai,fetchBoundary,calls,wire,runs,writes,builds,graph,sha,${names}};`)(require, __dirname, filename, { env });
  const clock = { now: 0 }, privateCandidates = new Map(), stages = [], audits = [], providerCalls = [];
  const writerAdmission = domain === 'writer' ? createWriterAdmissionBoundary({ actorId: runtime.actorId,
    getOverride(country, writer) { return country === 'russia' ? runtime.rows.get(writer) || null : null; },
    getPrivateCandidate(entity) { return privateCandidates.get(`writer_biography:${entity}`) || null; },
    setPrivateCandidate(entity, draft) { privateCandidates.set(`writer_biography:${entity}`, structuredClone(draft)); stages.push({ protocol: 'writer-operation-finish', draft: structuredClone(draft) }); } }) : null;
  const catalogAdmission = domain === 'writer' ? null : createCatalogAdmissionBoundary({ actorId: runtime.actorId,
    getSeed(type, entity) {
      if (domain === 'library') { const entry = runtime.entries.find(value => value.work.id === entity); return entry ? structuredClone({ work: entry.work, russian: entry.russian, english: entry.english, sources: entry.sources }) : null; }
      const country = runtime.countries.find(value => value.id === entity); return country ? structuredClone({ catalogFields: country.fields, override: country.row }) : null;
    },
    getPrivateCandidate(type, entity) { return privateCandidates.get(`${type}:${entity}`) || null; },
    setPrivateCandidate(type, entity, draft) { privateCandidates.set(`${type}:${entity}`, structuredClone(draft)); stages.push({ protocol: 'catalog-operation-finish', draft: structuredClone(draft) }); } });
  if (writerAdmission && options.unconfirmedJournal) writerAdmission.fault('finish_writer_translation_operation');
  if (catalogAdmission && options.unconfirmedJournal) catalogAdmission.fault('finish_catalog_translation_operation');
  const budgetApi = runtime.load('apps/admin/lib/translation-operation-budget.ts');
  let operation = null, created = 0, writerWarmupOperationIds = new Set(), catalogWarmupOperationIds = new Set();
  {
    const createActualBudget = budgetApi.createTranslationOperationBudget;
    budgetApi.createTranslationOperationBudget = input => {
      operation = createActualBudget({ ...input, now: () => clock.now }); return operation;
    };
    // Alias and relative imports must observe the same actual budget module;
    // only its clock input and observation are controlled.
    runtime.mocks['@/lib/translation-operation-budget'] = budgetApi;
  }
  const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const libraryScans = domain === 'library' ? createLibraryTranslationScanBoundary({ actorId: runtime.actorId, getEntries: () => runtime.entries, catalogServer: catalogAdmission }) : null;
  const profileScans = domain === 'library' ? null : createProfileTranslationScanBoundary({actorId: runtime.actorId, writerServer: writerAdmission, catalogServer: catalogAdmission});
  const fetchBoundary = async (resource, init = {}) => {
    const url = new URL(typeof resource === 'string' ? resource : resource.url);
    assert.equal(url.origin, `https://${domain === 'writer' ? 'profile' : domain}-budget.fixture.invalid`);
    const name = url.pathname.split('/').at(-1), body = init.body ? JSON.parse(init.body) : null;
    if (profileScans?.handles(name)) {
      runtime.wire.push({method: init.method, path: url.pathname, body: structuredClone(body)});
      const admission = writerAdmission || catalogAdmission;
      if (options.unconfirmedJournal && name === 'get_profile_translation_scan' && [...admission.operations.values()].some(item => item.phase === 'finished' && item.calls.length > 0)) return response({code: '57014', message: 'Controlled committed profile parent confirmation unavailable'}, 409);
      return profileScans.fetchRpc(name, body);
    }
    if (libraryScans?.handles(name)) {
      runtime.wire.push({ method: init.method, path: url.pathname, body: structuredClone(body) });
      // The new parent receipt is another real completion-confirmation channel.
      // An unknown-ACK control must withhold it too, never fabricate stale data.
      if (options.unconfirmedJournal && name === 'get_library_translation_scan' && [...catalogAdmission.operations.values()].some(item => item.phase === 'finished' && item.calls.length > 0)) {
        return response({ code: '57014', message: 'Controlled committed parent confirmation read unavailable' }, 409);
      }
      return libraryScans.fetchRpc(name, body);
    }
    if (writerAdmission?.handles(name)) {
      runtime.wire.push({ method: init.method, path: url.pathname, body: structuredClone(body) });
      if (options.unconfirmedJournal && ['reconcile_writer_translation_operation', 'get_writer_translation_operation_artifacts'].includes(name) &&
          [...writerAdmission.operations.values()].some(item => item.phase === 'finished')) {
        return response({ code: '57014', message: 'Controlled committed writer receipt readback unavailable' }, 409);
      }
      return writerAdmission.fetchRpc(name, body);
    }
    if (catalogAdmission?.handles(name)) {
      runtime.wire.push({ method: init.method, path: url.pathname, body: structuredClone(body) });
      if (options.unconfirmedJournal && ['reconcile_catalog_translation_operation', 'get_catalog_translation_operation_artifacts'].includes(name) &&
          [...catalogAdmission.operations.values()].some(item => item.phase === 'finished')) {
        return response({ code: '57014', message: 'Controlled committed catalog receipt readback unavailable' }, 409);
      }
      return catalogAdmission.fetchRpc(name, body);
    }
    if (url.pathname.includes('/rpc/') && name === 'profile_translation_budget_ready') {
      runtime.wire.push({ method: init.method, path: url.pathname, body: structuredClone(body) });
      if (options.readiness === 'missing') return response({ code: 'PGRST202', message: 'Synthetic capability RPC is missing' }, 404);
      return response(options.readiness === 'false' ? false : options.readiness === 'malformed' ? { ready: true } : true);
    }
    if (url.pathname.includes('/rpc/') && name === 'get_premium_translation_working_draft') {
      runtime.wire.push({ method: init.method, path: url.pathname, body: structuredClone(body) });
      return response({ schemaVersion: 1, entityType: body.p_entity_type, entityId: body.p_entity_id,
        draft: privateCandidates.get(`${body.p_entity_type}:${body.p_entity_id}`) || null });
    }
    if (url.pathname.includes('/rpc/') && name === 'stage_premium_translation_working_draft') {
      const key = `${body.p_entity_type}:${body.p_entity_id}`;
      assert.equal(privateCandidates.has(key), false, 'No pending candidate overwritten');
      const draft = { id: `12345678-1234-4234-8234-${String(++created).padStart(12, '0')}`, version: 1,
        entityType: body.p_entity_type, entityId: body.p_entity_id, targetLocale: 'en', humanReview: 'pending',
        sourceHash: body.p_source_hash, candidateHash: sha(JSON.stringify(body)), sourceSnapshot: body.p_source_snapshot,
        sourceRevision: body.p_source_revision, targetRevision: body.p_target_revision, payload: body.p_payload,
        provenance: body.p_provenance, createdAt: new Date().toISOString(), createdBy: runtime.actorId };
      privateCandidates.set(key, structuredClone(draft)); stages.push(structuredClone(body));
      runtime.wire.push({ method: init.method, path: url.pathname, body: structuredClone(body) });
      return response({ schemaVersion: 1, entityType: draft.entityType, entityId: draft.entityId, draft });
    }
    if (name === 'admin_audit_log' && init.method === 'POST') { audits.push(structuredClone(body)); return response(null, 201); }
    const result = await runtime.fetchBoundary(resource, init);
    if (options.unconfirmedJournal && name === 'record_translation_sync_run') return response(null);
    return result;
  };
  const sdk = createClient(`https://${domain === 'writer' ? 'profile' : domain}-budget.fixture.invalid`, 'synthetic-no-auth-session',
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchBoundary } });
  runtime.mocks['@/lib/supabase/server'] = { async createServerSupabaseClient() { return sdk; } };
  if (domain === 'country') runtime.mocks['@/lib/editorial-catalog'] = { async loadEditorialCatalog() {
    return { version: 1, countries: structuredClone(runtime.countries.map(({ id, label, fields }) => ({ id, label, fields }))) };
  } };
  if (domain !== 'library') {
    const actualCatalog = runtime.load('apps/admin/lib/editorial-catalog.ts'), boundary = runtime.mocks['@/lib/editorial-catalog'];
    actualCatalog.loadEditorialCatalog = boundary.loadEditorialCatalog;
    runtime.mocks['./editorial-catalog'] = {...actualCatalog, ...boundary};
  }
  runtime.mocks['@opennextjs/cloudflare'] = { getCloudflareContext() {
    if (options.stopBeforeFirstCall && operation?.snapshot().attempts > 0 && operation.snapshot().providerCalls === 0) clock.now = 300_000;
    return { env: { AI: runtime.ai } };
  } };
  runtime.ai.run = async (model, input) => {
    const content = JSON.parse(input.messages[1].content), source = content.SOURCE_DATA;
    const index = domain === 'writer' ? runtime.writers.findIndex(writer => writer.id === runtime.activeWriter)
      : domain === 'library' ? runtime.entries.findIndex(entry => entry.russian.title === source.russianTitle)
        : runtime.countries.findIndex(country => country.fields.name === source.name);
    assert.ok(index >= 0, 'Actual domain source identifies a synthetic candidate');
    const pass = Object.hasOwn(content, 'INVALID_DRAFT_TRANSLATION') ? 'repair' : Object.hasOwn(content, 'DRAFT_TRANSLATION') ? 'review' : 'translation';
    const call = { index, model, pass, source: structuredClone(source) }; providerCalls.push(call);
    const number = providerCalls.length;
    if (options.providerFailureAt === number) throw new Error('Synthetic accepted provider transport interruption');
    if (options.deadlineAfterTranslation && pass === 'translation') clock.now = 300_000;
    if (options.deadlineAfterReview && pass === 'review') clock.now = 300_001;
    if (options.conflicts && pass === 'review') {
      if (domain === 'writer') runtime.rows.get(runtime.writers[index].id).updated_at = runtime.afterStamp;
      else if (domain === 'library') runtime.entries[index].russian.updated_at = runtime.laterStamp;
      else runtime.countries[index].row.updated_at = runtime.laterStamp;
    }
    const invalid = options.invalidEveryPass || (options.repairBoth ? pass !== 'repair' : options.invalidAt === number);
    const value = invalid ? { invalid: true } : domain === 'writer' ? { text: runtime.englishText }
      : domain === 'library' ? { description: runtime.description } : runtime.countries[index].generated;
    return { id: `controlled-budget-${number}`, response: JSON.stringify(value), usage: { prompt_tokens: 10, completion_tokens: 10 } };
  };
  const identity = index => domain === 'writer' ? `russia:${runtime.writers[index].id}`
    : domain === 'library' ? runtime.entries[index].work.id : runtime.countries[index].id;
  const helper = (index, budget) => domain === 'writer'
    ? runtime.load('apps/admin/lib/auto-translate-writer-biography.ts').ensureWriterEnglishBiography({ supabase: sdk, actorId: runtime.actorId,
      countryId: 'russia', writerId: runtime.writers[index].id, sourceFields: runtime.writers[index].fields, runtimeApproved: true, operationBudget: budget })
    : domain === 'library' ? runtime.load('apps/admin/lib/auto-translate-literary-work-safe.ts').ensureLiteraryWorkEnglishTranslation({ supabase: sdk,
      actorId: runtime.actorId, workId: runtime.entries[index].work.id, runtimeApproved: true, operationBudget: budget })
      : runtime.load('apps/admin/lib/auto-translate-country-profile.ts').ensureCountryEnglishProfile({ supabase: sdk, actorId: runtime.actorId,
        countryId: runtime.countries[index].id, sourceFields: runtime.countries[index].fields, runtimeApproved: true, operationBudget: budget });
  const budget = (limits = {}) => budgetApi.createTranslationOperationBudget({ maxAttempts: 3, maxProviderCalls: 12,
    deadlineMs: 100, ...limits, now: () => clock.now });
  const canonical = (ignoreRevision = false) => {
    const data = structuredClone(domain === 'writer' ? { overrides: [...runtime.rows.values()], catalog: runtime.catalog }
      : domain === 'library' ? runtime.entries : runtime.countries);
    if (ignoreRevision) (domain === 'writer' ? data.overrides : data).forEach(row => {
      if (domain === 'writer') delete row.updated_at; else if (domain === 'library') delete row.russian.updated_at; else delete row.row.updated_at;
    });
    return data;
  };
  const action = async () => {
    if (writerAdmission) writerWarmupOperationIds = new Set(writerAdmission.operations.keys());
    if (catalogAdmission) catalogWarmupOperationIds = new Set(catalogAdmission.operations.keys());
    try {
      const actions = runtime.load(domain === 'country' ? 'apps/admin/app/(dashboard)/translations/country-actions.ts' : 'apps/admin/app/(dashboard)/translations/actions.ts');
      await (domain === 'writer' ? actions.translatePremiumWriterBatchAction : domain === 'library' ? actions.translatePremiumLibraryBatchAction : actions.translatePremiumCountryBatchAction)(new FormData());
      throw new Error('Actual action must redirect');
    } catch (error) { assert.ok(isRedirectError(error), error.stack); return new URL(getURLFromRedirectError(error), 'https://fixture.invalid').searchParams; }
  };
  function writerObservation() {
    assert.ok(writerAdmission); assert.deepEqual(writerAdmission.errors, []);
    const allPaid = [...writerAdmission.operations.values()];
    const paid = allPaid.filter(item => item.phase === 'finished' && !writerWarmupOperationIds.has(item.operationId));
    const lastCursor = paid.at(-1)?.resumeCursor || runtime.runs.at(-1)?.p_resume_cursor || {};
    const metrics = operation.snapshot();
    return profileScanObservation(profileScans, { observerProtocol: 'Actual FINISH receipts plus free-only aggregates; no fabricated legacy RPC',
      p_items: [...runtime.runs.flatMap(run => run.p_items), ...paid.map(item => ({ entityType: 'writer', entityId: item.entityId }))],
      p_outcomes: [...runtime.runs.flatMap(run => run.p_outcomes), ...paid.map(item => ({ status: item.result.state === 'translated' ? 'succeeded' : item.result.state === 'failed' ? 'dead_letter' : item.result.state }))],
      p_resume_cursor: { writerCursor: lastCursor.writerCursor ?? 0, writerBudget: { version: 1, ...metrics, stopReason: operation.exhaustedReason() } },
      rawPaidOperations: structuredClone(paid), rawWarmupOperationIds: [...writerWarmupOperationIds], rawAllPaidOperations: structuredClone(allPaid),
      rawFreeAggregates: structuredClone(runtime.runs) });
  }
  const catalogObservation = () => domain === 'library' ? libraryScanObservation(libraryScans, catalogAdmission, runtime.runs, { kind: domain, budget: operation, excludeOperationIds: catalogWarmupOperationIds }) : profileScanObservation(profileScans, catalogAdmissionObservation(catalogAdmission, runtime.runs, { kind: domain, budget: operation, excludeOperationIds: catalogWarmupOperationIds }));
  return { ...runtime, domain, spec, clock, privateCandidates, stages, audits, providerCalls, helper, budget, canonical, action, identity, writerAdmission, writerObservation, catalogAdmission, catalogObservation,
    get operation() { return operation; } };
}

function preserve(view, before, ignoreRevision = false) {
  assert.deepEqual(view.canonical(ignoreRevision), before, 'All canonical authored fields and rights remain exact');
  assert.equal(view.writes.length, 0); assert.equal(view.builds.length, 0);
  for (const entry of view.graph.values()) {
    assert.equal(sha(fs.readFileSync(path.join(repo, entry.module))), entry.sha256, 'Current source drift');
    sources.set(entry.module, entry);
  }
}
async function check(domain, name, body) {
  try { const result = await body(); checks.push({ domain, name, pass: true }); traces.push({ domain, name, ...result }); }
  catch (error) { checks.push({ domain, name, pass: false, error: error.stack || String(error) }); }
}
function expand(view) {
  for (let index = view.domain === 'country' ? 3 : 5; index < 8; index += 1) {
    const suffix = String(index + 1).padStart(12, '0');
    if (view.domain === 'writer') {
      const writer = structuredClone(view.writers[0]); writer.id = `budget_writer_${index}`; view.writers.push(writer);
      view.rows.set(writer.id, { id: `bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`, country_id: 'russia', writer_id: writer.id,
        fields: { rights: { preserve: true }, editorialMemo: `Unchanged override ${index}` }, updated_at: view.stamp });
    } else if (view.domain === 'library') {
      const entry = structuredClone(view.entries[0]);
      entry.work.id = `bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`; entry.work.title = `Synthetic work ${index}`;
      entry.russian.id = `cccccccc-cccc-4ccc-8ccc-${suffix}`; entry.russian.work_id = entry.work.id; entry.russian.title = `Русское название ${index}`;
      entry.english.id = `dddddddd-dddd-4ddd-8ddd-${suffix}`; entry.english.work_id = entry.work.id; entry.english.title = `Exact Verified English Title ${index}`;
      entry.sources[0].id = `eeeeeeee-eeee-4eee-8eee-${suffix}`; entry.sources[0].work_id = entry.work.id;
      entry.sources[0].source_url = `https://bibliography.fixture.invalid/verified-title-${index}`;
      entry.english.source_urls = [entry.sources[0].source_url];
      entry.english.metadata.premiumTranslation.bibliographicTitle = { value: entry.english.title, sourceUrl: entry.sources[0].source_url };
      view.entries.push(entry);
    } else {
      const country = structuredClone(view.countries[0]); country.id = `budget-country-${index}`; country.label = `Synthetic country ${index}`;
      country.fields.name = `Исландия ${index}`; country.fields.id = country.id; country.generated.name = `Iceland ${index}`;
      country.row.id = `bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`; country.row.country_id = country.id; country.row.fields.name = country.fields.name;
      country.row.fields.translations.en.fields = structuredClone(country.generated); view.countries.push(country);
    }
  }
}
async function seedCheap(view) {
  // Derive current/pending receipts through real helper validation and private
  // adapters. Setup provider calls are retained separately from measured calls.
  for (const index of [1, 2]) assert.equal((await view.helper(index, view.budget())).state, 'translated');
  const current = view.privateCandidates.get(`${view.spec.type}:${view.identity(1)}`);
  view.privateCandidates.delete(`${view.spec.type}:${view.identity(1)}`);
  if (view.domain === 'writer') {
    const ru = view.writers[1].fields.biographyTranslations.ru;
    view.rows.get(view.writers[0].id).fields.biographyTranslations = { ru: structuredClone(ru), en: { ...structuredClone(ru), locale: 'en', text: view.englishText, method: 'human-translation' } };
    view.rows.get(view.writers[1].id).fields.biographyTranslations = { ru: structuredClone(ru), en: { ...structuredClone(ru), locale: 'en',
      text: view.englishText, method: 'machine-translation', status: 'reviewed', translatedFromLocale: 'ru', sourceTextRights: 'project-original',
      translationMeta: { sourceHash: current.sourceHash, model: current.provenance.translatorModel,
        reviewerModel: current.provenance.reviewerModel, generatedAt: new Date(current.provenance.generatedAt).toISOString() } } };
  } else if (view.domain === 'library') {
    view.entries[0].english.translation_method = 'human-translation';
    view.entries[1].english.editorial_status = 'reviewed'; view.entries[1].english.metadata.premiumTranslation.sourceHash = current.sourceHash;
  } else {
    view.countries[0].row.fields.translations.en.method = 'human-translation';
    view.countries[1].row.fields.translations.en.sourceHash = current.sourceHash;
  }
  return current;
}

async function main() {
  for (const domain of Object.keys(specifications)) {
    for (const readiness of ['missing', 'false', 'malformed']) {
      await check(domain, `Budget migration readiness ${readiness} fails closed before any paid work`, async () => {
        const view = setup(domain, { readiness }), before = view.canonical(), params = await view.action();
        assert.equal(params.get('errorCode'), readiness === 'malformed' ? 'database_read_failed' : 'translation_migration_required'); assert.equal(params.get('success'), null);
        assert.equal(view.providerCalls.length, 0); assert.equal(view.stages.length, 0); assert.equal(view.privateCandidates.size, 0);
        assert.equal(view.audits.length, 0); assert.equal(view.runs.length, 0); preserve(view, before);
        return { params: Object.fromEntries(params), paidRequests: 0, privateWrites: 0, journalWrites: 0 };
      });
    }
    await check(domain, 'Cheap manual current and pending records do not consume the paid batch cap', async () => {
      const view = setup(domain); expand(view); await seedCheap(view);
      const setupCalls = view.providerCalls.length, before = view.canonical(true), pending = structuredClone(view.privateCandidates.get(`${view.spec.type}:${view.identity(2)}`));
      const originalRun = view.ai.run;
      view.ai.run = async (model, input) => { const result = await originalRun(model, input); const body = JSON.parse(input.messages[1].content);
        if (Object.hasOwn(body, 'DRAFT_TRANSLATION')) { const index = view.providerCalls.at(-1).index;
          if (domain === 'writer') view.rows.get(view.writers[index].id).updated_at = view.afterStamp;
          else if (domain === 'library') view.entries[index].russian.updated_at = view.laterStamp;
          else view.countries[index].row.updated_at = view.laterStamp; } return result; };
      await view.action(); const run = domain === 'writer' ? view.writerObservation() : view.catalogObservation(), metrics = run.p_resume_cursor[`${domain}Budget`];
      assert.equal(view.providerCalls.length - setupCalls, view.spec.cap * 2); assert.equal(metrics.attempts, view.spec.cap);
      assert.equal(metrics.providerCalls, view.spec.cap * 2); assert.equal(metrics.stopReason, 'attempt-limit');
      assert.equal(run.p_items.length, 3 + view.spec.cap); assert.equal(run.p_resume_cursor[`${domain}Cursor`], 3 + view.spec.cap);
      assert.deepEqual(view.providerCalls.slice(setupCalls).map(call => call.index), Array.from({ length: view.spec.cap }, (_, index) => [index + 3, index + 3]).flat());
      assert.deepEqual(view.privateCandidates.get(`${view.spec.type}:${view.identity(2)}`), pending);
      preserve(view, before, true); return { setupProviderCalls: setupCalls, measuredProviderCalls: metrics.providerCalls, metrics, run };
    });
    await check(domain, 'Domain repairs and final admitted attempt use one shared four-call budget', async () => {
      const view = setup(domain, { repairBoth: true }), before = view.canonical(), budget = view.budget({ maxAttempts: 1, maxProviderCalls: 4 });
      const result = await view.helper(0, budget); assert.equal(result.state, 'translated');
      assert.deepEqual(view.providerCalls.map(call => call.pass), ['translation', 'repair', 'review', 'repair']);
      assert.equal(view.privateCandidates.size, 1); assert.equal(result.publication, 'unchanged'); assert.equal(result.humanReview, 'pending');
      const next = await view.helper(1, budget); assert.deepEqual(next.budgetStop, { reason: 'provider-call-limit', attemptStarted: false, providerCalls: 0 });
      assert.equal(next.state, 'skipped'); assert.deepEqual(budget.snapshot(), { attempts: 1, providerCalls: 4, maxAttempts: 1, maxProviderCalls: 4, elapsedMs: 0, deadlineMs: 100, stopped: false });
      preserve(view, before); return { result, next, calls: view.providerCalls, snapshot: budget.snapshot() };
    });
    await check(domain, 'A shared call cap across candidates blocks a repair without staging incomplete output', async () => {
      if (domain === 'writer') {
        const view = setup(domain, { invalidAt: 3 }), before = view.canonical(), budget = view.budget({ maxAttempts: 2, maxProviderCalls: 3 });
        assert.equal((await view.helper(0, budget)).state, 'translated'); const result = await view.helper(1, budget);
        assert.equal(result.state, 'unconfirmed'); assert.deepEqual(result.budgetStop, { reason: 'provider-call-limit', attemptStarted: true, providerCalls: 1 });
        assert.equal(view.providerCalls.length, 3); assert.equal(view.privateCandidates.size, 1); assert.equal(view.stages.length, 1);
        const incomplete = [...view.writerAdmission.operations.values()].at(-1); assert.equal(incomplete.candidate, null); assert.ok(incomplete.calls[0].artifact);
        preserve(view, before); return { result, calls: view.providerCalls, snapshot: budget.snapshot(), actualPartialOperation: incomplete };
      }
      const view = setup(domain, { invalidAt: 3 }), before = view.canonical(), budget = view.budget({ maxProviderCalls: 3 });
      assert.equal((await view.helper(0, budget)).state, 'translated'); const result = await view.helper(1, budget);
      assert.equal(result.state, 'unconfirmed'); assert.deepEqual(result.budgetStop, { reason: 'provider-call-limit', attemptStarted: true, providerCalls: 1 });
      assert.equal(view.providerCalls.length, 3); assert.equal(view.privateCandidates.size, 1); assert.equal(view.stages.length, 1);
      const incomplete = [...view.catalogAdmission.operations.values()].at(-1); assert.equal(incomplete.candidate, null); assert.ok(incomplete.calls[0].artifact);
      preserve(view, before); return { result, calls: view.providerCalls, snapshot: budget.snapshot() };
    });
    await check(domain, domain === 'writer' ? 'Confirmed invalid responses allow a bounded helper retry without repeating unknown requests' : 'Confirmed invalid responses allow a bounded helper retry without repeating unknown requests', async () => {
      // Superseded three domain instances: ordinary same-source observation cannot grant
      // another paid attempt after acknowledged invalid translation+repair responses.
      const view = setup(domain, { invalidEveryPass: true }), before = view.canonical(), budget = view.budget({ maxProviderCalls: 3 });
      const first = await view.helper(0, budget);
      assert.equal(first.state, 'unconfirmed'); assert.equal(first.errorCode, 'translation_retry_pending');
      const admission = domain === 'writer' ? view.writerAdmission : view.catalogAdmission;
      const beforeRepeat = {
        operations: structuredClone([...admission.operations.values()]),
        calls: structuredClone(view.providerCalls), budget: budget.snapshot(),
        wireLength: view.wire.length, audits: structuredClone(view.audits),
        stages: structuredClone(view.stages), writes: structuredClone(view.writes),
        builds: structuredClone(view.builds), privateCandidates: structuredClone([...view.privateCandidates]),
      };
      assert.equal(beforeRepeat.operations.length, 1);
      const paid = beforeRepeat.operations[0];
      assert.notEqual(paid.phase, 'finished'); assert.equal(paid.candidate, null); assert.equal(paid.result, null);
      assert.equal(first.operation.operationId, paid.operationId);
      assert.equal(paid.calls.length, 2);
      assert.deepEqual(paid.calls.map(call => call.pass), ['translation', 'repair']);
      assert.ok(paid.calls.every(call => call.response !== null && call.artifact !== null && call.artifact.version === 1));
      assert.equal(beforeRepeat.calls.length, 2);
      assert.deepEqual(beforeRepeat.budget, { attempts: 1, providerCalls: 2, maxAttempts: 3, maxProviderCalls: 3, elapsedMs: 0, deadlineMs: 100, stopped: false });
      assert.equal(view.stages.length, 0); assert.equal(view.privateCandidates.size, 0);
      const result = await view.helper(0, budget);
      assert.equal(result.state, 'unconfirmed'); assert.equal(result.errorCode, 'translation_retry_pending');
      assert.equal(result.operation.operationId, paid.operationId);
      assert.deepEqual([...admission.operations.values()], beforeRepeat.operations, 'Original admitted operation, raw acknowledged bodies and configuration remain exact');
      assert.deepEqual(view.providerCalls, beforeRepeat.calls, 'Ordinary repeated helper adds no paid provider pass');
      assert.deepEqual(budget.snapshot(), beforeRepeat.budget, 'Shared attempts/calls/deadline are not reset or consumed by free observation');
      const repeatWire = view.wire.slice(beforeRepeat.wireLength);
      assert.equal(repeatWire.filter(call => /\/begin_(?:writer|catalog)_translation_operation$/u.test(call.path)).length, 0);
      assert.equal(repeatWire.filter(call => /\/record_(?:writer|catalog)_translation_operation_dispatch$/u.test(call.path)).length, 0);
      assert.deepEqual(view.audits, beforeRepeat.audits); assert.deepEqual(view.stages, beforeRepeat.stages);
      assert.deepEqual(view.writes, beforeRepeat.writes); assert.deepEqual(view.builds, beforeRepeat.builds);
      assert.deepEqual([...view.privateCandidates], beforeRepeat.privateCandidates);
      preserve(view, before);
      return { first, result, beforeRepeat, repeatWire, calls: view.providerCalls, snapshot: budget.snapshot(),
        actualPaidOperations: [...admission.operations.values()],
        supersededIntent: 'Three original domain controls expected terminal failed plus another automatic paid attempt; required acknowledged-partial hold supersedes that authority.' };
    });
    await check(domain, 'Deadline after attempt admission but before first request retains the candidate cursor', async () => {
      const view = setup(domain, { stopBeforeFirstCall: true }), before = view.canonical(), params = await view.action();
      assert.equal(view.providerCalls.length, 0); assert.equal(view.operation.snapshot().attempts, 1); assert.equal(view.operation.snapshot().providerCalls, 0);
      assert.equal(params.get(`${domain}Cursor`), '0'); assert.equal(view.runs.length, 0); assert.equal(view.stages.length, 0); assert.equal(view.audits.length, 0);
      assert.doesNotMatch(params.get('success') || '', /сохранена позиция/iu);
      preserve(view, before); return { params: Object.fromEntries(params), snapshot: view.operation.snapshot() };
    });
    await check(domain, domain === 'writer' ? 'Deadline after a confirmed raw translation retains incomplete output and the current cursor' : 'Deadline after a confirmed raw translation retains incomplete output and the current cursor', async () => {
      if (domain === 'writer') {
        const view = setup(domain, { deadlineAfterTranslation: true }), before = view.canonical(), params = await view.action();
        assert.equal(view.providerCalls.length, 1); assert.equal(view.stages.length, 0); assert.equal(view.runs.length, 0);
        const paid = [...view.writerAdmission.operations.values()]; assert.equal(paid.length, 1); assert.notEqual(paid[0].phase, 'finished');
        assert.ok(paid[0].calls[0].artifact); assert.equal(paid[0].candidate, null); assert.equal(params.get('writerCursor'), '0');
        preserve(view, before); return { params: Object.fromEntries(params), actualPaidOperation: paid[0], budget: view.operation.snapshot() };
      }
      const view = setup(domain, { deadlineAfterTranslation: true }), before = view.canonical(), params = await view.action();
      const run = view.catalogObservation(), metrics = run.p_resume_cursor[`${domain}Budget`];
      assert.equal(view.providerCalls.length, 1); assert.equal(view.stages.length, 0); assert.equal(run.p_items.length, 0); assert.equal(view.runs.length, 0);
      const paid = [...view.catalogAdmission.operations.values()]; assert.equal(paid.length, 1); assert.notEqual(paid[0].phase, 'finished');
      assert.ok(paid[0].calls[0].artifact); assert.equal(paid[0].candidate, null); assert.equal(params.get(`${domain}Cursor`), '0');
      assert.equal(metrics.providerCalls, 1); assert.equal(metrics.attempts, 1); assert.equal(metrics.stopReason, 'deadline');
      preserve(view, before); return { run, calls: view.providerCalls, metrics };
    });
    await check(domain, 'Accepted final review persists privately after the deadline and stops the next candidate', async () => {
      const view = setup(domain, { deadlineAfterReview: true }), before = view.canonical(); await view.action();
      const run = domain === 'writer' ? view.writerObservation() : view.catalogObservation(), metrics = run.p_resume_cursor[`${domain}Budget`];
      assert.equal(view.providerCalls.length, 2); assert.equal(view.stages.length, 1); assert.equal(view.privateCandidates.size, 1);
      assert.equal(run.p_items.length, 1); assert.equal(run.p_outcomes[0].status, 'succeeded'); assert.equal(run.p_resume_cursor[`${domain}Cursor`], 1);
      assert.equal(metrics.stopReason, 'deadline'); assert.equal(metrics.providerCalls, 2);
      preserve(view, before); return { run, calls: view.providerCalls, metrics };
    });
    await check(domain, domain === 'writer' ? 'Unconfirmed paid-operation acknowledgement retains private output without committing its cursor' : 'Unconfirmed paid-operation acknowledgement retains private output without committing its cursor', async () => {
      if (domain === 'writer') {
        const view = setup(domain, { deadlineAfterReview: true, unconfirmedJournal: true }), before = view.canonical(), params = await view.action();
        assert.equal(view.providerCalls.length, 2); assert.equal(view.privateCandidates.size, 1); assert.equal(view.runs.length, 0);
        assert.ok(['translation_retry_unconfirmed', 'translation_retry_pending'].includes(params.get('errorCode')));
        assert.match(params.get('success') || '', /приостановлен/iu);
        assert.doesNotMatch(params.get('success') || '', /сохранена позиция/iu);
        assert.notEqual(params.get('writerCursor'), '1'); preserve(view, before);
        return { params: Object.fromEntries(params), actualPaidOperations: [...view.writerAdmission.operations.values()] };
      }
      const view = setup(domain, { deadlineAfterReview: true, unconfirmedJournal: true }), before = view.canonical(), params = await view.action();
      assert.equal(view.providerCalls.length, 2); assert.equal(view.privateCandidates.size, 1); assert.equal(view.runs.length, 0);
      assert.ok(['translation_retry_unconfirmed', 'translation_retry_pending'].includes(params.get('errorCode')));
      assert.match(params.get('success') || '', /приостановлен/iu); assert.doesNotMatch(params.get('success') || '', /сохранена позиция/iu);
      assert.notEqual(params.get(`${domain}Cursor`), '1'); preserve(view, before);
      return { params: Object.fromEntries(params), acceptedPrivateCandidates: view.privateCandidates.size, actualPaidOperations: [...view.catalogAdmission.operations.values()] };
    });
  }
  const report = { sourceRoot: repo, currentSourceOnly: true, unchanged: [...sources.values()].every(entry => sha(fs.readFileSync(path.join(repo, entry.module))) === entry.sha256),
    checks, traces, sources: [...sources.values()], boundaries: ['Actual root actions, domain safe/inner helpers, validators, premium repair/review algorithms, budget, private DTO/run adapters and installed SDK execute.',
      'Only synthetic Auth/catalog/PostgREST transport, Cloudflare binding and the budget factory clock input are controlled. No helper/premium algorithm is stubbed.',
      'Warm-up calls used to construct current/pending inputs are separately retained and excluded only from explicitly measured operation windows. No billing claim, real provider/network/Auth/DB/browser/production call.'] };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  process.exitCode = checks.every(check => check.pass) ? 0 : 1;
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 2; });
