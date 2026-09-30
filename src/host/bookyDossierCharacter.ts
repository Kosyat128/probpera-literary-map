import { parsePublishedBookDossier } from "../books/bookDossierDelivery";
import type { BookDossierDocumentV2, BookDossierPublicSource, BookDossierReadingMode } from "../books/bookDossierDocument";
import { contentRecordHash } from "../planet/contentExportHash";
import type { ContentEntityRef, ContentLocale } from "../planet/contentExportTypes";
import type { Country } from "../data/countries/types";
import type { BookArchiveEntry } from "../data/bookArchive";
import type { BookySupportContentStatus } from "./bookySupport";

type WorkRef = Readonly<Extract<ContentEntityRef, { kind: "work" }>>;
export type BookyDossierCharacterReference = Readonly<{
  work: WorkRef; dossierVersion: string; locale: ContentLocale;
  sectionId: string; blockId: string; itemId: string;
}>;
export type BookyDossierCharacterProjection = Readonly<{
  reference: BookyDossierCharacterReference; bookKey: string; readingMode: BookDossierReadingMode;
  sectionTitle: string; blockTitle: string; label: string;
  text?: string; value?: string; href?: string;
  itemSourceIds: readonly string[]; sources: readonly BookDossierPublicSource[];
  semanticChecksum: string;
}>;
export type BookyDossierCharacterInput = Readonly<{
  reference: BookyDossierCharacterReference;
  /** Current trusted published projection only; never a preview or fallback. */
  dossier: BookDossierDocumentV2 | null;
  publicCountries: readonly Country[]; publicBooks: readonly BookArchiveEntry[];
}>;
export type BookyDossierCharacterHostSnapshot = Readonly<{
  /** Replace this immutable snapshot, including its data, on every change. */
  revision: number; enabled: boolean; active: boolean; access: "adult" | "child" | "blocked";
  locale: ContentLocale; countryStatus: BookySupportContentStatus; booksStatus: BookySupportContentStatus;
  /** A trusted published-data reader supplies null when revoked or unavailable. */
  dossier: BookDossierDocumentV2 | null;
  publicCountries: readonly Country[]; publicBooks: readonly BookArchiveEntry[];
}>;
export type BookyDossierCharacterRequest = Readonly<{
  reference: BookyDossierCharacterReference; expectedChecksum: string; hostRevision: number;
}>;

type Row = Record<string, unknown>;
const key = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9_.:-]{0,95}$/u.test(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const revision = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
// The public request parser uses two colon separators; the work tail may itself
// contain colons, whereas country and writer IDs cannot make the tuple ambiguous.
const entityId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200
  && !/[\s<>/?#\\\u0000-\u001f\u007f]/u.test(value);
function own(value: unknown, field: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("shape");
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (!descriptor) return undefined;
  if (!descriptor.enumerable || !("value" in descriptor)) throw Error("accessor");
  return descriptor.value;
}
function data(value: unknown, fields: readonly string[]): Row {
  if (!value || typeof value !== "object" || Reflect.ownKeys(value).length !== fields.length) throw Error("fields");
  const result: Row = Object.create(null);
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) throw Error("fields");
    result[field] = own(value, field);
  }
  return result;
}
function array(value: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw Error("array");
  const length: unknown = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!revision(length) || length > maximum || Reflect.ownKeys(value).length !== length + 1) throw Error("bounds");
  return Array.from({ length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) throw Error("accessor");
    return descriptor.value;
  });
}
/** Snapshot before the existing public parser: never execute getters/toJSON or
 * retain input objects. Bounds cover the finite 18-page public dossier model. */
