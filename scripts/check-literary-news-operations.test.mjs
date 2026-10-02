import { describe, expect, it, vi } from 'vitest';
import { checkNewsOperations, createNewsOperationsReportReader, newsDeliveryCheckpointAge, summarizeNewsOperations } from './check-literary-news-operations.mjs';
import { makeDailyApprovedPayload, DAILY_NEWS_WINDOW } from './lib/literary-news-daily-profile.mjs';
import { emptyDailyLedger } from './lib/literary-news-daily-automation.mjs';
import { buildPublishedNewsFeed } from './lib/literary-news-publication.mjs';
import { pendingNewsSourceState } from './lib/literary-news-state.mjs';

const current = new Date('2026-10-01T10:00:00Z'), release = 'a'.repeat(40), destination = { platform: 'telegram', id: '-100123' };
const privateMarker = 'PRIVATE_ARTICLE_BODY_AND_TOKEN_DO_NOT_OUTPUT';
async function input(at = current) {
  const state = pendingNewsSourceState(); state.lastCheckedAt = at.toISOString();
  state.sources[0] = { ...state.sources[0], status: 'error', error: 'http_503' };
  return { current: at, expectedHead: release, destination,
    feed: await buildPublishedNewsFeed({ records: [], withdrawals: [], state, current: at, timeZone: 'Europe/Moscow', release, contractVersion: 2 }),
    profile: await makeDailyApprovedPayload([], at), ledger: emptyDailyLedger(at),
    owner: { schemaVersion: 1, owner: 'native', nativeEnabled: true, drained: false },
    workers: { readonly: true, expected: 'enabled', workers: [
      { flags: { NEWS_AUTOMATION_ENABLED: 'true' } }, { flags: { NEWS_DELIVERY_ENABLED: 'true' } }] },
    preparationReport: { schemaVersion: 1, checkedAt: at.toISOString(), publicationConfirmed: true,
      held: [{ text: privateMarker }], native: { sourceCounts: { approvedActiveSources: 151, checkedSources: 32, totalFinds: 300, verifiedDetails: 10 } } },
    control: { mode: 'on', paused: false, historyReconciled: true, secret: privateMarker },
    dayStatus: { editorialDay: '2026-10-01', timeZone: 'Europe/Moscow', minimum: 10, maximum: 15,
      acknowledgedCreates: 4, acknowledgedPhotoCreates: 2, freshCreates: 3, freshPhotoCreates: 2,
      legacyReceiptsWithUnknownFirstDate: 1, deficitToMinimum: 7 },
    dueRows: [], deliveryHeartbeat: { finishedAt: at.toISOString(), status: 'daily_target_deficit', raw: privateMarker } };
}

