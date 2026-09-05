import type { WorkTranslationProfile } from "../data/countries/types";
import type { BookEditorialDocument } from "./bookEditorialPages";
import { BOOK_DOSSIER_DATA_VERSION, type BookDossierDocumentV2, type BookDossierPage, type BookDossierPublicBlock, type BookDossierTemplate } from "./bookDossierDocument";
import { isBookDossierUrl } from "./bookDossierValidation";
import { bookDossierDiagramPreview, buildBookDossierDiagram } from "./bookDossierDiagram";

type LegacyExtras = Readonly<{
  descriptionProfile?: WorkTranslationProfile;
  relatedArticles?: readonly Readonly<{ id: string; title: string; href: string }>[];
}>;
const normalized = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();

function hasExistingOriginalDescription(profile: WorkTranslationProfile | undefined, paragraph: string, locale: string) {
  const provenance = profile?.descriptionProvenance;
  return Boolean(profile && profile.locale === locale && ["reviewed", "verified"].includes(profile.status) &&
    ["editorial-original", "human-translation"].includes(profile.method) && provenance &&
    provenance.origin !== "article-adapted" && provenance.rights.textOrigin === "project-original" &&
    provenance.rights.copiedSourceText === false && provenance.author && provenance.reviewedBy &&
    Number.isFinite(Date.parse(provenance.createdAt)) && Number.isFinite(Date.parse(provenance.reviewedAt)) &&
    provenance.sourceUrls.length > 0 && provenance.sourceUrls.every(url => isBookDossierUrl(url)) &&
    normalized(profile.description) === paragraph);
}

/** Existing approved catalogue material is an honest compact fallback, not a new human-reviewed CORE release. */
export function buildBookDossierFromEditorial(input: BookEditorialDocument, extras: LegacyExtras = {}): BookDossierDocumentV2 {
  const english = input.locale === "en";
  const pages: BookDossierPage[] = [];
  const templates: Record<string, BookDossierTemplate> = { identity: "title", details: "passport", description: "essay", provenance: "sources" };
  const version = `${BOOK_DOSSIER_DATA_VERSION}-catalogue`;
  const order = ["identity", "description", "details", "provenance"];
  for (const page of [...input.pages].sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id))) {
    if (page.id === "description" && !hasExistingOriginalDescription(extras.descriptionProfile, page.paragraphs[0] || "", input.locale)) continue;
    const anchor = { sectionId: page.id, blockId: `${page.id}-content`, dossierVersion: version, locale: input.locale, readingMode: "BEFORE_READING" as const };
    const sources = page.sources.filter(source => isBookDossierUrl(source.sourceUrl)).map((source, index) => ({
      id: source.id || `${page.id}-source-${index}`, provider: source.provider, title: source.provider,
      sourceUrl: source.sourceUrl, usageLabel: english ? "Reference source" : "Справочный источник",
    }));
    if (page.id !== "identity" && !page.rows.length && !page.paragraphs.length && !sources.length) continue;
    const kind = page.id === "description" ? "editorial" : page.id === "provenance" ? "sources" : "metadata";
    const rows = page.rows.map((row, index) => ({ ...row, id: row.id || `${page.id}-row-${row.kind}-${index}` }));
    const block: BookDossierPublicBlock = {
      id: anchor.blockId, sectionId: page.id, kind, title: page.title, paragraphs: page.paragraphs,
      items: rows.map(row => ({ id: row.id, label: row.label, value: row.value, sourceIds: [], spoiler: "NONE" })), sources, anchor,
    };
    pages.push({ ...page, index: pages.length, sectionId: page.id, template: templates[page.id] || "essay", anchor, rows, sources, blocks: [block] });
  }
  const articles = (extras.relatedArticles || []).filter(article => article.id && article.title.trim() && article.title.length <= 300 &&
    /^\/(?:en\/)?stati\/[a-z0-9/_-]+\/?$/u.test(article.href)).slice(0, 6);
  const extraPage = (id: string, template: BookDossierTemplate, title: string, paragraphs: readonly string[], items: BookDossierPublicBlock["items"]) => {
    const anchor = { sectionId: id, blockId: `${id}-content`, dossierVersion: version, locale: input.locale, readingMode: "BEFORE_READING" as const };
    const block: BookDossierPublicBlock = { id: anchor.blockId, sectionId: id, kind: template === "related-articles" ? "related-articles" : "colophon", title, paragraphs, items, sources: [], anchor };
    pages.push({ id, index: pages.length, sectionId: id, template, anchor, eyebrow: english ? "Proba Pera" : "Проба пера", title, rows: [], paragraphs, sources: [], blocks: [block] });
  };
  if (articles.length) extraPage("journal", "related-articles", english ? "In the journal" : "Книга в журнале", [], articles.map(article => ({ id: article.id, label: article.title, href: article.href, sourceIds: [], spoiler: "NONE" })));
  extraPage("legal-reading", "legal-reading", english ? "About this dossier" : "Об этом досье", [english
    ? "This site offers an editorial dossier; the full text of the work is not hosted here."
    : "На сайте доступно редакционное досье; полный текст не размещён."], []);
  // A cache identity only; ownership and publication never depend on this hash.
  let cacheHash = 2166136261;
  for (const character of JSON.stringify(pages)) cacheHash = Math.imul(cacheHash ^ character.charCodeAt(0), 16777619);
  return {
    schemaVersion: 2, bookKey: input.bookKey, locale: input.locale, dossierVersion: version,
    profile: null, tier: null, themeVersion: input.themeVersion,
    pageDataVersion: version, cacheKey: `${input.cacheKey}|dossier=${version}|content=${(cacheHash >>> 0).toString(16)}`,
    contentMode: "DOSSIER_ONLY", readingMode: "BEFORE_READING", pages,
    contents: pages.map(page => ({ id: page.sectionId, title: page.title, anchor: page.anchor })),
  };
}

/** Both renderers receive the same page order, text, template and semantic anchors. */
export function toBookEditorialDocument(document: BookDossierDocumentV2): BookEditorialDocument {
  const pages = document.pages.map(page => {
    const represented = new Set(page.rows.map(row => row.id));
    const itemRows = page.blocks.flatMap(block => block.items.flatMap(item => {
      if (represented.has(item.id)) return [];
      represented.add(item.id);
      const values = [...new Set([item.value, item.text].filter((value): value is string => Boolean(value) && value !== item.label))];
      return [{ id: item.id, kind: block.kind, label: item.label, value: values.join("\n\n"), ...(item.href ? { href: item.href } : {}) }];
    }));
    const diagram = buildBookDossierDiagram(document, page);
    return { ...page, rows: [...page.rows, ...itemRows], ...(diagram ? { diagram: bookDossierDiagramPreview(diagram) } : {}) };
  });
  return { bookKey: document.bookKey, locale: document.locale, themeVersion: document.themeVersion,
    pageDataVersion: document.pageDataVersion, cacheKey: document.cacheKey, pages };
}
