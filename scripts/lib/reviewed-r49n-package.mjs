import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { projectReviewedReferenceRelease } from "./reviewed-reference-release.mjs";

export const r49nPackageAttestation = JSON.parse(readFileSync(
  new URL("../governance/book-r49n-package-reviewed-20260912.json", import.meta.url),
  "utf8"
));

export const reviewedR49nPackageAdditionPaths = new Set(
  r49nPackageAttestation.additions.map((entry) => entry.path)
);

export function reviewedR49nPackageSourceSha256(source) {
  return createHash("sha256").update(source.replace(/\r\n?/gu, "\n")).digest("hex");
}

export function isReviewedR49nPackageAddition(relativePath, source) {
  const addition = r49nPackageAttestation.additions.find((entry) => entry.path === relativePath);
  return Boolean(addition && reviewedR49nPackageSourceSha256(source) === addition.sha256);
}

// Reverse the later reference repair before this published package. Its
// attestation and original delta loop retain their immutable published meaning.
export function projectReviewedR49nPackage(relativePath, source) {
  return projectPublishedR49nPackage(relativePath,
    projectReviewedReferenceRelease(relativePath, source));
}

// This published boundary also keeps the original R49N tamper checks independent
// of later maintenance. Everything outside its exact fragments stays visible.
export function projectPublishedR49nPackage(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  for (const delta of r49nPackageAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed R49N package delta: ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}