describe('bounded read-only news operations projection', () => {
  it('separates actual receipts and supply deficit from enabled schedules without publishing private data', async () => {
    const report = await summarizeNewsOperations(await input());
    expect(report.status).toBe('supply_degraded'); expect(report.failures).toEqual([]);
    expect(report.readonly).toBe(true); expect(report.externalWrites).toBe(0);
    expect(report.telegram.freshAcknowledgedCreatesToday).toBe(3); expect(report.telegram.minimumDeficit).toBe(7);
    expect(report.preparation.admittedToday).toBe(0); expect(report.preparation.minimumDeficit).toBe(10);
    expect(report.public.sourceFailures).toEqual({ http_503: 1 });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(privateMarker); expect(serialized).not.toContain('remoteId');
    expect(serialized).not.toContain('SUPABASE_SERVICE_ROLE_KEY'); expect(serialized.length).toBeLessThan(10000);
  });
  it('fails stale preparation, profile and ledger checkpoints even if the schedule is enabled', async () => {
    const value = await input(), older = new Date(current.getTime() - 6 * 3600000 - 1);
    value.preparationReport.checkedAt = older.toISOString(); value.profile = await makeDailyApprovedPayload([], older);
    value.ledger = emptyDailyLedger(older);
    const report = await summarizeNewsOperations(value);
    expect(report.status).toBe('failed');
    expect(report.failures).toEqual(expect.arrayContaining(['operations_preparation_stale', 'operations_profile_stale', 'operations_ledger_stale']));
  });
  it('fails absent checkpoints, a disabled worker and paused or unowned publication', async () => {
    const value = await input(); value.profile = null; value.ledger = null; value.preparationReport = null;
    value.workers.workers[0].flags.NEWS_AUTOMATION_ENABLED = 'false'; value.owner.nativeEnabled = false; value.control.paused = true;
    const report = await summarizeNewsOperations(value);
    expect(report.status).toBe('failed'); expect(report.failures).toEqual(expect.arrayContaining([
      'operations_profile_missing_or_invalid', 'operations_checkpoint_missing_or_invalid', 'operations_preparation_checkpoint_missing',
      'operations_workers_not_enabled', 'operations_native_owner_not_enabled', 'operations_destination_not_enabled']));
  });
  it('excludes the night from delivery age both before and after the morning reopening', async () => {
    for (const at of [new Date('2026-10-01T04:00:00Z'), new Date('2026-10-01T05:01:00Z')]) {
      const value = await input(at); value.deliveryHeartbeat.finishedAt = '2026-09-30T19:00:00Z';
      const report = await summarizeNewsOperations(value); expect(report.failures).not.toContain('operations_delivery_stale');
    }
    expect(newsDeliveryCheckpointAge('2026-09-30T19:00:00Z', new Date('2026-10-01T10:00:00Z'))).toBe(6 * 3600000);
    const value = await input(new Date('2026-10-01T10:00:01Z')); value.deliveryHeartbeat.finishedAt = '2026-09-30T19:00:00Z';
    expect((await summarizeNewsOperations(value)).failures).toContain('operations_delivery_stale');
  });
  it('does not invent freshness failures after the authorized yearly schedule ends', async () => {
    const value = await input(new Date(DAILY_NEWS_WINDOW.endExclusive + 'T10:00:00Z'));
    value.preparationReport.checkedAt = '2027-09-29T19:00:00Z'; value.deliveryHeartbeat.finishedAt = '2027-09-29T19:00:00Z';
    value.dayStatus.editorialDay = DAILY_NEWS_WINDOW.endExclusive;
    expect((await summarizeNewsOperations(value)).status).toBe('outside_authorized_window');
  });
  it('fails provider stops, blocked delivery and a different public release with safe fixed codes', async () => {
    const value = await input(); value.preparationReport.stoppedReason = 'ai_quota_exceeded'; value.deliveryHeartbeat.status = 'blocked';
    value.expectedHead = 'b'.repeat(40);
    const report = await summarizeNewsOperations(value);
    expect(report.failures).toEqual(expect.arrayContaining(['operations_preparation_degraded', 'operations_delivery_blocked', 'operations_public_release_mismatch']));
    expect(report.preparation.providerStop).toBe('ai_quota_exceeded');
  });
  it('projects only bounded confirmed daily create counts from historical read-only metrics', async () => {
    const value = await input(); value.recentDayStatuses = [{ at: '2026-09-30T10:00:00Z',
      status: { ...value.dayStatus, editorialDay: '2026-09-30', secret: privateMarker } }];
    const report = await summarizeNewsOperations(value);
    expect(report.telegram.acknowledgedPerDay).toEqual([
      { day: '2026-09-30', creates: 4, freshCreates: 3, photos: 2, freshPhotos: 2 },
      { day: '2026-10-01', creates: 4, freshCreates: 3, photos: 2, freshPhotos: 2 }]);
    expect(JSON.stringify(report)).not.toContain(privateMarker);
    value.recentDayStatuses.push(value.recentDayStatuses[0]);
    expect((await summarizeNewsOperations(value)).failures).toContain('operations_day_history_invalid');
  });
});

describe('read-only operations report network boundaries', () => {
  it('reads only the fixed KV checkpoint with GET and rejects body overflow', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ checkedAt: current.toISOString() }));
    const read = createNewsOperationsReportReader({ accountId: 'a'.repeat(32), apiToken: 'isolated-token', fetchImpl });
    await read(); expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(new URL(url).origin).toBe('https://api.cloudflare.com');
    expect(new URL(url).pathname.endsWith('/values/literary-news%3Av1%3Adaily-automation%3Anative-report')).toBe(true);
    expect(options.method).toBe('GET'); expect(options.redirect).toBe('error');
    await expect(createNewsOperationsReportReader({ accountId: 'a'.repeat(32), apiToken: 'isolated-token',
      fetchImpl: async () => new Response('x'.repeat(65537)) })()).rejects.toThrow('operations_report_too_large');
  });
  it('stops before private KV or Supabase reads when expected-enabled verification finds disabled Workers', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ success: true, result: { bindings: [
      { name: 'NEWS_AUTOMATION_ENABLED', type: 'plain_text', text: 'false' },
      { name: 'NEWS_AUTOMATION_BOOTSTRAP', type: 'plain_text', text: 'false' },
      { name: 'NEWS_AUTOMATION_WRITER', type: 'plain_text', text: 'native' }] } }));
    await expect(checkNewsOperations({ env: { CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'isolated-token' }, fetchImpl }))
      .rejects.toThrow('native_check_flag_mismatch');
    expect(fetchImpl).toHaveBeenCalledTimes(1); expect(fetchImpl.mock.calls[0][1].method).toBe('GET');
  });
  it('accepts missing report only with Cloudflare JSON error10009, rejecting ambiguous 404s', async () => {
    const options = { accountId: 'a'.repeat(32), apiToken: 'isolated-token' };
    await expect(createNewsOperationsReportReader({ ...options,
      fetchImpl: async () => Response.json({ errors: [{ code: 10009 }] }, { status: 404 }) })()).resolves.toBeNull();
    await expect(createNewsOperationsReportReader({ ...options,
      fetchImpl: async () => Response.json({ errors: [{ code: 10000, message: privateMarker }] }, { status: 404 }) })())
      .rejects.toThrow('operations_report_missing_unconfirmed');
  });
});
