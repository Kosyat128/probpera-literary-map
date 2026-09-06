import { readFileSync } from "node:fs";

export const readingDesignAttestation = JSON.parse(readFileSync(
  new URL("../governance/reading-design-owner-refinement-20260906.json", import.meta.url), "utf8"
));

// Project only exact owner-reviewed deltas back to the historical locks. Every
// remaining byte continues through its existing AST/CSS/content fingerprint.
export function projectReviewedReadingDesign(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of readingDesignAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed reading-design delta: ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
