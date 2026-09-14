import { readFileSync } from "node:fs";

export const draftStorageAttestation = JSON.parse(readFileSync(
  new URL("../governance/literary-translation-draft-storage-reviewed-20260914.json", import.meta.url),
  "utf8"
));

// Restore only the reviewed migration-plan and governance adapter fragments.
// Unrelated bytes remain visible to the unchanged published source locks.
export function projectReviewedDraftStorage(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of draftStorageAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed draft-storage delta: ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
