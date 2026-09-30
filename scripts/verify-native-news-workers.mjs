import { pathToFileURL } from 'node:url';

const workers = Object.freeze([
  Object.freeze({ name: 'probpera-literary-news-preparation', cron: '17 */2 * * *',
    flags: Object.freeze({ NEWS_AUTOMATION_ENABLED: 'enabled', NEWS_AUTOMATION_BOOTSTRAP: 'enabled', NEWS_AUTOMATION_WRITER: 'native' }) }),
  Object.freeze({ name: 'probpera-literary-news-delivery', cron: '0 5-19 * * *',
    flags: Object.freeze({ NEWS_DELIVERY_ENABLED: 'enabled' }) }),
]);
const fail = code => { throw new Error(code); };

async function boundedJson(response) {
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    fail(response.status === 402 ? 'native_check_provider_quota' : 'native_check_provider_unavailable');
  }
  if (!response.body) fail('native_check_response_invalid');
  const reader = response.body.getReader(), chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 512 * 1024) fail('native_check_response_too_large');
      chunks.push(Buffer.from(value));
    }
    let data; try { data = JSON.parse(Buffer.concat(chunks, length).toString('utf8')); }
    catch { fail('native_check_response_invalid'); }
    if (data?.success !== true || !data.result || typeof data.result !== 'object') fail('native_check_response_invalid');
    return data.result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Exactly four read-only Cloudflare GETs; output includes only approved nonsecret flags and schedules. */
export async function verifyNativeNewsWorkers({ accountId, apiToken, expected, fetchImpl = fetch } = {}) {
  if (typeof accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(accountId)
    || typeof apiToken !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(apiToken)
    || !['enabled', 'disabled'].includes(expected)) fail('native_check_configuration_invalid');
  const read = async (worker, suffix) => {
    const url = new URL('https://api.cloudflare.com');
    url.pathname = `/client/v4/accounts/${accountId}/workers/scripts/${worker.name}/${suffix}`;
    if (url.origin !== 'https://api.cloudflare.com' || url.protocol !== 'https:'
      || url.username || url.password || url.search || url.hash
      || !workers.includes(worker) || !['settings', 'schedules'].includes(suffix)) fail('native_check_endpoint_rejected');
    let response;
    try { response = await fetchImpl(url, { method: 'GET', redirect: 'error',
      headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }); }
    catch { fail('native_check_network_unavailable'); }
    return boundedJson(response);
  };
  const results = [];
  for (const worker of workers) {
    const settings = await read(worker, 'settings');
    if (!Array.isArray(settings.bindings)) fail('native_check_bindings_invalid');
    const flags = {};
    for (const [name, expectation] of Object.entries(worker.flags)) {
      const matching = settings.bindings.filter(row => row?.name === name);
      const value = expectation === 'enabled' ? String(expected === 'enabled') : expectation;
      if (matching.length !== 1 || matching[0].type !== 'plain_text' || matching[0].text !== value) fail('native_check_flag_mismatch');
      Object.defineProperty(flags, name, { value, enumerable: true });
    }
    const schedules = await read(worker, 'schedules');
    if (!Array.isArray(schedules.schedules) || schedules.schedules.length !== 1
      || schedules.schedules[0]?.cron !== worker.cron) fail('native_check_schedule_mismatch');
    results.push({ worker: worker.name, flags, cronUtc: worker.cron });
  }
  return { readonly: true, externalWrites: 0, providerRequests: 4, expected, workers: results,
    deliveryConfirmed: false, checkedAt: new Date().toISOString() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1 || !['--expect-enabled', '--expect-disabled'].includes(args[0])) fail('native_check_configuration_invalid');
    const result = await verifyNativeNewsWorkers({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN, expected: args[0] === '--expect-enabled' ? 'enabled' : 'disabled' });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const code = /^native_check_[a-z_]+$/.test(error?.message || '') ? error.message : 'native_check_failed';
    console.error(JSON.stringify({ readonly: true, externalWrites: 0, code, deliveryConfirmed: false }));
    process.exitCode = 1;
  }
}
