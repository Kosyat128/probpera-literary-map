import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import configuration from '../data/news/social-destinations.json' with { type: 'json' };
import { verifyNativeNewsWorkers } from './verify-native-news-workers.mjs';
import { fetchPublishedAgenda } from './publish-literary-news.mjs';
import { createDailyNewsStorageClient, validateDailyLedger } from './lib/literary-news-daily-automation.mjs';
import { DAILY_NEWS_PROFILE_KEY, DAILY_NEWS_LEDGER_KEY, DAILY_NEWS_OWNER_KEY, DAILY_NEWS_WINDOW,
  DAILY_NEWS_LIMITS, dailyNewsDay, validateDailyApprovedPayload } from './lib/literary-news-daily-profile.mjs';
import { verifyPublishedNewsSnapshot } from './lib/literary-news-publication.mjs';
import { createNewsRuntimeStore, newsPostKey, newsSemanticRevision } from './lib/literary-news-social.mjs';
import { NEWS_DELIVERY_MAX_INTERVAL_SECONDS, inspectNewsDeliveryPacing, newsDeliveryPacingKey } from './lib/literary-news-pacing.mjs';
import { currentNativeNewsDueRows, selectNativeNewsAdmissionIds } from './lib/literary-news-native-admissions.mjs';
import { trustedSupabaseOrigin } from './lib/trusted-server-url.mjs';
import { validTimestamp } from './lib/literary-news-reviewed.mjs';
import { createDeliverySupabaseFetch, checkedDeliveryDayStatus, checkedDeliveryDueRows } from './workers/literary-news-delivery-worker.mjs';
import { PREPARATION_REPORT_KEY, PREPARATION_ATTEMPT_KEY } from './workers/literary-news-preparation-worker.mjs';

const MAX_AGE = 6 * 3600000;
const PREPARATION_ATTEMPT_MAX_AGE = 90 * 60000;
const DELIVERY_OVERDUE_GRACE = 15 * 60000;
const NAMESPACE = 'f3ae59fd55ee4c0cac8ff1613db81680';
const fail = code => { throw Error(code); };
const safeCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 5000000 ? value : null;
const safeTime = value => validTimestamp(value) ? value : null;
const safeCode = value => typeof value === 'string'
  && /^(?:operations_|native_check_|daily_|ai_|provider_|runtime_)[a-z0-9_]+$/.test(value) ? value : 'operations_check_failed';
const disabledPreparationReason = value => value === 'ai_quota_exceeded' ? value : 'disabled_by_configuration';
const safeResumeTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && validTimestamp(value) && new Date(value).toISOString() === value ? value : null;
const READ_FAILURES = ['operations_public_feed_read_failed', 'operations_profile_read_failed', 'operations_ledger_read_failed',
  'operations_owner_read_failed', 'operations_preparation_report_read_failed', 'operations_destination_read_failed',
  'operations_day_metrics_read_failed', 'operations_due_queue_read_failed', 'operations_delivery_heartbeat_read_failed',
  'operations_day_history_read_failed', 'operations_preparation_attempt_read_failed',
  'operations_pacing_read_failed', 'operations_reserved_post_read_failed', 'operations_supply_read_failed'];
const HELD_REASONS = new Set(['daily_article_evidence_unavailable', 'daily_draft_ungrounded', 'daily_duplicate_topic',
  'daily_existing_or_withdrawn', 'daily_independent_review_rejected', 'daily_model_held', 'daily_publication_date_conflict',
  'daily_publication_date_future', 'daily_publication_date_invalid', 'daily_publication_date_stale',
  'daily_publication_date_unknown', 'daily_source_not_approved', 'daily_review_cache_corrupt', 'daily_record_invalid',
  'daily_record_proof_invalid', 'daily_profile_capacity']);

function heldReasonCounts(rows) {
  if (!Array.isArray(rows) || rows.length > 5000) return null;
  const counts = {};
  for (const row of rows) {
    const reason = HELD_REASONS.has(row?.reason) ? row.reason : 'other';
    counts[reason] = (counts[reason] || 0) + 1;
  }
  return counts;
}

function checkedPreparationAttempt(value, current) {
  const statuses = ['disabled', 'outside_admission_window', 'provider_quota_cooldown', 'busy', 'degraded',
    'provider_degraded', 'supply_degraded', 'target_met'];
  if (value?.schemaVersion !== 1 || !safeTime(value.startedAt) || !safeTime(value.finishedAt)
    || Date.parse(value.startedAt) > Date.parse(value.finishedAt) || Date.parse(value.finishedAt) > current.getTime()
    || !statuses.includes(value.status) || typeof value.publicationConfirmed !== 'boolean'
    || value.reason !== null && typeof value.reason !== 'string'
    || value.retryAfterAt !== null && !safeTime(value.retryAfterAt)) fail('operations_preparation_attempt_invalid');
  const reasons = ['ai_quota_exceeded', 'ai_http_429', 'ai_request_budget_exhausted', 'ai_daily_budget_exhausted',
    'ai_daily_candidate_budget_exhausted', 'provider_cooldown', 'ai_request_unavailable', 'ai_response_incomplete',
    'ai_response_json_invalid', 'daily_checkpoint_unconfirmed', 'daily_provider_unavailable'];
  const reason = value.reason === null ? null : reasons.includes(value.reason) ? value.reason : 'operations_check_failed';
  return { startedAt: value.startedAt, finishedAt: value.finishedAt, status: value.status, reason,
    publicationConfirmed: value.publicationConfirmed, retryAfterAt: value.retryAfterAt };
}

