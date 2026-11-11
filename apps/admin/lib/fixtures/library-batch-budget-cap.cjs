const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { createCatalogAdmissionBoundary, catalogAdmissionObservation } = require('./catalog-admission-boundary.cjs');
const { createLibraryTranslationScanBoundary, libraryScanObservation } = require('./library-translation-scan-boundary.cjs');

const repo = process.env.LIBRARY_BUDGET_REPO || path.resolve(__dirname, '../../probpera-literary-map');
const sourceRoot = process.env.LIBRARY_BUDGET_SOURCE_ROOT || repo;
const outRoot = process.env.LIBRARY_BUDGET_OUTPUT_ROOT || path.join(__dirname, 'library-budget-contract-before');
assert.equal(fs.existsSync(outRoot), false, 'Use a new output directory');
fs.mkdirSync(outRoot, { recursive: true });
const nativeRequire = createRequire(path.join(repo, 'package.json'));
const ts = nativeRequire('typescript');
const { createClient } = nativeRequire('@supabase/supabase-js');
const { isRedirectError } = nativeRequire('next/dist/client/components/redirect-error');
const { getURLFromRedirectError } = nativeRequire('next/dist/client/components/redirect');
const graph = new Map(), wire = [], calls = [], drift = [], runs = [], writes = [], builds = [], revalidations = [], audits = [];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const noNetwork = () => { throw new Error('Forbidden uncontrolled network in library budget fixture'); };
global.fetch = noNetwork;
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stamp = '2026-10-29T19:00:00.123456+00:00';
const laterStamp = '2026-10-29T19:00:01.123456+00:00';
const description = "The original literary account preserves its documented setting and the author's precise narrative sequence. Its sources, rights and factual qualifications remain intact for readers of this faithful English description.";
const entries = Array.from({ length: 5 }, (_, index) => {
  const suffix = String(index + 1).padStart(12, '0');
  const workId = `bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`, ruId = `cccccccc-cccc-4ccc-8ccc-${suffix}`;
  const titleUrl = `https://bibliography.fixture.invalid/verified-title-${index}`, ruUrl = `https://sources.fixture.invalid/original-russian-${index}`;
  return {
    work: { id: workId, title: `Авторское название ${index}`, original_title: `Exact original-language title ${index}`, first_published: 1947,
      original_language: 'Russian', editorial_status: 'reviewed', updated_at: stamp,
      metadata: { rights: { holder: 'Synthetic author', permission: 'Exact original permission' }, custom: ['Preserve', index] } },
    russian: { id: ruId, work_id: workId, locale: 'ru', title: `Точное русское название ${index}`,
      description: 'Авторское русское описание сохраняет проверенные литературные сведения, последовательность повествования и исходные источники. Права автора, редакционная формулировка и фактические оговорки требуют точного сохранения.',
      source_language: 'Russian', source_urls: [ruUrl], translation_method: 'editorial-original', editorial_status: 'reviewed',
      reviewed_at: '2026-10-29', updated_at: stamp, metadata: { rights: { permission: 'Exact synthetic RU consent' }, custom: { wording: 'Не менять' } } },
    english: { id: `dddddddd-dddd-4ddd-8ddd-${suffix}`, work_id: workId, locale: 'en', title: `Exact Verified English Title ${index}`,
      description, source_language: 'Russian', source_urls: [titleUrl], translation_method: 'machine-translation', editorial_status: 'draft',
      reviewed_at: null, updated_at: stamp,
      metadata: { rights: { holder: 'Synthetic editor', permission: 'Exact EN consent' }, custom: { preserve: ['Exact', index] },
        descriptionProvenance: { mode: 'authored', editorialNote: 'Keep existing signed wording' },
        premiumTranslation: { bibliographicTitle: { value: `Exact Verified English Title ${index}`, sourceUrl: titleUrl } } } },
    sources: [{ id: `eeeeeeee-eeee-4eee-8eee-${suffix}`, work_id: workId, provider: 'verified-bibliography', source_url: titleUrl,
      field_names: ['title'], retrieved_at: '2026-10-29', usage: 'reference-only', license_name: 'Reference facts only',
      updated_at: stamp, metadata: { rights: 'Do not modify source licensing' } }],
  };
});
const before = structuredClone(entries);
const privateCandidates = new Map();
const catalogAdmission = createCatalogAdmissionBoundary({ actorId,
  getSeed(type, entity) { const entry = entries.find(value => value.work.id === entity); return entry ? structuredClone({ work: entry.work, russian: entry.russian, english: entry.english, sources: entry.sources }) : null; },
  getPrivateCandidate(type, entity) { return privateCandidates.get(entity) || null; },
  setPrivateCandidate(type, entity, draft) { privateCandidates.set(entity, structuredClone(draft)); } });
