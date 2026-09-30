import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { projectReviewedCalendarFollowup } from "./reviewed-calendar-followup.mjs";
import { projectReviewedUndiciSecurityFollowup } from "./reviewed-undici-security-followup.mjs";

// R10 implementation review is agent evidence, not owner/human or release acceptance.
export const r10DeltaAttestation = JSON.parse(readFileSync(new URL("../governance/r10-forward-delta-20260926.json",import.meta.url),"utf8"));
export const r10DeltaSha256 = source => createHash("sha256").update(source.replace(/\r\n?/gu,"\n")).digest("hex");
export const reviewedR10AdditionPaths = new Set(r10DeltaAttestation.additions.map(entry=>entry.path));
export function isReviewedR10Addition(relativePath,source) {
  const entry=r10DeltaAttestation.additions.find(item=>item.path===relativePath);
  if (!entry) return false;
  try { return r10DeltaSha256(projectReviewedCalendarFollowup(relativePath,source))===entry.sha256Lf; }
  catch { return false; }
}

/** Reverse exact bounded R10 fragments before historical projections. Preserve all other bytes. */
export function projectReviewedR10Delta(relativePath,source) {
  let projected=projectReviewedCalendarFollowup(relativePath,projectReviewedUndiciSecurityFollowup(relativePath,source));
  for(const delta of r10DeltaAttestation.projections) {
    if(delta.path!==relativePath)continue;
    if(!delta.after || projected.split(delta.after).length!==2) throw new Error(`Missing or duplicate R10 delta: ${delta.id}`);
    projected=projected.replace(delta.after,delta.before);
  }
  return projected;
}
