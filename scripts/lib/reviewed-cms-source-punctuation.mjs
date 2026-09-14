import { readFileSync } from "node:fs";
import { projectReviewedPremiumTitleEvidence } from "./reviewed-premium-title-evidence.mjs";

export const cmsSourcePunctuationAttestation = JSON.parse(readFileSync(
  new URL("../governance/cms-source-punctuation-reviewed-20260914.json", import.meta.url), "utf8"
));

// Preserve published source locks by reversing only explicitly reviewed bytes.
export function projectPublishedCmsSourcePunctuation(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of cmsSourcePunctuationAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed CMS punctuation delta: ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}

export function projectReviewedCmsSourcePunctuation(relativePath, source) {
  return projectPublishedCmsSourcePunctuation(
    relativePath, projectReviewedPremiumTitleEvidence(relativePath, source)
  );
}
