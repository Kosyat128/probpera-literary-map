import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const r49nDickensAttestation = JSON.parse(readFileSync(
  new URL("../governance/book-r49n-dickens-reviewed-20260912.json", import.meta.url),
  "utf8"
));

export const reviewedR49nDickensAdditionPaths = new Set(
  r49nDickensAttestation.additions.map((entry) => entry.path)
);

export function reviewedR49nDickensSourceSha256(source) {
  return createHash("sha256")
    .update(source.replace(/\r\n?/gu, "\n"))
    .digest("hex");
}

// Only this exact independently reviewed addition lies outside the older
// catalog snapshot. A changed payload or a second file remains fingerprinted.
export function isReviewedR49nDickensAddition(relativePath, source) {
  const addition = r49nDickensAttestation.additions.find((entry) => entry.path === relativePath);
  return Boolean(addition && reviewedR49nDickensSourceSha256(source) === addition.sha256);
}

// Restore the exact pre-import archive hook. The final legacy quarantine guard
// and every byte outside these two reviewed fragments stay under the old lock.
export function projectReviewedR49nDickens(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of r49nDickensAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed R49N Dickens delta: ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
