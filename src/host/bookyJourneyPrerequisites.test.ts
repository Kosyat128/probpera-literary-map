import { describe, expect, it, vi } from "vitest";
import { contentTextHash } from "../planet/contentExportHash";
import type { BookArchiveEntry, Country } from "../planet/types";
import type { BookyJourneyActivitySpec } from "./bookyJourneyActivity";
import { getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialoguePayload, type BookyDialogueRecord } from "./bookyDialogueRegistry";
import { bookyJourneyDialogueContext, bookyJourneyEntityId, getBookyJourneyChecksum, type BookyJourneyDefinition,
  type BookyJourneyPrerequisite } from "./bookyJourney";
import { createBookyJourneyCatalog } from "./bookyJourneyCatalog";
import { readBookyJourneyContent, type BookyJourneyContent } from "./bookyJourneyContent";
import { createBookyJourneyCatalogWithProgress, matchesBookyJourneyProgress, type BookyJourneyCatalogWithProgressOptions } from "./bookyJourneyPrerequisites";
import { createBookyJourneyProgressRecord, parseBookyJourneyProgress, type BookyJourneyProgressPreference,
  type BookyJourneyProgressRecord } from "./bookyJourneyProgress";
import type { BookyJourneyFactSpec } from "./bookyJourneyFact";
import { createBookyReaderPolicy } from "./bookyReaderPolicy";

const now = "2026-09-23T12:00:00.000Z", reviewedAt = "2026-09-22T12:00:00.000Z";
const policy = createBookyReaderPolicy({ age: 30, readingLevel: "plain" }, reviewedAt, 1)!;
const country: Country = { id: "test-country", name: "Synthetic country", coordinates: { lat: 20, lng: 30 },
  writers: [{ id: "test-writer", name: "Synthetic first writer", fullName: "Synthetic first writer" },
    { id: "other-writer", name: "Synthetic second writer", fullName: "Synthetic second writer" }] };
type Spec = { id: string; prerequisites?: readonly BookyJourneyPrerequisite[]; version?: number; locale?: "en" | "ru";
  writerId?: string; checkpointScreen?: "globe" | "collection"; title?: string; activity?: BookyJourneyActivitySpec };

/** Every entity, text and independent receipt below is synthetic test data.
 * The production content provider remains empty and acquires no approval. */
