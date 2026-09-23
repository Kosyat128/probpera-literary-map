import { beforeAll, describe, expect, it } from "vitest";
import { createBookDossierGraphFixture } from "../../scripts/lib/book-dossier-graph-fixture";
import { parsePublishedBookDossier } from "../books/bookDossierDelivery";
import type { BookDossierDocumentV2 } from "../books/bookDossierDocument";
import type { BookArchiveEntry, Country } from "../planet/types";
import { inspectBookyDossierCharacter, resolveBookyDossierCharacter,
  type BookyDossierCharacterHostSnapshot, type BookyDossierCharacterInput,
  type BookyDossierCharacterReference } from "./bookyDossierCharacter";

const now = Date.parse("2026-09-23T10:00:00.000Z");
const reference: BookyDossierCharacterReference = {
  work: { kind: "work", countryId: "test", writerId: "writer", workId: "book" },
  dossierVersion: "test-v1", locale: "ru", sectionId: "graph-context", blockId: "graph-team", itemId: "character-a",
};
let published: BookDossierDocumentV2;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function fixture(document = clone(published)) {
  const country = { id: "test", writers: [{ id: "writer" }] } as unknown as Country;
  const book = { id: "book", countryId: "test", writerId: "writer", editorial: { status: "reviewed" } } as unknown as BookArchiveEntry;
  const input: BookyDossierCharacterInput = { reference: clone(reference), dossier: document,
    publicCountries: [country], publicBooks: [book] };
  const host: BookyDossierCharacterHostSnapshot = Object.freeze({ revision: 7, enabled: true, active: true,
    access: "adult", locale: "ru", countryStatus: "ready", booksStatus: "ready",
    dossier: document, publicCountries: input.publicCountries, publicBooks: input.publicBooks });
  const inspected = inspectBookyDossierCharacter(input, now);
  const request = { reference: input.reference, expectedChecksum: inspected?.semanticChecksum ?? "0".repeat(64), hostRevision: 7 };
  return { input, host, request, inspected, document, country, book };
}
const characters = (document: BookDossierDocumentV2) => document.pages.find(page => page.id === "graph-context")!;
const team = (document: BookDossierDocumentV2) => characters(document).blocks.find(block => block.id === "graph-team")!;

