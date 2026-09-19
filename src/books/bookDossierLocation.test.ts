import { describe, expect, it } from "vitest";
import type { BookDossierDocumentV2, BookDossierSemanticAnchor } from "./bookDossierDocument";
import { bookDossierPhysicalPageIndex, remapBookDossierLocaleLocation, resolveBookDossierLocation } from "./bookDossierLocation";
import { createBookInspectionSession, remapBookInspectionSessionPages } from "./bookInspectionSession";

type Scope = Pick<BookDossierDocumentV2, "bookKey" | "locale" | "dossierVersion" | "readingMode">;
function dossier(overrides: Partial<Scope> = {}): BookDossierDocumentV2 {
  const scope: Scope = { bookKey: "country:writer:book", locale: "ru", dossierVersion: "v1", readingMode: "BEFORE_READING", ...overrides };
  const pages = [
    { id: "identity", sectionId: "title", blockId: "identity" },
    { id: "essay", sectionId: "context", blockId: "essay", itemId: "paragraph-one" },
    { id: "sources", sectionId: "provenance", blockId: "sources" },
  ].map(({ id, sectionId, blockId, itemId }, index) => ({
    id, index, sectionId, template: "essay" as const,
    anchor: { sectionId, blockId, ...(itemId ? { itemId } : {}), locale: scope.locale,
      dossierVersion: scope.dossierVersion, readingMode: scope.readingMode },
    eyebrow: "", title: id, rows: [], paragraphs: ["Fixture content stays in the document."], sources: [], blocks: [],
  }));
  return { schemaVersion: 2, ...scope, profile: null, tier: null, themeVersion: "test", pageDataVersion: "test",
    cacheKey: `${scope.bookKey}:${scope.locale}:${scope.dossierVersion}:${scope.readingMode}`, contentMode: "DOSSIER_ONLY",
    pages, contents: pages.map(page => ({ id: page.id, title: page.title, anchor: page.anchor })) };
}
const location = (document: BookDossierDocumentV2, pageIndex = 1) => ({
  bookKey: document.bookKey, pageId: document.pages[pageIndex].id, anchor: { ...document.pages[pageIndex].anchor },
});
const physicalPages = (document: BookDossierDocumentV2) => [
  { id: "layout-frontmatter" },
  { id: "identity", anchor: document.pages[0].anchor },
  { id: "essay-physical-1", anchor: document.pages[1].anchor },
  { id: "essay-physical-2", anchor: document.pages[1].anchor },
  { id: "sources", anchor: document.pages[2].anchor },
];

