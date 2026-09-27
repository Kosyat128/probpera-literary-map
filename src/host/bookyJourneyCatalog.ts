import type { ContentEntityRef } from "../planet/contentExportTypes";
import type { BookArchiveEntry, Country } from "../planet/types";
import { createBookyDialogueRegistry, getBookyDialogueChecksum } from "./bookyDialogueRegistry";
import { bookyJourneyEntityId, compileBookyJourney, getBookyJourneyChecksum,
  type BookyJourneyContext, type BookyJourneyPlan, type BookyJourneyTrust } from "./bookyJourney";
import type { BookyJourneyContent } from "./bookyJourneyContent";
import { parseBookyReaderPolicy } from "./bookyReaderPolicy";
import type { BookyReaderPolicySnapshot } from "./bookyReaderPolicyStore";
import type { BookyCompanionJourneySource } from "./planetMascot";

export type { BookyJourneyContent } from "./bookyJourneyContent";
export type BookyJourneyCatalogOptions = Readonly<{
  content: BookyJourneyContent;
  /** Pass only the effective policy field of the current store snapshot. */
  policy: BookyReaderPolicySnapshot["policy"];
  locale: "ru" | "en";
  now: string;
  connectivity: BookyJourneyContext["connectivity"];
  publicCountries: readonly Country[];
  publicBooks: readonly BookArchiveEntry[];
  completedPrerequisites: BookyJourneyContext["completedPrerequisites"];
  /** Read-only real delivery capability; missing is unavailable. */
  characterPublicationAvailable?: boolean;
}>;
export type BookyJourneyCatalog = Readonly<{
  plans: readonly BookyJourneyPlan[];
  sourceFor(plan: BookyJourneyPlan): BookyCompanionJourneySource | null;
}>;

type Row = Record<string, unknown>;
const emptyCatalog: BookyJourneyCatalog = Object.freeze({ plans: Object.freeze([]), sourceFor: () => null });
const key = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9._:-]{0,95}$/.test(value);
const version = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 1_000_000;
const locale = (value: unknown) => value === "ru" || value === "en";
const checksum = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const entityId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200
  && !/[\s\u0000-\u001f\u007f]/u.test(value);
const row = (value: unknown, fields: string): value is Row => value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(" ") === fields.split(" ").sort().join(" ");
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

/** The bundled inventory is still bounded own data. No getters, toJSON,
 * retained owner references, sparse arrays or unusual prototypes are accepted. */
function snapshot(input: unknown): unknown {
  let count = 0, characters = 0;
  const visiting = new Set<object>();
  function visit(value: unknown, depth: number): unknown {
    if (++count > 100_000 || depth > 14) throw new Error("bounds");
    if (typeof value === "string") {
      if (value.length > 16_384 || (characters += value.length) > 2_000_000) throw new Error("bounds");
      return value;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
    if (!value || typeof value !== "object" || visiting.has(value)) throw new Error("shape");
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error("prototype");
    visiting.add(value);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
      if (names.some(name => typeof name !== "string" || name.length > 96)) throw new Error("keys");
      if (array) {
        const length = descriptors.length?.value;
        if (!Number.isSafeInteger(length) || length < 0 || length > 512 || names.length !== length + 1) throw new Error("array");
        return Object.freeze(Array.from({ length }, (_, index) => {
          const descriptor = descriptors[String(index)];
          if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error("accessor");
          return visit(descriptor.value, depth + 1);
        }));
      }
      if (names.length > 24) throw new Error("keys");
      const result: Row = Object.create(null);
      for (const name of names as string[]) {
        const descriptor = descriptors[name];
        if (!descriptor.enumerable || !("value" in descriptor)) throw new Error("accessor");
        result[name] = visit(descriptor.value, depth + 1);
      }
      return Object.freeze(result);
    } finally { visiting.delete(value); }
  }
  try { return visit(input, 0); } catch { return undefined; }
}

function own(value: unknown, field: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  return descriptor?.enumerable && "value" in descriptor ? descriptor.value : undefined;
}
function dataArray(value: unknown, max: number): readonly unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length: unknown = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > max
    || Reflect.ownKeys(value).length !== length + 1) return null;
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) return null;
    result.push(descriptor.value);
  }
  return result;
}
/** Explicit invalid authorship must survive as invalid, never turn into absent
 * legacy authorship. Only activity target books need this additional data. */
