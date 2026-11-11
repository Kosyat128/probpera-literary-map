const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const repo = process.env.SITE_COPY_REPO || path.resolve(__dirname, '../../../..');
const outRoot = process.env.SITE_COPY_RECOVERY_OUTPUT_ROOT || null;
const req = createRequire(path.join(repo, 'package.json'));
const ts = req('typescript');
const { createClient } = req('@supabase/supabase-js');
const { renderToStaticMarkup } = req('react-dom/server');
const { createElement } = req('react');
const { load: html } = req('cheerio');
const { isRedirectError } = req('next/dist/client/components/redirect-error');
const { getURLFromRedirectError } = req('next/dist/client/components/redirect');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => sha(JSON.stringify(value));
const graph = new Map(), compiled = new Map(), checks = [], traces = [];
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stamp = '2026-10-29T10:00:00.123456+00:00';
const recreatedId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const key = 'interface.Search';
const russian = 'Сохранённый русский источник';
const english = 'Saved private English candidate';
const forbid = () => { throw new Error('No provider, uncontrolled network or unrelated branch may run'); };
global.fetch = forbid;

function modules(mocks) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const filename = path.join(repo, file), bytes = fs.readFileSync(filename), hash = sha(bytes);
    if (graph.has(file)) assert.equal(graph.get(file).sha256, hash, `Executed source drift: ${file}`);
    else graph.set(file, { file, sha256: hash });
    const identity = `${file}:${hash}`;
    if (!compiled.has(identity)) compiled.set(identity, ts.transpileModule(bytes.toString('utf8'), {
      fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText);
    const module = { exports: {} }; cache.set(file, module.exports);
    const localRequire = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith('@/') ? path.join(repo, 'apps/admin', name.slice(2))
        : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
      if (!target) return req(name);
      for (const extension of ['', '.ts', '.tsx']) {
        const candidate = target + extension;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return load(path.relative(repo, candidate).replaceAll('\\', '/'));
      }
      throw new Error(`Actual dependency absent: ${name}`);
    };
    new Function('require', 'module', 'exports', 'process', 'fetch', compiled.get(identity))(localRequire, module, module.exports,
      { env: { ADMIN_BASE_PATH: '/admin', PREMIUM_TRANSLATION_PROVIDER: 'cloudflare' } }, forbid);
    cache.set(file, module.exports); return module.exports;
  }
  return { load };
}
function candidate(index) {
  const suffix = String(index).padStart(12, '0'), entityId = `b0000000-0000-4000-8000-${suffix}`;
  const settings = { systemKey: 'site-copy-overrides', siteCopy: { ru: { [key]: russian }, en: { [key]: 'Old accepted English' },
    fr: { [key]: 'Keep authored French' } }, premiumTranslation: { siteCopyEn: { [key]: { sourceHash: 'a'.repeat(64) } } },
    authoredRights: { owner: 'Original source editor', evidence: ['Keep raw full JSON', null] } };
  const items = [{ key, text: russian, sourceHash: digest({ key, text: russian }) }];
  return { id: `d0000000-0000-4000-8000-${suffix}`, version: 1, entityType: 'site_copy', entityId,
    targetLocale: 'en', humanReview: 'pending', sourceHash: digest(items), candidateHash: digest({ index, english }),
    sourceRevision: { blockId: entityId, blockUpdatedAt: stamp }, targetRevision: { id: entityId, updatedAt: stamp },
    sourceSnapshot: { settings, items }, payload: { items: [{ key, text: english }] },
    provenance: { provider: 'cloudflare', translatorModel: 'controlled-translator', reviewerModel: 'controlled-reviewer',
      translatorRequestId: 'controlled-translation', reviewerRequestId: 'controlled-review', generatedAt: stamp }, createdAt: stamp, createdBy: actorId };
}
function fixture({ recreated = false, count = 1, discoveryUnavailable = false } = {}) {
  const canonical = recreated ? { id: recreatedId, updated_at: '2026-10-29T12:00:00.123456+00:00',
    settings: { systemKey: 'site-copy-overrides', siteCopy: { ru: { [key]: 'Новый русский мастер' }, en: { [key]: 'New accepted English master' },
      fr: { [key]: 'Keep new authored French' } }, authoredRights: { owner: 'New canonical editor' } } } : null;
  const canonicalBefore = structuredClone(canonical), drafts = new Map(Array.from({ length: count }, (_, index) => candidate(index + 1)).map(draft => [draft.entityId, draft]));
  const wire = [], builds = [], discards = [], promotions = [], unexpected = [], rendered = [];
  const fetchBoundary = async (resource, init = {}) => {
    const url = new URL(typeof resource === 'string' ? resource : resource.url), method = init.method || 'GET';
    assert.equal(url.origin, 'https://site-copy-recovery.fixture.invalid');
    const name = url.pathname.split('/').at(-1), payload = init.body ? JSON.parse(init.body) : null;
    wire.push({ method, path: url.pathname, payload: structuredClone(payload), query: Object.fromEntries(url.searchParams) });
    let data = null, error = null;
    if (url.pathname.includes('/rpc/')) {
      if (name === 'reconcile_site_copy_translation_operation') {
        assert.deepEqual(payload, {p_operation_id: null});
        data = null;
      } else if (name === 'list_site_copy_premium_translation_working_drafts') {
        assert.equal(payload.p_limit, 10);
        const remaining = [...drafts.values()].sort((left, right) => left.id.localeCompare(right.id)).filter(draft => !payload.p_after_id || draft.id > payload.p_after_id);
        const page = remaining.slice(0, payload.p_limit);
        data = { schemaVersion: 1, entityIds: page.map(draft => draft.entityId), nextCursor: remaining.length > payload.p_limit ? page.at(-1).id : null };
        if (discoveryUnavailable) error = { code: '42501', message: 'Controlled staff private discovery unavailable' };
      } else if (name === 'get_premium_translation_working_draft') {
        data = { schemaVersion: 1, entityType: payload.p_entity_type, entityId: payload.p_entity_id, draft: structuredClone(drafts.get(payload.p_entity_id) || null) };
      } else if (name === 'discard_premium_translation_working_draft') {
        discards.push(structuredClone(payload)); const draft = drafts.get(payload.p_entity_id); assert.ok(draft);
        assert.equal(payload.p_draft_id, draft.id); assert.equal(payload.p_expected_version, draft.version); assert.equal(payload.p_candidate_hash, draft.candidateHash);
        data = { schemaVersion: 1, entityType: draft.entityType, entityId: draft.entityId, state: 'discarded', draftId: draft.id, version: draft.version, candidateHash: draft.candidateHash };
        drafts.delete(draft.entityId);
      } else if (name === 'promote_premium_translation_working_draft') {
        promotions.push(payload); error = { code: '40001', message: 'Unexpected promotion of stale orphan' };
      } else { unexpected.push({ method, name, payload }); error = { code: '42501', message: 'Unexpected private recovery RPC' }; }
    } else if (name === 'homepage_blocks' && method === 'GET') data = canonical ? [structuredClone(canonical)] : [];
    else { unexpected.push({ method, name, payload }); error = { code: '42501', message: 'Unexpected recovery table access' }; }
    return new Response(JSON.stringify(error || data), { status: error ? 409 : 200, headers: { 'Content-Type': 'application/json' } });
  };
  const sdk = createClient('https://site-copy-recovery.fixture.invalid', 'controlled-no-live-auth', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchBoundary },
  });
  const mocks = {
    '@/lib/supabase/server': { createServerSupabaseClient: async () => sdk },
    '@/lib/auth': { requireStaff: async () => ({ user: { id: actorId }, profile: { role: 'owner' } }),
      getStaffSession: async () => ({configured: true, user: {id: actorId}, role: 'owner',
        mfa: {required: false, checkError: null}, authError: null, membershipError: null}) },
    '@/lib/site-copy-catalog': { loadAllSiteCopyCatalog: async () => [{ key, group: 'Core fields', label: 'Search label', defaultRu: 'Поиск', defaultEn: 'Search' }] },
    '@/app/(dashboard)/site-copy/actions': { saveSiteCopyAction: forbid },
    '@/lib/publication': { requestPublicBuild: async input => { builds.push(input); return { state: 'queued' }; } },
    '@/lib/editorial-catalog': { loadEditorialCatalog: forbid, editorialCountry: forbid, editorialWriter: forbid },
    './auto-translate-country-profile': { countryProfileTranslationSource: forbid, validateCountryTranslationCandidate: forbid },
    './auto-translate-literary-work': { validateLiteraryWorkTranslationCandidate: forbid },
    './auto-translate-writer-biography': { validateWriterBiographyTranslationCandidate: forbid, writerBiographyTranslationOwnership: forbid, writerBiographyTranslationSource: forbid },
    './writer-biography-edit': { writerBiographySourceIdentity: forbid },
    '@opennextjs/cloudflare': { getCloudflareContext: forbid },
    'next/cache': { revalidatePath() {} },
    'next/link': { __esModule: true, default: ({ children, ...props }) => createElement('a', { ...props, 'data-next-link': 'true' }, children) },
  };
  const loaded = modules(mocks);
  async function render(query = {}) {
    const Page = loaded.load('apps/admin/app/(dashboard)/site-copy/page.tsx').default;
    const markup = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }));
    rendered.push({ query, markup }); return { markup, $: html(markup) };
  }
  function form(view) {
    const form = new FormData();
    view.$('section[id^="site-copy-translation-review-"]').first().find('input[type="hidden"]').each((_, node) => form.set(view.$(node).attr('name'), view.$(node).attr('value')));
    form.set('confirm_human_review', 'yes'); return form;
  }
  async function act(form, discard = false) {
    try {
      await loaded.load('apps/admin/app/(dashboard)/translations/premium-review-actions.ts')[discard ? 'discardPremiumTranslationWorkingDraftAction' : 'approvePremiumTranslationWorkingDraftAction'](form);
      throw new Error('Expected native Next redirect');
    } catch (error) { assert.equal(isRedirectError(error), true, error.stack); return getURLFromRedirectError(error); }
  }
  return { render, form, act, wire, builds, discards, promotions, unexpected, rendered, drafts,
    snapshot: () => structuredClone(canonical), canonicalBefore };
}
async function recovery(recreated) {
  const view = fixture({ recreated }), first = await view.render(), orphan = candidate(1), submitted = view.form(first);
  assert.equal(first.$('section[id^="site-copy-translation-review-"]').length, 1);
  assert.equal(first.$('[name="entity_id"]').first().attr('value'), orphan.entityId);
  assert.equal(first.$('[name="confirm_human_review"]').length, 0);
  assert.ok(first.markup.includes(english)); assert.ok(first.markup.includes(russian));
  assert.ok(first.markup.includes('Удалить машинный черновик'));
  assert.equal(first.$('form.site-copy-editor').length, 1);
  assert.equal(first.$('[name="expected_updated_at"]').attr('value'), recreated ? view.canonicalBefore.updated_at : '');
  const blocked = await view.act(submitted); assert.ok(new URL(blocked, 'https://admin.fixture.invalid').searchParams.get('error'));
  assert.equal(view.promotions.length, 0); assert.equal(view.builds.length, 0); assert.equal(view.drafts.size, 1);
  const destination = await view.act(submitted, true), after = await view.render();
  assert.equal(view.discards.length, 1); assert.equal(view.discards[0].p_entity_id, orphan.entityId);
  assert.equal(view.drafts.size, 0); assert.equal(after.$('section[id^="site-copy-translation-review-"]').length, 0);
  assert.equal(view.builds.length, 0); assert.equal(view.promotions.length, 0); assert.equal(view.unexpected.length, 0);
  assert.deepEqual(view.snapshot(), view.canonicalBefore);
  if (recreated) { assert.ok(after.markup.includes('New accepted English master')); assert.ok(after.markup.includes('Новый русский мастер')); }
  traces.push({ recreated, blocked, destination, canonicalBefore: view.canonicalBefore, canonicalAfter: view.snapshot(), wire: view.wire, rendered: view.rendered });
  checks.push({ name: recreated ? 'Recreated canonical master still discovers old private candidate and discards only the orphan' : 'Deleted canonical master still discovers private candidate and permits safe explicit discard', pass: true });
}
async function pagination() {
  const view = fixture({ count: 11 }), first = await view.render();
  const panels = first.$('section[id^="site-copy-translation-review-"]');
  assert.equal(panels.length, 10); assert.equal(new Set(panels.map((_, node) => first.$(node).attr('id')).get()).size, 10);
  const next = first.$('a[href*="review_after="]'); assert.equal(next.length, 1); assert.equal(next.attr('data-next-link'), 'true');
  const cursor = new URL(next.attr('href'), 'https://admin.fixture.invalid').searchParams.get('review_after');
  assert.equal(cursor, candidate(10).id);
  const second = await view.render({ review_after: cursor });
  assert.equal(second.$('section[id^="site-copy-translation-review-"]').length, 1);
  assert.equal(second.$('[name="entity_id"]').first().attr('value'), candidate(11).entityId);
  assert.equal(second.$('a[href*="review_after="]').length, 0);
  const listCalls = view.wire.filter(call => call.path.endsWith('/rpc/list_site_copy_premium_translation_working_drafts'));
  assert.deepEqual(listCalls.map(call => call.payload), [{ p_after_id: null, p_limit: 10 }, { p_after_id: cursor, p_limit: 10 }]);
  assert.equal(view.unexpected.length, 0); assert.equal(view.discards.length, 0); assert.equal(view.promotions.length, 0); assert.equal(view.builds.length, 0); assert.equal(view.drafts.size, 11);
  traces.push({ name: 'Bounded discovery paging', wire: view.wire, rendered: view.rendered });
  checks.push({ name: 'Actual page uses bounded private discovery cursor and distinct candidate panels across pages', pass: true });
}
async function unavailable() {
  const view = fixture({ recreated: true, discoveryUnavailable: true }), page = await view.render();
  assert.equal(page.$('form.site-copy-editor').length, 1);
  assert.equal(page.$('section[id^="site-copy-translation-review-"]').length, 0);
  assert.ok(page.$('[role="alert"]').text().includes('Список машинных кандидатов недоступен'));
  assert.ok(page.markup.includes('New accepted English master'));
  assert.equal(view.wire.filter(call => call.path.endsWith('/rpc/get_premium_translation_working_draft')).length, 0);
  assert.deepEqual(view.snapshot(), view.canonicalBefore); assert.equal(view.drafts.size, 1);
  assert.equal(view.unexpected.length, 0); assert.equal(view.discards.length, 0); assert.equal(view.promotions.length, 0); assert.equal(view.builds.length, 0);
  traces.push({ name: 'Private discovery unavailable', wire: view.wire, rendered: view.rendered, canonicalBefore: view.canonicalBefore, canonicalAfter: view.snapshot() });
  checks.push({ name: 'Unavailable private discovery keeps canonical editor available without false empty candidate receipt or mutation', pass: true });
}
(async () => {
  await recovery(false); await recovery(true); await pagination(); await unavailable();
  const sources = [...graph.values()], unchanged = sources.every(row => sha(fs.readFileSync(path.join(repo, row.file))) === row.sha256);
  assert.equal(unchanged, true);
  const report = { checkedAt: new Date().toISOString(), repo, fixtureSha256: sha(fs.readFileSync(__filename)), unchanged, checks, sources, traces,
    limitations: ['Actual page, editor, review panel, discovery DTO/loader, inspection and approval/discard actions execute with installed Supabase SDK and native Next redirects.',
      'Auth/catalog keys/PostgREST storage RPCs and build boundary are controlled. No live DB/RLS/ACL/provider/browser/production acceptance is claimed. No provider path is allowed.'] };
  if (outRoot) {
    fs.mkdirSync(outRoot, { recursive: true });
    fs.writeFileSync(path.join(outRoot, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
    fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify({ fixtureSha256: report.fixtureSha256, sources }, null, 2), { flag: 'wx' });
    for (const source of sources) { const target = path.join(outRoot, 'sources', source.file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(repo, source.file), target, fs.constants.COPYFILE_EXCL); }
  }
  process.stdout.write(JSON.stringify(report));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
