import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// An additive agent evidence review; no human review or release acceptance.
export const russianCalendarExpansionAttestation = JSON.parse(readFileSync(
  new URL('../governance/russian-calendar-expansion-reviewed-20261001.json', import.meta.url), 'utf8'));
export const russianCalendarExpansionSha256 = source => createHash('sha256')
  .update(source.replace(/\r\n?/gu, '\n')).digest('hex');
export const reviewedRussianCalendarExpansionAdditionPaths = new Set(
  russianCalendarExpansionAttestation.additions.map(entry => entry.path));

/** Reverse only exact new date-packet fragments; preserve every unrelated byte. */
export function projectReviewedRussianCalendarExpansion(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, '\n');
  const deltas = russianCalendarExpansionAttestation.projections.filter(delta => delta.path === relativePath);
  if (!deltas.length) return projected;
  if (deltas.every(delta => !projected.includes(delta.after)
    && (!delta.before || projected.split(delta.before).length === 2))) return projected;
  for (const delta of deltas) {
    if (!delta.after || projected.split(delta.after).length !== 2)
      throw new Error('Missing or duplicate reviewed Russian calendar expansion delta: ' + delta.id);
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}

export function isReviewedRussianCalendarExpansionAddition(relativePath, source) {
  const entry = russianCalendarExpansionAttestation.additions.find(item => item.path === relativePath);
  return Boolean(entry && russianCalendarExpansionSha256(source) === entry.sha256Lf);
}