function activityAuthorship(book: unknown): unknown {
  if (!book || typeof book !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(book))) return null;
  const descriptor = Object.getOwnPropertyDescriptor(book, "authorship");
  if (!descriptor) return undefined;
  if (!descriptor.enumerable || !("value" in descriptor)) return null;
  if (descriptor.value === undefined) return undefined;
  const captured = snapshot(descriptor.value);
  return captured === undefined ? null : captured;
}
function writerNames(writer: unknown): Readonly<{ name?: string; fullName?: string }> {
  const names: { name?: string; fullName?: string } = {};
  for (const field of ["name", "fullName"] as const) {
    const descriptor = writer && typeof writer === "object" ? Object.getOwnPropertyDescriptor(writer, field) : undefined;
    if (!descriptor) continue;
    if (!descriptor.enumerable || !("value" in descriptor)) throw Error("writer-name-accessor");
    if (descriptor.value === undefined) continue;
    if (typeof descriptor.value !== "string" || descriptor.value.length > 200 || /[\u0000-\u001f\u007f]/u.test(descriptor.value)) throw Error("writer-name");
    names[field] = descriptor.value;
  }
  return Object.freeze(names);
}
function coordinates(value: unknown) {
  const pair = Array.isArray(value) ? dataArray(value, 2) : null;
  const lat = pair?.length === 2 ? pair[0] : Array.isArray(value) ? undefined : own(value, "lat");
  const lng = pair?.length === 2 ? pair[1] : Array.isArray(value) ? undefined : own(value, "lng");
  return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180 ? Object.freeze({ lat, lng }) : undefined;
}
function unique(values: readonly unknown[], identity: (value: Row) => string): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const id = identity(value as Row);
    if (seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}
const scoped = (value: Row) => JSON.stringify([value.id, value.locale]);

function contentValid(value: unknown): value is BookyJourneyContent {
  if (!row(value, "definitions dialogues currentVersions dialogueApprovals journeyApprovals availability")) return false;
  const fields = Object.values(value);
  if (fields.some(items => !Array.isArray(items) || items.length > 128)) return false;
  const content = value as unknown as BookyJourneyContent;
  if (!content.definitions.every(item => getBookyJourneyChecksum(item) !== null)
    || !unique(content.definitions, scoped)
    || !content.currentVersions.every(item => row(item, "id version") && key(item.id) && version(item.version))
    || !unique(content.currentVersions, item => String(item.id))
    || !content.definitions.every(item => content.currentVersions.some(current => current.id === item.id && current.version === item.version))
    || !content.dialogues.every(item => row(item, "payload review checksum") && checksum(item.checksum)
      && getBookyDialogueChecksum({ payload: item.payload, review: item.review }) === item.checksum)
    || !unique(content.dialogues, item => scoped(item.payload as Row))
    || !unique(content.dialogueApprovals, scoped) || !unique(content.journeyApprovals, scoped)
    || !unique(content.availability, item => JSON.stringify([item.journeyId, item.locale]))) return false;
  return content.availability.every(item => row(item, "journeyId version locale nodes") && key(item.journeyId)
    && version(item.version) && locale(item.locale) && Array.isArray(item.nodes) && item.nodes.length <= 32
    && unique(item.nodes, node => String(node.nodeId))
    && item.nodes.every(node => row(node, "nodeId locale dialogueContentChecksum available offlineAvailable")
      && key(node.nodeId) && node.locale === item.locale && checksum(node.dialogueContentChecksum)
      && typeof node.available === "boolean" && typeof node.offlineAvailable === "boolean"));
}

/** A catalog captures one current host view. Regenerate it when that view
 * changes; a source is stable only for a plan from this exact catalog. */
