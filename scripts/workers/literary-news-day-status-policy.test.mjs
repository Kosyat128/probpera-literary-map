import { describe, expect, it } from 'vitest';
import { checkedDeliveryDayStatus } from './literary-news-delivery-worker.mjs';

const current = new Date('2026-10-09T09:00:00Z');
const status = (minimum = 10, maximum = 20) => ({ editorialDay: '2026-10-09', timeZone: 'Europe/Moscow', minimum, maximum,
  acknowledgedCreates: 12, acknowledgedPhotoCreates: 4, freshCreates: 3, freshPhotoCreates: 2,
  legacyReceiptsWithUnknownFirstDate: 1, deficitToMinimum: minimum - 3 });

describe('Moscow dated 8-10 delivery metrics policy', () => {
  it.each([[10, 20], [10, 15], [8, 10]])('accepts valid %i/%i rollout metrics without altering receipts', (minimum, maximum) => {
    const value = status(minimum, maximum), result = checkedDeliveryDayStatus(value, current);
    expect(result).toEqual({ ...value, minimum: 8, maximum: 10, deficitToMinimum: 5 });
    expect(value.minimum).toBe(minimum); expect(value.maximum).toBe(maximum);
    expect(result.acknowledgedCreates).toBe(12); // Earlier receipts remain true even if the new cap is lower.
  });
  it.each([15, 20])('preserves historical 10/%i counts and policy through the Moscow midnight boundary', maximum => {
    const value = { ...status(10, maximum), editorialDay: '2026-10-08' };
    expect(checkedDeliveryDayStatus(value, new Date('2026-10-08T20:59:59Z'))).toBe(value);
    expect(checkedDeliveryDayStatus(status(10, maximum), new Date('2026-10-08T21:00:00Z')))
      .toMatchObject({ minimum: 8, maximum: 10, deficitToMinimum: 5 });
  });
  it.each([
    value => ({ ...value, freshCreates: 13 }),
    value => ({ ...value, freshPhotoCreates: 4 }),
    value => ({ ...value, acknowledgedPhotoCreates: 13 }),
    value => ({ ...value, legacyReceiptsWithUnknownFirstDate: -1 }),
    value => ({ ...value, deficitToMinimum: 5 }), // A raw legacy reply must first satisfy its original minimum.
    value => ({ ...value, minimum: 8, maximum: 20, deficitToMinimum: 5 }),
    value => ({ ...value, minimum: 10, maximum: 10 }),
  ])('rejects inconsistent metrics before any rollout normalization', mutate => {
    expect(() => checkedDeliveryDayStatus(mutate(status()), current)).toThrow('runtime_day_status_invalid');
  });
  it('does not apply the new target to a historical day or fabricate missing counts', () => {
    expect(() => checkedDeliveryDayStatus({ ...status(8, 10), editorialDay: '2026-10-08' }, new Date('2026-10-08T12:00:00Z')))
      .toThrow('runtime_day_status_invalid');
    expect(() => checkedDeliveryDayStatus({ ...status(), freshCreates: undefined }, current)).toThrow('runtime_day_status_invalid');
  });
});
