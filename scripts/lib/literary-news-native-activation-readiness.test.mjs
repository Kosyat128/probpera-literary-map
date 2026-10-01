import { describe, expect, it } from 'vitest';
import { checkNativeNewsActivationReadiness as check } from './literary-news-native-activation-readiness.mjs';
import { emptyDailyLedger } from './literary-news-daily-automation.mjs';
import { makeDailyApprovedPayload } from './literary-news-daily-profile.mjs';
const current = new Date('2026-10-02T01:00:00Z');
const owner = { schemaVersion: 1, owner: 'native', nativeEnabled: true, drained: false };

describe('Read-only native preparation activation prerequisites', () => {
  it('permits the authorized initial bootstrap without writing or inventing accepted records', async () => {
    expect(await check({ owner: null, ledger: null, profile: null, current })).toEqual({ readonly: true,
      externalWrites: 0, owner: 'unclaimed', bootstrapRequired: true, retainedLedgerRecords: 0,
      retainedPublicProfileRecords: 0, checkpointValidation: 'passed' });
  });
  it('validates retained native checkpoints while projecting only safe counts', async () => {
    const ledger = emptyDailyLedger(current), profile = await makeDailyApprovedPayload([], current);
    const report = await check({ owner: { ...owner, privateMarker: 'KEEP_PRIVATE' }, ledger, profile, current });
    expect(report.bootstrapRequired).toBe(false); expect(report.checkpointValidation).toBe('passed');
    expect(JSON.stringify(report)).not.toContain('KEEP_PRIVATE');
  });
  it.each([{ ...owner, owner: 'node-fallback' }, { ...owner, nativeEnabled: false },
    { ...owner, drained: true }, { ...owner, schemaVersion: 2 }, {}, undefined])
    ('refuses an unknown or competing owner before activation: %j', async changed => {
      await expect(check({ owner: changed, ledger: null, profile: null, current }))
        .rejects.toThrow('daily_activation_owner_handoff_required');
    });
  it('refuses inherited ownership and corrupt retained data rather than resetting it', async () => {
    await expect(check({ owner: Object.create(owner), ledger: null, profile: null, current }))
      .rejects.toThrow('daily_activation_owner_handoff_required');
    await expect(check({ owner, ledger: {}, profile: null, current })).rejects.toThrow();
    await expect(check({ owner, ledger: null, profile: {}, current })).rejects.toThrow();
    await expect(check({ owner, ledger: null, profile: null, current: new Date('invalid') }))
      .rejects.toThrow('daily_activation_clock_invalid');
  });
});
