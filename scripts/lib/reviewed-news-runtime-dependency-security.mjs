import { createHash } from 'node:crypto';
import { projectReviewedAdminWorkerCompatibility } from './reviewed-admin-worker-compatibility.mjs';
import { readFileSync } from 'node:fs';

// Additive security evidence; previous packets and their assertions stay intact.
export const newsRuntimeDependencySecurityAttestation = JSON.parse(readFileSync(
  new URL('../governance/news-runtime-dependency-security-reviewed-20261025.json', import.meta.url), 'utf8'));
export const newsRuntimeDependencySecuritySha256 = source => createHash('sha256')
  .update(source.replace(/\r\n?/gu, '\n')).digest('hex');

/** Reverse the complete exact security update; expose every unrelated byte. */
export function projectReviewedNewsRuntimeDependencySecurity(relativePath, source) {
  let projected = projectReviewedAdminWorkerCompatibility(relativePath, source);
  const deltas = newsRuntimeDependencySecurityAttestation.projections.filter(delta => delta.path === relativePath);
  if (!deltas.length) return projected;
  const markers = newsRuntimeDependencySecurityAttestation.markers[relativePath];
  // Older readers also receive earlier historical states and unrelated fixtures.
  // Identity is not current approval: the new raw-source pins independently reject
  // complete rollback, while every older full-file lock still sees unknown drift.
  if (markers.every(marker => !projected.includes(marker.text))) return projected;
  if (markers.some(marker => projected.split(marker.text).length - 1 !== marker.count))
    throw new Error('Missing or duplicate reviewed news runtime dependency-security delta: ' + relativePath);
  for (const delta of deltas) {
    if (!delta.after || projected.split(delta.after).length !== 2)
      throw new Error('Missing or duplicate reviewed news runtime dependency-security delta: ' + delta.id);
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
