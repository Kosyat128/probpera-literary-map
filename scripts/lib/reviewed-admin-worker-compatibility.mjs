import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Additive runtime compatibility evidence; previous authority remains immutable.
export const adminWorkerCompatibilityAttestation = JSON.parse(readFileSync(
  new URL('../governance/admin-worker-compatibility-reviewed-20261025.json', import.meta.url), 'utf8'));
export const adminWorkerCompatibilitySha256 = source => createHash('sha256')
  .update(source.replace(/\r\n?/gu, '\n')).digest('hex');

/** Remove only the complete exact adapter update and mandatory runtime gate. */
export function projectReviewedAdminWorkerCompatibility(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, '\n');
  const deltas = adminWorkerCompatibilityAttestation.projections.filter(delta => delta.path === relativePath);
  if (!deltas.length) return projected;
  const markers = adminWorkerCompatibilityAttestation.markers[relativePath];
  // Earlier historical states and unknown fixtures stay visible byte for byte.
  // Current-source approval is enforced independently by the new raw-file pins.
  if (markers.every(marker => !projected.includes(marker.text))) return projected;
  if (markers.some(marker => projected.split(marker.text).length - 1 !== marker.count))
    throw new Error('Missing or duplicate reviewed admin worker compatibility delta: ' + relativePath);
  for (const delta of deltas) {
    if (!delta.after || projected.split(delta.after).length !== 2)
      throw new Error('Missing or duplicate reviewed admin worker compatibility delta: ' + delta.id);
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
