import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { checkNativeQuotaResume } from './check-literary-news-quota-resume.mjs';

const env = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'schedule', GITHUB_REF: 'refs/heads/main',
  GITHUB_REPOSITORY: 'Kosyat128/probpera-literary-map', LITERARY_NEWS_NATIVE_PREPARATION_AUTO_RESUME: 'true',
  LITERARY_NEWS_NATIVE_PREPARATION_BLOCK_REASON: 'ai_quota_exceeded', LITERARY_NEWS_NATIVE_DELIVERY_ENABLED: 'true',
  LITERARY_NEWS_RUNTIME_ENABLED: 'true', LITERARY_NEWS_NATIVE_PREPARATION_RESUME_AFTER: '2026-10-03T00:00:00.000Z',
  CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'intended-fixture-token' };
const current = new Date('2026-10-03T00:07:00.000Z');
const proof = mode => ({ readonly: true, externalWrites: 0, providerRequests: 4,
  requestedExpected: 'auto-resume', expected: mode });

describe('Daily quota recovery authorization without inference or mutations', () => {
  it('keeps every activation step behind recovery authorization and both AI protocols ahead of Worker mutations', () => {
    const workflow = parse(readFileSync(new URL('../.github/workflows/deploy-literary-news-automation.yml', import.meta.url), 'utf8'));
    expect(workflow.on.schedule).toEqual([{ cron: '7 0 * * *' }]);
    const steps = workflow.jobs.deploy.steps, invocation = steps.findIndex(step => step.id === 'invocation');
    const mutation = steps.findIndex(step => step.id === 'establish_workers');
    const protocols = steps.findIndex(step => step.name === 'Verify both configured AI protocols with unpublished fixtures');
    expect(invocation).toBeGreaterThan(0); expect(protocols).toBeGreaterThan(invocation); expect(mutation).toBeGreaterThan(protocols);
    for (const step of steps.slice(invocation + 1).filter(step => !step.if?.startsWith('failure()')))
      expect(step.if).toContain("steps.invocation.outputs.run_needed == 'true'");
    expect(steps[protocols].if).toContain("env.DEPLOY_PREPARATION_ENABLED == 'true'");
    expect(workflow.jobs.deploy.if).toContain("vars.LITERARY_NEWS_NATIVE_PREPARATION_AUTO_RESUME == 'true'");
  });
  it('permits protocol checks only after the documented UTC reset with verified delivery-only configuration', async () => {
    const verify = vi.fn(async () => proof('delivery-only'));
    expect(await checkNativeQuotaResume({ env, current, verify })).toMatchObject({
      runNeeded: true, reason: 'protocol_checks_required', inferenceCalls: 0, externalWrites: 0 });
    expect(verify).toHaveBeenCalledExactlyOnceWith({ accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN, expected: 'auto-resume' });
  });
  it('does not inspect providers or retry inference before the UTC reset, including after midnight in Moscow', async () => {
    const verify = vi.fn();
    const report = await checkNativeQuotaResume({ env, current: new Date('2026-10-02T23:59:59.999Z'), verify });
    expect(report).toMatchObject({ runNeeded: false, reason: 'waiting_for_daily_reset', inferenceCalls: 0 });
    expect(verify).not.toHaveBeenCalled();
  });
  it('skips reactivation when the actual preparation and delivery are already enabled', async () => {
    expect(await checkNativeQuotaResume({ env, current, verify: async () => proof('enabled') }))
      .toMatchObject({ runNeeded: false, reason: 'preparation_already_enabled', actualMode: 'enabled' });
  });
  it.each(['GITHUB_ACTIONS', 'GITHUB_EVENT_NAME', 'GITHUB_REF', 'GITHUB_REPOSITORY',
    'LITERARY_NEWS_NATIVE_PREPARATION_AUTO_RESUME', 'LITERARY_NEWS_NATIVE_PREPARATION_BLOCK_REASON',
    'LITERARY_NEWS_NATIVE_DELIVERY_ENABLED', 'LITERARY_NEWS_RUNTIME_ENABLED'])
  ('rejects changed authorization %s before any provider read', async key => {
    const verify = vi.fn();
    await expect(checkNativeQuotaResume({ env: { ...env, [key]: 'unconfirmed' }, current, verify }))
      .rejects.toThrow('quota_resume_invocation_rejected');
    expect(verify).not.toHaveBeenCalled();
  });
  it.each([undefined, '', '2026-10-03T03:00:00.000+03:00', '2026-10-03T01:00:00.000Z',
    '2026-02-30T00:00:00.000Z', '2026-10-03T00:00:00Z'])('rejects an unconfirmed UTC reset %s', async after => {
    const verify = vi.fn();
    await expect(checkNativeQuotaResume({ env: { ...env, LITERARY_NEWS_NATIVE_PREPARATION_RESUME_AFTER: after }, current, verify }))
      .rejects.toThrow('quota_resume_reset_unconfirmed');
    expect(verify).not.toHaveBeenCalled();
  });
  it.each([{ expected: 'disabled' }, { externalWrites: 1 }, { readonly: false }, { providerRequests: 3 },
    { requestedExpected: 'enabled' }])('rejects incomplete or contradictory actual settings proof %j', async change => {
    await expect(checkNativeQuotaResume({ env, current, verify: async () => ({ ...proof('delivery-only'), ...change }) }))
      .rejects.toThrow('quota_resume_configuration_unconfirmed');
  });
  it('retains a provider refusal without interpreting it as restored quota', async () => {
    await expect(checkNativeQuotaResume({ env, current, verify: async () => { throw Error('native_check_provider_unavailable'); } }))
      .rejects.toThrow('native_check_provider_unavailable');
  });
});
