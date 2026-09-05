import { BOOK_DOSSIER_LIMITS, type BookDossierDesignProof, type BookDossierDraft, type BookDossierReadingMode, type BookDossierSpoiler } from "./bookDossierDocument";
import { BOOK_TYPOGRAPHY_VERSION } from "./bookTypography";
import { BOOK_INSPECTION_LAYOUT_VERSION } from "./bookInspectionPageLayout";
import { bookDossierReadingSteps } from "./bookDossierReadingSteps";

export function bookDossierVariantId(mode: BookDossierReadingMode, reveal: BookDossierSpoiler, reached: readonly string[]) {
  return `${mode}|${reveal}|${reached.join(",")}`;
}
export function bookDossierExpectedVariantIds(draft: BookDossierDraft) {
  const progress = bookDossierReadingSteps(draft).map(step => step.id);
  const ids: string[] = [];
  for (const mode of ["BEFORE_READING", "DURING_READING", "AFTER_READING"] as const) for (const reveal of ["NONE", "LIGHT", "MAJOR", "ENDING"] as const) {
    if (mode === "BEFORE_READING" && reveal !== "NONE") continue;
    for (let index = 0; index <= (mode === "DURING_READING" ? progress.length : 0); index += 1) ids.push(bookDossierVariantId(mode, reveal, progress.slice(0, index)));
  }
  return ids;
}
export function validBookDossierDesignProof(proof: unknown, draft: BookDossierDraft, checksum: string, now: number): proof is BookDossierDesignProof {
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) return false;
  const value = proof as BookDossierDesignProof;
  const expected = bookDossierExpectedVariantIds(draft);
  return Object.keys(value).every(key => ["version", "contentChecksum", "fontVersion", "layoutVersion", "measuredAt", "method", "variantPages"].includes(key)) &&
    value.version === "book-dossier-design-v1" && value.method === "CANVAS_LOCAL_FONTS" && value.contentChecksum === checksum &&
    value.fontVersion === BOOK_TYPOGRAPHY_VERSION && value.layoutVersion === BOOK_INSPECTION_LAYOUT_VERSION &&
    Number.isFinite(Date.parse(value.measuredAt)) && Date.parse(value.measuredAt) <= now && Array.isArray(value.variantPages) && value.variantPages.length === expected.length &&
    value.variantPages.every((entry, index) => entry && Object.keys(entry).every(key => ["id", "pageCount"].includes(key)) && entry.id === expected[index] &&
      Number.isSafeInteger(entry.pageCount) && entry.pageCount > 0 && entry.pageCount <= BOOK_DOSSIER_LIMITS[draft.tier].maximum);
}