let loaded;
const libraryScans = createLibraryTranslationScanBoundary({ actorId, getEntries: () => entries, catalogServer: catalogAdmission });
function matches(row, params) {
  return [...params].every(([key, value]) => {
    if (['select', 'limit', 'offset', 'order'].includes(key)) return true;
    if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
    if (value.startsWith('in.')) return value.slice(4, -1).split(',').includes(String(row[key]));
    if (value.startsWith('cs.')) return value.slice(4, -1).split(',').every(field => Array.isArray(row[key]) && row[key].includes(field));
    throw new Error(`Unsupported synthetic SDK predicate ${key}=${value}`);
  });
}
const fetchBoundary = async (resource, init = {}) => {
  const url = new URL(typeof resource === 'string' ? resource : resource.url);
  assert.equal(url.origin, 'https://library-budget.fixture.invalid');
  const method = init.method || 'GET', table = url.pathname.split('/').at(-1), body = init.body ? JSON.parse(init.body) : null;
  wire.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: structuredClone(body) });
  if (libraryScans.handles(table)) return libraryScans.fetchRpc(table, body);
  if (catalogAdmission.handles(table)) return catalogAdmission.fetchRpc(table, body);
  let data, count = null;
  if (url.pathname.includes('/rpc/')) {
    if (table === 'premium_machine_translation_ready') data = true;
    else if (table === 'profile_translation_budget_ready') data = true;
    else if (table === 'get_premium_translation_working_draft') {
      assert.equal(body.p_entity_type, 'literary_work'); assert.ok(entries.some(entry => entry.work.id === body.p_entity_id));
      data = { schemaVersion: 1, entityType: body.p_entity_type, entityId: body.p_entity_id, draft: privateCandidates.get(body.p_entity_id) || null };
    } else if (table === 'record_translation_sync_run') {
      runs.push(structuredClone(body)); data = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    } else throw new Error(`Unexpected RPC ${table}`);
  } else if (method === 'GET' && table === 'translation_provider_self_tests') {
    const identity = await loaded('apps/admin/lib/premium-translation-probe.ts').premiumTranslationConfigurationIdentity();
    data = [{ provider: 'cloudflare', configured: true, binding_found: true, test_passed: true, model: identity.configuration.model,
      latency_ms: 1, last_error_code: null, last_test_at: new Date().toISOString(), cooldown_until: null,
      test_in_progress: false, configuration_identity: identity }];
  } else if (method === 'GET' || method === 'HEAD') {
    const rows = table === 'literary_works' ? entries.map(entry => entry.work)
      : table === 'literary_work_translations' ? entries.flatMap(entry => [entry.russian, entry.english])
        : table === 'literary_work_sources' ? entries.flatMap(entry => entry.sources) : null;
    assert.ok(rows, `Unexpected actual SDK table ${table}`);
    const filtered = rows.filter(row => matches(row, url.searchParams)); count = filtered.length;
    const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || filtered.length);
    data = method === 'HEAD' ? null : structuredClone(filtered.slice(offset, offset + limit));
    if (method === 'GET' && url.searchParams.get('select') && url.searchParams.get('select') !== '*') {
      const columns = url.searchParams.get('select').split(','); data = data.map(row => Object.fromEntries(columns.map(column => [column, row[column]])));
    }
  } else if (method === 'POST' && table === 'admin_audit_log') { audits.push(structuredClone(body)); data = null;
  } else { writes.push({ method, table, body }); throw new Error(`Unexpected mutation ${method} ${table}`); }
  return new Response(method === 'HEAD' ? null : JSON.stringify(data), { status: 200,
    headers: { 'Content-Type': 'application/json', ...(count === null ? {} : { 'Content-Range': `0-${Math.max(0, count - 1)}/${count}` }) } });
};
const sdk = createClient('https://library-budget.fixture.invalid', 'synthetic-no-auth-session', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchBoundary },
});
const ai = { async run(model, input) {
  const content = JSON.parse(input.messages[1].content), source = content.SOURCE_DATA;
  const entry = entries.find(value => value.russian.title === source.russianTitle);
  assert.ok(entry, 'A real validated provider source identifies a synthetic work');
  assert.equal(source.verifiedEnglishTitle, entry.english.title);
  assert.equal(source.verifiedEnglishTitleSourceUrl, entry.sources[0].source_url);
  assert.deepEqual(source.sourceUrls, entry.russian.source_urls);
  const pass = Object.hasOwn(content, 'INVALID_DRAFT_TRANSLATION') ? 'repair' : Object.hasOwn(content, 'DRAFT_TRANSLATION') ? 'review' : 'translation';
  calls.push({ workId: entry.work.id, model, pass, source: structuredClone(source) });
  if (pass === 'review') {
    assert.equal(entry.russian.updated_at, stamp);
    entry.russian.updated_at = laterStamp;
    drift.push({ workId: entry.work.id, russianId: entry.russian.id, before: stamp, after: laterStamp,
      reason: 'Controlled concurrent RU revision after accepted reviewer completion; authored fields and all EN/source metadata unchanged' });
  }
  return { id: `library-budget-${calls.length}`, response: JSON.stringify({ description }), usage: { prompt_tokens: 10, completion_tokens: 10 } };
} };
const mocks = {
  '@/lib/auth': { async requireStaff() { return { user: { id: actorId }, profile: { role: 'owner' } }; } },
  '@/lib/supabase/server': { async createServerSupabaseClient() { return sdk; } },
  '@/lib/editorial-catalog': { loadEditorialCatalog: noNetwork },
  '@/lib/auto-translate-writer-biography': { ensureWriterEnglishBiography: noNetwork },
  '@/lib/auto-translate-site-copy-private': { ensureSiteCopyEnglishTranslation: noNetwork },
  '@/lib/publication': { async requestPublicBuild(input) { builds.push(input); throw new Error('Conflict-only batch must not publish'); } },
  '@opennextjs/cloudflare': { getCloudflareContext() { return { env: { AI: ai } }; } },
  'next/cache': { revalidatePath(value) { revalidations.push(value); } },
};
const cache = new Map();
const controlledProcess = { env: { PREMIUM_TRANSLATION_PROVIDER: 'cloudflare', OPENAI_AUTO_TRANSLATE_LIBRARY: 'true', OPENAI_PREMIUM_TRANSLATION_REVIEW: 'true', ADMIN_BASE_PATH: '' } };
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const filename = path.join(sourceRoot, file), bytes = fs.readFileSync(filename), hash = sha(bytes), capture = path.join(outRoot, 'sources', file);
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
async function main() {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  const statusBefore = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  let redirect;
  try { await load('apps/admin/app/(dashboard)/translations/actions.ts').translatePremiumLibraryBatchAction(new FormData()); }
  catch (error) { assert.equal(isRedirectError(error), true, error.stack); redirect = getURLFromRedirectError(error); }
  assert.deepEqual(catalogAdmission.errors, []);
  const run = libraryScans.windows.size ? libraryScanObservation(libraryScans, catalogAdmission, runs) : catalogAdmission.operations.size ? catalogAdmissionObservation(catalogAdmission, runs) : runs[0], attempts = new Set(calls.map(call => call.workId)).size;
  assert.ok(run, 'Actual paid receipts or original legacy aggregate are observable');
  const authoredFieldsPreserved = entries.every((entry, index) => {
    const current = structuredClone(entry), original = structuredClone(before[index]);
    delete current.russian.updated_at; delete original.russian.updated_at;
    return JSON.stringify(current) === JSON.stringify(original);
  });
  assert.ok(attempts >= 1 && attempts <= 5, 'Actual eligible library candidates execute');
  assert.equal(calls.length, attempts * 2, 'Each admitted work completes both actual passes');
  assert.equal(run.p_outcomes.length, attempts, 'Recorded conflicts correspond exactly to admitted attempts');
  assert.ok(run.p_outcomes.every(outcome => outcome.status === 'conflict'));
  assert.ok(entries.every(entry => { const passes = calls.filter(call => call.workId === entry.work.id).map(call => call.pass).join(','); return passes === '' || passes === 'translation,review'; }));
  const bibliographicReads = wire.filter(call => call.method === 'GET' && call.path.endsWith('/literary_work_sources'));
  assert.equal(bibliographicReads.length, attempts); assert.ok(bibliographicReads.every(call => call.query.field_names === 'cs.{title}' && call.query.source_url.startsWith('eq.https://bibliography.fixture.invalid/')));
  assert.equal(writes.length, 0); assert.equal(builds.length, 0); assert.equal(authoredFieldsPreserved, true);
  const sources = [...graph.values()].sort((a, b) => a.module.localeCompare(b.module));
  const unchanged = sources.every(source => sha(fs.readFileSync(path.join(sourceRoot, source.module))) === source.sha256);
  assert.equal(unchanged, true, 'Actual source drift during diagnostic');
  const statusAfter = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  const checks = [
    { name: 'Every admitted work passes actual bibliographic/source guards and both actual premium passes', category: 'execution', pass: attempts >= 1 && calls.length === attempts * 2 && bibliographicReads.length === attempts },
    { name: 'Canonical English, authored fields, source rights and metadata remain exact during controlled RU CAS conflicts', category: 'preservation', pass: authoredFieldsPreserved && writes.length === 0 && builds.length === 0 },
    { name: 'Library successful-translation cap also bounds expensive conflicting attempts', category: 'target', pass: attempts === 4, expected: 4, actual: attempts },
    { name: 'Five conflicting works start only eight provider passes within the four-attempt budget', category: 'target', pass: calls.length === 8, expected: 8, actual: calls.length },
    { name: 'Durable library run contains only the four admitted conflict items', category: 'target', pass: run.p_items.length === 4 && run.p_outcomes.length === 4, expected: 4, actual: run.p_items.length },
    { name: 'Library resume cursor retains the first candidate not admitted because of the budget', category: 'target', pass: run.p_resume_cursor.libraryCursor === 4, expected: 4, actual: run.p_resume_cursor.libraryCursor },
  ];
  const report = { mode: 'Frozen library budget-contract acceptance fixture; BEFORE target failures expected until implementation', checks, checkedAt: new Date().toISOString(), head, sourceRoot,
    protocolObserver: run, privateCandidates: [...privateCandidates.values()], auditMetadata: audits,
    unchanged, repositoryStatusUnchanged: statusBefore === statusAfter, configuredSuccessfulTranslationCap: 4,
    syntheticEligibleCandidates: entries.length, expensiveAttempts: attempts, providerCalls: calls.length,
    successfulPrivateTranslations: run.p_outcomes.filter(value => value.status === 'succeeded').length,
    conflicts: run.p_outcomes.filter(value => value.status === 'conflict').length, bibliographicReads: bibliographicReads.length,
    defectReproduced: attempts > 4 && calls.length > 8 && run.p_outcomes.every(value => value.status === 'conflict'),
    result: { redirect, runItems: run.p_items, runOutcomes: run.p_outcomes, resumeCursor: run.p_resume_cursor }, calls, controlledRevisionDrift: drift,
    authoredFieldsPreserved, canonicalMachineWrites: writes.length, publicBuildRequests: builds.length, revalidations,
    sourceCount: sources.length, sources, wire, fixtureSha256: sha(fs.readFileSync(__filename)),
    limitations: ['Actual library batch, safe wrapper, helper, eligibility/manual-ownership/verified bibliographic title/source guards, premium two-pass pipeline, runtime gate/probe, run DTO, installed SDK and native Next redirect execute.',
      'Five synthetic Russian revisions intentionally change after reviewer responses. Staff, PostgREST transport and Cloudflare AI boundary are controlled; canonical English, authored fields, sources and rights remain exact.',
      'This case does not cover a separate manual-English input, the 60-scan worst case, repairs/retries/deadline, real Auth/PostgREST/DB/RLS/provider/browser or production. No paid/network calls or repository edits.'] };
  fs.writeFileSync(path.join(outRoot, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify({ head, fixtureSha256: report.fixtureSha256, sources }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ report: path.join(outRoot, 'report.json'), ...report, wire: undefined, sources: undefined, calls: undefined }, null, 2));
  process.exitCode = checks.some(check => !check.pass) ? 1 : 0;
}
main().catch(error => {
  fs.writeFileSync(path.join(outRoot, 'diagnostic-error.json'), JSON.stringify({ checkedAt: new Date().toISOString(), error: error.stack || String(error), calls, wire, sources: [...graph.values()] }, null, 2));
  console.error(error.stack || error); process.exitCode = 2;
});