/** Retry transport failures only on the monitor's fixed read routes. Never retry writes or invalid data. */
export function createNewsOperationsRuntimeReadFetch(origin, fetchImpl = fetch,
  { sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) } = {}) {
  const boundedFetch = createDeliverySupabaseFetch(origin, fetchImpl);
  return async (input, options = {}) => {
    const url = new URL(input instanceof URL ? input.href : typeof input === 'string' ? input : input.url);
    const method = (options.method || input?.method || 'GET').toUpperCase();
    const readonly = url.origin === origin && (method === 'GET' && url.pathname === '/rest/v1/admin_audit_log'
      || method === 'POST' && ['/rest/v1/rpc/literary_news_delivery_day_status',
      '/rest/v1/rpc/read_due_literary_news_runtime_posts', '/rest/v1/rpc/literary_news_operations_supply'].includes(url.pathname));
    for (let attempt = 0; ; attempt++) {
      let response;
      try { response = await boundedFetch(input, options); }
      catch (error) {
        if (!readonly || attempt >= 2 || options.signal?.aborted
          || !(error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error?.name))) throw error;
        await sleep(250 * 2 ** attempt); continue;
      }
      if (!readonly || attempt >= 2 || options.signal?.aborted || ![408, 429, 500, 502, 503, 504].includes(response.status)) return response;
      const retryAfter = response.headers.get('retry-after');
      const retryDelay = retryAfter === null ? 0 : /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Infinity;
      // A longer server cooldown belongs to the next scheduled check, not an unbounded retry loop.
      if (retryDelay > 2000) return response;
      await response.body?.cancel().catch(() => {});
      await sleep(Math.max(250 * 2 ** attempt, retryDelay));
    }
  };
}

// Only an explicit configuration flag may remove preparation checks. Missing configuration stays strict.
function preparationConfiguration(env) {
  const value = env.LITERARY_NEWS_NATIVE_PREPARATION_ENABLED;
  if (value !== undefined && value !== '' && value !== 'true' && value !== 'false') fail('operations_configuration_invalid');
  const autoResume = env.LITERARY_NEWS_NATIVE_PREPARATION_AUTO_RESUME;
  if (autoResume !== undefined && autoResume !== '' && autoResume !== 'true' && autoResume !== 'false') fail('operations_configuration_invalid');
  const enabled = value !== 'false';
  return { preparationEnabled: enabled, autoResumeEnabled: autoResume === 'true',
    resumeScheduledAt: autoResume === 'true' ? safeResumeTime(env.LITERARY_NEWS_NATIVE_PREPARATION_RESUME_AFTER) : null,
    preparationBlockReason: enabled ? null : disabledPreparationReason(env.LITERARY_NEWS_NATIVE_PREPARATION_BLOCK_REASON) };
}

/** Count only elapsed publication hours, including across the nightly gap. Bounded to nine days. */
export function newsDeliveryCheckpointAge(checkpoint, current) {
  const beginning = Math.max(Date.parse(checkpoint), Date.parse(DAILY_NEWS_WINDOW.start + 'T08:00:00+03:00'));
  if (!Number.isFinite(beginning) || !Number.isFinite(current.getTime())) return Infinity;
  if (current - beginning > 8 * 86400000) return MAX_AGE + 1;
  let age = 0, opening = Date.parse(dailyNewsDay(new Date(beginning)) + 'T08:00:00+03:00');
  for (let index = 0; index < 9 && opening < current.getTime(); index++, opening += 86400000)
    age += Math.max(0, Math.min(current.getTime(), opening + 15 * 3600000) - Math.max(beginning, opening));
  return age;
}

/** Supply lookup inputs come from the original complete public proof, never
 * from a partial feed or an unverified queue record. Only exact keys, hashes
 * and publication dates cross the service-only read boundary. */
export async function newsOperationsSupplyCandidates(feed, destination, current) {
  await verifyPublishedNewsSnapshot(feed);
  if (feed.timeZone !== DAILY_NEWS_WINDOW.timeZone || feed.fallbackCapturedAt
    || !safeTime(feed.generatedAt) || Math.abs(current - Date.parse(feed.generatedAt)) > 300000)
    fail('operations_public_feed_invalid');
  const byId = new Map(feed.items.map(item => [item.id, item]));
  return Promise.all(selectNativeNewsAdmissionIds(feed, current).map(async id => {
    const item = byId.get(id);
    return { key: newsPostKey(id, { ...destination, mode: 'on' }), textRevision: await newsSemanticRevision(item),
      temporal: { kind: item.kind, eventDate: item.eventDate, publishedAt: item.publishedAt, verifiedAt: item.verifiedAt } };
  }));
}

function checkedSupply(value, candidateCount, current) {
  if (value?.schemaVersion !== 1 || !safeTime(value.checkedAt) || Date.parse(value.checkedAt) !== current.getTime()
    || !Number.isSafeInteger(candidateCount) || candidateCount < 0 || candidateCount > 24 || value.candidateCount !== candidateCount
    || ['readyNow', 'readyByClose', 'ambiguous', 'acknowledged', 'inflight', 'missing', 'stale']
      .some(key => !Number.isSafeInteger(value[key]) || value[key] < 0 || value[key] > candidateCount)
    || value.readyNow > value.readyByClose || value.readyByClose + value.acknowledged > candidateCount
    || value.ambiguousFingerprint !== null && !/^[a-f0-9]{32}$/.test(value.ambiguousFingerprint || '')
    || Boolean(value.ambiguous) !== Boolean(value.ambiguousFingerprint)) fail('operations_supply_invalid');
  return Object.fromEntries(['candidateCount', 'readyNow', 'readyByClose', 'ambiguous', 'acknowledged', 'inflight', 'missing', 'stale',
    'ambiguousFingerprint'].map(key => [key, value[key]]));
}

const postReference = job => createHash('sha256').update(job.key + ':' + (job.desiredRevision || '')).digest('hex').slice(0, 24);

/** Fixed annotations make an editorial reserve warning visible in a green
 * workflow. No remote content or caller-provided text becomes a command. */
