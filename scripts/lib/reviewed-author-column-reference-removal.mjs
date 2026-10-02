import {createHash} from 'node:crypto';
import {projectReviewedLiveUiFollowup} from './reviewed-live-ui-followup.mjs';
import {readFileSync} from 'node:fs';

// Owner-requested author-column refinement; prior authority remains unchanged.
export const authorColumnReferenceRemovalAttestation=JSON.parse(readFileSync(
 new URL('../governance/author-column-reference-removal-reviewed-20261002.json',import.meta.url),'utf8'));
export const authorColumnReferenceRemovalSha256=source=>createHash('sha256')
 .update(source.replace(/\r\n?/gu,'\n')).digest('hex');

/** Reverse only the five exact owner-requested removal/browser/read fragments. */
export function projectReviewedAuthorColumnReferenceRemoval(relativePath,source){
 let projected=projectReviewedLiveUiFollowup(relativePath,source);
 const deltas=authorColumnReferenceRemovalAttestation.projections.filter(d=>d.path===relativePath);
 if(!deltas.length)return projected;
 if(deltas.every(d=>!projected.includes(d.after)&&d.before&&projected.split(d.before).length===2))return projected;
 for(const delta of deltas){
  if(!delta.after||projected.split(delta.after).length!==2)
   throw Error('Missing or duplicate reviewed author-column reference delta: '+delta.id);
  projected=projected.replace(delta.after,delta.before);
 }
 return projected;
}
