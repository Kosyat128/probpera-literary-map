import { describe, expect, it, vi } from "vitest";
import { contentTextHash } from "../planet/contentExportHash";
import type { BookArchiveEntry, Country } from "../planet/types";
import { getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialoguePayload, type BookyDialogueRecord } from "./bookyDialogueRegistry";
import { bookyJourneyEntityId, compileBookyJourney, getBookyJourneyChecksum,
  type BookyJourneyContext, type BookyJourneyDefinition } from "./bookyJourney";
import { createBookyJourneyCatalog, type BookyJourneyCatalogOptions } from "./bookyJourneyCatalog";
import { readBookyJourneyContent, type BookyJourneyContent } from "./bookyJourneyContent";
import { createBookyReaderPolicy } from "./bookyReaderPolicy";

const now = "2026-09-23T12:00:00.000Z", reviewedAt = "2026-09-22T12:00:00.000Z";
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function fixture(locale: "ru" | "en" = "en") {
  // Synthetic entities and independent receipts exist only in this test.
  // They do not grant real editorial approval or populate production content.
  const country: Country = { id: "fixture-country", name: "Synthetic country", coordinates: { lat: 20, lng: 30 },
    writers: [{ id: "fixture-writer" }] };
  const book: BookArchiveEntry = { id: "fixture-work", title: "Synthetic work", countryId: country.id,
    countryName: country.name, writerId: "fixture-writer", writerName: "Synthetic writer", country,
    writer: country.writers[0], editorial: { status: "verified" } };
  const nodes: BookyJourneyDefinition["nodes"] = [
    { id: "country", kind: "country", entity: { kind: "country", countryId: country.id }, screen: "globe", dialogue: { id: "fixture-country-line", version: 1, contentChecksum: "" } },
    { id: "writer", kind: "writer", entity: { kind: "writer", countryId: country.id, writerId: "fixture-writer" }, screen: "globe", dialogue: { id: "fixture-writer-line", version: 1, contentChecksum: "" } },
    { id: "work", kind: "work", entity: { kind: "work", countryId: country.id, writerId: "fixture-writer", workId: book.id }, screen: "collection", dialogue: { id: "fixture-work-line", version: 1, contentChecksum: "" } },
    { id: "checkpoint", kind: "checkpoint", entity: null, screen: "collection", dialogue: { id: "fixture-checkpoint-line", version: 1, contentChecksum: "" } },
  ];
  const dialogues: BookyDialogueRecord[] = nodes.map(node => {
    const copy = { title: locale === "ru" ? "Проверка" : "Test", body: locale === "ru" ? "Тестовый текст." : "Synthetic interface text.",
      caption: "Synthetic caption", reduced: "Test" };
    const payload: BookyDialoguePayload = { id: node.dialogue.id, locale, version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: "navigation", screens: [node.screen],
      context: `fixture-journey:${node.id}`, entityIds: node.entity ? [bookyJourneyEntityId(node.entity)] : [],
      claimKind: "interface-guidance", factualSources: [], copy, narration: null, prohibitedTags: [],
      provenance: { kind: "editorial", sourcePath: "test/fixture.ts", sourceVersion: 1, sourceRef: node.id,
        sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
    const review = { status: "approved" as const, reviewer: "synthetic-reviewer-not-real", reviewedAt,
      contentChecksum: getBookyDialogueContentChecksum(payload)! };
    return { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
  });
  const definition: BookyJourneyDefinition = { schemaVersion: 1, id: "fixture-journey", version: 1, locale,
    audience: "adult", ageRange: { min: 18, max: 120 }, readingLevel: "plain",
    title: locale === "ru" ? "Тестовый маршрут" : "Synthetic journey", prerequisites: [{ id: "fixture-prerequisite", version: 1 }],
    nodes: nodes.map((node, index) => ({ ...node, dialogue: { ...node.dialogue, contentChecksum: dialogues[index].review.contentChecksum } })) };
  const content: BookyJourneyContent = { definitions: [definition], dialogues,
    currentVersions: [{ id: definition.id, version: 1 }],
    dialogueApprovals: dialogues.map(record => ({ id: record.payload.id, locale, version: 1,
      contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt })),
    journeyApprovals: [{ id: definition.id, locale, version: 1, definitionChecksum: getBookyJourneyChecksum(definition)!,
      reviewer: "synthetic-journey-reviewer-not-real", reviewedAt }],
    availability: [{ journeyId: definition.id, locale, version: 1, nodes: definition.nodes.map(node => ({
      nodeId: node.id, locale, dialogueContentChecksum: node.dialogue.contentChecksum, available: true, offlineAvailable: true,
    })) }],
  };
  const input: BookyJourneyCatalogOptions = { content, policy: createBookyReaderPolicy({ age: 30, readingLevel: "plain" }, reviewedAt, 1),
    locale, now, connectivity: "online", publicCountries: [country], publicBooks: [book],
    completedPrerequisites: [{ id: "fixture-prerequisite", version: 1 }] };
  const build = (override: Partial<BookyJourneyCatalogOptions> = {}) => createBookyJourneyCatalog({ ...input, ...override });
  const changeContent = (override: Partial<BookyJourneyContent>) => build({ content: { ...content, ...override } });
  return { input, content, definition, dialogues, country, book, build, changeContent };
}

describe("Booky journey catalog and empty production content", () => {
  it("ships no production journey, dialogue, review receipt or availability seed", () => {
    const content = readBookyJourneyContent();
    expect(readBookyJourneyContent()).toBe(content);
    expect(Object.isFrozen(content)).toBe(true);
    for (const values of Object.values(content)) { expect(values).toEqual([]); expect(Object.isFrozen(values)).toBe(true); }
    expect(fixture().build({ content }).plans).toEqual([]);
  });

  it.each(["ru", "en"] as const)("admits the exact independently reviewed %s whole route", locale => {
    const f = fixture(locale), catalog = f.build();
    expect(catalog.plans).toHaveLength(1);
    const plan = catalog.plans[0], source = catalog.sourceFor(plan)!;
    expect(plan.locale).toBe(locale);
    expect(plan.nodes.map(node => node.kind)).toEqual(["country", "writer", "work", "checkpoint"]);
    expect(plan.nodes[0].coordinates).toEqual([20, 30]);
    expect(catalog.sourceFor(plan)).toBe(source);
    expect(catalog.sourceFor({ ...plan })).toBeNull();
    expect(f.build().sourceFor(plan)).toBeNull();
    for (const value of [catalog, catalog.plans, source, source.definition, source.trust, source.trust.publicCountries,
      source.trust.publicCountries[0], source.trust.publicCountries[0].writers, source.trust.publicBooks[0].editorial,
      source.availability, source.availability[0], source.completedPrerequisites]) expect(Object.isFrozen(value)).toBe(true);
  });

  it("requires the current explicit policy, confirmation time and exact reading level", () => {
    const f = fixture();
    expect(f.build({ policy: null }).plans).toEqual([]);
    expect(f.build({ policy: { ...f.input.policy!, age: 17 } }).plans).toEqual([]);
    expect(f.build({ policy: { ...f.input.policy!, readingLevel: "fluent" } }).plans).toEqual([]);
    expect(f.build({ policy: { ...f.input.policy!, confirmedAt: "2026-09-24T00:00:00.000Z" } }).plans).toEqual([]);
    expect(f.build({ now: "invalid-time" }).plans).toEqual([]);
    expect(f.build({ completedPrerequisites: [] }).plans).toEqual([]);
    expect(f.build({ completedPrerequisites: [{ id: "fixture-prerequisite", version: 2 }] }).plans).toEqual([]);
  });

  it("never falls back across locales and keeps each whole-route availability scope separate", () => {
    const en = fixture("en"), ru = fixture("ru");
    expect(en.build({ locale: "ru" }).plans).toEqual([]);
    const content: BookyJourneyContent = { ...en.content, definitions: [...en.content.definitions, ...ru.content.definitions],
      dialogues: [...en.content.dialogues, ...ru.content.dialogues], dialogueApprovals: [...en.content.dialogueApprovals, ...ru.content.dialogueApprovals],
      journeyApprovals: [...en.content.journeyApprovals, ...ru.content.journeyApprovals],
      availability: [...en.content.availability, ...ru.content.availability] };
    const catalog = en.build({ content, locale: "ru" });
    expect(catalog.plans.map(plan => plan.locale)).toEqual(["ru"]);
    expect(catalog.sourceFor(catalog.plans[0])!.availability.every(node => node.locale === "ru")).toBe(true);
    expect(en.changeContent({ availability: [{ ...en.content.availability[0], locale: "ru" }] }).plans).toEqual([]);
  });

  it("does not promote draft copy or supply missing independent approval", () => {
    const f = fixture();
    expect(f.changeContent({ journeyApprovals: [] }).plans).toEqual([]);
    expect(f.changeContent({ dialogueApprovals: [] }).plans).toEqual([]);
    expect(f.changeContent({ journeyApprovals: [{ ...f.content.journeyApprovals[0], definitionChecksum: "f".repeat(64) }] }).plans).toEqual([]);
    const dialogues = f.dialogues.map(record => {
      const review = { ...record.review, status: "draft" as const, reviewer: null, reviewedAt: null };
      return { ...record, review, checksum: getBookyDialogueChecksum({ payload: record.payload, review })! };
    });
    expect(f.changeContent({ dialogues }).plans).toEqual([]);
  });

  it("uses actual current public parents and reviewed work membership", () => {
    const f = fixture();
    for (const override of [
      { publicCountries: [] }, { publicCountries: [{ ...f.country, writers: [] }] }, { publicBooks: [] },
      { publicBooks: [{ ...f.book, countryId: "other" }] }, { publicBooks: [{ ...f.book, writerId: "other" }] },
      { publicBooks: [{ ...f.book, editorial: { status: "draft" as const } }] },
      { publicBooks: [f.book, f.book] }, { publicCountries: [f.country, f.country] },
      { publicCountries: [{ ...f.country, writers: [...f.country.writers, ...f.country.writers] }] },
    ]) expect(f.build(override).plans).toEqual([]);
  });

  it("derives a bounded entity policy from route references, not every public writer or book", () => {
    const f = fixture(), getter = vi.fn(() => { throw new Error("must not inspect embedded catalog"); });
    const country = { ...f.country, writers: [...f.country.writers, ...Array.from({ length: 700 }, (_, index) => ({ id: `other-writer-${index}` }))] };
    const book = Object.defineProperty({ ...f.book }, "writer", { enumerable: true, get: getter });
    const books = [book, ...Array.from({ length: 700 }, (_, index) => ({ ...f.book, id: `other-book-${index}` }))];
    const catalog = f.build({ publicCountries: [country], publicBooks: books });
    expect(catalog.plans).toHaveLength(1);
    const trust = catalog.sourceFor(catalog.plans[0])!.trust;
    expect(trust.publicCountries[0].writers).toHaveLength(1);
    expect(trust.publicBooks).toHaveLength(1);
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(["offline", "unknown"] as const)("requires every node available offline for %s connectivity", connectivity => {
    const f = fixture();
    expect(f.build({ connectivity }).plans).toHaveLength(1);
    const content = { ...f.content, availability: [{ ...f.content.availability[0],
      nodes: f.content.availability[0].nodes.map((node, index) => index === 2 ? { ...node, offlineAvailable: false } : node) }] };
    expect(f.build({ content, connectivity }).plans).toEqual([]);
    expect(f.build({ content, connectivity: "online" }).plans).toHaveLength(1);
  });

  it("rejects partial, unavailable or differently bound whole-route availability", () => {
    const f = fixture(), available = f.content.availability[0];
    for (const nodes of [available.nodes.slice(1), [...available.nodes, available.nodes[0]],
      available.nodes.map((node, index) => index === 1 ? { ...node, available: false } : node),
      available.nodes.map((node, index) => index === 1 ? { ...node, dialogueContentChecksum: "b".repeat(64) } : node),
      available.nodes.map((node, index) => index === 1 ? { ...node, locale: "ru" as const } : node),
    ]) expect(f.changeContent({ availability: [{ ...available, nodes }] }).plans).toEqual([]);
    expect(f.changeContent({ availability: [{ ...available, version: 2 }] }).plans).toEqual([]);
  });

  it.each(["definitions", "dialogues", "currentVersions", "dialogueApprovals", "journeyApprovals", "availability"] as const)(
    "fails closed on duplicated %s", field => {
      const f = fixture(), content = clone(f.content);
      Reflect.set(content, field, [...content[field], content[field][0]]);
      expect(f.build({ content }).plans).toEqual([]);
    });

  it("rejects conflicting current versions, even when a matching older receipt exists", () => {
    const f = fixture();
    expect(f.changeContent({ currentVersions: [{ id: f.definition.id, version: 2 }] }).plans).toEqual([]);
    expect(f.changeContent({ currentVersions: [...f.content.currentVersions, { id: f.definition.id, version: 2 }] }).plans).toEqual([]);
    expect(f.changeContent({ availability: [...f.content.availability, { ...f.content.availability[0], version: 2 }] }).plans).toEqual([]);
  });

  it("captures immutable definitions, availability and public membership for reentrant resolution", () => {
    const f = fixture(), catalog = f.build(), plan = catalog.plans[0], source = catalog.sourceFor(plan)!;
    Reflect.set(f.definition, "title", "Changed by caller");
    Reflect.set(f.content.availability[0].nodes[0], "available", false);
    f.country.coordinates = { lat: 1, lng: 2 };
    f.country.writers.length = 0;
    const context: BookyJourneyContext = { audience: "adult", age: 30, readingLevel: "plain", locale: "en", now,
      connectivity: "online", completedPrerequisites: source.completedPrerequisites, availability: source.availability };
    const compiledAgain = compileBookyJourney(source.definition, context, source.trust);
    expect(compiledAgain?.title).toBe("Synthetic journey");
    expect(compiledAgain?.nodes[0].coordinates).toEqual([20, 30]);
    expect(catalog.sourceFor(plan)).toBe(source);
  });

  it("rejects hostile or oversized bundled content without invoking accessors", () => {
    const f = fixture(), getter = vi.fn(() => { throw new Error("must not execute"); });
    const definition = Object.defineProperty({ ...f.definition }, "title", { enumerable: true, get: getter });
    const content = Object.defineProperty({ ...f.content }, "definitions", { enumerable: true, get: getter });
    expect(f.changeContent({ definitions: [definition] }).plans).toEqual([]);
    expect(f.build({ content }).plans).toEqual([]);
    expect(f.changeContent({ definitions: Array.from({ length: 129 }, () => f.definition) }).plans).toEqual([]);
    expect(getter).not.toHaveBeenCalled();
  });
});
