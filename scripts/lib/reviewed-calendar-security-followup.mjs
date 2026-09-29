import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

// General owner authorization to fix mandatory failures; no packet-specific
// human approval, historical acceptance, publication or release is asserted.
export const calendarSecurityFollowupAttestation=JSON.parse(readFileSync(
  new URL('../governance/calendar-security-followup-reviewed-20260930.json',import.meta.url),'utf8'));
export const calendarSecurityFollowupSha256=source=>createHash('sha256')
  .update(source.replace(/\r\n?/gu,'\n')).digest('hex');

/** Restore only exact CodeQL fixes and their bounded historical read adapters. */
export function projectReviewedCalendarSecurityFollowup(relativePath,source){
  let projected=source.replace(/\r\n?/gu,'\n');
  const deltas=calendarSecurityFollowupAttestation.projections.filter(delta=>delta.path===relativePath);
  if(!deltas.length)return projected;
  if(calendarSecurityFollowupSha256(projected)===calendarSecurityFollowupAttestation.sourceBaselines[relativePath])return projected;
  for(const delta of deltas){
    if(!delta.after||projected.split(delta.after).length!==2)
      throw Error('Missing or duplicate reviewed calendar security delta: '+delta.id);
    projected=projected.replace(delta.after,delta.before);
  }
  return projected;
}