export function newsOperationsWorkflowWarnings(report, env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || !Array.isArray(report?.warnings)) return [];
  return report.warnings.includes('operations_delivery_reserve_shortfall') ? [
    '::warning title=Literary news reserve::operations_delivery_reserve_shortfall: The current verified reserve is smaller than the remaining permitted minimum slots. Later preparation may replenish it.',
  ] : [];
}

/** Only two fixed private diagnostic keys. This adapter cannot write or retrieve arbitrary KV content. */
export function createNewsOperationsReportReader({ accountId, apiToken, fetchImpl = fetch, kind = 'report' }) {
  if (typeof accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(accountId)
    || typeof apiToken !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(apiToken)) fail('operations_credentials_missing');
  if (!['report', 'attempt'].includes(kind)) fail('operations_endpoint_rejected');
  return async () => {
    const expectedPath = '/client/v4/accounts/' + accountId + '/storage/kv/namespaces/' + NAMESPACE
      + '/values/' + encodeURIComponent(kind === 'report' ? PREPARATION_REPORT_KEY : PREPARATION_ATTEMPT_KEY), target = new URL('https://api.cloudflare.com');
    target.pathname = expectedPath;
    if (target.origin !== 'https://api.cloudflare.com' || target.protocol !== 'https:' || target.username || target.password
      || target.search || target.hash || target.pathname !== expectedPath) fail('operations_endpoint_rejected');
    const response = await fetchImpl(target.href, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + apiToken, Accept: 'application/json' } });
    if ((!response.ok && response.status !== 404) || !response.body) { await response.body?.cancel().catch(() => {}); fail('operations_report_unavailable'); }
    if (Number(response.headers.get('content-length')) > 65536) { await response.body.cancel(); fail('operations_report_too_large'); }
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      while (true) { const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > 65536) fail('operations_report_too_large'); chunks.push(Buffer.from(value)); }
      let parsed; try { parsed = JSON.parse(Buffer.concat(chunks, size).toString('utf8')); } catch { fail('operations_report_invalid'); }
      if (response.status === 404) {
        if (parsed?.errors?.some(error => error.code === 10009)) return null;
        fail('operations_report_missing_unconfirmed');
      }
      return parsed;
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  };
}

