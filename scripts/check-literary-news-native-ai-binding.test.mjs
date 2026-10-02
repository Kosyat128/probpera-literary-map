import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { convertV4MiniflareOptions } from 'miniflare';
import { checkNativeNewsAiBinding as check, nativeAiProbeRuntimeOptions,
  startNativeAiProbeSession, buildNativeAiProbeWorker } from './check-literary-news-native-ai-binding.mjs';
import { createNativeAiProbeWorker } from './workers/literary-news-native-ai-probe-worker.mjs';
import { NATIVE_AI_PROBE_URL, nativeAiProbeReport } from './lib/literary-news-native-ai-probe-fixture.mjs';
import { DAILY_NEWS_DRAFT_SCHEMA, DAILY_NEWS_REVIEW_SCHEMA } from './lib/literary-news-daily-automation.mjs';
import { DAILY_NEWS_MODELS } from './lib/literary-news-daily-profile.mjs';

const credentials = { accountId: 'a'.repeat(32), apiToken: 'INTENDED_GITHUB_TOKEN_NOT_A_REAL_SECRET' };
const held = { status: 'held', reason: 'connectivity_fixture', title: { ru: '', en: '' },
  summary: { ru: '', en: '' }, category: 'publishing', eventIdentity: 'connectivity fixture', literaryEvidence: '', facts: [] };
const rejected = { accepted: false, literaryTopic: false, categoryMatches: false, translationsMatch: false,
  titleSupported: false, summarySupported: false, publicationDateMatches: false,
  duplicateOf: null, unsupportedClaims: [], factChecks: [] };
function fixture() {
  const run = vi.fn().mockResolvedValueOnce({ status: 'completed', output: [
    { type: 'reasoning', content: [{ type: 'output_text', text: 'PRIVATE_REASONING_IGNORE' }] },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(held) }] }] })
    .mockResolvedValueOnce({ response: JSON.stringify(rejected) });
  const session = { ready: Promise.resolve(), remoteProxyConnectionString: 'PRIVATE_PREVIEW_CONNECTION', dispose: vi.fn() };
  const worker = createNativeAiProbeWorker();
  const runtime = { dispatchFetch: vi.fn(async (url, options) => worker.fetch(new Request(url, options), { AI: { run } })), dispose: vi.fn() };
  return { run, session, runtime, startSession: vi.fn(async () => session), createRuntime: vi.fn(async () => runtime) };
}

