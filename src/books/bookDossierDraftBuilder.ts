import type { BookDossierDraft, BookDossierSection } from "./bookDossierDocument";

export const bookDossierCoreSections = [
  ["identity", "Титульная страница", "title"], ["why-read", "Почему стоит читать", "key-points"],
  ["description", "О книге", "essay"], ["passport", "Паспорт произведения", "passport"],
  ["provenance", "Источники", "sources"], ["legal-reading", "Где читать легально", "legal-reading"],
] as const;

/** Empty private form fields only. This never creates facts, rights or approval. */
export function addBookDossierDraftSection(draft: BookDossierDraft, options: {
  id: string; title: string; purpose: BookDossierSection["purpose"]; template: BookDossierSection["template"];
}): BookDossierDraft {
  if (draft.sections.some(section => section.id === options.id) || draft.sections.length >= 18) return draft;
  const kind = options.purpose === "identity" || options.purpose === "passport" ? "metadata" : options.purpose === "provenance" ? "sources" : options.purpose === "legal-reading" ? "legal-links" : "editorial";
  const rightsId = `${options.id}-rights`, blockId = `${options.id}-content`;
  return { ...draft, sections: [...draft.sections, { ...options, spoiler: "NONE", blockIds: [blockId] }],
    blocks: [...draft.blocks, { id: blockId, sectionId: options.id, kind, title: options.title, paragraphs: [], items: [], sourceIds: [], rightsId, spoiler: "NONE", readingModes: ["BEFORE_READING", "DURING_READING", "AFTER_READING"] }],
    rights: [...draft.rights, { id: rightsId, classification: "BLOCKED", contentType: kind === "metadata" ? "metadata" : ["sources", "legal-links"].includes(kind) ? "external-link" : "editorial",
      author: "", rightsBasis: "", rightsHolder: "", sourceIds: [], territories: [], allowedSurfaces: [], allow3D: false, allowHTML: false, allowIndexing: false, allowDownload: false, allowOfflineCache: false,
      startsAt: "", expiresAt: null, revokedAt: null, recheckAt: "", attribution: "", evidenceIds: [], reviewedBy: null, reviewedAt: null, reviewKind: "UNREVIEWED", contentChecksum: "0".repeat(64), originalWork: draft.bookKey, originalAuthor: draft.writer, sourceLanguage: draft.locale }],
  };
}
