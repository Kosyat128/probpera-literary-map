import { describe, expect, it, vi } from "vitest";
import { contentRecordHash } from "../planet/contentExportHash";
import type { ContentEntityRef } from "../planet/contentExportTypes";
import { getBookyJourneyFactChecksum, parseBookyJourneyFact, type BookyJourneyFactSpec } from "./bookyJourneyFact";

const country: ContentEntityRef = { kind: "country", countryId: "test-country" };
const writer: ContentEntityRef = { kind: "writer", countryId: "test-country", writerId: "test-writer" };
const work: ContentEntityRef = { kind: "work", countryId: "test-country", writerId: "test-writer", workId: "test-work" };
function fixture(): BookyJourneyFactSpec {
  return { schemaVersion: 1, id: "test.fact", version: 1, dialogues: [
    { locale: "ru", id: "test.fact.copy", version: 1, contentChecksum: "a".repeat(64) },
    { locale: "en", id: "test.fact.copy", version: 1, contentChecksum: "b".repeat(64) },
  ] };
}

describe("Booky sourced-fact semantic contract", () => {
  it("snapshots an exact immutable RU/EN binding without retaining caller references", () => {
    const input = fixture(), parsed = parseBookyJourneyFact(input)!;
    expect(parsed).toEqual(input); expect(parsed).not.toBe(input);
    for (const value of [parsed, parsed.dialogues, ...parsed.dialogues]) expect(Object.isFrozen(value)).toBe(true);
    const checksum = getBookyJourneyFactChecksum(parsed, writer, "globe");
    expect(checksum).toBe(contentRecordHash({ spec: parsed, entity: writer, screen: "globe" }));
    Reflect.set(input.dialogues[0], "contentChecksum", "c".repeat(64));
    Reflect.set(input, "id", "changed");
    expect(parsed.id).toBe("test.fact"); expect(parsed.dialogues[0].contentChecksum).toBe("a".repeat(64));
    expect(getBookyJourneyFactChecksum(parsed, writer, "globe")).toBe(checksum);
  });

  it("binds changes in either exact localized payload, dialogue identity and fact revision", () => {
    const input = fixture(), checksum = getBookyJourneyFactChecksum(input, writer, "globe");
    for (const locale of ["ru", "en"]) for (const patch of [
      { contentChecksum: "c".repeat(64) }, { id: "test.other-fact" }, { version: 2 },
    ]) {
      const changed = { ...input, dialogues: input.dialogues.map(binding => binding.locale === locale ? { ...binding, ...patch } : binding) };
      expect(getBookyJourneyFactChecksum(changed, writer, "globe")).toMatch(/^[a-f0-9]{64}$/u);
      expect(getBookyJourneyFactChecksum(changed, writer, "globe")).not.toBe(checksum);
    }
    for (const patch of [{ id: "other-fact" }, { version: 2 }]) {
      expect(getBookyJourneyFactChecksum({ ...input, ...patch }, writer, "globe")).not.toBe(checksum);
    }
  });

  it("requires exactly two distinct locale bindings in canonical RU then EN order", () => {
    const input = fixture(), [ru, en] = input.dialogues;
    for (const dialogues of [[], [ru], [en, ru], [ru, ru], [en, en], [ru, en, en],
      [ru, { ...en, locale: "fr" }], [ru, { ...en, locale: "RU" }], [ru, , en]]) {
      expect(parseBookyJourneyFact({ ...input, dialogues })).toBeNull();
    }
    // A shared stable dialogue ID is valid: locale is part of registry identity.
    expect(parseBookyJourneyFact(input)?.dialogues.map(binding => binding.locale)).toEqual(["ru", "en"]);
  });

  it("binds only exact canonical country, writer and work tuples on their existing screens", () => {
    const input = fixture();
    const checksums = [[country, "globe"], [writer, "globe"], [work, "collection"]] as const;
    const values = checksums.map(([entity, screen]) => getBookyJourneyFactChecksum(input, entity, screen));
    for (const value of values) expect(value).toMatch(/^[a-f0-9]{64}$/u);
    expect(new Set(values).size).toBe(3);
    for (const [entity, screen] of [[country, "collection"], [writer, "collection"], [work, "globe"], [work, "menu"],
      [null, "globe"], [{ ...country, writerId: "extra" }, "globe"], [{ kind: "place", countryId: "test-country" }, "globe"],
      [{ ...writer, writerId: "" }, "globe"], [{ ...work, workId: "with space" }, "collection"],
      [{ ...country, countryId: "x".repeat(201) }, "globe"]] as const) {
      expect(getBookyJourneyFactChecksum(input, entity as ContentEntityRef, screen as "globe" | "collection")).toBeNull();
    }
    expect(getBookyJourneyFactChecksum(input, { ...work, workId: "other-work" }, "collection")).not.toBe(values[2]);
    expect(getBookyJourneyFactChecksum(input, { ...writer, countryId: "other-country" }, "globe")).not.toBe(values[1]);
  });

  it("rejects unbounded identities, future schemas, invalid versions and extra authored authority", () => {
    const input = fixture();
    for (const patch of [{ schemaVersion: 2 }, { id: "bad id" }, { id: "a".repeat(97) },
      { version: 0 }, { version: 1.5 }, { version: NaN }, { version: Infinity }, { version: 1_000_001 },
      { semanticChecksum: "c".repeat(64) }, { payload: {} }, { factualSources: [] }, { approved: true }]) {
      expect(parseBookyJourneyFact({ ...input, ...patch })).toBeNull();
      expect(getBookyJourneyFactChecksum({ ...input, ...patch }, country, "globe")).toBeNull();
    }
    for (const patch of [{ contentChecksum: "A".repeat(64) }, { contentChecksum: "a".repeat(65) },
      { version: 0 }, { id: "" }, { id: "a".repeat(97) }, { sourceUrl: "https://example.org/test" }]) {
      expect(parseBookyJourneyFact({ ...input, dialogues: [{ ...input.dialogues[0], ...patch }, input.dialogues[1]] })).toBeNull();
    }
  });

  it("rejects accessors, sparse and exotic objects without invoking supplied code", () => {
    const input = fixture(), getter = vi.fn(() => { throw Error("must not execute"); });
    const accessor = Object.defineProperty({ ...input }, "dialogues", { enumerable: true, get: getter });
    const localized = Object.defineProperty({ ...input.dialogues[0] }, "id", { enumerable: true, get: getter });
    const array = Object.defineProperty([...input.dialogues], "0", { enumerable: true, get: getter });
    const hidden = Object.defineProperty({ ...input }, "id", { enumerable: false, value: input.id });
    class ExoticArray extends Array<unknown> {}
    for (const value of [accessor, hidden, { ...input, dialogues: [localized, input.dialogues[1]] },
      { ...input, dialogues: array }, { ...input, dialogues: new ExoticArray(...input.dialogues) },
      { ...input, dialogues: new Array(2) }, { ...input, [Symbol("extra")]: true },
      { ...input, toJSON: getter }, Object.create(input), new Date(), null]) expect(parseBookyJourneyFact(value)).toBeNull();
    for (const field of ["kind", "countryId"]) {
      const poisoned = Object.defineProperty({ ...country }, field, { enumerable: true, get: getter });
      expect(getBookyJourneyFactChecksum(input, poisoned, "globe")).toBeNull();
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("ignores property order while providing structural identity without inventing admission", () => {
    const input = fixture(), checksum = getBookyJourneyFactChecksum(input, country, "globe");
    const reordered = Object.fromEntries(Object.entries(input).reverse());
    expect(getBookyJourneyFactChecksum(reordered, country, "globe")).toBe(checksum);
    expect(getBookyJourneyFactChecksum(Object.assign(Object.create(null), input), country, "globe")).toBe(checksum);
    const parsed = parseBookyJourneyFact(input)!;
    expect(Object.keys(parsed).sort()).toEqual(["dialogues", "id", "schemaVersion", "version"]);
    expect(Object.keys(parsed.dialogues[0]).sort()).toEqual(["contentChecksum", "id", "locale", "version"]);
    // No public inventory or review receipt was supplied to this pure function.
    expect(getBookyJourneyFactChecksum(input, { kind: "country", countryId: "not-an-admitted-country" }, "globe")).toMatch(/^[a-f0-9]{64}$/u);
  });
});
