import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Additive patch evidence. Historical attestations and acceptance remain intact.
export const nextSecurityFollowupAttestation = JSON.parse(readFileSync(
  new URL('../governance/next-security-followup-reviewed-20261002.json', import.meta.url), 'utf8'));
export const nextSecurityFollowupSha256 = source => createHash('sha256')
  .update(source.replace(/\r\n?/gu, '\n')).digest('hex');

/** Reverse exact Next patch and read-boundary fragments; retain unrelated bytes. */
export function projectReviewedNextSecurityFollowup(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, '\n');
  const deltas = nextSecurityFollowupAttestation.projections.filter(delta => delta.path === relativePath);
  if (!deltas.length) return projected;
  // Older calendar projections can already have removed their own integration.
  // Marker-free script bytes still reach their unchanged historical hash checks.
  if (relativePath.startsWith('scripts/lib/') && !projected.includes('projectReviewedNextSecurityFollowup'))
    return projected;
  if (nextSecurityFollowupSha256(projected) === nextSecurityFollowupAttestation.sourceBaselines[relativePath])
    return projected;
  if (deltas.every(delta => !projected.includes(delta.after)
    && (!delta.before || [delta.before, ...(delta.earlierBeforeVariants ?? [])]
      .some(before => projected.split(before).length === 2)))) return projected;
  for (const delta of deltas) {
    if (!delta.after || projected.split(delta.after).length !== 2)
      throw new Error('Missing or duplicate reviewed Next security delta: ' + delta.id);
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