export function createBookyJourneyCatalog(options: BookyJourneyCatalogOptions): BookyJourneyCatalog {
  try {
    const policy = parseBookyReaderPolicy(options.policy);
    if (!policy || !locale(options.locale) || !timestamp(options.now) || policy.confirmedAt > options.now
      || !["online", "offline", "unknown"].includes(options.connectivity)) return emptyCatalog;
    const content = snapshot(options.content), completed = snapshot(options.completedPrerequisites);
    if (!contentValid(content) || !Array.isArray(completed) || completed.length > 128
      || !completed.every(item => row(item, "id version") && key(item.id) && version(item.version))
      || !unique(completed, item => String(item.id))) return emptyCatalog;
    const countries = dataArray(options.publicCountries, 256), books = dataArray(options.publicBooks, 50_000);
    if (!countries || !books) return emptyCatalog;

    // Candidate identities come only from bounded, fully validated definitions.
    // The large public catalog is checked for membership, never turned into a
    // giant canonical-id policy or copied with its embedded pre-quarantine data.
    const refs = new Map<string, ContentEntityRef>();
    const wantedCountries = new Map<string, Set<string>>(), wantedWorks = new Set<string>(), activityWorks = new Set<string>();
    const activityChoiceWriters = new Set<string>();
    const includeRef = (ref: ContentEntityRef) => {
      const id = bookyJourneyEntityId(ref);
      refs.set(id, ref);
      if (refs.size > 512) throw Error("entity-bounds");
      let writers = wantedCountries.get(ref.countryId);
      if (!writers) { writers = new Set(); wantedCountries.set(ref.countryId, writers); }
      if (ref.kind !== "country") writers.add(ref.writerId);
      if (ref.kind === "work") wantedWorks.add(id);
    };
    for (const definition of content.definitions) for (const node of definition.nodes) {
      if (node.entity) includeRef(node.entity);
      if (node.activity) {
        includeRef(node.activity.targetWork); activityWorks.add(bookyJourneyEntityId(node.activity.targetWork));
        for (const choice of node.activity.choices) {
          includeRef(choice.writer); activityChoiceWriters.add(bookyJourneyEntityId(choice.writer));
        }
      }
    }
    // These frozen projections intentionally contain only the actual fields
    // read by the compiler's membership checks, not display or narrative data.
    // Capture activity authorship before projecting writers: factual authors
    // can differ from the archive owner and must resolve in the current public view.
    const publicBooks = Object.freeze(books.flatMap(book => {
      const id = own(book, "id"), countryId = own(book, "countryId"), writerId = own(book, "writerId");
      if (typeof id !== "string" || typeof countryId !== "string" || typeof writerId !== "string") return [];
      const refId = bookyJourneyEntityId({ kind: "work", countryId, writerId, workId: id });
      if (!wantedWorks.has(refId)) return [];
      const status = own(own(book, "editorial"), "status");
      const authorship = activityWorks.has(refId) ? activityAuthorship(book) : undefined;
      if (own(authorship, "kind") === "single") {
        const authors = dataArray(own(authorship, "authors"), 1), author = authors?.length === 1 ? authors[0] : null;
        const authorCountry = own(author, "countryId"), authorWriter = own(author, "writerId");
        if (entityId(authorCountry) && entityId(authorWriter)) includeRef({ kind: "writer", countryId: authorCountry, writerId: authorWriter });
      }
      return [Object.freeze({ id, countryId, writerId,
        editorial: Object.freeze({ status: typeof status === "string" ? status : undefined }),
        ...(authorship !== undefined ? { authorship } : {}) }) as unknown as BookArchiveEntry];
    }));
    const publicCountries = Object.freeze(countries.flatMap(country => {
      const id = own(country, "id");
      if (typeof id !== "string" || !wantedCountries.has(id)) return [];
      const writers = dataArray(own(country, "writers"), 50_000);
      const relevant = Object.freeze((writers ?? []).flatMap(writer => {
        const writerId = own(writer, "id");
        if (typeof writerId !== "string" || !wantedCountries.get(id)!.has(writerId)) return [];
        const choiceId = bookyJourneyEntityId({ kind: "writer", countryId: id, writerId });
        return [Object.freeze({ id: writerId, ...(activityChoiceWriters.has(choiceId) ? writerNames(writer) : {}) })];
      }));
      return [Object.freeze({ id, coordinates: coordinates(own(country, "coordinates")), writers: relevant }) as unknown as Country];
    }));
    const canonicalEntityIds = Object.freeze([...refs].flatMap(([id, ref]) => {
      const matches = publicCountries.filter(country => country.id === ref.countryId);
      if (matches.length !== 1) return [];
      if (ref.kind === "country") return [id];
      if (matches[0].writers.filter(writer => writer.id === ref.writerId).length !== 1) return [];
      if (ref.kind === "writer") return [id];
      const works = publicBooks.filter(book => book.id === ref.workId && book.countryId === ref.countryId && book.writerId === ref.writerId);
      return works.length === 1 && (works[0].editorial?.status === "reviewed" || works[0].editorial?.status === "verified") ? [id] : [];
    }));
    const dialogueRegistry = createBookyDialogueRegistry(content.dialogues, { canonicalEntityIds, approvedReviews: content.dialogueApprovals });
    if (dialogueRegistry.rejections.some(item => item.reason !== "unknown-entity")) return emptyCatalog;
    const trust: BookyJourneyTrust = Object.freeze({ currentVersions: content.currentVersions,
      approvedReviews: content.journeyApprovals, dialogueRegistry, publicCountries, publicBooks,
      characterPublicationAvailable: options.characterPublicationAvailable === true });
    const plans: BookyJourneyPlan[] = [], sources = new WeakMap<BookyJourneyPlan, BookyCompanionJourneySource>();
    for (const definition of content.definitions) {
      if (definition.locale !== options.locale) continue;
      const available = content.availability.find(item => item.journeyId === definition.id
        && item.version === definition.version && item.locale === definition.locale);
      if (!available) continue;
      const context: BookyJourneyContext = { audience: "adult", age: policy.age, readingLevel: policy.readingLevel,
        locale: options.locale, now: options.now, connectivity: options.connectivity,
        completedPrerequisites: completed as BookyJourneyContext["completedPrerequisites"], availability: available.nodes };
      const plan = compileBookyJourney(definition, context, trust);
      if (!plan) continue;
      const source: BookyCompanionJourneySource = Object.freeze({ definition, trust, now: options.now,
        completedPrerequisites: context.completedPrerequisites, availability: available.nodes });
      plans.push(plan); sources.set(plan, source);
    }
    return Object.freeze({ plans: Object.freeze(plans), sourceFor: (plan: BookyJourneyPlan) => sources.get(plan) ?? null });
  } catch { return emptyCatalog; }
}
