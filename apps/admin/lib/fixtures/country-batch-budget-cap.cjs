const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { createCatalogAdmissionBoundary, catalogAdmissionObservation } = require('./catalog-admission-boundary.cjs');
const { createProfileTranslationScanBoundary } = require('./profile-translation-scan-boundary.cjs');
const repo = process.env.COUNTRY_BUDGET_REPO || path.resolve(__dirname, '../../probpera-literary-map');
const sourceRoot = process.env.COUNTRY_BUDGET_SOURCE_ROOT || repo;
const outRoot = process.env.COUNTRY_BUDGET_OUTPUT_ROOT || path.join(__dirname, 'country-budget-contract-before');
assert.equal(fs.existsSync(outRoot), false, 'Use a new output directory');
fs.mkdirSync(outRoot, { recursive: true });
const nativeRequire = createRequire(path.join(repo, 'package.json'));
const ts = nativeRequire('typescript');
const { createClient } = nativeRequire('@supabase/supabase-js');
const { isRedirectError } = nativeRequire('next/dist/client/components/redirect-error');
const { getURLFromRedirectError } = nativeRequire('next/dist/client/components/redirect');
const graph = new Map(), wire = [], calls = [], drift = [], runs = [], writes = [], builds = [], revalidations = [], audits = [];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const noNetwork = () => { throw new Error('Forbidden uncontrolled network in country budget fixture'); };
global.fetch = noNetwork;
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stamp = '2026-10-29T19:35:00.123456+00:00';
const laterStamp = '2026-10-29T19:35:01.123456+00:00';
const russian = { name: 'Исландия', region: 'Северная Европа', continent: 'Европа', officialLanguage: 'Исландский', capital: 'Рейкьявик',
  description: 'Сохранённое русское описание страны.', history: 'Сохранённый русский исторический текст.', historicalNote: 'Авторская историческая заметка.',
  literaryPeriods: ['Период'], literaryMovements: ['Направление'], periods: ['Эпоха'], facts: ['Проверенный факт.'], literaryPlaces: ['Литературное место'],
  timeline: [{ year: '1834', title: 'Событие', description: 'Авторское описание' }], chronology: [{ year: '1860', title: 'Хронология', description: 'Авторская хронология' }] };
const english = { name: 'Iceland', region: 'Northern Europe', continent: 'Europe', officialLanguage: 'Icelandic', capital: 'Reykjavik',
  description: 'The retained country description.', history: 'The retained historical text in English.', historicalNote: "The author's historical note.",
  literaryPeriods: ['Literary period'], literaryMovements: ['Literary movement'], periods: ['Period'], facts: ['A verified fact.'], literaryPlaces: ['Literary place'],
  timeline: [{ year: '1834', title: 'Event', description: 'Authored event description' }], chronology: [{ year: '1860', title: 'Chronology', description: 'Authored chronology description' }] };
