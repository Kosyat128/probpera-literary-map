import type { BookDossierBlock, BookDossierDesignProof, BookDossierDraft, BookDossierRecord, BookDossierSection } from "../../src/books/bookDossierDocument";
import { bookDossierExpectedVariantIds } from "../../src/books/bookDossierDesign";
import { BOOK_TYPOGRAPHY_VERSION } from "../../src/books/bookTypography";
import { BOOK_INSPECTION_LAYOUT_VERSION } from "../../src/books/bookInspectionPageLayout";
/** Synthetic attestation for workflow/SQL tests only; no claim of browser measurement. */
export function bookDossierFixtureDesignProof(record: BookDossierRecord, now: number): BookDossierDesignProof {
  return { version: "book-dossier-design-v1", contentChecksum: record.contentChecksum, fontVersion: BOOK_TYPOGRAPHY_VERSION, layoutVersion: BOOK_INSPECTION_LAYOUT_VERSION,
    method: "CANVAS_LOCAL_FONTS", measuredAt: new Date(now).toISOString(), variantPages: bookDossierExpectedVariantIds(record.draft).map(id => ({ id, pageCount: record.draft.sections.length })) };
}
export function bookDossierFixture(): BookDossierDraft {
  const purposes = ["identity", "why-read", "description", "passport", "provenance", "legal-reading"] as const;
  const sections: BookDossierSection[] = purposes.map(id => ({ id, title: `Fixture ${id}`, purpose: id,
    template: id === "identity" ? "title" : id === "passport" ? "passport" : id === "provenance" ? "sources" : "essay", spoiler: "NONE", blockIds: [`${id}-block`] }));
  const blocks: BookDossierBlock[] = purposes.map(id => ({ id: `${id}-block`, sectionId: id, title: `Fixture ${id}`,
    kind: id === "identity" || id === "passport" ? "metadata" : id === "provenance" ? "sources" : id === "legal-reading" ? "legal-links" : "editorial",
    paragraphs: ["why-read", "description"].includes(id) ? [`Synthetic test sentence for ${id}.`] : [],
    items: ["identity", "passport", "legal-reading"].includes(id) ? [{ id: `${id}-item`, label: `Fixture ${id}`, value: "Test value", sourceIds: ["source-one"], spoiler: "NONE" }] : [],
    sourceIds: ["source-one"], rightsId: `${id}-rights`, spoiler: "NONE", readingModes: ["BEFORE_READING", "DURING_READING", "AFTER_READING"],
  }));
  return { schemaVersion: 2, bookKey: "test:writer:book", locale: "ru", dossierVersion: "test-v1", title: "Synthetic test title", writer: "Synthetic test author", profile: "ROMAN", tier: "CORE",
    requiredLocales: ["ru"], translationReadyLocales: ["ru"], sections, blocks,
    sources: [{ id: "source-one", provider: "Test provider", title: "Synthetic source", url: "https://probpera.ru/stati/test/", kind: "editorial", reviewedAt: null, reviewedBy: null, attribution: "Test attribution" }],
    rights: blocks.map(block => ({ id: block.rightsId,
      classification: block.kind === "metadata" ? "FACTUAL_METADATA" : ["sources", "legal-links"].includes(block.kind) ? "EXTERNAL_LINK_ONLY" : "EDITORIAL_OWNED",
      contentType: block.kind === "metadata" ? "metadata" : ["sources", "legal-links"].includes(block.kind) ? "external-link" : "editorial",
      author: "Synthetic fixture author", rightsBasis: "Test fixture only", rightsHolder: "Test holder", sourceIds: ["source-one"], territories: ["WORLDWIDE"], allowedSurfaces: ["HTML", "3D"],
      allowHTML: true, allow3D: true, allowIndexing: false, allowDownload: false, allowOfflineCache: false,
      startsAt: "2026-09-01T00:00:00Z", expiresAt: null, revokedAt: null, recheckAt: "2027-09-01T00:00:00Z", attribution: "Test attribution", evidenceIds: ["private-test-evidence"],
      reviewedBy: null, reviewedAt: null, reviewKind: "UNREVIEWED", contentChecksum: "0".repeat(64), originalWork: "test:writer:book", originalAuthor: "Synthetic test author", sourceLanguage: "ru",
    })),
  };
}

/** Stops at the hidden middle checkpoint instead of exposing its ID or skipping ahead. */
export function bookDossierHiddenProgressFixture(): BookDossierDraft {
  const base = bookDossierFixture();
  const blocks: BookDossierBlock[] = [
    { ...base.blocks[1], id: "hidden-anchor", sectionId: "progress-context", rightsId: "hidden-anchor-rights", kind: "characters", paragraphs: [],
      items: [{ id: "hidden-progress-item", label: "Secret checkpoint", sourceIds: ["source-one"], spoiler: "LIGHT" }] },
    ...["identity-item", "hidden-progress-item", "passport-item"].map((id, index) => ({ ...base.blocks[1], id: `progress-block-${index}`, sectionId: "progress-context", rightsId: `progress-rights-${index}`, availableAfterItemId: id })),
  ];
  return { ...base, sections: [...base.sections, { id: "progress-context", title: "Synthetic progress context", purpose: "context", template: "essay", spoiler: "NONE", blockIds: blocks.map(block => block.id) }],
    blocks: [...base.blocks, ...blocks], rights: [...base.rights, ...blocks.map(block => ({ ...base.rights[1], id: block.rightsId }))] };
}
