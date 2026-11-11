const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { createWriterAdmissionBoundary } = require('./writer-admission-boundary.cjs');
const { createProfileTranslationScanBoundary, freshScanTriggerProof } = require('./profile-translation-scan-boundary.cjs');
const repo = process.env.WRITER_ADMISSION_REPO || path.resolve(__dirname, '../../../..');
const nativeRequire = createRequire(path.join(repo, 'package.json'));
const { createClient } = nativeRequire('@supabase/supabase-js');
const { isRedirectError } = nativeRequire('next/dist/client/components/redirect-error');
const { getURLFromRedirectError } = nativeRequire('next/dist/client/components/redirect');
const { unzipSync } = nativeRequire('fflate');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const archivePath = path.join(repo, 'docs/admin-r3-evidence/2026-10-29-profile-budgets/next-writer-admission-before.zip');
const archiveBytes = fs.readFileSync(archivePath);
assert.equal(sha(archiveBytes), '44eceea641f3b19178a24b0824fa14b6adef0c77f4933db038d9a2404e498949');
const archived = unzipSync(archiveBytes), supportBytes = Buffer.from(archived['frozen-writer-budget-fixture.cjs']);
assert.equal(sha(supportBytes), '1b5f9959c94b1a9ab3e80cb7df306defe9b72008be6c96b68d011efd68e2a22d');
const sourceRoot = process.env.WRITER_ADMISSION_SOURCE_ROOT || repo;
const output = process.env.WRITER_ADMISSION_OUTPUT_ROOT || fs.mkdtempSync(path.join(path.resolve(repo, '../work'), 'writer-admission-current-'));
fs.mkdirSync(output, { recursive: true });
const sources = new Map(), checks = [], traces = [];
let setupSerial = 0;

