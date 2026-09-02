import type { WorkTitleEvidenceProfile } from "./types";

type WorkTitleEvidenceDraft = Omit<
  WorkTitleEvidenceProfile,
  "entityKind" | "retrievedAt" | "checkedAt" | "checkedBy"
>;

const optionalTitleEvidenceFields = [
  "titleRelation",
  "analyticTitleExact",
  "containerTitleExact",
  "containedInField",
  "isbn10",
  "isbn13",
  "publisher",
  "publicationYear",
  "translator",
  "editionStatement",
] as const satisfies readonly (keyof WorkTitleEvidenceDraft)[];

/**
 * JSON has no representation for `undefined`. Evidence constructors may pass
 * optional fields through typed helper parameters, so remove only those known
 * optional keys when they were not supplied. Required fields remain untouched
 * and continue to fail the strict release serializer if malformed at runtime.
 */
export function withoutUndefinedTitleEvidenceOptions<
  Draft extends WorkTitleEvidenceDraft,
>(draft: Draft): Draft {
  const normalized = { ...draft };
  for (const field of optionalTitleEvidenceFields) {
    if (Reflect.get(normalized, field) === undefined) {
      Reflect.deleteProperty(normalized, field);
    }
  }
  return normalized;
}
