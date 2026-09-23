import { describe, expect, it, vi } from "vitest";
import { contentRecordHash, contentTextHash } from "../planet/contentExportHash";
import { createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialogueApproval, type BookyDialoguePayload, type BookyDialogueRecord, type BookyDialogueRequest } from "./bookyDialogueRegistry";
import { bookyJourneyDialogueContext, bookyJourneyEntityId, compileBookyJourney, getBookyJourneyChecksum, parseBookyJourneyPlanOverview,
  type BookyJourneyContext, type BookyJourneyDefinition, type BookyJourneyTrust } from "./bookyJourney";
import type { Country, BookArchiveEntry } from "../planet/types";
import { getBookyJourneyFactChecksum, type BookyJourneyFactSpec } from "./bookyJourneyFact";

const now = "2026-09-20T12:00:00.000Z", reviewedAt = "2026-09-19T12:00:00.000Z";
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function fixture(locale: "ru" | "en" = "en", withActivity = false) {
  // Synthetic catalog and review fixtures only. No production journey, real
  // entity, factual attribution, editorial approval or rights grant is seeded.
  const country: Country = { id: "test-country", name: "Synthetic country", coordinates: { lat: 20, lng: 30 }, writers: [{ id: "test-writer" }] };
  const book: BookArchiveEntry = { id: "test-work", title: "Synthetic work", countryId: country.id, countryName: country.name,
    writerId: "test-writer", writerName: "Synthetic writer", country, writer: country.writers[0], editorial: { status: "verified" } };
  if (withActivity) {
    Object.assign(country.writers[0], { name: "Тестовый владелец", fullName: "Synthetic Archive Owner" });
    country.writers.push({ id: "actual-author", name: "Тестовый автор", fullName: "Synthetic Factual Author" });
    book.authorship = { kind: "single", authors: [{ countryId: country.id, writerId: "actual-author", attribution: "credited" }] };
  }
  const nodes: BookyJourneyDefinition["nodes"] = [
    { id: "country", kind: "country", entity: { kind: "country", countryId: country.id }, screen: "globe", dialogue: { id: "test-country-line", version: 1, contentChecksum: "" } },
    { id: "writer", kind: "writer", entity: { kind: "writer", countryId: country.id, writerId: "test-writer" }, screen: "globe", dialogue: { id: "test-writer-line", version: 1, contentChecksum: "" } },
    { id: "work", kind: "work", entity: { kind: "work", countryId: country.id, writerId: "test-writer", workId: book.id }, screen: "collection", dialogue: { id: "test-work-line", version: 1, contentChecksum: "" } },
    ...(withActivity ? [{ id: "activity", kind: "activity" as const, entity: null, screen: "globe" as const,
      dialogue: { id: "test-activity-line", version: 1, contentChecksum: "" }, activity: {
        schemaVersion: 1 as const, id: "test-author-task", version: 1, type: "match-work-author" as const,
        targetWork: { kind: "work" as const, countryId: country.id, writerId: "test-writer", workId: book.id },
        choices: ["test-writer", "actual-author"].map((writerId, index) => ({ id: `choice-${index}`,
          writer: { kind: "writer" as const, countryId: country.id, writerId } })),
      } }] : []),
    { id: "checkpoint", kind: "checkpoint", entity: null, screen: "collection", dialogue: { id: "test-checkpoint-line", version: 1, contentChecksum: "" } },
  ];
  const records: BookyDialogueRecord[] = nodes.map(node => {
    const copy = { title: locale === "ru" ? "Проверка" : "Test", body: locale === "ru" ? "Текст тестового интерфейса." : "Synthetic interface text.", caption: "Synthetic caption", reduced: "Test" };
    const payload: BookyDialoguePayload = { id: node.dialogue.id, locale, version: 1, audience: "adult", ageRange: { min: 18, max: 120 },
      readingLevel: "plain", intent: node.activity ? "activity" : "navigation", screens: [node.screen], context: bookyJourneyDialogueContext("test-journey", node)!,
      entityIds: node.activity ? [node.activity.targetWork, ...node.activity.choices.map(choice => choice.writer)].map(bookyJourneyEntityId)
        : node.entity ? [bookyJourneyEntityId(node.entity)] : [], claimKind: "interface-guidance", factualSources: [], copy,
      narration: null, prohibitedTags: [], provenance: { kind: "editorial", sourcePath: "test/fixture.ts", sourceVersion: 1,
        sourceRef: node.id, sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
    const review = { status: "approved" as const, reviewer: "synthetic-reviewer-not-real", reviewedAt, contentChecksum: getBookyDialogueContentChecksum(payload)! };
    return { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
  });
  const approvals: BookyDialogueApproval[] = records.map(record => ({ id: record.payload.id, locale, version: 1,
    contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt }));
  const definition: BookyJourneyDefinition = { schemaVersion: 1, id: "test-journey", version: 1, locale, audience: "adult",
    ageRange: { min: 18, max: 120 }, readingLevel: "plain", title: locale === "ru" ? "Тестовый маршрут" : "Synthetic journey",
    prerequisites: [{ id: "test-prerequisite", version: 1 }],
    nodes: nodes.map((node, index) => ({ ...node, dialogue: { ...node.dialogue, contentChecksum: records[index].review.contentChecksum } })) };
  const context: BookyJourneyContext = { audience: "adult", age: 30, locale, readingLevel: "plain", now, connectivity: "online",
    completedPrerequisites: [{ id: "test-prerequisite", version: 1 }],
    availability: definition.nodes.map(node => ({ nodeId: node.id, locale, dialogueContentChecksum: node.dialogue.contentChecksum, available: true, offlineAvailable: true })) };
  const trust: BookyJourneyTrust = { currentVersions: [{ id: definition.id, version: 1 }], approvedReviews: [
    { id: definition.id, version: 1, locale, definitionChecksum: getBookyJourneyChecksum(definition)!, reviewer: "synthetic-journey-reviewer-not-real", reviewedAt },
  ], dialogueRegistry: createBookyDialogueRegistry(records, { canonicalEntityIds: [...new Set(records.flatMap(record => [...record.payload.entityIds]))], approvedReviews: approvals }),
  publicCountries: [country], publicBooks: [book] };
  const compile = (input: unknown = definition, request: unknown = context, policy = trust) => compileBookyJourney(input, request, policy);
  const reseal = (input: BookyJourneyDefinition): BookyJourneyTrust => ({ ...trust, approvedReviews: trust.approvedReviews.map(approval => ({ ...approval, definitionChecksum: getBookyJourneyChecksum(input)! })) });
  return { definition, context, trust, country, book, records, compile, reseal };
}

function factFixture(locale: "ru" | "en" = "en", anchorIndex = 1) {
  const base = fixture(locale), anchor = base.definition.nodes[anchorIndex];
  const placeholder: BookyJourneyFactSpec = { schemaVersion: 1, id: "test-fact", version: 1, dialogues: [
    { locale: "ru", id: "test-fact-line", version: 1, contentChecksum: "a".repeat(64) },
    { locale: "en", id: "test-fact-line", version: 1, contentChecksum: "b".repeat(64) },
  ] };
  const seed: BookyJourneyDefinition["nodes"][number] = { id: "fact", kind: "sourced-fact", entity: anchor.entity, screen: anchor.screen,
    dialogue: { id: "test-fact-line", version: 1, contentChecksum: "a".repeat(64) }, fact: placeholder };
  const factRecords = (["ru", "en"] as const).map(locale => {
    const copy = { title: `${locale}: synthetic fact`, body: "Synthetic sourced fixture, not a production assertion.", caption: "Test fact", reduced: "Test" };
    const payload: BookyDialoguePayload = { ...base.records[0].payload, id: "test-fact-line", locale, intent: "sourced-fact", screens: [seed.screen],
      context: bookyJourneyDialogueContext(base.definition.id, seed)!, entityIds: [bookyJourneyEntityId(seed.entity!)],
      claimKind: "factual", factualSources: [{ id: "synthetic-source", url: "https://example.org/test-only", accessedAt: reviewedAt }], copy,
      provenance: { ...base.records[0].payload.provenance, copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
    const review = { status: "approved" as const, reviewer: "synthetic-fact-reviewer-not-real", reviewedAt,
      contentChecksum: getBookyDialogueContentChecksum(payload)! };
    return { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
  });
  const spec: BookyJourneyFactSpec = { ...placeholder, dialogues: [
    { ...placeholder.dialogues[0], contentChecksum: factRecords[0].review.contentChecksum },
    { ...placeholder.dialogues[1], contentChecksum: factRecords[1].review.contentChecksum },
  ] };
  const binding = spec.dialogues.find(item => item.locale === locale)!;
  const fact = { ...seed, fact: spec, dialogue: { id: binding.id, version: binding.version, contentChecksum: binding.contentChecksum } };
  const definition = { ...base.definition, nodes: [...base.definition.nodes.slice(0, anchorIndex + 1), fact, ...base.definition.nodes.slice(anchorIndex + 1)] };
  const records = [...base.records, ...factRecords];
  const registryFor = (values: readonly BookyDialogueRecord[] = records, omittedApproval = "") => createBookyDialogueRegistry(values, {
    canonicalEntityIds: [...new Set(records.flatMap(record => [...record.payload.entityIds]))],
    approvedReviews: values.filter(record => `${record.payload.locale}:${record.payload.id}` !== omittedApproval).map(record => ({
      id: record.payload.id, locale: record.payload.locale, version: record.payload.version,
      contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt })),
  });
  const trust = { ...base.reseal(definition), dialogueRegistry: registryFor() };
  const context = { ...base.context, availability: definition.nodes.map(node => ({ nodeId: node.id, locale,
    dialogueContentChecksum: node.dialogue.contentChecksum, available: true, offlineAvailable: true })) };
  const reseal = (input: BookyJourneyDefinition) => ({ ...trust, approvedReviews: trust.approvedReviews.map(receipt => ({ ...receipt,
    definitionChecksum: getBookyJourneyChecksum(input)! })) });
  const compile = (input: BookyJourneyDefinition = definition, current = context, policy = trust) => compileBookyJourney(input, current, policy);
  const reordered = (nodes: BookyJourneyDefinition["nodes"]) => {
    const candidate = { ...definition, nodes };
    return compile(candidate, { ...context, availability: context.availability.filter(item => nodes.some(node => node.id === item.nodeId)) }, reseal(candidate));
  };
  return { ...base, definition, context, trust, records, factRecords, spec, fact, compile, reseal, reordered, registryFor };
}

describe("guarded adult Booky journey plans", () => {
  it.each(["ru", "en"] as const)("compiles only the complete reviewed %s plan with canonical coordinates", locale => {
    const f = fixture(locale), result = f.compile()!;
    expect(result).not.toBeNull();
    expect(result.nodes.map(node => node.kind)).toEqual(["country", "writer", "work", "checkpoint"]);
    expect(result.nodes[0].coordinates).toEqual([20, 30]);
    expect(result.nodes[1].coordinates).toBeNull();
    expect(result.definitionChecksum).toBe(getBookyJourneyChecksum(f.definition));
    expect(Object.isFrozen(result.nodes[0].entity)).toBe(true);
    expect(Object.isFrozen(result.nodes[0].coordinates)).toBe(true);
    expect(Object.isFrozen(result.nodes[0].dialogue.payload.copy)).toBe(true);
    f.country.coordinates = [1, 2];
    expect(result.nodes[0].coordinates).toEqual([20, 30]);
  });

  it("requires independent whole-definition approval and the current version", () => {
    const f = fixture();
    expect(f.compile(undefined, undefined, { ...f.trust, approvedReviews: [] })).toBeNull();
    expect(f.compile(undefined, undefined, { ...f.trust, currentVersions: [] })).toBeNull();
    expect(f.compile(undefined, undefined, { ...f.trust, currentVersions: [{ id: "test-journey", version: 2 }] })).toBeNull();
    for (const change of [{ title: "Edited" }, { version: 2 }, { locale: "ru" }, { ageRange: { min: 19, max: 120 } },
      { prerequisites: [] }, { nodes: [...f.definition.nodes].reverse() }]) expect(f.compile({ ...f.definition, ...change })).toBeNull();
    for (const change of [{ reviewedAt: "2026-09-21T00:00:00.000Z" }, { definitionChecksum: "b".repeat(64) }, { locale: "ru" as const }, { reviewer: "" }]) {
      expect(f.compile(undefined, undefined, { ...f.trust, approvedReviews: [{ ...f.trust.approvedReviews[0], ...change }] })).toBeNull();
    }
  });

  it("does not reinterpret language, age, child access, reading level or prerequisite versions", () => {
    const f = fixture();
    for (const change of [{ locale: "ru" }, { audience: "child", age: 12 }, { age: 17 }, { age: 121 }, { age: 30.5 },
      { readingLevel: "fluent" }, { completedPrerequisites: [] }, { completedPrerequisites: [{ id: "test-prerequisite", version: 2 }] }]) {
      expect(f.compile(undefined, { ...f.context, ...change })).toBeNull();
    }
    const child = { ...f.definition, audience: "child" as const, ageRange: { min: 6, max: 12 } };
    expect(f.compile(child, { ...f.context, audience: "child", age: 8 }, f.reseal(child))).toBeNull();
    expect(f.compile(undefined, { ...f.context, age: 18 })).not.toBeNull();
    expect(f.compile(undefined, { ...f.context, age: 120 })).not.toBeNull();
  });

  it("requires every node available in the same locale and offline-ready when disconnected or unknown", () => {
    const f = fixture();
    for (const connectivity of ["offline", "unknown"] as const) {
      expect(f.compile(undefined, { ...f.context, connectivity })).not.toBeNull();
      expect(f.compile(undefined, { ...f.context, connectivity, availability: f.context.availability.map((item, index) => index === 2 ? { ...item, offlineAvailable: false } : item) })).toBeNull();
    }
    for (const availability of [f.context.availability.slice(1), [...f.context.availability, f.context.availability[0]],
      f.context.availability.map((item, index) => index === 2 ? { ...item, available: false } : item),
      f.context.availability.map((item, index) => index === 2 ? { ...item, dialogueContentChecksum: "a".repeat(64) } : item),
      f.context.availability.map((item, index) => index === 2 ? { ...item, locale: "ru" } : item)]) {
      expect(f.compile(undefined, { ...f.context, availability })).toBeNull();
    }
  });

  it("resolves current public parents instead of the embedded pre-quarantine book writer", () => {
    const f = fixture();
    expect(f.compile(undefined, undefined, { ...f.trust, publicCountries: [] })).toBeNull();
    expect(f.compile(undefined, undefined, { ...f.trust, publicCountries: [{ ...f.country, writers: [] }] })).toBeNull();
    expect(f.compile(undefined, undefined, { ...f.trust, publicBooks: [] })).toBeNull();
    for (const book of [{ ...f.book, countryId: "other" }, { ...f.book, writerId: "other" }, { ...f.book, editorial: { status: "draft" as const } }]) {
      expect(f.compile(undefined, undefined, { ...f.trust, publicBooks: [book] })).toBeNull();
    }
    expect(f.compile(undefined, undefined, { ...f.trust, publicBooks: [f.book, f.book] })).toBeNull();
    expect(f.compile(undefined, undefined, { ...f.trust, publicCountries: [f.country, f.country] })).toBeNull();
  });

  it("rejects skipped/out-of-order parents and coordinates supplied by a candidate", () => {
    const f = fixture();
    const reordered = { ...f.definition, nodes: [f.definition.nodes[0], f.definition.nodes[2], f.definition.nodes[1], f.definition.nodes[3]] };
    expect(f.compile(reordered, undefined, f.reseal(reordered))).toBeNull();
    const overridden = { ...f.definition, nodes: [{ ...f.definition.nodes[0], coordinates: [10, 20] }, ...f.definition.nodes.slice(1)] };
    expect(getBookyJourneyChecksum(overridden)).toBeNull();
    for (const coordinates of [undefined, [91, 0], [0, 181], { lat: NaN, lng: 0 }]) {
      expect(f.compile(undefined, undefined, { ...f.trust, publicCountries: [{ ...f.country, coordinates: coordinates as Country["coordinates"] }] })).toBeNull();
    }
    expect(f.compile(undefined, undefined, { ...f.trust, publicCountries: [{ ...f.country, coordinates: [20, 30] }] })).not.toBeNull();
  });

  it("requires approved exact dialogue versions and checksums without partial fallback", () => {
    const f = fixture();
    expect(f.compile(undefined, undefined, { ...f.trust, dialogueRegistry: createBookyDialogueRegistry(f.records) })).toBeNull();
    for (const change of [{ id: "unknown-line" }, { version: 2 }, { contentChecksum: "f".repeat(64) }]) {
      const definition = { ...f.definition, nodes: f.definition.nodes.map((node, index) => index === 2 ? { ...node, dialogue: { ...node.dialogue, ...change } } : node) };
      expect(f.compile(definition, undefined, f.reseal(definition))).toBeNull();
    }
    const wrongScreen = { ...f.definition, nodes: f.definition.nodes.map((node, index) => index === 3 ? { ...node, screen: "globe" as const } : node) };
    expect(f.compile(wrongScreen, undefined, f.reseal(wrongScreen))).toBeNull();
  });

  it("rejects hostile, oversized and ambiguous input without invoking accessors", () => {
    const f = fixture(), getter = vi.fn(() => { throw new Error("must not execute"); });
    const hostile = Object.defineProperty({ ...f.definition }, "title", { get: getter, enumerable: true });
    const sparse = clone(f.definition) as unknown as { nodes: unknown[] }; delete sparse.nodes[1];
    for (const definition of [hostile, sparse, { ...f.definition, schemaVersion: 2 }, { ...f.definition, [Symbol("extra")]: true },
      { ...f.definition, nodes: [...f.definition.nodes, f.definition.nodes[3]] }, { ...f.definition, title: "x".repeat(2049) }]) {
      expect(f.compile(definition)).toBeNull();
    }
    expect(getter).not.toHaveBeenCalled();
    expect(f.compile(undefined, undefined, { ...f.trust, dialogueRegistry: { size: 0, rejections: [], resolve() { throw new Error("unavailable"); } } })).toBeNull();
  });

  it("snapshots the whole definition before any injected registry call can mutate its owner", () => {
    const f = fixture(), mutable = JSON.parse(JSON.stringify(f.definition)) as { title: string; nodes: unknown[] };
    const registry = f.trust.dialogueRegistry;
    const result = f.compile(mutable, undefined, { ...f.trust, dialogueRegistry: {
      size: registry.size, rejections: registry.rejections, resolve(request) {
        mutable.title = "Changed after admission started"; mutable.nodes.length = 0;
        return registry.resolve(request);
      },
    } })!;
    expect(result.title).toBe(f.definition.title);
    expect(result.nodes).toHaveLength(4);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.nodes)).toBe(true);
  });
});

describe("reviewed activity nodes in whole Booky journeys", () => {
  it.each(["ru", "en"] as const)("compiles immutable %s activity answers and canonical localized choices", locale => {
    const f = fixture(locale, true), plan = f.compile()!, node = plan.nodes[3];
    expect(plan.nodes.map(node => node.kind)).toEqual(["country", "writer", "work", "activity", "checkpoint"]);
    expect(node).toMatchObject({ kind: "activity", screen: "globe", entity: null, coordinates: null,
      activity: { correctChoiceId: "choice-1", spec: { type: "match-work-author" } } });
    expect(node.activityChoices).toEqual(locale === "en" ? [
      { id: "choice-0", label: "Synthetic Archive Owner" }, { id: "choice-1", label: "Synthetic Factual Author" },
    ] : [{ id: "choice-0", label: "Тестовый владелец" }, { id: "choice-1", label: "Тестовый автор" }]);
    expect(node.dialogue.payload.intent).toBe("activity");
    expect(node.dialogue.payload.context).toBe(bookyJourneyDialogueContext(f.definition.id, f.definition.nodes[3]));
    expect(node.dialogue.payload.context).toMatch(/^activity:[a-f0-9]{64}$/u);
    for (const value of [node, node.activity, node.activity!.spec, node.activityChoices, node.activityChoices![0]]) expect(Object.isFrozen(value)).toBe(true);
    for (const ordinary of plan.nodes.filter(node => node.kind !== "activity")) {
      expect(Object.keys(ordinary).sort()).toEqual(["coordinates", "dialogue", "entity", "id", "kind", "screen"]);
    }
  });

  it("binds both journey and dialogue review to the exact raw activity spec", () => {
    const f = fixture("en", true), activity = f.definition.nodes[3];
    const changed = { ...f.definition, nodes: f.definition.nodes.map(node => node === activity
      ? { ...node, activity: { ...node.activity!, choices: [...node.activity!.choices].reverse() } } : node) };
    expect(getBookyJourneyChecksum(changed)).not.toBe(getBookyJourneyChecksum(f.definition));
    expect(bookyJourneyDialogueContext(f.definition.id, changed.nodes[3])).not.toBe(bookyJourneyDialogueContext(f.definition.id, activity));
    expect(f.compile(changed)).toBeNull();
    // A new journey receipt alone cannot reuse the old task's dialogue receipt.
    expect(f.compile(changed, undefined, f.reseal(changed))).toBeNull();
    expect(f.compile(undefined, undefined, { ...f.trust, approvedReviews: [] })).toBeNull();
    const registry = createBookyDialogueRegistry(f.records, { canonicalEntityIds: [...new Set(f.records.flatMap(record => [...record.payload.entityIds]))],
      approvedReviews: f.records.filter(record => record.payload.intent !== "activity").map(record => ({
        id: record.payload.id, locale: record.payload.locale, version: record.payload.version,
        contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt })) });
    expect(f.compile(undefined, undefined, { ...f.trust, dialogueRegistry: registry })).toBeNull();
  });

  it("rejects malformed activity shapes while retaining exact old navigation definitions", () => {
    const f = fixture("en", true), activity = f.definition.nodes[3];
    for (const bad of [{ ...activity, activity: undefined }, { ...activity, entity: f.definition.nodes[0].entity },
      { ...activity, screen: "collection" }, { ...activity, activityChoices: [{ id: "choice-0", label: "Forged" }] },
      { ...activity, activity: { ...activity.activity, correctChoiceId: "choice-0" } },
    ]) expect(getBookyJourneyChecksum({ ...f.definition, nodes: [...f.definition.nodes.slice(0, 3), bad, f.definition.nodes[4]] })).toBeNull();
    expect(getBookyJourneyChecksum({ ...f.definition, nodes: f.definition.nodes.map((node, index) => index === 0
      ? { ...node, activity: activity.activity } : node) })).toBeNull();
    const legacy = fixture(); expect(legacy.compile()).not.toBeNull();
    expect(legacy.definition.nodes.every(node => !Object.prototype.hasOwnProperty.call(node, "activity"))).toBe(true);
  });

  it("derives a new semantic answer when factual authorship changes, and rejects revoked relations", () => {
    const f = fixture("en", true), before = f.compile()!;
    f.book.authorship!.authors[0].writerId = "test-writer";
    const after = f.compile()!;
    expect(after.definitionChecksum).toBe(before.definitionChecksum);
    expect(after.nodes[3].activity!.definitionChecksum).toBe(before.nodes[3].activity!.definitionChecksum);
    expect(after.nodes[3].activity!.semanticChecksum).not.toBe(before.nodes[3].activity!.semanticChecksum);
    expect(after.nodes[3].activity!.correctChoiceId).toBe("choice-0");
    f.book.authorship!.authors[0].writerId = "revoked-author"; expect(f.compile()).toBeNull();
    expect(f.compile(undefined, undefined, { ...f.trust, publicBooks: [] })).toBeNull();
  });

  it("requires distinct usable names in the current locale, never an arbitrary ID label", () => {
    const f = fixture("en", true), author = f.country.writers[1];
    author.name = "Только кириллица"; delete author.fullName;
    expect(f.compile()).toBeNull();
    author.fullName = "  SYNTHETIC   ARCHIVE OWNER  "; expect(f.compile()).toBeNull();
    author.fullName = "Synthetic Factual Author"; expect(f.compile()).not.toBeNull();
    const getter = vi.fn(() => "Forged label"); Object.defineProperty(author, "fullName", { get: getter, enumerable: true });
    expect(f.compile()).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });

  it("checks activity availability, policy and relation changes from later dialogue callbacks", () => {
    const f = fixture("en", true);
    const availability = f.context.availability.map(item => item.nodeId === "activity" ? { ...item, offlineAvailable: false } : item);
    expect(f.compile(undefined, { ...f.context, connectivity: "offline", availability })).toBeNull();
    expect(f.compile(undefined, { ...f.context, connectivity: "online", availability })).not.toBeNull();
    expect(f.compile(undefined, { ...f.context, audience: "child", age: 12 })).toBeNull();
    const registry = f.trust.dialogueRegistry;
    expect(f.compile(undefined, undefined, { ...f.trust, dialogueRegistry: { ...registry, resolve(request) {
      if ((request as BookyDialogueRequest).id === "test-checkpoint-line") f.book.authorship!.authors[0].writerId = "test-writer";
      return registry.resolve(request);
    } } })).toBeNull();
  });
});

describe("optional reviewed journey overview", () => {
  const overview = { description: "A synthetic introduction to this route.", estimatedDurationMinutes: 12 };

  it.each(["ru", "en"] as const)("retains explicit reviewed %s copy and duration without deriving a duration from nodes", locale => {
    const f = fixture(locale), description = locale === "ru" ? "Описание тестового маршрута." : overview.description;
    const definition = { ...f.definition, overview: { description, estimatedDurationMinutes: 27 } };
    const plan = f.compile(definition, undefined, f.reseal(definition))!;
    expect(plan.overview).toEqual({ description, estimatedDurationMinutes: 27, offlineAvailable: true });
    expect(Object.isFrozen(plan.overview)).toBe(true);
    expect(plan.overview).not.toBe(definition.overview);
    expect(plan.nodes).toHaveLength(4);
    expect(plan.definitionChecksum).toBe(getBookyJourneyChecksum(definition));
  });

  it("binds description and explicit estimate to the exact independent whole-definition receipt", () => {
    const f = fixture(), definition = { ...f.definition, overview };
    expect(f.compile(definition)).toBeNull();
    const trust = f.reseal(definition);
    expect(f.compile(definition, undefined, trust)).not.toBeNull();
    for (const changed of [{ ...overview, description: "An edited introduction." }, { ...overview, estimatedDurationMinutes: 13 }]) {
      const edited = { ...definition, overview: changed };
      expect(getBookyJourneyChecksum(edited)).not.toBe(getBookyJourneyChecksum(definition));
      expect(f.compile(edited, undefined, trust)).toBeNull();
    }
  });

  it("rejects partial, excessive, invented offline claims and hostile authored overview data", () => {
    const f = fixture(), getter = vi.fn(() => { throw Error("must not execute"); });
    const hostile = Object.defineProperty({ ...overview }, "description", { get: getter, enumerable: true });
    for (const invalid of [undefined, null, {}, { description: "Only description" }, { ...overview, extra: true },
      { ...overview, offlineAvailable: true }, { ...overview, description: "" }, { ...overview, description: " padded " },
      { ...overview, description: "x".repeat(801) }, { ...overview, description: "line\nbreak" }, hostile,
      ...[0, -1, 1.5, 1441, NaN, Infinity, "12"].map(estimatedDurationMinutes => ({ ...overview, estimatedDurationMinutes })),
    ]) expect(getBookyJourneyChecksum({ ...f.definition, overview: invalid })).toBeNull();
    const accessor = Object.defineProperty({ ...f.definition }, "overview", { get: getter, enumerable: true });
    expect(getBookyJourneyChecksum(accessor)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    for (const minutes of [1, 1440]) expect(getBookyJourneyChecksum({ ...f.definition,
      overview: { description: "x".repeat(800), estimatedDurationMinutes: minutes } })).not.toBeNull();
  });

  it("derives offline availability from every exact admitted entry and never changes the reviewed definition", () => {
    const f = fixture(), definition = { ...f.definition, overview }, trust = f.reseal(definition);
    const full = f.compile(definition, undefined, trust)!;
    for (let index = 0; index < f.context.availability.length; index++) {
      const availability = f.context.availability.map((item, position) => position === index ? { ...item, offlineAvailable: false } : item);
      const online = f.compile(definition, { ...f.context, availability }, trust)!;
      expect(online.overview).toEqual({ ...overview, offlineAvailable: false });
      expect(online.definitionChecksum).toBe(full.definitionChecksum);
      for (const connectivity of ["offline", "unknown"] as const) expect(f.compile(definition,
        { ...f.context, connectivity, availability }, trust)).toBeNull();
    }
    for (const connectivity of ["offline", "unknown"] as const) expect(f.compile(definition,
      { ...f.context, connectivity }, trust)?.overview?.offlineAvailable).toBe(true);
  });

  it("exposes no overview when any availability entry is missing, stale, duplicated or unavailable", () => {
    const f = fixture(), definition = { ...f.definition, overview }, trust = f.reseal(definition);
    const entries = f.context.availability;
    for (const availability of [entries.slice(1), [...entries, entries[0]],
      entries.map((item, index) => index ? item : { ...item, available: false }),
      entries.map((item, index) => index ? item : { ...item, dialogueContentChecksum: "b".repeat(64) }),
      entries.map((item, index) => index ? item : { ...item, locale: "ru" }),
    ]) expect(f.compile(definition, { ...f.context, availability }, trust)).toBeNull();
  });

  it("captures overview and availability before an injected resolver can mutate input owners", () => {
    const f = fixture(), definition = { ...f.definition, overview: { ...overview } }, context = clone(f.context);
    const registry = f.trust.dialogueRegistry, trust = { ...f.reseal(definition), dialogueRegistry: { ...registry, resolve(request: unknown) {
      definition.overview.description = "Changed after capture";
      Reflect.set(context.availability[0], "offlineAvailable", false);
      return registry.resolve(request);
    } } };
    const plan = f.compile(definition, context, trust)!;
    expect(plan.overview).toEqual({ ...overview, offlineAvailable: true });
    expect(plan.definitionChecksum).toBe(trust.approvedReviews[0].definitionChecksum);
  });

  it("preserves the original six compiled fields and authored hash when overview is absent", () => {
    const f = fixture(), before = JSON.stringify(f.definition), plan = f.compile()!;
    expect(Object.keys(plan).sort()).toEqual(["definitionChecksum", "id", "locale", "nodes", "title", "version"]);
    expect(Object.prototype.hasOwnProperty.call(plan, "overview")).toBe(false);
    expect(getBookyJourneyChecksum(f.definition)).toBe(contentRecordHash(f.definition));
    expect(JSON.stringify(f.definition)).toBe(before);
  });

  it("provides a strict immutable compiled-shape parser without granting reviewed or offline authority", () => {
    const valid = { ...overview, offlineAvailable: false }, parsed = parseBookyJourneyPlanOverview(valid)!;
    expect(parsed).toEqual(valid); expect(parsed).not.toBe(valid); expect(Object.isFrozen(parsed)).toBe(true);
    const getter = vi.fn(() => true), accessor = Object.defineProperty({ ...valid }, "offlineAvailable", { get: getter, enumerable: true });
    for (const value of [overview, { ...valid, offlineAvailable: 1 }, { ...valid, description: "" },
      { ...valid, estimatedDurationMinutes: 0 }, { ...valid, extra: true }, accessor, Object.create(valid), null]) {
      expect(parseBookyJourneyPlanOverview(value)).toBeNull();
    }
    expect(getter).not.toHaveBeenCalled();
  });
});

describe("reviewed sourced-fact journey nodes", () => {
  it.each(["ru", "en"] as const)("admits exact %s country, writer and work anchors with sourced copy", locale => {
    for (const anchorIndex of [0, 1, 2]) {
      const f = factFixture(locale, anchorIndex), plan = f.compile()!, node = plan.nodes[anchorIndex + 1];
      expect(node.kind).toBe("sourced-fact"); expect(node.entity).toEqual(f.fact.entity);
      expect(node.coordinates).toEqual(anchorIndex === 0 ? [20, 30] : null);
      expect(node.screen).toBe(anchorIndex === 2 ? "collection" : "globe");
      expect(node.fact).toEqual({ spec: f.spec, semanticChecksum: getBookyJourneyFactChecksum(f.spec, f.fact.entity!, f.fact.screen) });
      expect(Object.keys(node).sort()).toEqual(["coordinates", "dialogue", "entity", "fact", "id", "kind", "screen"]);
      expect(node.dialogue.payload).toMatchObject({ locale, intent: "sourced-fact", claimKind: "factual", provenance: { kind: "editorial" } });
      expect(node.dialogue.payload.factualSources).toHaveLength(1);
      for (const value of [node.fact, node.fact!.spec, node.fact!.spec.dialogues, node.fact!.spec.dialogues[0]]) expect(Object.isFrozen(value)).toBe(true);
      expect(node.fact!.spec).not.toBe(f.spec);
    }
  });

  it("avoids recursive dialogue hashes while binding both locales and the canonical anchor to semantic identity", () => {
    const ru = factFixture("ru"), en = factFixture("en");
    expect(ru.compile()!.nodes[2].fact!.semanticChecksum).toBe(en.compile()!.nodes[2].fact!.semanticChecksum);
    const changed = { ...en.fact, fact: { ...en.spec, dialogues: [
      { ...en.spec.dialogues[0], contentChecksum: "c".repeat(64) }, en.spec.dialogues[1],
    ] as BookyJourneyFactSpec["dialogues"] } };
    expect(bookyJourneyDialogueContext(en.definition.id, changed)).toBe(bookyJourneyDialogueContext(en.definition.id, en.fact));
    expect(getBookyJourneyFactChecksum(changed.fact, changed.entity!, changed.screen)).not.toBe(getBookyJourneyFactChecksum(en.spec, en.fact.entity!, en.fact.screen));
    expect(bookyJourneyDialogueContext(en.definition.id, en.fact)).toMatch(/^fact:[a-f0-9]{64}$/u);
    expect(bookyJourneyDialogueContext(en.definition.id, { ...en.fact, fact: { ...en.spec, version: 2 } })).not.toBe(bookyJourneyDialogueContext(en.definition.id, en.fact));
  });

  it("requires independent whole-journey and exact current-locale sourced-dialogue review", () => {
    const f = factFixture();
    expect(f.compile(undefined, undefined, { ...f.trust, approvedReviews: [] })).toBeNull();
    expect(f.compile(undefined, undefined, { ...f.trust, dialogueRegistry: f.registryFor(undefined, "en:test-fact-line") })).toBeNull();
    for (const fields of [{ id: "test-country-line" }, { version: 2 }, { contentChecksum: "f".repeat(64) }]) {
      const candidate = { ...f.definition, nodes: f.definition.nodes.map(node => node.id === "fact" ? { ...node, dialogue: { ...node.dialogue, ...fields } } : node) };
      expect(getBookyJourneyChecksum(candidate)).toBeNull();
    }
    const editedFact = { ...f.fact, fact: { ...f.spec, dialogues: [
      { ...f.spec.dialogues[0], contentChecksum: "c".repeat(64) }, f.spec.dialogues[1],
    ] as BookyJourneyFactSpec["dialogues"] } };
    const candidate = { ...f.definition, nodes: f.definition.nodes.map(node => node.id === "fact" ? editedFact : node) };
    expect(getBookyJourneyChecksum(candidate)).not.toBe(getBookyJourneyChecksum(f.definition));
    expect(f.compile(candidate)).toBeNull();
  });

  it("requires prior exact navigation context and never establishes it merely by a fact", () => {
    const writer = factFixture("en", 1), work = factFixture("en", 2);
    expect(writer.reordered(writer.definition.nodes.filter(node => node.kind !== "writer"))).toBeNull();
    expect(work.reordered(work.definition.nodes.filter(node => node.kind !== "work"))).toBeNull();
    const [countryNode, writerNode, workNode, factNode, checkpoint] = work.definition.nodes;
    expect(work.reordered([countryNode, writerNode, factNode, workNode, checkpoint])).toBeNull();
    // A fact about the active country does not reset an already navigated writer.
    const country = factFixture("en", 0), [first, fact, writerStep, workStep, end] = country.definition.nodes;
    expect(country.reordered([first, writerStep, fact, workStep, end])).not.toBeNull();
    // An ordinary country selection still clears the prior writer/work context.
    const originalLine = work.records.find(record => record.payload.id === countryNode.dialogue.id)!;
    const payload: BookyDialoguePayload = { ...originalLine.payload, id: "test-repeat-country-line", context: "test-journey:repeat-country" };
    const review = { ...originalLine.review, contentChecksum: getBookyDialogueContentChecksum(payload)! };
    const repeatedLine = { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
    const repeatCountry = { ...countryNode, id: "repeat-country", dialogue: { id: payload.id, version: payload.version, contentChecksum: review.contentChecksum } };
    const altered = { ...work.definition, nodes: [countryNode, writerNode, workNode, repeatCountry, factNode, checkpoint] };
    const availability = altered.nodes.map(node => ({ nodeId: node.id, locale: "en" as const,
      dialogueContentChecksum: node.dialogue.contentChecksum, available: true, offlineAvailable: true }));
    expect(work.compile(altered, { ...work.context, availability }, { ...work.reseal(altered),
      dialogueRegistry: work.registryFor([...work.records, repeatedLine]) })).toBeNull();
  });

  it("rejects malformed fact nodes and keeps all old navigation/activity fields exact", () => {
    const f = factFixture();
    for (const fact of [{ ...f.fact, fact: undefined }, { ...f.fact, entity: null }, { ...f.fact, screen: "collection" },
      { ...f.fact, fact: { ...f.spec, unexpected: true } }, { ...f.fact, activity: {} },
      { ...f.fact, fact: { ...f.spec, dialogues: [...f.spec.dialogues].reverse() } },
    ]) expect(getBookyJourneyChecksum({ ...f.definition, nodes: f.definition.nodes.map(node => node.id === "fact" ? fact : node) })).toBeNull();
    const ordinary = fixture(), activity = fixture("en", true);
    expect(ordinary.compile()).not.toBeNull(); expect(activity.compile()).not.toBeNull();
    expect(ordinary.compile()!.nodes.every(node => !Object.prototype.hasOwnProperty.call(node, "fact"))).toBe(true);
    expect(getBookyJourneyChecksum({ ...ordinary.definition, nodes: ordinary.definition.nodes.map((node, index) => index ? node : { ...node, fact: f.spec }) })).toBeNull();
  });

  it("requires current exact canonical membership, reviewed work and whole-node offline availability", () => {
    const f = factFixture("en", 2);
    for (const change of [{ publicBooks: [] }, { publicBooks: [f.book, f.book] }, { publicCountries: [] },
      { publicBooks: [{ ...f.book, editorial: { status: "draft" as const } }] },
      { publicCountries: [{ ...f.country, writers: [] }] },
    ]) expect(f.compile(undefined, undefined, { ...f.trust, ...change })).toBeNull();
    const availability = f.context.availability.map(item => item.nodeId === "fact" ? { ...item, offlineAvailable: false } : item);
    expect(f.compile(undefined, { ...f.context, availability, connectivity: "online" })).not.toBeNull();
    expect(f.compile(undefined, { ...f.context, availability, connectivity: "offline" })).toBeNull();
  });

  it("rechecks a fact anchor after later dialogue callbacks revoke its canonical relation", () => {
    for (const anchorIndex of [0, 1, 2]) {
      const f = factFixture("en", anchorIndex), registry = f.trust.dialogueRegistry;
      const trust = { ...f.trust, dialogueRegistry: { ...registry, resolve(request: unknown) {
        if ((request as BookyDialogueRequest).id === "test-checkpoint-line") {
          if (anchorIndex === 0) f.country.coordinates = [21, 30];
          else if (anchorIndex === 1) f.country.writers.length = 0;
          else f.book.editorial = { status: "draft" };
        }
        return registry.resolve(request);
      } } };
      expect(f.compile(undefined, undefined, trust)).toBeNull();
    }
  });
});
