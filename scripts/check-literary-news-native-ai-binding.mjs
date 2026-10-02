import { fileURLToPath, pathToFileURL } from 'node:url';
import { NATIVE_AI_PROBE_URL, nativeAiProbeReport,
  matchesNativeAiProbeFixture } from './lib/literary-news-native-ai-probe-fixture.mjs';

const fail = code => { throw Error(code); };
export async function buildNativeAiProbeWorker() {
  const { build } = await import('esbuild');
  const bundled = await build({ entryPoints: [fileURLToPath(new URL('./workers/literary-news-native-ai-probe-worker.mjs', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', external: ['node:*'], logLevel: 'silent' });
  if (bundled.outputFiles.length !== 1) fail('native_ai_probe_bundle_invalid');
  return bundled.outputFiles[0].text;
}

// The token is explicitly passed to the supported remote-proxy API. No profile,
// OAuth, .env, .dev.vars, production config, or publication binding is read.
export async function startNativeAiProbeSession(auth, { fetchImpl = fetch,
  loadWrangler = () => import('wrangler') } = {}) {
  if (typeof auth?.accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(auth.accountId)
    || typeof auth.apiToken !== 'string' || !auth.apiToken || auth.apiToken.trim() !== auth.apiToken
    || /[\r\n]/.test(auth.apiToken)) fail('native_ai_probe_intended_credentials_missing');
  const target = new URL('https://api.cloudflare.com');
  target.pathname = `/client/v4/accounts/${auth.accountId}/workers/subdomain`;
  if (target.hostname !== 'api.cloudflare.com' || target.origin !== 'https://api.cloudflare.com'
    || target.protocol !== 'https:' || target.port || target.username || target.password || target.search || target.hash)
    fail('native_ai_probe_endpoint_rejected');
  const response = await fetchImpl(target.href, { method: 'GET',
    headers: { Authorization: `Bearer ${auth.apiToken}` }, redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    fail('native_ai_probe_existing_subdomain_unconfirmed');
  }
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

export function nativeAiProbeRuntimeOptions(remoteProxyConnectionString, script = '') {
  if (!remoteProxyConnectionString) fail('native_ai_probe_remote_connection_missing');
  return { name: 'probpera-native-news-ai-binding-proof', modules: true,
    script,
    // Match Wrangler's remote proxy date; the pinned local workerd is older than production.
    compatibilityDate: '2025-04-28', compatibilityFlags: ['nodejs_compat'], cf: false,
    ai: { binding: 'AI', remoteProxyConnectionString } };
}

async function defaultRuntime(connection) {
  const { Miniflare, convertV4MiniflareOptions, Log, LogLevel } = await import('miniflare');
  const script = await buildNativeAiProbeWorker();
  return new Miniflare(convertV4MiniflareOptions({ ...nativeAiProbeRuntimeOptions(connection, script),
    log: new Log(LogLevel.NONE), logRequests: false }));
}

async function readProbeReport(response) {
  if (!response.body || typeof response.body.getReader !== 'function') fail('native_ai_probe_report_unconfirmed');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2048) fail('native_ai_probe_report_unconfirmed');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  let value;
  try { value = JSON.parse(text); } catch { fail('native_ai_probe_report_unconfirmed'); }
  if (!response.ok) {
    if (value && Object.keys(value).length === 2 && typeof value.code === 'string'
      && /^(?:native_ai_probe_|ai_|daily_)[a-z0-9_]+$/.test(value.code)
      && ['configuration', 'draft', 'review'].includes(value.stage)) {
      throw Object.assign(Error(value.code), { stage: value.stage });
    }
    fail('native_ai_probe_report_unconfirmed');
  }
  if (!matchesNativeAiProbeFixture(value, nativeAiProbeReport())) fail('native_ai_probe_report_unconfirmed');
  return value;
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
    stage = 'protocols';
    let timer;
    try {
      report = await Promise.race([runtime.dispatchFetch(NATIVE_AI_PROBE_URL, { method: 'POST' }).then(readProbeReport),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('native_ai_probe_execution_timeout')), 110000); })]);
    } finally { clearTimeout(timer); }
  } catch (error) {
    // Neither provider responses nor preview connection/auth errors enter Actions logs.
    failure = Error(/^(?:native_ai_probe_|ai_|daily_)[a-z0-9_]+$/.test(error?.message || '')
      ? error.message : 'native_ai_probe_remote_binding_unavailable');
    failure.stage = ['configuration', 'draft', 'review'].includes(error?.stage) ? error.stage : stage;
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
