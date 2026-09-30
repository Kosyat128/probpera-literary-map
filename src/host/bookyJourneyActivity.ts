import { contentRecordHash } from "../planet/contentExportHash";
import type { ContentEntityRef } from "../planet/contentExportTypes";
import type { Country } from "../data/countries/types";
import type { BookArchiveEntry } from "../data/bookArchive";

type WriterRef = Readonly<Extract<ContentEntityRef, { kind: "writer" }>>;
type WorkRef = Readonly<Extract<ContentEntityRef, { kind: "work" }>>;
export type BookyJourneyActivitySpec = Readonly<{
  schemaVersion: 1;
  id: string;
  version: number;
  type: "match-work-author";
  targetWork: WorkRef;
  choices: readonly Readonly<{ id: string; writer: WriterRef }>[];
}>;
export type BookyJourneyActivityResolved = Readonly<{
  spec: BookyJourneyActivitySpec;
  /** Raw authored spec, for binding within the independently reviewed journey. */
  definitionChecksum: string;
  /** Also binds the current derived factual author, not just the routing key. */
  semanticChecksum: string;
  correctChoiceId: string;
}>;
export type BookyJourneyActivityPublicData = Readonly<{
  /** Already authorized current public views; never raw/pre-quarantine data. */
  publicCountries: readonly Country[];
  publicBooks: readonly BookArchiveEntry[];
}>;

const key = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9._:-]{0,95}$/.test(value);
const entityId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200
  && !/[\s\u0000-\u001f\u007f]/u.test(value);
const writerKey = (writer: WriterRef) => JSON.stringify([writer.countryId, writer.writerId]);
function own(value: unknown, field: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("shape");
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (!descriptor) return undefined;
  if (!descriptor.enumerable || !("value" in descriptor)) throw Error("accessor");
  return descriptor.value;
}
function data(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Reflect.ownKeys(value).length !== fields.length) throw Error("fields");
  const result: Record<string, unknown> = Object.create(null);
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) throw Error("fields");
    result[field] = own(value, field);
  }
  return result;
}
function array(value: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw Error("array");
  const length: unknown = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > maximum
    || Reflect.ownKeys(value).length !== length + 1) throw Error("bounds");
  return Array.from({ length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) throw Error("accessor");
    return descriptor.value;
  });
}
function writerRef(value: unknown): WriterRef {
  const writer = data(value, ["kind", "countryId", "writerId"]);
  if (writer.kind !== "writer" || !entityId(writer.countryId) || !entityId(writer.writerId)) throw Error("writer");
  return Object.freeze({ kind: "writer", countryId: writer.countryId, writerId: writer.writerId });
}

/** Exact own data only. No copy, locale, answer key, callbacks or inferred IDs.
 * Structural parsing/checksum is not editorial, age or journey admission. */
export function parseBookyJourneyActivity(input: unknown): BookyJourneyActivitySpec | null {
  try {
    const item = data(input, ["schemaVersion", "id", "version", "type", "targetWork", "choices"]);
    if (item.schemaVersion !== 1 || !key(item.id) || typeof item.version !== "number" || !Number.isSafeInteger(item.version)
      || item.version < 1 || item.version > 1_000_000 || item.type !== "match-work-author") return null;
    const work = data(item.targetWork, ["kind", "countryId", "writerId", "workId"]);
    if (work.kind !== "work" || !entityId(work.countryId) || !entityId(work.writerId) || !entityId(work.workId)) return null;
    const choices = array(item.choices, 4).map(value => {
      const choice = data(value, ["id", "writer"]);
      if (!key(choice.id)) throw Error("choice");
      return Object.freeze({ id: choice.id, writer: writerRef(choice.writer) });
    });
    if (choices.length < 2 || new Set(choices.map(choice => choice.id)).size !== choices.length
      || new Set(choices.map(choice => writerKey(choice.writer))).size !== choices.length) return null;
    return Object.freeze({ schemaVersion: 1, id: item.id, version: item.version, type: "match-work-author",
      targetWork: Object.freeze({ kind: "work", countryId: work.countryId, writerId: work.writerId, workId: work.workId }),
      choices: Object.freeze(choices) });
  } catch { return null; }
}
export function getBookyJourneyActivityChecksum(input: unknown): string | null {
  const spec = parseBookyJourneyActivity(input);
  return spec ? contentRecordHash(spec) : null;
}

/** Checks one bounded semantic task against current, already authorized data.
 * It never grants review/rights/age/offline/route authority. The journey compiler
 * must perform those checks independently, and resolve again after any change.
 * Public bounds match the journey catalog: 256 countries, 50,000 books and
 * 50,000 writers in a referenced country. Unrelated display fields are ignored. */
export function resolveBookyJourneyActivity(input: unknown, publicData: BookyJourneyActivityPublicData): BookyJourneyActivityResolved | null {
  try {
    const spec = parseBookyJourneyActivity(input);
    if (!spec) return null;
    const countries = array(own(publicData, "publicCountries"), 256), books = array(own(publicData, "publicBooks"), 50_000);
    const publicWriter = (ref: WriterRef) => {
      const matches = countries.filter(country => own(country, "id") === ref.countryId);
      return matches.length === 1 && array(own(matches[0], "writers"), 50_000).filter(writer => own(writer, "id") === ref.writerId).length === 1;
    };
    if (!spec.choices.every(choice => publicWriter(choice.writer))) return null;
    const target = spec.targetWork, owner: WriterRef = { kind: "writer", countryId: target.countryId, writerId: target.writerId };
    const matches = books.filter(book => own(book, "id") === target.workId && own(book, "countryId") === target.countryId
      && own(book, "writerId") === target.writerId);
    if (matches.length !== 1 || !publicWriter(owner)) return null;
    const book = matches[0], status = own(own(book, "editorial"), "status");
    if (status !== "reviewed" && status !== "verified") return null;
    let author = owner, authorKind: "legacy-single" | "single" = "legacy-single";
    const authorship = own(book, "authorship");
    if (authorship !== undefined) {
      // The archive routing owner is not a factual author override. This first
      // single-answer task rejects anonymous, multi-author and disputed cases.
      if (own(authorship, "kind") !== "single") return null;
      const authors = array(own(authorship, "authors"), 1);
      if (authors.length !== 1) return null;
      const credit = authors[0], attribution = own(credit, "attribution");
      const countryId = own(credit, "countryId"), writerId = own(credit, "writerId");
      if (!entityId(countryId) || !entityId(writerId) || attribution !== undefined && attribution !== "credited") return null;
      author = Object.freeze({ kind: "writer", countryId, writerId }); authorKind = "single";
    }
    // Legacy fallback is documented by WorkAuthorship/selectBookAuthorRefs;
    // only the current reviewed/verified public book can supply that relation.
    if (!publicWriter(author)) return null;
    const correct = spec.choices.filter(choice => writerKey(choice.writer) === writerKey(author));
    if (correct.length !== 1) return null;
    const definitionChecksum = contentRecordHash(spec), correctChoiceId = correct[0].id;
    const semanticChecksum = contentRecordHash({ definitionChecksum, correctChoiceId, authorship: { kind: authorKind, author } });
    return Object.freeze({ spec, definitionChecksum, semanticChecksum, correctChoiceId });
  } catch { return null; }
}
