import { compileBookDossier, compileBookDossierReviewPreview } from "./bookDossierCompiler";
import { bookDossierProfiles, bookDossierTemplates, type BookDossierDocumentV2, type BookDossierIssue, type BookDossierReadingMode, type BookDossierRecord, type BookDossierSpoiler } from "./bookDossierDocument";
import { isBookDossierUrl } from "./bookDossierValidation";
import { bookDossierReadingSteps } from "./bookDossierReadingSteps";

export const BOOK_DOSSIER_DELIVERY_LIMIT = 2_000_000;
export type BookDossierPublicRequest = Readonly<{ bookKey: string; locale: "ru" | "en"; mode: BookDossierReadingMode; revealSpoilers: BookDossierSpoiler; reachedItemIds: readonly string[] }>;
export type BookDossierVariantBank = Readonly<{
  schemaVersion: 2; contentChecksum: string; validUntil: string;
  progressItemIds: readonly string[];
  variants: readonly Readonly<{ mode: BookDossierReadingMode; revealSpoilers: BookDossierSpoiler; reachedItemIds: readonly string[]; document: BookDossierDocumentV2 }>[];
}>;
const modes = ["BEFORE_READING", "DURING_READING", "AFTER_READING"] as const;
const spoilers = ["NONE", "LIGHT", "MAJOR", "ENDING"] as const;
const keys = (value: unknown, allowed: readonly string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key)));
const text = (value: unknown, maximum = 240): value is string => typeof value === "string" && value.length <= maximum && !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9_.:-]{0,95}$/u.test(value);
const list = (value: unknown, maximum: number): value is unknown[] => Array.isArray(value) && value.length <= maximum;

