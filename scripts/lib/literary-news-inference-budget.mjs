import { DAILY_NEWS_LIMITS, dailyNewsDay } from './literary-news-daily-profile.mjs';

const MINUTE = 60000, DAY = 24 * 60 * MINUTE;
const OPEN_MINUTE = 8 * 60, FULL_MINUTE = 20 * 60;
const fail = () => { throw Error('daily_inference_budget_invalid'); };
const count = value => Number.isSafeInteger(value) && value >= 0;

/** Read-only admission to the existing durable budget; the caller reserves and
 * checkpoints before inference. Deferred or failed work never refunds a call. */
export function dailyInferenceBudgetGate({ day, phase, current, reservedCalls, draftRequests,
  limits = DAILY_NEWS_LIMITS } = {}) {
  if (!(current instanceof Date) || !Number.isFinite(current.getTime())
    || typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)
    || !['draft', 'review'].includes(phase) || !limits || typeof limits !== 'object'
    || !count(limits.aiCallsPerDay) || limits.aiCallsPerDay < 1 || limits.aiCallsPerDay > 80
    || !count(limits.draftRequestsPerDay) || limits.draftRequestsPerDay < 1
    || limits.draftRequestsPerDay > limits.aiCallsPerDay
    || !count(reservedCalls) || reservedCalls > limits.aiCallsPerDay
    || !count(draftRequests) || draftRequests > limits.draftRequestsPerDay || draftRequests > reservedCalls)
    fail();
  // Moscow is UTC+03 throughout the configured annual news window. Anchor all
  // thresholds explicitly; neither the worker's nor the test host's zone is used.
  const midnight = Date.parse(day + 'T00:00:00+03:00'), at = current.getTime();
  if (!Number.isFinite(midnight) || day !== dailyNewsDay(current)
    || at < midnight || at >= midnight + DAY) fail();
  const minute = Math.floor((at - midnight) / MINUTE);
  const released = (maximum, morning) => {
    const initial = Math.min(maximum, morning);
    if (minute <= OPEN_MINUTE) return initial;
    if (minute >= FULL_MINUTE) return maximum;
    return initial + Math.floor((minute - OPEN_MINUTE) * (maximum - initial) / (FULL_MINUTE - OPEN_MINUTE));
  };
  const releasedDraftRequests = released(limits.draftRequestsPerDay, 20);
  const releasedCalls = released(limits.aiCallsPerDay, 40);
  const result = { allowed: true, reason: null, nextEligibleAt: null, releasedDraftRequests, releasedCalls };
  if (reservedCalls >= limits.aiCallsPerDay)
    return { ...result, allowed: false, reason: 'ai_daily_budget_exhausted' };
  if (phase === 'draft' && draftRequests >= limits.draftRequestsPerDay)
    return { ...result, allowed: false, reason: 'ai_daily_candidate_budget_exhausted' };
  const nextThreshold = (used, maximum, morning) => {
    const initial = Math.min(maximum, morning);
    if (used < initial) return midnight;
    return midnight + (OPEN_MINUTE + Math.ceil((used + 1 - initial)
      * (FULL_MINUTE - OPEN_MINUTE) / (maximum - initial))) * MINUTE;
  };
  const callsDeferred = reservedCalls >= releasedCalls;
  const draftsDeferred = phase === 'draft' && draftRequests >= releasedDraftRequests;
  if (callsDeferred || draftsDeferred) {
    const next = Math.max(callsDeferred ? nextThreshold(reservedCalls, limits.aiCallsPerDay, 40) : midnight,
      draftsDeferred ? nextThreshold(draftRequests, limits.draftRequestsPerDay, 20) : midnight);
    if (!Number.isFinite(next) || next <= at || next >= midnight + DAY) fail();
    return { ...result, allowed: false,
      reason: callsDeferred ? 'ai_daily_budget_deferred' : 'ai_daily_candidate_budget_deferred',
      nextEligibleAt: new Date(next).toISOString() };
  }
  return result;
}
