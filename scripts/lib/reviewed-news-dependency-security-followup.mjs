import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// The October 9 repair adds exact security patches; prior authority stays immutable.
export const newsDependencySecurityFollowupAttestation = JSON.parse(readFileSync(
  new URL('../governance/news-dependency-security-followup-reviewed-20261009.json', import.meta.url), 'utf8'));
export const newsDependencySecurityFollowupSha256 = source => createHash('sha256')
  .update(source.replace(/\r\n?/gu, '\n')).digest('hex');

/** Reverse the complete reviewed patch, retaining every unrelated byte for older locks. */
export function projectReviewedNewsDependencySecurityFollowup(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, '\n');
  const deltas = newsDependencySecurityFollowupAttestation.projections.filter(delta => delta.path === relativePath);
  if (!deltas.length) return projected;
  // Older boundaries may receive the predecessor again. A partial downgrade is not a predecessor.
  if (deltas.every(delta => delta.before && !projected.includes(delta.after)
    && projected.split(delta.before).length === 2)) return projected;
  for (const delta of deltas) {
    if (!delta.after || projected.split(delta.after).length !== 2)
      throw new Error('Missing or duplicate reviewed news dependency-security delta: ' + delta.id);
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
