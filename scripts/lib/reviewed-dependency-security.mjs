import { readFileSync } from "node:fs";

export const dependencySecurityAttestation = JSON.parse(readFileSync(
  new URL("../governance/dependency-security-reviewed-20260912.json", import.meta.url), "utf8"
));

// Reverse only the reviewed package patch and exact preflight/browser matrix
// changes. The audit stays mandatory; unrelated bytes reach historical locks.
export function projectReviewedDependencySecurity(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of dependencySecurityAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error("Missing or duplicate reviewed dependency-security delta: " + delta.id);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}