function setup(options = {}) {
  const outRoot = path.join(output, `scenario-${++setupSerial}`);
  const original = supportBytes.toString(), boundary = original.indexOf('\nasync function main()');
  const env = { PROFILE_BUDGET_REPO: repo, PROFILE_BUDGET_SOURCE_ROOT: sourceRoot, PROFILE_BUDGET_OUTPUT_ROOT: outRoot };
  const runtime = new Function('require', '__dirname', '__filename', 'process', original.slice(0, boundary) +
    '\nreturn {load,mocks,ai,fetchBoundary,calls,wire,runs,writes,builds,revalidations,graph,rows,writers,catalog,englishText,russian,actorId,stamp,afterStamp,get activeWriter(){return activeWriter;}};')
    (require, __dirname, path.join(__dirname, 'frozen-writer-budget-fixture.cjs'), { env });
  const privateCandidates = new Map(), stages = [], audits = [], timeline = [], providerCalls = [], operationsObserved = [];
  const clock = { now: 0 }, budgets = [];
  runtime.catalog.countries[0].writers.splice(options.candidates || 2);
  if (!options.noManual && runtime.catalog.countries[0].writers[1]) {
    const manual = runtime.rows.get(runtime.writers[1].id);
    manual.fields.biographyTranslations = { ru: structuredClone(runtime.russian), en: {
      ...structuredClone(runtime.russian), locale: 'en', text: runtime.englishText, method: 'human-translation',
      manualRights: { preserve: 'Exact manual EN rights' } } };
  }
  // Nonzero-position controls establish actual cheap observations in a fresh
  // manifest; a legacy numeric token never authorizes skipping identities.
  if (options.startCursor > 0) for (let index = 0; index < options.startCursor; index++) {
    const row = runtime.rows.get(runtime.writers[index].id);
    row.fields.biographyTranslations = {ru: structuredClone(runtime.russian), en: {...structuredClone(runtime.russian),
      locale: 'en', text: runtime.englishText, method: 'human-translation', manualRights: {preserve: 'Exact manual prefix'}}};
  }
  const server = createWriterAdmissionBoundary({ actorId: runtime.actorId,
    getOverride(country, writer) { return country === 'russia' ? runtime.rows.get(writer) || null : null; },
    getPrivateCandidate(entity) { return privateCandidates.get(`writer_biography:${entity}`) || null; },
    setPrivateCandidate(entity, draft) { privateCandidates.set(`writer_biography:${entity}`, structuredClone(draft)); } });
  const profileScans = createProfileTranslationScanBoundary({actorId: runtime.actorId, writerServer: server});
  for (const name of options.lostAcks || []) server.fault(name);
  const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  let phase = 'setup', providerSerial = 0, paidRunSerial = 0, finalResponseFaulted = false, helperInvocations = 0, rawResponseLostAt = null;
  const fetchBoundary = async (resource, init = {}) => {
    const url = new URL(typeof resource === 'string' ? resource : resource.url), name = url.pathname.split('/').at(-1);
    assert.equal(url.origin, 'https://profile-budget.fixture.invalid');
    const method = init.method || 'GET', body = init.body ? JSON.parse(init.body) : null;
    timeline.push({ phase, event: 'sdk-boundary', method, name });
    if (profileScans.handles(name)) {runtime.wire.push({method, path: url.pathname, body: structuredClone(body)}); return profileScans.fetchRpc(name, body);}
    if (name === 'premium_machine_translation_ready') return response(true);
    if (name === 'record_writer_translation_operation_dispatch' && profileScans.attachedDispatchBlocked(body.p_operation_id)) return response({code: '42501', message: 'Controlled attached scan stopped'}, 409);
    if (server.handles(name)) {
      runtime.wire.push({ method, path: url.pathname, body: structuredClone(body) });
      if (options.incompleteFirstResponse && rawResponseLostAt === helperInvocations && ['reconcile_writer_translation_operation', 'get_writer_translation_operation_artifacts'].includes(name)) {
        return response({ code: '57014', message: 'Controlled raw response readback unavailable in this invocation' }, 409);
      }
      if (options.incompleteFirstResponse && rawResponseLostAt === null && name === 'record_writer_translation_operation_response') {
        server.fault(name); rawResponseLostAt = helperInvocations;
      }
      if (options.lostFinalResponseAck && !finalResponseFaulted && name === 'record_writer_translation_operation_response' && body.p_metadata.pass === 'review') {
        server.fault(name); finalResponseFaulted = true;
      }
      const result = await server.fetchRpc(name, body);
      if (options.malformedBegin && name === 'begin_writer_translation_operation' && result.ok) {
        const value = await result.json(); return response({ ...value, sourceHash: '0'.repeat(64) });
      }
      if (name === 'finish_writer_translation_operation') operationsObserved.push({ phase, args: structuredClone(body), reply: await result.clone().json() });
      return result;
    }
    if (name === 'get_premium_translation_working_draft') {
      runtime.wire.push({ method, path: url.pathname, body: structuredClone(body) });
      return response({ schemaVersion: 1, entityType: body.p_entity_type, entityId: body.p_entity_id,
        draft: privateCandidates.get(`${body.p_entity_type}:${body.p_entity_id}`) || null });
    }
    if (name === 'stage_premium_translation_working_draft') {
      const draft = { id: '12345678-1234-4234-8234-000000000001', version: 1, entityType: body.p_entity_type,
        entityId: body.p_entity_id, targetLocale: 'en', humanReview: 'pending', sourceHash: body.p_source_hash,
        candidateHash: sha(Buffer.from(JSON.stringify(body))), sourceSnapshot: body.p_source_snapshot, sourceRevision: body.p_source_revision,
        targetRevision: body.p_target_revision, payload: body.p_payload, provenance: body.p_provenance,
        createdAt: new Date().toISOString(), createdBy: runtime.actorId };
      privateCandidates.set(`${draft.entityType}:${draft.entityId}`, structuredClone(draft)); stages.push({ phase, body: structuredClone(body) });
      runtime.wire.push({ method, path: url.pathname, body: structuredClone(body) });
      return response({ schemaVersion: 1, entityType: draft.entityType, entityId: draft.entityId, draft });
    }
    if (name === 'admin_audit_log' && method === 'POST') {
      audits.push(structuredClone(body)); runtime.wire.push({ method, path: url.pathname, body: structuredClone(body) }); return response(null, 201);
    }
    const result = await runtime.fetchBoundary(resource, init);
    if (name === 'record_translation_sync_run') return response(`cccccccc-cccc-4ccc-8ccc-${String(++paidRunSerial).padStart(12, '0')}`);
    return result;
  };
  const sdk = createClient('https://profile-budget.fixture.invalid', 'synthetic-no-auth-session', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchBoundary } });
  runtime.mocks['@/lib/supabase/server'] = { async createServerSupabaseClient() { return sdk; } };
  if (fs.existsSync(path.join(sourceRoot, 'apps/admin/lib/editorial-catalog.ts'))) {
    const actualCatalog = runtime.load('apps/admin/lib/editorial-catalog.ts'), catalogBoundary = runtime.mocks['@/lib/editorial-catalog'];
    actualCatalog.loadEditorialCatalog = catalogBoundary.loadEditorialCatalog;
    runtime.mocks['./editorial-catalog'] = {...actualCatalog, ...catalogBoundary};
  }
  const budgetApi = runtime.load('apps/admin/lib/translation-operation-budget.ts');
  const createActualBudget = budgetApi.createTranslationOperationBudget;
  budgetApi.createTranslationOperationBudget = function(input) {
    const budget = createActualBudget({ ...input, now: () => clock.now }); budgets.push({ input: structuredClone(input), budget }); return budget;
  };
  // Alias and relative imports share this actual module object; only the clock
  // input/factory observation is controlled, never the budget algorithm.
  runtime.mocks['@/lib/translation-operation-budget'] = budgetApi;
  runtime.mocks['@opennextjs/cloudflare'] = { getCloudflareContext() {
    if (options.stopBeforeFirstCall && budgets.at(-1)?.budget.snapshot().attempts > 0 && budgets.at(-1).budget.snapshot().providerCalls === 0) clock.now = 300_000;
    return { env: { AI: runtime.ai } };
  } };
  runtime.ai.run = async (model, input) => {
    const content = JSON.parse(input.messages[1].content), pass = Object.hasOwn(content, 'INVALID_DRAFT_TRANSLATION') ? 'repair'
      : Object.hasOwn(content, 'DRAFT_TRANSLATION') ? 'review' : 'translation';
    const call = { phase, serial: ++providerSerial, writerId: runtime.activeWriter, model, pass,
      source: structuredClone(content.SOURCE_DATA), requestSha256: sha(Buffer.from(JSON.stringify(input))),
      sourceSha256: sha(Buffer.from(JSON.stringify(content.SOURCE_DATA))), acceptedByControlledBoundary: true,
      delivery: options.unknownFirst && providerSerial === 1 ? 'lost-after-acceptance' : 'returned' };
    providerCalls.push(call); timeline.push({ phase, event: 'controlled-provider-accepted', serial: providerSerial, pass });
    if (options.onProvider) await options.onProvider({ call, runtime, server, privateCandidates });
    if (options.unknownFirst && providerSerial === 1) {
      const error = new Error('Controlled provider request timed out after acceptance; response delivery lost'); error.name = 'TimeoutError'; throw error;
    }
    const invalid = options.invalidEveryPass || options.repairBoth && pass !== 'repair';
    return { id: `controlled-admission-${providerSerial}`, response: JSON.stringify(invalid ? { invalid: true } : { text: runtime.englishText }), usage: { prompt_tokens: 10, completion_tokens: 10 } };
  };
  const canonical = () => ({ catalog: structuredClone(runtime.catalog), rows: structuredClone([...runtime.rows.values()]) });
  const actions = runtime.load('apps/admin/app/(dashboard)/translations/actions.ts');
  let writerScanIntent = crypto.randomUUID(), writerWindowJob = null;
  async function action(label = 'batch', invocation = {}) {
    if (invocation.freshScan) {writerScanIntent = crypto.randomUUID(); writerWindowJob = null;}
    phase = label; const countBefore = providerCalls.length, runsBefore = runtime.runs.length;
    let redirect;
    const form = new FormData(); if (options.startCursor !== undefined) form.set('writerCursor', String(options.startCursor));
    if (writerWindowJob) form.set('writerJob', writerWindowJob); else form.set('writerScanIntent', writerScanIntent);
    try { await actions.translatePremiumWriterBatchAction(form); throw new Error('Actual action must redirect'); }
    catch (error) { assert.equal(isRedirectError(error), true, error.stack); redirect = getURLFromRedirectError(error); }
    const params = Object.fromEntries(new URL(redirect, 'https://fixture.invalid').searchParams); if (params.writerJob) writerWindowJob = params.writerJob;
    return { phase, redirect, params, form: Object.fromEntries(form.entries()),
      addedProviderCalls: providerCalls.length - countBefore, newRuns: structuredClone(runtime.runs.slice(runsBefore)), privateCandidates: privateCandidates.size };
  }
  const helper = (index = 0, extra = {}) => { helperInvocations++; return runtime.load('apps/admin/lib/auto-translate-writer-biography.ts').ensureWriterEnglishBiography({ supabase: sdk,
    actorId: runtime.actorId, countryId: 'russia', writerId: runtime.writers[index].id, sourceFields: structuredClone(runtime.writers[index].fields), ...extra }); };
  return { ...runtime, sdk, server, profileScans, privateCandidates, stages, audits, timeline, providerCalls, budgets, clock, canonical, action, helper, operationsObserved };
}

