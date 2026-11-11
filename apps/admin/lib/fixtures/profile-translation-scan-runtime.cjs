const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {createRequire} = require('node:module');
const repo = process.env.PROFILE_SCAN_REPO || path.resolve(__dirname, '../../../..');
const sourceRoot = process.env.PROFILE_SCAN_SOURCE_ROOT || repo;
const output = process.env.PROFILE_SCAN_OUTPUT_ROOT || fs.mkdtempSync(path.join(path.resolve(repo, '../work'), 'profile-scan-current-'));
fs.mkdirSync(output, {recursive: true});
Object.assign(process.env, {CATALOG_ADMISSION_REPO: repo, CATALOG_ADMISSION_SOURCE_ROOT: sourceRoot, CATALOG_ADMISSION_OUTPUT_ROOT: path.join(output, 'country-runtime'),
  WRITER_ADMISSION_REPO: repo, WRITER_ADMISSION_SOURCE_ROOT: sourceRoot, WRITER_ADMISSION_OUTPUT_ROOT: path.join(output, 'writer-runtime')});
const native = createRequire(path.join(repo, 'package.json')), {createClient} = native('@supabase/supabase-js');
const {isRedirectError} = native('next/dist/client/components/redirect-error'), {getURLFromRedirectError} = native('next/dist/client/components/redirect');
const countryRuntime = require('./catalog-admission-runtime.cjs'), writerRuntime = require('./writer-admission-runtime.cjs');
const {createProfileTranslationScanBoundary} = require('./profile-translation-scan-boundary.cjs');
let serial = 0;

