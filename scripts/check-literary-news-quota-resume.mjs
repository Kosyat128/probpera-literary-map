import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { verifyNativeNewsWorkers } from './verify-native-news-workers.mjs';

const fail = code => { throw Error(code); };

/** Read-only authorization for the daily recovery workflow; this function never invokes AI. */
export async function checkNativeQuotaResume({ env = process.env, current = new Date(),
  verify = verifyNativeNewsWorkers } = {}) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'schedule'
    || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_REPOSITORY !== 'Kosyat128/probpera-literary-map'
    || env.LITERARY_NEWS_NATIVE_PREPARATION_AUTO_RESUME !== 'true'
    || env.LITERARY_NEWS_NATIVE_PREPARATION_BLOCK_REASON !== 'ai_quota_exceeded'
    || env.LITERARY_NEWS_NATIVE_DELIVERY_ENABLED !== 'true' || env.LITERARY_NEWS_RUNTIME_ENABLED !== 'true')
    fail('quota_resume_invocation_rejected');
  const after = env.LITERARY_NEWS_NATIVE_PREPARATION_RESUME_AFTER;
  if (!(current instanceof Date) || !Number.isFinite(current.getTime()) || typeof after !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(after)
    || !Number.isFinite(Date.parse(after)) || new Date(after).toISOString() !== after)
    fail('quota_resume_reset_unconfirmed');
  const base = { readonly: true, externalWrites: 0, inferenceCalls: 0, resetAfter: after };
  if (current.getTime() < Date.parse(after)) return { ...base, runNeeded: false, reason: 'waiting_for_daily_reset' };
  const workers = await verify({ accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN, expected: 'auto-resume' });
  if (workers?.readonly !== true || workers.externalWrites !== 0 || workers.providerRequests !== 4
    || workers.requestedExpected !== 'auto-resume' || !['enabled', 'delivery-only'].includes(workers.expected))
    fail('quota_resume_configuration_unconfirmed');
  return { ...base, runNeeded: workers.expected === 'delivery-only',
    reason: workers.expected === 'enabled' ? 'preparation_already_enabled' : 'protocol_checks_required',
    actualMode: workers.expected, providerRequests: 4 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) fail('quota_resume_arguments_rejected');
    const report = await checkNativeQuotaResume();
    if (!process.env.GITHUB_OUTPUT) fail('quota_resume_output_missing');
    await appendFile(process.env.GITHUB_OUTPUT, `run_needed=${report.runNeeded}\n`);
    console.log(JSON.stringify(report));
  } catch (error) {
    const code = /^(?:quota_resume_|native_check_)[a-z_]+$/.test(error?.message || '') ? error.message : 'quota_resume_failed';
    console.error(JSON.stringify({ readonly: true, externalWrites: 0, inferenceCalls: 0, code }));
    process.exitCode = 1;
  }
}