describe('Genuine native AI binding readiness with explicitly intended Actions authentication', () => {
  it('passes only the explicitly intended auth and AI binding to the real remote session factory', async () => {
    const startRemoteProxySession = vi.fn(async () => ({ ready: Promise.resolve() }));
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true, result: { subdomain: 'existing-account' } })));
    const loadWrangler = vi.fn(async () => ({ startRemoteProxySession }));
    await startNativeAiProbeSession(credentials, { fetchImpl, loadWrangler });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(`https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/workers/subdomain`);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'error', headers: { Authorization: `Bearer ${credentials.apiToken}` } });
    expect(startRemoteProxySession).toHaveBeenCalledExactlyOnceWith({ AI: { type: 'ai', remote: true } }, {
      workerName: 'probpera-native-news-ai-binding-proof',
      auth: {accountId: credentials.accountId, apiToken: {apiToken: credentials.apiToken}} });
  });
  it.each([
    { status: 401, body: { success: false, errors: [{ code: 10000 }] } },
    { status: 404, body: { success: false, errors: [{ code: 10007 }] } },
    { status: 200, body: { success: true, result: {} } },
    { status: 200, body: { success: true, result: { subdomain: 'invalid/domain' } } },
    { status: 200, body: { success: true, result: { subdomain: 'existing' }, noise: 'x'.repeat(4096) } },
  ])('refuses unconfirmed account subdomains before Wrangler can auto-register one %j', async input => {
    const loadWrangler = vi.fn();
    await expect(startNativeAiProbeSession(credentials, { loadWrangler,
      fetchImpl: async () => new Response(JSON.stringify(input.body), { status: input.status }) }))
      .rejects.toThrow('native_ai_probe_existing_subdomain_unconfirmed');
    expect(loadWrangler).not.toHaveBeenCalled();
  });
  it('bounds and cancels oversized streamed metadata without trusting Content-Length or starting preview', async () => {
    const cancel = vi.fn(), loadWrangler = vi.fn();
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(' '.repeat(4096)));
      controller.enqueue(new TextEncoder().encode('x'));
    }, cancel });
    await expect(startNativeAiProbeSession(credentials, { loadWrangler,
      fetchImpl: async () => new Response(stream, { headers: { 'Content-Length': '1' } }) }))
      .rejects.toThrow('native_ai_probe_existing_subdomain_unconfirmed');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(stream.locked).toBe(false);
    expect(loadWrangler).not.toHaveBeenCalled();
  });
  it('checks the actual production Responses and chat JSON-schema protocols exactly once each', async () => {
    const f = fixture(), report = await check({ ...credentials, ...f });
    expect(f.startSession).toHaveBeenCalledExactlyOnceWith(credentials);
    expect(f.createRuntime).toHaveBeenCalledExactlyOnceWith('PRIVATE_PREVIEW_CONNECTION');
    expect(f.runtime.dispatchFetch).toHaveBeenCalledExactlyOnceWith(NATIVE_AI_PROBE_URL, { method: 'POST' });
    expect(f.run).toHaveBeenCalledTimes(2);
    const [[draftModel, draftInput, draftOptions], [reviewModel, reviewInput]] = f.run.mock.calls;
    expect(draftModel).toBe(DAILY_NEWS_MODELS.draft);
    expect(draftInput.text.format).toEqual({ type: 'json_schema', name: 'literary_news_draft', strict: true, schema: DAILY_NEWS_DRAFT_SCHEMA });
    expect(draftInput).toMatchObject({ reasoning: { effort: 'low' }, max_output_tokens: 2400 });
    expect(draftOptions.signal).toBeInstanceOf(AbortSignal);
    expect(reviewModel).toBe(DAILY_NEWS_MODELS.review);
    expect(reviewInput).toMatchObject({ stream: false, max_tokens: 1200, temperature: 0,
      response_format: { type: 'json_schema', json_schema: DAILY_NEWS_REVIEW_SCHEMA } });
    expect(reviewInput.messages).toEqual(draftInput.input);
    expect(report).toMatchObject({ calls: 2, published: false, publicationBindings: 0, oauthFallback: false });
    expect(report.phases.map(row => row.phase)).toEqual(['draft', 'review']);
    const serialized = JSON.stringify(report);
    for (const secret of [credentials.apiToken, credentials.accountId, 'PRIVATE_PREVIEW_CONNECTION', 'PRIVATE_REASONING_IGNORE']) {
      expect(serialized).not.toContain(secret);
    }
    expect(f.runtime.dispose).toHaveBeenCalledTimes(1); expect(f.session.dispose).toHaveBeenCalledTimes(1);
  });
  it.each([{ apiToken: '' }, { apiToken: undefined }, { apiToken: ' padded ' }, { apiToken: 'line\nbreak' },
    { accountId: 'wrong' }])('fails before any session or local credential fallback for invalid intended auth %j', async change => {
    const f = fixture();
    await expect(check({ ...credentials, ...f, ...change })).rejects.toThrow('native_ai_probe_intended_credentials_missing');
    expect(f.startSession).not.toHaveBeenCalled(); expect(f.createRuntime).not.toHaveBeenCalled();
  });
  it.each([
    { response: JSON.stringify({ ...held, status: 'draft' }) },
    { response: JSON.stringify({ ...held, title: { ru: 'Invented news', en: '' } }) },
    { response: JSON.stringify({ ...held, facts: [{ quote: 'Invented fact' }] }) },
    { response: JSON.stringify({ ...held, extra: 'Unexpected field' }) },
    { status: 'incomplete', output_text: JSON.stringify(held) },
    { response: 'invalid JSON' },
  ])('refuses unsafe or incomplete draft before the review and disposes both resources', async payload => {
    const f = fixture(); f.run.mockReset().mockResolvedValue(payload);
    await expect(check({ ...credentials, ...f })).rejects.toThrow();
    expect(f.run).toHaveBeenCalledTimes(1);
    expect(f.runtime.dispose).toHaveBeenCalledTimes(1); expect(f.session.dispose).toHaveBeenCalledTimes(1);
  });
  it('refuses an accepting review and never treats it as permission to publish', async () => {
    const f = fixture(); f.run.mockReset().mockResolvedValueOnce({ response: JSON.stringify(held) })
      .mockResolvedValueOnce({ response: JSON.stringify({ ...rejected, accepted: true }) });
    await expect(check({ ...credentials, ...f })).rejects.toThrow('native_ai_probe_fixture_unconfirmed');
    expect(f.run).toHaveBeenCalledTimes(2); expect(f.session.dispose).toHaveBeenCalledTimes(1);
  });
  it('keeps the native adapter quota failure and stops after one call', async () => {
    const f = fixture(); f.run.mockReset().mockResolvedValue({ errors: [{ code: 4006 }] });
    await expect(check({ ...credentials, ...f })).rejects.toThrow('ai_quota_exceeded');
    expect(f.run).toHaveBeenCalledTimes(1); expect(f.runtime.dispose).toHaveBeenCalledTimes(1);
  });
  it('sanitizes remote errors and disposes the started session if runtime initialization fails', async () => {
    const f = fixture(); f.createRuntime.mockRejectedValue(Error('PRIVATE_PREVIEW_CONNECTION INTENDED_GITHUB_TOKEN_NOT_A_REAL_SECRET'));
    await expect(check({ ...credentials, ...f })).rejects.toThrow('native_ai_probe_remote_binding_unavailable');
    expect(f.session.dispose).toHaveBeenCalledTimes(1); expect(f.run).not.toHaveBeenCalled();
  });
  it('disposes both resources if private Worker dispatch fails, including a failing first cleanup', async () => {
    const f = fixture(); f.runtime.dispatchFetch.mockRejectedValue(Error('PRIVATE_PROVIDER_TEXT'));
    f.runtime.dispose.mockRejectedValue(Error('PRIVATE_CLEANUP_TEXT'));
    await expect(check({ ...credentials, ...f })).rejects.toThrow('native_ai_probe_remote_binding_unavailable');
    expect(f.runtime.dispose).toHaveBeenCalledTimes(1); expect(f.session.dispose).toHaveBeenCalledTimes(1);
  });
  it('does not return successful readiness until cleanup is confirmed', async () => {
    const f = fixture(); f.runtime.dispose.mockRejectedValue(Error('PRIVATE_CLEANUP_TEXT'));
    await expect(check({ ...credentials, ...f })).rejects.toThrow('native_ai_probe_cleanup_unconfirmed');
    expect(f.session.dispose).toHaveBeenCalledTimes(1);
  });
  it('validates the pinned Miniflare AI-only fixture and contains no publication or credential bindings', () => {
    const options = nativeAiProbeRuntimeOptions('http://localhost:19291');
    const converted = convertV4MiniflareOptions(options);
    expect(Object.keys(options).sort()).toEqual(['ai', 'cf', 'compatibilityDate', 'compatibilityFlags', 'modules', 'name', 'script']);
    expect(options.compatibilityFlags).toEqual(['nodejs_compat']);
    expect(options.cf).toBe(false);
    expect(converted.cf).toBe(false);
    expect(options.ai).toEqual({ binding: 'AI', remoteProxyConnectionString: 'http://localhost:19291' });
    expect(converted.workers).toHaveLength(1);
    expect(() => nativeAiProbeRuntimeOptions()).toThrow('native_ai_probe_remote_connection_missing');
    const source = readFileSync(new URL('./check-literary-news-native-ai-binding.mjs', import.meta.url), 'utf8');
    expect(source).toContain("if (process.env.GITHUB_ACTIONS !== 'true')");
    expect(source).toContain("startRemoteProxySession({ AI: { type: 'ai', remote: true } }");
    expect(source).not.toContain('getPlatformProxy(');
    expect(source).not.toContain('wrangler.json');
    expect(source).not.toContain('runtime.getBindings(');
    expect(source).not.toContain('createPreparationBindingAi(');
  });
  it('uses a fixture date supported by the installed local runtime instead of the newer production date', () => {
    const runtimeVersion = createRequire(import.meta.url)('workerd/package.json').version;
    const match = /^\d+\.(\d{4})(\d{2})(\d{2})\./.exec(runtimeVersion);
    expect(match).not.toBeNull();
    const releaseDate = `${match[1]}-${match[2]}-${match[3]}`;
    expect(nativeAiProbeRuntimeOptions('http://127.0.0.1:19291').compatibilityDate <= releaseDate).toBe(true);
    // The formerly used production date could pass schema validation and fail workerd startup.
    expect('2026-09-30' > releaseDate).toBe(true);
  });
  it('bundles the real adapter into the local Worker entirely in memory with no Node RPC model arguments', async () => {
    const script = await buildNativeAiProbeWorker();
    expect(script).toContain('function createPreparationBindingAi');
    expect(script).toContain('AbortSignal.timeout(timeoutMs)');
    expect(script).toContain('native-ai-probe.invalid/protocols');
    expect(script).not.toContain('startRemoteProxySession');
    expect(script).not.toContain('getPlatformProxy');
    expect(script).not.toContain('wrangler/dist');
    expect(script).not.toContain('INTENDED_GITHUB_TOKEN');
    expect(convertV4MiniflareOptions(nativeAiProbeRuntimeOptions('http://127.0.0.1:19291', script)).workers).toHaveLength(1);
  });
  it.each([
    new Request(NATIVE_AI_PROBE_URL),
    new Request(NATIVE_AI_PROBE_URL, { method: 'POST', body: JSON.stringify({ prompt: 'arbitrary' }) }),
    new Request(`${NATIVE_AI_PROBE_URL}?model=caller`, { method: 'POST' }),
    new Request('https://another.invalid/protocols', { method: 'POST' }),
  ])('refuses caller inputs and other routes before any production adapter invocation', async request => {
    const f = fixture(), worker = createNativeAiProbeWorker();
    expect((await worker.fetch(request, { AI: { run: f.run } })).status).toBe(404);
    expect(f.run).not.toHaveBeenCalled();
  });
  it('consumes the private fixture once, preventing retry requests from exceeding two inference calls', async () => {
    const f = fixture(), worker = createNativeAiProbeWorker(), env = { AI: { run: f.run } };
    expect((await worker.fetch(new Request(NATIVE_AI_PROBE_URL, { method: 'POST' }), env)).status).toBe(200);
    expect((await worker.fetch(new Request(NATIVE_AI_PROBE_URL, { method: 'POST' }), env)).status).toBe(409);
    expect(f.run).toHaveBeenCalledTimes(2);
  });
  it('allows the empty HTTP body stream without accepting arbitrary body bytes', async () => {
    const f = fixture(), worker = createNativeAiProbeWorker();
    const request = new Request(NATIVE_AI_PROBE_URL, { method: 'POST', duplex: 'half',
      body: new ReadableStream({ start(controller) { controller.close(); } }) });
    expect((await worker.fetch(request, { AI: { run: f.run } })).status).toBe(200);
    expect(f.run).toHaveBeenCalledTimes(2);
  });
  it.each([
    { ...nativeAiProbeReport(), calls: 3 },
    { ...nativeAiProbeReport(), published: true },
    { ...nativeAiProbeReport(), publicationBindings: 1 },
    { ...nativeAiProbeReport(), private: 'UNTRUSTED_PRIVATE_TEXT' },
    { ...nativeAiProbeReport(), phases: [{ phase: 'draft', protocolConfirmed: true, published: false }] },
  ])('refuses forged or unsafe Worker reports and disposes both resources', async report => {
    const f = fixture(); f.runtime.dispatchFetch.mockResolvedValue(Response.json(report));
    await expect(check({ ...credentials, ...f })).rejects.toThrow('native_ai_probe_report_unconfirmed');
    expect(f.runtime.dispose).toHaveBeenCalledTimes(1); expect(f.session.dispose).toHaveBeenCalledTimes(1);
  });
  it('bounds and cancels a streamed Worker report before decoding an oversized chunk', async () => {
    const f = fixture(), cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2049)); }, cancel });
    f.runtime.dispatchFetch.mockResolvedValue(new Response(stream, { headers: { 'content-length': '1' } }));
    await expect(check({ ...credentials, ...f })).rejects.toThrow('native_ai_probe_report_unconfirmed');
    expect(cancel).toHaveBeenCalledTimes(1); expect(stream.locked).toBe(false);
    expect(f.session.dispose).toHaveBeenCalledTimes(1);
  });
});