async function check(name, category, body) {
  try { const result = await body(); checks.push({ name, category, pass: true }); traces.push({ name, ...result }); }
  catch (error) { checks.push({ name, category, pass: false, error: error.stack || String(error) }); }
}

async function sameScenario() {
  const view = setup({ unknownFirst: true }), before = view.canonical();
  const first = await view.action('first-action', {freshScan: true}), second = await view.action('second-fresh-action', {freshScan: true});
  const triggerProof = freshScanTriggerProof('writer', first, second);
  assert.equal(first.addedProviderCalls, 1); assert.equal(first.privateCandidates, 0);
  assert.deepEqual(view.canonical(), before); assert.equal(view.writes.length, 0); assert.equal(view.builds.length, 0);
  const graph = [...view.graph.values()].sort((a,b) => a.module.localeCompare(b.module));
  for (const item of graph) { assert.equal(sha(fs.readFileSync(path.join(sourceRoot, item.module))), item.sha256); sources.set(item.module, item); }
  const packages = ['@supabase/supabase-js', 'typescript', 'next', 'zod'].map(name => ({ name, version: JSON.parse(fs.readFileSync(path.join(repo, 'node_modules', name, 'package.json'), 'utf8')).version }));
  const report = { sourceRoot, sources: graph, packages, snapshots: [first, second], providerCalls: view.providerCalls, timeline: view.timeline,
    canonicalBefore: before, canonicalAfter: view.canonical(), canonicalMachineWrites: view.writes.length, publicBuildRequests: view.builds.length, triggerProof,
    executionFailures: 0, operations: [...view.server.operations.values()], operationsObserved: view.operationsObserved, rawLegacyRuns: view.runs,
    adaptation: { originalArchiveSha256: sha(archiveBytes), originalSupportSha256: sha(supportBytes),
      originalContractSha256: sha(Buffer.from(archived['writer-provider-admission.same-contract.cjs'])),
      boundary: 'SDK adds actual new writer RPC effects only when requested; archived BEFORE algorithms continue to call legacy record_translation_sync_run.',
      observer: 'Snapshots count provider-boundary entries and private slot effects without requiring legacy posthoc calls or defect-specific extra passes.' } };
  fs.writeFileSync(path.join(output, 'same-scenario-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return report;
}
module.exports = { setup, sameScenario, check, checks, traces, sources, output, archived, sha, sourceRoot, repo };
if (require.main === module) sameScenario().then(report => console.log(JSON.stringify({ report: path.join(output, 'same-scenario-report.json'),
  sourceCount: report.sources.length, providerCalls: report.providerCalls.length, snapshots: report.snapshots.map(({phase,addedProviderCalls,privateCandidates}) => ({phase,addedProviderCalls,privateCandidates})) }, null, 2)))
  .catch(error => { console.error(error.stack || error); process.exitCode = 2; });