/** Raw sources, article bodies, credentials, model text and remote identifiers never enter this projection. */
export async function summarizeNewsOperations({ feed, profile, ledger, owner, preparationReport, workers, control,
  dayStatus, recentDayStatuses = [], dueRows, deliveryHeartbeat, destination, current = new Date(), expectedHead = null,
  preparationEnabled = true, preparationBlockReason = null, autoResumeEnabled = false, resumeScheduledAt = null,
  preparationAttempt = null, pacingRow = null, reservedPost = null, supply = null, supplyCandidateCount = null, readFailures = [] }) {
  if (!Number.isFinite(current.getTime())) fail('operations_clock_invalid');
  if (typeof preparationEnabled !== 'boolean' || typeof autoResumeEnabled !== 'boolean') fail('operations_configuration_invalid');
  const failures = READ_FAILURES.filter(code => Array.isArray(readFailures) && readFailures.includes(code));
  const unavailable = {
    operations_public_feed_invalid: 'operations_public_feed_read_failed', operations_public_release_mismatch: 'operations_public_feed_read_failed',
    operations_profile_missing_or_invalid: 'operations_profile_read_failed', operations_checkpoint_missing_or_invalid: 'operations_ledger_read_failed',
    operations_native_owner_not_enabled: 'operations_owner_read_failed', operations_preparation_checkpoint_missing: 'operations_preparation_report_read_failed',
    operations_destination_not_enabled: 'operations_destination_read_failed', operations_day_metrics_invalid: 'operations_day_metrics_read_failed',
    operations_due_queue_invalid: 'operations_due_queue_read_failed', operations_delivery_checkpoint_missing: 'operations_delivery_heartbeat_read_failed',
    operations_pacing_invalid: 'operations_pacing_read_failed', operations_reserved_post_missing: 'operations_reserved_post_read_failed',
    operations_supply_invalid: 'operations_supply_read_failed' };
  const add = code => { if (!failures.includes(code) && !failures.includes(unavailable[code])) failures.push(code); };
  const day = dailyNewsDay(current), inWindow = day >= DAILY_NEWS_WINDOW.start && day < DAILY_NEWS_WINDOW.endExclusive;
  const mode = preparationEnabled ? 'enabled' : 'delivery-only';
  if (workers?.readonly !== true || workers.expected !== mode || workers.workers?.length !== 2
    || !workers.workers.some(row => row.flags?.NEWS_AUTOMATION_ENABLED === String(preparationEnabled)
      && (preparationEnabled || row.flags?.NEWS_AUTOMATION_BOOTSTRAP === 'false' && row.flags?.NEWS_AUTOMATION_WRITER === 'native'))
    || !workers.workers.some(row => row.flags?.NEWS_DELIVERY_ENABLED === 'true')) add('operations_workers_not_enabled');
  let publicValid = false, profileValid = false, ledgerValid = false;
  try { await verifyPublishedNewsSnapshot(feed); publicValid = true; } catch { add('operations_public_feed_invalid'); }
  if (publicValid && (feed.timeZone !== DAILY_NEWS_WINDOW.timeZone
    || !safeTime(feed.generatedAt) || Math.abs(current - Date.parse(feed.generatedAt)) > 300000)) add('operations_public_feed_stale');
  if (expectedHead !== null && (!/^[a-f0-9]{40}$/.test(expectedHead) || feed?.snapshot?.release !== expectedHead)) add('operations_public_release_mismatch');
  if (preparationEnabled) {
    try { if (!profile) throw Error(); await validateDailyApprovedPayload(profile, current); profileValid = true; }
    catch { add('operations_profile_missing_or_invalid'); }
    try { if (!ledger) throw Error(); await validateDailyLedger(ledger, current); ledgerValid = true; }
    catch { add('operations_checkpoint_missing_or_invalid'); }
    if (owner?.schemaVersion !== 1 || owner.owner !== 'native' || owner.nativeEnabled !== true || owner.drained !== false)
      add('operations_native_owner_not_enabled');
  }
  const preparationAt = preparationEnabled ? safeTime(preparationReport?.checkedAt) : null, deliveryAt = safeTime(deliveryHeartbeat?.finishedAt);
  let attempt = null;
  if (preparationEnabled && preparationAttempt !== null) {
    try { attempt = checkedPreparationAttempt(preparationAttempt, current); }
    catch { add('operations_preparation_attempt_invalid'); }
  }
  const nextUtcDay = attempt ? new Date(Date.parse(new Date(attempt.finishedAt).toISOString().slice(0, 10) + 'T00:00:00Z') + 86400000).toISOString() : null;
  const quotaRetryAt = attempt?.reason === 'ai_quota_exceeded'
    && ['provider_quota_cooldown', 'provider_degraded'].includes(attempt.status)
    ? attempt.retryAfterAt || (attempt.status === 'provider_degraded' ? nextUtcDay : null) : null;
  const quotaCooldown = Boolean(attempt && quotaRetryAt === nextUtcDay && Date.parse(quotaRetryAt) > current.getTime()
    && current - Date.parse(attempt.finishedAt) < MAX_AGE);
  // The provider did not receive another draft when the durable configured
  // daily cap was already reached. Require the confirmed publication report
  // and its matching, fresh completed attempt; a claimed budget reason alone
  // must never hide quota, checkpoint, stale-state or provider failures.
  const ledgerBudget = ledgerValid ? ledger.inferenceBudgets?.find(row => row.day === day) : null;
  const candidateBudgetDeferred = Boolean(preparationEnabled && profileValid && ledgerValid
    && preparationReport?.schemaVersion === 1 && preparationReport.publicationConfirmed === true && preparationAt
    && preparationReport.stoppedReason === 'ai_daily_candidate_budget_exhausted'
    && safeCount(preparationReport.draftRequestsToday) === DAILY_NEWS_LIMITS.draftRequestsPerDay
    && safeCount(preparationReport.reservedAiCallsToday) !== null
    && preparationReport.reservedAiCallsToday >= DAILY_NEWS_LIMITS.draftRequestsPerDay
    && preparationReport.reservedAiCallsToday <= DAILY_NEWS_LIMITS.aiCallsPerDay
    && ledgerBudget?.draftRequests === DAILY_NEWS_LIMITS.draftRequestsPerDay
    && ledgerBudget.reservedCalls >= preparationReport.reservedAiCallsToday
    && attempt?.status === 'provider_degraded' && attempt.reason === 'ai_daily_candidate_budget_exhausted'
    && attempt.publicationConfirmed === true && attempt.retryAfterAt === null
    && current - Date.parse(attempt.finishedAt) <= PREPARATION_ATTEMPT_MAX_AGE
    && Date.parse(preparationAt) >= Date.parse(attempt.startedAt) && Date.parse(preparationAt) <= Date.parse(attempt.finishedAt)
    && dailyNewsDay(new Date(preparationAt)) === day && dailyNewsDay(new Date(attempt.finishedAt)) === day);
  if (preparationEnabled && (!preparationAt || preparationReport?.schemaVersion !== 1 || preparationReport.publicationConfirmed !== true))
    add('operations_preparation_checkpoint_missing');
  if (inWindow) {
    if (attempt && current - Date.parse(attempt.finishedAt) > PREPARATION_ATTEMPT_MAX_AGE) add('operations_preparation_attempt_stale');
    if (quotaRetryAt && Date.parse(quotaRetryAt) <= current.getTime()) add('operations_preparation_retry_overdue');
    if (preparationAt && (Date.parse(preparationAt) > current.getTime() || !quotaCooldown && current - Date.parse(preparationAt) > MAX_AGE))
      add('operations_preparation_stale');
    if (profileValid && !quotaCooldown && current - Date.parse(profile.generatedAt) > MAX_AGE) add('operations_profile_stale');
    if (ledgerValid && !quotaCooldown && current - Date.parse(ledger.updatedAt) > MAX_AGE) add('operations_ledger_stale');
    if (quotaCooldown || attempt?.status === 'degraded' || preparationEnabled && preparationReport?.stoppedReason
      && preparationReport.stoppedReason !== 'ai_request_budget_exhausted' && !candidateBudgetDeferred)
      add('operations_preparation_degraded');
    if (control?.mode !== 'on' || control.paused !== false || control.historyReconciled !== true) add('operations_destination_not_enabled');
    const firstDelivery = Date.parse(DAILY_NEWS_WINDOW.start + 'T08:00:00+03:00');
    if (current.getTime() >= firstDelivery) {
      if (!deliveryAt) add('operations_delivery_checkpoint_missing');
      else if (Date.parse(deliveryAt) > current.getTime() || newsDeliveryCheckpointAge(deliveryAt, current) > MAX_AGE)
        add('operations_delivery_stale');
    }
    if (deliveryHeartbeat?.status === 'blocked') add('operations_delivery_blocked');
  }
  let deliveryDay = null, due = [], dueValid = false;
  try { deliveryDay = checkedDeliveryDayStatus(dayStatus, current); } catch { add('operations_day_metrics_invalid'); }
  try { due = checkedDeliveryDueRows(dueRows, destination, current); dueValid = true; } catch { add('operations_due_queue_invalid'); }
  let pacing = null, supplyCounts = null;
  if (pacingRow !== null) {
    pacing = inspectNewsDeliveryPacing({ row: pacingRow, destination, current, receipt: reservedPost, control });
    if (!pacing.valid) add('operations_pacing_invalid');
    if (pacingRow?.state && !reservedPost) add('operations_reserved_post_missing');
  }
  if (supplyCandidateCount !== null) {
    try { supplyCounts = checkedSupply(supply, supplyCandidateCount, current); }
    catch { add('operations_supply_invalid'); }
  }
  const perDay = new Map(), records = profileValid ? profile.records : [];
  for (const record of records) { const acceptedDay = dailyNewsDay(new Date(record.provenance.firstAcceptedAt));
    perDay.set(acceptedDay, (perDay.get(acceptedDay) || 0) + 1); }
  const since = dailyNewsDay(new Date(current.getTime() - 6 * 86400000));
  const deliveries = new Map(); if (deliveryDay) deliveries.set(day, deliveryDay);
  if (!Array.isArray(recentDayStatuses) || recentDayStatuses.length > 6) add('operations_day_history_invalid');
  else for (const entry of recentDayStatuses) {
    if (entry?.readFailed === true && failures.includes('operations_day_history_read_failed')) continue;
    try {
      if (!validTimestamp(entry?.at)) throw Error();
      const historicalDay = checkedDeliveryDayStatus(entry.status, new Date(entry.at));
      if (historicalDay.editorialDay < since || historicalDay.editorialDay >= day || deliveries.has(historicalDay.editorialDay)) throw Error();
      deliveries.set(historicalDay.editorialDay, historicalDay);
    } catch { add('operations_day_history_invalid'); }
  }
  const admittedToday = preparationEnabled ? perDay.get(day) || 0 : null, publicIds = new Set(publicValid ? feed.items.map(row => row.id) : []);
  const withdrawnIds = new Set(publicValid ? feed.withdrawals.map(row => row.id) : []);
  if (publicValid && records.some(record => !publicIds.has(record.id) && !withdrawnIds.has(record.id))) add('operations_public_profile_incomplete');
  const sourceStatuses = { ok: 0, error: 0, pending: 0 }, sourceFailures = {};
  if (publicValid) for (const source of feed.sources) {
    if (Object.hasOwn(sourceStatuses, source.status)) sourceStatuses[source.status]++;
    if (source.status === 'error') { const code = /^(?:http_[1-5][0-9]{2}|source_disabled|redirect_not_allowed|unexpected_response_origin|response_too_large|unsupported_content_type|empty_response|no_article_links|unexpected_feed_format|request_timeout|request_aborted|fetch_failed)$/.test(source.error)
      ? source.error : 'source_error'; sourceFailures[code] = (sourceFailures[code] || 0) + 1; }
  }
  const sourceCounts = preparationEnabled ? preparationReport?.native?.sourceCounts : null, sourceIntake = {};
  for (const key of ['approvedActiveSources', 'checkedSources', 'totalFinds', 'unreviewedRecentOrUndated', 'verifiedDetails'])
    sourceIntake[key] = safeCount(sourceCounts?.[key]);
  const preparationCounts = {};
  for (const key of ['newlyAccepted', 'totalSourceDetails', 'aiCalls', 'reservedAiCallsToday', 'draftRequestsToday', 'heldCount'])
    preparationCounts[key] = preparationEnabled ? safeCount(preparationReport?.[key]) : null;
  for (const key of ['maximumCandidateAttempts', 'maximumAiCalls'])
    preparationCounts[key] = preparationEnabled ? safeCount(preparationReport?.native?.[key]) : null;
  const deterministicHeld = preparationEnabled ? preparationReport?.native?.deterministicHeld : null;
  preparationCounts.deterministicHeldCount = Array.isArray(deterministicHeld) && deterministicHeld.length <= 5000 ? deterministicHeld.length : null;
  // An empty due page cannot prove an empty pending queue. Alert only on the
  // independently observed daily delivery gap, with one full interval of grace.
  const deliveryOpening = Date.parse(day + 'T08:00:00+03:00'), deliveryClosing = Date.parse(day + 'T23:00:00+03:00');
  let heartbeatDay = null;
  try { heartbeatDay = checkedDeliveryDayStatus(deliveryHeartbeat?.dayStatus, current); } catch { /* Older/incomplete heartbeats cannot establish a cadence alert. */ }
  const cadenceChecked = Boolean(preparationEnabled && inWindow && failures.length === 0 && deliveryDay && dueValid && due.length === 0
    && current.getTime() >= deliveryOpening + 4 * 3600000 && current.getTime() < deliveryClosing
    && preparationAt && dailyNewsDay(new Date(preparationAt)) === day
    && deliveryAt && current - Date.parse(deliveryAt) <= 15 * 60000
    && deliveryHeartbeat.status === 'daily_target_deficit' && deliveryHeartbeat.phase === 'heartbeat'
    && deliveryHeartbeat.heartbeatRecorded === true && deliveryHeartbeat.budgetStopped === false
    && deliveryHeartbeat.eligibleJobs === 0 && deliveryHeartbeat.selectedJobs === 0 && deliveryHeartbeat.attemptedJobs === 0
    && deliveryHeartbeat.deliveredThisRun === 0 && deliveryHeartbeat.providerWriteAttempts === 0 && deliveryHeartbeat.ambiguousThisRun === 0
    && safeCount(deliveryHeartbeat.inspectedJobs) !== null && deliveryHeartbeat.inspectedJobs <= 20
    && heartbeatDay?.freshCreates === deliveryDay.freshCreates && heartbeatDay?.acknowledgedCreates === deliveryDay.acknowledgedCreates);
  const cadenceMinimum = cadenceChecked ? Math.min(DAILY_NEWS_LIMITS.minimum, deliveryDay.minimum,
    Math.floor((current - deliveryOpening) / (NEWS_DELIVERY_MAX_INTERVAL_SECONDS * 1000)) - 1) : null;
  const cadenceDeficit = cadenceChecked && deliveryDay.freshCreates < cadenceMinimum;
  if (cadenceDeficit) add('operations_delivery_cadence_deficit');
  const publicationOpen = inWindow && current.getTime() >= deliveryOpening && current.getTime() < deliveryClosing;
  const destinationActive = control?.mode === 'on' && control.paused === false && control.historyReconciled === true;
  const freshQuietHeartbeat = Boolean(deliveryAt && current - Date.parse(deliveryAt) >= 0 && current - Date.parse(deliveryAt) <= 15 * 60000
    && ['daily_target_deficit', 'daily_minimum_reached'].includes(deliveryHeartbeat.status) && deliveryHeartbeat.phase === 'heartbeat'
    && deliveryHeartbeat.heartbeatRecorded === true && deliveryHeartbeat.budgetStopped === false
    && deliveryHeartbeat.attemptedJobs === 0 && deliveryHeartbeat.providerWriteAttempts === 0
    && deliveryHeartbeat.deliveredThisRun === 0 && deliveryHeartbeat.ambiguousThisRun === 0
    && heartbeatDay?.freshCreates === deliveryDay?.freshCreates && heartbeatDay?.acknowledgedCreates === deliveryDay?.acknowledgedCreates);
  const overdueChecked = Boolean(publicationOpen && destinationActive && failures.length === 0 && deliveryDay && dueValid
    && publicValid && pacing?.valid && pacing.reason === 'pacing_due' && freshQuietHeartbeat
    && deliveryDay.acknowledgedCreates < deliveryDay.maximum);
  let overdue = [];
  if (overdueChecked) {
    const currentDue = await currentNativeNewsDueRows(due, feed);
    overdue = currentDue.filter(({ state: job }) => {
      if (job.remoteId || job.firstAcknowledgedAt || job.dispatchStartedAt || job.withdrawal
        || job.prepared?.revision !== job.desiredRevision || !safeTime(job.originalAdmission)
        || job.nextDueAt != null && !safeTime(job.nextDueAt)
        || job.status === 'inflight' && !safeTime(job.leaseUntil)) return false;
      const allowedAt = Math.max(Date.parse(pacing.eligibleAt), Date.parse(job.originalAdmission), Date.parse(job.nextDueAt) || 0,
        job.status === 'inflight' ? Date.parse(job.leaseUntil) : 0);
      return current.getTime() - allowedAt >= DELIVERY_OVERDUE_GRACE;
    }).map(({ state: job }) => ({ reference: postReference(job), eligibleAt: new Date(Math.max(Date.parse(pacing.eligibleAt),
      Date.parse(job.originalAdmission), Date.parse(job.nextDueAt) || 0, job.status === 'inflight' ? Date.parse(job.leaseUntil) : 0)).toISOString() }));
  }
  if (overdue.length) add('operations_delivery_post_overdue');
  const reservedAmbiguous = Boolean(reservedPost && pacing?.valid && (reservedPost.status === 'ambiguous'
    || reservedPost.status === 'inflight' && safeTime(reservedPost.dispatchStartedAt)
      && safeTime(reservedPost.leaseUntil) && Date.parse(reservedPost.leaseUntil) <= current.getTime()));
  const reconciliationRequired = Boolean(reservedAmbiguous || supplyCounts?.ambiguous);
  if (publicationOpen && destinationActive && reconciliationRequired) add('operations_delivery_reconciliation_required');
  const possibleSlots = publicationOpen && pacing?.valid && deliveryDay ? Math.min(Math.max(0, deliveryDay.maximum
    - Math.max(pacing.reservations, deliveryDay.acknowledgedCreates)), Math.max(0,
    Math.ceil((deliveryClosing - Math.max(current.getTime(), Date.parse(pacing.eligibleAt))) / (NEWS_DELIVERY_MAX_INTERVAL_SECONDS * 1000)))) : null;
  const requiredReady = possibleSlots === null ? null : Math.min(deliveryDay.deficitToMinimum, possibleSlots);
  const supplyChecked = Boolean(preparationEnabled && publicationOpen && destinationActive && supplyCounts && requiredReady !== null
    && !failures.some(code => READ_FAILURES.includes(code) || ['operations_pacing_invalid', 'operations_day_metrics_invalid'].includes(code)));
  const reserveShortfall = supplyChecked && supplyCounts.readyByClose < requiredReady;
  const reserveEmpty = Boolean(preparationEnabled && publicationOpen && destinationActive && failures.length === 0
    && supplyChecked && freshQuietHeartbeat && pacing.reason === 'pacing_due' && requiredReady > 0
    && supplyCounts.readyNow === 0 && supplyCounts.readyByClose === 0 && supplyCounts.inflight === 0
    && current.getTime() - Date.parse(pacing.eligibleAt) >= DELIVERY_OVERDUE_GRACE);
  if (reserveEmpty) add('operations_delivery_reserve_empty');
  const warnings = reserveShortfall ? ['operations_delivery_reserve_shortfall'] : [];
  const attentionItems = [
    ...(overdue.length ? [{ code: 'operations_delivery_post_overdue', references: overdue.map(row => row.reference).sort() }] : []),
    ...(reconciliationRequired ? [{ code: 'operations_delivery_reconciliation_required', references: [
      ...(reservedAmbiguous ? [postReference(reservedPost)] : []), ...(supplyCounts?.ambiguousFingerprint ? [supplyCounts.ambiguousFingerprint] : [])].sort() }] : []),
    ...(reserveShortfall ? [{ code: 'operations_delivery_reserve_shortfall', references: [day] }] : []),
    ...(reserveEmpty ? [{ code: 'operations_delivery_reserve_empty', references: [day] }] : []),
  ];
  const attentionFingerprint = attentionItems.length ? createHash('sha256').update(JSON.stringify(attentionItems)).digest('hex') : null;
  return { schemaVersion: 1, readonly: true, externalWrites: 0, checkedAt: current.toISOString(), day,
    timeZone: DAILY_NEWS_WINDOW.timeZone, window: DAILY_NEWS_WINDOW, mode, enabledVerified: !failures.includes('operations_workers_not_enabled'),
    requestedMode: workers?.requestedExpected === 'auto-resume' ? 'auto-resume' : mode,
    autoResumeEnabled, resumeScheduledAt: autoResumeEnabled ? safeResumeTime(resumeScheduledAt) : null,
    status: failures.length ? 'failed' : !inWindow ? 'outside_authorized_window' : !preparationEnabled ? 'preparation_disabled'
      : admittedToday < DAILY_NEWS_LIMITS.minimum ? 'supply_degraded' : 'operational',
    failures, warnings, scope: 'Verified schedules describe the configured mode only. Disabled preparation is not operational preparation. Actual accepted news and acknowledged Telegram creates remain separate; the daily target is not a guaranteed supply.',
    attention: { fingerprint: attentionFingerprint, items: attentionItems,
      scope: 'Stable state fingerprint for deduplicating operator notices. This read-only check sends no notice and never retries an ambiguous publication.' },
    public: { valid: publicValid, release: /^[a-f0-9]{40}$/.test(feed?.snapshot?.release || '') ? feed.snapshot.release : null,
      generatedAt: safeTime(feed?.generatedAt), sourceCheckedAt: safeTime(feed?.lastCheckedAt),
      items: publicValid ? feed.items.length : null, sources: publicValid ? feed.sources.length : null,
      sourceStatuses, sourceFailures },
    preparation: { enabled: preparationEnabled, status: preparationEnabled ? 'enabled' : 'preparation_disabled',
      reason: preparationEnabled ? null : disabledPreparationReason(preparationBlockReason),
      lastRunAt: preparationAt, lastAttempt: attempt, quotaCooldown, retryAfterAt: quotaRetryAt,
      budgetDeferred: candidateBudgetDeferred, budgetDeferredReason: candidateBudgetDeferred ? 'ai_daily_candidate_budget_exhausted' : null,
      profileUpdatedAt: preparationEnabled ? safeTime(profile?.generatedAt) : null,
      ledgerUpdatedAt: preparationEnabled ? safeTime(ledger?.updatedAt) : null,
      publishedHistorical: preparationEnabled ? records.length : null, checkpointAccepted: ledgerValid ? ledger.accepted.length : null,
      admittedToday, minimum: DAILY_NEWS_LIMITS.minimum, maximum: DAILY_NEWS_LIMITS.maximum,
      minimumDeficit: preparationEnabled ? Math.max(0, DAILY_NEWS_LIMITS.minimum - admittedToday) : null, sourceIntake,
      lastRunCounts: preparationCounts,
      heldReasons: preparationEnabled ? heldReasonCounts(preparationReport?.held) : null,
      deterministicHeldReasons: heldReasonCounts(deterministicHeld),
      providerStop: preparationEnabled ? quotaCooldown ? 'ai_quota_exceeded' : candidateBudgetDeferred ? null
        : preparationReport?.stoppedReason ? safeCode(preparationReport.stoppedReason) : null
        : preparationBlockReason === 'ai_quota_exceeded' ? 'ai_quota_exceeded' : null,
      acceptedPerDay: preparationEnabled ? [...perDay].filter(([acceptedDay]) => acceptedDay >= since).sort()
        .map(([acceptedDay, count]) => ({ day: acceptedDay, count })) : null },
    telegram: { lastRunAt: deliveryAt, acknowledgedCreatesToday: deliveryDay?.acknowledgedCreates ?? null,
      pacing: pacing?.valid ? { status: pacing.reason, nextDueAt: pacing.nextDueAt, eligibleAt: pacing.eligibleAt,
        reservationsToday: pacing.reservations } : null,
      overdue: { status: overdue.length ? 'overdue' : overdueChecked ? 'within_tolerance' : 'not_evaluated',
        graceSeconds: DELIVERY_OVERDUE_GRACE / 1000, posts: overdue },
      reconciliation: { status: reconciliationRequired ? 'operator_review_required' : 'none_observed',
        currentReservedPost: reservedAmbiguous, currentPublicCandidates: supplyCounts?.ambiguous ?? null },
      reserve: { status: reserveEmpty ? 'empty' : reserveShortfall ? 'shortfall' : supplyChecked ? 'covered' : 'not_evaluated',
        possibleRemainingSlots: possibleSlots, requiredReadyForMinimum: requiredReady, counts: supplyCounts,
        scope: 'Exact latest states matching up to 24 currently eligible public revisions; this selected reserve excludes unseen older queue items and cannot guarantee future editorial supply.' },
      cadence: { status: cadenceDeficit ? 'deficit' : cadenceChecked ? 'within_tolerance' : 'not_evaluated',
        minimumFreshCreatesByNow: cadenceMinimum, graceIntervals: 1, intervalSeconds: NEWS_DELIVERY_MAX_INTERVAL_SECONDS,
        scope: 'Observed acknowledged delivery shortfall only; due reads do not establish whether future jobs or pending supply exist.' },
      acknowledgedPhotoCreatesToday: deliveryDay?.acknowledgedPhotoCreates ?? null,
      freshAcknowledgedCreatesToday: deliveryDay?.freshCreates ?? null, freshAcknowledgedPhotoCreatesToday: deliveryDay?.freshPhotoCreates ?? null,
      minimumDeficit: deliveryDay?.deficitToMinimum ?? null, legacyReceiptsWithUnknownFirstDate: deliveryDay?.legacyReceiptsWithUnknownFirstDate ?? null,
      dueJobs: dueValid ? due.length : null, dueCorrections: dueValid ? due.filter(row => row.state.remoteId).length : null,
      duePhotos: dueValid ? due.filter(row => !row.state.remoteId && row.state.prepared?.media).length : null,
      dueText: dueValid ? due.filter(row => !row.state.remoteId && !row.state.prepared?.media).length : null,
      acknowledgedPerDay: [...deliveries].sort().map(([deliveredDay, counts]) => ({ day: deliveredDay,
        creates: counts.acknowledgedCreates, freshCreates: counts.freshCreates,
        photos: counts.acknowledgedPhotoCreates, freshPhotos: counts.freshPhotoCreates })) } };
}

