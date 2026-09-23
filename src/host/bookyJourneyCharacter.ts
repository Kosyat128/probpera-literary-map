import { contentRecordHash } from "../planet/contentExportHash";
import { parseBookyDossierCharacterReference, resolveBookyDossierCharacter,
  type BookyDossierCharacterHostSnapshot, type BookyDossierCharacterProjection,
  type BookyDossierCharacterReference } from "./bookyDossierCharacter";

export type BookyJourneyCharacterBinding<Locale extends "ru" | "en" = "ru" | "en"> = Readonly<{
  locale: Locale;
  dossierVersion: string;
  sectionId: string;
  blockId: string;
  itemId: string;
  readingMode: "BEFORE_READING";
  projectionChecksum: string;
  /** Exact payload reference, never an editorial review receipt. */
  dialogue: Readonly<{ id: string; version: number; contentChecksum: string }>;
}>;
export type BookyJourneyCharacterSpec = Readonly<{
  schemaVersion: 1;
  id: string;
  version: number;
  /** One canonical tuple shared by both language bindings. */
  work: BookyDossierCharacterReference["work"];
  bindings: readonly [BookyJourneyCharacterBinding<"ru">, BookyJourneyCharacterBinding<"en">];
}>;
export type BookyJourneyCharacterRequest = Readonly<{
  spec: BookyJourneyCharacterSpec; locale: "ru" | "en"; hostRevision: number;
}>;
export type BookyJourneyCharacterResolved = Readonly<{
  spec: BookyJourneyCharacterSpec;
  /** Binds the entire bilingual contract, not the lease, cache or UI token. */
  semanticChecksum: string;
  projection: BookyDossierCharacterProjection;
}>;

const key = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9._:-]{0,95}$/u.test(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const version = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value)
  && value >= 1 && value <= 1_000_000;
function data(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))
    || Reflect.ownKeys(input).length !== fields.length) throw Error("shape");
  const result: Record<string, unknown> = Object.create(null);
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, field);
    if (!descriptor?.enumerable || !("value" in descriptor)) throw Error("own-data");
    result[field] = descriptor.value;
  }
  return result;
}
function pair(input: unknown): readonly [unknown, unknown] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype
    || Object.getOwnPropertyDescriptor(input, "length")?.value !== 2 || Reflect.ownKeys(input).length !== 3) throw Error("pair");
  const first = Object.getOwnPropertyDescriptor(input, "0"), second = Object.getOwnPropertyDescriptor(input, "1");
  if (!first?.enumerable || !("value" in first) || !second?.enumerable || !("value" in second)) throw Error("own-data");
  return [first.value, second.value];
}
function binding<Locale extends "ru" | "en">(input: unknown, locale: Locale, work: unknown) {
  const value = data(input, ["locale", "dossierVersion", "sectionId", "blockId", "itemId", "readingMode", "projectionChecksum", "dialogue"]);
  const reference = parseBookyDossierCharacterReference({ work, locale: value.locale, dossierVersion: value.dossierVersion,
    sectionId: value.sectionId, blockId: value.blockId, itemId: value.itemId });
  const dialogue = data(value.dialogue, ["id", "version", "contentChecksum"]);
  if (!reference || reference.locale !== locale || value.readingMode !== "BEFORE_READING" || !hash(value.projectionChecksum)
    || !key(dialogue.id) || !version(dialogue.version) || !hash(dialogue.contentChecksum)) throw Error("binding");
  const result: BookyJourneyCharacterBinding<Locale> = Object.freeze({ locale, dossierVersion: reference.dossierVersion,
    sectionId: reference.sectionId, blockId: reference.blockId, itemId: reference.itemId, readingMode: "BEFORE_READING",
    projectionChecksum: value.projectionChecksum,
    dialogue: Object.freeze({ id: dialogue.id, version: dialogue.version, contentChecksum: dialogue.contentChecksum }) });
  return { binding: result, work: reference.work };
}

/** Finite own-data tree: exactly two locales, IDs at most 96 characters, work
 * tuple components at most 200, versions 1..1,000,000 and lowercase SHA-256.
 * No prose, assets, source bodies, lease or claimed approval is accepted. */
export function parseBookyJourneyCharacter(input: unknown): BookyJourneyCharacterSpec | null {
  try {
    const value = data(input, ["schemaVersion", "id", "version", "work", "bindings"]);
    if (value.schemaVersion !== 1 || !key(value.id) || !version(value.version)) return null;
    const [ruInput, enInput] = pair(value.bindings);
    const ru = binding(ruInput, "ru", value.work), en = binding(enInput, "en", ru.work);
    return Object.freeze({ schemaVersion: 1, id: value.id, version: value.version, work: ru.work,
      bindings: Object.freeze([ru.binding, en.binding] as const) });
  } catch { return null; }
}

/** Structural identity only. A future route compiler must independently admit
 * the journey, dialogue and profile; neither this checksum nor parsing does so. */
export function getBookyJourneyCharacterChecksum(input: unknown): string | null {
  const spec = parseBookyJourneyCharacter(input);
  return spec ? contentRecordHash(spec) : null;
}

/** Compose the static contract with the existing current published-data reader.
 * The other locale is fingerprint-bound, not asserted to be currently loaded.
 * This returns no navigation, visible-item receipt, acknowledgement or review. */
export function resolveBookyJourneyCharacter(input: unknown,
  readCurrentHost: () => BookyDossierCharacterHostSnapshot | null,
  readNow: () => number = Date.now): BookyJourneyCharacterResolved | null {
  try {
    const request = data(input, ["spec", "locale", "hostRevision"]), spec = parseBookyJourneyCharacter(request.spec);
    if (!spec || request.locale !== "ru" && request.locale !== "en" || typeof request.hostRevision !== "number"
      || !Number.isSafeInteger(request.hostRevision) || request.hostRevision < 0) return null;
    const selected = spec.bindings[request.locale === "ru" ? 0 : 1];
    const reference = parseBookyDossierCharacterReference({ work: spec.work, locale: selected.locale,
      dossierVersion: selected.dossierVersion, sectionId: selected.sectionId, blockId: selected.blockId, itemId: selected.itemId });
    if (!reference) return null;
    const semanticChecksum = contentRecordHash(spec);
    const projection = resolveBookyDossierCharacter({ reference, expectedChecksum: selected.projectionChecksum,
      hostRevision: request.hostRevision }, readCurrentHost, readNow);
    return projection?.readingMode === selected.readingMode ? Object.freeze({ spec, semanticChecksum, projection }) : null;
  } catch { return null; }
}
