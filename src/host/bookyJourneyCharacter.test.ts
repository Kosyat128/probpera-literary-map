import { beforeAll, describe, expect, it, vi } from "vitest";
import { createBookDossierGraphFixture } from "../../scripts/lib/book-dossier-graph-fixture";
import type { BookDossierDocumentV2 } from "../books/bookDossierDocument";
import { contentRecordHash } from "../planet/contentExportHash";
import type { BookArchiveEntry, Country } from "../planet/types";
import { inspectBookyDossierCharacter, parseBookyDossierCharacterReference, resolveBookyDossierCharacter,
  type BookyDossierCharacterHostSnapshot, type BookyDossierCharacterReference } from "./bookyDossierCharacter";
import { getBookyJourneyCharacterChecksum, parseBookyJourneyCharacter, resolveBookyJourneyCharacter,
  type BookyJourneyCharacterSpec } from "./bookyJourneyCharacter";

const now = Date.parse("2026-09-23T10:00:00.000Z");
const clone = <T,>(input: T): T => JSON.parse(JSON.stringify(input));
const work = { kind: "work" as const, countryId: "test", writerId: "writer", workId: "book" };
const countries = [{ id: "test", writers: [{ id: "writer" }] }] as unknown as Country[];
const books = [{ id: "book", countryId: "test", writerId: "writer", editorial: { status: "reviewed" } }] as unknown as BookArchiveEntry[];
let documents: Record<"ru" | "en", BookDossierDocumentV2>;
const reference = (locale: "ru" | "en"): BookyDossierCharacterReference => ({ work, locale, dossierVersion: "test-v1",
  sectionId: "graph-context", blockId: "graph-guests", itemId: "character-c" });
function inspect(locale: "ru" | "en", dossier = documents[locale]) {
  return inspectBookyDossierCharacter({ reference: reference(locale), dossier, publicCountries: countries, publicBooks: books }, now);
}
function fixture(locale: "ru" | "en" = "ru") {
  const spec: BookyJourneyCharacterSpec = { schemaVersion: 1, id: "synthetic.character", version: 1, work: clone(work), bindings: [
    { locale: "ru", dossierVersion: "test-v1", sectionId: "graph-context", blockId: "graph-guests", itemId: "character-c",
      readingMode: "BEFORE_READING", projectionChecksum: inspect("ru")!.semanticChecksum,
      dialogue: { id: "synthetic.character.copy", version: 1, contentChecksum: "a".repeat(64) } },
    { locale: "en", dossierVersion: "test-v1", sectionId: "graph-context", blockId: "graph-guests", itemId: "character-c",
      readingMode: "BEFORE_READING", projectionChecksum: inspect("en")!.semanticChecksum,
      dialogue: { id: "synthetic.character.copy", version: 1, contentChecksum: "b".repeat(64) } },
  ] };
  const host: BookyDossierCharacterHostSnapshot = Object.freeze({ revision: 7, enabled: true, active: true, access: "adult",
    locale, countryStatus: "ready", booksStatus: "ready", dossier: documents[locale], publicCountries: countries, publicBooks: books });
  return { spec, host, request: { spec, locale, hostRevision: host.revision } };
}

