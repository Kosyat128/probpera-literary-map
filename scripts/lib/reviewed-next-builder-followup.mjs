import {createHash} from 'node:crypto';
import {projectReviewedAuthorColumnReferenceRemoval} from './reviewed-author-column-reference-removal.mjs';
import {readFileSync} from 'node:fs';

// Additive local agent evidence; unchanged earlier authority and release gates.
export const nextBuilderFollowupAttestation=JSON.parse(readFileSync(
 new URL('../governance/next-builder-followup-reviewed-20261002.json',import.meta.url),'utf8'));
export const nextBuilderFollowupSha256=source=>createHash('sha256')
 .update(source.replace(/\r\n?/gu,'\n')).digest('hex');

/** Remove only exact builder-followup fragments; unrelated drift stays visible. */
export function projectReviewedNextBuilderFollowup(relativePath,source){
 let projected=projectReviewedAuthorColumnReferenceRemoval(relativePath,source);
 const deltas=nextBuilderFollowupAttestation.projections.filter(delta=>delta.path===relativePath);
 if(!deltas.length)return projected;
 // Older calendar readers can have removed this builder boundary already.
 // Leave those bytes untouched for their unchanged whole-file/fragment locks.
 if(relativePath.startsWith('scripts/build-')&&!projected.includes('projectReviewedNextBuilderFollowup'))return projected;
 if(nextBuilderFollowupSha256(projected)===nextBuilderFollowupAttestation.sourceBaselines[relativePath])return projected;
 if(deltas.every(delta=>!projected.includes(delta.after)&&delta.before&&
  [delta.before,...(delta.earlierBeforeVariants||[])].some(before=>projected.split(before).length===2)))return projected;
 for(const delta of deltas){
  if(!delta.after||projected.split(delta.after).length!==2)
   throw Error('Missing or duplicate reviewed Next builder delta: '+delta.id);
  projected=projected.replace(delta.after,delta.before);
 }
 return projected;
}
