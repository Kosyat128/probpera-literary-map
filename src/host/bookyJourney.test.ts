import { describe, expect, it, vi } from "vitest";
import { contentTextHash } from "../planet/contentExportHash";
import { createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialogueApproval, type BookyDialoguePayload, type BookyDialogueRecord, type BookyDialogueRequest } from "./bookyDialogueRegistry";
import { bookyJourneyDialogueContext, bookyJourneyEntityId, compileBookyJourney, getBookyJourneyChecksum,
  type BookyJourneyContext, type BookyJourneyDefinition, type BookyJourneyTrust } from "./bookyJourney";
import type { Country, BookArchiveEntry } from "../planet/types";

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
