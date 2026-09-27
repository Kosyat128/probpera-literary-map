import { describe, expect, it, vi } from "vitest";
import type { BookyJourneyCharacterSpec } from "./bookyJourneyCharacter";
import { contentTextHash } from "../planet/contentExportHash";
import type { BookArchiveEntry, Country } from "../planet/types";
import { getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialoguePayload, type BookyDialogueRecord } from "./bookyDialogueRegistry";
import { bookyJourneyDialogueContext, bookyJourneyEntityId, compileBookyJourney, getBookyJourneyChecksum,
  type BookyJourneyContext, type BookyJourneyDefinition } from "./bookyJourney";
import { createBookyJourneyCatalog, type BookyJourneyCatalogOptions } from "./bookyJourneyCatalog";
import { readBookyJourneyContent, type BookyJourneyContent } from "./bookyJourneyContent";
import { createBookyReaderPolicy } from "./bookyReaderPolicy";
import type { BookyJourneyFactSpec } from "./bookyJourneyFact";

const now = "2026-09-23T12:00:00.000Z", reviewedAt = "2026-09-22T12:00:00.000Z";
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function fixture(locale: "ru" | "en" = "en", withActivity = false, withCharacter = false) {
  // Synthetic entities and independent receipts exist only in this test.
  // They do not grant real editorial approval or populate production content.
  const country: Country = { id: "fixture-country", name: "Synthetic country", coordinates: { lat: 20, lng: 30 },
    writers: [{ id: "fixture-writer" }] };
  const book: BookArchiveEntry = { id: "fixture-work", title: "Synthetic work", countryId: country.id,
    countryName: country.name, writerId: "fixture-writer", writerName: "Synthetic writer", country,
    writer: country.writers[0], editorial: { status: "verified" } };
  if (withActivity) {
    Object.assign(country.writers[0], { name: "Тестовый владелец", fullName: "Synthetic Archive Owner" });
    country.writers.push({ id: "actual-author", name: "Тестовый автор", fullName: "Synthetic Factual Author" }, { id: "unrelated-writer" });
    book.authorship = { kind: "single", authors: [{ countryId: country.id, writerId: "actual-author", attribution: "credited" }] };
  }
  const character: BookyJourneyCharacterSpec = { schemaVersion: 1, id: "fixture-character", version: 1,
    work: { kind: "work", countryId: country.id, writerId: "fixture-writer", workId: book.id }, bindings: [
      { locale: "ru", dossierVersion: "test-v1", sectionId: "people", blockId: "characters", itemId: "person-c",
        readingMode: "BEFORE_READING", projectionChecksum: "a".repeat(64), dialogue: { id: "fixture-character-line", version: 1, contentChecksum: "c".repeat(64) } },
      { locale: "en", dossierVersion: "test-v1", sectionId: "people", blockId: "characters", itemId: "person-c",
        readingMode: "BEFORE_READING", projectionChecksum: "b".repeat(64), dialogue: { id: "fixture-character-line", version: 1, contentChecksum: "d".repeat(64) } },
    ] };
  const nodes: BookyJourneyDefinition["nodes"] = [
    { id: "country", kind: "country", entity: { kind: "country", countryId: country.id }, screen: "globe", dialogue: { id: "fixture-country-line", version: 1, contentChecksum: "" } },
    { id: "writer", kind: "writer", entity: { kind: "writer", countryId: country.id, writerId: "fixture-writer" }, screen: "globe", dialogue: { id: "fixture-writer-line", version: 1, contentChecksum: "" } },
    { id: "work", kind: "work", entity: { kind: "work", countryId: country.id, writerId: "fixture-writer", workId: book.id }, screen: "collection", dialogue: { id: "fixture-work-line", version: 1, contentChecksum: "" } },
    ...(withActivity ? [{ id: "activity", kind: "activity" as const, entity: null, screen: "globe" as const,
      dialogue: { id: "fixture-activity-line", version: 1, contentChecksum: "" }, activity: {
        schemaVersion: 1 as const, id: "fixture-author-task", version: 1, type: "match-work-author" as const,
        targetWork: { kind: "work" as const, countryId: country.id, writerId: "fixture-writer", workId: book.id },
        choices: ["fixture-writer", "actual-author"].map((writerId, index) => ({ id: `choice-${index}`,
          writer: { kind: "writer" as const, countryId: country.id, writerId } })),
      } }] : []),
    ...(withCharacter ? [{ id: "character", kind: "character" as const, entity: character.work, screen: "collection" as const,
      dialogue: { ...character.bindings.find(binding => binding.locale === locale)!.dialogue }, character }] : []),
    { id: "checkpoint", kind: "checkpoint", entity: null, screen: "collection", dialogue: { id: "fixture-checkpoint-line", version: 1, contentChecksum: "" } },
  ];
  const dialogues: BookyDialogueRecord[] = nodes.map(node => {
    const copy = { title: locale === "ru" ? "Проверка" : "Test", body: locale === "ru" ? "Тестовый текст." : "Synthetic interface text.",
      caption: "Synthetic caption", reduced: "Test" };
    const payload: BookyDialoguePayload = { id: node.dialogue.id, locale, version: 1, audience: "adult",
      ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: node.activity ? "activity" : "navigation", screens: [node.screen],
      context: bookyJourneyDialogueContext("fixture-journey", node)!,
      entityIds: node.activity ? [node.activity.targetWork, ...node.activity.choices.map(choice => choice.writer)].map(bookyJourneyEntityId)
        : node.entity ? [bookyJourneyEntityId(node.entity)] : [],
      claimKind: "interface-guidance", factualSources: [], copy, narration: null, prohibitedTags: [],
      provenance: { kind: "editorial", sourcePath: "test/fixture.ts", sourceVersion: 1, sourceRef: node.id,
        sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
    const review = { status: "approved" as const, reviewer: "synthetic-reviewer-not-real", reviewedAt,
      contentChecksum: getBookyDialogueContentChecksum(payload)! };
    return { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
  });
  if (withCharacter) Object.assign(character.bindings.find(binding => binding.locale === locale)!.dialogue,
    { contentChecksum: dialogues.find(record => record.payload.id === "fixture-character-line")!.review.contentChecksum });
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

describe("Booky activity catalog projection", () => {
  it.each(["ru", "en"] as const)("retains factual author and distinct %s choices without unrelated writer data", locale => {
    const f = fixture(locale, true), catalog = f.build(), plan = catalog.plans[0], source = catalog.sourceFor(plan)!;
    expect(plan.nodes[3].activity!.correctChoiceId).toBe("choice-1");
    expect(source.trust.publicBooks[0].authorship).toEqual(f.book.authorship);
    expect(source.trust.publicBooks[0].authorship).not.toBe(f.book.authorship);
    expect(source.trust.publicCountries[0].writers.map(writer => writer.id)).toEqual(["fixture-writer", "actual-author"]);
    expect(plan.nodes[3].dialogue.payload.entityIds).toEqual([
      bookyJourneyEntityId(f.definition.nodes[3].activity!.targetWork),
      ...f.definition.nodes[3].activity!.choices.map(choice => bookyJourneyEntityId(choice.writer)),
    ]);
    expect(Object.isFrozen(source.trust.publicBooks[0].authorship!.authors[0])).toBe(true);
    expect(Object.isFrozen(plan.nodes[3].activityChoices)).toBe(true);
    expect(catalog.sourceFor(plan)).toBe(source);
    const preserved = plan.nodes[3].activity!.semanticChecksum;
    f.book.authorship!.authors[0].writerId = "fixture-writer";
    expect(plan.nodes[3].activity!.semanticChecksum).toBe(preserved);
    expect(f.build().plans[0].nodes[3].activity!.semanticChecksum).not.toBe(preserved);
  });

  it("collects activity work/choice references even without a normal writer or work node", () => {
    const f = fixture("en", true), definition = { ...f.definition,
      nodes: f.definition.nodes.filter(node => !["writer", "work"].includes(node.kind)) };
    const content = { ...f.content, definitions: [definition],
      journeyApprovals: f.content.journeyApprovals.map(approval => ({ ...approval, definitionChecksum: getBookyJourneyChecksum(definition)! })),
      availability: f.content.availability.map(route => ({ ...route, nodes: route.nodes.filter(node => !["writer", "work"].includes(node.nodeId)) })) };
    const catalog = f.build({ content });
    expect(catalog.plans[0].nodes.map(node => node.kind)).toEqual(["country", "activity", "checkpoint"]);
    expect(catalog.plans[0].nodes[1].activity!.correctChoiceId).toBe("choice-1");
    expect(f.build({ content, publicBooks: [] }).plans).toEqual([]);
    expect(f.build({ content, publicCountries: [{ ...f.country, writers: [f.country.writers[0]] }] }).plans).toEqual([]);
  });

  it("never erases explicit invalid authorship into a legacy archive-owner answer", () => {
    const f = fixture("en", true), getter = vi.fn(() => { throw Error("must not execute"); });
    const accessor = Object.defineProperty({ ...f.book }, "authorship", { get: getter, enumerable: true });
    for (const book of [accessor, { ...f.book, authorship: null },
      { ...f.book, authorship: { kind: "single", authors: [] } },
      { ...f.book, authorship: { kind: "multiple", authors: f.book.authorship!.authors } },
      { ...f.book, authorship: { kind: "single", authors: [{ countryId: f.country.id, writerId: "missing-author" }] } },
      Object.assign(Object.create({ authorship: f.book.authorship }), { ...f.book, authorship: undefined }),
    ]) expect(f.build({ publicBooks: [book as BookArchiveEntry] }).plans).toEqual([]);
    expect(getter).not.toHaveBeenCalled();
    const legacy = { ...f.book }; delete legacy.authorship;
    expect(f.build({ publicBooks: [legacy] }).plans[0].nodes[3].activity!.correctChoiceId).toBe("choice-0");
  });

  it("keeps ordinary navigation independent of names while rejecting activity-choice accessors", () => {
    const getter = vi.fn(() => { throw Error("must not execute"); });
    const navigation = fixture();
    Object.defineProperty(navigation.country.writers[0], "name", { get: getter, enumerable: true });
    const catalog = navigation.build();
    expect(catalog.plans).toHaveLength(1);
    expect(catalog.sourceFor(catalog.plans[0])!.trust.publicCountries[0].writers).toEqual([{ id: "fixture-writer" }]);
    const activity = fixture("en", true);
    Object.defineProperty(activity.country.writers[0], "name", { get: getter, enumerable: true });
    expect(activity.build().plans).toEqual([]);
    expect(getter).not.toHaveBeenCalled();
  });

  it("preserves only bounded own names and ignores unrelated display getters", () => {
    const f = fixture("en", true), getter = vi.fn(() => { throw Error("must not execute"); });
    Object.defineProperty(f.country.writers[2], "fullName", { get: getter, enumerable: true });
    const catalog = f.build(); expect(catalog.plans).toHaveLength(1);
    expect(catalog.plans[0].nodes[3].activityChoices).toEqual([
      { id: "choice-0", label: "Synthetic Archive Owner" }, { id: "choice-1", label: "Synthetic Factual Author" },
    ]);
    f.country.writers[1].fullName = "x".repeat(201); expect(f.build().plans).toEqual([]);
    Object.defineProperty(f.country.writers[1], "fullName", { get: getter, enumerable: true });
    expect(f.build().plans).toEqual([]); expect(getter).not.toHaveBeenCalled();
  });

  it("keeps production empty and withholds activity on missing review or unusable locale names", () => {
    const f = fixture("en", true);
    expect(f.build({ content: readBookyJourneyContent() }).plans).toEqual([]);
    expect(f.changeContent({ journeyApprovals: [] }).plans).toEqual([]);
    expect(f.changeContent({ dialogueApprovals: f.content.dialogueApprovals.filter(item => item.id !== "fixture-activity-line") }).plans).toEqual([]);
    f.country.writers[1].name = "Нет английского имени"; delete f.country.writers[1].fullName;
    expect(f.build().plans).toEqual([]);
    const ru = fixture("ru", true); expect(ru.build().plans).toHaveLength(1);
  });
});

describe("reviewed journey overview catalog", () => {
  function reviewed(content: BookyJourneyContent, description: string): BookyJourneyContent {
    const definitions = content.definitions.map(definition => ({ ...definition,
      overview: { description, estimatedDurationMinutes: 17 } }));
    return { ...content, definitions, journeyApprovals: content.journeyApprovals.map(approval => ({ ...approval,
      definitionChecksum: getBookyJourneyChecksum(definitions.find(definition => definition.id === approval.id && definition.locale === approval.locale)!)! })) };
  }

  it.each(["ru", "en"] as const)("captures exact reviewed %s overview with its source and excludes unreviewed edits", locale => {
    const f = fixture(locale), description = locale === "ru" ? "Краткое описание тестового маршрута." : "A short synthetic route introduction.";
    const content = reviewed(f.content, description), catalog = f.build({ content }), plan = catalog.plans[0], source = catalog.sourceFor(plan)!;
    expect(plan.overview).toEqual({ description, estimatedDurationMinutes: 17, offlineAvailable: true });
    expect(source.definition).toMatchObject({ overview: { description, estimatedDurationMinutes: 17 } });
    expect(Object.isFrozen(plan.overview)).toBe(true);
    Reflect.set(content.definitions[0].overview!, "description", "Caller changed the description");
    expect(plan.overview?.description).toBe(description);
    expect(source.definition).toMatchObject({ overview: { description } });
    expect(f.build({ content }).plans).toEqual([]);
    expect(f.build().plans[0].overview).toBeUndefined();
    expect(f.build({ content: readBookyJourneyContent() }).plans).toEqual([]);
  });

  it("never borrows overview copy or review from another locale", () => {
    const en = fixture("en"), ru = fixture("ru"), enContent = reviewed(en.content, "Reviewed English introduction."),
      ruContent = reviewed(ru.content, "Проверенное русское описание.");
    const content: BookyJourneyContent = { definitions: [...enContent.definitions, ...ruContent.definitions],
      dialogues: [...enContent.dialogues, ...ruContent.dialogues], currentVersions: enContent.currentVersions,
      dialogueApprovals: [...enContent.dialogueApprovals, ...ruContent.dialogueApprovals],
      journeyApprovals: [...enContent.journeyApprovals, ...ruContent.journeyApprovals], availability: [...enContent.availability, ...ruContent.availability] };
    expect(en.build({ content }).plans[0].overview?.description).toBe("Reviewed English introduction.");
    expect(ru.build({ content }).plans[0].overview?.description).toBe("Проверенное русское описание.");
    const revoked = { ...content, journeyApprovals: ruContent.journeyApprovals };
    expect(en.build({ content: revoked }).plans).toEqual([]);
    expect(ru.build({ content: revoked }).plans).toHaveLength(1);
  });

  it("recomputes current offline permission from exact node availability without altering reviewed metadata", () => {
    const f = fixture(), content = reviewed(f.content, "Synthetic introduction."), first = f.build({ content }).plans[0];
    const onlineOnly = { ...content, availability: content.availability.map(route => ({ ...route,
      nodes: route.nodes.map((node, index) => index === 2 ? { ...node, offlineAvailable: false } : node) })) };
    const second = f.build({ content: onlineOnly }).plans[0];
    expect(first.overview?.offlineAvailable).toBe(true); expect(second.overview?.offlineAvailable).toBe(false);
    expect(first.definitionChecksum).toBe(second.definitionChecksum);
    expect(second.overview?.estimatedDurationMinutes).toBe(17);
    expect(f.build({ content: onlineOnly, connectivity: "offline" }).plans).toEqual([]);
    expect(f.build({ content, connectivity: "offline" }).plans[0].overview?.offlineAvailable).toBe(true);
    const unavailable = { ...content, availability: content.availability.map(route => ({ ...route,
      nodes: route.nodes.map((node, index) => index === 2 ? { ...node, available: false } : node) })) };
    expect(f.build({ content: unavailable }).plans).toEqual([]);
  });
});

describe("sourced-fact catalog admission", () => {
  function withFact(f: ReturnType<typeof fixture>, anchorIndex: number) {
    const anchor = f.definition.nodes[anchorIndex], locale = f.definition.locale;
    const seed: BookyJourneyFactSpec = { schemaVersion: 1, id: "fixture-fact", version: 1, dialogues: [
      { locale: "ru", id: "fixture-fact-line", version: 1, contentChecksum: "a".repeat(64) },
      { locale: "en", id: "fixture-fact-line", version: 1, contentChecksum: "b".repeat(64) },
    ] };
    const node: BookyJourneyDefinition["nodes"][number] = { id: "fact", kind: "sourced-fact", entity: anchor.entity, screen: anchor.screen,
      dialogue: { id: "fixture-fact-line", version: 1, contentChecksum: "a".repeat(64) }, fact: seed };
    const factRecords = (["ru", "en"] as const).map(locale => {
      const copy = { title: `${locale}: synthetic fact`, body: "Synthetic fixture only, not a real factual claim.", caption: "Test", reduced: "Test" };
      const payload: BookyDialoguePayload = { ...f.dialogues[0].payload, id: "fixture-fact-line", locale, screens: [node.screen], intent: "sourced-fact",
        context: bookyJourneyDialogueContext(f.definition.id, node)!, entityIds: [bookyJourneyEntityId(node.entity!)], claimKind: "factual",
        factualSources: [{ id: "synthetic-source", url: "https://example.org/test-only", accessedAt: reviewedAt }], copy,
        provenance: { ...f.dialogues[0].payload.provenance, copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
      const review = { status: "approved" as const, reviewer: "synthetic-fact-reviewer-not-real", reviewedAt,
        contentChecksum: getBookyDialogueContentChecksum(payload)! };
      return { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
    });
    const spec: BookyJourneyFactSpec = { ...seed, dialogues: [
      { ...seed.dialogues[0], contentChecksum: factRecords[0].review.contentChecksum },
      { ...seed.dialogues[1], contentChecksum: factRecords[1].review.contentChecksum },
    ] };
    const binding = spec.dialogues.find(item => item.locale === locale)!;
    const fact = { ...node, fact: spec, dialogue: { id: binding.id, version: binding.version, contentChecksum: binding.contentChecksum } };
    const definition = { ...f.definition, nodes: [...f.definition.nodes.slice(0, anchorIndex + 1), fact, ...f.definition.nodes.slice(anchorIndex + 1)] };
    const content: BookyJourneyContent = { ...f.content, definitions: [definition], dialogues: [...f.dialogues, ...factRecords],
      dialogueApprovals: [...f.content.dialogueApprovals, ...factRecords.map(record => ({ id: record.payload.id, locale: record.payload.locale,
        version: record.payload.version, contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer, reviewedAt }))],
      journeyApprovals: f.content.journeyApprovals.map(review => ({ ...review, definitionChecksum: getBookyJourneyChecksum(definition)! })),
      availability: [{ ...f.content.availability[0], nodes: definition.nodes.map(node => ({ nodeId: node.id, locale,
        dialogueContentChecksum: node.dialogue.contentChecksum, available: true, offlineAvailable: true })) }],
    };
    return { content, definition, spec, factRecords };
  }

  it.each(["ru", "en"] as const)("captures independently reviewed %s facts and only their canonical anchor", locale => {
    const f = fixture(locale), { content, spec } = withFact(f, 1), catalog = f.build({ content }), plan = catalog.plans[0];
    expect(plan.nodes[2].fact!.spec).toEqual(spec);
    expect(plan.nodes[2].dialogue.payload).toMatchObject({ locale, intent: "sourced-fact", claimKind: "factual" });
    expect(plan.nodes[2].dialogue.payload.entityIds).toEqual([bookyJourneyEntityId(f.definition.nodes[1].entity!)]);
    expect(catalog.sourceFor(plan)).not.toBeNull();
    expect(Object.isFrozen(plan.nodes[2].fact!.spec.dialogues)).toBe(true);
    Reflect.set(spec.dialogues[0], "contentChecksum", "f".repeat(64));
    expect(plan.nodes[2].fact!.spec.dialogues[0].contentChecksum).not.toBe("f".repeat(64));
    expect(f.build({ content }).plans).toEqual([]);
  });

  it("withholds sourced facts when current dialogue, whole-route review or public anchor is unavailable", () => {
    const f = fixture(), { content } = withFact(f, 2);
    expect(f.build({ content }).plans).toHaveLength(1);
    for (const candidate of [{ ...content, journeyApprovals: [] },
      { ...content, dialogueApprovals: content.dialogueApprovals.filter(item => item.id !== "fixture-fact-line" || item.locale !== "en") },
      { ...content, dialogues: content.dialogues.filter(item => item.payload.id !== "fixture-fact-line" || item.payload.locale !== "en") },
    ]) expect(f.build({ content: candidate }).plans).toEqual([]);
    expect(f.build({ content, publicBooks: [] }).plans).toEqual([]);
    expect(f.build({ content, publicCountries: [{ ...f.country, writers: [] }] }).plans).toEqual([]);
    expect(f.build({ content: readBookyJourneyContent() }).plans).toEqual([]);
  });

  it("keeps country facts independent of book readiness and enforces fact-specific offline availability", () => {
    const f = fixture(), prepared = withFact(f, 0), definition = { ...prepared.definition,
      nodes: prepared.definition.nodes.filter(node => node.kind !== "writer" && node.kind !== "work") };
    const content: BookyJourneyContent = { ...prepared.content, definitions: [definition],
      journeyApprovals: prepared.content.journeyApprovals.map(review => ({ ...review, definitionChecksum: getBookyJourneyChecksum(definition)! })),
      availability: prepared.content.availability.map(route => ({ ...route, nodes: route.nodes.filter(node => node.nodeId !== "writer" && node.nodeId !== "work") })) };
    expect(f.build({ content, publicBooks: [] }).plans[0].nodes.map(node => node.kind)).toEqual(["country", "sourced-fact", "checkpoint"]);
    const offline = { ...content, availability: content.availability.map(route => ({ ...route,
      nodes: route.nodes.map(node => node.nodeId === "fact" ? { ...node, offlineAvailable: false } : node) })) };
    expect(f.build({ content: offline, publicBooks: [], connectivity: "online" }).plans).toHaveLength(1);
    expect(f.build({ content: offline, publicBooks: [], connectivity: "offline" }).plans).toEqual([]);
  });
});

describe("character catalog service admission", () => {
  it.each(["ru", "en"] as const)("passes explicit %s service capability without a future dossier", locale => {
    const f = fixture(locale, false, true);
    expect(f.build().plans).toEqual([]);
    expect(f.build({ characterPublicationAvailable: false }).plans).toEqual([]);
    const catalog = f.build({ characterPublicationAvailable: true }), plan = catalog.plans[0];
    expect(plan.nodes.map(node => node.kind)).toEqual(["country", "writer", "work", "character", "checkpoint"]);
    expect(catalog.sourceFor(plan)?.trust.characterPublicationAvailable).toBe(true);
    for (const connectivity of ["offline", "unknown"] as const) {
      expect(f.build({ characterPublicationAvailable: true, connectivity }).plans).toEqual([]);
    }
  });

  it("does not let service configuration create production content or override independent review", () => {
    const f = fixture("en", false, true), before = JSON.stringify(f.content);
    expect(f.build({ characterPublicationAvailable: true, content: readBookyJourneyContent() }).plans).toEqual([]);
    for (const content of [{ ...f.content, journeyApprovals: [] }, { ...f.content, dialogueApprovals: [] }]) {
      expect(f.build({ characterPublicationAvailable: true, content }).plans).toEqual([]);
    }
    expect(f.build({ characterPublicationAvailable: true, publicBooks: [] }).plans).toEqual([]);
    expect(JSON.stringify(f.content)).toBe(before);
    expect(fixture().build({ characterPublicationAvailable: false }).plans).toHaveLength(1);
  });
});
