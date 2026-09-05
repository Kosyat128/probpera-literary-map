import type { BookDossierSemanticAnchor } from "./bookDossierDocument";

export type BookDossierProgress = Readonly<{
  anchor: BookDossierSemanticAnchor;
  pageId: string;
  updatedAt: string;
}>;

export function parseBookDossierProgress(value: unknown): BookDossierProgress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Partial<BookDossierProgress>;
  const anchor = record.anchor;
  if (!anchor || typeof anchor !== "object" ||
      !["ru", "en"].includes(anchor.locale) ||
      !["BEFORE_READING", "DURING_READING", "AFTER_READING"].includes(anchor.readingMode) ||
      ![anchor.sectionId, anchor.blockId, anchor.dossierVersion, record.pageId].every(part =>
        typeof part === "string" && part.length > 0 && part.length <= 240) ||
      (anchor.itemId !== undefined && (typeof anchor.itemId !== "string" || anchor.itemId.length > 240)) ||
      typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt))) return undefined;
  return {
    anchor: {
      sectionId: anchor.sectionId, blockId: anchor.blockId, dossierVersion: anchor.dossierVersion,
      locale: anchor.locale, readingMode: anchor.readingMode,
      ...(anchor.itemId ? { itemId: anchor.itemId } : {}),
    },
    pageId: record.pageId!, updatedAt: record.updatedAt,
  };
}

export function sameBookDossierLocation(a: BookDossierProgress | undefined, b: BookDossierProgress) {
  return a?.pageId === b.pageId && a.anchor.sectionId === b.anchor.sectionId &&
    a.anchor.blockId === b.anchor.blockId && a.anchor.itemId === b.anchor.itemId &&
    a.anchor.dossierVersion === b.anchor.dossierVersion && a.anchor.locale === b.anchor.locale &&
    a.anchor.readingMode === b.anchor.readingMode;
}