export function parseBookDossierPublicRequest(value: unknown): BookDossierPublicRequest | null {
  if (!keys(value, ["bookKey", "locale", "mode", "revealSpoilers", "reachedItemIds"]) || !text(value.bookKey) ||
    !/^[^\s<>/?#\\:]+:[^\s<>/?#\\:]+:[^\s<>/?#\\]+$/u.test(value.bookKey) || !["ru", "en"].includes(String(value.locale))) return null;
  const mode = value.mode ?? "BEFORE_READING", revealSpoilers = value.revealSpoilers ?? "NONE", reachedItemIds = value.reachedItemIds ?? [];
  if (!modes.includes(mode as BookDossierReadingMode) || !spoilers.includes(revealSpoilers as BookDossierSpoiler) || !list(reachedItemIds, 24) ||
    !reachedItemIds.every(id) || new Set(reachedItemIds).size !== reachedItemIds.length || mode !== "DURING_READING" && reachedItemIds.length || mode === "BEFORE_READING" && revealSpoilers !== "NONE") return null;
  return { bookKey: value.bookKey, locale: value.locale as "ru" | "en", mode: mode as BookDossierReadingMode,
    revealSpoilers: revealSpoilers as BookDossierSpoiler, reachedItemIds: reachedItemIds as string[] };
}

/** Strict allowlist on both sides of the network. No private draft field is accepted. */
export function parsePublishedBookDossier(value: unknown, now = Date.now()): BookDossierDocumentV2 | null {
  if (!keys(value, ["schemaVersion", "bookKey", "locale", "dossierVersion", "profile", "tier", "themeVersion", "pageDataVersion", "cacheKey", "contentMode", "readingMode", "validUntil", "progressSteps", "pages", "contents"]) ||
    value.schemaVersion !== 2 || value.contentMode !== "DOSSIER_ONLY" || !text(value.bookKey) || !id(value.dossierVersion) ||
    !["ru", "en"].includes(String(value.locale)) || !modes.includes(value.readingMode as BookDossierReadingMode) ||
    !(value.profile === null || bookDossierProfiles.includes(value.profile as typeof bookDossierProfiles[number])) ||
    !(value.tier === null || ["CORE", "ENRICHED", "SIGNATURE"].includes(String(value.tier))) ||
    ![value.themeVersion, value.pageDataVersion, value.cacheKey].every(entry => text(entry, 4096)) || !list(value.pages, 18) || !value.pages.length || !list(value.contents, 18) ||
    !Number.isFinite(now) || typeof value.validUntil !== "string" || !Number.isFinite(Date.parse(value.validUntil)) || Date.parse(value.validUntil) <= now || Date.parse(value.validUntil) > now + 65_000) return null;
  if (value.progressSteps !== undefined && (!list(value.progressSteps, 24) || !value.progressSteps.every(step =>
    keys(step, ["id", "label"]) && id(step.id) && text(step.label) && step.label.trim()) ||
    new Set(value.progressSteps.map(step => (step as { id: string }).id)).size !== value.progressSteps.length)) return null;
  const anchor = (entry: unknown) => keys(entry, ["sectionId", "blockId", "itemId", "dossierVersion", "locale", "readingMode"]) &&
    id(entry.sectionId) && id(entry.blockId) && (entry.itemId === undefined || id(entry.itemId)) && entry.dossierVersion === value.dossierVersion && entry.locale === value.locale && entry.readingMode === value.readingMode;
  const source = (entry: unknown) => keys(entry, ["id", "provider", "title", "sourceUrl", "usageLabel", "reviewedAt", "attribution"]) && id(entry.id) &&
    [entry.provider, entry.title, entry.usageLabel].every(item => text(item)) && isBookDossierUrl(entry.sourceUrl) &&
    (entry.attribution === undefined || text(entry.attribution)) && (entry.reviewedAt === undefined || typeof entry.reviewedAt === "string" && Number.isFinite(Date.parse(entry.reviewedAt)));
  const item = (entry: unknown) => keys(entry, ["id", "label", "value", "text", "href", "sourceIds", "spoiler", "fromId", "toId"]) && id(entry.id) && text(entry.label) &&
    [entry.value, entry.text].every(item => item === undefined || text(item, 480)) && (entry.href === undefined || isBookDossierUrl(entry.href)) &&
    list(entry.sourceIds, 24) && entry.sourceIds.every(id) && spoilers.includes(entry.spoiler as BookDossierSpoiler) &&
    [entry.fromId, entry.toId].every(item => item === undefined || id(item));
  const block = (entry: unknown) => keys(entry, ["id", "sectionId", "kind", "title", "paragraphs", "items", "sources", "anchor"]) && id(entry.id) && id(entry.sectionId) &&
    ["metadata", "editorial", "key-points", "timeline", "characters", "relationships", "themes", "related-articles", "sources", "legal-links", "colophon"].includes(String(entry.kind)) &&
    text(entry.title) && list(entry.paragraphs, 3) && entry.paragraphs.every(item => text(item, 1200)) && list(entry.items, 24) && entry.items.every(item) && list(entry.sources, 24) && entry.sources.every(source) && anchor(entry.anchor);
  const pageIds = new Set<string>();
  for (const [index, page] of value.pages.entries()) {
    if (!keys(page, ["id", "index", "sectionId", "template", "anchor", "eyebrow", "title", "rows", "paragraphs", "sources", "blocks"]) ||
      !id(page.id) || pageIds.has(page.id) || page.index !== index || page.sectionId !== page.id || !bookDossierTemplates.includes(page.template as typeof bookDossierTemplates[number]) ||
      !anchor(page.anchor) || !text(page.eyebrow) || !text(page.title) || !list(page.rows, 192) || !page.rows.every(row => keys(row, ["id", "kind", "label", "value"]) && id(row.id) && text(row.kind) && text(row.label) && text(row.value, 3000)) ||
      !list(page.paragraphs, 24) || !page.paragraphs.every(item => text(item, 1200)) || !list(page.sources, 24) || !page.sources.every(source) || !list(page.blocks, 8) || !page.blocks.length ||
      !page.blocks.every(entry => block(entry) && (entry as Record<string, unknown>).sectionId === page.id)) return null;
    pageIds.add(page.id);
  }
  if (value.contents.length !== value.pages.length || !value.contents.every((entry, index) => keys(entry, ["id", "title", "anchor"]) &&
    entry.id === (value.pages as Record<string, unknown>[])[index].id && text(entry.title) && anchor(entry.anchor))) return null;
  return value as unknown as BookDossierDocumentV2;
}

/** Private finite variants: anonymous clients receive one document, never this bank. */
async function compileVariantBank(record: BookDossierRecord, options: { now: number; currentArticleVersions?: Readonly<Record<string, string>> }, reviewOnly: boolean): Promise<{ bank: BookDossierVariantBank | null; issues: readonly BookDossierIssue[] }> {
  const progressItemIds = bookDossierReadingSteps(record.draft).map(step => step.id);
  if (progressItemIds.length > 24) return { bank: null, issues: [{ code: "progress-variant-limit", path: "blocks" }] };
  const variants: BookDossierVariantBank["variants"][number][] = [];
  for (const mode of modes) for (const revealSpoilers of spoilers) {
    if (mode === "BEFORE_READING" && revealSpoilers !== "NONE") continue;
    const lengths = mode === "DURING_READING" ? Array.from({ length: progressItemIds.length + 1 }, (_, index) => index) : [0];
    for (const length of lengths) {
      const reachedItemIds = progressItemIds.slice(0, length);
      const result = await (reviewOnly ? compileBookDossierReviewPreview : compileBookDossier)(record, { ...options, themeVersion: "published-v2", readingMode: mode, revealSpoilers, reachedItemIds });
      if (!result.document) return { bank: null, issues: result.issues };
      if (!parsePublishedBookDossier(result.document, options.now)) return { bank: null, issues: [{ code: "invalid-public-projection", path: "document" }] };
      variants.push({ mode, revealSpoilers, reachedItemIds, document: result.document });
    }
  }
  const deadline = Math.min(...record.draft.rights.flatMap(grant => [Date.parse(grant.recheckAt), ...(grant.expiresAt ? [Date.parse(grant.expiresAt)] : [])]));
  const bank: BookDossierVariantBank = { schemaVersion: 2, contentChecksum: record.contentChecksum, validUntil: new Date(deadline).toISOString(), progressItemIds, variants };
  if (new TextEncoder().encode(JSON.stringify(bank)).length > BOOK_DOSSIER_DELIVERY_LIMIT) return { bank: null, issues: [{ code: "finite-delivery-size", path: "variants" }] };
  return { bank, issues: [] };
}
export function compileBookDossierVariantBank(record: BookDossierRecord, options: { now: number; currentArticleVersions?: Readonly<Record<string, string>> }) { return compileVariantBank(record, options, false); }
export function compileBookDossierReviewVariantBank(record: BookDossierRecord, options: { now: number; currentArticleVersions?: Readonly<Record<string, string>> }) { return compileVariantBank(record, options, true); }

export function selectBookDossierVariant(bank: BookDossierVariantBank, request: BookDossierPublicRequest, now: number) {
  if (!Number.isFinite(now) || Date.parse(bank.validUntil) <= now || request.reachedItemIds.some(id => !bank.progressItemIds.includes(id))) return null;
  const variant = bank.variants.find(candidate => candidate.mode === request.mode && candidate.revealSpoilers === request.revealSpoilers &&
    candidate.reachedItemIds.length === request.reachedItemIds.length && candidate.reachedItemIds.every((id, index) => request.reachedItemIds[index] === id));
  if (!variant || variant.document.bookKey !== request.bookKey || variant.document.locale !== request.locale) return null;
  return parsePublishedBookDossier({ ...variant.document, validUntil: new Date(Math.min(now + 60_000, Date.parse(bank.validUntil))).toISOString() }, now);
}
