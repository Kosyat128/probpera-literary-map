import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import type { ContentEntityRef, ContentField, ContentLocale } from "./contentExportTypes";

export function contentTextHash(text: string): string {
  return bytesToHex(sha256(utf8ToBytes(text)));
}

/** Field IDs derive from existing entity IDs; they are not new entity keys. */
export function contentUnitId(entity: ContentEntityRef, field: ContentField, locale: ContentLocale): string {
  return JSON.stringify([entity.kind, entity.countryId,
    entity.kind === "country" ? null : entity.writerId,
    entity.kind === "work" ? entity.workId : null, field, locale]);
}

/** Stable acyclic JSON for derived snapshots; no normalization of text bytes. */
export function contentRecordHash(value: unknown): string {
  const ancestors = new Set<object>();
  let visited = 0;
  function encode(item: unknown, depth: number): string {
    if (++visited > 2_000_000 || depth > 32) throw new Error("Content snapshot exceeds JSON bounds");
    if (item === null || typeof item === "string" || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number" && Number.isFinite(item)) return JSON.stringify(item);
    if (!item || typeof item !== "object" || ancestors.has(item)) throw new Error("Content snapshot must be acyclic JSON");
    ancestors.add(item);
    try {
      if (Array.isArray(item)) return "[" + Array.from(item, value => encode(value, depth + 1)).join(",") + "]";
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new Error("Content snapshot must contain plain records");
      const record = item as Record<string, unknown>;
      return "{" + Object.keys(record).filter(key => record[key] !== undefined).sort()
        .map(key => JSON.stringify(key) + ":" + encode(record[key], depth + 1)).join(",") + "}";
    } finally { ancestors.delete(item); }
  }
  return contentTextHash(encode(value, 0));
}
