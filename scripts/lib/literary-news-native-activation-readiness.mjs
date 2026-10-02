import { validateDailyApprovedPayload } from './literary-news-daily-profile.mjs';
import { validateDailyLedger } from './literary-news-daily-automation.mjs';

/** Read-only prerequisite validation before the deploy workflow changes Workers. */
export async function checkNativeNewsActivationReadiness({ owner, ledger, profile, current = new Date() }) {
  if (!Number.isFinite(current.getTime())) throw Error('daily_activation_clock_invalid');
  if (owner !== null && (!owner || ['schemaVersion', 'owner', 'nativeEnabled', 'drained']
    .some(key => !Object.hasOwn(owner, key)) || owner.schemaVersion !== 1 || owner.owner !== 'native'
    || owner.nativeEnabled !== true || owner.drained !== false))
    throw Error('daily_activation_owner_handoff_required');
  if (ledger !== null) await validateDailyLedger(ledger, current);
  if (profile !== null) await validateDailyApprovedPayload(profile, current);
  return { readonly: true, externalWrites: 0, owner: owner === null ? 'unclaimed' : 'native',
    bootstrapRequired: owner === null, retainedLedgerRecords: ledger?.accepted.length ?? 0,
    retainedPublicProfileRecords: profile?.records.length ?? 0, checkpointValidation: 'passed' };
}