function snapshot(input: unknown): unknown {
  let nodes = 0, characters = 0;
  const ancestors = new Set<object>();
  function visit(value: unknown, depth: number): unknown {
    if (++nodes > 131_072 || depth > 16) throw Error("bounds");
    if (typeof value === "string") {
      characters += value.length;
      if (value.length > 16_384 || characters > 2_000_000) throw Error("bounds");
      return value;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
    if (!value || typeof value !== "object" || ancestors.has(value)) throw Error("shape");
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("prototype");
    ancestors.add(value);
    try {
      if (Array.isArray(value)) return Object.freeze(array(value, 256).map(item => visit(item, depth + 1)));
      const names = Reflect.ownKeys(value);
      if (names.length > 32 || names.some(name => typeof name !== "string" || name.length > 96)) throw Error("fields");
      const result: Row = Object.create(null);
      for (const name of names as string[]) result[name] = visit(own(value, name), depth + 1);
      return Object.freeze(result);
    } finally { ancestors.delete(value); }
  }
  return visit(input, 0);
}
function reference(input: unknown): BookyDossierCharacterReference {
  const value = data(input, ["work", "dossierVersion", "locale", "sectionId", "blockId", "itemId"]);
  const work = data(value.work, ["kind", "countryId", "writerId", "workId"]);
  if (work.kind !== "work" || !entityId(work.countryId) || work.countryId.includes(":")
    || !entityId(work.writerId) || work.writerId.includes(":") || !entityId(work.workId)
    || !key(value.dossierVersion) || value.locale !== "ru" && value.locale !== "en"
    || !key(value.sectionId) || !key(value.blockId) || !key(value.itemId)) throw Error("reference");
  return Object.freeze({ work: Object.freeze({ kind: "work", countryId: work.countryId, writerId: work.writerId, workId: work.workId }),
    dossierVersion: value.dossierVersion, locale: value.locale, sectionId: value.sectionId, blockId: value.blockId, itemId: value.itemId });
}
/** Structural, immutable reference only; it supplies no publication or access authority. */
export function parseBookyDossierCharacterReference(input: unknown): BookyDossierCharacterReference | null {
  try { return reference(input); } catch { return null; }
}
function publicWork(ref: WorkRef, countriesInput: unknown, booksInput: unknown): boolean {
  const countries = array(countriesInput, 256), books = array(booksInput, 50_000);
  const countriesFound = countries.filter(country => own(country, "id") === ref.countryId);
  if (countriesFound.length !== 1
    || array(own(countriesFound[0], "writers"), 50_000).filter(writer => own(writer, "id") === ref.writerId).length !== 1) return false;
  const booksFound = books.filter(book => own(book, "id") === ref.workId && own(book, "countryId") === ref.countryId
    && own(book, "writerId") === ref.writerId);
  if (booksFound.length !== 1) return false;
  const status = own(own(booksFound[0], "editorial"), "status");
  return status === "reviewed" || status === "verified";
}
function project(ref: BookyDossierCharacterReference, dossierInput: unknown, now: number): BookyDossierCharacterProjection | null {
  const dossier = parsePublishedBookDossier(snapshot(dossierInput), now);
  const bookKey = `${ref.work.countryId}:${ref.work.writerId}:${ref.work.workId}`;
  if (!dossier || dossier.profile === null || dossier.tier === null || dossier.bookKey !== bookKey
    || dossier.dossierVersion !== ref.dossierVersion || dossier.locale !== ref.locale) return null;
  // Page/block/item identities must be unambiguous in the current filtered
  // projection. Repeated source IDs may occur across blocks only with exact data.
  const blockIds = new Set<string>(), itemIds = new Set<string>(), sourceById = new Map<string, string>();
  for (const page of dossier.pages) {
    for (const block of page.blocks) {
      if (blockIds.has(block.id) || block.anchor.sectionId !== block.sectionId || block.anchor.blockId !== block.id) return null;
      blockIds.add(block.id);
      for (const item of block.items) {
        if (itemIds.has(item.id)) return null;
        itemIds.add(item.id);
      }
    }
    for (const sources of [page.sources, ...page.blocks.map(block => block.sources)]) {
      const ids = new Set<string>();
      for (const source of sources) {
        const checksum = contentRecordHash(source), previous = sourceById.get(source.id);
        if (ids.has(source.id) || previous !== undefined && previous !== checksum) return null;
        ids.add(source.id); sourceById.set(source.id, checksum);
      }
    }
  }
  const page = dossier.pages.find(page => page.sectionId === ref.sectionId);
  const block = page?.blocks.find(block => block.id === ref.blockId && block.kind === "characters");
  const item = block?.items.find(item => item.id === ref.itemId);
  if (!page || !block || !item || item.fromId !== undefined || item.toId !== undefined || !item.label.trim()
    || !block.sources.length || !item.sourceIds.length || new Set(item.sourceIds).size !== item.sourceIds.length
    || !item.sourceIds.every(id => block.sources.some(source => source.id === id))) return null;
  const value = Object.freeze({ reference: ref, bookKey, readingMode: dossier.readingMode,
    sectionTitle: page.title, blockTitle: block.title, label: item.label,
    ...(item.text !== undefined ? { text: item.text } : {}), ...(item.value !== undefined ? { value: item.value } : {}),
    ...(item.href !== undefined ? { href: item.href } : {}),
    itemSourceIds: item.sourceIds,
    sources: Object.freeze(block.sources.filter(source => item.sourceIds.includes(source.id))) });
  return Object.freeze({ ...value, semanticChecksum: contentRecordHash(value) });
}

/** Pure checksum preparation over trusted current public input. This inspection
 * is not publication, child/rights/offline/StoryWorld or navigation authority. */
export function inspectBookyDossierCharacter(input: unknown, now: number): BookyDossierCharacterProjection | null {
  try {
    if (!Number.isFinite(now)) return null;
    const value = data(input, ["reference", "dossier", "publicCountries", "publicBooks"]), ref = reference(value.reference);
    return publicWork(ref.work, value.publicCountries, value.publicBooks) ? project(ref, value.dossier, now) : null;
  } catch { return null; }
}
const hostFields = ["revision", "enabled", "active", "access", "locale", "countryStatus", "booksStatus", "dossier", "publicCountries", "publicBooks"];

/** A checksum is integrity, never review authority. A preview can have the same
 * public shape: only the trusted published-delivery reader supplies authority.
 * The host must expose its current leased published dossier and adult catalogs.
 * Every call reads live time; no lease, offer or prior inspection is cached. */
export function resolveBookyDossierCharacter(input: unknown,
  readCurrentHost: () => BookyDossierCharacterHostSnapshot | null, readNow: () => number = Date.now): BookyDossierCharacterProjection | null {
  try {
    const request = data(input, ["reference", "expectedChecksum", "hostRevision"]), ref = reference(request.reference);
    if (!hash(request.expectedChecksum) || !revision(request.hostRevision)) return null;
    const now = readNow(), host = readCurrentHost(), current = data(host, hostFields);
    if (!Number.isFinite(now) || !revision(current.revision) || request.hostRevision !== current.revision
      || current.enabled !== true || current.active !== true || current.access !== "adult" || current.locale !== ref.locale
      || current.countryStatus !== "ready" || current.booksStatus !== "ready") return null;
    const lease = own(current.dossier, "validUntil"), deadline = typeof lease === "string" ? Date.parse(lease) : NaN;
    if (!Number.isFinite(deadline)) return null;
    const result = inspectBookyDossierCharacter({ reference: ref, dossier: current.dossier,
      publicCountries: current.publicCountries, publicBooks: current.publicBooks }, now);
    if (!result || result.semanticChecksum !== request.expectedChecksum) return null;
    const after = readNow(), latest = readCurrentHost();
    if (!Number.isFinite(after) || after < now || latest !== host || own(latest, "revision") !== current.revision
      || deadline <= after) return null;
    return result;
  } catch { return null; }
}
