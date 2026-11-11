const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { createWriterAdmissionBoundary } = require('./writer-admission-boundary.cjs');
const { createProfileTranslationScanBoundary } = require('./profile-translation-scan-boundary.cjs');

const repo = process.env.PROFILE_BUDGET_REPO || path.resolve(__dirname, '../../probpera-literary-map');
const sourceRoot = process.env.PROFILE_BUDGET_SOURCE_ROOT || repo;
const outRoot = process.env.PROFILE_BUDGET_OUTPUT_ROOT || path.join(__dirname, 'writer-budget-contract-before');
assert.equal(fs.existsSync(outRoot), false, 'Use a new output directory');
fs.mkdirSync(outRoot, { recursive: true });
const nativeRequire = createRequire(path.join(repo, 'package.json'));
const ts = nativeRequire('typescript');
const { createClient } = nativeRequire('@supabase/supabase-js');
const { isRedirectError } = nativeRequire('next/dist/client/components/redirect-error');
const { getURLFromRedirectError } = nativeRequire('next/dist/client/components/redirect');
const graph = new Map(), wire = [], calls = [], drift = [], runs = [], writes = [], builds = [], revalidations = [], audits = [];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const noNetwork = () => { throw new Error('Forbidden uncontrolled network in profile budget fixture'); };
global.fetch = noNetwork;
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stamp = '2026-10-29T18:55:00.123456+00:00';
const afterStamp = '2026-10-29T18:55:01.123456+00:00';
const englishText = 'Leo Tolstoy (1828-1910) was a Russian writer who wrote the novels “War and Peace” and “Anna Karenina”. His works belong to the world literary tradition and continue to be studied by scholars.';
const russianText = 'Лев Толстой (1828-1910) - русский писатель, автор романов «Война и мир» и «Анна Каренина». Его произведения входят в мировую литературную традицию и продолжают изучаться исследователями.';
const russian = {
  locale: 'ru', text: russianText, sourceLanguage: 'Russian', status: 'reviewed', method: 'editorial-original',
  reviewedAt: '2026-10-29', reviewer: 'Synthetic human editor',
  sources: [{ provider: 'Synthetic reference library', url: 'https://sources.fixture.invalid/writer', fields: ['identity', 'life-dates', 'biography-facts', 'works'], usage: 'fact-check', retrievedAt: '2026-10-29', title: 'Synthetic verified reference', licenseName: 'Synthetic facts' }],
  authorRights: { holder: 'Synthetic author', evidence: ['Keep exact raw rights'] },
};
const writers = Array.from({ length: 5 }, (_, index) => ({
  id: `budget_writer_${index}`, label: `Synthetic writer ${index}`,
  fields: { name: 'Лев Толстой', fullName: 'Leo Tolstoy', biographyTranslations: { ru: structuredClone(russian) }, custom: { authorRights: `Keep synthetic metadata ${index}` } },
}));
const rows = new Map(writers.map((writer, index) => [writer.id, {
  id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, '0')}`,
  country_id: 'russia', writer_id: writer.id, fields: { editorialMemo: `Unchanged existing override ${index}`, rights: { preserve: true } }, updated_at: stamp,
}]));
const beforeRows = structuredClone([...rows.values()]);
const catalog = { version: 1, countries: [{ id: 'russia', label: 'Россия', fields: { name: 'Россия' }, writers }] };
const admissionDrafts = new Map();
const admission = createWriterAdmissionBoundary({ actorId,
  getOverride(country, writer) { return country === 'russia' ? rows.get(writer) || null : null; },
  getPrivateCandidate(identity) { return admissionDrafts.get(identity) || null; },
  setPrivateCandidate(identity, draft) { admissionDrafts.set(identity, structuredClone(draft)); } });
const profileScans = createProfileTranslationScanBoundary({actorId, writerServer: admission});
let loaded, activeWriter = null;
const fetchBoundary = async (resource, init = {}) => {
  const url = new URL(typeof resource === 'string' ? resource : resource.url);
  assert.equal(url.origin, 'https://profile-budget.fixture.invalid');
  const method = init.method || 'GET', table = url.pathname.split('/').at(-1), body = init.body ? JSON.parse(init.body) : null;
  wire.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: structuredClone(body) });
  let data;
  if (url.pathname.includes('/rpc/')) {
    if (profileScans.handles(table)) return profileScans.fetchRpc(table, body);
    if (admission.handles(table)) return admission.fetchRpc(table, body);
    if (table === 'profile_translation_budget_ready' || table === 'premium_machine_translation_ready') data = true;
    else if (table === 'get_premium_translation_working_draft') {
      assert.equal(body.p_entity_type, 'writer_biography');
      data = { schemaVersion: 1, entityType: body.p_entity_type, entityId: body.p_entity_id, draft: admissionDrafts.get(body.p_entity_id) || null };
    } else if (table === 'record_translation_sync_run') {
      runs.push(structuredClone(body)); data = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    } else throw new Error(`Unexpected RPC ${table}`);
  } else if (method === 'GET' && table === 'translation_provider_self_tests') {
    const identity = await loaded('apps/admin/lib/premium-translation-probe.ts').premiumTranslationConfigurationIdentity();
    data = [{ provider: 'cloudflare', configured: true, binding_found: true, test_passed: true,
      model: identity.configuration.model, latency_ms: 1, last_error_code: null, last_test_at: new Date().toISOString(),
      cooldown_until: null, test_in_progress: false, configuration_identity: identity }];
  } else if (method === 'GET' && table === 'writer_profile_overrides') {
    const writerFilter = url.searchParams.get('writer_id');
    const idFilter = url.searchParams.get('id');
    const row = writerFilter ? rows.get(writerFilter.slice(3)) : [...rows.values()].find(value => `eq.${value.id}` === idFilter);
    assert.ok(row, 'A controlled existing override must be found');
    if (writerFilter) activeWriter = row.writer_id;
    data = [structuredClone(row)];
  } else if (method === 'POST' && table === 'admin_audit_log') {
    audits.push(structuredClone(body)); data = null;
  } else {
    writes.push({ method, table, body }); throw new Error(`Unexpected mutation ${method} ${table}`);
  }
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const sdk = createClient('https://profile-budget.fixture.invalid', 'synthetic-no-auth-session', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchBoundary },
});
const ai = { async run(model, input) {
  const content = JSON.parse(input.messages[1].content);
  const pass = Object.hasOwn(content, 'INVALID_DRAFT_TRANSLATION') ? 'repair' : Object.hasOwn(content, 'DRAFT_TRANSLATION') ? 'review' : 'translation';
  assert.ok(activeWriter);
  calls.push({ writerId: activeWriter, model, pass });
  if (pass === 'review') {
    const row = rows.get(activeWriter);
    assert.equal(row.updated_at, stamp, 'Exactly one transient synthetic concurrency event per candidate');
    row.updated_at = afterStamp;
    drift.push({ writerId: activeWriter, before: stamp, after: afterStamp, reason: 'Controlled concurrent override revision after accepted reviewer completion; authored fields unchanged' });
  }
  return { id: `profile-budget-${calls.length}`, response: JSON.stringify({ text: englishText }), usage: { prompt_tokens: 10, completion_tokens: 10 } };
} };
const mocks = {
  '@/lib/auth': { async requireStaff() { return { user: { id: actorId }, profile: { role: 'owner' } }; } },
  '@/lib/supabase/server': { async createServerSupabaseClient() { return sdk; } },
  '@/lib/editorial-catalog': { async loadEditorialCatalog() { return structuredClone(catalog); } },
  '@/lib/auto-translate-literary-work-safe': { ensureLiteraryWorkEnglishTranslation: noNetwork },
  '@/lib/auto-translate-site-copy-private': { ensureSiteCopyEnglishTranslation: noNetwork },
  '@/lib/publication': { async requestPublicBuild(input) { builds.push(input); throw new Error('Conflict-only batch must not publish'); } },
  '@opennextjs/cloudflare': { getCloudflareContext() { return { env: { AI: ai } }; } },
  'next/cache': { revalidatePath(value) { revalidations.push(value); } },
};
const cache = new Map();
const controlledProcess = { env: { PREMIUM_TRANSLATION_PROVIDER: 'cloudflare', OPENAI_AUTO_TRANSLATE_PROFILES: 'true', OPENAI_PREMIUM_TRANSLATION_REVIEW: 'true', ADMIN_BASE_PATH: '' } };
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const filename = path.join(sourceRoot, file), bytes = fs.readFileSync(filename), hash = sha(bytes);
  const capture = path.join(outRoot, 'sources', file);
  fs.mkdirSync(path.dirname(capture), { recursive: true }); fs.writeFileSync(capture, bytes, { flag: 'wx' });
  graph.set(file, { module: file, sha256: hash });
  const code = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} }; cache.set(file, module.exports);
  function requireActual(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    const target = name.startsWith('@/') ? path.join(sourceRoot, 'apps/admin', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
    if (!target) return nativeRequire(name);
    for (const extension of ['', '.ts', '.tsx', '.mjs', '/index.ts']) {
      const full = target + extension;
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return load(path.relative(sourceRoot, full).replaceAll('\\', '/'));
    }
    throw new Error(`Missing actual module ${name} from ${file}`);
  }
  new Function('require', 'module', 'exports', 'process', 'fetch', code)(requireActual, module, module.exports, controlledProcess, noNetwork);
  cache.set(file, module.exports); return module.exports;
}
loaded = load;
if (fs.existsSync(path.join(sourceRoot, 'apps/admin/lib/editorial-catalog.ts'))) {
  const catalogBoundary = mocks['@/lib/editorial-catalog'], originalCatalogLoad = catalogBoundary.loadEditorialCatalog;
  Object.assign(catalogBoundary, load('apps/admin/lib/editorial-catalog.ts'));
  catalogBoundary.loadEditorialCatalog = originalCatalogLoad;
  mocks['./editorial-catalog'] = catalogBoundary;
}

async function main() {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  const statusBefore = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  let redirect;
  try { await load('apps/admin/app/(dashboard)/translations/actions.ts').translatePremiumWriterBatchAction(new FormData()); }
  catch (error) { assert.equal(isRedirectError(error), true, error.stack); redirect = getURLFromRedirectError(error); }
  // Observe the actual protocol used by this source revision. New durable paid
  // jobs are not invented legacy record_translation_sync_run calls; the raw
  // RPC events and any free-observation aggregate remain separately reported.
  const completed = [...admission.operations.values()].filter(operation => operation.phase === 'finished');
  const observedItems = [...runs.flatMap(run => run.p_items), ...completed.map(operation => ({ entityType: 'writer', entityId: operation.entityId }))];
  const observedOutcomes = [...runs.flatMap(run => run.p_outcomes), ...completed.map(operation => ({ status: operation.result.state }))];
  const observedCursor = completed.length ? completed.at(-1).resumeCursor : runs.at(-1)?.p_resume_cursor;
  const attempts = new Set(calls.map(call => call.writerId)).size;
  const authoredFieldsPreserved = beforeRows.every(original => JSON.stringify(original.fields) === JSON.stringify(rows.get(original.writer_id).fields));
  assert.ok(attempts >= 1 && attempts <= 5, 'Actual expensive candidates execute');
  assert.equal(calls.length, attempts * 2, 'Each admitted candidate completes both actual passes');
  assert.equal(observedOutcomes.length, attempts, 'Recorded conflict items correspond exactly to admitted attempts');
  assert.ok(observedOutcomes.every(outcome => outcome.status === 'conflict'));
  assert.ok(writers.every(writer => { const passes = calls.filter(call => call.writerId === writer.id).map(call => call.pass).join(','); return passes === '' || passes === 'translation,review'; }));
  assert.equal(writes.length, 0); assert.equal(builds.length, 0); assert.equal(authoredFieldsPreserved, true);
  const sources = [...graph.values()].sort((a, b) => a.module.localeCompare(b.module));
  const unchanged = sources.every(source => sha(fs.readFileSync(path.join(sourceRoot, source.module))) === source.sha256);
  assert.equal(unchanged, true, 'Actual source drift during diagnostic');
  const statusAfter = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  const checks = [
    { name: 'Actual premium translation and reviewer complete for every admitted candidate', category: 'execution', pass: attempts >= 1 && calls.length === attempts * 2 },
    { name: 'Authored fields and canonical English remain unchanged during controlled CAS conflicts', category: 'preservation', pass: authoredFieldsPreserved && writes.length === 0 && builds.length === 0 },
    { name: 'Successful-translation cap also bounds expensive conflicting attempts', category: 'target', pass: attempts === 3, expected: 3, actual: attempts },
    { name: 'Five conflict candidates start only six provider passes within the three-attempt budget', category: 'target', pass: calls.length === 6, expected: 6, actual: calls.length },
    { name: 'Durable run contains only the three admitted conflict items', category: 'target', pass: observedItems.length === 3 && observedOutcomes.length === 3, expected: 3, actual: observedItems.length },
    { name: 'Resume cursor points to the first candidate not admitted because of the budget', category: 'target', pass: observedCursor.writerCursor === 3, expected: 3, actual: observedCursor.writerCursor },
  ];
  const report = {
    mode: 'Frozen budget-contract acceptance fixture; BEFORE target failures expected until implementation', checks,
    checkedAt: new Date().toISOString(), head, sourceRoot, unchanged, repositoryStatusUnchanged: statusBefore === statusAfter,
    configuredSuccessfulTranslationCap: 3, syntheticEligibleCandidates: writers.length, expensiveAttempts: attempts,
    providerCalls: calls.length, successfulPrivateTranslations: observedOutcomes.filter(value => value.status === 'succeeded' || value.status === 'translated').length,
    conflicts: observedOutcomes.filter(value => value.status === 'conflict').length,
    defectReproduced: attempts > 3 && calls.length > 6 && observedOutcomes.every(value => value.status === 'conflict'),
    result: { redirect, runItems: observedItems, runOutcomes: observedOutcomes, resumeCursor: observedCursor },
    actualLegacyRuns: runs, actualAdmissionEvents: admission.events, actualAuditWrites: audits,
    protocolObserver: 'Legacy aggregate plus actual finished one-item receipts, without duplicating paid attempts or fabricating an old RPC call',
    calls, controlledRevisionDrift: drift, authoredFieldsPreserved, canonicalMachineWrites: writes.length,
    publicBuildRequests: builds.length, revalidations, sourceCount: sources.length, sources, wire,
    fixtureSha256: sha(fs.readFileSync(__filename)),
    limitations: ['Actual current batch, writer helper, premium two-pass pipeline, runtime gate/probe, run DTO, installed Supabase SDK and native Next redirect execute.',
      'Staff, catalog, in-memory PostgREST transport and Cloudflare AI boundary are controlled. Five synthetic override revisions intentionally change after reviewer responses; authored fields remain exact.',
      'No real Auth/PostgREST/DB/RLS/provider/network/paid calls, no production operations and no repository file edits. This is a baseline defect observation, not acceptance PASS.'],
  };
  fs.writeFileSync(path.join(outRoot, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify({ head, fixtureSha256: report.fixtureSha256, sources }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ report: path.join(outRoot, 'report.json'), ...report, wire: undefined, sources: undefined }, null, 2));
  process.exitCode = checks.some(check => !check.pass) ? 1 : 0;
}
main().catch(error => {
  fs.writeFileSync(path.join(outRoot, 'diagnostic-error.json'), JSON.stringify({ checkedAt: new Date().toISOString(), error: error.stack || String(error), calls, wire, sources: [...graph.values()] }, null, 2));
  console.error(error.stack || error); process.exitCode = 2;
});
