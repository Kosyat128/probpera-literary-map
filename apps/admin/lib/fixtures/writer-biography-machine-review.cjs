const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { createWriterAdmissionBoundary } = require('./writer-admission-boundary.cjs');
const { createProfileTranslationScanBoundary } = require('./profile-translation-scan-boundary.cjs');

// Actual code executes with synthetic SDK/provider boundaries. No real service is contacted.
const repo = process.env.WRITER_REPO || path.resolve(__dirname, '../../../..');
const sourceRoot = process.env.WRITER_SOURCE_ROOT || repo;
const outRoot = process.env.WRITER_OUTPUT_ROOT || null;
if (outRoot) {
  fs.mkdirSync(outRoot, { recursive: true });
  assert.equal(fs.existsSync(path.join(outRoot, 'report.json')), false, 'Use a new output label');
}
const nativeRequire = createRequire(path.join(repo, 'package.json'));
const ts = nativeRequire('typescript');
const { createClient } = nativeRequire('@supabase/supabase-js');
const { isRedirectError } = nativeRequire('next/dist/client/components/redirect-error');
const { getURLFromRedirectError } = nativeRequire('next/dist/client/components/redirect');
const graph = new Map(), traces = [], checks = [];
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const noNetwork = () => { throw new Error('Forbidden uncontrolled network in writer fixture'); };
global.fetch = noNetwork;
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const overrideId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const runId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const countryId = 'russia', writerId = 'leo_tolstoy';
const stamp = '2026-10-09T10:00:00.123456+00:00';
const russianText = 'Лев Толстой (1828-1910) - русский писатель, автор романов «Война и мир» и «Анна Каренина». Его произведения входят в мировую литературную традицию и продолжают изучаться исследователями.';
const englishText = 'Leo Tolstoy (1828-1910) was a Russian writer who wrote the novels “War and Peace” and “Anna Karenina”. His works belong to the world literary tradition and continue to be studied by scholars.';
const source = { provider: 'Russian State Library', url: 'https://sources.fixture.invalid/tolstoy', fields: ['identity', 'life-dates', 'biography-facts', 'works'], usage: 'fact-check', retrievedAt: '2026-10-09', title: 'Verified writer reference', licenseName: 'Reference facts', licenseUrl: 'https://rights.fixture.invalid/reference' };
const russian = { locale: 'ru', text: russianText, sourceLanguage: 'Russian', status: 'reviewed', method: 'editorial-original', reviewedAt: '2026-10-09', reviewer: 'Human editorial fixture', sources: [source], authorRights: { holder: 'Russian author', permission: 'Keep raw author rights and editorial metadata', evidence: ['original-consent', { revision: 17 }] } };

