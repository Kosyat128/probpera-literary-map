import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Additive browser repair evidence; historical assertions and acceptance stay intact.
export const cmsPreviewWebglFollowupAttestation = JSON.parse(readFileSync(
  new URL('../governance/cms-preview-webgl-followup-reviewed-20261111.json', import.meta.url), 'utf8'));
export const cmsPreviewWebglFollowupSha256 = source => createHash('sha256')
  .update(source.replace(/\r\n?/gu, '\n')).digest('hex');

/** Reverse only the exact serial-lane addition and its outer read boundaries. */
export function projectReviewedCmsPreviewWebglFollowup(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, '\n');
  const deltas = cmsPreviewWebglFollowupAttestation.projections.filter(delta => delta.path === relativePath);
  if (!deltas.length) return projected;
  const markers = cmsPreviewWebglFollowupAttestation.markers[relativePath];
  // Identity for earlier sources is not current approval: independent raw-file
  // pins reject rollback and retain all unrelated bytes for historical locks.
  if (markers.every(marker => !projected.includes(marker.text))) return projected;
  if (markers.some(marker => projected.split(marker.text).length - 1 !== marker.count))
    throw new Error('Missing or duplicate reviewed CMS preview WebGL delta: ' + relativePath);
  for (const delta of deltas) {
    if (!delta.after || projected.split(delta.after).length !== 2)
      throw new Error('Missing or duplicate reviewed CMS preview WebGL delta: ' + delta.id);
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
