import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { projectReviewedR10SourcePunctuation } from './reviewed-r10-source-punctuation.mjs';

// Owner requested correcting failures; this AI review claims no packet-specific
// human approval and grants no release acceptance. Historical pins stay intact.
export const undiciSecurityFollowupAttestation=JSON.parse(readFileSync(
  new URL('../governance/undici-security-followup-reviewed-20260930.json',import.meta.url),'utf8'));
export const undiciSecurityFollowupSha256=source=>createHash('sha256').update(source.replace(/\r\n?/gu,'\n')).digest('hex');

/** Reverse only the two lock entries and six exact read-boundary fragments.
 * Missing/duplicated fragments reject; unrelated bytes reach historical locks. */
export function projectReviewedUndiciSecurityFollowup(relativePath,source) {
  let projected=projectReviewedR10SourcePunctuation(relativePath,source);
  const deltas=undiciSecurityFollowupAttestation.projections.filter(delta=>delta.path===relativePath);
  if(!deltas.length)return projected;
  if(undiciSecurityFollowupSha256(projected)===undiciSecurityFollowupAttestation.sourceBaselines[relativePath])return projected;
  for(const delta of deltas){
    if(!delta.after||projected.split(delta.after).length!==2)
      throw Error('Missing or duplicate reviewed Undici security delta: '+delta.id);
    projected=projected.replace(delta.after,delta.before);
  }
  return projected;
}
