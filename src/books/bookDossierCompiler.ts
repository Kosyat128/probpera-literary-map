import {
  BOOK_DOSSIER_DATA_VERSION, BOOK_DOSSIER_LIMITS,
  type BookDossierDocumentV2, type BookDossierDraft, type BookDossierIssue,
  type BookDossierPage, type BookDossierPublicBlock, type BookDossierPublicSource,
  type BookDossierReadingMode, type BookDossierRecord, type BookDossierReviewStage,
  type BookDossierSemanticAnchor, type BookDossierSpoiler,
} from "./bookDossierDocument";
import { bookDossierDraftChecksum, bookDossierRightsIssues } from "./bookDossierRights";
import { validateBookDossierDraft } from "./bookDossierValidation";
import { validBookDossierDesignProof } from "./bookDossierDesign";
import { bookDossierReadingSteps } from "./bookDossierReadingSteps";

export type BookDossierCompileOptions = Readonly<{
  now: number;
  themeVersion: string;
  readingMode?: BookDossierReadingMode;
  revealSpoilers?: BookDossierSpoiler;
  reachedItemIds?: readonly string[];
  currentArticleVersions?: Readonly<Record<string, string>>;
  currentArticleReuseApprovals?: Readonly<Record<string, string>>;
  surface?: "READER" | "INDEX";
}>;
export type BookDossierCompileResult = Readonly<{ document: BookDossierDocumentV2 | null; issues: readonly BookDossierIssue[] }>;
const spoilerRank: Record<BookDossierSpoiler, number> = { NONE: 0, LIGHT: 1, MAJOR: 2, ENDING: 3 };
export const BOOK_DOSSIER_REVIEW_STAGES: readonly BookDossierReviewStage[] = ["facts", "rights", "editorial", "design", "accessibility", "final"];

export function bookDossierStructureIssues(draft: BookDossierDraft): BookDossierIssue[] {
  const issues: BookDossierIssue[] = [];
  const fail = (code: string, path: string) => { issues.push({ code, path }); };
  const sourceIds = new Set(draft.sources.map(source => source.id));
  const blockIds = new Set(draft.blocks.map(block => block.id));
  const sectionIds = new Set(draft.sections.map(section => section.id));
  const itemIds = new Set<string>();
  const references = draft.sections.flatMap(section => section.blockIds);
  const limits = BOOK_DOSSIER_LIMITS[draft.tier];
  if (draft.sections.length < limits.minimum || draft.sections.length > limits.maximum) fail("tier-page-count", "sections");
  for (const purpose of ["identity", "why-read", "description", "passport", "provenance", "legal-reading"]) {
    const section = draft.sections.find(section => section.purpose === purpose);
    if (!section) fail("core-section-required", purpose);
    else if (section.spoiler !== "NONE" || section.blockIds.some(id => {
      const block = draft.blocks.find(candidate => candidate.id === id);
      return !block || block.spoiler !== "NONE" || !block.readingModes.includes("BEFORE_READING");
    })) fail("core-must-be-spoiler-safe", section.id);
  }
  if (draft.requiredLocales.some(locale => !draft.translationReadyLocales.includes(locale))) fail("required-translation-missing", "requiredLocales");
  if (!draft.requiredLocales.includes(draft.locale)) fail("document-locale-required", "requiredLocales");
  if (draft.tier !== "CORE" && !draft.sections.some(section => ["context", "analysis"].includes(section.purpose))) fail("enrichment-content-required", "sections");
  for (const section of draft.sections) {
    if (!section.blockIds.length) fail("empty-section", section.id);
    for (const id of section.blockIds) if (!blockIds.has(id)) fail("unknown-block", section.id);
  }
  for (const block of draft.blocks) {
    if (!sectionIds.has(block.sectionId) || !draft.sections.find(section => section.id === block.sectionId)?.blockIds.includes(block.id)) fail("section-mismatch", block.id);
    if (references.filter(id => id === block.id).length !== 1) fail("block-must-have-one-owner", block.id);
    if (!block.paragraphs.length && !block.items.length && !block.sourceIds.length) fail("empty-block", block.id);
    if (!block.sourceIds.length && block.kind !== "colophon") fail("factual-source-required", block.id);
    if (block.kind === "themes" && block.items.length < 3) fail("theme-count", block.id);
    for (const id of [...block.sourceIds, ...block.items.flatMap(item => item.sourceIds)]) if (!sourceIds.has(id)) fail("unknown-source", block.id);
    for (const item of block.items) {
      if (itemIds.has(item.id)) fail("duplicate-item-id", item.id);
      itemIds.add(item.id);
    }
  }
  for (const block of draft.blocks) {
    if (block.availableAfterItemId && !itemIds.has(block.availableAfterItemId)) fail("unknown-progress-anchor", block.id);
    for (const item of block.items) for (const reference of [item.fromId, item.toId]) if (reference && !itemIds.has(reference)) fail("unknown-diagram-node", item.id);
  }
  for (const grant of draft.rights) for (const id of grant.sourceIds) if (!sourceIds.has(id)) fail("unknown-rights-source", grant.id);
  return issues;
}

