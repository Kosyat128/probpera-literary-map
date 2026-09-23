import { describe, expect, it, vi } from "vitest";
import { contentRecordHash } from "../planet/contentExportHash";
import type { BookArchiveEntry, Country } from "../planet/types";
import { getBookyJourneyActivityChecksum, parseBookyJourneyActivity, resolveBookyJourneyActivity,
  type BookyJourneyActivityPublicData, type BookyJourneyActivitySpec } from "./bookyJourneyActivity";

function fixture() {
  // Synthetic entities only. No real task content or editorial receipt is made.
  const countries: Country[] = [{ id: "test-country", name: "Synthetic country", writers: [
    { id: "archive-owner" }, { id: "actual-author" }, { id: "another-writer" }, { id: "fourth-writer" },
  ] }];
  const book: BookArchiveEntry = { id: "test-work", title: "Synthetic work", countryId: countries[0].id,
    countryName: countries[0].name, writerId: "archive-owner", writerName: "Synthetic owner",
    writer: countries[0].writers[0], country: countries[0], editorial: { status: "reviewed" } };
  const spec: BookyJourneyActivitySpec = { schemaVersion: 1, id: "test-work-author", version: 1, type: "match-work-author",
    targetWork: { kind: "work", countryId: countries[0].id, writerId: book.writerId, workId: book.id },
    choices: ["archive-owner", "actual-author"].map((writerId, index) => ({ id: `choice-${index}`,
      writer: { kind: "writer", countryId: countries[0].id, writerId } })) };
  const data: BookyJourneyActivityPublicData = { publicCountries: countries, publicBooks: [book] };
  const resolve = (candidate: unknown = spec, override: Partial<BookyJourneyActivityPublicData> = {}) =>
    resolveBookyJourneyActivity(candidate, { ...data, ...override });
  return { spec, countries, book, data, resolve };
}