describe("static bilingual Booky character contract and leased composer", () => {
  beforeAll(async () => {
    // Actual workflow/compiler, explicitly synthetic attestations and characters.
    const ru = (await createBookDossierGraphFixture({ now })).document;
    const en = JSON.parse(JSON.stringify(ru, (field, value) => field === "locale" ? "en" : value)) as BookDossierDocumentV2;
    const item = en.pages.find(page => page.id === "graph-context")!.blocks.find(block => block.id === "graph-guests")!.items[0];
    Object.assign(item, { label: "Synthetic character C", value: "Synthetic guest" });
    documents = { ru, en };
    expect(inspect("ru")).not.toBeNull(); expect(inspect("en")).not.toBeNull();
  });

  it("exports the same immutable canonical reference parser without granting membership", () => {
    const input = reference("ru"), parsed = parseBookyDossierCharacterReference(input)!;
    expect(parsed).toEqual(input); expect(parsed).not.toBe(input); expect(parsed.work).not.toBe(input.work);
    expect(Object.isFrozen(parsed) && Object.isFrozen(parsed.work)).toBe(true);
    expect(parseBookyDossierCharacterReference({ ...input, work: { ...work, countryId: "ambiguous:country" } })).toBeNull();
    expect(parseBookyDossierCharacterReference({ ...input, work: { ...work, workId: "valid:work-tail" } })).not.toBeNull();
    expect(parseBookyDossierCharacterReference({ ...input, work: { ...work, workId: "not-in-catalog" } })).not.toBeNull();
  });

  it("snapshots the bounded pair and stores canonical work once without retaining mutable input", () => {
    const { spec } = fixture(), parsed = parseBookyJourneyCharacter(spec)!;
    expect(parsed).toEqual(spec); expect(parsed).not.toBe(spec);
    for (const value of [parsed, parsed.work, parsed.bindings, ...parsed.bindings, ...parsed.bindings.map(item => item.dialogue)]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    Reflect.set(spec.work, "workId", "another"); Reflect.set(spec.bindings[0].dialogue, "version", 2);
    expect(parsed.work.workId).toBe("book"); expect(parsed.bindings[0].dialogue.version).toBe(1);
    expect(Object.keys(parsed.bindings[0])).not.toContain("work");
    expect(parseBookyJourneyCharacter({ ...parsed, bindings: [{ ...parsed.bindings[0], work }, parsed.bindings[1]] })).toBeNull();
  });

  it("requires exactly one RU then EN binding without silent locale normalization", () => {
    const { spec } = fixture(), [ru, en] = spec.bindings;
    for (const bindings of [[], [ru], [en, ru], [ru, ru], [ru, en, en], [ru, , en],
      [ru, { ...en, locale: "fr" }], [ru, { ...en, locale: "EN" }]]) {
      expect(parseBookyJourneyCharacter({ ...spec, bindings })).toBeNull();
    }
  });

  it("rejects unsupported schemas, unbounded identities, invalid hashes and extra authority", () => {
    const { spec } = fixture();
    for (const patch of [{ schemaVersion: 2 }, { version: 0 }, { version: 1.5 }, { version: 1_000_001 },
      { version: Infinity }, { id: "x".repeat(97) }, { id: "bad id" }, { approved: true }, { cacheKey: "transient" }]) {
      expect(parseBookyJourneyCharacter({ ...spec, ...patch })).toBeNull();
    }
    for (const patch of [{ readingMode: "DURING_READING" }, { readingMode: "AFTER_READING" }, { projectionChecksum: "A".repeat(64) },
      { projectionChecksum: "a".repeat(65) }, { dossierVersion: "x".repeat(97) }, { itemId: "" }, { validUntil: "2099-01-01" }]) {
      expect(parseBookyJourneyCharacter({ ...spec, bindings: [{ ...spec.bindings[0], ...patch }, spec.bindings[1]] })).toBeNull();
    }
    for (const dialogue of [{ ...spec.bindings[0].dialogue, approved: true }, { ...spec.bindings[0].dialogue, version: 0 },
      { ...spec.bindings[0].dialogue, contentChecksum: "bad" }]) {
      expect(parseBookyJourneyCharacter({ ...spec, bindings: [{ ...spec.bindings[0], dialogue }, spec.bindings[1]] })).toBeNull();
    }
    expect(parseBookyJourneyCharacter({ ...spec, work: { ...work, workId: "x".repeat(201) } })).toBeNull();
  });

  it("rejects nested getters, sparse or exotic tuples, hidden and symbol properties without calling input code", () => {
    const { spec } = fixture(), getter = vi.fn(() => { throw Error("must not execute"); });
    const poison = (value: object, field: string) => Object.defineProperty({ ...value }, field, { enumerable: true, get: getter });
    const tuple = Object.defineProperty([...spec.bindings], "1", { enumerable: true, get: getter });
    class ExoticArray extends Array<unknown> {}
    for (const value of [poison(spec, "work"), { ...spec, work: poison(work, "workId") },
      { ...spec, bindings: [poison(spec.bindings[0], "itemId"), spec.bindings[1]] },
      { ...spec, bindings: [{ ...spec.bindings[0], dialogue: poison(spec.bindings[0].dialogue, "contentChecksum") }, spec.bindings[1]] },
      { ...spec, bindings: tuple }, { ...spec, bindings: new Array(2) }, { ...spec, bindings: new ExoticArray(...spec.bindings) },
      { ...spec, toJSON: getter }, { ...spec, [Symbol("extra")]: true }, Object.create(spec),
      Object.defineProperty({ ...spec }, "id", { enumerable: false, value: spec.id })]) {
      expect(parseBookyJourneyCharacter(value)).toBeNull();
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("fingerprints both localized references, source projection hashes, dialogue bindings and canonical work", () => {
    const { spec } = fixture(), checksum = getBookyJourneyCharacterChecksum(spec);
    expect(checksum).toBe(contentRecordHash(parseBookyJourneyCharacter(spec)));
    for (const index of [0, 1]) for (const patch of [{ projectionChecksum: "c".repeat(64) }, { itemId: "another-character" },
      { dossierVersion: "test-v2" }, { dialogue: { ...spec.bindings[index].dialogue, contentChecksum: "d".repeat(64) } }]) {
      const bindings = spec.bindings.map((binding, position) => position === index ? { ...binding, ...patch } : binding);
      expect(getBookyJourneyCharacterChecksum({ ...spec, bindings })).not.toBe(checksum);
    }
    expect(getBookyJourneyCharacterChecksum({ ...spec, work: { ...work, workId: "another" } })).not.toBe(checksum);
    expect(getBookyJourneyCharacterChecksum({ ...spec, version: 2 })).not.toBe(checksum);
    expect(getBookyJourneyCharacterChecksum(Object.fromEntries(Object.entries(spec).reverse()))).toBe(checksum);
  });

  it("resolves the current RU or EN projection with the same whole-pair identity but no dialogue or journey approval", () => {
    const results = (["ru", "en"] as const).map(locale => {
      const f = fixture(locale), resolved = resolveBookyJourneyCharacter(f.request, () => f.host, () => now)!;
      expect(resolved.projection.reference.locale).toBe(locale);
      expect(resolved.projection.reference.work).toEqual(work);
      expect(Object.isFrozen(resolved) && Object.isFrozen(resolved.projection.sources)).toBe(true);
      expect(Object.keys(resolved).sort()).toEqual(["projection", "semanticChecksum", "spec"]);
      // Payload IDs/checksums are references only: no registry/receipt was supplied.
      expect(resolved.spec.bindings[0].dialogue.id).toBe("synthetic.character.copy");
      return resolved;
    });
    expect(results[0].semanticChecksum).toBe(results[1].semanticChecksum);
    expect(results[0].projection.semanticChecksum).not.toBe(results[1].projection.semanticChecksum);
  });

  it("denies absent/fallback sources, changed selected-item sources and even checksum-matching non-before mode", () => {
    const f = fixture(), changed = clone(documents.ru);
    const beforeHost = Object.freeze({ ...f.host, dossier: clone(documents.ru) });
    expect(resolveBookyJourneyCharacter(f.request, () => beforeHost, () => now)?.projection.readingMode).toBe("BEFORE_READING");
    // Renew the source consistently across its public appearances: this must
    // fail the expected projection checksum, not ambiguous source validation.
    for (const page of changed.pages) for (const sources of [page.sources, ...page.blocks.map(block => block.sources)]) {
      for (const source of sources) if (source.id === "source-one") Reflect.set(source, "sourceUrl", "https://probpera.ru/stati/changed-synthetic-source/");
    }
    const changedProjection = inspect("ru", changed);
    expect(changedProjection).not.toBeNull();
    expect(changedProjection!.semanticChecksum).not.toBe(f.spec.bindings[0].projectionChecksum);
    for (const dossier of [null, { ...documents.ru, profile: null, tier: null }, changed]) {
      const host = Object.freeze({ ...f.host, dossier });
      expect(resolveBookyJourneyCharacter(f.request, () => host, () => now)).toBeNull();
    }
    const during = JSON.parse(JSON.stringify(documents.ru, (field, value) => field === "readingMode" ? "DURING_READING" : value)) as BookDossierDocumentV2;
    const current = inspect("ru", during)!; expect(current).not.toBeNull();
    const spec = { ...f.spec, bindings: [{ ...f.spec.bindings[0], projectionChecksum: current.semanticChecksum }, f.spec.bindings[1]] };
    const duringHost = Object.freeze({ ...f.host, dossier: during });
    expect(resolveBookyDossierCharacter({ reference: reference("ru"), expectedChecksum: current.semanticChecksum, hostRevision: 7 },
      () => duringHost, () => now)?.readingMode).toBe("DURING_READING");
    expect(resolveBookyJourneyCharacter({ ...f.request, spec }, () => duringHost, () => now)).toBeNull();
  });

  it("retains existing host revision, locale, explicit adult and catalog-readiness guards", () => {
    const f = fixture();
    for (const patch of [{ revision: 8 }, { enabled: false }, { active: false }, { access: "child" }, { access: "blocked" },
      { locale: "en" }, { booksStatus: "loading" }, { countryStatus: "failed" }, { publicBooks: [] }]) {
      const host = { ...f.host, ...patch } as BookyDossierCharacterHostSnapshot;
      expect(resolveBookyJourneyCharacter(f.request, () => host, () => now)).toBeNull();
    }
    expect(resolveBookyJourneyCharacter({ ...f.request, hostRevision: -1 }, () => f.host, () => now)).toBeNull();
    expect(resolveBookyJourneyCharacter({ ...f.request, token: {} }, () => f.host, () => now)).toBeNull();
    expect(resolveBookyJourneyCharacter({ ...f.request, locale: "fr" }, () => f.host, () => now)).toBeNull();
  });

  it("accepts equivalent fresh lease renewal without changing semantic identity and denies expiry", () => {
    const f = fixture(), initial = resolveBookyJourneyCharacter(f.request, () => f.host, () => now)!;
    const later = now + 30_000, renewed = { ...f.host, dossier: { ...documents.ru, validUntil: new Date(later + 60_000).toISOString() } };
    const result = resolveBookyJourneyCharacter(f.request, () => renewed, () => later)!;
    expect(result.semanticChecksum).toBe(initial.semanticChecksum); expect(result.projection).toEqual(initial.projection);
    expect(resolveBookyJourneyCharacter(f.request, () => f.host, () => Date.parse(documents.ru.validUntil!))).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/validUntil|cacheKey|hostRevision|token/u);
  });

  it("fails closed on changing host, expiry during resolution, backwards time and thrown readers", () => {
    const f = fixture(); let reads = 0;
    expect(resolveBookyJourneyCharacter(f.request, () => ++reads === 1 ? f.host : { ...f.host, revision: 8 }, () => now)).toBeNull();
    for (const finalTime of [now - 1, Date.parse(documents.ru.validUntil!), NaN]) {
      let ticks = 0;
      expect(resolveBookyJourneyCharacter(f.request, () => f.host, () => ++ticks === 1 ? now : finalTime)).toBeNull();
    }
    expect(resolveBookyJourneyCharacter(f.request, () => { throw Error("reader failed"); }, () => now)).toBeNull();
  });

  it("snapshots caller spec before source callbacks and never lets a request accessor execute", () => {
    const f = fixture(), checksum = getBookyJourneyCharacterChecksum(f.spec);
    const result = resolveBookyJourneyCharacter(f.request, () => {
      Reflect.set(f.spec.bindings[1].dialogue, "contentChecksum", "c".repeat(64)); return f.host;
    }, () => now)!;
    expect(result.semanticChecksum).toBe(checksum);
    expect(result.spec.bindings[1].dialogue.contentChecksum).toBe("b".repeat(64));
    const getter = vi.fn(() => f.spec);
    expect(resolveBookyJourneyCharacter(Object.defineProperty({ ...f.request }, "spec", { enumerable: true, get: getter }),
      () => f.host, () => now)).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
});
