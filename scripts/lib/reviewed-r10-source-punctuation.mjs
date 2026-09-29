import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { projectReviewedCalendarSecurityFollowup } from "./reviewed-calendar-security-followup.mjs";

// Owner authorized lint fixes; this does not claim human or release review.
export const r10PunctuationAttestation = JSON.parse(readFileSync(
  new URL("../governance/r10-source-punctuation-followup-20260930.json", import.meta.url), "utf8"
));
export const r10PunctuationSha256 = source => createHash("sha256")
  .update(source.replace(/\r\n?/gu, "\n")).digest("hex");

/** Preserve historical hashes by reversing only exact reviewed fragments. */
export function projectReviewedR10SourcePunctuation(relativePath, source) {
  let projected = projectReviewedCalendarSecurityFollowup(relativePath, source);
  const deltas = r10PunctuationAttestation.projections.filter(delta => delta.path === relativePath);
  if (!deltas.length) return projected;
  if (r10PunctuationSha256(projected) === r10PunctuationAttestation.sourceBaselines[relativePath]) return projected;
  for (const delta of deltas) {
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error("Missing or duplicate reviewed R10 source-punctuation delta: " + delta.id);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
