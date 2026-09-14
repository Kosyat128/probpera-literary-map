export const COUNTRY_CAPITAL_REVIEW_HASH_CONTRACT = "country-capital-review-v1";

/** Shared runtime/export transport parser. This copies a supplied attestation;
 * it neither creates an approval nor authenticates a person's identity. */
export function normalizeCountryCapitalEditorialReview(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const keys = ["schemaVersion", "hashContract", "decision", "reviewerType", "reviewer", "reviewedAt", "evidenceRef", "sourceHash", "targetHash"];
  if (Reflect.ownKeys(value).length !== keys.length || keys.some(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return !descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value");
  })) return null;
  if (value.schemaVersion !== 1 || value.hashContract !== COUNTRY_CAPITAL_REVIEW_HASH_CONTRACT
    || !["approved", "rejected", "withdrawn"].includes(value.decision) || value.reviewerType !== "human"
    || typeof value.reviewer !== "string" || !value.reviewer || value.reviewer.length > 240
    || value.reviewer !== value.reviewer.trim() || /[\u0000-\u001f\u007f]/u.test(value.reviewer)
    || typeof value.reviewedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value.reviewedAt)
    || value.reviewedAt.startsWith("0000") || !Number.isFinite(Date.parse(value.reviewedAt))
    || new Date(value.reviewedAt).toISOString().slice(0, 10) !== value.reviewedAt
    || typeof value.sourceHash !== "string" || !/^[a-f0-9]{64}$/u.test(value.sourceHash)
    || typeof value.targetHash !== "string" || !/^[a-f0-9]{64}$/u.test(value.targetHash)
    || typeof value.evidenceRef !== "string" || !value.evidenceRef || value.evidenceRef.length > 1000
    || /[\s\u0000-\u001f\u007f]/u.test(value.evidenceRef)) return null;
  if (!/^editorial-review:[a-z0-9][a-z0-9._:-]{0,199}$/iu.test(value.evidenceRef)) {
    try {
      const url = new URL(value.evidenceRef);
      if (url.protocol !== "https:" || url.username || url.password) return null;
    } catch { return null; }
  }
  return Object.fromEntries(keys.map(key => [key, value[key]]));
}
