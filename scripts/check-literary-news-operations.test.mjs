import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { checkNewsOperations, createNewsOperationsReportReader, createNewsOperationsRuntimeReadFetch,
  newsDeliveryCheckpointAge, summarizeNewsOperations } from './check-literary-news-operations.mjs';
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
    dayStatus: { editorialDay: '2026-10-01', timeZone: 'Europe/Moscow', minimum: 10, maximum: 20,
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

function completedPreparationAttempt(finishedAt, fields = {}) {
  return { schemaVersion: 1, startedAt: finishedAt, finishedAt, status: 'supply_degraded',
    reason: null, publicationConfirmed: true, retryAfterAt: null, ...fields };
}

async function cadenceInput(at = '2026-10-09T09:00:00Z', freshCreates = 0) {
  const value = await input(new Date(at));
  Object.assign(value.dayStatus, { editorialDay: '2026-10-09', minimum: 8, maximum: 10, acknowledgedCreates: freshCreates, acknowledgedPhotoCreates: 0, freshCreates,
    freshPhotoCreates: 0, deficitToMinimum: Math.max(0, 8 - freshCreates) });
  Object.assign(value.deliveryHeartbeat, { phase: 'heartbeat', heartbeatRecorded: true, budgetStopped: false,
    eligibleJobs: 0, selectedJobs: 0, attemptedJobs: 0, deliveredThisRun: 0, providerWriteAttempts: 0,
    ambiguousThisRun: 0, inspectedJobs: 0, dayStatus: { ...value.dayStatus } });
  return value;
}

describe('bounded read-only news operations projection', () => {
  it('alerts a verified material delivery gap after noon without claiming pending supply is empty', async () => {
    const report = await summarizeNewsOperations(await cadenceInput());
    expect(report.status).toBe('failed'); expect(report.failures).toEqual(['operations_delivery_cadence_deficit']);
    expect(report.telegram.cadence).toMatchObject({ status: 'deficit', minimumFreshCreatesByNow: 1, graceIntervals: 1, intervalSeconds: 6300 });
    expect(report.telegram.cadence.scope).toContain('do not establish');
    expect(report.readonly).toBe(true); expect(report.externalWrites).toBe(0);
    expect(JSON.stringify(report)).not.toContain(privateMarker);
  });
  it.each([
    ['2026-10-09T09:00:00Z', 1, 1], ['2026-10-09T10:30:00Z', 2, 2], ['2026-10-09T19:30:00Z', 8, 7],
  ])('allows 105-minute spacing and the completed daily minimum at %s', async (at, creates, minimum) => {
    const report = await summarizeNewsOperations(await cadenceInput(at, creates));
    expect(report.failures).not.toContain('operations_delivery_cadence_deficit');
    expect(report.telegram.cadence).toMatchObject({ status: 'within_tolerance', minimumFreshCreatesByNow: minimum });
  });
  it.each(['2026-10-09T08:59:59Z', '2026-10-09T20:00:00Z', '2026-10-09T04:59:59Z'])(
    'does not alert before noon or overnight at %s', async at => {
      const report = await summarizeNewsOperations(await cadenceInput(at));
      expect(report.failures).not.toContain('operations_delivery_cadence_deficit');
      expect(report.telegram.cadence).toMatchObject({ status: 'not_evaluated', minimumFreshCreatesByNow: null });
    });
  it.each(['stale_heartbeat', 'missing_count', 'string_count', 'negative_count', 'eligible_work', 'unconfirmed',
    'budget_deferred', 'inconsistent_metrics', 'invalid_metrics', 'failed_read', 'quota', 'disabled'])(
    'does not infer a cadence failure from %s', async boundary => {
      const value = await cadenceInput();
      if (boundary === 'stale_heartbeat') value.deliveryHeartbeat.finishedAt = '2026-10-09T08:44:59Z';
      if (boundary === 'missing_count') delete value.deliveryHeartbeat.eligibleJobs;
      if (boundary === 'string_count') value.deliveryHeartbeat.eligibleJobs = '0';
      if (boundary === 'negative_count') value.deliveryHeartbeat.inspectedJobs = -1;
      if (boundary === 'eligible_work') value.deliveryHeartbeat.eligibleJobs = 1;
      if (boundary === 'unconfirmed') value.deliveryHeartbeat.heartbeatRecorded = false;
      if (boundary === 'budget_deferred') value.deliveryHeartbeat.budgetStopped = true;
      if (boundary === 'inconsistent_metrics') value.deliveryHeartbeat.dayStatus.acknowledgedCreates = 1;
      if (boundary === 'invalid_metrics') value.dayStatus.freshCreates = -1;
      if (boundary === 'failed_read') { value.dueRows = null; value.readFailures = ['operations_due_queue_read_failed']; }
      if (boundary === 'quota') value.preparationReport.stoppedReason = 'ai_quota_exceeded';
      if (boundary === 'disabled') disablePreparation(value);
      const report = await summarizeNewsOperations(value);
      expect(report.failures).not.toContain('operations_delivery_cadence_deficit');
      expect(report.telegram.cadence.status).toBe('not_evaluated');
    });
  it('separates actual receipts and supply deficit from enabled schedules without publishing private data', async () => {
    const report = await summarizeNewsOperations(await input());
    expect(report.status).toBe('supply_degraded'); expect(report.failures).toEqual([]);
    expect(report.readonly).toBe(true); expect(report.externalWrites).toBe(0);
    expect(report.telegram.freshAcknowledgedCreatesToday).toBe(3); expect(report.telegram.minimumDeficit).toBe(7);
    expect(report.preparation.admittedToday).toBe(0); expect(report.preparation.minimumDeficit).toBe(8);
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
  it.each([[90 * 60000 - 1, false], [90 * 60000, false], [90 * 60000 + 1, true]])(
    'checks preparation attempts independently of fresh publication state at age %i ms', async (age, stale) => {
      const value = await input();
      value.preparationAttempt = completedPreparationAttempt(new Date(current.getTime() - age).toISOString());
      const report = await summarizeNewsOperations(value);
      expect(report.failures).toEqual(stale ? ['operations_preparation_attempt_stale'] : []);
      expect(report.preparation.lastRunAt).toBe(current.toISOString());
      expect(report.readonly).toBe(true); expect(report.externalWrites).toBe(0);
    });
  it.each([[6 * 3600000, false], [6 * 3600000 + 1, true]])(
    'retains the six-hour publication threshold with a fresh preparation attempt at age %i ms', async (age, stale) => {
      const value = await input(), older = new Date(current.getTime() - age);
      value.preparationReport.checkedAt = older.toISOString(); value.profile = await makeDailyApprovedPayload([], older);
      value.ledger = emptyDailyLedger(older); value.preparationAttempt = completedPreparationAttempt(current.toISOString());
      const report = await summarizeNewsOperations(value);
      expect(report.failures).toEqual(stale
        ? ['operations_preparation_stale', 'operations_profile_stale', 'operations_ledger_stale'] : []);
    });
  it.each(['provider_quota_cooldown', 'provider_degraded'])(
    'flags a stopped preparation heartbeat during %s while preserving quota publication semantics', async status => {
      const value = await input(), older = new Date(current.getTime() - 8 * 3600000);
      value.preparationReport.checkedAt = older.toISOString(); value.preparationReport.stoppedReason = 'ai_quota_exceeded';
      value.profile = await makeDailyApprovedPayload([], older); value.ledger = emptyDailyLedger(older);
      value.preparationAttempt = completedPreparationAttempt(new Date(current.getTime() - 100 * 60000).toISOString(), {
        status, reason: 'ai_quota_exceeded', publicationConfirmed: false,
        retryAfterAt: status === 'provider_quota_cooldown' ? '2026-10-02T00:00:00.000Z' : null });
      const report = await summarizeNewsOperations(value);
      expect(report.preparation.quotaCooldown).toBe(true);
      expect(report.preparation.retryAfterAt).toBe('2026-10-02T00:00:00.000Z');
      expect(report.failures).toEqual(['operations_preparation_attempt_stale', 'operations_preparation_degraded']);
    });
  it('does not require a new heartbeat from explicitly disabled preparation', async () => {
    const value = disablePreparation(await input());
    value.preparationAttempt = completedPreparationAttempt(new Date(current.getTime() - 2 * 3600000).toISOString());
    const report = await summarizeNewsOperations(value);
    expect(report.failures).toEqual([]); expect(report.status).toBe('preparation_disabled');
  });
  it.each(['2026-09-28T10:00:00Z', '2027-09-30T10:00:00Z'])(
    'does not require preparation attempts outside the authorized admission window at %s', async at => {
      const value = await input(new Date(at)); value.dayStatus.editorialDay = at.slice(0, 10);
      value.preparationAttempt = completedPreparationAttempt(new Date(Date.parse(at) - 2 * 3600000).toISOString());
      const report = await summarizeNewsOperations(value);
      expect(report.failures).not.toContain('operations_preparation_attempt_stale');
      expect(report.status).toBe('outside_authorized_window');
    });
  it.each([null, undefined])('retains legacy checkpoint compatibility when the optional attempt is %s', async preparationAttempt => {
    const report = await summarizeNewsOperations({ ...await input(), preparationAttempt });
    expect(report.failures).toEqual([]); expect(report.preparation.lastRunAt).toBe(current.toISOString());
  });
  it('uses a fresh quota attempt to distinguish an active cooldown from a stopped preparation schedule', async () => {
    const value = await input(), older = new Date(current.getTime() - 8 * 3600000);
    value.preparationReport.checkedAt = older.toISOString(); value.preparationReport.stoppedReason = 'ai_quota_exceeded';
    value.profile = await makeDailyApprovedPayload([], older); value.ledger = emptyDailyLedger(older);
    value.preparationAttempt = { schemaVersion: 1, startedAt: current.toISOString(), finishedAt: current.toISOString(),
      status: 'provider_quota_cooldown', reason: 'ai_quota_exceeded', publicationConfirmed: false, retryAfterAt: '2026-10-02T00:00:00.000Z' };
    const report = await summarizeNewsOperations(value);
    expect(report.status).toBe('failed'); expect(report.failures).toEqual(['operations_preparation_degraded']);
    expect(report.preparation.quotaCooldown).toBe(true); expect(report.preparation.providerStop).toBe('ai_quota_exceeded');
    expect(report.preparation.retryAfterAt).toBe('2026-10-02T00:00:00.000Z');
    // The first completed run can record quota exhaustion before the later cooldown-only run.
    value.preparationAttempt.status = 'provider_degraded'; value.preparationAttempt.retryAfterAt = null;
    expect((await summarizeNewsOperations(value)).preparation.quotaCooldown).toBe(true);
  });
  it.each(['old', 'expired', 'extended', 'unrelated', 'invalid'])(
    'does not hide stale checkpoints behind a %s preparation attempt', async boundary => {
      const value = await input(), older = new Date(current.getTime() - 8 * 3600000);
      value.preparationReport.checkedAt = older.toISOString(); value.profile = await makeDailyApprovedPayload([], older);
      value.ledger = emptyDailyLedger(older);
      value.preparationAttempt = { schemaVersion: 1, startedAt: current.toISOString(), finishedAt: current.toISOString(),
        status: 'provider_quota_cooldown', reason: 'ai_quota_exceeded', publicationConfirmed: false, retryAfterAt: '2026-10-02T00:00:00.000Z' };
      if (boundary === 'old') value.preparationAttempt.startedAt = value.preparationAttempt.finishedAt = older.toISOString();
      if (boundary === 'expired') value.preparationAttempt.retryAfterAt = '2026-10-01T00:00:00.000Z';
      if (boundary === 'extended') value.preparationAttempt.retryAfterAt = '2026-10-03T00:00:00.000Z';
      if (boundary === 'unrelated') value.preparationAttempt.reason = 'daily_' + privateMarker.toLowerCase();
      if (boundary === 'invalid') value.preparationAttempt.finishedAt = privateMarker;
      const report = await summarizeNewsOperations(value);
      expect(report.preparation.quotaCooldown).toBe(false);
      expect(report.failures).toEqual(expect.arrayContaining(['operations_preparation_stale', 'operations_profile_stale', 'operations_ledger_stale']));
      if (boundary === 'expired') expect(report.failures).toContain('operations_preparation_retry_overdue');
      if (boundary === 'old') expect(report.failures).toContain('operations_preparation_attempt_stale');
      if (boundary === 'invalid') expect(report.failures).toContain('operations_preparation_attempt_invalid');
      expect(JSON.stringify(report).toLowerCase()).not.toContain(privateMarker.toLowerCase());
    });
  it('projects bounded candidate and AI counts with fixed held reason labels only', async () => {
    const value = await input();
    Object.assign(value.preparationReport, { newlyAccepted: 2, totalSourceDetails: 9, aiCalls: 8,
      reservedAiCallsToday: 40, draftRequestsToday: 25, heldCount: 4,
      held: [{ reason: 'daily_model_held', prompt: privateMarker }, { reason: 'daily_model_held' },
        { reason: 'daily_' + privateMarker.toLowerCase() }, { reason: privateMarker } ] });
    Object.assign(value.preparationReport.native, { maximumCandidateAttempts: 12, maximumAiCalls: 24,
      deterministicHeld: [{ reason: 'daily_existing_or_withdrawn', sourceId: privateMarker }] });
    const report = await summarizeNewsOperations(value);
    expect(report.preparation.lastRunCounts).toEqual({ newlyAccepted: 2, totalSourceDetails: 9, aiCalls: 8,
      reservedAiCallsToday: 40, draftRequestsToday: 25, heldCount: 4, maximumCandidateAttempts: 12,
      maximumAiCalls: 24, deterministicHeldCount: 1 });
    expect(report.preparation.heldReasons).toEqual({ daily_model_held: 2, other: 2 });
    expect(report.preparation.deterministicHeldReasons).toEqual({ daily_existing_or_withdrawn: 1 });
    expect(JSON.stringify(report).toLowerCase()).not.toContain(privateMarker.toLowerCase());
    value.preparationReport.aiCalls = 5000001; value.preparationReport.native.maximumAiCalls = privateMarker;
    value.preparationReport.held = Array(5001).fill({ reason: privateMarker });
    const invalid = await summarizeNewsOperations(value);
    expect(invalid.preparation.lastRunCounts.aiCalls).toBeNull();
    expect(invalid.preparation.lastRunCounts.maximumAiCalls).toBeNull(); expect(invalid.preparation.heldReasons).toBeNull();
  });
  it('distinguishes a failed runtime read from a successfully read invalid queue or disabled destination', async () => {
    const value = await input(); value.dueRows = null; value.control = null;
    value.readFailures = ['operations_due_queue_read_failed', 'operations_destination_read_failed', privateMarker];
    const unavailable = await summarizeNewsOperations(value);
    expect(unavailable.failures).toEqual(['operations_destination_read_failed', 'operations_due_queue_read_failed']);
    expect(unavailable.status).toBe('failed'); expect(unavailable.telegram.dueJobs).toBeNull();
    expect(JSON.stringify(unavailable)).not.toContain(privateMarker);
    value.readFailures = [];
    const invalid = await summarizeNewsOperations(value);
    expect(invalid.failures).toEqual(expect.arrayContaining(['operations_due_queue_invalid', 'operations_destination_not_enabled']));
    expect(invalid.telegram.dueJobs).toBeNull();
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
  it('retains a malformed historical metric even when a different historical read fails', async () => {
    const value = await input(); value.readFailures = ['operations_day_history_read_failed'];
    value.recentDayStatuses = [{ at: '2026-09-30T10:00:00Z', status: null, readFailed: true }];
    expect((await summarizeNewsOperations(value)).failures).toEqual(['operations_day_history_read_failed']);
    value.recentDayStatuses.push({ at: '2026-09-29T10:00:00Z', status: { invalid: privateMarker } });
    expect((await summarizeNewsOperations(value)).failures).toEqual(['operations_day_history_read_failed', 'operations_day_history_invalid']);
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
  const runtimeOrigin = 'https://isolated-test.supabase.co';
  it('retries transient runtime GET/RPC reads with bounded backoff and preserves the final empty queue', async () => {
    for (const [path, method, first] of [
      ['/rest/v1/admin_audit_log', 'GET', async () => { throw new TypeError('fetch failed ' + privateMarker); }],
      ['/rest/v1/rpc/read_due_literary_news_runtime_posts', 'POST', async () => Response.json({ message: privateMarker }, { status: 503 })],
      ['/rest/v1/rpc/literary_news_delivery_day_status', 'POST', async () => Response.json({ message: privateMarker }, { status: 429, headers: { 'retry-after': '1' } })],
    ]) {
      const fetchImpl = vi.fn().mockImplementationOnce(first).mockResolvedValueOnce(Response.json([])), sleep = vi.fn();
      const response = await createNewsOperationsRuntimeReadFetch(runtimeOrigin, fetchImpl, { sleep })(runtimeOrigin + path, { method });
      expect(await response.json()).toEqual([]); expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledExactlyOnceWith(path.endsWith('day_status') ? 1000 : 250);
      expect(fetchImpl.mock.calls.every(([url, options]) => url === runtimeOrigin + path && options.method === method
        && options.redirect === 'error')).toBe(true);
    }
  });
  it('stops after three transient attempts and does not retry longer server cooldowns', async () => {
    const sleep = vi.fn(), fetchImpl = vi.fn(async () => Response.json({ message: privateMarker }, { status: 503 }));
    const response = await createNewsOperationsRuntimeReadFetch(runtimeOrigin, fetchImpl, { sleep })(runtimeOrigin + '/rest/v1/admin_audit_log');
    expect(response.status).toBe(503); expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[250], [500]]);
    const cooldown = vi.fn(async () => Response.json({}, { status: 429, headers: { 'retry-after': '60' } }));
    await createNewsOperationsRuntimeReadFetch(runtimeOrigin, cooldown, { sleep })(runtimeOrigin + '/rest/v1/admin_audit_log');
    expect(cooldown).toHaveBeenCalledTimes(1);
  });
  it.each([200, 400, 401, 403, 404, 402])('does not retry invalid shapes or permanent HTTP %s failures', async status => {
    const fetchImpl = vi.fn(async () => Response.json({ invalid: privateMarker }, { status })), sleep = vi.fn();
    await createNewsOperationsRuntimeReadFetch(runtimeOrigin, fetchImpl, { sleep })(runtimeOrigin + '/rest/v1/rpc/read_due_literary_news_runtime_posts', { method: 'POST' });
    expect(fetchImpl).toHaveBeenCalledTimes(1); expect(sleep).not.toHaveBeenCalled();
  });
  it('preserves quota and endpoint fences and never retries a mutation', async () => {
    const fetchImpl = vi.fn(async () => Response.json({}, { status: 503 })), sleep = vi.fn();
    const read = createNewsOperationsRuntimeReadFetch(runtimeOrigin, fetchImpl, { sleep });
    await read(runtimeOrigin + '/rest/v1/rpc/compare_append_literary_news_runtime', { method: 'POST' });
    expect(fetchImpl).toHaveBeenCalledTimes(1); expect(sleep).not.toHaveBeenCalled();
    await expect(read('https://untrusted.example/rest/v1/admin_audit_log')).rejects.toThrow('delivery_network_rejected');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const quotaFetch = vi.fn(async () => Response.json({}, { status: 402 }));
    const quotaRead = createNewsOperationsRuntimeReadFetch(runtimeOrigin, quotaFetch, { sleep });
    await quotaRead(runtimeOrigin + '/rest/v1/admin_audit_log');
    await expect(quotaRead(runtimeOrigin + '/rest/v1/admin_audit_log')).rejects.toThrow('runtime_quota_exceeded');
    expect(quotaFetch).toHaveBeenCalledTimes(1);
  });
  it('reads only the fixed KV checkpoint with GET and rejects body overflow', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ checkedAt: current.toISOString() }));
    const read = createNewsOperationsReportReader({ accountId: 'a'.repeat(32), apiToken: 'isolated-token', fetchImpl });
    await read(); expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(new URL(url).origin).toBe('https://api.cloudflare.com');
    expect(new URL(url).pathname.endsWith('/values/literary-news%3Av1%3Adaily-automation%3Anative-report')).toBe(true);
    expect(options.method).toBe('GET'); expect(options.redirect).toBe('error');
    await createNewsOperationsReportReader({ accountId: 'a'.repeat(32), apiToken: 'isolated-token', fetchImpl, kind: 'attempt' })();
    expect(new URL(fetchImpl.mock.calls[1][0]).pathname.endsWith('/values/literary-news%3Av1%3Adaily-automation%3Anative-attempt')).toBe(true);
    expect(() => createNewsOperationsReportReader({ accountId: 'a'.repeat(32), apiToken: 'isolated-token', fetchImpl, kind: privateMarker }))
      .toThrow('operations_endpoint_rejected');
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
    { label: 'transient queue read recovers', actualPreparation: false, dueFailures: 1 },
    { label: 'queue read remains unavailable', actualPreparation: false, dueFailures: 3, readFailure: 'operations_due_queue_read_failed' },
    { label: 'invalid queue is not a transport failure', actualPreparation: false, invalidQueue: true },
    { label: 'destination read is unauthorized', actualPreparation: false, unauthorizedDestination: true, readFailure: 'operations_destination_read_failed' },
  ])('checks $label through four real Worker GETs and keeps actual read-only metrics', async scenario => {
    const value = await input(), calls = [], origin = 'https://isolated-test.supabase.co';
    let dueAttempts = 0;
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
          cron: url.pathname.includes('/probpera-literary-news-preparation/') ? '17,47 * * * *' : '*/5 5-19 * * *' }] } });
        if (scenario.actualPreparation && url.pathname.includes('/storage/kv/')) {
          const documents = new Map([[DAILY_NEWS_PROFILE_KEY, value.profile], [DAILY_NEWS_LEDGER_KEY, value.ledger],
            [DAILY_NEWS_OWNER_KEY, value.owner], ['literary-news:v1:daily-automation:native-report', value.preparationReport]]);
          const key = decodeURIComponent(url.pathname.split('/').at(-1));
          if (key === 'literary-news:v1:daily-automation:native-attempt') return Response.json({ errors: [{ code: 10009 }] }, { status: 404 });
          if (documents.has(key)) return scenario.missingPreparation
            ? Response.json({ errors: [{ code: 10009 }] }, { status: 404 }) : Response.json(documents.get(key));
        }
        throw Error('Unexpected private Cloudflare request');
      }
      if (url.origin === 'https://news.probpera.ru') return Response.json(value.feed, { headers: { 'x-probpera-news-release': release } });
      if (url.origin === origin && url.pathname === '/rest/v1/admin_audit_log' && method === 'GET') {
        const key = url.searchParams.get('entity_id');
        if (key?.startsWith('eq.destination:telegram:')) return scenario.unauthorizedDestination
          ? Response.json({ message: privateMarker }, { status: 401 }) : Response.json([{ id: 1, metadata: value.control }]);
        if (key === 'eq.heartbeat:native-delivery') return Response.json([{ id: 2, metadata: value.deliveryHeartbeat }]);
      }
      if (url.origin === origin && url.pathname === '/rest/v1/rpc/literary_news_delivery_day_status' && method === 'POST') {
        const args = JSON.parse(options.body);
        return Response.json({ ...value.dayStatus, editorialDay: args.p_now.slice(0, 10) });
      }
      if (url.origin === origin && url.pathname === '/rest/v1/rpc/read_due_literary_news_runtime_posts' && method === 'POST') {
        if (++dueAttempts <= (scenario.dueFailures || 0)) return Response.json({ message: privateMarker }, { status: 503 });
        return Response.json(scenario.invalidQueue ? { invalid: privateMarker } : []);
      }
      throw Error('Unexpected network request');
    });
    const report = await checkNewsOperations({ fetchImpl, now: () => current, expectedHead: release,
      env: { CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'isolated-token',
        SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: 'isolated-service-key',
        LITERARY_NEWS_NATIVE_PREPARATION_ENABLED: 'false', LITERARY_NEWS_NATIVE_PREPARATION_BLOCK_REASON: 'ai_quota_exceeded',
        LITERARY_NEWS_NATIVE_PREPARATION_AUTO_RESUME: String(Boolean(scenario.autoResume)),
        LITERARY_NEWS_NATIVE_PREPARATION_RESUME_AFTER: '2026-10-03T00:00:00.000Z' } });
    expect(report.mode).toBe(scenario.actualPreparation ? 'enabled' : 'delivery-only');
    expect(report.requestedMode).toBe(scenario.autoResume ? 'auto-resume' : 'delivery-only');
    expect(report.resumeScheduledAt).toBe(scenario.autoResume ? '2026-10-03T00:00:00.000Z' : null);
    if (scenario.readFailure || scenario.invalidQueue) {
      expect(report.status).toBe('failed'); expect(report.failures).toEqual([scenario.readFailure || 'operations_due_queue_invalid']);
      if (scenario.readFailure === 'operations_due_queue_read_failed' || scenario.invalidQueue) expect(report.telegram.dueJobs).toBeNull();
    } else if (scenario.missingPreparation || scenario.providerStop) {
      expect(report.status).toBe('failed'); expect(report.preparation.enabled).toBe(true); expect(report.preparation.reason).toBeNull();
      expect(report.failures).toContain(scenario.providerStop ? 'operations_preparation_degraded' : 'operations_preparation_checkpoint_missing');
    } else {
      expect(report.status).toBe(scenario.actualPreparation ? 'supply_degraded' : 'preparation_disabled'); expect(report.failures).toEqual([]);
    }
    const cloudflare = calls.filter(row => row.url.origin === 'https://api.cloudflare.com' && row.url.pathname.includes('/workers/scripts/'));
    expect(cloudflare).toHaveLength(4); expect(cloudflare.every(row => row.method === 'GET')).toBe(true);
    expect(cloudflare.map(row => row.url.pathname.split('/').at(-1))).toEqual(['settings', 'schedules', 'settings', 'schedules']);
    const privateKv = calls.filter(row => row.url.pathname.includes('/storage/kv/'));
    expect(privateKv).toHaveLength(scenario.actualPreparation ? 5 : 0); expect(privateKv.every(row => row.method === 'GET')).toBe(true);
    const rpcs = calls.filter(row => row.method === 'POST');
    expect(rpcs).toHaveLength(8 + Math.min(scenario.dueFailures || 0, 2)); expect(rpcs.filter(row => row.url.pathname.endsWith('/literary_news_delivery_day_status'))).toHaveLength(7);
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
  it('checks every half hour after preparation without adding deployment or mutation commands', () => {
    const workflow = parse(readFileSync(new URL('../.github/workflows/check-literary-news-operations.yml', import.meta.url), 'utf8'));
    expect(workflow.on).toEqual({ workflow_dispatch: null, schedule: [{ cron: '27,57 * * * *' }] });
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency).toEqual({ group: 'literary-news-operations-check', 'cancel-in-progress': false });
    expect(Object.keys(workflow.jobs)).toEqual(['status']);
    const job = workflow.jobs.status;
    expect(job.if).toBe("github.ref == 'refs/heads/main' && vars.LITERARY_NEWS_NATIVE_DELIVERY_ENABLED == 'true'");
    expect(job.steps.filter(step => step.run).map(step => step.run)).toEqual([
      'npm ci', 'npx vitest run scripts/check-literary-news-operations.test.mjs',
      'node scripts/check-literary-news-operations.mjs --expect-enabled --expected-head "$GITHUB_SHA" --output .tmp/news-operations/status.json',
    ]);
    expect(job.steps.filter(step => step.uses).map(step => step.uses)).toEqual([
      'actions/checkout@v7', 'actions/setup-node@v7', 'actions/upload-artifact@v7',
    ]);
    expect(job.steps.at(-1).with).toMatchObject({ path: '.tmp/news-operations/status.json', 'retention-days': 14 });
  });
});