const countries = Array.from({ length: 3 }, (_, index) => {
  const id = `budget-country-${index}`, ru = { ...structuredClone(russian), name: `Исландия ${index}` };
  const generated = { ...structuredClone(english), name: `Iceland ${index}` };
  return { id, label: `Synthetic country ${index}`, generated, fields: { ...structuredClone(ru), id, code: `F${index}`, coordinates: [64.13, -21.9],
    sourceMetadata: { author: 'Synthetic Russian editor', permission: 'Keep exact catalog rights' } },
    row: { id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, '0')}`, country_id: id, updated_at: stamp,
      fields: { ...structuredClone(ru), translations: {
        fr: { locale: 'fr', author: 'Synthetic French editor', fields: { name: `Islande ${index}` } },
        en: { locale: 'en', method: 'machine-translation', status: 'reviewed', sourceHash: '0'.repeat(64), fields: structuredClone(generated),
          provenance: { preservedEditorialDecision: true }, authorRights: { holder: 'Synthetic admitted English editor', consent: 'Keep exact' } },
      }, sources: [{ url: 'https://country.fixture.invalid/source', note: 'Original annotation' }],
      provenance: { author: 'Synthetic country editor', sourceLanguage: 'Russian', rights: 'project-original' },
      customMetadata: { ticket: `Country budget ${index}`, nested: [1, 'Exact'] } } } };
});
const beforeRows = structuredClone(countries.map(country => country.row));
const beforeCatalog = structuredClone(countries.map(({ id, label, fields }) => ({ id, label, fields })));
const privateCandidates = new Map();
const catalogAdmission = createCatalogAdmissionBoundary({ actorId,
  getSeed(type, entity) { const country = countries.find(value => value.id === entity); return country ? structuredClone({ catalogFields: country.fields, override: country.row }) : null; },
  getPrivateCandidate(type, entity) { return privateCandidates.get(entity) || null; },
  setPrivateCandidate(type, entity, draft) { privateCandidates.set(entity, structuredClone(draft)); } });
const profileScans = createProfileTranslationScanBoundary({actorId, catalogServer: catalogAdmission});
let loaded;
const fetchBoundary = async (resource, init = {}) => {
  const url = new URL(typeof resource === 'string' ? resource : resource.url);
  assert.equal(url.origin, 'https://country-budget.fixture.invalid');
  const method = init.method || 'GET', table = url.pathname.split('/').at(-1), body = init.body ? JSON.parse(init.body) : null;
  wire.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: structuredClone(body) });
  if (catalogAdmission.handles(table)) return catalogAdmission.fetchRpc(table, body);
  let data;
  if (url.pathname.includes('/rpc/')) {
    if (profileScans.handles(table)) return profileScans.fetchRpc(table, body);
    if (table === 'profile_translation_budget_ready' || table === 'premium_machine_translation_ready') data = true;
    else if (table === 'get_premium_translation_working_draft') {
      assert.equal(body.p_entity_type, 'country'); assert.ok(countries.some(country => country.id === body.p_entity_id));
      data = { schemaVersion: 1, entityType: body.p_entity_type, entityId: body.p_entity_id, draft: privateCandidates.get(body.p_entity_id) || null };
    } else if (table === 'record_translation_sync_run') {
      runs.push(structuredClone(body)); data = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    } else throw new Error(`Unexpected controlled country RPC ${table}`);
  } else if (method === 'GET' && table === 'translation_provider_self_tests') {
    const identity = await loaded('apps/admin/lib/premium-translation-probe.ts').premiumTranslationConfigurationIdentity();
    data = [{ provider: 'cloudflare', configured: true, binding_found: true, test_passed: true, model: identity.configuration.model,
      latency_ms: 1, last_error_code: null, last_test_at: new Date().toISOString(), cooldown_until: null, test_in_progress: false, configuration_identity: identity }];
  } else if (method === 'GET' && table === 'country_profile_overrides') {
    const countryFilter = url.searchParams.get('country_id'), idFilter = url.searchParams.get('id');
    const country = countries.find(value => countryFilter ? `eq.${value.id}` === countryFilter : `eq.${value.row.id}` === idFilter);
    assert.ok(country, 'An existing synthetic country override is required'); data = [structuredClone(country.row)];
    if (url.searchParams.get('select') && url.searchParams.get('select') !== '*') {
      const columns = url.searchParams.get('select').split(','); data = data.map(row => Object.fromEntries(columns.map(column => [column, row[column]])));
    }
  } else if (method === 'POST' && table === 'admin_audit_log') { audits.push(structuredClone(body)); data = null;
  } else { writes.push({ method, table, body }); throw new Error(`Unexpected mutation ${method} ${table}`); }
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const sdk = createClient('https://country-budget.fixture.invalid', 'synthetic-no-auth-session', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchBoundary },
});
const ai = { async run(model, input) {
  const content = JSON.parse(input.messages[1].content), source = content.SOURCE_DATA;
  const country = countries.find(value => value.fields.name === source.name);
  assert.ok(country, 'Actual validated provider source identifies a synthetic country');
  const pass = Object.hasOwn(content, 'INVALID_DRAFT_TRANSLATION') ? 'repair' : Object.hasOwn(content, 'DRAFT_TRANSLATION') ? 'review' : 'translation';
  calls.push({ countryId: country.id, model, pass, source: structuredClone(source) });
  if (pass === 'review') {
    assert.equal(country.row.updated_at, stamp); country.row.updated_at = laterStamp;
    drift.push({ countryId: country.id, before: stamp, after: laterStamp,
      reason: 'Controlled concurrent override revision after reviewer response; authored fields, canonical EN, third locale, sources and rights remain exact' });
  }
  return { id: `country-budget-${calls.length}`, response: JSON.stringify(country.generated), usage: { prompt_tokens: 10, completion_tokens: 10 } };
} };
const mocks = {
  '@/lib/auth': { async requireStaff() { return { user: { id: actorId }, profile: { role: 'owner' } }; } },
  '@/lib/supabase/server': { async createServerSupabaseClient() { return sdk; } },
  '@/lib/editorial-catalog': { async loadEditorialCatalog() { return { version: 1, countries: structuredClone(beforeCatalog) }; } },
  '@/lib/publication': { async requestPublicBuild(input) { builds.push(input); throw new Error('Country conflicts must not publish'); } },
  '@opennextjs/cloudflare': { getCloudflareContext() { return { env: { AI: ai } }; } },
  'next/cache': { revalidatePath(value) { revalidations.push(value); } },
};
const cache = new Map();
const controlledProcess = { env: { PREMIUM_TRANSLATION_PROVIDER: 'cloudflare', OPENAI_AUTO_TRANSLATE_PROFILES: 'true', OPENAI_PREMIUM_TRANSLATION_REVIEW: 'true', ADMIN_BASE_PATH: '' } };
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const filename = path.join(sourceRoot, file), bytes = fs.readFileSync(filename), capture = path.join(outRoot, 'sources', file);
  fs.mkdirSync(path.dirname(capture), { recursive: true }); fs.writeFileSync(capture, bytes, { flag: 'wx' });
  graph.set(file, { module: file, sha256: sha(bytes) });
  const code = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} }; cache.set(file, module.exports);
  function requireActual(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    const target = name.startsWith('@/') ? path.join(sourceRoot, 'apps/admin', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
    if (!target) return nativeRequire(name);
    for (const extension of ['', '.ts', '.tsx', '.mjs', '/index.ts']) {
      const full = target + extension;
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return load(path.relative(sourceRoot, full).replaceAll('\\', '/'));
    }
    throw new Error(`Missing actual country dependency ${name} from ${file}`);
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
  try { await load('apps/admin/app/(dashboard)/translations/country-actions.ts').translatePremiumCountryBatchAction(new FormData()); }
  catch (error) { assert.equal(isRedirectError(error), true, error.stack); redirect = getURLFromRedirectError(error); }
  assert.deepEqual(catalogAdmission.errors, []);
  const run = catalogAdmission.operations.size ? catalogAdmissionObservation(catalogAdmission, runs) : runs[0], attempts = new Set(calls.map(call => call.countryId)).size;
  assert.ok(run, 'Actual paid receipts or original legacy aggregate are observable');
  const authoredFieldsPreserved = countries.every((country, index) => JSON.stringify(country.row.fields) === JSON.stringify(beforeRows[index].fields));
  const catalogPreserved = JSON.stringify(countries.map(({ id, label, fields }) => ({ id, label, fields }))) === JSON.stringify(beforeCatalog);
  assert.ok(attempts >= 1 && attempts <= 3, 'Actual eligible country candidates execute');
  assert.equal(calls.length, attempts * 2); assert.equal(run.p_outcomes.length, attempts);
  assert.ok(run.p_outcomes.every(outcome => outcome.status === 'conflict'));
  assert.ok(countries.every(country => { const passes=calls.filter(call => call.countryId === country.id).map(call => call.pass).join(','); return passes === '' || passes === 'translation,review'; }));
  assert.equal(writes.length, 0); assert.equal(builds.length, 0); assert.equal(authoredFieldsPreserved, true); assert.equal(catalogPreserved, true);
  const sources = [...graph.values()].sort((a, b) => a.module.localeCompare(b.module));
  const unchanged = sources.every(source => sha(fs.readFileSync(path.join(sourceRoot, source.module))) === source.sha256);
  assert.equal(unchanged, true, 'Actual country source drift during diagnostic');
  const statusAfter = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  const checks = [
    { name: 'Actual country validator and premium two-pass pipeline execute for every admitted candidate', category: 'execution', pass: attempts >= 1 && calls.length === attempts * 2 },
    { name: 'Authored/catalog fields, canonical EN, third locale and source rights remain exact during controlled CAS conflicts', category: 'preservation', pass: authoredFieldsPreserved && catalogPreserved && writes.length === 0 && builds.length === 0 },
    { name: 'Country success cap also bounds expensive conflicting attempts', category: 'target', pass: attempts === 2, expected: 2, actual: attempts },
    { name: 'Three conflicting countries start only four provider passes within the two-attempt budget', category: 'target', pass: calls.length === 4, expected: 4, actual: calls.length },
    { name: 'Country durable run contains only the two admitted conflict items', category: 'target', pass: run.p_items.length === 2 && run.p_outcomes.length === 2, expected: 2, actual: run.p_items.length },
    { name: 'Country cursor retains the first candidate not admitted because of the budget', category: 'target', pass: run.p_resume_cursor.countryCursor === 2, expected: 2, actual: run.p_resume_cursor.countryCursor },
  ];
  const report = { mode: 'Frozen country budget-contract acceptance fixture; BEFORE target failures expected until implementation', checks, checkedAt: new Date().toISOString(), head, sourceRoot,
    protocolObserver: run, privateCandidates: [...privateCandidates.values()], auditMetadata: audits,
    unchanged, repositoryStatusUnchanged: statusBefore === statusAfter, configuredSuccessfulTranslationCap: 2, syntheticEligibleCandidates: countries.length,
    expensiveAttempts: attempts, providerCalls: calls.length, successfulPrivateTranslations: run.p_outcomes.filter(value => value.status === 'succeeded').length,
    conflicts: run.p_outcomes.filter(value => value.status === 'conflict').length, defectReproduced: attempts > 2 && calls.length > 4,
    result: { redirect, runItems: run.p_items, runOutcomes: run.p_outcomes, resumeCursor: run.p_resume_cursor },
    authoredFieldsPreserved, catalogPreserved, canonicalMachineWrites: writes.length, publicBuildRequests: builds.length,
    calls, controlledRevisionDrift: drift, revalidations, wire, sourceCount: sources.length, sources, fixtureSha256: sha(fs.readFileSync(__filename)),
    limitations: ['Actual country batch/helper, structural arrays/timeline/chronology/year validator, premium two-pass pipeline, runtime gate/probe, run DTO, installed SDK and native Next redirect execute.',
      'Staff, catalog data, PostgREST transport and Cloudflare AI boundary are controlled. Three synthetic override timestamps intentionally change after reviewer responses; catalog/authored fields, canonical EN, third locale, sources and rights remain exact.',
      'No separate manual/current/pending input, malformed model output, repair, deadline, 30-scan/ordering, real Auth/PostgREST/DB/RLS/provider/browser or production acceptance. No paid/network calls or repository edits.'] };
  fs.writeFileSync(path.join(outRoot, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify({ head, fixtureSha256: report.fixtureSha256, sources }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ report: path.join(outRoot, 'report.json'), ...report, sources: undefined, wire: undefined, calls: undefined }, null, 2));
  process.exitCode = checks.some(check => !check.pass) ? 1 : 0;
}
main().catch(error => {
  fs.writeFileSync(path.join(outRoot, 'diagnostic-error.json'), JSON.stringify({ checkedAt: new Date().toISOString(), error: error.stack || String(error), calls, wire, sources: [...graph.values()] }, null, 2));
  console.error(error.stack || error); process.exitCode = 2;
});
