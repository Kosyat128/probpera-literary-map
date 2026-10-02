import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// User-requested UI repair evidence; earlier acceptance packets stay immutable.
export const liveUiFollowupAttestation = JSON.parse(readFileSync(
  new URL('../governance/live-ui-followup-reviewed-20261002.json', import.meta.url), 'utf8'));
export const liveUiFollowupSha256 = source => createHash('sha256')
  .update(source.replace(/\r\n?/gu, '\n')).digest('hex');

/** Reverse only exact UI repair fragments before historical read boundaries. */
export function projectReviewedLiveUiFollowup(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, '\n');
  const deltas = liveUiFollowupAttestation.projections.filter(delta => delta.path === relativePath);
  if (!deltas.length) return projected;
  if (deltas.every(delta => !projected.includes(delta.after)
    && (!delta.before || projected.split(delta.before).length === 2))) return projected;
  for (const delta of deltas) {
    if (!delta.after || projected.split(delta.after).length !== 2)
      throw new Error('Missing or duplicate R10 delta (reviewed live UI): ' + delta.id);
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