function sourceBytes(file) {
  if (path.resolve(sourceRoot) === path.resolve(repo)) {
    assert.equal(/^\.(?:tmp|review)\//u.test(file), false, 'Default CURRENT must not read historical captures');
  }
  const actual = path.join(sourceRoot, file), bytes = fs.readFileSync(actual);
  const previous = graph.get(file), hash = sha(bytes);
  if (previous) assert.equal(previous.sha256, hash, `Executed source drift: ${file}`);
  else {
    if (outRoot) {
      const saved = path.join(outRoot, 'sources', file);
      fs.mkdirSync(path.dirname(saved), { recursive: true }); fs.writeFileSync(saved, bytes, { flag: 'wx' });
    }
    graph.set(file, { module: file, sha256: hash, capture: outRoot ? `sources/${file}` : null });
  }
  return bytes;
}
function modules(mocks) {
  const cache = new Map();
  const fixtureProcess = { env: { PREMIUM_TRANSLATION_PROVIDER: 'cloudflare', ADMIN_BASE_PATH: '', OPENAI_AUTO_TRANSLATE_PROFILES: 'true', OPENAI_PREMIUM_TRANSLATION_REVIEW: 'true' } };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const bytes = sourceBytes(file), filename = path.join(sourceRoot, file);
    const output = ts.transpileModule(bytes.toString('utf8'), { fileName: filename.replace(/\.mjs$/u, '.js'), compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, allowJs: true } }).outputText;
    const module = { exports: {} }; cache.set(file, module.exports);
    function requireActual(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith('@/') ? path.join(sourceRoot, 'apps/admin', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
      if (!target) return nativeRequire(name);
      for (const extension of ['', '.ts', '.tsx', '.mjs', '/index.ts']) {
        const full = target + extension;
        if (fs.existsSync(full) && fs.statSync(full).isFile()) return load(path.relative(sourceRoot, full).replaceAll('\\', '/'));
      }
      throw new Error(`Actual dependency absent: ${name} from ${file}`);
    }
    new Function('require', 'module', 'exports', 'process', 'fetch', output)(requireActual, module, module.exports, fixtureProcess, noNetwork);
    cache.set(file, module.exports); return module.exports;
  }
  return { load };
}
function matches(row, params) {
  return [...params].every(([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3));
}
function resultCheck(name, condition, expected, actual, category = 'target') {
  checks.push({ name, category, pass: !!condition, expected, actual });
}
function fixture(options = {}) {
  const fields = { name: 'Лев Толстой', fullName: 'Leo Tolstoy', biographyTranslations: { ru: structuredClone(russian) }, works: ['Война и мир'], custom: { rights: 'Keep author metadata', nested: [1, 'Ω'] } };
  const english = { locale: 'en', text: englishText, sourceLanguage: 'Russian', status: options.manualDraft ? 'draft' : 'reviewed', method: options.manual || options.manualDraft ? 'human-translation' : 'machine-translation', reviewedAt: options.manualDraft ? undefined : '2026-10-08', reviewer: 'Original admitted editor', translatedFromLocale: 'ru', sourceTextRights: 'project-original', sources: structuredClone(russian.sources), translationMeta: { provider: 'cloudflare', model: '@cf/original/translator', reviewerModel: '@cf/original/reviewer', sourceHash: digest({ writerName: 'Leo Tolstoy', text: russian.text, sourceLanguage: russian.sourceLanguage, sources: russian.sources }), generatedAt: '2026-10-08T09:00:00.000Z' } };
  if (options.manual || options.manualDraft || options.admitted) fields.biographyTranslations.en = english;
  if (options.metadataIssue) {
    fields.biographyTranslations.en = english;
    english.translationMeta = options.metadataIssue === 'null' ? null : options.metadataIssue === 'array' ? [] : 'Malformed legacy provenance';
  }
  if (options.catalogTombstone) fields.biographyTranslations.en = null;
  if (options.malformedEnglish) fields.biographyTranslations.en = { locale: 'en', method: 'human-translation', text: englishText, authorRights: { holder: 'Human draft author', consent: 'Keep incomplete authored profile' }, sources: [{ ...source, customRights: 'Keep exact source rights' }] };
  fields.biographyTranslations.fr = { locale: 'fr', text: 'Unrelated authored locale stays exact.', rights: { holder: 'French human editor' } };
  const sourceFields = structuredClone(fields);
  let row = options.absentOverride ? null : { id: overrideId, country_id: countryId, writer_id: writerId, fields: { unrelated: { authorRights: 'Keep exact override rights', locales: ['fr', 'ru', 'en'] } }, updated_at: stamp, is_enabled: true };
  if (options.overrideEnglish) row.fields.biographyTranslations = structuredClone(fields.biographyTranslations);
  const before = structuredClone(row), providerCalls = [], wire = [], mutations = [], builds = [], enqueues = [], audits = [], revalidations = [], promotions = [], discards = [], catalogLoads = [];
  let tick = 0, loaded, privateDraft = null, invokeCount = 0, stageAckUnconfirmed = false;
  const admission = createWriterAdmissionBoundary({ actorId,
    getOverride(country, writer) { return country === countryId && writer === writerId ? row : null; },
    getPrivateCandidate() { return privateDraft; },
    setPrivateCandidate(_identity, draft) { privateDraft = structuredClone(draft); } });
  const profileScans = createProfileTranslationScanBoundary({actorId, writerServer: admission});
  if (options.stageIssue) admission.fault('finish_writer_translation_operation', options.stageIssue === 'lost-ack' ? 'lost-ack' : 'malformed-ack');
  const snapshot = () => structuredClone(row);
  function newStamp() { tick++; return `2026-10-09T10:00:${String(tick).padStart(2, '0')}.123456+00:00`; }
  const fetchBoundary = async (resource, init = {}) => {
    const url = new URL(typeof resource === 'string' ? resource : resource.url);
    assert.equal(url.origin, 'https://writer.fixture.invalid');
    const method = init.method || 'GET', table = url.pathname.split('/').at(-1), payload = init.body ? JSON.parse(init.body) : null;
    wire.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), payload: structuredClone(payload) });
    let data = null, error = null;
    if (url.pathname.includes('/rpc/')) {
      if (profileScans.handles(table)) return profileScans.fetchRpc(table, payload);
      if (admission.handles(table)) {
        // The historical stage-ACK case deliberately lacks a usable readback
        // until the next invocation. A separate admission suite covers a lost
        // ACK whose committed receipt can be reconciled in the same request.
        if (stageAckUnconfirmed && invokeCount === 1 && ['reconcile_writer_translation_operation', 'get_writer_translation_operation_artifacts'].includes(table)) {
          return new Response(JSON.stringify({ code: '57014', message: 'Controlled stage readback unavailable until next invocation' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }
        const reply = await admission.fetchRpc(table, payload);
        if (table === 'finish_writer_translation_operation' && options.stageIssue && payload.p_candidate) stageAckUnconfirmed = true;
        return reply;
      }
      if (table === 'profile_translation_budget_ready' || table === 'premium_machine_translation_ready') data = true;
      else if (table === 'record_translation_sync_run') data = runId;
      else if (table === 'enqueue_public_build_request') { enqueues.push(structuredClone(payload)); data = String(enqueues.length); }
      else if (table === 'mark_public_build_dispatched' || table === 'ensure_editorial_reference') data = null;
      else if (table === 'get_premium_translation_working_draft') {
        data = { schemaVersion: 1, entityType: payload.p_entity_type, entityId: payload.p_entity_id, draft: structuredClone(privateDraft) };
        if (options.readIssue === 'missing') data = {};
        else if (options.readIssue === 'null') data = null;
        else if (options.readIssue === 'malformed') data.draft = { broken: true };
      }
      else if (table === 'stage_premium_translation_working_draft') {
        privateDraft = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', version: 1, entityType: payload.p_entity_type, entityId: payload.p_entity_id, targetLocale: 'en', humanReview: 'pending', sourceHash: payload.p_source_hash, candidateHash: digest(payload), sourceRevision: structuredClone(payload.p_source_revision), targetRevision: structuredClone(payload.p_target_revision), sourceSnapshot: structuredClone(payload.p_source_snapshot), payload: structuredClone(payload.p_payload), provenance: structuredClone(payload.p_provenance), createdAt: '2026-10-09T10:10:00.000Z', createdBy: actorId };
        data = { schemaVersion: 1, entityType: privateDraft.entityType, entityId: privateDraft.entityId, draft: structuredClone(privateDraft) };
        if (options.stageIssue === 'lost-ack') error = { code: '57014', message: 'Controlled committed stage ACK loss' };
        else if (options.stageIssue === 'malformed-ack') data.draft.version = 0;
      } else if (table === 'promote_premium_translation_working_draft') {
        promotions.push(structuredClone(payload));
        assert.ok(privateDraft, 'Candidate must exist before promotion');
        assert.equal(payload.p_draft_id, privateDraft.id); assert.equal(payload.p_expected_version, privateDraft.version);
        assert.equal(payload.p_candidate_hash, privateDraft.candidateHash); assert.equal(payload.p_confirm_human_review, true);
        assert.equal(payload.p_source_hash, privateDraft.sourceHash);
        const candidate = structuredClone(privateDraft), revision = newStamp();
        const existingMap = row && Object.hasOwn(row.fields, 'biographyTranslations') ? row.fields.biographyTranslations : sourceFields.biographyTranslations;
        const englishProfile = { locale: 'en', text: candidate.payload.text, sourceLanguage: 'Russian', status: 'reviewed', method: 'machine-translation', reviewedAt: '2026-10-09', reviewer: actorId, translatedFromLocale: 'ru', sourceTextRights: 'project-original', sources: structuredClone(candidate.sourceSnapshot.russianProfile.sources), translationMeta: { provider: candidate.provenance.provider, model: candidate.provenance.translatorModel, reviewerModel: candidate.provenance.reviewerModel, sourceHash: candidate.sourceHash, generatedAt: candidate.provenance.generatedAt } };
        row = { ...(row || { id: overrideId, country_id: countryId, writer_id: writerId }), fields: { ...(row?.fields || {}), biographyTranslations: { ...structuredClone(existingMap), en: englishProfile } }, updated_at: revision };
        mutations.push({ method: 'controlled-rpc-promote', table: 'writer_profile_overrides', payload: structuredClone(row) });
        privateDraft = null;
        data = { schemaVersion: 1, entityType: candidate.entityType, entityId: candidate.entityId, state: 'promoted', draftId: candidate.id, version: candidate.version, candidateHash: candidate.candidateHash, canonicalId: options.promoteIssue === 'wrong-target' ? 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' : row.id, canonicalUpdatedAt: revision, reviewedBy: options.promoteIssue === 'wrong-actor' ? 'ffffffff-ffff-4fff-8fff-ffffffffffff' : actorId, reviewedAt: revision };
        if (options.promoteIssue === 'lost-ack') error = { code: '57014', message: 'Controlled committed promotion ACK loss' };
      } else if (table === 'discard_premium_translation_working_draft') {
        discards.push(structuredClone(payload));
        assert.ok(privateDraft, 'Candidate must exist before discard');
        assert.equal(payload.p_draft_id, privateDraft.id); assert.equal(payload.p_expected_version, privateDraft.version); assert.equal(payload.p_candidate_hash, privateDraft.candidateHash);
        data = { schemaVersion: 1, entityType: privateDraft.entityType, entityId: privateDraft.entityId, state: 'discarded', draftId: privateDraft.id, version: privateDraft.version, candidateHash: privateDraft.candidateHash };
        privateDraft = null;
      } else throw new Error(`Unexpected controlled RPC: ${table}`);
    } else if (method === 'GET') {
      if (table === 'translation_provider_self_tests') {
        const identity = await loaded.load('apps/admin/lib/premium-translation-probe.ts').premiumTranslationConfigurationIdentity();
        data = [{ provider: 'cloudflare', configured: true, binding_found: true, test_passed: true, model: identity.configuration.model, latency_ms: 1, last_error_code: null, last_test_at: new Date().toISOString(), cooldown_until: null, test_in_progress: false, configuration_identity: identity }];
      } else if (table === 'writer_profile_overrides') data = row && matches(row, url.searchParams) ? [structuredClone(row)] : [];
      else throw new Error(`Unexpected controlled read: ${table}`);
    } else if (method === 'PATCH' || (method === 'POST' && table === 'writer_profile_overrides')) {
      assert.equal(table, 'writer_profile_overrides');
      mutations.push({ method, table, payload: structuredClone(payload), query: Object.fromEntries(url.searchParams) });
      if (method === 'POST' || (row && matches(row, url.searchParams))) { row = { ...(row || { id: overrideId }), ...structuredClone(payload), updated_at: newStamp() }; data = [structuredClone(row)]; } else data = [];
    } else if (method === 'POST' && table === 'admin_audit_log') { audits.push(structuredClone(payload)); data = null; }
    else throw new Error(`Unexpected controlled transport ${method} ${table}`);
    return new Response(JSON.stringify(error || data), { status: error ? 409 : 200, headers: { 'Content-Type': 'application/json' } });
  };
  const sdk = createClient('https://writer.fixture.invalid', 'controlled-no-live-auth', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchBoundary } });
  const ai = { async run(model, input) {
    const data = JSON.parse(input.messages[1].content), pass = Object.hasOwn(data, 'INVALID_DRAFT_TRANSLATION') ? 'repair' : Object.hasOwn(data, 'DRAFT_TRANSLATION') ? 'review' : 'translation';
    providerCalls.push({ model, pass, source: structuredClone(data.SOURCE_DATA), mutationsBeforeDispatch: mutations.length, publicEnqueuesBeforeDispatch: enqueues.length });
    return { id: `controlled-writer-${providerCalls.length}`, response: JSON.stringify({ text: englishText }), usage: { prompt_tokens: 17, completion_tokens: 29 } };
  } };
  const catalog = { version: 1, countries: [{ id: countryId, label: 'Россия', fields: { name: 'Россия' }, writers: [{ id: writerId, label: 'Лев Толстой', fields: sourceFields }] }] };
  const mocks = { '@opennextjs/cloudflare': { getCloudflareContext() { return { env: { AI: ai } }; } }, '@/lib/auth': { async requireStaff() { return { user: { id: actorId }, profile: { role: 'owner' } }; } }, '@/lib/supabase/server': { async createServerSupabaseClient() { return sdk; } }, '@/lib/editorial-catalog': { async loadEditorialCatalog(options) { catalogLoads.push(options); return structuredClone(catalog); } }, '@/lib/public-build': { async triggerPublicBuild(reason) { builds.push({ reason }); return { configured: true, ok: true, provider: 'cloudflare' }; } }, 'next/cache': { revalidatePath(value) { revalidations.push(value); } } };
  loaded = modules(mocks);
  Object.assign(mocks['@/lib/editorial-catalog'], loaded.load('apps/admin/lib/editorial-catalog.ts'));
  mocks['@/lib/editorial-catalog'].loadEditorialCatalog = async options => { catalogLoads.push(options); return structuredClone(catalog); };
  loaded.load('apps/admin/lib/editorial-catalog.ts').loadEditorialCatalog = mocks['@/lib/editorial-catalog'].loadEditorialCatalog;
  mocks['./editorial-catalog'] = mocks['@/lib/editorial-catalog'];
  function publicView() {
    const publicProfile = loaded.load('scripts/lib/writer-biography-public-profile.mjs');
    const publicOverride = loaded.load('scripts/lib/writer-biography-public-overrides.mjs');
    const overrides = publicOverride.applyPublishedWriterBiographyOverrides({ snapshotOverrides: {}, rows: row ? [row] : [], normalizeBiographyTranslations(value) { return publicProfile.normalizePublicWriterBiographyTranslations(value, { writerName: 'Leo Tolstoy' }); } });
    const countries = loaded.load('src/data/cms/editorialOverrides.ts').applyCmsWriterProfileOverrides([{ id: countryId, writers: [{ id: writerId, ...sourceFields }] }], overrides);
    const writer = countries[0].writers[0];
    return { override: overrides[`${countryId}:${writerId}`] || null, selected: loaded.load('src/data/writerBiography.ts').selectWriterBiography(writer, 'en'), display: loaded.load('src/data/writerBiographyDisplay.ts').selectWriterBiographyForDisplay(writer, 'en') };
  }
  const publicBefore = publicView();
  const invoke = () => { invokeCount++; return loaded.load('apps/admin/lib/auto-translate-writer-biography.ts').ensureWriterEnglishBiography({ supabase: sdk, actorId, countryId, writerId, sourceFields: structuredClone(sourceFields) }); };
  async function action(file, name, form) {
    try { await loaded.load(file)[name](form); throw new Error('Action failed to redirect'); }
    catch (error) { assert.equal(isRedirectError(error), true); return new URL(getURLFromRedirectError(error), 'https://admin.fixture.invalid').href; }
  }
  async function batch() { return action('apps/admin/app/(dashboard)/translations/actions.ts', 'translatePremiumWriterBatchAction', new FormData()); }
  async function saveBiography() {
    const form = new FormData(); form.set('country_id', countryId); form.set('writer_id', writerId); form.set('expected_updated_at', row?.updated_at || '');
    for (const locale of ['ru', 'en']) {
      const profile = locale === 'ru' ? russian : sourceFields.biographyTranslations.en;
      if (profile) form.set(`${locale}_enabled`, '1');
      form.set(`${locale}_text`, locale === 'ru' && options.admitted ? russianText.replace('продолжают изучаться исследователями', 'изучаются исследователями литературы') : profile?.text || ''); form.set(`${locale}_source_language`, profile?.sourceLanguage || 'Russian'); form.set(`${locale}_status`, profile?.status || 'draft');
      form.set(`${locale}_method`, profile?.method || (locale === 'ru' ? 'editorial-original' : 'human-translation')); form.set(`${locale}_reviewed_at`, profile?.reviewedAt || ''); form.set(`${locale}_reviewer`, profile?.reviewer || '');
      form.set(`${locale}_translated_from_locale`, profile?.translatedFromLocale || ''); form.set(`${locale}_source_text_rights`, profile?.sourceTextRights || ''); form.set(`${locale}_sources_json`, JSON.stringify(profile?.sources || []));
    }
    return action('apps/admin/app/(dashboard)/editorial-database/actions.ts', 'saveWriterBiographyAction', form);
  }
  async function saveProfile() {
    const edit = loaded.load('apps/admin/lib/editorial-profile-edit.ts'); const form = new FormData();
    form.set('entity_type', 'writer'); form.set('country_id', countryId); form.set('writer_id', writerId); form.set('expected_updated_at', row?.updated_at || '');
    form.append('enabled_fields', 'fullName');
    for (const key of edit.writerProfileFields) { const value = sourceFields[key]; form.set(key, Array.isArray(value) ? value.join('\n') : typeof value === 'string' ? value : ''); }
    return action('apps/admin/app/(dashboard)/editorial-database/actions.ts', 'saveEditorialProfileAction', form);
  }
  const identity = { entityType: 'writer_biography', entityId: `${countryId}:${writerId}` };
  const loadReview = () => loaded.load('apps/admin/lib/premium-translation-review.ts').loadPremiumTranslationReview({ supabase: sdk, ...identity, sourceFields });
  function reviewForm(confirm = true, change = {}) {
    assert.ok(privateDraft); const form = new FormData();
    for (const [key, value] of Object.entries({ entity_type: identity.entityType, entity_id: identity.entityId, draft_id: privateDraft.id, expected_version: String(privateDraft.version), candidate_hash: privateDraft.candidateHash, return_to: 'editorial-database', ...(confirm ? { confirm_human_review: 'yes' } : {}), ...change })) form.set(key, value);
    return form;
  }
  const reviewAction = (form, discard = false) => action('apps/admin/app/(dashboard)/translations/premium-review-actions.ts', discard ? 'discardPremiumTranslationWorkingDraftAction' : 'approvePremiumTranslationWorkingDraftAction', form);
  const renderReview = view => {
    const { renderToStaticMarkup } = nativeRequire('react-dom/server'), { createElement } = nativeRequire('react'), { load: loadHtml } = nativeRequire('cheerio');
    const Panel = loaded.load('apps/admin/components/PremiumTranslationReviewPanel.tsx').default;
    const html = renderToStaticMarkup(createElement(Panel, { view, returnTo: 'editorial-database' })), dom = loadHtml(html);
    return { html, checkboxes: dom('[name="confirm_human_review"]').length, requiredConfirmation: dom('[name="confirm_human_review"]').is('[required]'), candidateIdentity: dom('[name="entity_id"]').first().attr('value'), approvalForms: dom('form').filter((_, el) => dom(el).find('[name="confirm_human_review"]').length).length };
  };
  return { invoke, batch, saveBiography, saveProfile, publicView, publicBefore, before, sourceFields, snapshot, providerCalls, mutations, wire, builds, enqueues, audits, revalidations, promotions, discards, catalogLoads, loadReview, reviewForm, reviewAction, renderReview,
    changeTarget() { assert.ok(row); row.updated_at = newStamp(); },
    manualTakeover() { assert.ok(row); row.fields.biographyTranslations = { ...structuredClone(sourceFields.biographyTranslations), en: { ...structuredClone(english), method: 'human-translation', text: englishText } }; row.updated_at = newStamp(); },
    admission, get privateDraft() { return privateDraft; } };
}
function record(name, view, result) {
  const after = view.snapshot(), publicAfter = view.publicView();
  traces.push({ name, result, originalRow: view.before, rowAfter: after, sourceFields: view.sourceFields, publicBefore: view.publicBefore, publicAfter, providerCalls: view.providerCalls, mutations: view.mutations, wire: view.wire, builds: view.builds, enqueues: view.enqueues, privateDraft: view.privateDraft });
  return { after, publicAfter };
}

