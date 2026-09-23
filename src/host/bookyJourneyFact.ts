import { contentRecordHash } from "../planet/contentExportHash";
import type { ContentEntityRef } from "../planet/contentExportTypes";

export type BookyJourneyFactDialogueBinding<Locale extends "ru" | "en" = "ru" | "en"> = Readonly<{
  locale: Locale;
  id: string;
  version: number;
  contentChecksum: string;
}>;
export type BookyJourneyFactSpec = Readonly<{
  schemaVersion: 1;
  id: string;
  version: number;
  /** Canonical order is RU then EN. Each payload still needs independent review. */
  dialogues: readonly [BookyJourneyFactDialogueBinding<"ru">, BookyJourneyFactDialogueBinding<"en">];
}>;
export type BookyJourneyFactResolved = Readonly<{
  spec: BookyJourneyFactSpec;
  /** Binds both exact payloads and the canonical subject/screen, not approval. */
  semanticChecksum: string;
}>;

const key = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9._:-]{0,95}$/.test(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const version = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value)
  && value >= 1 && value <= 1_000_000;
const entityId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200
  && !/[\s\u0000-\u001f\u007f]/u.test(value);

function data(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== fields.length) throw Error("shape");
  const output: Record<string, unknown> = Object.create(null);
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor?.enumerable || !("value" in descriptor)) throw Error("own-data");
    output[field] = descriptor.value;
  }
  return output;
}
function pair(value: unknown): readonly [unknown, unknown] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || Object.getOwnPropertyDescriptor(value, "length")?.value !== 2 || Reflect.ownKeys(value).length !== 3) throw Error("pair");
  const first = Object.getOwnPropertyDescriptor(value, "0"), second = Object.getOwnPropertyDescriptor(value, "1");
  if (!first?.enumerable || !("value" in first) || !second?.enumerable || !("value" in second)) throw Error("own-data");
  return [first.value, second.value];
}
function binding<Locale extends "ru" | "en">(input: unknown, locale: Locale): BookyJourneyFactDialogueBinding<Locale> {
  const value = data(input, ["locale", "id", "version", "contentChecksum"]);
  if (value.locale !== locale || !key(value.id) || !version(value.version) || !hash(value.contentChecksum)) throw Error("binding");
  return Object.freeze({ locale, id: value.id, version: value.version, contentChecksum: value.contentChecksum });
}

/** A bounded own-data snapshot. This contract contains no prose, source URLs or
 * fabricated approvals. Dialogue payload hashes bind those fields separately.
 * Reordering locale entries is rejected, never silently normalized. */
export function parseBookyJourneyFact(input: unknown): BookyJourneyFactSpec | null {
  try {
    const value = data(input, ["schemaVersion", "id", "version", "dialogues"]);
    if (value.schemaVersion !== 1 || !key(value.id) || !version(value.version)) return null;
    const [ru, en] = pair(value.dialogues);
    return Object.freeze({ schemaVersion: 1, id: value.id, version: value.version,
      dialogues: Object.freeze([binding(ru, "ru"), binding(en, "en")] as const) });
  } catch { return null; }
}

function anchor(input: unknown, screen: unknown): Readonly<ContentEntityRef> {
  if (!input || typeof input !== "object") throw Error("anchor");
  const descriptor = Object.getOwnPropertyDescriptor(input, "kind");
  if (!descriptor?.enumerable || !("value" in descriptor)) throw Error("own-data");
  const kind: unknown = descriptor.value;
  const fields = kind === "country" ? ["kind", "countryId"] : kind === "writer" ? ["kind", "countryId", "writerId"]
    : kind === "work" ? ["kind", "countryId", "writerId", "workId"] : null;
  if (!fields) throw Error("kind");
  const value = data(input, fields);
  if (!entityId(value.countryId) || screen !== (kind === "work" ? "collection" : "globe")) throw Error("anchor");
  if (kind === "country") return Object.freeze({ kind, countryId: value.countryId });
  if (!entityId(value.writerId)) throw Error("writer");
  if (kind === "writer") return Object.freeze({ kind, countryId: value.countryId, writerId: value.writerId });
  if (!entityId(value.workId)) throw Error("work");
  return Object.freeze({ kind: "work", countryId: value.countryId, writerId: value.writerId, workId: value.workId });
}

/** Structural identity only. The compiler must independently admit the anchor,
 * current factual dialogue, both bindings and journey. Its dialogue context
 * excludes this table/checksum to avoid circular payload hashes. */
export function getBookyJourneyFactChecksum(input: unknown, entity: ContentEntityRef, screen: "globe" | "collection"): string | null {
  try {
    const spec = parseBookyJourneyFact(input);
    return spec ? contentRecordHash({ spec, entity: anchor(entity, screen), screen }) : null;
  } catch { return null; }
}
