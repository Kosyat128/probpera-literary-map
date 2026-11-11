const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');

// Actual actions, helpers, DTOs, provider validation and exporter execute. The
// installed Supabase SDK has a synthetic fetch boundary; no live service runs.
const repo = process.env.SITE_COPY_REPO || path.resolve(__dirname, '../../../..');
const sourceRoot = process.env.SITE_COPY_SOURCE_ROOT || repo;
const outRoot = process.env.SITE_COPY_OUTPUT_ROOT || null;
const nativeRequire = createRequire(path.join(repo, 'package.json'));
const ts = nativeRequire('typescript');
const { createClient } = nativeRequire('@supabase/supabase-js');
const { isRedirectError } = nativeRequire('next/dist/client/components/redirect-error');
const { getURLFromRedirectError } = nativeRequire('next/dist/client/components/redirect');
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const equal = (left, right) => {
  try { assert.deepEqual(left, right); return true; } catch { return false; }
};
const graph = new Map(), compiledCache = new Map(), traces = [], checks = [];
const helperFile = 'apps/admin/lib/auto-translate-site-copy-private.ts';
const contractFile = 'apps/admin/lib/site-copy-translation-contract.ts';
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const blockId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const draftId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const stamp = '2026-10-29T10:00:00.123456+00:00';
const key = 'interface.Поиск';
const russianText = 'Найти книги в каталоге';
const englishText = 'Find books in the catalogue';
const canonicalEnglish = 'Previously accepted English';
const forbid = () => { throw new Error('Uncontrolled network or unrelated branch forbidden in site-copy fixture'); };
global.fetch = forbid;
const captured = new Map();
if (path.resolve(sourceRoot) !== path.resolve(repo)) {
  const original = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'source-manifest.json'), 'utf8'));
  for (const row of original.sources) captured.set(row.file, row.sha256);
  const supplement = path.join(sourceRoot, 'supplement-manifest.json');
  if (fs.existsSync(supplement)) for (const row of JSON.parse(fs.readFileSync(supplement, 'utf8'))) {
    if (captured.has(row.file)) assert.equal(captured.get(row.file), row.sha256);
    captured.set(row.file, row.sha256);
  }
  for (const [file, hash] of captured) assert.equal(sha(fs.readFileSync(path.join(sourceRoot, file))), hash, file);
}
if (outRoot) {
  fs.mkdirSync(outRoot, { recursive: true });
  assert.equal(fs.existsSync(path.join(outRoot, 'report.json')), false, 'Use a fresh output directory');
}
function sourceBytes(file) {
  if (captured.size) assert.ok(captured.has(file), `Uncaptured BEFORE dependency: ${file}`);
  const bytes = fs.readFileSync(path.join(sourceRoot, file)), hash = sha(bytes);
  if (captured.has(file)) assert.equal(hash, captured.get(file), file);
  if (graph.has(file)) assert.equal(graph.get(file).sha256, hash, `Executed source drift: ${file}`);
  else {
    graph.set(file, { file, sha256: hash });
    if (outRoot) {
      const target = path.join(outRoot, 'sources', file); fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes, { flag: 'wx' });
    }
  }
  return bytes;
}
function modules(mocks, runtimeEnv = {}) {
  const cache = new Map();
  const fixtureProcess = { env: { PREMIUM_TRANSLATION_PROVIDER: 'cloudflare', ADMIN_BASE_PATH: '',
    OPENAI_AUTO_TRANSLATE_SITE_COPY: 'true', OPENAI_PREMIUM_TRANSLATION_REVIEW: 'true', ...runtimeEnv } };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const filename = path.join(sourceRoot, file), bytes = sourceBytes(file);
    const cacheKey = `${file}:${sha(bytes)}`;
    if (!compiledCache.has(cacheKey)) compiledCache.set(cacheKey, ts.transpileModule(bytes.toString('utf8'), {
      fileName: filename.replace(/\.mjs$/u, '.js'), compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true, allowJs: true,
      },
    }).outputText);
    const compiled = compiledCache.get(cacheKey);
    const module = { exports: {} }; cache.set(file, module.exports);
    function localRequire(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith('@/') ? path.join(sourceRoot, 'apps/admin', name.slice(2))
        : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
      if (!target) return nativeRequire(name);
      for (const extension of ['', '.ts', '.tsx', '.mjs', '/index.ts']) {
        const candidate = target + extension;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return load(path.relative(sourceRoot, candidate).replaceAll('\\', '/'));
      }
      throw new Error(`Actual dependency absent: ${name} from ${file}`);
    }
    new Function('require', 'module', 'exports', 'process', 'fetch', compiled)(localRequire, module, module.exports, fixtureProcess, forbid);
    cache.set(file, module.exports); return module.exports;
  }
  return { load, env: fixtureProcess.env };
}
function check(name, condition, expected, actual, category = 'target') {
  checks.push({ name, pass: !!condition, expected, actual, category });
}
function matches(row, params) {
  return [...params].every(([field, value]) => !value.startsWith('eq.') || String(row[field]) === value.slice(3));
}
function fixture(options = {}) {
  let currentActorId = options.actorId || actorId;
  const settings = { systemKey: 'site-copy-overrides', version: 1,
    siteCopy: { ru: { [key]: russianText }, en: { [key]: canonicalEnglish },
      fr: { [key]: 'Texte humain \u2014 droits réservés' }, customLocaleMetadata: { owner: 'Keep locale metadata', list: [1, null, 'Ω'] } },
    premiumTranslation: { siteCopyEn: { [key]: { sourceHash: 'a'.repeat(64), model: 'old-model',
      reviewerModel: 'old-reviewer', generatedAt: '2026-10-28T10:00:00.000Z' } }, customRights: { keep: true, values: ['RU', 'EN', 'FR'] } },
    authoredSettings: { owner: 'Human editor', permission: ['Keep exact full JSON', { revision: 17 }], whitespace: '  Keep raw spacing  ' } };
  if (options.manual) delete settings.premiumTranslation.siteCopyEn[key];
  if (options.englishValue !== undefined || options.nullEnglish) settings.siteCopy.en[key] = options.nullEnglish ? null : options.englishValue;
  if (options.badMarker) settings.premiumTranslation.siteCopyEn[key] = { sourceHash: options.badMarker };
  if (options.badMap) settings.siteCopy.en = options.badMap;
  if (options.badMetadata) settings.premiumTranslation = options.badMetadata;
  if (options.nullMetadata) settings.premiumTranslation = null;
  if (options.absentEnglish) delete settings.siteCopy.en[key];
  if (options.current) settings.premiumTranslation.siteCopyEn[key].sourceHash = digest({ key, text: russianText });
  let row = { id: blockId, updated_at: stamp, is_enabled: true, block_type: 'text', title: 'Системные тексты сайта',
    display_order: 2_000_000_000, background_style: 'transparent', background_media_id: null, settings };
  if (options.missingCanonical) row = null;
  const before = structuredClone(row), wire = [], builds = [], providerCalls = [], mutations = [], stages = [], promotions = [], discards = [], runs = [], events = [];
  let privateDraft = null, tick = 0, readCount = 0, loaded, admission = null, readbackHeld = false, invocations = 0;
  function newStamp() { tick++; return `2026-10-29T10:${String(tick).padStart(2, '0')}:00.123456+00:00`; }
  const snapshot = () => structuredClone(row);
  const readEnvelope = identity => ({ schemaVersion: 1, entityType: identity.p_entity_type, entityId: identity.p_entity_id, draft: structuredClone(privateDraft) });
  const fetchBoundary = async (resource, init = {}) => {
    const url = new URL(typeof resource === 'string' ? resource : resource.url);
    assert.equal(url.origin, 'https://site-copy.fixture.invalid');
    const method = init.method || 'GET', table = url.pathname.split('/').at(-1), payload = init.body ? JSON.parse(init.body) : null;
    wire.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), payload: structuredClone(payload) });
    let data = null, error = null;
    if (url.pathname.includes('/rpc/')) {
      if (admission?.handles(table)) {
        if (readbackHeld && /^(?:reconcile_site_copy_translation_operation|get_site_copy_translation_operation_artifacts)$/u.test(table))
          return new Response(JSON.stringify({code: '57014', message: 'Controlled committed private result readback unavailable until a later invocation'}), {status: 409, headers: {'Content-Type': 'application/json'}});
        return admission.fetchRpc(table, payload);
      }
      if (table === 'premium_machine_translation_ready') data = true;
      else if (table === 'record_translation_sync_run') { runs.push(structuredClone(payload)); data = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; }
      else if (table === 'get_site_copy_translation_candidate_freshness') {
        const operation = admission && [...admission.operations.values()].find(value => value.result?.draftId === payload.p_draft_id);
        const linked = !!operation && !!privateDraft;
        const exact = privateDraft && privateDraft.entityType === 'site_copy' && privateDraft.entityId === payload.p_entity_id &&
          privateDraft.id === payload.p_draft_id && privateDraft.version === payload.p_expected_version &&
          privateDraft.candidateHash === payload.p_candidate_hash && privateDraft.sourceHash === payload.p_source_hash;
        const paidExact = !linked || operation.result.candidateHash === privateDraft?.candidateHash &&
          equal(operation.candidate?.payload, privateDraft?.payload) && equal(operation.candidate?.provenance, privateDraft?.provenance) &&
          equal(operation.sourceSnapshot, privateDraft?.sourceSnapshot) && equal(operation.sourceRevision, privateDraft?.sourceRevision) &&
          equal(operation.targetRevision, privateDraft?.targetRevision);
        const reason = !privateDraft ? 'candidate_missing' : !exact || !paidExact ? 'candidate_changed'
          : linked && !equal(operation.rawSeed, {version: 1, block: row}) ? 'source_changed' : null;
        data = {version: 1, entityType: 'site_copy', entityId: payload.p_entity_id, draftId: payload.p_draft_id,
          draftVersion: payload.p_expected_version, candidateHash: payload.p_candidate_hash, sourceHash: payload.p_source_hash,
          linked, canPromote: reason === null, reason};
        if (options.freshnessIssue === 'unavailable') error = {code: '42883', message: 'Controlled freshness RPC unavailable'};
        else if (options.freshnessIssue === 'malformed') data.canExecute = true;
      }
      else if (table === 'get_premium_translation_working_draft') {
        data = readEnvelope(payload);
        if (options.readIssue === 'unavailable') error = { code: '42883', message: 'Controlled private RPC unavailable' };
        else if (options.readIssue === 'missing') data = {};
        else if (options.readIssue === 'null') data = null;
        else if (options.readIssue === 'malformed') data.draft = { broken: true };
      } else if (table === 'stage_premium_translation_working_draft') {
        stages.push(structuredClone(payload));
        const revision = payload.p_source_revision;
        // Private staging retains valid paid output after a live source/CAS
        // change. Only explicit promotion below compares against live values.
        assert.equal(revision.blockId, blockId);
        assert.equal(payload.p_target_revision.id, blockId);
        assert.equal(payload.p_target_revision.updatedAt, revision.blockUpdatedAt);
        assert.equal(payload.p_source_hash, digest(payload.p_source_snapshot.items));
        if (privateDraft) error = { code: '40001', message: 'Controlled existing candidate conflict' };
        else {
          privateDraft = { id: draftId, version: 1, entityType: payload.p_entity_type, entityId: payload.p_entity_id,
            targetLocale: 'en', humanReview: 'pending', sourceHash: payload.p_source_hash, candidateHash: digest(payload),
            sourceRevision: structuredClone(revision), targetRevision: structuredClone(payload.p_target_revision),
            sourceSnapshot: structuredClone(payload.p_source_snapshot), payload: structuredClone(payload.p_payload),
            provenance: structuredClone(payload.p_provenance), createdAt: '2026-10-29T11:00:00.000Z', createdBy: actorId };
          data = readEnvelope(payload);
          if (options.stageIssue === 'lost-ack') error = { code: '57014', message: 'Controlled committed stage ACK loss' };
          else if (options.stageIssue === 'malformed-ack') data.draft.version = 0;
        }
      } else if (table === 'promote_premium_translation_working_draft') {
        promotions.push(structuredClone(payload)); assert.ok(privateDraft, 'Candidate must exist');
        const candidate = structuredClone(privateDraft), expected = { id: row.id, updatedAt: row.updated_at };
        if (payload.p_draft_id !== candidate.id || payload.p_expected_version !== candidate.version || payload.p_candidate_hash !== candidate.candidateHash ||
            !equal(candidate.sourceSnapshot.settings, row.settings) || !equal(candidate.targetRevision, expected)) {
          error = { code: '40001', message: 'Controlled candidate or source changed' };
        } else {
          assert.equal(payload.p_confirm_human_review, true); assert.equal(payload.p_source_hash, candidate.sourceHash);
          const nextSettings = structuredClone(row.settings);
          for (const item of candidate.payload.items) {
            nextSettings.siteCopy.en[item.key] = item.text;
            const sourceItem = candidate.sourceSnapshot.items.find(source => source.key === item.key);
            nextSettings.premiumTranslation.siteCopyEn[item.key] = { sourceHash: sourceItem.sourceHash,
              model: candidate.provenance.translatorModel, reviewerModel: candidate.provenance.reviewerModel,
              generatedAt: candidate.provenance.generatedAt, reviewedAt: '2026-10-29T12:00:00.000Z', reviewedBy: actorId };
          }
          row = { ...row, settings: nextSettings, updated_at: newStamp() };
          mutations.push({ method: 'controlled-rpc-promote', row: structuredClone(row) }); privateDraft = null;
          data = { schemaVersion: 1, entityType: candidate.entityType, entityId: candidate.entityId, state: 'promoted', draftId: candidate.id,
            version: candidate.version, candidateHash: candidate.candidateHash, canonicalId: options.promoteIssue === 'wrong-target'
              ? 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' : row.id, canonicalUpdatedAt: row.updated_at,
            reviewedBy: options.promoteIssue === 'wrong-actor' ? 'ffffffff-ffff-4fff-8fff-ffffffffffff' : actorId, reviewedAt: row.updated_at };
          if (options.promoteIssue === 'lost-ack') error = { code: '57014', message: 'Controlled committed promotion ACK loss' };
        }
      } else if (table === 'discard_premium_translation_working_draft') {
        discards.push(structuredClone(payload)); assert.ok(privateDraft);
        assert.equal(payload.p_draft_id, privateDraft.id); assert.equal(payload.p_expected_version, privateDraft.version); assert.equal(payload.p_candidate_hash, privateDraft.candidateHash);
        data = { schemaVersion: 1, entityType: privateDraft.entityType, entityId: privateDraft.entityId, state: 'discarded',
          draftId: privateDraft.id, version: privateDraft.version, candidateHash: privateDraft.candidateHash }; privateDraft = null;
      } else if (table === 'save_site_copy_block') {
        if (row ? payload.p_expected_updated_at !== row.updated_at : payload.p_expected_updated_at !== null) error = { code: '40001', message: 'SITE_COPY_WRITE_CONFLICT' };
        else {
          row = { ...(row || { id: blockId }), ...structuredClone(payload.p_payload), updated_at: newStamp() };
          mutations.push({ method: 'controlled-rpc-save', row: structuredClone(row) }); events.push('accepted-ru-save'); data = row.id;
        }
      } else throw new Error(`Unexpected controlled RPC: ${table}`);
    } else if (method === 'GET' && table === 'homepage_blocks') {
      readCount++;
      const rows = options.duplicateRows ? [row, { ...structuredClone(row), id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }] : [row];
      data = rows.filter(candidate => candidate && matches(candidate, url.searchParams)).map(candidate => structuredClone(candidate));
      if (url.searchParams.has('limit')) data = data.slice(0, Number(url.searchParams.get('limit')));
      const issue = readCount === 1 ? options.firstReadIssue : readCount === 2 ? options.latestReadIssue : null;
      if (issue === 'unavailable') error = { code: '57014', message: 'Controlled canonical read unavailable' };
      else if (issue === 'malformed') data = [{ ...structuredClone(row), id: null }];
      else if (issue === 'null') data = null;
    } else if (method === 'PATCH' && table === 'homepage_blocks') {
      mutations.push({ method, payload: structuredClone(payload), query: Object.fromEntries(url.searchParams) });
      if (matches(row, url.searchParams)) { row = { ...row, ...structuredClone(payload), updated_at: newStamp() }; data = [structuredClone(row)]; }
      else data = [];
    } else if (method === 'POST' && table === 'admin_audit_log') data = null;
    else throw new Error(`Unexpected controlled transport ${method} ${table}`);
    return new Response(JSON.stringify(error || data), { status: error ? 409 : 200, headers: { 'Content-Type': 'application/json' } });
  };
  const sdk = createClient('https://site-copy.fixture.invalid', 'controlled-no-live-auth', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchBoundary },
  });
  const ai = { async run(model, input) {
    const body = JSON.parse(input.messages[1].content), pass = body.INVALID_DRAFT_TRANSLATION ? 'repair' : body.DRAFT_TRANSLATION ? 'review' : 'translation';
    providerCalls.push({ model, pass, source: structuredClone(body.SOURCE_DATA) });
    events.push(`provider-${pass}`);
    if (options.providerFailure) throw new Error('Controlled provider failure after accepted RU save');
    if (options.changeDuringProvider && providerCalls.length === 2) {
      row.settings.siteCopy.ru[key] = 'Изменённый русский текст'; row.updated_at = newStamp();
    }
    if (options.manualDuringProvider && providerCalls.length === 2) {
      row.settings.siteCopy.en[key] = 'Human editor takeover'; delete row.settings.premiumTranslation.siteCopyEn[key]; row.updated_at = newStamp();
    }
    const items = body.SOURCE_DATA.items.map(item => ({ key: item.key, text: options.badProvider ? 'Неверный русский ответ' : englishText }));
    return { id: `controlled-site-copy-${providerCalls.length}`, response: JSON.stringify({ items }), usage: { prompt_tokens: 11, completion_tokens: 13 } };
  } };
  const mocks = {
    '@opennextjs/cloudflare': { getCloudflareContext: () => ({ env: { AI: ai } }) },
    '@/lib/auth': { requireStaff: async () => ({ user: { id: currentActorId }, profile: { role: 'owner' } }) },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => sdk },
    '@/lib/translation-runtime-gate': { premiumTranslationRuntimeGate: async () => { if (options.gateThrow) throw new Error('Controlled runtime transport failure'); return !options.gateOff; } },
    './translation-runtime-gate': { premiumTranslationRuntimeGate: async () => { if (options.gateThrow) throw new Error('Controlled runtime transport failure'); return !options.gateOff; } },
    '@/lib/publication': { requestPublicBuild: async input => { events.push('public-request'); builds.push({ ...input, supabase: '[installed SDK]' }); return { state: 'queued' }; } },
    '@/lib/site-copy-catalog': { loadAllSiteCopyKeys: async () => new Set([key]) },
    '@/lib/editorial-catalog': { loadEditorialCatalog: forbid, editorialCountry: forbid, editorialWriter: forbid },
    '@/lib/auto-translate-literary-work-safe': {}, '@/lib/auto-translate-writer-biography': {},
    './auto-translate-country-profile': { countryProfileTranslationSource: forbid, validateCountryTranslationCandidate: forbid },
    './auto-translate-literary-work': { validateLiteraryWorkTranslationCandidate: forbid },
    './auto-translate-writer-biography': { validateWriterBiographyTranslationCandidate: forbid, writerBiographyTranslationOwnership: forbid, writerBiographyTranslationSource: forbid },
    './writer-biography-edit': { writerBiographySourceIdentity: forbid },
    'next/cache': { revalidatePath() {} },
  };
  loaded = modules(mocks, options.env);
  // CURRENT-only SDK transport adaptation. Original captured BEFORE never
  // imports a new dependency or receives a substituted application source.
  if (fs.existsSync(path.join(sourceRoot, 'apps/admin/lib/site-copy-translation-operation-rpc.ts'))) {
    const boundaryFile = 'apps/admin/lib/fixtures/site-copy-admission-boundary.cjs'; sourceBytes(boundaryFile);
    const {createSiteCopyAdmissionBoundary} = nativeRequire(path.join(sourceRoot, boundaryFile));
    admission = createSiteCopyAdmissionBoundary({getActorId: () => currentActorId, load: loaded.load,
      now: () => options.now ? options.now() : Date.parse('2026-10-30T12:00:00.000Z'),
      getCanonicalBlocks: () => options.duplicateRows && row ? [row, {...structuredClone(row), id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'}] : row ? [row] : [],
      onEvent: name => events.push(name),
      onCommitted: (name, args, value) => {
        options.onRpcCommitted?.(name, args, value);
        if (name === 'finish_site_copy_translation_operation' && options.stageIssue ||
          name === 'record_site_copy_translation_operation_response' && options.holdResponseReadback === args.p_metadata.pass) readbackHeld = true;
      },
      async finishCandidate(operation, args) {
        if (!args.p_candidate) return {state: args.p_outcome.status === 'dead_letter' ? 'failed' : args.p_outcome.status,
          errorCode: args.p_outcome.errorCode || null, persistence: 'none', draftId: null, draftVersion: null,
          draftUpdatedAt: null, candidateHash: null, publication: 'unchanged', humanReview: 'unchanged'};
        const candidate = args.p_candidate;
        loaded.load('apps/admin/lib/site-copy-translation-contract.ts').validateSiteCopyTranslationCandidate(operation.sourceSnapshot.items, candidate.payload);
        const payload = {p_entity_type: 'site_copy', p_entity_id: operation.blockId, p_source_hash: operation.sourceHash,
          p_source_revision: operation.sourceRevision, p_target_revision: operation.targetRevision,
          p_source_snapshot: operation.sourceSnapshot, p_payload: candidate.payload, p_provenance: candidate.provenance};
        // This is a declared FINISH private-stage effect, never an invented old
        // stage RPC in the actual SDK wire. Old stage-count observations retain
        // their semantic private persistence meaning and identify the protocol.
        stages.push({protocol: 'site-copy-durable-FINISH', ...structuredClone(payload)});
        if (!privateDraft) privateDraft = {id: draftId, version: 1, entityType: 'site_copy', entityId: operation.blockId,
          targetLocale: 'en', humanReview: 'pending', sourceHash: operation.sourceHash, candidateHash: digest(payload),
          sourceRevision: structuredClone(operation.sourceRevision), targetRevision: structuredClone(operation.targetRevision),
          sourceSnapshot: structuredClone(operation.sourceSnapshot), payload: structuredClone(candidate.payload),
          provenance: structuredClone(candidate.provenance), createdAt: '2026-10-30T12:00:01.000Z', createdBy: currentActorId};
        return {state: args.p_outcome.status === 'succeeded' ? 'translated' : args.p_outcome.status === 'dead_letter' ? 'failed' : args.p_outcome.status,
          errorCode: args.p_outcome.errorCode || null, persistence: 'working-draft', draftId: privateDraft.id,
          draftVersion: privateDraft.version, draftUpdatedAt: privateDraft.createdAt, candidateHash: privateDraft.candidateHash,
          publication: 'unchanged', humanReview: 'pending'};
      }});
    if (options.stageIssue) admission.fault('finish_site_copy_translation_operation',
      options.stageIssue === 'lost-ack' ? 'lost-ack' : 'malformed-ack', 2);
  }
  if (options.legacyCurrentRaw) {
    row.settings.siteCopy.ru[key] = '  Найти книги\r\n\u2014 в каталоге  ';
    const projected = loaded.load('apps/admin/lib/site-copy-storage.ts').readSiteCopyValues(row.settings.siteCopy).ru[key];
    row.settings.premiumTranslation.siteCopyEn[key].sourceHash = digest({ key, text: projected });
    Object.assign(before, structuredClone(row));
  }
  if (options.rawCanonical) {
    row.settings.siteCopy.ru[key] = '  Найти книги\r\n\u2014 в каталоге  ';
    row.settings.siteCopy.en[key] = '  Previously accepted \u2014 English\r\nwith raw spacing  ';
    row.settings.siteCopy.ru['interface.Право'] = '';
    row.settings.siteCopy.en['interface.Право'] = { rights: ['Keep raw authored value', null] };
    Object.assign(before, structuredClone(row));
  }
  if (options.savePreservation) {
    row.settings.siteCopy.ru[key] = '  Основной русский\r\n\u2014 текст  ';
    row.settings.siteCopy.en[key] = '  Human English \u2014 draft\r\nwith author spacing  ';
    row.settings.siteCopy.ru['interface.Сосед'] = '  Соседний русский\r\n\u2014 текст  ';
    row.settings.siteCopy.en['interface.Сосед'] = '  Accepted neighbour \u2014 English\r\nwith original spacing  ';
    row.settings.siteCopy.ru['interface.Пустой'] = '  \r\n  ';
    row.settings.siteCopy.en['interface.Пустой'] = null;
    const projected = loaded.load('apps/admin/lib/site-copy-storage.ts').readSiteCopyValues(row.settings.siteCopy);
    row.settings.premiumTranslation.siteCopyEn['interface.Сосед'] = { sourceHash: digest({ key: 'interface.Сосед', text: projected.ru['interface.Сосед'] }),
      model: 'admitted-neighbour', authorRights: { owner: 'Keep exact neighbour metadata' } };
    row.settings.premiumTranslation.siteCopyEn['interface.Пустой'] = { sourceHash: 'f'.repeat(64), authorRights: { owner: 'Keep tombstone marker' } };
    if (options.savePreservation === 'english-only') row.settings.premiumTranslation.siteCopyEn[key] = { sourceHash: digest({ key, text: projected.ru[key] }), model: 'admitted-original' };
    else delete row.settings.premiumTranslation.siteCopyEn[key];
    Object.assign(before, structuredClone(row));
  }
  const publicView = () => loaded.load('scripts/site-copy-overrides.mjs').extractSiteCopyFromHomepageBlocks([row]).siteCopy;
  async function action(file, name, form) {
    try { await loaded.load(file)[name](form); throw new Error('Action did not redirect'); }
    catch (error) { assert.equal(isRedirectError(error), true, error.stack); return new URL(getURLFromRedirectError(error), 'https://admin.fixture.invalid').href; }
  }
  const invoke = (extra = {}) => {
    if (++invocations > 1) readbackHeld = false;
    return loaded.load(helperFile).ensureSiteCopyEnglishTranslation({ supabase: sdk, actorId: currentActorId, blockId, ...extra });
  };
  const batch = () => action('apps/admin/app/(dashboard)/translations/actions.ts', 'translatePremiumSiteCopyBatchAction', new FormData());
  const save = () => {
    const form = new FormData(); form.set('expected_updated_at', row?.updated_at || stamp);
    form.append('copy_key', key); form.append('copy_ru', `${russianText} \u2014 новое`); form.append('copy_en', canonicalEnglish);
    return action('apps/admin/app/(dashboard)/site-copy/actions.ts', 'saveSiteCopyAction', form);
  };
  const saveProjected = (change = {}) => {
    const projected = loaded.load('apps/admin/lib/site-copy-storage.ts').readSiteCopyValues(row.settings.siteCopy);
    const form = new FormData(); form.set('expected_updated_at', row.updated_at);
    for (const copyKey of Object.keys(row.settings.siteCopy.ru)) {
      form.append('copy_key', copyKey);
      form.append('copy_ru', copyKey === key && Object.hasOwn(change, 'ru') ? change.ru : projected.ru[copyKey] || '');
      form.append('copy_en', copyKey === key && Object.hasOwn(change, 'en') ? change.en : projected.en[copyKey] || '');
    }
    return action('apps/admin/app/(dashboard)/site-copy/actions.ts', 'saveSiteCopyAction', form);
  };
  const loadReview = () => loaded.load('apps/admin/lib/premium-translation-review.ts').loadPremiumTranslationReview({ supabase: sdk, entityType: 'site_copy', entityId: blockId });
  const reviewForm = (confirm = true, extra = {}) => {
    assert.ok(privateDraft); const form = new FormData();
    for (const [field, value] of Object.entries({ entity_type: 'site_copy', entity_id: blockId, draft_id: privateDraft.id,
      expected_version: String(privateDraft.version), candidate_hash: privateDraft.candidateHash, return_to: 'site-copy',
      ...(confirm ? { confirm_human_review: 'yes' } : {}), ...extra })) form.set(field, value);
    return form;
  };
  const reviewAction = (form, discard = false) => action('apps/admin/app/(dashboard)/translations/premium-review-actions.ts',
    discard ? 'discardPremiumTranslationWorkingDraftAction' : 'approvePremiumTranslationWorkingDraftAction', form);
  const renderReview = view => {
    const { renderToStaticMarkup } = nativeRequire('react-dom/server'), { createElement } = nativeRequire('react'), { load: loadHtml } = nativeRequire('cheerio');
    const Panel = loaded.load('apps/admin/components/PremiumTranslationReviewPanel.tsx').default;
    const html = renderToStaticMarkup(createElement(Panel, { view, returnTo: 'site-copy' })), dom = loadHtml(html);
    return { html, checkboxes: dom('[name="confirm_human_review"]').length,
      required: dom('[name="confirm_human_review"]').is('[required]'), identity: dom('[name="entity_id"]').first().attr('value'),
      approvalForms: dom('form').filter((_, element) => dom(element).find('[name="confirm_human_review"]').length).length };
  };
  return { invoke, batch, save, saveProjected, loadReview, reviewForm, reviewAction, renderReview, snapshot, before, publicView, providerCalls,
    wire, builds, mutations, stages, promotions, discards, runs, events, loaded,
    sdk, ai, mocks, options, admission,
    setActor(value) { currentActorId = value; },
    setRow(value) { row = structuredClone(value); },
    setPrivateDraft(value) { privateDraft = structuredClone(value); },
    changeSource() { row.settings.siteCopy.ru[key] = 'Другой русский исходник'; row.updated_at = newStamp(); },
    changeRawSettings() { row.settings.authoredSettings.permission.push({ changedRights: true }); row.updated_at = newStamp(); },
    changeTarget() { row.updated_at = newStamp(); },
    manualTakeover() { row.settings.siteCopy.en[key] = 'Human editor takeover'; delete row.settings.premiumTranslation.siteCopyEn[key]; row.updated_at = newStamp(); },
    get privateDraft() { return structuredClone(privateDraft); } };
}
function record(name, view, result) {
  traces.push({ name, result, originalRow: view.before, rowAfter: view.snapshot(), publicAfter: view.publicView(),
    privateDraft: view.privateDraft, providerCalls: view.providerCalls, wire: view.wire, builds: view.builds, mutations: view.mutations, events: view.events });
}

async function main() {
  const batch = fixture(), destination = await batch.batch(); record('Actual batch', batch, destination);
  check('Actual batch executes two premium provider passes', equal(batch.providerCalls.map(call => call.pass), ['translation', 'review']), ['translation', 'review'], batch.providerCalls, 'execution');
  check('Actual batch technical success preserves canonical settings and does not request publication', equal(batch.snapshot(), batch.before) && batch.builds.length === 0,
    { canonicalExact: true, builds: 0 }, { canonicalExact: equal(batch.snapshot(), batch.before), builds: batch.builds.length });
  check('Actual exporter retains accepted EN after machine completion', batch.publicView().en[key] === canonicalEnglish, canonicalEnglish, batch.publicView().en[key]);
  check('Actual batch stores explicit pending private machine output', batch.privateDraft?.humanReview === 'pending' && batch.privateDraft.payload.items[0].text === englishText,
    { humanReview: 'pending', text: englishText }, batch.privateDraft);
  const save = fixture(), saveDestination = await save.save(); record('Actual ordinary save', save, saveDestination);
  check('Actual ordinary save invokes two premium passes after accepted RU save', save.providerCalls.length === 2 && save.mutations.length === 1 && save.snapshot().settings.siteCopy.ru[key] !== russianText &&
    save.events.indexOf('accepted-ru-save') < save.events.indexOf('provider-translation'),
    { providerCalls: 2, acceptedSaveCount: 1, ruChanged: true, saveBeforeProvider: true }, { providerCalls: save.providerCalls.length, acceptedSaveCount: save.mutations.length, ruChanged: save.snapshot().settings.siteCopy.ru[key] !== russianText, events: save.events });
  check('Ordinary save publishes accepted RU with prior canonical EN only', save.builds.length === 1 && save.snapshot().settings.siteCopy.en[key] === canonicalEnglish && save.publicView().en[key] === canonicalEnglish && !!save.privateDraft,
    { builds: 1, canonicalEnglish, pending: true }, { builds: save.builds.length, en: save.publicView().en[key], draft: save.privateDraft });
  check('Ordinary save preserves other locales and raw unrelated settings', equal(save.snapshot().settings.siteCopy.fr, save.before.settings.siteCopy.fr) &&
    equal(save.snapshot().settings.siteCopy.customLocaleMetadata, save.before.settings.siteCopy.customLocaleMetadata) && equal(save.snapshot().settings.authoredSettings, save.before.settings.authoredSettings),
    { fr: save.before.settings.siteCopy.fr, metadata: save.before.settings.siteCopy.customLocaleMetadata, raw: save.before.settings.authoredSettings }, save.snapshot().settings, 'preservation');

  if (!fs.existsSync(path.join(sourceRoot, helperFile))) {
    return finish();
  }
  const deleted = fixture({ missingCanonical: true }), deletedDestination = await deleted.save(); record('Stale form after canonical deletion', deleted, deletedDestination);
  const deletedSaveRequests = deleted.wire.filter(call => call.path.endsWith('/rpc/save_site_copy_block'));
  check('Stale form with expected revision cannot recreate a missing canonical block', new URL(deletedDestination).searchParams.get('errorCode') === 'write_conflict' &&
    deletedSaveRequests.length === 0 && deleted.snapshot() === null && deleted.providerCalls.length === 0 && deleted.stages.length === 0 && deleted.builds.length === 0,
    { redirect: 'write_conflict', saveRequests: 0, canonical: null, calls: 0, stages: 0, builds: 0 },
    { deletedDestination, saveRequests: deletedSaveRequests, canonical: deleted.snapshot(), calls: deleted.providerCalls.length, stages: deleted.stages.length, builds: deleted.builds.length });
  const russianOnly = fixture({ savePreservation: 'russian-only' });
  const russianOnlyDestination = await russianOnly.saveProjected({ ru: 'Изменённый русский исходник' }); record('Ordinary RU-only raw preservation', russianOnly, russianOnlyDestination);
  const ruOnlySettings = russianOnly.snapshot().settings, ruOnlyBefore = russianOnly.before.settings;
  check('Ordinary RU-only save preserves unchanged raw manual EN neighbour locales and tombstone ownership',
    ruOnlySettings.siteCopy.ru[key] === 'Изменённый русский исходник' && ruOnlySettings.siteCopy.en[key] === ruOnlyBefore.siteCopy.en[key] &&
    ruOnlySettings.siteCopy.ru['interface.Сосед'] === ruOnlyBefore.siteCopy.ru['interface.Сосед'] &&
    ruOnlySettings.siteCopy.en['interface.Сосед'] === ruOnlyBefore.siteCopy.en['interface.Сосед'] &&
    ruOnlySettings.siteCopy.ru['interface.Пустой'] === ruOnlyBefore.siteCopy.ru['interface.Пустой'] &&
    Object.hasOwn(ruOnlySettings.siteCopy.en, 'interface.Пустой') && ruOnlySettings.siteCopy.en['interface.Пустой'] === null &&
    equal(ruOnlySettings.premiumTranslation.siteCopyEn, ruOnlyBefore.premiumTranslation.siteCopyEn) &&
    equal(ruOnlySettings.siteCopy.fr, ruOnlyBefore.siteCopy.fr) && equal(ruOnlySettings.authoredSettings, ruOnlyBefore.authoredSettings) &&
    russianOnly.providerCalls.length === 0 && russianOnly.stages.length === 0 && russianOnly.builds.length === 1 && russianOnly.mutations.length === 1,
    { ruChanged: true, rawManualEnExact: true, neighbourRuEnExact: true, blankRuNullEnMarkerExact: true, calls: 0, builds: 1, acceptedSaves: 1 },
    { before: ruOnlyBefore, after: ruOnlySettings, calls: russianOnly.providerCalls.length, builds: russianOnly.builds.length, acceptedSaves: russianOnly.mutations.length }, 'preservation');
  const englishOnly = fixture({ savePreservation: 'english-only' });
  const englishOnlyDestination = await englishOnly.saveProjected({ en: 'Human editor replacement' }); record('Ordinary EN-only raw preservation', englishOnly, englishOnlyDestination);
  const enOnlySettings = englishOnly.snapshot().settings, enOnlyBefore = englishOnly.before.settings;
  check('Ordinary EN-only save preserves unchanged raw RU and removes only explicitly edited EN ownership',
    equal(enOnlySettings.siteCopy.ru, enOnlyBefore.siteCopy.ru) && enOnlySettings.siteCopy.en[key] === 'Human editor replacement' &&
    enOnlySettings.siteCopy.en['interface.Сосед'] === enOnlyBefore.siteCopy.en['interface.Сосед'] &&
    Object.hasOwn(enOnlySettings.siteCopy.en, 'interface.Пустой') && enOnlySettings.siteCopy.en['interface.Пустой'] === null &&
    !Object.hasOwn(enOnlySettings.premiumTranslation.siteCopyEn, key) &&
    equal(enOnlySettings.premiumTranslation.siteCopyEn['interface.Сосед'], enOnlyBefore.premiumTranslation.siteCopyEn['interface.Сосед']) &&
    equal(enOnlySettings.premiumTranslation.siteCopyEn['interface.Пустой'], enOnlyBefore.premiumTranslation.siteCopyEn['interface.Пустой']) &&
    equal(enOnlySettings.siteCopy.fr, enOnlyBefore.siteCopy.fr) && equal(enOnlySettings.authoredSettings, enOnlyBefore.authoredSettings) &&
    englishOnly.providerCalls.length === 0 && englishOnly.stages.length === 0 && englishOnly.builds.length === 1 && englishOnly.mutations.length === 1,
    { rawRuExact: true, explicitEnReplacement: true, onlyEditedMarkerRemoved: true, neighbourTombstoneExact: true, calls: 0, builds: 1, acceptedSaves: 1 },
    { before: enOnlyBefore, after: enOnlySettings, calls: englishOnly.providerCalls.length, builds: englishOnly.builds.length, acceptedSaves: englishOnly.mutations.length }, 'preservation');
  for (const options of [{ gateOff: true }, { providerFailure: true }, { gateThrow: true }]) {
    const trial = fixture(options), destination = await trial.save(); record('Ordinary save translation unavailable', trial, destination);
    check(`Ordinary accepted RU save survives ${options.gateOff ? 'runtime disabled' : options.gateThrow ? 'optional helper transport throw' : 'provider failure'} with only ordinary publication`,
      trial.mutations.length === 1 && trial.snapshot().settings.siteCopy.ru[key] !== russianText && trial.snapshot().settings.siteCopy.en[key] === canonicalEnglish &&
      trial.builds.length === 1 && trial.builds[0].reason === 'site-copy.updated' && trial.privateDraft === null &&
      (!options.gateOff || trial.providerCalls.length === 0),
      { acceptedSave: 1, ruChanged: true, en: canonicalEnglish, ordinaryBuilds: 1, privateDraft: null },
      { mutations: trial.mutations.length, ru: trial.snapshot().settings.siteCopy.ru[key], en: trial.snapshot().settings.siteCopy.en[key], builds: trial.builds, draft: trial.privateDraft, events: trial.events });
  }
  for (const lane of ['batch', 'save']) {
    const trial = fixture({ duplicateRows: true }), destination = await trial[lane](); record(`Duplicate canonical rows ${lane}`, trial, destination);
    check(`Duplicate canonical rows fail closed in actual ${lane} before provider or write expense`, trial.providerCalls.length === 0 && trial.mutations.length === 0 &&
      trial.builds.length === 0 && trial.privateDraft === null && equal(trial.snapshot(), trial.before),
      { calls: 0, mutations: 0, builds: 0, privateDraft: null, exact: true }, { destination, calls: trial.providerCalls.length, mutations: trial.mutations.length, builds: trial.builds.length, privateDraft: trial.privateDraft });
  }
  const duplicateHelper = fixture({ duplicateRows: true }), duplicateHelperResult = await duplicateHelper.invoke();
  check('Duplicate canonical rows fail closed in direct helper before provider expense', duplicateHelperResult.state === 'failed' && duplicateHelper.providerCalls.length === 0 &&
    duplicateHelper.stages.length === 0 && equal(duplicateHelper.snapshot(), duplicateHelper.before),
    { state: 'failed', calls: 0, stages: 0, exact: true }, { duplicateHelperResult, calls: duplicateHelper.providerCalls.length, stages: duplicateHelper.stages.length });
  const fresh = fixture(), result = await fresh.invoke(); record('Actual helper', fresh, result);
  check('Helper has explicit technical success with pending human review and unchanged publication', result.state === 'translated' && result.humanReview === 'pending' &&
    result.publication === 'unchanged' && result.translationPersistence === 'working-draft' && equal(fresh.snapshot(), fresh.before) && fresh.providerCalls.length === 2,
    { state: 'translated', humanReview: 'pending', publication: 'unchanged', translationPersistence: 'working-draft', calls: 2, canonicalExact: true }, { result, calls: fresh.providerCalls.length, canonicalExact: equal(fresh.snapshot(), fresh.before) });
  const draft = fresh.privateDraft;
  check('Private candidate binds full raw settings and exact block revisions', !!draft && equal(draft.sourceSnapshot.settings, fresh.before.settings) &&
    equal(draft.sourceRevision, { blockId, blockUpdatedAt: stamp }) && equal(draft.targetRevision, { id: blockId, updatedAt: stamp }) &&
    equal(draft.sourceSnapshot.items, [{ key, text: russianText, sourceHash: digest({ key, text: russianText }) }]),
    { fullSettings: fresh.before.settings, sourceRevision: { blockId, blockUpdatedAt: stamp }, targetRevision: { id: blockId, updatedAt: stamp } }, draft);
  const repeated = await fresh.invoke();
  check('Pending candidate repeats with zero additional provider or canonical expense', repeated.state === 'review-pending' && fresh.providerCalls.length === 2 && fresh.stages.length === 1 && equal(fresh.snapshot(), fresh.before),
    { state: 'review-pending', calls: 2, stages: 1, canonicalExact: true }, { repeated, calls: fresh.providerCalls.length, stages: fresh.stages.length });
  const budgeted = fixture();
  const budget = budgeted.loaded.load('apps/admin/lib/translation-operation-budget.ts').createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: 1, deadlineMs: 45_000 });
  const budgetResult = await budgeted.invoke({ operationBudget: budget }); record('Shared helper provider budget', budgeted, budgetResult);
  check('Helper forwards shared budget so reviewer cannot exceed admitted provider call cap', budgetResult.state === 'failed' && budgeted.providerCalls.length === 1 &&
    budgeted.providerCalls[0].pass === 'translation' && budget.snapshot().providerCalls === 1 && budgeted.privateDraft === null && budgeted.stages.length === 0 &&
    equal(budgeted.snapshot(), budgeted.before) && budgeted.builds.length === 0,
    { state: 'failed', calls: 1, pass: 'translation', stages: 0, exact: true, builds: 0 },
    { budgetResult, calls: budgeted.providerCalls, budget: budget.snapshot(), stages: budgeted.stages.length, builds: budgeted.builds.length });
  const raw = fixture({ rawCanonical: true }), rawResult = await raw.invoke(); record('Raw canonical JSON preservation', raw, rawResult);
  check('Raw RU EN whitespace CRLF dashes and authored JSON remain exact outside private candidate', rawResult.state === 'translated' && raw.providerCalls.length === 2 &&
    equal(raw.snapshot(), raw.before) && equal(raw.privateDraft?.sourceSnapshot.settings, raw.before.settings),
    { translated: true, calls: 2, canonicalExact: true, rawSnapshotExact: true },
    { rawResult, calls: raw.providerCalls.length, canonicalExact: equal(raw.snapshot(), raw.before), draft: raw.privateDraft }, 'preservation');

  for (const [label, options] of [
    ['Manual existing EN', { manual: true }], ['Present blank manual EN', { manual: true, englishValue: '' }],
    ['Present null manual EN', { manual: true, nullEnglish: true }], ['Malformed marker cannot own EN', { badMarker: 'broken' }],
    ['Non-string EN with machine marker', { englishValue: { text: 'Keep malformed authored value' } }],
    ['Malformed top locale map', { badMap: [] }], ['Malformed premium metadata', { badMetadata: [] }],
    ['Null top premium metadata', { nullMetadata: true }],
    ['Current admitted machine EN', { current: true }], ['Legacy current hash with raw whitespace CRLF and long dash', { legacyCurrentRaw: true }],
  ]) {
    const view = fixture(options), outcome = await view.invoke(); record(label, view, outcome);
    check(`${label} stays exact without provider or canonical writes`, view.providerCalls.length === 0 && view.mutations.length === 0 && view.stages.length === 0 && view.builds.length === 0 && equal(view.snapshot(), view.before),
      { calls: 0, mutations: 0, stages: 0, builds: 0, exact: true }, { outcome, calls: view.providerCalls.length, mutations: view.mutations.length, stages: view.stages.length, exact: equal(view.snapshot(), view.before) }, 'preservation');
  }
  const absent = fixture({ absentEnglish: true, badMarker: 'broken' }), absentResult = await absent.invoke(); record('Absent EN with incomplete marker', absent, absentResult);
  check('Absent EN with incomplete historical marker stages privately while preserving raw metadata', absentResult.state === 'translated' && absent.providerCalls.length === 2 &&
    absent.privateDraft?.payload.items[0].text === englishText && equal(absent.snapshot(), absent.before) && equal(absent.privateDraft.sourceSnapshot.settings, absent.before.settings),
    { state: 'translated', calls: 2, privateCandidate: true, exact: true }, { absentResult, calls: absent.providerCalls.length, privateDraft: absent.privateDraft });
  for (const [label, englishValue] of [['Blank machine EN', ''], ['Whitespace machine EN', '   \r\n  '], ['Cyrillic machine EN', 'Ранее сохранённый машинный текст']]) {
    const trial = fixture({ current: true, englishValue }), outcome = await trial.invoke(); record(`${label} with matching hash`, trial, outcome);
    check(`${label} with matching source hash stages privately instead of claiming current`, outcome.state === 'translated' && trial.providerCalls.length === 2 &&
      trial.privateDraft?.humanReview === 'pending' && trial.privateDraft.payload.items[0].text === englishText && equal(trial.snapshot(), trial.before) && trial.builds.length === 0,
      { state: 'translated', calls: 2, privateCandidate: true, canonicalExact: true, builds: 0 },
      { outcome, calls: trial.providerCalls.length, privateDraft: trial.privateDraft, canonicalExact: equal(trial.snapshot(), trial.before), builds: trial.builds.length });
  }
  for (const issue of ['unavailable', 'missing', 'null', 'malformed']) {
    const view = fixture({ readIssue: issue }), outcome = await view.invoke(); record(`Private read ${issue}`, view, outcome);
    check(`Private read ${issue} fails closed before provider expense`, outcome.state !== 'translated' && view.providerCalls.length === 0 && view.stages.length === 0 && equal(view.snapshot(), view.before),
      { noTranslation: true, calls: 0, stages: 0, exact: true }, { outcome, calls: view.providerCalls.length, stages: view.stages.length, exact: equal(view.snapshot(), view.before) });
  }
  for (const issue of ['lost-ack', 'malformed-ack']) {
    const view = fixture({ stageIssue: issue }), first = await view.invoke(), stored = view.privateDraft, second = await view.invoke(); record(`Stage ${issue}`, view, { first, second });
    check(`Stage ${issue} stays unconfirmed then recovers candidate without regeneration`, first.state !== 'translated' && stored?.humanReview === 'pending' &&
      second.state === 'review-pending' && view.providerCalls.length === 2 && view.stages.length === 1 && equal(view.snapshot(), view.before) && equal(view.privateDraft, stored),
      { firstUnconfirmed: true, pending: true, repeat: 'review-pending', calls: 2, stages: 1, exact: true }, { first, second, calls: view.providerCalls.length, stages: view.stages.length });
  }
  for (const [label, options] of [['Changed RU source', { changeDuringProvider: true }], ['Manual takeover', { manualDuringProvider: true }]]) {
    const concurrent = fixture(options), first = await concurrent.invoke(), kept = concurrent.privateDraft, live = concurrent.snapshot(), second = await concurrent.invoke(), view = await concurrent.loadReview();
    const approval = await concurrent.reviewAction(concurrent.reviewForm()); record(`${label} during provider`, concurrent, { first, second, view, approval });
    check(`${label} during provider retains stale private output without canonical mutation or repeat calls`, first.state === 'stale' && first.humanReview === 'pending' &&
      kept?.payload.items[0].text === englishText && kept.sourceSnapshot.settings.siteCopy.en[key] === canonicalEnglish &&
      concurrent.privateDraft !== null && equal(concurrent.snapshot(), live) && concurrent.providerCalls.length === 2 && concurrent.stages.length === 1 &&
      view.status === 'pending' && !view.canPromote && concurrent.promotions.length === 0 && concurrent.builds.length === 0,
      { first: 'stale', pending: true, savedOutput: englishText, canonicalExactAfterConcurrency: true, calls: 2, stages: 1, noPromotion: true },
      { first, second, view, kept, calls: concurrent.providerCalls.length, stages: concurrent.stages.length, promotions: concurrent.promotions.length, builds: concurrent.builds.length });
  }
  for (const issue of ['unavailable', 'malformed', 'null']) {
    const trial = fixture({ latestReadIssue: issue }), first = await trial.invoke(), stored = trial.privateDraft, second = await trial.invoke(); record(`Latest canonical read ${issue}`, trial, { first, second });
    check(`Latest source read ${issue} retains received result with unknown freshness and zero regeneration`, first.state === 'translated' && first.sourceFreshness === 'unknown' &&
      first.humanReview === 'pending' && stored?.payload.items[0].text === englishText && second.state === 'review-pending' && trial.providerCalls.length === 2 &&
      trial.stages.length === 1 && equal(trial.snapshot(), trial.before) && equal(trial.privateDraft, stored),
      { first: 'translated', freshness: 'unknown', pending: true, repeat: 'review-pending', calls: 2, stages: 1, exact: true },
      { first, second, calls: trial.providerCalls.length, stages: trial.stages.length, privateDraft: trial.privateDraft });
  }
  for (const issue of ['unavailable', 'malformed', 'null']) {
    const trial = fixture({ firstReadIssue: issue }), outcome = await trial.invoke(); record(`Initial canonical read ${issue}`, trial, outcome);
    check(`Initial source read ${issue} fails closed before provider expense`, outcome.state === 'failed' && trial.providerCalls.length === 0 && trial.stages.length === 0 && equal(trial.snapshot(), trial.before),
      { state: 'failed', calls: 0, stages: 0, exact: true }, { outcome, calls: trial.providerCalls.length, stages: trial.stages.length });
  }

  for (const [name, mutate] of [['Changed RU source', 'changeSource'], ['Changed raw authored settings', 'changeRawSettings'], ['Changed block CAS', 'changeTarget'], ['Concurrent manual takeover', 'manualTakeover']]) {
    const view = fixture(); await view.invoke(); view[mutate](); const live = view.snapshot(), repeatedResult = await view.invoke(), review = await view.loadReview();
    const approval = await view.reviewAction(view.reviewForm()); record(name, view, { repeatedResult, review, approval });
    check(`${name} keeps candidate visible but unapprovable without regeneration`, !!view.privateDraft && review.status === 'pending' && !review.canPromote &&
      repeatedResult.state !== 'translated' && view.providerCalls.length === 2 && view.promotions.length === 0 && view.builds.length === 0 && equal(view.snapshot(), live),
      { pending: true, canPromote: false, calls: 2, canonicalExact: true, promotions: 0, builds: 0 },
      { repeatedResult, review, approval, calls: view.providerCalls.length, canonicalExact: equal(view.snapshot(), live), promotions: view.promotions.length, builds: view.builds.length });
  }
  const review = fixture(); await review.invoke(); const reviewBefore = review.snapshot(), view = await review.loadReview(), panel = review.renderReview(view);
  check('Actual review panel separates RU canonical EN and candidate with required human confirmation', view.status === 'pending' && view.canPromote && panel.checkboxes === 1 && panel.required &&
    panel.identity === blockId && panel.html.includes(russianText) && panel.html.includes(canonicalEnglish) && panel.html.includes(englishText) && equal(review.snapshot(), reviewBefore) && review.providerCalls.length === 2,
    { pending: true, canPromote: true, requiredCheckbox: true, threeTexts: true, noExpense: true }, { view, panel });
  const noConfirm = await review.reviewAction(review.reviewForm(false));
  check('Approval without human checkbox cannot promote or request publication', review.promotions.length === 0 && review.builds.length === 0 && equal(review.snapshot(), reviewBefore),
    { promotions: 0, builds: 0, canonicalExact: true }, { noConfirm, promotions: review.promotions.length, builds: review.builds.length });
  const wrongHash = await review.reviewAction(review.reviewForm(true, { candidate_hash: 'f'.repeat(64) }));
  check('Candidate receipt mismatch is rejected before promotion or publication', review.promotions.length === 0 && review.builds.length === 0 && !!review.privateDraft && equal(review.snapshot(), reviewBefore),
    { promotions: 0, builds: 0, pending: true }, { wrongHash, promotions: review.promotions.length, builds: review.builds.length });
  const approved = await review.reviewAction(review.reviewForm()); record('Explicit approval', review, approved);
  check('Explicit approval promotes trusted stored candidate before one public request', review.promotions.length === 1 && review.builds.length === 1 && review.builds[0].entityType === 'site_copy' &&
    review.builds[0].entityId === blockId && review.privateDraft === null && review.publicView().en[key] === englishText && review.providerCalls.length === 2,
    { promotions: 1, builds: 1, entityType: 'site_copy', canonicalId: blockId, publicEnglish: englishText, calls: 2 }, { promotions: review.promotions.length, builds: review.builds, privateDraft: review.privateDraft, publicEnglish: review.publicView().en[key], calls: review.providerCalls.length });
  check('Explicit promotion preserves other locales and raw authored settings', equal(review.snapshot().settings.siteCopy.fr, reviewBefore.settings.siteCopy.fr) &&
    equal(review.snapshot().settings.siteCopy.customLocaleMetadata, reviewBefore.settings.siteCopy.customLocaleMetadata) && equal(review.snapshot().settings.authoredSettings, reviewBefore.settings.authoredSettings),
    { fr: reviewBefore.settings.siteCopy.fr, raw: reviewBefore.settings.authoredSettings }, review.snapshot().settings, 'preservation');
  const discard = fixture(); await discard.invoke(); discard.changeSource(); const discardBefore = discard.snapshot(), discardDestination = await discard.reviewAction(discard.reviewForm(), true); record('Explicit stale discard', discard, discardDestination);
  check('Explicit stale discard removes only private candidate without publication', discard.discards.length === 1 && discard.privateDraft === null && discard.builds.length === 0 &&
    equal(discard.snapshot(), discardBefore) && discard.providerCalls.length === 2, { discards: 1, privateDraft: null, builds: 0, exact: true, calls: 2 }, { discards: discard.discards.length, privateDraft: discard.privateDraft, builds: discard.builds.length, exact: equal(discard.snapshot(), discardBefore), calls: discard.providerCalls.length });
  for (const issue of ['lost-ack', 'wrong-target', 'wrong-actor']) {
    const trial = fixture({ promoteIssue: issue }); await trial.invoke(); const trialForm = trial.reviewForm(), first = await trial.reviewAction(trialForm), second = await trial.reviewAction(trialForm); record(`Promotion ${issue}`, trial, { first, second });
    check(`Promotion ${issue} never requests a build or blindly repeats consumed candidate`, trial.builds.length === 0 && trial.promotions.length === 1 && trial.providerCalls.length === 2,
      { builds: 0, promotions: 1, calls: 2 }, { first, second, builds: trial.builds.length, promotions: trial.promotions.length, calls: trial.providerCalls.length });
  }
  const contract = fixture().loaded.load(contractFile);
  const source = await contract.siteCopyTranslationSource(fresh.before.settings);
  for (const [name, payload] of [['Changed key', { items: [{ key: 'interface.other', text: englishText }] }], ['Duplicate key', { items: [{ key, text: englishText }, { key, text: englishText }] }], ['Non-English payload', { items: [{ key, text: russianText }] }]]) {
    let rejected = false; try { contract.validateSiteCopyTranslationCandidate(source.items, payload); } catch { rejected = true; }
    check(`${name} candidate is rejected by actual contract`, rejected, true, rejected);
  }
  const orderedSource = [...source.items, { key: 'interface.Еще', text: 'Ещё', sourceHash: digest({ key: 'interface.Еще', text: 'Ещё' }) }];
  let orderRejected = false;
  try { contract.validateSiteCopyTranslationCandidate(orderedSource, { items: orderedSource.map(item => ({ key: item.key, text: englishText })).reverse() }); }
  catch { orderRejected = true; }
  check('Changed item order is rejected by actual contract', orderRejected, true, orderRejected);
  finish();
}
function finish() {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  const sources = [...graph.values()];
  const unchanged = sources.every(row => sha(fs.readFileSync(path.join(sourceRoot, row.file))) === row.sha256) &&
    [...captured].every(([file, hash]) => sha(fs.readFileSync(path.join(sourceRoot, file))) === hash);
  const report = { checkedAt: new Date().toISOString(), head, sourceRoot, fixture: { path: __filename, sha256: sha(fs.readFileSync(__filename)) },
    sourceFingerprint: digest(sources), sources, unchanged, checks, traces,
    currentOnlyControlsAvailable: fs.existsSync(path.join(sourceRoot, helperFile)),
    summary: { total: checks.length, pass: checks.filter(row => row.pass).length, fail: checks.filter(row => !row.pass).length,
      targetFail: checks.filter(row => !row.pass && row.category === 'target').length,
      preservationFail: checks.filter(row => !row.pass && row.category === 'preservation').length,
      executionFail: checks.filter(row => !row.pass && row.category === 'execution').length },
    limitations: ['Installed Supabase SDK, actual premium translator/reviewer, native Next redirects, actions, private DTO/review/panel and exporter execute with synthetic content.',
      'Auth, runtime approval, catalog key inventory, Workers AI binding, PostgREST RPC storage and public build requests are controlled boundaries.',
      'No live database, RLS, paid provider, external network, browser or production acceptance is claimed.'] };
  if (outRoot) {
    fs.writeFileSync(path.join(outRoot, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
    fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify({ head, sourceRoot, fixtureSha256: report.fixture.sha256, sources }, null, 2), { flag: 'wx' });
  }
  process.stdout.write(JSON.stringify(report)); process.exitCode = report.summary.executionFail ? 2 : report.summary.fail ? 1 : 0;
}
main().catch(error => {
  const diagnostic = { error: error.stack || String(error), graph: [...graph.values()], checks, traces };
  if (outRoot) fs.writeFileSync(path.join(outRoot, 'diagnostic.json'), JSON.stringify(diagnostic, null, 2), { flag: 'wx' });
  console.error(error.stack || error); process.exitCode = 2;
});
