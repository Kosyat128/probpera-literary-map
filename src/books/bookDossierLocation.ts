import type { BookDossierDocumentV2, BookDossierSemanticAnchor } from "./bookDossierDocument";
import type { BookInspectionSemanticPage } from "./bookInspectionSession";

export type BookDossierLocation = Readonly<{
  bookKey: string;
  pageId: string;
  anchor: BookDossierSemanticAnchor;
}>;
type LocationInput = Readonly<{ bookKey: string; anchor: BookDossierSemanticAnchor; pageId?: string }>;

function sameAnchor(left: BookDossierSemanticAnchor, right: BookDossierSemanticAnchor) {
  return left.sectionId === right.sectionId && left.blockId === right.blockId && left.itemId === right.itemId
    && left.dossierVersion === right.dossierVersion && left.locale === right.locale && left.readingMode === right.readingMode;
}

/** Resolve only a page present in this exact public document. Matching a block
 * name alone must not revive a position from another book, locale or mode. */
export function resolveBookDossierLocation(dossier: BookDossierDocumentV2 | null, location: LocationInput | null): BookDossierLocation | null {
  if (!dossier || !location?.anchor || location.bookKey !== dossier.bookKey
    || location.anchor.locale !== dossier.locale || location.anchor.dossierVersion !== dossier.dossierVersion
    || location.anchor.readingMode !== dossier.readingMode) return null;
  const page = dossier.pages.find(candidate => sameAnchor(candidate.anchor, location.anchor));
  return page ? Object.freeze({ bookKey: dossier.bookKey, pageId: page.id, anchor: Object.freeze({ ...page.anchor }) }) : null;
}

/** A locale switch may keep a canonical semantic location, but must bind it to
 * an actually present anchor of the new locale in the same version and mode. */
export function remapBookDossierLocaleLocation(dossier: BookDossierDocumentV2 | null, location: LocationInput | null): BookDossierLocation | null {
  if (!dossier || !location?.anchor || dossier.bookKey !== location.bookKey
    || dossier.dossierVersion !== location.anchor.dossierVersion || dossier.readingMode !== location.anchor.readingMode) return null;
  return resolveBookDossierLocation(dossier, { ...location, anchor: { ...location.anchor, locale: dossier.locale } });
}

/** A physical page ID is only a tie-breaker inside a validated semantic block;
 * accessible navigation still works when no physical pages could be measured. */
export function bookDossierPhysicalPageIndex(dossier: BookDossierDocumentV2 | null, location: LocationInput | null,
  pages: readonly BookInspectionSemanticPage[]): number {
  const resolved = resolveBookDossierLocation(dossier, location);
  if (!resolved) return -1;
  const matches = (page: BookInspectionSemanticPage) => !!page.anchor && sameAnchor(page.anchor, resolved.anchor);
  const exact = location?.pageId ? pages.findIndex(page => page.id === location.pageId && matches(page)) : -1;
  return exact >= 0 ? exact : pages.findIndex(matches);
}