export async function checkNewsOperations({ env = process.env, fetchImpl = fetch, now = () => new Date(), expectedHead = null } = {}) {
  const preparation = preparationConfiguration(env);
  const expected = preparation.preparationEnabled ? 'enabled' : preparation.autoResumeEnabled ? 'auto-resume' : 'delivery-only';
  const workers = await verifyNativeNewsWorkers({ accountId: env.CLOUDFLARE_ACCOUNT_ID, apiToken: env.CLOUDFLARE_API_TOKEN,
    expected, fetchImpl });
  if (expected === 'auto-resume') {
    if (workers.requestedExpected !== expected || !['enabled', 'delivery-only'].includes(workers.expected)) fail('operations_workers_not_enabled');
    preparation.preparationEnabled = workers.expected === 'enabled';
    if (preparation.preparationEnabled) preparation.preparationBlockReason = null;
  }
  const current = now(), destination = configuration.destinations.find(row => row.platform === 'telegram');
  if (!destination || !env.SUPABASE_SERVICE_ROLE_KEY) fail('operations_credentials_missing');
  const origin = trustedSupabaseOrigin(env.SUPABASE_URL), storage = preparation.preparationEnabled ? createDailyNewsStorageClient({
    accountId: env.CLOUDFLARE_ACCOUNT_ID, apiToken: env.CLOUDFLARE_API_TOKEN, fetchImpl }) : null;
  const client = createClient(origin, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createNewsOperationsRuntimeReadFetch(origin, fetchImpl) } }), store = createNewsRuntimeStore(client);
  const values = await Promise.allSettled([fetchPublishedAgenda(fetchImpl), storage?.read(DAILY_NEWS_PROFILE_KEY),
    storage?.read(DAILY_NEWS_LEDGER_KEY), storage?.read(DAILY_NEWS_OWNER_KEY),
    preparation.preparationEnabled ? createNewsOperationsReportReader({ accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN, fetchImpl })() : null,
    store.read('destination:telegram:' + destination.id),
    client.rpc('literary_news_delivery_day_status', { p_destination_id: destination.id, p_now: current.toISOString() }),
    client.rpc('read_due_literary_news_runtime_posts', { p_destination_id: destination.id, p_now: current.toISOString(), p_limit: 20 }),
    store.read('heartbeat:native-delivery'),
    ...Array.from({ length: 6 }, (_, index) => client.rpc('literary_news_delivery_day_status', {
      p_destination_id: destination.id, p_now: new Date(current.getTime() - (index + 1) * 86400000).toISOString() })),
    preparation.preparationEnabled ? createNewsOperationsReportReader({ accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN, fetchImpl, kind: 'attempt' })() : null,
    store.read(newsDeliveryPacingKey(destination))]);
  const get = index => values[index].status === 'fulfilled' ? values[index].value : null;
  const rpc = index => get(index)?.error ? null : get(index)?.data;
  const readFailures = values.flatMap((result, index) => result.status === 'rejected'
    || (index === 6 || index === 7 || index >= 9 && index < 15) && result.value?.error
    ? [READ_FAILURES[index === 16 ? 11 : index === 15 ? 10 : Math.min(index, 9)]] : []);
  let reservedPost = null, supply = null, supplyCandidateCount = null;
  const pacingRow = get(16), pacing = inspectNewsDeliveryPacing({ row: pacingRow, destination, current, control: get(5)?.state });
  if (values[16].status === 'fulfilled' && pacing.valid && pacingRow?.state) {
    try { reservedPost = (await store.read(pacingRow.state.jobKey)).state; }
    catch { readFailures.push('operations_reserved_post_read_failed'); }
  }
  let candidates = null;
  try {
    if (expectedHead === null || get(0)?.snapshot?.release === expectedHead)
      candidates = await newsOperationsSupplyCandidates(get(0), destination, current);
  } catch { /* The public proof failure is reported independently; it never authorizes a queue-supply lookup. */ }
  if (candidates !== null) {
    supplyCandidateCount = candidates.length;
    try {
      const result = await client.rpc('literary_news_operations_supply', { p_destination_id: destination.id,
        p_candidates: candidates, p_now: current.toISOString() });
      if (result.error) throw Error(); supply = result.data;
    } catch { readFailures.push('operations_supply_read_failed'); }
  }
  return summarizeNewsOperations({ ...preparation, workers, current, destination, expectedHead, readFailures, pacingRow, reservedPost,
    supply, supplyCandidateCount, feed: get(0), profile: get(1), ledger: get(2), owner: get(3),
    preparationReport: get(4), preparationAttempt: get(15), control: get(5)?.state, dayStatus: rpc(6), dueRows: rpc(7), deliveryHeartbeat: get(8)?.state,
    recentDayStatuses: Array.from({ length: 6 }, (_, index) => ({
      at: new Date(current.getTime() - (index + 1) * 86400000).toISOString(), status: rpc(index + 9),
      readFailed: values[index + 9].status === 'rejected' || Boolean(get(index + 9)?.error) })) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let report, output;
  try {
    const { values } = parseArgs({ options: { 'expect-enabled': { type: 'boolean' }, 'expected-head': { type: 'string' }, output: { type: 'string' } }, strict: true });
    output = values.output;
    if (!values['expect-enabled'] || !/^[a-f0-9]{40}$/.test(values['expected-head'] || '')) fail('operations_configuration_invalid');
    report = await checkNewsOperations({ expectedHead: values['expected-head'] });
  } catch (error) { report = { schemaVersion: 1, readonly: true, externalWrites: 0, status: 'failed', code: safeCode(error?.message) }; }
  const json = JSON.stringify(report, null, 2) + '\n';
  if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, json); }
  console.log(json);
  for (const warning of newsOperationsWorkflowWarnings(report)) console.log(warning);
  if (report.status === 'failed') process.exitCode = 1;
}
