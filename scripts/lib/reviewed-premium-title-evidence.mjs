import { readFileSync } from "node:fs";

export const premiumTitleEvidenceAttestation = JSON.parse(readFileSync(
  new URL("../governance/premium-title-evidence-reviewed-20260914.json", import.meta.url), "utf8"
));

// Restore only the exact reviewed serializer and historical read boundaries.
export function projectReviewedPremiumTitleEvidence(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of premiumTitleEvidenceAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed premium title-evidence delta: ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
