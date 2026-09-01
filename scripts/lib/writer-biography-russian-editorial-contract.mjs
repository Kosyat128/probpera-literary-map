const publishableVerdicts = new Set(["supported", "corrected"]);
const editorialProcessPattern =
  /(?:оценочн|суперлатив|формулировк|замен[её]н|исправлен|удал[её]н|уточн[её]н|неподтвержд|редакционн|снята|снято|очищен)/iu;

export const RUSSIAN_EDITORIAL_TRANSLATOR_MODEL =
  "@cf/google/gemma-4-26b-a4b-it";
export const RUSSIAN_EDITORIAL_REVIEWER_MODEL = "@cf/openai/gpt-oss-120b";

export function russianEditorialSourcePayload(record) {
  return {
    key: record.key,
    writerName: record.writerName,
    reviewedTextRu: record.reviewedTextRu,
    claims: record.claims,
    evidence: record.evidence,
  };
}

export async function russianEditorialSourceSha256(record) {
  const bytes = new TextEncoder().encode(
    JSON.stringify(russianEditorialSourcePayload(record))
  );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export function publishableRussianEditorialFacts(record) {
  return {
    claims: record.claims.filter((claim) =>
      publishableVerdicts.has(String(claim.verdict)) &&
      !editorialProcessPattern.test(String(claim.textRu || ""))
    ),
    // The manifest generator guarantees that this top-level collection is
    // derived exclusively from supported/corrected claims. Rejected evidence
    // is never serialized into the collection in the first place.
    evidence: record.evidence.filter(
      (evidence) =>
        !editorialProcessPattern.test(String(evidence.findingRu || ""))
    ),
  };
}

export function russianEditorialAllowedContext(record) {
  const facts = publishableRussianEditorialFacts(record);
  return [
    ...facts.claims.map((claim) => `${claim.verdict}: ${claim.textRu}`),
    ...facts.evidence.map((evidence) => evidence.findingRu),
  ].join(" ");
}

export function rejectedRussianEditorialClaims(record) {
  return record.claims.filter(
    (claim) => !publishableVerdicts.has(String(claim.verdict))
  );
}

export function russianEditorialRefinementProvenanceIssues(refinement) {
  const issues = [];
  if (refinement?.translatorModel !== RUSSIAN_EDITORIAL_TRANSLATOR_MODEL) {
    issues.push("missing-or-unexpected-translator-model");
  }
  if (refinement?.reviewerModel !== RUSSIAN_EDITORIAL_REVIEWER_MODEL) {
    issues.push("missing-or-unexpected-reviewer-model");
  }
  return issues;
}
