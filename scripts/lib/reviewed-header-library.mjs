import { readFileSync } from "node:fs";

export const headerLibraryAttestation = JSON.parse(readFileSync(
  new URL("../governance/header-library-owner-refinement-20260912.json", import.meta.url),
  "utf8"
));

// Restore only the exact September 12 owner-reviewed fragments before applying
// the existing September 8/6 projections and their unchanged historical pins.
// Unrelated bytes remain visible to every downstream content, AST and CSS lock.
export function projectReviewedHeaderLibrary(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of headerLibraryAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed header/library delta: ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
