import { describe, expect, it } from 'vitest';
import { dailyInferenceBudgetGate } from './literary-news-inference-budget.mjs';

const limits = Object.freeze({ aiCallsPerDay: 80, draftRequestsPerDay: 70 });
const day = '2026-11-11';
const at = local => new Date(`${day}T${local}+03:00`);
const gate = (current = at('14:00:00'), extra = {}) => dailyInferenceBudgetGate({
  day, phase: 'draft', current, reservedCalls: 0, draftRequests: 0, limits, ...extra });

describe('Moscow time release within the durable daily inference ceiling', () => {
  it.each([
    ['00:00:00', 20, 40], ['07:59:59', 20, 40], ['08:00:00', 20, 40],
    ['08:14:59', 20, 40], ['08:15:00', 21, 40], ['08:18:00', 21, 41],
    ['14:00:00', 45, 60], ['19:59:59', 69, 79], ['20:00:00', 70, 80], ['23:59:59', 70, 80],
  ])('releases the expected totals at %s Moscow', (time, releasedDraftRequests, releasedCalls) => {
    expect(gate(at(time))).toEqual({ allowed: true, reason: null, nextEligibleAt: null,
      releasedDraftRequests, releasedCalls });
  });

  it('retains afternoon capacity for a legacy day already at forty drafts and forty-seven calls', () => {
    const counters = Object.freeze({ draftRequests: 40, reservedCalls: 47 });
    expect(gate(at('14:00:00'), counters)).toMatchObject({ allowed: true,
      releasedDraftRequests: 45, releasedCalls: 60 });
    expect(counters).toEqual({ draftRequests: 40, reservedCalls: 47 });
  });

  it('returns the exact future minute when both required releases permit another draft', () => {
    const request = { reservedCalls: 40, draftRequests: 20 };
    const deferred = gate(at('07:30:00'), request);
    expect(deferred).toMatchObject({ allowed: false, reason: 'ai_daily_budget_deferred',
      nextEligibleAt: `${day}T05:18:00.000Z` });
    expect(gate(at('08:17:59.999'), request).allowed).toBe(false);
    expect(gate(new Date(deferred.nextEligibleAt), request).allowed).toBe(true);
    const draftOnly = gate(at('07:30:00'), { reservedCalls: 20, draftRequests: 20 });
    expect(draftOnly).toMatchObject({ reason: 'ai_daily_candidate_budget_deferred',
      nextEligibleAt: `${day}T05:15:00.000Z` });
    expect(gate(new Date(draftOnly.nextEligibleAt), { reservedCalls: 20, draftRequests: 20 }).allowed).toBe(true);
  });

  it('allows a review past the draft release and draft ceiling while preserving the shared call ceiling', () => {
    expect(gate(at('07:00:00'), { phase: 'review', reservedCalls: 20, draftRequests: 20 }).allowed).toBe(true);
    expect(gate(at('20:00:00'), { phase: 'review', reservedCalls: 70, draftRequests: 70 }).allowed).toBe(true);
    expect(gate(at('20:00:00'), { reservedCalls: 70, draftRequests: 70 })).toMatchObject({ allowed: false,
      reason: 'ai_daily_candidate_budget_exhausted', nextEligibleAt: null });
    expect(gate(at('20:00:00'), { phase: 'review', reservedCalls: 80, draftRequests: 70 })).toMatchObject({
      allowed: false, reason: 'ai_daily_budget_exhausted', nextEligibleAt: null });
  });

  it('keeps reservations consumed after failures and never mutates checkpoint counters', () => {
    const checkpoint = Object.freeze({ day, phase: 'draft', current: at('07:00:00'),
      reservedCalls: 20, draftRequests: 20, limits });
    const before = JSON.stringify(checkpoint);
    expect(dailyInferenceBudgetGate(checkpoint)).toMatchObject({ allowed: false,
      reason: 'ai_daily_candidate_budget_deferred' });
    expect(dailyInferenceBudgetGate(checkpoint)).toMatchObject({ allowed: false,
      reason: 'ai_daily_candidate_budget_deferred' });
    expect(JSON.stringify(checkpoint)).toBe(before);
  });

  it('uses Moscow midnight across UTC dates and requires explicit fresh counters on the next day', () => {
    const midnight = new Date('2026-11-10T21:00:00Z');
    expect(gate(midnight)).toMatchObject({ releasedDraftRequests: 20, releasedCalls: 40 });
    const tomorrow = new Date('2026-11-11T21:00:00Z');
    expect(() => gate(tomorrow)).toThrow('daily_inference_budget_invalid');
    expect(gate(tomorrow, { day: '2026-11-12' })).toMatchObject({ allowed: true,
      releasedDraftRequests: 20, releasedCalls: 40 });
  });

  it.each([
    { day: '2026-11-10' }, { day: '2026-11-12' }, { day: '2026-02-30' }, { day: '11/11/2026' },
    { current: new Date(NaN) }, { current: '2026-11-11T11:00:00Z' }, { phase: 'repair' },
    { reservedCalls: -1 }, { reservedCalls: 81 }, { reservedCalls: 1.5 }, { reservedCalls: '1' },
    { draftRequests: -1 }, { draftRequests: 71, reservedCalls: 71 }, { draftRequests: 1, reservedCalls: 0 },
    { limits: null }, { limits: { aiCallsPerDay: 81, draftRequestsPerDay: 70 } },
    { limits: { aiCallsPerDay: 80, draftRequestsPerDay: 81 } },
    { limits: { aiCallsPerDay: 80, draftRequestsPerDay: '70' } },
  ])('rejects untrusted or mismatched daily inputs %#', extra => {
    expect(() => gate(at('14:00:00'), extra)).toThrow('daily_inference_budget_invalid');
  });

  it('returns an exact usable future threshold for every temporarily blocked counter across the whole day', () => {
    for (let minute = 0; minute < 20 * 60; minute += 17) {
      const current = new Date(at('00:00:00').getTime() + minute * 60000 + 12345);
      const released = gate(current);
      const counters = { reservedCalls: released.releasedCalls, draftRequests: released.releasedDraftRequests };
      const result = gate(current, counters);
      expect(result.allowed).toBe(false);
      const next = new Date(result.nextEligibleAt);
      expect(next.getTime()).toBeGreaterThan(current.getTime());
      expect(gate(next, counters).allowed).toBe(true);
      expect(gate(new Date(next.getTime() - 1), counters).allowed).toBe(false);
    }
  });

  it('retains afternoon inference for eight separately reviewed valid arrivals after early held work, within eighty calls', () => {
    // Explicit synthetic supply: early candidates are all held; from 14:00 one
    // grounded candidate arrives each half-hour. This proves retained capacity,
    // not a promise that real sources or either model will accept eight stories.
    let draftRequests = 0, reservedCalls = 0, accepted = 0, earlyDrafts = null;
    const checkpoints = [], acceptedAt = [], deferredAt = [];
    const request = (current, phase) => {
      const result = gate(current, { phase, draftRequests, reservedCalls });
      if (!result.allowed) { deferredAt.push(current.toISOString()); return false; }
      reservedCalls++;
      if (phase === 'draft') draftRequests++;
      checkpoints.push({ draftRequests, reservedCalls }); // Durable reservation precedes any model result.
      return true;
    };
    for (let minute = 0; minute < 23 * 60; minute += 30) {
      const current = new Date(at('00:00:00').getTime() + minute * 60000);
      if (minute === 8 * 60) earlyDrafts = draftRequests;
      for (let candidate = 0; candidate < (minute < 14 * 60 ? 5 : 1); candidate++) {
        if (accepted >= 10 || !request(current, 'draft')) break;
        if (minute < 14 * 60) continue; // A real held draft remains charged.
        if (request(current, 'review')) { accepted++; acceptedAt.push(current.toISOString()); }
      }
    }
    expect(earlyDrafts).toBe(20);
    expect(accepted).toBeGreaterThanOrEqual(8);
    expect(accepted).toBeLessThanOrEqual(10);
    expect(acceptedAt.every(value => Date.parse(value) >= at('14:00:00').getTime()
      && Date.parse(value) < at('23:00:00').getTime())).toBe(true);
    expect(draftRequests).toBeLessThanOrEqual(70);
    expect(reservedCalls).toBeLessThanOrEqual(80);
    expect(deferredAt.length).toBeGreaterThan(0);
    checkpoints.forEach((row, index) => {
      expect(row.reservedCalls).toBe(index + 1);
      expect(row.draftRequests).toBeLessThanOrEqual(row.reservedCalls);
    });
  });
});