function createProfileTranslationScanRuntime(kind, options = {}) {
  const total = options.count ?? (kind === 'country' ? 60 : 240);
  const view = kind === 'country' ? countryRuntime.setup(kind, {...options, noManual: true, candidates: Math.max(1, total)})
    : writerRuntime.setup({...options, noManual: true, candidates: Math.max(1, total)});
  const caseOutput = path.join(output, `scan-${++serial}-${kind}`); fs.mkdirSync(caseOutput);
  const entries = [], catalogReads = [];
  let catalogUnavailable = false;
  if (kind === 'country') {
    const template = structuredClone(view.countries[0]); view.countries.length = 0;
    for (let index = 0; index < total; index++) {
      const row = structuredClone(template), suffix = String(index + 1).padStart(12, '0');
      row.id = `scan-country-${String(index).padStart(5, '0')}`; row.label = `Scan country ${index}`;
      row.fields.id = row.id; row.fields.name = row.label; row.row.id = `bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`;
      row.row.country_id = row.id; row.row.fields.name = row.label;
      if (options.manualAll !== false) row.row.fields.translations.en.method = 'human-translation';
      view.countries.push(row); entries.push({id: row.id, label: row.label, fields: row.fields, writers: []});
    }
  } else {
    const template = structuredClone(view.writers[0]), rowTemplate = structuredClone(view.rows.get(view.writers[0].id));
    view.writers.length = 0; view.rows.clear();
    for (let index = 0; index < total; index++) {
      const writer = structuredClone(template), suffix = String(index + 1).padStart(12, '0');
      writer.id = `scan_writer_${String(index).padStart(5, '0')}`; writer.label = `Scan writer ${index}`;
      writer.fields.name = writer.label; delete writer.fields.biographyTranslations.en;
      const row = structuredClone(rowTemplate); row.id = `bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`; row.writer_id = writer.id;
      if (options.manualAll !== false) row.fields.biographyTranslations = {en: {...structuredClone(view.russian), locale: 'en',
        method: 'human-translation', text: view.englishText, manualRights: {preserve: 'Exact signed English consent'}}};
      view.writers.push(writer); view.rows.set(writer.id, row); entries.push(writer);
    }
    view.catalog.countries[0].writers = entries;
  }
  const catalog = kind === 'country' ? {version: 1, countries: entries} : view.catalog;
  let tupleRows = null;
  if (kind === 'writer' && options.tupleCollision) {
    const template = structuredClone(entries[0]), rowTemplate = structuredClone([...view.rows.values()][0]);
    tupleRows = new Map(); entries.length = 0; catalog.countries.length = 0;
    for (const [index, countryId] of ['russia', 'france'].entries()) {
      const writer = structuredClone(template); writer.id = 'shared_writer'; writer.label = `${countryId} shared writer`; writer.fields.name = writer.label;
      const row = structuredClone(rowTemplate); row.id = `cccccccc-cccc-4ccc-8ccc-${String(index + 1).padStart(12, '0')}`;
      row.country_id = countryId; row.writer_id = writer.id; row.fields.tupleRights = {countryId, preserve: 'Distinct manual author row'};
      tupleRows.set(`${countryId}:${writer.id}`, row); entries.push(writer);
      catalog.countries.push({id: countryId, label: countryId, fields: {name: countryId}, writers: [writer]});
    }
  }
  const actualCatalog = view.load('apps/admin/lib/editorial-catalog.ts');
  const catalogBoundary = view.mocks['@/lib/editorial-catalog'] || {};
  Object.assign(catalogBoundary, {editorialCountry: actualCatalog.editorialCountry, editorialWriter: actualCatalog.editorialWriter,
    async loadEditorialCatalog(input) {
      catalogReads.push(input === undefined ? null : structuredClone(input));
      if (catalogUnavailable) throw new Error('Controlled server catalog unavailable');
      return structuredClone(catalog);
    }});
  // Relative and alias imports share the same actual module boundary. Existing
  // writer runtime eagerly loads its action before this fixture expands tuples.
  actualCatalog.loadEditorialCatalog = catalogBoundary.loadEditorialCatalog;
  view.mocks['@/lib/editorial-catalog'] = catalogBoundary;
  view.mocks['./editorial-catalog'] = catalogBoundary;
  const scans = createProfileTranslationScanBoundary({actorId: view.actorId,
    writerServer: kind === 'writer' ? view.server : null, catalogServer: kind === 'country' ? view.server : null,
    writerIdentity: (country, writer) => view.load('apps/admin/lib/premium-translation-working-draft.ts').writerBiographyCandidateIdentity(country, writer)});
  const scanWire = [], guardedDispatches = [];
  let cacheReadbackHeld = false, completeResponseLost = false;
  const scanClient = createClient('https://profile-scan.fixture.invalid', 'synthetic-no-auth-session', {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
    global: {fetch: async (resource, init = {}) => {
      const url = new URL(typeof resource === 'string' ? resource : resource.url), name = url.pathname.split('/').at(-1), args = init.body ? JSON.parse(init.body) : null;
      assert.equal(init.method, 'POST');
      if (name === 'premium_machine_translation_ready') return new Response('true', {headers: {'Content-Type': 'application/json'}});
      if (/^record_(?:writer|catalog)_translation_operation_response$/u.test(name)) {
        await view.server.fetchRpc(name, args);
        completeResponseLost = true; cacheReadbackHeld = true;
        throw new TypeError('Controlled complete reviewed response persisted but its SDK acknowledgement was lost');
      }
      if (/^(?:reconcile_(?:writer|catalog)_translation_operation|get_(?:writer|catalog)_translation_operation_artifacts)$/u.test(name) && cacheReadbackHeld)
        return new Response(JSON.stringify({code: '57014', message: 'Controlled retained complete body readback unavailable in this invocation'}), {status: 409, headers: {'Content-Type': 'application/json'}});
      if (name === 'get_translation_job_resume') {
        const window = scans.windows.get(args.p_job_id); assert.ok(window);
        const data = {id: window.jobId, kind: window.kind, status: window.status,
          resumeCursor: {profileScan: {version: 1, scanId: window.scanId, windowIndex: window.windowIndex}}};
        return new Response(JSON.stringify(data), {headers: {'Content-Type': 'application/json'}});
      }
      if (/^record_(?:writer|catalog)_translation_operation_dispatch$/u.test(name)) {
        guardedDispatches.push({name, args: structuredClone(args)});
        return new Response(JSON.stringify({code: '42501', message: 'Controlled actual attached window stopped before dispatch'}),
          {status: 409, headers: {'Content-Type': 'application/json'}});
      }
      assert.ok(scans.handles(name)); scanWire.push({name, args: structuredClone(args)});
      return scans.fetchRpc(name, args);
    }}
  });
  const oldRpc = view.sdk.rpc.bind(view.sdk);
  const retainedBodyTransport = (name, args) => options.retainCompleteBody && (
    !completeResponseLost && /^record_(?:writer|catalog)_translation_operation_response$/u.test(name) && args?.p_metadata?.pass === 'review' ||
    cacheReadbackHeld && /^(?:reconcile_(?:writer|catalog)_translation_operation|get_(?:writer|catalog)_translation_operation_artifacts)$/u.test(name));
  view.sdk.rpc = (name, args, config) => scans.handles(name) || name === 'get_translation_job_resume' || name === 'premium_machine_translation_ready' ||
    retainedBodyTransport(name, args) ||
    /^record_(?:writer|catalog)_translation_operation_dispatch$/u.test(name) && scans.attachedDispatchBlocked(args.p_operation_id)
      ? scanClient.rpc(name, args, config) : oldRpc(name, args, config);
  if (tupleRows) {
    const tupleClient = createClient('https://profile-tuple.fixture.invalid', 'synthetic-no-auth-session', {
      auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}, global: {fetch: async (resource, init = {}) => {
        const url = new URL(typeof resource === 'string' ? resource : resource.url), query = Object.fromEntries(url.searchParams);
        assert.equal(init.method || 'GET', 'GET'); assert.equal(url.pathname, '/rest/v1/writer_profile_overrides');
        const countryId = query.country_id.slice(3), writerId = query.writer_id.slice(3), row = tupleRows.get(`${countryId}:${writerId}`);
        view.wire.push({method: 'GET', path: url.pathname, query, body: null});
        assert.ok(row, 'Exact country/writer tuple must bind an actual declared row');
        const columns = query.select.split(','), projected = Object.fromEntries(columns.map(column => [column, structuredClone(row[column])]));
        return new Response(JSON.stringify([projected]), {headers: {'Content-Type': 'application/json'}});
      }}
    });
    const oldFrom = view.sdk.from.bind(view.sdk); view.sdk.from = table => table === 'writer_profile_overrides' ? tupleClient.from(table) : oldFrom(table);
  }
  let intent = crypto.randomUUID(), requestedJobId = null;
  const authorRows = () => kind === 'country' ? structuredClone(view.countries) : structuredClone([...(tupleRows || view.rows).values()]);
  const sourceRows = () => structuredClone(entries);
  const initialIds = entries.map(entry => entry.id);
  const helperIds = wire => wire.filter(item => item.method === 'GET' && item.path?.endsWith(kind === 'country' ? '/country_profile_overrides' : '/writer_profile_overrides'))
    .map(item => String(item.query[kind === 'country' ? 'country_id' : 'writer_id']).slice(3));
  async function invoke(input = {}) {
    if (input.fresh) {intent = crypto.randomUUID(); requestedJobId = null;}
    const form = new FormData(), beforeCalls = view.providerCalls.length, beforeWire = view.wire.length,
      beforeObservations = scans.observations.length, beforeScanWire = scanWire.length;
    if (requestedJobId) form.set(`${kind}Job`, requestedJobId); else form.set(`${kind}ScanIntent`, intent);
    for (const [key, value] of Object.entries(input.form || {})) {if (value === null) form.delete(key); else form.set(key, String(value));}
    let redirect;
    const actionFile = kind === 'country' ? 'apps/admin/app/(dashboard)/translations/country-actions.ts' : 'apps/admin/app/(dashboard)/translations/actions.ts';
    try {
      if (input.resume) {
        assert.ok(requestedJobId); form.set('job_id', requestedJobId);
        await view.load('apps/admin/app/(dashboard)/translations/resume-action.ts').resumeTranslationJobAction(form);
      } else await view.load(actionFile)[kind === 'country' ? 'translatePremiumCountryBatchAction' : 'translatePremiumWriterBatchAction'](form);
      throw new Error('Actual action must redirect');
    } catch (error) {assert.equal(isRedirectError(error), true, error.stack); redirect = getURLFromRedirectError(error);}
    const params = Object.fromEntries(new URL(redirect, 'https://fixture.invalid').searchParams);
    if (params[`${kind}Job`]) requestedJobId = params[`${kind}Job`];
    const ownWindows = [...scans.windows.values()].filter(window => window.scanId === intent);
    const selected = ownWindows.find(window => window.nextPosition !== window.members.length) || ownWindows.at(-1);
    const result = {redirect, params, form: Object.fromEntries(form.entries()), helperIds: helperIds(view.wire.slice(beforeWire)), addedProviderCalls: view.providerCalls.length - beforeCalls,
      observations: structuredClone(scans.observations.slice(beforeObservations)), scanWire: structuredClone(scanWire.slice(beforeScanWire)),
      receipt: selected ? scans.view(selected) : null, sourceGraph: [...view.graph.values()],
      legacyWire: structuredClone(view.wire.slice(beforeWire)), catalogReads: structuredClone(catalogReads), scanErrors: structuredClone(scans.errors)};
    fs.writeFileSync(path.join(caseOutput, `action-${fs.readdirSync(caseOutput).length + 1}.json`), JSON.stringify(result, null, 2) + '\n');
    return result;
  }
  return {...view, kind, entries, catalog, catalogReads, scans, scanWire, guardedDispatches, initialIds, authorRows, sourceRows,
    invoke, caseOutput, setCatalogUnavailable(value = true) {catalogUnavailable = value;},
    releaseRetainedBodyReadback() {cacheReadbackHeld = false;},
    get lastJobId() {return requestedJobId;}, set lastJobId(value) {requestedJobId = value;}, get scanIntent() {return intent;}};
}
module.exports = {createProfileTranslationScanRuntime, repo, sourceRoot, output};
