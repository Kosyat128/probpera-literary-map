import { readFileSync } from "node:fs";

export const headerShowcaseAttestation = JSON.parse(readFileSync(
  new URL("../governance/header-showcase-owner-refinement-20260914.json", import.meta.url),
  "utf8"
));

// Restore only this later owner-approved composition and its exact nested
// test adapter before the unchanged historical source and report checks.
export function projectReviewedHeaderShowcase(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of headerShowcaseAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed header showcase delta: ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