function optionsIssues(options: BookDossierCompileOptions, draft: BookDossierDraft) {
  const issues: BookDossierIssue[] = [];
  const mode = options.readingMode || "BEFORE_READING";
  if (!Number.isFinite(options.now) || typeof options.themeVersion !== "string" || !options.themeVersion || options.themeVersion.length > 160) issues.push({ code: "invalid-render-context", path: "options" });
  if (!["BEFORE_READING", "DURING_READING", "AFTER_READING"].includes(mode) || !Object.prototype.hasOwnProperty.call(spoilerRank, options.revealSpoilers || "NONE")) issues.push({ code: "invalid-reading-mode", path: "options" });
  if (mode === "BEFORE_READING" && options.revealSpoilers && options.revealSpoilers !== "NONE") issues.push({ code: "before-reading-must-be-spoiler-free", path: "options.revealSpoilers" });
  const steps = bookDossierReadingSteps(draft);
  const reached = options.reachedItemIds || [];
  if (reached.length > steps.length || reached.some((id, index) => id !== steps[index]?.id) || mode !== "DURING_READING" && reached.length) issues.push({ code: "unknown-or-disallowed-progress", path: "options.reachedItemIds" });
  return issues;
}

function project(draft: BookDossierDraft, checksum: string, options: BookDossierCompileOptions): BookDossierDocumentV2 {
  const readingMode = options.readingMode || "BEFORE_READING";
  const reveal = options.surface === "INDEX" ? "NONE" : options.revealSpoilers || "NONE";
  const allowedSpoiler = (spoiler: BookDossierSpoiler) => spoilerRank[spoiler] <= spoilerRank[reveal];
  const reached = new Set(options.reachedItemIds || []);
  const sources = new Map(draft.sources.map(source => [source.id, source]));
  const grants = new Map(draft.rights.map(grant => [grant.id, grant]));
  const allowedSections = new Set(draft.sections.filter(section => allowedSpoiler(section.spoiler)).map(section => section.id));
  const candidates = draft.blocks.filter(block => allowedSections.has(block.sectionId) && allowedSpoiler(block.spoiler) &&
    block.readingModes.includes(readingMode) && (!block.availableAfterItemId || readingMode === "AFTER_READING" || readingMode === "DURING_READING" && reached.has(block.availableAfterItemId)) &&
    (options.surface !== "INDEX" || grants.get(block.rightsId)?.allowIndexing && grants.get(block.rightsId)?.allowedSurfaces.includes("INDEX")));
  const visibleItemIds = new Set(candidates.flatMap(block => block.items.filter(item => allowedSpoiler(item.spoiler)).map(item => item.id)));
  const publicSources = (ids: readonly string[]): BookDossierPublicSource[] => [...new Set(ids)].flatMap(id => {
    const source = sources.get(id);
    return source ? [{ id, provider: source.provider, title: source.title, sourceUrl: source.url,
      usageLabel: draft.locale === "en" ? "Editorial reference" : "Редакционный источник",
      ...(source.reviewedAt ? { reviewedAt: source.reviewedAt } : {}), ...(source.attribution ? { attribution: source.attribution } : {}) }] : [];
  });
  const blocks: BookDossierPublicBlock[] = candidates.map(block => {
    const anchor: BookDossierSemanticAnchor = { sectionId: block.sectionId, blockId: block.id, dossierVersion: draft.dossierVersion, locale: draft.locale, readingMode };
    const items = block.items.filter(item => allowedSpoiler(item.spoiler) &&
      (!item.fromId || visibleItemIds.has(item.fromId)) && (!item.toId || visibleItemIds.has(item.toId)))
      .map(item => ({ id: item.id, label: item.label, sourceIds: [...item.sourceIds], spoiler: item.spoiler,
        ...(item.text ? { text: item.text } : {}), ...(item.value ? { value: item.value } : {}),
        ...(item.href ? { href: item.href } : {}), ...(item.fromId ? { fromId: item.fromId } : {}), ...(item.toId ? { toId: item.toId } : {}),
      }));
    return { id: block.id, sectionId: block.sectionId, kind: block.kind as BookDossierPublicBlock["kind"], title: block.title,
      paragraphs: [...block.paragraphs], items, sources: publicSources([...block.sourceIds, ...items.flatMap(item => item.sourceIds)]), anchor };
  }).filter(block => block.paragraphs.length || block.items.length || block.kind === "sources" && block.sources.length);
  const pages: BookDossierPage[] = draft.sections.flatMap(section => {
    const content = blocks.filter(block => block.sectionId === section.id);
    if (!content.length) return [];
    return [{ id: section.id, index: 0, sectionId: section.id, template: section.template,
      anchor: content[0].anchor, eyebrow: draft.locale === "en" ? "Proba Pera dossier" : "Досье Пробы пера",
      title: section.title, rows: [],
      paragraphs: content.flatMap(block => block.paragraphs), sources: publicSources(content.flatMap(block => block.sources.map(source => source.id))), blocks: content }];
  }).map((page, index) => ({ ...page, index }));
  return { schemaVersion: 2, bookKey: draft.bookKey, locale: draft.locale, dossierVersion: draft.dossierVersion,
    profile: draft.profile, tier: draft.tier, themeVersion: options.themeVersion, pageDataVersion: BOOK_DOSSIER_DATA_VERSION,
    cacheKey: `${encodeURIComponent(draft.bookKey)}|${draft.locale}|${draft.dossierVersion}|${checksum}|${encodeURIComponent(options.themeVersion)}|${readingMode}|${reveal}|${[...reached].sort().join(",")}`,
    contentMode: "DOSSIER_ONLY", readingMode, progressSteps: bookDossierReadingSteps(draft),
    validUntil: new Date(Math.min(options.now + 60_000, ...draft.rights.flatMap(grant => [Date.parse(grant.recheckAt), ...(grant.expiresAt ? [Date.parse(grant.expiresAt)] : [])]))).toISOString(), pages,
    contents: pages.map(page => ({ id: page.sectionId, title: page.title, anchor: page.anchor })),
  };
}

