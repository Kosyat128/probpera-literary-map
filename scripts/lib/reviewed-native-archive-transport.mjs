import { readFileSync } from "node:fs";
import { projectReviewedDraftStorage } from "./reviewed-draft-storage.mjs";

export const nativeArchiveTransportAttestation = JSON.parse(readFileSync(
  new URL("../governance/library-native-transport-reviewed-20260914.json", import.meta.url),
  "utf8"
));

// Restore the exact reviewed source boundary before the unchanged reference,
// showcase and historical locks. No unrelated bytes or files are exempted.
export function projectPublishedNativeArchiveTransport(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of nativeArchiveTransportAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed native-transport delta: ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}

export function projectReviewedNativeArchiveTransport(relativePath, source) {
  return projectPublishedNativeArchiveTransport(
    relativePath, projectReviewedDraftStorage(relativePath, source)
  );
}