async function main() {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim();
  const newCase = fixture(); const result = await newCase.invoke(); const { after, publicAfter } = record('new machine helper', newCase, result);
  resultCheck('Helper correct machine output executes two actual premium passes', newCase.providerCalls.length === 2 && result.state === 'translated', { calls: 2, state: 'translated' }, { calls: newCase.providerCalls.length, state: result.state }, 'execution');
  resultCheck('Technical machine success leaves canonical writer row exact', digest(after) === digest(newCase.before), digest(newCase.before), digest(after));
  resultCheck('Technical machine success has explicit pending private outcome', result.humanReview === 'pending' && result.translationPersistence === 'working-draft' && result.publication === 'unchanged', { humanReview: 'pending', translationPersistence: 'working-draft', publication: 'unchanged' }, result);
  resultCheck('New machine EN is outside actual public writer admission', publicAfter.selected === null && publicAfter.display === null, null, publicAfter);
  const batchCase = fixture(); const batchRedirect = await batchCase.batch(); record('actual writer batch', batchCase, batchRedirect);
  resultCheck('Actual writer batch has no machine-triggered public enqueue or dispatch', batchCase.providerCalls.length === 2 && batchCase.enqueues.length === 0 && batchCase.builds.length === 0, { calls: 2, enqueues: 0, builds: 0 }, { calls: batchCase.providerCalls.length, enqueues: batchCase.enqueues.length, builds: batchCase.builds.length });
  const saveCase = fixture({ admitted: true }); const saveRedirect = await saveCase.saveBiography(); const saved = record('actual structured biography save', saveCase, saveRedirect);
  resultCheck('Actual biography save executes accepted RU save then helper', saveCase.providerCalls.length === 2 && saveCase.mutations.length >= 1 && saveRedirect.includes('biography-saved'), true, { calls: saveCase.providerCalls.length, mutations: saveCase.mutations.length, redirect: saveRedirect }, 'execution');
  resultCheck('Accepted RU biography save queues only its ordinary publication', saveCase.enqueues.length === 1 && !saveCase.enqueues.some(entry => entry.p_reason === 'writer_profile.biography.english_generated'), { enqueues: 1, englishGenerated: false }, saveCase.enqueues);
  resultCheck('Biography-save machine candidate stays outside actual public admission', saved.publicAfter.selected === null, null, saved.publicAfter);
  const profileCase = fixture(); const profileRedirect = await profileCase.saveProfile(); const profileSaved = record('actual generic profile save', profileCase, profileRedirect);
  resultCheck('Actual generic profile save invokes premium helper', profileCase.providerCalls.length === 2 && profileRedirect.includes('result=saved'), true, { calls: profileCase.providerCalls.length, redirect: profileRedirect }, 'execution');
  resultCheck('Generic-profile machine candidate stays outside actual public admission', profileSaved.publicAfter.selected === null, null, profileSaved.publicAfter);
  for (const [name, options, expected] of [['manual reviewed', { manual: true }, 'manual'], ['manual draft', { manualDraft: true }, 'manual'], ['admitted machine', { admitted: true }, 'current']]) {
    const control = fixture(options), outcome = await control.invoke(), final = record(name, control, outcome);
    resultCheck(`${name} stays exact and has zero provider/write/build expense`, outcome.state === expected && control.providerCalls.length === 0 && control.mutations.length === 0 && control.enqueues.length === 0 && digest(final.after) === digest(control.before), { state: expected, calls: 0, mutations: 0, enqueues: 0 }, { outcome, calls: control.providerCalls.length, mutations: control.mutations.length, enqueues: control.enqueues.length }, 'compatibility');
    if (name === 'admitted machine') resultCheck('Already admitted machine remains publicly selected', final.publicAfter.selected?.text === englishText && final.publicAfter.display?.kind === 'published', { text: englishText, kind: 'published' }, final.publicAfter, 'compatibility');
  }
  const malformed = fixture({ malformedEnglish: true, overrideEnglish: true }); const malformedResult = await malformed.invoke(), malformedAfter = record('separate malformed authored EN preservation', malformed, malformedResult);
  resultCheck('Malformed authored EN fails closed without provider expense or canonical writes', malformed.providerCalls.length === 0 && malformed.mutations.length === 0 && digest(malformedAfter.after) === digest(malformed.before), { calls: 0, writes: 0, rowUnchanged: true }, { calls: malformed.providerCalls.length, writes: malformed.mutations.length, outcome: malformedResult, rowUnchanged: digest(malformedAfter.after) === digest(malformed.before) }, 'preservation');
  for (const issue of ['null', 'array', 'text']) {
    const view = fixture({ metadataIssue: issue, overrideEnglish: true }), outcome = await view.invoke(); record(`current malformed machine metadata ${issue}`, view, outcome);
    resultCheck(`Raw machine translation metadata ${issue} is preserved without provider or write expense`, outcome.state === 'manual' && view.providerCalls.length === 0 && view.mutations.length === 0 && digest(view.snapshot()) === digest(view.before), 'Malformed legacy provenance grants no automation ownership', { outcome, calls: view.providerCalls.length, writes: view.mutations.length }, 'preservation');
  }
  const tombstone = fixture({ catalogTombstone: true }); const tombstoneResult = await tombstone.invoke(); record('current catalog English tombstone', tombstone, tombstoneResult);
  resultCheck('Explicit catalog English null never grants generation or canonical replacement', ['manual', 'skipped'].includes(tombstoneResult.state) && tombstone.providerCalls.length === 0 && tombstone.mutations.length === 0 && digest(tombstone.snapshot()) === digest(tombstone.before) && tombstone.sourceFields.biographyTranslations.en === null, 'Explicit null remains exact without expense', { tombstoneResult, calls: tombstone.providerCalls.length, writes: tombstone.mutations.length }, 'preservation');
  const pending = fixture(); await pending.invoke(); const pendingDraft = structuredClone(pending.privateDraft); const repeated = await pending.invoke(); record('current repeated pending', pending, repeated);
  resultCheck('Pending writer candidate repeats with zero additional provider or canonical expense', repeated.state === 'review-pending' && pending.providerCalls.length === 2 && pending.mutations.length === 0 && digest(pending.privateDraft) === digest(pendingDraft), { state: 'review-pending', calls: 2, writes: 0 }, { repeated, calls: pending.providerCalls.length, writes: pending.mutations.length });
  resultCheck('Private candidate binds full raw Russian and catalog rights with unrelated locales', digest(pendingDraft?.sourceSnapshot.russianProfile) === digest(pending.sourceFields.biographyTranslations.ru) && digest(pendingDraft?.sourceSnapshot.catalogFields) === digest(pending.sourceFields) && !!pendingDraft?.sourceSnapshot.catalogFields.biographyTranslations.fr, 'Exact full raw Russian/catalog snapshots', pendingDraft?.sourceSnapshot);
  for (const issue of ['missing', 'null', 'malformed']) {
    const view = fixture({ readIssue: issue }), outcome = await view.invoke(); record(`current private read ${issue}`, view, outcome);
    resultCheck(`Private read ${issue} fails closed before provider expense`, outcome.state === 'not-ready' && view.providerCalls.length === 0 && view.mutations.length === 0 && view.enqueues.length === 0, { state: 'not-ready', calls: 0, writes: 0 }, { outcome, calls: view.providerCalls.length, writes: view.mutations.length });
  }
  for (const issue of ['lost-ack', 'malformed-ack']) {
    const view = fixture({ stageIssue: issue }), first = await view.invoke(), second = await view.invoke(); record(`current private stage ${issue}`, view, { first, second });
    const paidCandidateStages = view.wire.filter(entry => entry.path.endsWith('/stage_premium_translation_working_draft') ||
      entry.path.endsWith('/finish_writer_translation_operation') && entry.payload.p_candidate).length;
    resultCheck(`Private stage ${issue} is unconfirmed and recovers exact pending candidate without regeneration`, first.state !== 'translated' && second.state === 'review-pending' && view.providerCalls.length === 2 && view.mutations.length === 0 && paidCandidateStages === 1, { first: 'unconfirmed', second: 'review-pending', calls: 2, stages: 1 }, { first, second, calls: view.providerCalls.length, writes: view.mutations.length, paidCandidateStages });
  }
  const stale = fixture(); await stale.invoke(); const staleDraft = structuredClone(stale.privateDraft); stale.sourceFields.biographyTranslations.ru.text = russianText.replace('продолжают изучаться исследователями', 'изучаются исследователями литературы'); const staleResult = await stale.invoke(), staleReview = await stale.loadReview();
  resultCheck('Changed Russian source keeps candidate visible but unapprovable without regeneration', staleResult.state === 'stale' && stale.providerCalls.length === 2 && staleReview.status === 'pending' && !staleReview.canPromote && digest(stale.privateDraft) === digest(staleDraft), { state: 'stale', calls: 2, visible: true, canPromote: false }, { staleResult, status: staleReview.status, canPromote: staleReview.canPromote, calls: stale.providerCalls.length });
  const staleCanonical = stale.snapshot(); const discarded = await stale.reviewAction(stale.reviewForm(false), true); record('current stale discard', stale, discarded);
  resultCheck('Explicit stale discard removes only private candidate and preserves canonical rights/locales', stale.privateDraft === null && digest(stale.snapshot()) === digest(staleCanonical) && stale.discards.length === 1 && stale.enqueues.length === 0 && stale.providerCalls.length === 2, 'Private-only discard', { draft: stale.privateDraft, calls: stale.providerCalls.length, discards: stale.discards.length, builds: stale.enqueues.length });
  for (const kind of ['catalog metadata', 'raw Russian rights']) {
    const metadata = fixture(); await metadata.invoke(); const original = structuredClone(metadata.privateDraft);
    if (kind === 'catalog metadata') metadata.sourceFields.custom.rights = 'Changed catalog rights without changing translated source projection';
    else metadata.sourceFields.biographyTranslations.ru.authorRights.permission = 'New author permission requiring a fresh check';
    const outcome = await metadata.invoke(), current = await metadata.loadReview(); record(`current ${kind} freshness`, metadata, outcome);
    resultCheck(`Changed ${kind} outside provider source projection prevents approval and regeneration`, outcome.state === 'stale' && current.status === 'pending' && !current.canPromote && metadata.providerCalls.length === 2 && metadata.mutations.length === 0 && digest(metadata.privateDraft) === digest(original), 'Unchanged source projection grants no fresh approval', { outcome, review: current.status, canPromote: current.canPromote, calls: metadata.providerCalls.length });
  }
  const target = fixture(); await target.invoke(); const targetDraft = structuredClone(target.privateDraft); target.changeTarget(); const targetResult = await target.invoke();
  resultCheck('Changed writer target CAS retains private candidate and blocks repeat expense', ['conflict', 'stale'].includes(targetResult.state) && target.providerCalls.length === 2 && digest(target.privateDraft) === digest(targetDraft), 'Conflict/stale with no regeneration', { targetResult, calls: target.providerCalls.length });
  const takeover = fixture(); await takeover.invoke(); takeover.manualTakeover(); const takeoverCanonical = takeover.snapshot(), takeoverResult = await takeover.invoke(), takeoverReview = await takeover.loadReview();
  resultCheck('Concurrent authored English takeover prevents approval and remains exact without generation', takeoverResult.state === 'manual' && takeover.providerCalls.length === 2 && takeoverReview.status === 'pending' && !takeoverReview.canPromote && digest(takeover.snapshot()) === digest(takeoverCanonical) && takeover.promotions.length === 0, 'Manual exact; approval blocked', { takeoverResult, view: takeoverReview.status, canPromote: takeoverReview.canPromote, calls: takeover.providerCalls.length });
  const review = fixture(); await review.invoke(); const beforeReview = review.snapshot(); const view = await review.loadReview(), panel = review.renderReview(view);
  resultCheck('Actual review panel separates RU canonical EN and candidate with required human confirmation', view.status === 'pending' && view.canPromote && panel.checkboxes === 1 && panel.requiredConfirmation && panel.candidateIdentity === `${countryId}:${writerId}` && panel.html.includes(russianText) && panel.html.includes(englishText) && panel.html.includes('Новый машинный перевод') && digest(review.snapshot()) === digest(beforeReview) && review.providerCalls.length === 2, 'Three columns, confirmation and no mutation/provider', { status: view.status, canPromote: view.canPromote, panel });
  const unconfirmed = await review.reviewAction(review.reviewForm(false));
  resultCheck('Approval without human checkbox performs no promotion or public build', review.promotions.length === 0 && review.enqueues.length === 0 && review.privateDraft !== null, 'No side effects', { redirect: unconfirmed, promotions: review.promotions.length, enqueues: review.enqueues.length });
  const mismatched = await review.reviewAction(review.reviewForm(true, { candidate_hash: '0'.repeat(64) }));
  resultCheck('Candidate receipt mismatch is rejected before promote or public build', review.promotions.length === 0 && review.enqueues.length === 0 && review.privateDraft !== null, 'No side effects', { redirect: mismatched, promotions: review.promotions.length });
  const approvalForm = review.reviewForm(true); approvalForm.set('text', 'Untrusted submitted prose must never replace the saved candidate'); approvalForm.set('actor_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff'); const approval = await review.reviewAction(approvalForm); const admitted = review.publicView(); record('current explicit human approval', review, approval);
  resultCheck('Explicit approval uses trusted stored candidate and actor receipt before one public build', review.promotions.length === 1 && review.enqueues.length === 1 && review.builds.length === 1 && review.privateDraft === null && admitted.selected?.text === englishText && admitted.selected?.reviewer === actorId && review.providerCalls.length === 2, 'Trusted candidate and session actor; one build', { promotions: review.promotions, enqueues: review.enqueues.length, builds: review.builds.length, english: admitted.selected });
  resultCheck('Approval reloads uncached writer catalog and submits exact full catalog binding', review.catalogLoads.some(options => options && Object.keys(options).length === 0) && digest(review.promotions[0]?.p_catalog_source_fields) === digest(review.sourceFields), 'Uncached catalog and full exact fields', { catalogLoads: review.catalogLoads, catalogFields: review.promotions[0]?.p_catalog_source_fields });
  for (const issue of ['lost-ack', 'wrong-target', 'wrong-actor']) {
    const view = fixture({ promoteIssue: issue }); await view.invoke(); const form = view.reviewForm(true); const outcome = await view.reviewAction(form); const second = await view.reviewAction(form); record(`current promotion ${issue}`, view, { outcome, second });
    resultCheck(`Promotion ${issue} never queues a build or blindly repeats the consumed candidate`, view.promotions.length === 1 && view.enqueues.length === 0 && view.builds.length === 0 && view.providerCalls.length === 2, 'One uncertain promotion, zero builds/retries', { promotions: view.promotions.length, enqueues: view.enqueues.length, calls: view.providerCalls.length, outcome, second });
  }
  const sources = [...graph.values()].sort((a, b) => a.module.localeCompare(b.module));
  const unchanged = sources.every(entry => sha(fs.readFileSync(path.join(sourceRoot, entry.module))) === entry.sha256);
  assert.equal(unchanged, true, 'Graph changed while executing');
  const report = { checkedAt: new Date().toISOString(), head, sourceRoot, repoStatus: status, fixture: { sha256: sha(fs.readFileSync(__filename)), path: __filename }, sourceFingerprint: digest(sources), sourceCount: sources.length, sources, unchanged, checks, traces, summary: { total: checks.length, pass: checks.filter(x => x.pass).length, fail: checks.filter(x => !x.pass).length, targetFail: checks.filter(x => !x.pass && x.category === 'target').length, preservationFail: checks.filter(x => !x.pass && x.category === 'preservation').length, executionFail: checks.filter(x => !x.pass && ['execution', 'compatibility'].includes(x.category)).length }, limitations: ['Actual writer helper, premium transport, runtime gate/probe, batch and save actions, native Next redirects, publication/run adapters and public biography projection/selector execute.', 'Installed Supabase SDK uses a controlled in-memory fetch boundary; Auth/catalog/Workers AI/outbound build are controlled. No real Auth/PostgREST/DB/RLS/provider/browser/production acceptance.', 'All machine source and model outputs are synthetic. No real network calls, paid calls, repository changes or live database writes.', 'Malformed authored EN is a separate preservation scenario; its failure is not counted as M07-T05 proof.'] };
  if (outRoot) {
    fs.writeFileSync(path.join(outRoot, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
    fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify({ head, sourceRoot, fixtureSha256: report.fixture.sha256, sourceFingerprint: report.sourceFingerprint, sources }, null, 2), { flag: 'wx' });
  }
  console.log(JSON.stringify(report));
  process.exitCode = report.summary.executionFail ? 2 : report.summary.fail ? 1 : 0;
}
main().catch(error => { const failure = { error: error.stack || String(error), checkedAt: new Date().toISOString(), sources: [...graph.values()], traces }; if (outRoot) fs.writeFileSync(path.join(outRoot, 'diagnostic.json'), JSON.stringify(failure, null, 2), { flag: 'wx' }); console.error(error.stack || error); process.exitCode = 2; });
