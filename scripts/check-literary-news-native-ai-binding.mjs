import { pathToFileURL } from 'node:url';
import { createPreparationBindingAi } from './workers/literary-news-preparation-worker.mjs';
import { DAILY_NEWS_MODELS } from './lib/literary-news-daily-profile.mjs';

const fail = code => { throw Error(code); };
const draft = Object.freeze({ status: 'held', reason: 'connectivity_fixture',
  title: { ru: '', en: '' }, summary: { ru: '', en: '' }, category: 'publishing',
  eventIdentity: 'connectivity fixture', literaryEvidence: '', facts: [] });
const review = Object.freeze({ accepted: false, literaryTopic: false, categoryMatches: false,
  translationsMatch: false, titleSupported: false, summarySupported: false,
  publicationDateMatches: false, duplicateOf: null, unsupportedClaims: [], factChecks: [] });
const messages = Object.freeze([{ role: 'system', content:
  'This is a connectivity check using an isolated fixture, not a real source or publication. '
  + 'Return valid JSON for the supplied schema. For a draft return status held, reason connectivity_fixture, '
  + 'empty strings in both title and summary languages, category publishing, eventIdentity connectivity fixture, '
  + 'literaryEvidence empty and facts empty. For a review return accepted false, all other booleans false, '
  + 'duplicateOf null, unsupportedClaims and factChecks empty. Do not invent news.' }]);

function matchesFixture(value, expected) {
  if (Array.isArray(expected)) return Array.isArray(value) && value.length === 0;
  if (!expected || typeof expected !== 'object') return value === expected;
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, item]) => Object.hasOwn(value, key) && matchesFixture(value[key], item));
}

// The token is explicitly passed to the supported remote-proxy API. No profile,
// OAuth, .env, .dev.vars, production config, or publication binding is read.
export async function startNativeAiProbeSession(auth, { fetchImpl = fetch,
  loadWrangler = () => import('wrangler') } = {}) {
  const response = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${auth.accountId}/workers/subdomain`, {
    headers: { Authorization: `Bearer ${auth.apiToken}` }, redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) fail('native_ai_probe_existing_subdomain_unconfirmed');
  if (!response.body || typeof response.body.getReader !== 'function') fail('native_ai_probe_existing_subdomain_unconfirmed');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, raw = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) fail('native_ai_probe_existing_subdomain_unconfirmed');
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  let data;
  try { data = JSON.parse(raw); } catch { fail('native_ai_probe_existing_subdomain_unconfirmed'); }
  if (data.success !== true || typeof data.result?.subdomain !== 'string'
    || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(data.result.subdomain)) fail('native_ai_probe_existing_subdomain_unconfirmed');
  const { startRemoteProxySession } = await loadWrangler();
  return startRemoteProxySession({ AI: { type: 'ai', remote: true } }, {
    workerName: 'probpera-native-news-ai-binding-proof',
    auth: {accountId: auth.accountId, apiToken: {apiToken: auth.apiToken}} });
}

export function nativeAiProbeRuntimeOptions(remoteProxyConnectionString) {
  if (!remoteProxyConnectionString) fail('native_ai_probe_remote_connection_missing');
  return { name: 'probpera-native-news-ai-binding-proof', modules: true,
    script: 'export default { fetch() { return new Response(null, { status: 404 }); } };',
    // Match Wrangler's remote proxy date; the pinned local workerd is older than production.
    compatibilityDate: '2025-04-28', cf: false,
    ai: { binding: 'AI', remoteProxyConnectionString } };
}

async function defaultRuntime(connection) {
  const { Miniflare, convertV4MiniflareOptions, Log, LogLevel } = await import('miniflare');
  return new Miniflare(convertV4MiniflareOptions({ ...nativeAiProbeRuntimeOptions(connection),
    log: new Log(LogLevel.NONE), logRequests: false }));
}

/** Exactly two genuine, unpublished protocol calls; dependency injection is for offline tests. */
export async function checkNativeNewsAiBinding({ accountId, apiToken,
  startSession = startNativeAiProbeSession, createRuntime = defaultRuntime } = {}) {
  if (typeof accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(accountId)
    || typeof apiToken !== 'string' || !apiToken || apiToken.trim() !== apiToken || /[\r\n]/.test(apiToken)) {
    fail('native_ai_probe_intended_credentials_missing');
  }
  let session, runtime, report, failure, stage = 'remote_session';
  try {
    session = await startSession({ accountId, apiToken });
    await session.ready;
    stage = 'runtime_init';
    runtime = await createRuntime(session.remoteProxyConnectionString);
    stage = 'binding_discovery';
    const env = await runtime.getBindings();
    const client = createPreparationBindingAi(env.AI);
    const phases = [];
    for (const phase of ['draft', 'review']) {
      stage = phase;
      const result = await client.request({ phase, messages: structuredClone(messages) });
      if (!matchesFixture(result, phase === 'draft' ? draft : review)) fail('native_ai_probe_fixture_unconfirmed');
      phases.push({ phase, model: DAILY_NEWS_MODELS[phase], protocolConfirmed: true, published: false });
    }
    report = { transport: 'native-ai-remote-binding', calls: 2, phases, published: false,
      publicationBindings: 0, oauthFallback: false };
  } catch (error) {
    // Neither provider responses nor preview connection/auth errors enter Actions logs.
    failure = Error(/^(?:native_ai_probe_|ai_|daily_)[a-z0-9_]+$/.test(error?.message || '')
      ? error.message : 'native_ai_probe_remote_binding_unavailable');
    failure.stage = stage;
    const status = Number(error?.httpStatus ?? error?.status ?? error?.statusCode);
    const code = Number(error?.code ?? error?.cause?.code);
    if (Number.isInteger(status) && status >= 100 && status <= 599) failure.upstreamStatus = status;
    if (Number.isInteger(code) && code >= 0 && code <= 10000000) failure.upstreamCode = code;
    if (['Error', 'TypeError', 'SyntaxError', 'UserError', 'FatalError', 'MiniflareCoreError', 'MiniflareError', 'APIError'].includes(error?.name)) failure.errorClass = error.name;
  } finally {
    for (const resource of [runtime, session]) {
      if (resource) {
        try { await resource.dispose(); } catch { failure ||= Error('native_ai_probe_cleanup_unconfirmed'); }
      }
    }
  }
  if (failure) throw failure;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // The only credential source is the explicitly configured Actions environment.
    if (process.env.GITHUB_ACTIONS !== 'true') fail('native_ai_probe_github_actions_required');
    process.env.WRANGLER_LOG = 'none';
    const report = await checkNativeNewsAiBinding({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN });
    console.log(JSON.stringify(report));
  } catch (error) {
    console.error(JSON.stringify({code: error.message, stage: error.stage || 'configuration',
      ...(error.upstreamStatus !== undefined ? {upstreamStatus: error.upstreamStatus} : {}),
      ...(error.upstreamCode !== undefined ? {upstreamCode: error.upstreamCode} : {}),
      ...(error.errorClass ? {errorClass: error.errorClass} : {})}));
    process.exitCode = 1;
  }
}