describe("adult published dossier character boundary", () => {
  beforeAll(async () => {
    // Actual publication workflow/compiler; all attestations are synthetic test data.
    published = (await createBookDossierGraphFixture({ now })).document;
    expect(parsePublishedBookDossier(published, now)).not.toBeNull();
  });

  it("resolves the exact canonical work and filtered character into an immutable source-bound projection", () => {
    const f = fixture(), result = resolveBookyDossierCharacter(f.request, () => f.host, () => now)!;
    expect(result).not.toBeNull();
    expect(result.reference).toEqual(reference);
    expect(result).toMatchObject({ bookKey: "test:writer:book", label: "Персонаж А", value: "Первый участник",
      readingMode: "BEFORE_READING", itemSourceIds: ["source-one"] });
    expect(result.sources[0]).toMatchObject({ id: "source-one", sourceUrl: "https://probpera.ru/stati/test/" });
    expect(result.semanticChecksum).toMatch(/^[a-f0-9]{64}$/u);
    expect(Object.isFrozen(result) && Object.isFrozen(result.reference.work) && Object.isFrozen(result.sources[0])).toBe(true);
    const before = JSON.stringify(result);
    (team(f.document).items[0] as { label: string }).label = "Caller mutation";
    (team(f.document).sources[0] as { title: string }).title = "Caller source mutation";
    expect(JSON.stringify(result)).toBe(before);
    expect(JSON.stringify(result)).not.toMatch(/validUntil|rightsBasis|actorId|private-test-evidence/u);
  });

  it("admits an exact English projection without substituting its Russian identity or checksum", () => {
    // A synthetic alternate public payload; this creates no publication authority.
    const document = JSON.parse(JSON.stringify(published, (field, value) => field === "locale" ? "en" : value)) as BookDossierDocumentV2;
    (team(document).items[0] as { label: string; value: string }).label = "Character A";
    (team(document).items[0] as { value: string }).value = "First participant";
    const f = fixture(document), enReference = { ...reference, locale: "en" as const };
    const inspected = inspectBookyDossierCharacter({ ...f.input, reference: enReference }, now)!;
    expect(inspected).not.toBeNull();
    const host = Object.freeze({ ...f.host, locale: "en" as const });
    const request = { ...f.request, reference: enReference, expectedChecksum: inspected.semanticChecksum };
    expect(resolveBookyDossierCharacter(request, () => host, () => now)?.label).toBe("Character A");
    expect(resolveBookyDossierCharacter({ ...request, reference }, () => host, () => now)).toBeNull();
    expect(resolveBookyDossierCharacter({ ...request, expectedChecksum: fixture().request.expectedChecksum }, () => host, () => now)).toBeNull();
  });

  it("requires unique current public country, writer and reviewed book membership", () => {
    const f = fixture();
    const inspect = (change: Partial<BookyDossierCharacterInput>) => inspectBookyDossierCharacter({ ...f.input, ...change }, now);
    expect(inspect({ publicCountries: [] })).toBeNull();
    expect(inspect({ publicCountries: [f.country, f.country] })).toBeNull();
    expect(inspect({ publicCountries: [{ ...f.country, writers: [] }] })).toBeNull();
    expect(inspect({ publicCountries: [{ ...f.country, writers: [f.country.writers[0], f.country.writers[0]] }] })).toBeNull();
    expect(inspect({ publicBooks: [] })).toBeNull();
    expect(inspect({ publicBooks: [f.book, f.book] })).toBeNull();
    expect(inspect({ publicBooks: [{ ...f.book, writerId: "another" }] })).toBeNull();
    expect(inspect({ publicBooks: [{ ...f.book, editorial: { ...f.book.editorial!, status: "draft" } }] })).toBeNull();
    expect(inspectBookyDossierCharacter({ ...f.input, reference: { ...reference,
      work: { ...reference.work, countryId: "test:writer" } } }, now)).toBeNull();
  });

  it("never substitutes book, version, locale, block kind or a spoiler-filtered missing item", () => {
    const f = fixture();
    for (const change of [{ dossierVersion: "test-v2" }, { locale: "en" }, { sectionId: "missing" },
      { blockId: "missing" }, { itemId: "missing" }, { blockId: "graph-guests", itemId: "character-hidden" },
      { blockId: "graph-themes", itemId: "concept-theme" }, { blockId: "graph-relations", itemId: "relation-ab" }]) {
      expect(inspectBookyDossierCharacter({ ...f.input, reference: { ...reference, ...change } }, now)).toBeNull();
    }
    expect(inspectBookyDossierCharacter({ ...f.input, dossier: { ...f.document, bookKey: "test:writer:other" } }, now)).toBeNull();
    const changed = fixture();
    (team(changed.document).items[0] as { fromId?: string }).fromId = "character-b";
    expect(inspectBookyDossierCharacter(changed.input, now)).toBeNull();
  });

  it("rejects absent, unleased, fallback, expired and excessive-lease documents", () => {
    const f = fixture();
    for (const dossier of [null, { ...f.document, validUntil: undefined }, { ...f.document, profile: null, tier: null },
      { ...f.document, validUntil: new Date(now).toISOString() },
      { ...f.document, validUntil: new Date(now + 65_001).toISOString() }]) {
      expect(inspectBookyDossierCharacter({ ...f.input, dossier }, now)).toBeNull();
    }
    expect(inspectBookyDossierCharacter(f.input, NaN)).toBeNull();
    expect(resolveBookyDossierCharacter(f.request, () => f.host, () => now + 60_001)).toBeNull();
  });

  it("excludes lease renewal from semantics while rechecking the lease during every resolution", () => {
    const f = fixture(), renewed = { ...f.document, validUntil: new Date(now + 61_000).toISOString() };
    expect(inspectBookyDossierCharacter({ ...f.input, dossier: renewed }, now)?.semanticChecksum).toBe(f.inspected!.semanticChecksum);
    let clockCalls = 0;
    expect(resolveBookyDossierCharacter(f.request, () => f.host, () => ++clockCalls === 1 ? now : now + 60_001)).toBeNull();
    expect(clockCalls).toBe(2);
    expect(resolveBookyDossierCharacter(f.request, () => f.host, () => now)).not.toBeNull();
  });

  it("rejects duplicate blocks/items and missing, duplicate or conflicting public source references", () => {
    const changes: ((document: BookDossierDocumentV2) => void)[] = [
      document => { (characters(document).blocks as unknown[]).push(clone(team(document))); },
      document => { (team(document).items as unknown[]).push(clone(team(document).items[0])); },
      document => { (team(document).items[0] as unknown as { sourceIds: string[] }).sourceIds = []; },
      document => { (team(document).items[0] as unknown as { sourceIds: string[] }).sourceIds = ["missing"]; },
      document => { (team(document).items[0] as unknown as { sourceIds: string[] }).sourceIds = ["source-one", "source-one"]; },
      document => { (team(document) as unknown as { sources: unknown[] }).sources = []; },
      document => { (team(document).sources as unknown[]).push(clone(team(document).sources[0])); },
      document => { (team(document).sources[0] as { title: string }).title = "Conflicts with other current source-one records"; },
      document => { (team(document).anchor as { blockId: string }).blockId = "other"; },
    ];
    for (const change of changes) {
      const f = fixture(); change(f.document);
      expect(inspectBookyDossierCharacter(f.input, now)).toBeNull();
    }
  });

  it("binds changed character prose and source data to a fresh explicit checksum", () => {
    const f = fixture();
    (team(f.document).items[0] as { label: string }).label = "Changed synthetic character";
    const changed = inspectBookyDossierCharacter(f.input, now)!;
    expect(changed.semanticChecksum).not.toBe(f.request.expectedChecksum);
    expect(resolveBookyDossierCharacter(f.request, () => f.host, () => now)).toBeNull();
    expect(resolveBookyDossierCharacter({ ...f.request, expectedChecksum: changed.semanticChecksum }, () => f.host, () => now)).not.toBeNull();
    const sourceChanged = fixture();
    for (const page of sourceChanged.document.pages) for (const sources of [page.sources, ...page.blocks.map(block => block.sources)]) {
      for (const source of sources) (source as { sourceUrl: string }).sourceUrl = "https://probpera.ru/stati/changed-test/";
    }
    expect(inspectBookyDossierCharacter(sourceChanged.input, now)?.semanticChecksum).not.toBe(sourceChanged.request.expectedChecksum);
    expect(resolveBookyDossierCharacter(sourceChanged.request, () => sourceChanged.host, () => now)).toBeNull();
  });

  it("isolates a character's citations and checksum from another character's source in the same block", () => {
    const f = fixture(), block = team(f.document), page = characters(f.document);
    const sourceB = { ...clone(block.sources[0]), id: "source-b", title: "Synthetic source for character B",
      sourceUrl: "https://probpera.ru/stati/character-b-test/" };
    (block.sources as unknown[]).push(sourceB);
    (page.sources as unknown[]).push(clone(sourceB));
    (block.items[1] as unknown as { sourceIds: string[] }).sourceIds = ["source-b"];
    const selected = inspectBookyDossierCharacter(f.input, now)!;
    expect(selected.sources.map(source => source.id)).toEqual(["source-one"]);
    expect(selected.semanticChecksum).toBe(f.inspected!.semanticChecksum);
    const other = inspectBookyDossierCharacter({ ...f.input, reference: { ...reference, itemId: "character-b" } }, now)!;
    expect(other.sources.map(source => source.id)).toEqual(["source-b"]);

    for (const sources of [page.sources, block.sources]) {
      const source = sources.find(source => source.id === "source-b")!;
      (source as { title: string }).title = "Changed synthetic source for B";
    }
    expect(inspectBookyDossierCharacter(f.input, now)?.semanticChecksum).toBe(selected.semanticChecksum);
    const changedB = inspectBookyDossierCharacter({ ...f.input, reference: { ...reference, itemId: "character-b" } }, now);
    expect(changedB).not.toBeNull();
    expect(changedB!.semanticChecksum).not.toBe(other.semanticChecksum);

    for (const currentPage of f.document.pages) for (const sources of [currentPage.sources, ...currentPage.blocks.map(entry => entry.sources)]) {
      for (const source of sources) if (source.id === "source-one") (source as { title: string }).title = "Changed synthetic source for A";
    }
    const changedA = inspectBookyDossierCharacter(f.input, now);
    expect(changedA).not.toBeNull();
    expect(changedA!.semanticChecksum).not.toBe(selected.semanticChecksum);
  });

  it("requires live adult host gates, exact revision and locale with no inspection-based authority", () => {
    const f = fixture();
    const changes: Partial<BookyDossierCharacterHostSnapshot>[] = [{ enabled: false }, { active: false }, { access: "child" },
      { access: "blocked" }, { locale: "en" }, { countryStatus: "loading" }, { booksStatus: "error" }, { dossier: null }, { revision: 8 }];
    for (const change of changes) expect(resolveBookyDossierCharacter(f.request, () => Object.freeze({ ...f.host, ...change }), () => now)).toBeNull();
    expect(resolveBookyDossierCharacter({ ...f.request, hostRevision: -1 }, () => f.host, () => now)).toBeNull();
    expect(resolveBookyDossierCharacter({ reference, hostRevision: 7 }, () => f.host, () => now)).toBeNull();
    expect(resolveBookyDossierCharacter({ ...f.request, expectedChecksum: "0".repeat(64) }, () => f.host, () => now)).toBeNull();
  });

  it("rejects host replacement or revocation during the live-clock/projection fence", () => {
    const f = fixture();
    let reads = 0;
    expect(resolveBookyDossierCharacter(f.request, () => ++reads === 1 ? f.host : Object.freeze({ ...f.host, revision: 8, dossier: null }), () => now)).toBeNull();
    reads = 0;
    expect(resolveBookyDossierCharacter(f.request, () => ++reads === 1 ? f.host : Object.freeze({ ...f.host }), () => now)).toBeNull();
    let current = f.host, ticks = 0;
    expect(resolveBookyDossierCharacter(f.request, () => current, () => {
      if (++ticks === 2) current = Object.freeze({ ...f.host, revision: 8, active: false });
      return now;
    })).toBeNull();
  });

  it("rejects own-data hazards before the old public parser without invoking getters or toJSON", () => {
    const f = fixture(); let executions = 0;
    const poisoned = clone(f.document);
    Object.defineProperty(team(poisoned).items[0], "label", { enumerable: true, get() { ++executions; return "Getter"; } });
    expect(inspectBookyDossierCharacter({ ...f.input, dossier: poisoned }, now)).toBeNull();
    const encoded = { ...f.document, toJSON() { ++executions; return f.document; } };
    expect(inspectBookyDossierCharacter({ ...f.input, dossier: encoded }, now)).toBeNull();
    const request = { ...f.request };
    Object.defineProperty(request, "expectedChecksum", { enumerable: true, get() { ++executions; return f.request.expectedChecksum; } });
    expect(resolveBookyDossierCharacter(request, () => { ++executions; return f.host; }, () => { ++executions; return now; })).toBeNull();
    const country = { ...f.country };
    Object.defineProperty(country, "writers", { enumerable: true, get() { ++executions; return f.country.writers; } });
    expect(inspectBookyDossierCharacter({ ...f.input, publicCountries: [country] }, now)).toBeNull();
    expect(inspectBookyDossierCharacter({ ...f.input, dossier: Object.assign(Object.create({ injected: true }), f.document) }, now)).toBeNull();
    const sparse = clone(f.document); delete (sparse.pages as unknown[])[0];
    expect(inspectBookyDossierCharacter({ ...f.input, dossier: sparse }, now)).toBeNull();
    expect(executions).toBe(0);
  });

  it("bounds oversized/deep input and returns no navigation, world or approval capability", () => {
    const f = fixture();
    expect(inspectBookyDossierCharacter({ ...f.input, dossier: { ...f.document, pages: Array(257).fill(f.document.pages[0]) } }, now)).toBeNull();
    let deep: unknown = null;
    for (let i = 0; i < 18; i++) deep = { child: deep };
    expect(inspectBookyDossierCharacter({ ...f.input, dossier: { ...f.document, deep } }, now)).toBeNull();
    expect(inspectBookyDossierCharacter({ ...f.input, dossier: { ...f.document, cacheKey: "x".repeat(16_385) } }, now)).toBeNull();
    expect(Object.keys(f.inspected!).sort()).toEqual(["blockTitle", "bookKey", "itemSourceIds", "label", "readingMode", "reference", "sectionTitle", "semanticChecksum", "sources", "value"].sort());
  });
});