function fixture(specs: readonly Spec[] = [{ id: "test-base" }, { id: "test-next", prerequisites: [{ id: "test-base", version: 1 }] }]) {
  const definitions: BookyJourneyDefinition[] = [], dialogues: BookyDialogueRecord[] = [];
  for (const spec of specs) {
    const locale = spec.locale ?? "en", version = spec.version ?? 1;
    const nodes: BookyJourneyDefinition["nodes"][number][] = [
      { id: "country", kind: "country", screen: "globe", entity: { kind: "country", countryId: country.id },
        dialogue: { id: `${spec.id}-country`, version, contentChecksum: "" } },
      { id: "writer", kind: "writer", screen: "globe", entity: { kind: "writer", countryId: country.id, writerId: spec.writerId ?? "test-writer" },
        dialogue: { id: `${spec.id}-writer`, version, contentChecksum: "" } },
      { id: "checkpoint", kind: "checkpoint", screen: spec.checkpointScreen ?? "globe", entity: null,
        dialogue: { id: `${spec.id}-checkpoint`, version, contentChecksum: "" } },
    ];
    if (spec.activity) nodes.splice(2, 0, { id: "activity", kind: "activity", screen: "globe", entity: null,
      activity: spec.activity, dialogue: { id: `${spec.id}-activity`, version, contentChecksum: "" } });
    const records = nodes.map(node => {
      const copy = { title: locale === "ru" ? "Тест" : "Test", body: "Synthetic interface text.", caption: "Test", reduced: "Test" };
      const payload: BookyDialoguePayload = { id: node.dialogue.id, locale, version, audience: "adult",
        ageRange: { min: 18, max: 120 }, readingLevel: "plain", intent: node.kind === "activity" ? "activity" : "navigation", screens: [node.screen],
        context: bookyJourneyDialogueContext(spec.id, node)!, entityIds: node.kind === "activity"
          ? [...new Set([node.activity!.targetWork, ...node.activity!.choices.map(choice => choice.writer)].map(bookyJourneyEntityId))]
          : node.entity ? [bookyJourneyEntityId(node.entity)] : [],
        claimKind: "interface-guidance", factualSources: [], copy, narration: null, prohibitedTags: [],
        provenance: { kind: "editorial", sourcePath: "test/prerequisites.ts", sourceVersion: 1, sourceRef: node.id,
          sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
      const review = { status: "approved" as const, reviewer: "synthetic-reviewer-not-real", reviewedAt,
        contentChecksum: getBookyDialogueContentChecksum(payload)! };
      return { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
    });
    dialogues.push(...records);
    definitions.push({ schemaVersion: 1, id: spec.id, version, locale, audience: "adult", ageRange: { min: 18, max: 120 },
      readingLevel: "plain", title: spec.title ?? `Synthetic ${spec.id} ${locale}`, prerequisites: spec.prerequisites ?? [],
      nodes: nodes.map((node, index) => ({ ...node, dialogue: { ...node.dialogue, contentChecksum: records[index].review.contentChecksum } })) });
  }
  const currentVersions = [...new Map(definitions.map(definition => [definition.id, { id: definition.id, version: definition.version }])).values()];
  const content: BookyJourneyContent = { definitions, dialogues, currentVersions,
    dialogueApprovals: dialogues.map(record => ({ id: record.payload.id, version: record.payload.version, locale: record.payload.locale,
      contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt })),
    journeyApprovals: definitions.map(definition => ({ id: definition.id, version: definition.version, locale: definition.locale,
      definitionChecksum: getBookyJourneyChecksum(definition)!, reviewer: "synthetic-journey-reviewer-not-real", reviewedAt })),
    availability: definitions.map(definition => ({ journeyId: definition.id, version: definition.version, locale: definition.locale,
      nodes: definition.nodes.map(node => ({ nodeId: node.id, locale: definition.locale,
        dialogueContentChecksum: node.dialogue.contentChecksum, available: true, offlineAvailable: true })) })),
  };
  const books = [...new Map(specs.flatMap(spec => spec.activity ? [[bookyJourneyEntityId(spec.activity.targetWork),
    { id: spec.activity.targetWork.workId, countryId: spec.activity.targetWork.countryId, writerId: spec.activity.targetWork.writerId,
      editorial: { status: "verified" } } as BookArchiveEntry] as const] : [])).values()];
  const options: BookyJourneyCatalogWithProgressOptions = { content, policy, locale: "en", now, connectivity: "online",
    publicCountries: [country], publicBooks: books, progress: null };
  const historyCatalogs = new Map<"en" | "ru", ReturnType<typeof createBookyJourneyCatalog>>();
  function saved(id: string, locale: "en" | "ru" = "en", count = 3) {
    // Historical setup alone supplies the synthetic prerequisites explicitly.
    // The function under test must independently derive its own empty-seeded set.
    let catalog = historyCatalogs.get(locale);
    if (!catalog) {
      catalog = createBookyJourneyCatalog({ ...options, locale, completedPrerequisites: currentVersions });
      historyCatalogs.set(locale, catalog);
    }
    const plan = catalog.plans.find(plan => plan.id === id);
    if (!plan) throw new Error("invalid-synthetic-prerequisite-fixture");
    return createBookyJourneyProgressRecord(policy, plan, plan.nodes.slice(0, count).map(node => node.id), plan.nodes[count]?.id ?? null)!;
  }
  const build = (records: readonly BookyJourneyProgressRecord[] = [], override: Partial<BookyJourneyCatalogWithProgressOptions> = {}) =>
    createBookyJourneyCatalogWithProgress({ ...options, progress: preference(records), ...override });
  return { content, options, saved, build };
}
function preference(records: readonly BookyJourneyProgressRecord[]): BookyJourneyProgressPreference {
  return { schemaVersion: 1, audience: "adult", revision: 1, activeRecordId: records[0]?.recordId ?? null, records };
}
const ids = (result: ReturnType<typeof createBookyJourneyCatalogWithProgress>) => result.catalog.plans.map(plan => plan.id);

describe("Booky completed prerequisites require current full catalog admission", () => {
  it("keeps production empty and exposes base routes without any saved claims", () => {
    const f = fixture(), base = f.build();
    expect(ids(base)).toEqual(["test-base"]);
    expect(base.completedPrerequisites).toEqual([]);
    expect(f.build([f.saved("test-base")], { content: readBookyJourneyContent() }).catalog.plans).toEqual([]);
    expect(f.build([], { policy: null }).completedPrerequisites).toEqual([]);
  });

  it("grows a reversed 32-record chain from its seed and retains final source identity", () => {
    const specs = Array.from({ length: 32 }, (_, index) => ({ id: `test-route-${index}`,
      prerequisites: index ? [{ id: `test-route-${index - 1}`, version: 1 }] : [] }));
    const f = fixture(specs), saved = specs.map(spec => f.saved(spec.id)).reverse();
    const result = f.build(saved);
    expect(result.completedPrerequisites).toEqual(specs.map(spec => ({ id: spec.id, version: 1 })));
    expect(ids(result)).toEqual(specs.map(spec => spec.id));
    const last = result.catalog.plans[result.catalog.plans.length - 1], source = result.catalog.sourceFor(last)!;
    expect(source.completedPrerequisites).toEqual(result.completedPrerequisites);
    expect(result.catalog.sourceFor(last)).toBe(source);
    expect(result.catalog.sourceFor({ ...last })).toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.completedPrerequisites)).toBe(true);
    expect(Object.isFrozen(result.completedPrerequisites[0])).toBe(true);
  });

  it("never seeds a cycle or advances beyond a partial completed prefix", () => {
    const cycle = fixture([{ id: "test-a", prerequisites: [{ id: "test-b", version: 1 }] },
      { id: "test-b", prerequisites: [{ id: "test-a", version: 1 }] }]);
    expect(cycle.build([cycle.saved("test-a"), cycle.saved("test-b")]).completedPrerequisites).toEqual([]);
    expect(ids(cycle.build())).toEqual([]);
    const f = fixture();
    expect(ids(f.build([f.saved("test-base", "en", 2), f.saved("test-next")]))).toEqual(["test-base"]);
    expect(f.build([f.saved("test-base", "en", 2)]).completedPrerequisites).toEqual([]);
  });

  it("binds completion to exact confirmed policy, version, checksum and full semantic topology", () => {
    const f = fixture(), record = f.saved("test-base");
    const changedPolicy = createBookyReaderPolicy({ age: 31, readingLevel: "plain" }, reviewedAt, 2)!;
    expect(f.build([record], { policy: changedPolicy }).completedPrerequisites).toEqual([]);
    const changed = fixture([{ id: "test-base", title: "Independently reviewed changed title" },
      { id: "test-next", prerequisites: [{ id: "test-base", version: 1 }] }]);
    expect(changed.build([record]).completedPrerequisites).toEqual([]);
    const newer = fixture([{ id: "test-base", version: 2 }]);
    expect(newer.build([record]).completedPrerequisites).toEqual([]);
    const different = fixture([{ id: "test-base", writerId: "other-writer" }]);
    const forged = { ...record, definitionChecksum: different.saved("test-base").definitionChecksum };
    expect(parseBookyJourneyProgress(preference([forged]))).not.toBeNull();
    expect(different.build([forged]).completedPrerequisites).toEqual([]);
  });

  it("requires fresh whole-route review, availability and public membership even for completed history", () => {
    const f = fixture(), record = f.saved("test-base");
    for (const content of [
      { ...f.content, journeyApprovals: [] }, { ...f.content, dialogueApprovals: [] },
      { ...f.content, availability: f.content.availability.map(route => ({ ...route,
        nodes: route.nodes.map((node, index) => index === 1 ? { ...node, available: false } : node) })) },
    ]) expect(f.build([record], { content }).completedPrerequisites).toEqual([]);
    const offline = { ...f.content, availability: f.content.availability.map(route => ({ ...route,
      nodes: route.nodes.map((node, index) => index === 1 ? { ...node, offlineAvailable: false } : node) })) };
    expect(f.build([record], { content: offline, connectivity: "offline" }).completedPrerequisites).toEqual([]);
    expect(f.build([record], { publicCountries: [] }).completedPrerequisites).toEqual([]);
    expect(f.build([record]).completedPrerequisites).toEqual([{ id: "test-base", version: 1 }]);
  });

  it("admits cross-locale completion only through both fresh, equivalent definitions", () => {
    const specs: Spec[] = [{ id: "test-base", locale: "en" }, { id: "test-base", locale: "ru" },
      { id: "test-next", prerequisites: [{ id: "test-base", version: 1 }] }];
    const f = fixture(specs), record = f.saved("test-base", "ru"), serialized = JSON.stringify(record);
    expect(record.definitionChecksum).not.toBe(f.saved("test-base", "en").definitionChecksum);
    expect(ids(f.build([record]))).toEqual(["test-base", "test-next"]);
    expect(JSON.stringify(record)).toBe(serialized);
    for (const content of [
      { ...f.content, journeyApprovals: f.content.journeyApprovals.filter(item => item.locale !== "ru") },
      { ...f.content, dialogueApprovals: f.content.dialogueApprovals.filter(item => item.locale !== "ru") },
      { ...f.content, availability: f.content.availability.filter(item => item.locale !== "ru") },
    ]) expect(f.build([record], { content }).completedPrerequisites).toEqual([]);
  });

  it("reuses incomplete history across languages only against the exact saved definition", () => {
    const f = fixture([{ id: "test-base", locale: "ru" }, { id: "test-base", locale: "en" }]);
    const ru = createBookyJourneyCatalog({ ...f.options, locale: "ru", completedPrerequisites: [] }).plans[0];
    const en = createBookyJourneyCatalog({ ...f.options, completedPrerequisites: [] }).plans[0];
    const incomplete = f.saved("test-base", "ru", 1);
    expect(matchesBookyJourneyProgress(incomplete, policy, en, ru)).toBe(true);
    expect(matchesBookyJourneyProgress(incomplete, policy, en)).toBe(false);
    const changed = fixture([{ id: "test-base", locale: "ru", title: "Reviewed but different saved version copy" }]);
    const changedRu = createBookyJourneyCatalog({ ...changed.options, locale: "ru", completedPrerequisites: [] }).plans[0];
    expect(matchesBookyJourneyProgress(incomplete, policy, en, changedRu)).toBe(false);
    const otherPolicy = createBookyReaderPolicy({ age: 31, readingLevel: "plain" }, reviewedAt, 2)!;
    expect(matchesBookyJourneyProgress(incomplete, otherPolicy, en, ru)).toBe(false);
    expect(incomplete.acknowledgedNodeIds).toEqual(["country"]);
  });

  it("does not transfer completion between locale variants with changed entities or checkpoint screens", () => {
    for (const difference of [{ writerId: "other-writer" }, { checkpointScreen: "collection" as const }]) {
      const f = fixture([{ id: "test-base", locale: "ru" }, { id: "test-base", locale: "en", ...difference }]);
      const record = f.saved("test-base", "ru");
      expect(f.build([record]).catalog.plans).toHaveLength(1);
      expect(f.build([record]).completedPrerequisites).toEqual([]);
    }
  });

  it("ignores malformed, future, duplicate and accessor-bearing progress without executing getters", () => {
    const f = fixture(), record = f.saved("test-base"), getter = vi.fn(() => { throw new Error("must not execute"); });
    const accessor = Object.defineProperty({ ...record }, "nodes", { enumerable: true, get: getter });
    for (const progress of [
      { ...preference([record]), schemaVersion: 2 }, preference([record, record]), preference([accessor]),
      preference([{ ...record, acknowledgedNodeIds: ["writer", "country", "checkpoint"] }]),
      { ...preference([record]), unexpected: true },
    ]) {
      const result = f.build([], { progress: progress as BookyJourneyProgressPreference });
      expect(result.completedPrerequisites).toEqual([]);
      expect(ids(result)).toEqual(["test-base"]);
    }
    expect(getter).not.toHaveBeenCalled();
  });
});

describe("activity completion cannot cross changed question or factual author semantics", () => {
  const task: BookyJourneyActivitySpec = { schemaVersion: 1, id: "match-test-work", version: 1, type: "match-work-author",
    targetWork: { kind: "work", countryId: "test-country", writerId: "test-writer", workId: "test-work" },
    choices: [{ id: "first", writer: { kind: "writer", countryId: "test-country", writerId: "test-writer" } },
      { id: "second", writer: { kind: "writer", countryId: "test-country", writerId: "other-writer" } }] };
  const specs = (englishTask = task): Spec[] => [
    { id: "test-base", locale: "ru", activity: task }, { id: "test-base", locale: "en", activity: englishTask },
    { id: "test-next", prerequisites: [{ id: "test-base", version: 1 }] },
  ];

  it("retains acknowledged activity completion only through independently admitted equivalent RU and EN plans", () => {
    const f = fixture(specs()), completed = f.saved("test-base", "ru", 4), bytes = JSON.stringify(completed);
    const result = f.build([completed]);
    expect(ids(result)).toEqual(["test-base", "test-next"]);
    expect(result.completedPrerequisites).toEqual([{ id: "test-base", version: 1 }]);
    const current = result.catalog.plans[0], savedPlan = createBookyJourneyCatalog({ ...f.options, locale: "ru", completedPrerequisites: [] }).plans[0];
    expect(current.nodes[2].activity!.semanticChecksum).toBe(savedPlan.nodes[2].activity!.semanticChecksum);
    expect(matchesBookyJourneyProgress(completed, policy, current, savedPlan)).toBe(true);
    expect(JSON.stringify(completed)).toBe(bytes);
    expect(f.build([f.saved("test-base", "ru", 2)]).completedPrerequisites).toEqual([]);
    expect(f.build([completed], { content: { ...f.content,
      dialogueApprovals: f.content.dialogueApprovals.filter(item => item.locale !== "ru") } }).completedPrerequisites).toEqual([]);
  });

  it("denies old activity completion when canonical authorship changes under the same reviewed prompt and routing key", () => {
    const f = fixture(specs()), completed = f.saved("test-base", "ru", 4), old = f.build([completed]).catalog.plans[0];
    const publicBooks = f.options.publicBooks.map(book => ({ ...book, authorship: { kind: "single" as const,
      authors: [{ countryId: "test-country", writerId: "other-writer" }] } }));
    const result = f.build([completed], { publicBooks });
    expect(ids(result)).toEqual(["test-base"]); expect(result.completedPrerequisites).toEqual([]);
    expect(result.catalog.plans[0].definitionChecksum).toBe(old.definitionChecksum);
    expect(result.catalog.plans[0].nodes[2].activity!.semanticChecksum).not.toBe(old.nodes[2].activity!.semanticChecksum);
    expect(result.catalog.plans[0].nodes[2].activity!.correctChoiceId).toBe("second");
    expect(parseBookyJourneyProgress(preference([completed]))?.records[0]).toEqual(completed);
  });

  it("rejects locale equivalence for different activity identity or version despite fresh independent reviews", () => {
    for (const change of [{ ...task, id: "other-question" }, { ...task, version: 2 }]) {
      const f = fixture(specs(change)), completed = f.saved("test-base", "ru", 4);
      const result = f.build([completed]);
      expect(ids(result)).toEqual(["test-base"]); expect(result.completedPrerequisites).toEqual([]);
      const savedPlan = createBookyJourneyCatalog({ ...f.options, locale: "ru", completedPrerequisites: [] }).plans[0];
      expect(matchesBookyJourneyProgress(completed, policy, result.catalog.plans[0], savedPlan)).toBe(false);
    }
  });
});


/** Synthetic independent fact reviews only; the production providers stay empty. */
function withReviewedFact(content: BookyJourneyContent, changedLocale?: "ru" | "en", mismatchedEnglishPair = false): BookyJourneyContent {
  const factRecords = new Map<string, BookyDialogueRecord>();
  const definitions = content.definitions.map(definition => {
    const anchor = definition.nodes.find(node => node.kind === "writer")!;
    const placeholder: BookyJourneyFactSpec = { schemaVersion: 1, id: definition.id + "-fact", version: 1, dialogues: [
      { locale: "ru", id: definition.id + "-fact-dialogue", version: 1, contentChecksum: "a".repeat(64) },
      { locale: "en", id: definition.id + "-fact-dialogue", version: 1, contentChecksum: "a".repeat(64) },
    ] };
    const raw = { id: "fact", kind: "sourced-fact" as const, entity: anchor.entity, screen: anchor.screen,
      dialogue: { id: placeholder.dialogues[0].id, version: 1, contentChecksum: "a".repeat(64) }, fact: placeholder };
    const records = (["ru", "en"] as const).map(locale => {
      const copy = { title: locale + ": synthetic fact", body: locale + ": synthetic test fact " + (changedLocale === locale ? "changed" : "original"),
        caption: "Synthetic fact", reduced: "Synthetic fact" };
      const payload: BookyDialoguePayload = { id: raw.dialogue.id, locale, version: 1, audience: "adult", ageRange: { min: 18, max: 120 },
        readingLevel: "plain", intent: "sourced-fact", screens: [raw.screen], context: bookyJourneyDialogueContext(definition.id, raw)!,
        entityIds: [bookyJourneyEntityId(raw.entity!)], claimKind: "factual", factualSources: [
          { id: "test-source", url: "https://example.org/fact", accessedAt: reviewedAt }], copy, narration: null, prohibitedTags: [],
        provenance: { kind: "editorial", sourcePath: "test/fact-history.ts", sourceVersion: 1, sourceRef: raw.id,
          sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
      const review = { status: "approved" as const, reviewer: "synthetic-fact-reviewer-not-real", reviewedAt,
        contentChecksum: getBookyDialogueContentChecksum(payload)! };
      const record = { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
      factRecords.set(locale + ":" + payload.id, record); return record;
    });
    const spec: BookyJourneyFactSpec = { ...placeholder, dialogues: [
      { ...placeholder.dialogues[0], contentChecksum: mismatchedEnglishPair && definition.locale === "en" ? "d".repeat(64) : records[0].review.contentChecksum },
      { ...placeholder.dialogues[1], contentChecksum: records[1].review.contentChecksum },
    ] };
    const selected = spec.dialogues.find(binding => binding.locale === definition.locale)!;
    const fact = { ...raw, fact: spec, dialogue: { id: selected.id, version: selected.version, contentChecksum: selected.contentChecksum } };
    const index = definition.nodes.indexOf(anchor) + 1;
    return { ...definition, nodes: [...definition.nodes.slice(0, index), fact, ...definition.nodes.slice(index)] };
  });
  const dialogues = [...content.dialogues, ...factRecords.values()];
  return { ...content, definitions, dialogues,
    dialogueApprovals: dialogues.map(record => ({ id: record.payload.id, version: record.payload.version, locale: record.payload.locale,
      contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt })),
    journeyApprovals: definitions.map(definition => ({ id: definition.id, version: definition.version, locale: definition.locale,
      definitionChecksum: getBookyJourneyChecksum(definition)!, reviewer: "synthetic-journey-reviewer-not-real", reviewedAt })),
    availability: definitions.map(definition => ({ journeyId: definition.id, version: definition.version, locale: definition.locale,
      nodes: definition.nodes.map(node => ({ nodeId: node.id, locale: definition.locale,
        dialogueContentChecksum: node.dialogue.contentChecksum, available: true, offlineAvailable: true })) })),
  };
}


describe("fact completion prerequisites require exact independently admitted locale bindings", () => {
  const specs: Spec[] = [{ id: "test-base", locale: "ru" }, { id: "test-base", locale: "en" },
    { id: "test-next", prerequisites: [{ id: "test-base", version: 1 }] }];
  function factSetup(mismatchedEnglishPair = false) {
    const base = fixture(specs), content = withReviewedFact(base.content, undefined, mismatchedEnglishPair), options = { ...base.options, content };
    const savedPlan = createBookyJourneyCatalog({ ...options, locale: "ru", completedPrerequisites: [] }).plans[0];
    if (!savedPlan) throw Error("invalid-synthetic-prerequisite-fact");
    const saved = createBookyJourneyProgressRecord(policy, savedPlan, savedPlan.nodes.map(node => node.id), null)!;
    return { base, content, options, saved, savedPlan };
  }

  it("unlocks only complete exact-pair fact history across independently admitted RU and EN plans", () => {
    const f = factSetup(), bytes = JSON.stringify(f.saved);
    const result = createBookyJourneyCatalogWithProgress({ ...f.options, progress: preference([f.saved]) });
    expect(ids(result)).toEqual(["test-base", "test-next"]); expect(result.completedPrerequisites).toEqual([{ id: "test-base", version: 1 }]);
    expect(matchesBookyJourneyProgress(f.saved, policy, result.catalog.plans[0], f.savedPlan)).toBe(true);
    const partial = createBookyJourneyProgressRecord(policy, f.savedPlan, ["country", "writer", "fact"], "checkpoint")!;
    expect(createBookyJourneyCatalogWithProgress({ ...f.options, progress: preference([partial]) }).completedPrerequisites).toEqual([]);
    expect(JSON.stringify(f.saved)).toBe(bytes);
  });

  it("denies fact completion when current and saved locales bind different bilingual meanings despite individual admission", () => {
    const f = factSetup(true), result = createBookyJourneyCatalogWithProgress({ ...f.options, progress: preference([f.saved]) });
    expect(ids(result)).toEqual(["test-base"]); expect(result.completedPrerequisites).toEqual([]);
    expect(result.catalog.plans[0].nodes[2].fact!.semanticChecksum).not.toBe(f.savedPlan.nodes[2].fact!.semanticChecksum);
    expect(matchesBookyJourneyProgress(f.saved, policy, result.catalog.plans[0], f.savedPlan)).toBe(false);
    expect(parseBookyJourneyProgress(preference([f.saved]))?.records[0]).toEqual(f.saved);
  });

  it("withdraws fact prerequisites after either locale copy or saved-locale independent review changes without rewriting old history", () => {
    const f = factSetup(), bytes = JSON.stringify(f.saved);
    for (const locale of ["ru", "en"] as const) {
      const changed = withReviewedFact(f.base.content, locale);
      expect(createBookyJourneyCatalogWithProgress({ ...f.options, content: changed, progress: preference([f.saved]) }).completedPrerequisites).toEqual([]);
      const revoked = { ...f.content, dialogueApprovals: f.content.dialogueApprovals.filter(item => item.locale !== locale || item.id !== "test-base-fact-dialogue") };
      expect(createBookyJourneyCatalogWithProgress({ ...f.options, content: revoked, progress: preference([f.saved]) }).completedPrerequisites).toEqual([]);
    }
    expect(JSON.stringify(f.saved)).toBe(bytes);
  });
});