describe("scope-safe dossier locations across accessible and physical pages", () => {
  it("returns a detached current-page identity while physical pagination is missing or has failed", () => {
    const document = dossier(), requested = { ...location(document), pageId: "old-physical-continuation" };
    const resolved = resolveBookDossierLocation(document, requested);
    expect(resolved).toEqual(location(document));
    expect(bookDossierPhysicalPageIndex(document, requested, [])).toBe(-1);
    expect(Object.isFrozen(resolved)).toBe(true); expect(Object.isFrozen(resolved!.anchor)).toBe(true);
    requested.anchor.blockId = "later-selection";
    expect(resolved!.anchor.blockId).toBe("essay");
    expect(resolved).not.toHaveProperty("paragraphs"); expect(resolved).not.toHaveProperty("pageIndex");
    expect(resolveBookDossierLocation(null, location(document))).toBeNull();
    expect(resolveBookDossierLocation(document, null)).toBeNull();
  });

  it.each(["book", "locale", "version", "mode", "section", "block", "item", "missing-item"] as const)
    ("rejects a stale %s identity even when its physical page ID exists", changed => {
      const document = dossier(), requested = location(document);
      if (changed === "book") requested.bookKey = "country:writer:other-book";
      if (changed === "locale") requested.anchor.locale = "en";
      if (changed === "version") requested.anchor.dossierVersion = "v2";
      if (changed === "mode") requested.anchor.readingMode = "AFTER_READING";
      if (changed === "section") requested.anchor.sectionId = "other-section";
      if (changed === "block") requested.anchor.blockId = "other-block";
      if (changed === "item") requested.anchor.itemId = "paragraph-two";
      if (changed === "missing-item") delete requested.anchor.itemId;
      const colliding = [{ id: requested.pageId, anchor: document.pages[1].anchor }];
      expect(resolveBookDossierLocation(document, requested)).toBeNull();
      expect(bookDossierPhysicalPageIndex(document, requested, colliding)).toBe(-1);
    });

  it("maps the latest accessible selection into delayed layout and restores exact continuation pages only within the same anchor", () => {
    const document = dossier(), pages = physicalPages(document);
    const first = location(document, 1), latest = location(document, 2);
    expect(bookDossierPhysicalPageIndex(document, first, pages)).toBe(2);
    expect(bookDossierPhysicalPageIndex(document, latest, pages)).toBe(4);
    const restoredContinuation = { ...first, pageId: "essay-physical-2" };
    expect(bookDossierPhysicalPageIndex(document, restoredContinuation, pages)).toBe(3);
    // A coincident ID belonging to another block cannot override semantic identity.
    expect(bookDossierPhysicalPageIndex(document, { ...first, pageId: "sources" }, pages)).toBe(2);
    const oldScopeAnchor: BookDossierSemanticAnchor = { ...first.anchor, locale: "en" };
    expect(bookDossierPhysicalPageIndex(document, restoredContinuation,
      [{ id: restoredContinuation.pageId, anchor: oldScopeAnchor }, ...pages])).toBe(4);
    expect(bookDossierPhysicalPageIndex(document, latest, pages.slice(0, 4))).toBe(-1);
  });

  it("accepts a live session rebound to current locale anchors without treating an old saved anchor as current", () => {
    const before = dossier(), after = dossier({ locale: "en" });
    const oldPages = physicalPages(before), currentPages = physicalPages(after);
    const session = createBookInspectionSession({ bookKey: before.bookKey, pageCount: oldPages.length, pages: oldPages, pageIndex: 3, requestId: 7 });
    const oldPosition = { bookKey: before.bookKey, ...session.semanticPosition! };
    expect(resolveBookDossierLocation(after, oldPosition)).toBeNull();
    const remapped = remapBookInspectionSessionPages(session, after.bookKey, currentPages);
    const currentPosition = { bookKey: after.bookKey, ...remapped.semanticPosition! };
    expect(resolveBookDossierLocation(after, currentPosition)).toEqual(location(after));
    expect(bookDossierPhysicalPageIndex(after, currentPosition, currentPages)).toBe(3);
    expect(remapped.requestId).toBe(7); expect(remapped.phase).toBe("idle");
  });

  it("rebinds an intentional RU to EN continuation only within the same book, version, mode and visible semantic page", () => {
    const before = dossier(), after = dossier({ locale: "en" }), requested = location(before);
    expect(resolveBookDossierLocation(after, requested)).toBeNull();
    const rebound = remapBookDossierLocaleLocation(after, requested);
    expect(rebound).toEqual(location(after)); expect(Object.isFrozen(rebound!.anchor)).toBe(true);
    for (const stale of [
      { ...requested, bookKey: "other-book" },
      { ...requested, anchor: { ...requested.anchor, dossierVersion: "v0" } },
      { ...requested, anchor: { ...requested.anchor, readingMode: "AFTER_READING" as const } },
      { ...requested, anchor: { ...requested.anchor, sectionId: "removed-section" } },
      { ...requested, anchor: { ...requested.anchor, itemId: "removed-item" } },
    ]) expect(remapBookDossierLocaleLocation(after, stale)).toBeNull();
    expect(requested.anchor.locale).toBe("ru");
  });
});