async function compile(record: BookDossierRecord, options: BookDossierCompileOptions, reviewOnly: boolean): Promise<BookDossierCompileResult> {
  const validated = validateBookDossierDraft(record?.draft);
  if (!validated.draft) return { document: null, issues: validated.issues };
  const draft = validated.draft;
  const issues = [...bookDossierStructureIssues(draft), ...optionsIssues(options, draft)];
  const checksum = await bookDossierDraftChecksum(draft);
  if (record.contentChecksum !== checksum) issues.push({ code: "dossier-changed-re-review-required", path: "contentChecksum" });
  if (!reviewOnly && record.status !== "PUBLISHED") issues.push({ code: "human-publication-required", path: "status" });
  if (reviewOnly && ["ARCHIVED", "BLOCKED", "RE_REVIEW_REQUIRED"].includes(record.status)) issues.push({ code: "review-preview-unavailable", path: "status" });
  const requiredStages = reviewOnly ? ["facts", "rights"] : BOOK_DOSSIER_REVIEW_STAGES;
  for (const stage of requiredStages) {
    if (!Array.isArray(record.reviews) || !record.reviews.some(review => review.stage === stage && review.decision === "APPROVED" &&
      review.actorKind === "HUMAN" && review.actorId && review.dossierVersion === draft.dossierVersion &&
      review.contentChecksum === checksum && Number.isFinite(Date.parse(review.reviewedAt)) && Date.parse(review.reviewedAt) <= options.now)) {
      issues.push({ code: "human-review-required", path: `reviews.${stage}` });
    }
  }
  const reviews = Array.isArray(record.reviews) ? record.reviews : [];
  const factReview = reviews.find(review => review.stage === "facts" && review.decision === "APPROVED");
  const rightsReview = reviews.find(review => review.stage === "rights" && review.decision === "APPROVED");
  if (!reviewOnly && !validBookDossierDesignProof(reviews.find(review => review.stage === "design")?.designProof, draft, checksum, options.now)) issues.push({ code: "measured-design-review-required", path: "reviews.design" });
  for (const source of draft.sources) if (source.reviewedBy !== factReview?.actorId || source.reviewedAt !== factReview?.reviewedAt) issues.push({ code: "source-human-review-missing", path: `sources.${source.id}` });
  for (const block of draft.blocks) {
    const grant = draft.rights.find(grant => grant.id === block.rightsId);
    issues.push(...await bookDossierRightsIssues(block, grant, { now: options.now, bookKey: draft.bookKey, currentArticleVersions: options.currentArticleVersions, currentArticleReuseApprovals: options.currentArticleReuseApprovals }));
    if (grant?.reviewedBy !== rightsReview?.actorId || grant?.reviewedAt !== rightsReview?.reviewedAt) issues.push({ code: "grant-human-review-missing", path: `rights.${block.rightsId}` });
  }
  if (issues.length) return { document: null, issues };
  return { document: project(draft, checksum, options), issues: [] };
}

export function compileBookDossier(record: BookDossierRecord, options: BookDossierCompileOptions) { return compile(record, options, false); }
/** For the authenticated CMS only, after actual fact and rights reviews. */
export function compileBookDossierReviewPreview(record: BookDossierRecord, options: BookDossierCompileOptions) { return compile(record, options, true); }
