import { describe, expect, it, vi } from 'vitest';
import { checkNewsOperations, createNewsOperationsReportReader, newsDeliveryCheckpointAge, summarizeNewsOperations } from './check-literary-news-operations.mjs';
import { makeDailyApprovedPayload, DAILY_NEWS_WINDOW, DAILY_NEWS_PROFILE_KEY, DAILY_NEWS_LEDGER_KEY,
  DAILY_NEWS_OWNER_KEY } from './lib/literary-news-daily-profile.mjs';
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

function disablePreparation(value, reason = 'ai_quota_exceeded') {
  value.preparationEnabled = false; value.preparationBlockReason = reason;
  value.workers.expected = 'delivery-only';
  value.workers.workers[0].flags = { NEWS_AUTOMATION_ENABLED: 'false', NEWS_AUTOMATION_BOOTSTRAP: 'false', NEWS_AUTOMATION_WRITER: 'native' };
  return value;
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
  it('reports explicitly disabled preparation without fabricated checkpoints or zero admission counts', async () => {
    const value = disablePreparation(await input());
    value.profile = null; value.ledger = null; value.owner = null; value.preparationReport = null;
    value.recentDayStatuses = [{ at: '2026-09-30T10:00:00Z', status: { ...value.dayStatus, editorialDay: '2026-09-30' } }];
    const report = await summarizeNewsOperations(value);
    expect(report.status).toBe('preparation_disabled'); expect(report.mode).toBe('delivery-only');
    expect(report.failures).toEqual([]); expect(report.enabledVerified).toBe(true);
    expect(report.preparation).toMatchObject({ enabled: false, status: 'preparation_disabled', reason: 'ai_quota_exceeded',
      lastRunAt: null, profileUpdatedAt: null, ledgerUpdatedAt: null, publishedHistorical: null, checkpointAccepted: null,
      admittedToday: null, minimumDeficit: null, acceptedPerDay: null, providerStop: 'ai_quota_exceeded' });
    expect(Object.values(report.preparation.sourceIntake)).toEqual([null, null, null, null, null]);
    expect(report.public.valid).toBe(true); expect(report.public.release).toBe(release);
    expect(report.telegram.freshAcknowledgedCreatesToday).toBe(3); expect(report.telegram.minimumDeficit).toBe(7);
    expect(report.telegram.acknowledgedPerDay).toHaveLength(2);
  });
  it('ignores stale private preparation reports and never infers quota exhaustion from them', async () => {
    const value = disablePreparation(await input(), privateMarker);
    value.preparationReport.stoppedReason = 'ai_quota_exceeded'; value.preparationReport.checkedAt = '2020-01-01T00:00:00Z';
    value.owner.nativeEnabled = false;
    const report = await summarizeNewsOperations(value);
    expect(report.status).toBe('preparation_disabled'); expect(report.failures).toEqual([]);
    expect(report.preparation.reason).toBe('disabled_by_configuration'); expect(report.preparation.providerStop).toBeNull();
    expect(JSON.stringify(report)).not.toContain(privateMarker); expect(JSON.stringify(report)).not.toContain('2020-01-01');
  });
  it.each(['destination', 'heartbeat', 'release', 'metrics', 'history', 'workers'])(
    'retains the %s failure while preparation is disabled', async boundary => {
      const value = disablePreparation(await input());
      const codes = { destination: 'operations_destination_not_enabled', heartbeat: 'operations_delivery_checkpoint_missing',
        release: 'operations_public_release_mismatch', metrics: 'operations_day_metrics_invalid',
        history: 'operations_day_history_invalid', workers: 'operations_workers_not_enabled' };
      if (boundary === 'destination') value.control.paused = true;
      if (boundary === 'heartbeat') value.deliveryHeartbeat = null;
      if (boundary === 'release') value.expectedHead = 'b'.repeat(40);
      if (boundary === 'metrics') value.dayStatus = null;
      if (boundary === 'history') value.recentDayStatuses = [{ at: current.toISOString(), status: value.dayStatus }];
      if (boundary === 'workers') value.workers.workers[0].flags.NEWS_AUTOMATION_BOOTSTRAP = 'true';
      const report = await summarizeNewsOperations(value);
      expect(report.status).toBe('failed'); expect(report.failures).toContain(codes[boundary]);
      expect(report.preparation.status).toBe('preparation_disabled');
    });
  it.each(['2026-10-03T00:00:00Z', '2026-10-03T03:00:00.000+03:00', '2026-02-30T00:00:00.000Z', privateMarker])(
    'does not expose a noncanonical resume timestamp: %s', async timestamp => {
      const value = disablePreparation(await input()); value.autoResumeEnabled = true; value.resumeScheduledAt = timestamp;
      const report = await summarizeNewsOperations(value);
      expect(report.resumeScheduledAt).toBeNull(); expect(JSON.stringify(report)).not.toContain(privateMarker);
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
  it.each([
    { label: 'default full mode' },
    { label: 'auto-resume without an explicit preparation false flag', autoResume: 'true' },
    { label: 'explicit full mode with auto-resume', preparation: 'true', autoResume: 'true' },
  ])('keeps $label strict before private KV or Supabase reads', async scenario => {
    const fetchImpl = vi.fn(async () => Response.json({ success: true, result: { bindings: [
      { name: 'NEWS_AUTOMATION_ENABLED', type: 'plain_text', text: 'false' },
      { name: 'NEWS_AUTOMATION_BOOTSTRAP', type: 'plain_text', text: 'false' },
      { name: 'NEWS_AUTOMATION_WRITER', type: 'plain_text', text: 'native' }] } }));
    await expect(checkNewsOperations({ env: { CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'isolated-token',
      LITERARY_NEWS_NATIVE_PREPARATION_ENABLED: scenario.preparation,
      LITERARY_NEWS_NATIVE_PREPARATION_AUTO_RESUME: scenario.autoResume }, fetchImpl }))
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
  it.each([
    { label: 'explicit delivery-only', autoResume: false, actualPreparation: false },
    { label: 'auto-resume before preparation starts', autoResume: true, actualPreparation: false },
    { label: 'auto-resume after preparation starts despite the original false repository flag', autoResume: true, actualPreparation: true },
    { label: 'auto-resume with missing actual preparation checkpoints', autoResume: true, actualPreparation: true, missingPreparation: true },
    { label: 'auto-resume with an actual preparation quota failure', autoResume: true, actualPreparation: true, providerStop: 'ai_quota_exceeded' },
  ])('checks $label through four real Worker GETs and keeps actual read-only metrics', async scenario => {
    const value = await input(), calls = [], origin = 'https://isolated-test.supabase.co';
    if (scenario.providerStop) value.preparationReport.stoppedReason = scenario.providerStop;
    const fetchImpl = vi.fn(async (request, options = {}) => {
      const url = new URL(request instanceof URL ? request.href : typeof request === 'string' ? request : request.url);
      const method = options.method || 'GET'; calls.push({ url, method, body: options.body });
      if (url.origin === 'https://api.cloudflare.com') {
        if (url.pathname.endsWith('/settings')) {
          const preparation = url.pathname.includes('/probpera-literary-news-preparation/');
          return Response.json({ success: true, result: { bindings: preparation ? [
            { name: 'NEWS_AUTOMATION_ENABLED', type: 'plain_text', text: String(scenario.actualPreparation) },
            { name: 'NEWS_AUTOMATION_BOOTSTRAP', type: 'plain_text', text: String(scenario.actualPreparation) },
            { name: 'NEWS_AUTOMATION_WRITER', type: 'plain_text', text: 'native' }]
            : [{ name: 'NEWS_DELIVERY_ENABLED', type: 'plain_text', text: 'true' }] } });
        }
        if (url.pathname.endsWith('/schedules')) return Response.json({ success: true, result: { schedules: [{
          cron: url.pathname.includes('/probpera-literary-news-preparation/') ? '17 */2 * * *' : '0 5-19 * * *' }] } });
        if (scenario.actualPreparation && url.pathname.includes('/storage/kv/')) {
          const documents = new Map([[DAILY_NEWS_PROFILE_KEY, value.profile], [DAILY_NEWS_LEDGER_KEY, value.ledger],
            [DAILY_NEWS_OWNER_KEY, value.owner], ['literary-news:v1:daily-automation:native-report', value.preparationReport]]);
          const key = decodeURIComponent(url.pathname.split('/').at(-1));
          if (documents.has(key)) return scenario.missingPreparation
            ? Response.json({ errors: [{ code: 10009 }] }, { status: 404 }) : Response.json(documents.get(key));
        }
        throw Error('Unexpected private Cloudflare request');
      }
      if (url.origin === 'https://news.probpera.ru') return Response.json(value.feed, { headers: { 'x-probpera-news-release': release } });
      if (url.origin === origin && url.pathname === '/rest/v1/admin_audit_log' && method === 'GET') {
        const key = url.searchParams.get('entity_id');
        if (key?.startsWith('eq.destination:telegram:')) return Response.json([{ id: 1, metadata: value.control }]);
        if (key === 'eq.heartbeat:native-delivery') return Response.json([{ id: 2, metadata: value.deliveryHeartbeat }]);
      }
      if (url.origin === origin && url.pathname === '/rest/v1/rpc/literary_news_delivery_day_status' && method === 'POST') {
        const args = JSON.parse(options.body);
        return Response.json({ ...value.dayStatus, editorialDay: args.p_now.slice(0, 10) });
      }
      if (url.origin === origin && url.pathname === '/rest/v1/rpc/read_due_literary_news_runtime_posts' && method === 'POST') return Response.json([]);
      throw Error('Unexpected network request');
    });
    const report = await checkNewsOperations({ fetchImpl, now: () => current, expectedHead: release,
      env: { CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'isolated-token',
        SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: 'isolated-service-key',
        LITERARY_NEWS_NATIVE_PREPARATION_ENABLED: 'false', LITERARY_NEWS_NATIVE_PREPARATION_BLOCK_REASON: 'ai_quota_exceeded',
        LITERARY_NEWS_NATIVE_PREPARATION_AUTO_RESUME: String(scenario.autoResume),
        LITERARY_NEWS_NATIVE_PREPARATION_RESUME_AFTER: '2026-10-03T00:00:00.000Z' } });
    expect(report.mode).toBe(scenario.actualPreparation ? 'enabled' : 'delivery-only');
    expect(report.requestedMode).toBe(scenario.autoResume ? 'auto-resume' : 'delivery-only');
    expect(report.resumeScheduledAt).toBe(scenario.autoResume ? '2026-10-03T00:00:00.000Z' : null);
    if (scenario.missingPreparation || scenario.providerStop) {
      expect(report.status).toBe('failed'); expect(report.preparation.enabled).toBe(true); expect(report.preparation.reason).toBeNull();
      expect(report.failures).toContain(scenario.providerStop ? 'operations_preparation_degraded' : 'operations_preparation_checkpoint_missing');
    } else {
      expect(report.status).toBe(scenario.actualPreparation ? 'supply_degraded' : 'preparation_disabled'); expect(report.failures).toEqual([]);
    }
    const cloudflare = calls.filter(row => row.url.origin === 'https://api.cloudflare.com' && row.url.pathname.includes('/workers/scripts/'));
    expect(cloudflare).toHaveLength(4); expect(cloudflare.every(row => row.method === 'GET')).toBe(true);
    expect(cloudflare.map(row => row.url.pathname.split('/').at(-1))).toEqual(['settings', 'schedules', 'settings', 'schedules']);
    const privateKv = calls.filter(row => row.url.pathname.includes('/storage/kv/'));
    expect(privateKv).toHaveLength(scenario.actualPreparation ? 4 : 0); expect(privateKv.every(row => row.method === 'GET')).toBe(true);
    const rpcs = calls.filter(row => row.method === 'POST');
    expect(rpcs).toHaveLength(8); expect(rpcs.filter(row => row.url.pathname.endsWith('/literary_news_delivery_day_status'))).toHaveLength(7);
    expect(rpcs.every(row => ['/rest/v1/rpc/literary_news_delivery_day_status', '/rest/v1/rpc/read_due_literary_news_runtime_posts'].includes(row.url.pathname))).toBe(true);
    expect(report.public.release).toBe(release); expect(report.telegram.lastRunAt).toBe(current.toISOString());
    expect(report.telegram.acknowledgedPerDay).toHaveLength(7); expect(report.telegram.freshAcknowledgedCreatesToday).toBe(3);
    if (!scenario.actualPreparation) {
      expect(report.preparation.lastRunAt).toBeNull(); expect(report.preparation.admittedToday).toBeNull();
    } else if (!scenario.missingPreparation) {
      expect(report.preparation.lastRunAt).toBe(current.toISOString()); expect(report.preparation.admittedToday).toBe(0);
      expect(report.preparation.reason).toBeNull(); expect(report.preparation.providerStop).toBe(scenario.providerStop || null);
    }
    expect(JSON.stringify(report)).not.toContain(privateMarker); expect(JSON.stringify(report)).not.toContain('isolated-service-key');
  });
  it.each(['LITERARY_NEWS_NATIVE_PREPARATION_ENABLED', 'LITERARY_NEWS_NATIVE_PREPARATION_AUTO_RESUME'])(
    'rejects an unknown literal %s flag before any network request', async flag => {
    const fetchImpl = vi.fn();
    await expect(checkNewsOperations({ env: { [flag]: 'False' }, fetchImpl }))
      .rejects.toThrow('operations_configuration_invalid');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
