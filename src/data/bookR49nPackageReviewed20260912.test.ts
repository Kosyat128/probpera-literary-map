import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import attestation from "../../scripts/governance/book-r49n-package-reviewed-20260912.json";
import canonRegistry from "../../data/book-canon-source-registry.json";
import { buildBookArchive, resolveBookArchivePublicTarget } from "./bookArchive";
import { bookEvidenceV2Issues } from "./bookEvidence";
import { isPublicBook } from "./bookQuality";
import { bookArchiveCountries, countries } from "./countries";
import { bookR49nRetainedDraftRecordKeys } from "./countries/bookR49nRetainedDrafts20260912";

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)])) : value;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const objectHash = (value: unknown) => sha(JSON.stringify(canonical(value)));
const aggregate = (pairs: [string, string][]) => sha(
  pairs.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, hash]) => `${key}\0${hash}\n`).join("")
);
const archive = buildBookArchive(bookArchiveCountries);
const keyOf = (book: { countryId: string; writerId: string; id: string }) =>
  `${book.countryId}:${book.writerId}:${book.id}`;
const records = archive.map(({ country: _country, writer: _writer, ...book }) => book);
const byKey = new Map(records.map(book => [keyOf(book), book]));
const runtime = attestation.runtime;

describe("complete R49N reviewed catalog packet", () => {
  it("preserves all 46 previously eligible records and admits exactly 23 reviewed additions", () => {
    const expected = [...runtime.beforeReadyKeys, ...runtime.newReadyKeys].sort();
    expect(runtime.beforeReadyKeys).toHaveLength(46);
    expect(runtime.newReadyKeys).toHaveLength(23);
    expect(new Set(expected).size).toBe(69);
    expect(records.filter(isPublicBook).map(keyOf).sort()).toEqual(expected);
    for (const key of expected) {
      const book = byKey.get(key)!;
      expect(book, key).toBeDefined();
      expect(bookEvidenceV2Issues(book, {
        canonRegistry, recordKey: key, originCountryIds: [book.countryId],
        descriptionSha256ByLocale: {
          ru: sha(book.translations?.ru?.description || ""),
          en: sha(book.translations?.en?.description || ""),
        },
      }), key).toEqual([]);
    }
  });

  it("adds two exact book keys and preserves every record outside the reviewed and retained-text sets", () => {
    expect(records).toHaveLength(runtime.canonicalCount);
    const keys = records.map(keyOf).sort();
    expect(new Set(keys).size).toBe(9763);
    expect(sha(keys.join("\n") + "\n")).toBe(runtime.canonicalKeysSha256);
    expect(sha(keys.filter(key => !runtime.addedRecordKeys.includes(key)).join("\n") + "\n"))
      .toBe(runtime.beforeCanonicalKeysSha256);
    const targets = new Set([...runtime.newReadyKeys, ...bookR49nRetainedDraftRecordKeys]);
    const nonTargets = records.filter(book => !targets.has(keyOf(book)));
    expect(nonTargets).toHaveLength(8246);
    expect(aggregate(nonTargets.map(book => [keyOf(book), objectHash(book)])))
      .toBe(runtime.nonTargetRecordsSha256);
  });

  it("retains identities, covers, editions and other protected fields of all 22 existing targets", () => {
    const fields = new Set(runtime.protectedTargetFields);
    const targets = runtime.protectedExistingTargetKeys.map(key => byKey.get(key)!);
    expect(targets).toHaveLength(22);
    expect(aggregate(targets.map(book => [
      keyOf(book), objectHash(Object.fromEntries(Object.entries(book)
        .filter(([field, value]) => fields.has(field) && value !== undefined))),
    ]))).toBe(runtime.protectedTargetFieldsSha256);
  });

  it("pins the recovered Stowe Work and restricts its minimal writer to the book corpus", () => {
    const added = runtime.addedRecordKeys.filter(key => runtime.newReadyKeys.includes(key))
      .map(key => byKey.get(key)!);
    expect(added).toHaveLength(1);
    expect(aggregate(added.map(book => [keyOf(book), objectHash(book)])))
      .toBe(runtime.addedRecordsSha256);
    const writerScope = runtime.catalogOnlyWriter;
    const writer = bookArchiveCountries.find(country => country.id === writerScope.countryId)
      ?.writers.find(writer => writer.id === writerScope.writerId);
    expect(writer).toBeDefined();
    expect(objectHash(writer)).toBe(writerScope.sha256);
    expect(writer?.bio).toBeUndefined();
    expect(countries.some(country => country.id === writerScope.countryId &&
      country.writers.some(writer => writer.id === writerScope.writerId))).toBe(false);
    expect(resolveBookArchivePublicTarget(countries, added[0])).toBeNull();
    expect(isPublicBook(added[0])).toBe(true);
  });
});
