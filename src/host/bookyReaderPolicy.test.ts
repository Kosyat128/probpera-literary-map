import { describe, expect, it, vi } from "vitest";
import { BOOKY_READER_POLICY_MAX_LENGTH, createBookyReaderPolicy, decodeBookyReaderPolicy,
  parseBookyReaderPolicy, serializeBookyReaderPolicy } from "./bookyReaderPolicy";

const record = { schemaVersion: 1, audience: "adult", age: 35, readingLevel: "fluent",
  confirmedAt: "2026-09-23T00:00:00.000Z", revision: 1 } as const;

describe("explicit adult Booky reader policy", () => {
  it("copies and freezes exact explicit input and preserves it without ageing or inferred defaults", () => {
    const input = { age: 18, readingLevel: "plain" } as const;
    const policy = createBookyReaderPolicy(input, record.confirmedAt, 3);
    expect(policy).toEqual({ ...record, ...input, revision: 3 });
    expect(Object.isFrozen(policy)).toBe(true);
    expect(parseBookyReaderPolicy(serializeBookyReaderPolicy(policy))).toEqual(policy);
    expect(parseBookyReaderPolicy({ ...record, age: 120, readingLevel: "developing" })).not.toBeNull();
    expect(parseBookyReaderPolicy(record)).not.toBe(record);
    expect(decodeBookyReaderPolicy(null)).toEqual({ policy: null, error: null });
    expect(serializeBookyReaderPolicy(null)).toBeNull();
  });

  it.each([17, 121, 18.5, NaN, Infinity, "35", null, undefined])("rejects unconfirmed or nonadult age %s", age => {
    expect(parseBookyReaderPolicy({ ...record, age })).toBeNull();
    expect(createBookyReaderPolicy({ age, readingLevel: "fluent" }, record.confirmedAt, 1)).toBeNull();
  });

  it.each([
    { audience: "child" }, { schemaVersion: 0 }, { readingLevel: "independent" }, { readingLevel: null },
    { revision: 0 }, { revision: 1.5 }, { revision: Number.MAX_SAFE_INTEGER + 1 },
    { confirmedAt: "2026-02-30T00:00:00.000Z" }, { confirmedAt: "2026-09-23T00:00:00Z" },
    { confirmedAt: "2026-09-23T00:00:00.000+00:00" }, { confirmedAt: "2026-09-23T24:00:00.000Z" },
    { locale: "ru" }, { birthdate: "1991-09-23" },
  ])("rejects schema violations %j", change => {
    expect(parseBookyReaderPolicy({ ...record, ...change })).toBeNull();
  });

  it("distinguishes bounded unsupported future data from invalid data and absence", () => {
    expect(decodeBookyReaderPolicy('{"schemaVersion":2,"newField":true}')).toEqual({ policy: null, error: "unsupported" });
    for (const raw of ["", "null", "{}", "[]", "false", "not-json", " ".repeat(BOOKY_READER_POLICY_MAX_LENGTH + 1), record]) {
      expect(decodeBookyReaderPolicy(raw)).toEqual({ policy: null, error: "invalid" });
    }
  });

  it("never executes getters, toJSON or inherited policy data", () => {
    const getter = vi.fn(() => 35), toJSON = vi.fn(() => record);
    const accessor = { ...record }; Object.defineProperty(accessor, "age", { get: getter, enumerable: true });
    expect(parseBookyReaderPolicy(accessor)).toBeNull();
    expect(parseBookyReaderPolicy({ ...record, toJSON })).toBeNull();
    expect(parseBookyReaderPolicy(Object.create(record))).toBeNull();
    expect(parseBookyReaderPolicy({ ...record, [Symbol("hidden")]: 1 })).toBeNull();
    const hidden = { ...record }; Object.defineProperty(hidden, "age", { value: 35, enumerable: false });
    expect(parseBookyReaderPolicy(hidden)).toBeNull();
    expect(createBookyReaderPolicy({ readingLevel: "plain", get age() { return getter(); } }, record.confirmedAt, 1)).toBeNull();
    expect(createBookyReaderPolicy({ age: 35, readingLevel: "plain", locale: "ru" }, record.confirmedAt, 1)).toBeNull();
    expect(getter).not.toHaveBeenCalled(); expect(toJSON).not.toHaveBeenCalled();
  });
});
