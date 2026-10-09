import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Additive CI resilience evidence; historical authority and acceptance stay intact.
export const postgresTestImageAttestation = JSON.parse(readFileSync(
  new URL('../governance/postgres-test-image-reviewed-20261010.json', import.meta.url), 'utf8'));
export const postgresTestImageSha256 = source => createHash('sha256')
  .update(source.replace(/\r\n?/gu, '\n')).digest('hex');

/** Reverse only the exact bootstrap steps and their outer read integration. */
export function projectReviewedPostgresTestImage(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, '\n');
  const deltas = postgresTestImageAttestation.projections.filter(delta => delta.path === relativePath);
  if (!deltas.length) return projected;
  const markers = postgresTestImageAttestation.markers[relativePath];
  // A complete predecessor is idempotent. Partial removal, altered commands,
  // duplicate steps and mixed old/new integration must never look historical.
  if (markers.every(marker => !projected.includes(marker.text))
    && deltas.every(delta => delta.before && projected.split(delta.before).length === 2
      && !projected.includes(delta.after))) return projected;
  if (markers.some(marker => projected.split(marker.text).length - 1 !== marker.count))
    throw new Error('Missing or duplicate reviewed PostgreSQL test-image delta: ' + relativePath);
  for (const delta of deltas) {
    if (!delta.after || projected.split(delta.after).length !== 2)
      throw new Error('Missing or duplicate reviewed PostgreSQL test-image delta: ' + delta.id);
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
