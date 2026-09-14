import { readFileSync } from "node:fs";

export const nativeArchiveReadAttestation = JSON.parse(readFileSync(
  new URL("../governance/library-native-read-reviewed-20260914.json", import.meta.url), "utf8"
));

// Reverse only the exact native read transport and historical read adapters.
export function projectReviewedNativeArchiveRead(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of nativeArchiveReadAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed native-read delta: ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