describe("Booky match-work-author semantic boundary", () => {
  it("snapshots exact bounded own data and binds the documented reviewed legacy author relation", () => {
    const f = fixture(), resolved = f.resolve()!;
    expect(resolved.correctChoiceId).toBe("choice-0");
    expect(resolved.definitionChecksum).toBe(getBookyJourneyActivityChecksum(f.spec));
    expect(resolved.semanticChecksum).toBe(contentRecordHash({ definitionChecksum: resolved.definitionChecksum,
      correctChoiceId: "choice-0", authorship: { kind: "legacy-single", author: f.spec.choices[0].writer } }));
    for (const value of [resolved, resolved.spec, resolved.spec.targetWork, resolved.spec.choices, resolved.spec.choices[0],
      resolved.spec.choices[0].writer]) expect(Object.isFrozen(value)).toBe(true);
    Reflect.set(f.spec.targetWork, "workId", "changed");
    expect(resolved.spec.targetWork.workId).toBe("test-work");
    expect(Object.keys(resolved).sort()).toEqual(["correctChoiceId", "definitionChecksum", "semanticChecksum", "spec"]);
  });

  it("honors factual single-author attribution instead of the archive routing owner", () => {
    const f = fixture(), before = f.resolve()!;
    f.book.authorship = { kind: "single", authors: [{ countryId: "test-country", writerId: "actual-author", attribution: "credited" }] };
    const after = f.resolve()!;
    expect(after.correctChoiceId).toBe("choice-1");
    expect(after.definitionChecksum).toBe(before.definitionChecksum);
    expect(after.semanticChecksum).not.toBe(before.semanticChecksum);
    f.book.authorship.authors[0].writerId = "archive-owner";
    const changed = f.resolve()!;
    expect(changed.correctChoiceId).toBe("choice-0");
    expect(changed.definitionChecksum).toBe(after.definitionChecksum);
    expect(changed.semanticChecksum).not.toBe(after.semanticChecksum);
    expect(changed.semanticChecksum).not.toBe(before.semanticChecksum);
  });

  it("rejects authored answer keys, unknown schemas/types/fields and invalid identifiers", () => {
    const f = fixture();
    expect(f.resolve({ ...f.spec, correctChoiceId: "choice-1" })).toBeNull();
    for (const value of [null, {}, { ...f.spec, correctChoiceId: "choice-1" }, { ...f.spec, locale: "en" },
      { ...f.spec, schemaVersion: 2 }, { ...f.spec, version: 0 }, { ...f.spec, version: 1.5 },
      { ...f.spec, type: "free-response" }, { ...f.spec, id: "invalid id" },
      { ...f.spec, targetWork: { ...f.spec.targetWork, writerId: "" } },
      { ...f.spec, choices: f.spec.choices.map(choice => ({ ...choice, correct: true })) },
    ]) { expect(parseBookyJourneyActivity(value)).toBeNull(); expect(getBookyJourneyActivityChecksum(value)).toBeNull(); }
  });

  it("requires two to four unique choice IDs and canonical writer references, including the one correct author", () => {
    const f = fixture(), extra = ["another-writer", "fourth-writer"].map((writerId, index) => ({ id: `extra-${index}`,
      writer: { kind: "writer" as const, countryId: "test-country", writerId } }));
    expect(f.resolve({ ...f.spec, choices: [...f.spec.choices, ...extra] })?.correctChoiceId).toBe("choice-0");
    for (const choices of [[], f.spec.choices.slice(0, 1), [...f.spec.choices, ...extra, extra[0]],
      [f.spec.choices[0], { ...f.spec.choices[1], id: "choice-0" }],
      [f.spec.choices[0], { ...f.spec.choices[0], id: "different-choice-id" }],
      [f.spec.choices[1], ...extra],
    ]) expect(f.resolve({ ...f.spec, choices })).toBeNull();
  });

  it("requires one exact current reviewed work tuple and public routing owner", () => {
    const f = fixture();
    for (const publicBooks of [[], [f.book, f.book], [{ ...f.book, countryId: "different-country" }],
      [{ ...f.book, writerId: "actual-author" }], [{ ...f.book, editorial: { status: "draft" as const } }],
      [{ ...f.book, editorial: undefined }],
    ]) expect(f.resolve(f.spec, { publicBooks })).toBeNull();
    expect(f.resolve(f.spec, { publicBooks: [{ ...f.book, editorial: { status: "verified" } }] })).not.toBeNull();
    f.book.authorship = { kind: "single", authors: [{ countryId: "test-country", writerId: "actual-author" }] };
    expect(f.resolve(f.spec, { publicCountries: [{ ...f.countries[0], writers: [{ id: "actual-author" }] }] })).toBeNull();
  });

  it("requires every option and factual author to remain uniquely public and policy eligible", () => {
    const f = fixture();
    for (const publicCountries of [[], [f.countries[0], f.countries[0]],
      [{ ...f.countries[0], writers: [{ id: "archive-owner" }] }],
      [{ ...f.countries[0], writers: [...f.countries[0].writers, { id: "actual-author" }] }],
    ]) expect(f.resolve(f.spec, { publicCountries })).toBeNull();
    const wrongCountry = { ...f.spec, choices: [f.spec.choices[0], { ...f.spec.choices[1], writer: {
      ...f.spec.choices[1].writer, countryId: "quarantined-country" } }] };
    expect(f.resolve(wrongCountry)).toBeNull();
    f.book.authorship = { kind: "single", authors: [{ countryId: "test-country", writerId: "revoked-author" }] };
    expect(f.resolve()).toBeNull();
  });

  it("denies ambiguous, missing, anonymous and disputed factual credit", () => {
    const f = fixture(), credit = { countryId: "test-country", writerId: "actual-author" };
    for (const kind of ["multiple", "anonymous", "collective", "traditional", "disputed"] as const) {
      f.book.authorship = { kind, authors: [credit] }; expect(f.resolve()).toBeNull();
    }
    for (const authors of [[], [credit, credit], [{ writerId: "actual-author" }], [{ countryId: "test-country" }],
      [{ ...credit, attribution: "attributed" as const }], [{ ...credit, attribution: "disputed" as const }],
    ]) { f.book.authorship = { kind: "single", authors }; expect(f.resolve()).toBeNull(); }
    f.book.authorship = { kind: "single", authors: [credit] };
    expect(f.resolve()?.correctChoiceId).toBe("choice-1"); // Canonical omission of the marker means credited, not a missing author.
  });

  it("rejects accessors and malformed arrays without reading unrelated embedded display data", () => {
    const f = fixture(), getter = vi.fn(() => { throw Error("must not execute"); });
    const poisoned = Object.defineProperty({ ...f.spec }, "choices", { enumerable: true, get: getter });
    expect(f.resolve(poisoned)).toBeNull();
    const sparse = [f.spec.choices[0], , f.spec.choices[1]];
    expect(f.resolve({ ...f.spec, choices: sparse })).toBeNull();
    const book = Object.defineProperty({ ...f.book }, "authorship", { enumerable: true, get: getter });
    expect(f.resolve(f.spec, { publicBooks: [book] })).toBeNull();
    const embedded = Object.defineProperty({ ...f.book }, "writer", { enumerable: true, get: getter });
    expect(f.resolve(f.spec, { publicBooks: [embedded] })).not.toBeNull();
    const writer = Object.defineProperty({ id: "actual-author" }, "id", { enumerable: true, get: getter });
    expect(f.resolve(f.spec, { publicCountries: [{ ...f.countries[0], writers: [f.countries[0].writers[0], writer] }] })).toBeNull();
    expect(f.resolve(f.spec, { publicCountries: Array.from({ length: 257 }, () => f.countries[0]) })).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });

  it("hashes semantic definition changes without copying locale labels or treating a hash as authority", () => {
    const f = fixture(), original = getBookyJourneyActivityChecksum(f.spec)!, semantic = f.resolve()!.semanticChecksum;
    for (const spec of [{ ...f.spec, version: 2 }, { ...f.spec, choices: [...f.spec.choices].reverse() },
      { ...f.spec, targetWork: { ...f.spec.targetWork, workId: "another-work" } },
    ]) expect(getBookyJourneyActivityChecksum(spec)).not.toBe(original);
    expect(getBookyJourneyActivityChecksum({ choices: f.spec.choices, targetWork: f.spec.targetWork,
      type: f.spec.type, version: 1, id: f.spec.id, schemaVersion: 1 })).toBe(original);
    f.countries[0].name = "Different display label"; f.countries[0].writers[0].name = "Other localized label";
    expect(f.resolve()?.definitionChecksum).toBe(original);
    expect(f.resolve()?.semanticChecksum).toBe(semantic);
    expect(f.resolve(f.spec, { publicBooks: [] })).toBeNull();
  });
});
