import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const referenceReleaseAttestation = JSON.parse(readFileSync(
  new URL("../governance/library-reference-release-reviewed-20260914.json", import.meta.url),
  "utf8"
));

export function reviewedReferenceReleaseSourceSha256(source) {
  return createHash("sha256").update(source.replace(/\r\n?/gu, "\n")).digest("hex");
}

// Restore the exact published September 13 boundary before older governance
// runs. Unrelated bytes survive this projection and remain fingerprinted.
export function projectReviewedReferenceRelease(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of referenceReleaseAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed reference-release delta: ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
