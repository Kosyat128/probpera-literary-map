import { describe, expect, it, vi } from "vitest";
import { contentTextHash } from "../planet/contentExportHash";
import type { BookArchiveEntry, Country } from "../planet/types";
import { getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialoguePayload, type BookyDialogueRecord } from "./bookyDialogueRegistry";
import { bookyJourneyDialogueContext, bookyJourneyEntityId, getBookyJourneyChecksum,
  type BookyJourneyDefinition, type BookyJourneyPrerequisite } from "./bookyJourney";
import { createBookyJourneyCatalog } from "./bookyJourneyCatalog";
import { readBookyJourneyContent, type BookyJourneyContent } from "./bookyJourneyContent";
import { createBookyJourneyProgressRecord, type BookyJourneyProgressPreference,
  type BookyJourneyProgressRecord } from "./bookyJourneyProgress";
import type { BookyJourneyFactSpec } from "./bookyJourneyFact";
import { createBookyReaderPolicy } from "./bookyReaderPolicy";
import { createBookyJourneyPassport, type BookyJourneyPassportOptions } from "./bookyJourneyPassport";

const now = "2026-09-23T12:00:00.000Z", reviewedAt = "2026-09-22T12:00:00.000Z";
const policy = createBookyReaderPolicy({ age: 30, readingLevel: "plain" }, reviewedAt, 1)!;
type Spec = { id: string; locale?: "en" | "ru"; version?: number; title?: string;
  prerequisites?: readonly BookyJourneyPrerequisite[]; activity?: boolean; work?: boolean; writerId?: string };
function preference(records: readonly BookyJourneyProgressRecord[]): BookyJourneyProgressPreference {
  return { schemaVersion: 1, audience: "adult", revision: 1, activeRecordId: records[0]?.recordId ?? null, records };
}

/** Synthetic content and independent receipts only; no production approval or
 * factual claim is created by these fixtures. Saved setup supplies prerequisite
 * receipts explicitly; the projection must independently derive them anew. */
function fixture(specs: readonly Spec[] = [{ id: "test-route" }]) {
  const country: Country = { id: "test-country", name: "Synthetic country", coordinates: [20, 30], writers: [
    { id: "test-writer", name: "Synthetic First Writer", fullName: "Synthetic First Writer" },
    { id: "other-writer", name: "Synthetic Second Writer", fullName: "Synthetic Second Writer" },
  ] };
  const book: BookArchiveEntry = { id: "test-work", title: "Synthetic work", countryId: country.id, countryName: country.name,
    writerId: "test-writer", writerName: "Synthetic First Writer", country, writer: country.writers[0],
    editorial: { status: "verified" }, authorship: { kind: "single", authors: [{ countryId: country.id, writerId: "test-writer" }] } };
  const definitions: BookyJourneyDefinition[] = [], dialogues: BookyDialogueRecord[] = [];
  for (const spec of specs) {
    const locale = spec.locale ?? "en", version = spec.version ?? 1;
    const nodes: BookyJourneyDefinition["nodes"][number][] = [
      { id: "country", kind: "country", screen: "globe", entity: { kind: "country", countryId: country.id },
        dialogue: { id: `${spec.id}-country`, version, contentChecksum: "" } },
      { id: "writer", kind: "writer", screen: "globe", entity: { kind: "writer", countryId: country.id, writerId: spec.writerId ?? "test-writer" },
        dialogue: { id: `${spec.id}-writer`, version, contentChecksum: "" } },
    ];
    if (spec.work !== false) nodes.push({ id: "work", kind: "work", screen: "collection",
      entity: { kind: "work", countryId: country.id, writerId: "test-writer", workId: book.id },
      dialogue: { id: `${spec.id}-work`, version, contentChecksum: "" } });
    if (spec.activity) nodes.push({ id: "activity", kind: "activity", screen: "globe", entity: null,
      dialogue: { id: `${spec.id}-activity`, version, contentChecksum: "" }, activity: {
        schemaVersion: 1, id: "test-author-task", version: 1, type: "match-work-author",
        targetWork: { kind: "work", countryId: country.id, writerId: "test-writer", workId: book.id },
        choices: country.writers.map((writer, index) => ({ id: `choice-${index}`, writer: { kind: "writer", countryId: country.id, writerId: writer.id } })),
      } });
    nodes.push({ id: "checkpoint", kind: "checkpoint", screen: "globe", entity: null,
      dialogue: { id: `${spec.id}-checkpoint`, version, contentChecksum: "" } });
    const records = nodes.map(node => {
      const copy = { title: `${locale}: Test`, body: "Synthetic interface text.", caption: "Test", reduced: "Test" };
      const payload: BookyDialoguePayload = { id: node.dialogue.id, locale, version, audience: "adult", ageRange: { min: 18, max: 120 },
        readingLevel: "plain", intent: node.activity ? "activity" : "navigation", screens: [node.screen],
        context: bookyJourneyDialogueContext(spec.id, node)!, entityIds: node.activity
          ? [...new Set([node.activity.targetWork, ...node.activity.choices.map(choice => choice.writer)].map(bookyJourneyEntityId))]
          : node.entity ? [bookyJourneyEntityId(node.entity)] : [], claimKind: "interface-guidance", factualSources: [], copy,
        narration: null, prohibitedTags: [], provenance: { kind: "editorial", sourcePath: "test/passport.ts", sourceVersion: 1,
          sourceRef: node.id, sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
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
  const options: BookyJourneyPassportOptions = { content, policy, locale: "en", now, connectivity: "online",
    publicCountries: [country], publicBooks: [book], confirmedProgress: null };
  const saved = (id = specs[0].id, locale: "ru" | "en" = "en", count?: number) => {
    const plan = createBookyJourneyCatalog({ ...options, locale, completedPrerequisites: currentVersions }).plans.find(plan => plan.id === id);
    if (!plan) throw Error("invalid-synthetic-passport-fixture");
    const prefixLength = count ?? plan.nodes.length;
    const record = createBookyJourneyProgressRecord(policy, plan, plan.nodes.slice(0, prefixLength).map(node => node.id), plan.nodes[prefixLength]?.id ?? null);
    if (!record) throw Error("invalid-synthetic-passport-progress");
    return record;
  };
  const project = (records: readonly BookyJourneyProgressRecord[] = [], override: Partial<BookyJourneyPassportOptions> = {}) =>
    createBookyJourneyPassport({ ...options, confirmedProgress: preference(records), ...override });
  return { options, content, country, book, saved, project };
}

describe("read-only adult passport of confirmed journey steps", () => {
  it("credits only the acknowledged navigation prefix, never the active cursor or a merely admitted route", () => {
    const f = fixture();
    expect(f.project()).toEqual({ entities: [], completedJourneys: [] });
    expect(f.project([f.saved(undefined, "en", 0)]).entities).toEqual([]);
    expect(f.project([f.saved(undefined, "en", 1)]).entities).toEqual([{ kind: "country", countryId: f.country.id }]);
    expect(f.project([f.saved(undefined, "en", 2)]).entities.map(ref => ref.kind)).toEqual(["country", "writer"]);
    const third = f.project([f.saved(undefined, "en", 3)]);
    expect(third.entities.map(ref => ref.kind)).toEqual(["country", "writer", "work"]);
    expect(third.completedJourneys).toEqual([]);
    expect(f.project([f.saved()], { confirmedProgress: null })).toEqual({ entities: [], completedJourneys: [] });
    expect(f.project([f.saved()], { content: readBookyJourneyContent() }).entities).toEqual([]);
  });

  it("returns immutable exact refs and current admitted completion titles without mutating history", () => {
    const f = fixture(), record = f.saved(), before = JSON.stringify(record), result = f.project([record]);
    expect(result.completedJourneys).toEqual([{ id: "test-route", version: 1, locale: "en", title: "Synthetic test-route en" }]);
    expect(result.entities[2]).toEqual({ kind: "work", countryId: f.country.id, writerId: "test-writer", workId: f.book.id });
    for (const value of [result, result.entities, ...result.entities, result.completedJourneys, ...result.completedJourneys]) expect(Object.isFrozen(value)).toBe(true);
    expect(JSON.stringify(record)).toBe(before);
    expect(result.entities[0]).not.toBe(record.nodes[0].entity);
  });

  it("deduplicates overlapping contributors and removes credit only when its last valid contributor is deleted", () => {
    const f = fixture([{ id: "test-first" }, { id: "test-second" }]), first = f.saved("test-first"), second = f.saved("test-second");
    const both = f.project([first, second]);
    expect(both.entities).toHaveLength(3); expect(both.completedJourneys).toHaveLength(2);
    expect(f.project([second]).entities).toEqual(both.entities);
    expect(f.project([second]).completedJourneys.map(item => item.id)).toEqual(["test-second"]);
    expect(f.project().entities).toEqual([]);
    expect(f.project([first, second], { confirmedProgress: { ...preference([first, second]), activeRecordId: null } })).toEqual(both);
  });

  it("recomputes dependent contributions after deletion or prerequisite review revocation", () => {
    const f = fixture([{ id: "test-base", work: false }, { id: "test-dependent", prerequisites: [{ id: "test-base", version: 1 }] }]);
    const base = f.saved("test-base"), dependent = f.saved("test-dependent");
    expect(f.project([base, dependent]).entities.map(ref => ref.kind)).toEqual(["country", "writer", "work"]);
    expect(f.project([dependent])).toEqual({ entities: [], completedJourneys: [] });
    const revoked = { ...f.content, journeyApprovals: f.content.journeyApprovals.filter(item => item.id !== "test-base") };
    expect(f.project([base, dependent], { content: revoked })).toEqual({ entities: [], completedJourneys: [] });
    expect(f.project([base]).entities.map(ref => ref.kind)).toEqual(["country", "writer"]);
  });

  it("requires the exact explicit confirmed adult profile and ignores foreign-policy contributors", () => {
    const f = fixture(), record = f.saved();
    const changed = createBookyReaderPolicy({ age: 30, readingLevel: "plain" }, reviewedAt, 2)!;
    for (const supplied of [null, changed, { ...policy, audience: "child", age: 12 }, { ...policy, confirmedAt: "2026-09-24T12:00:00.000Z" }]) {
      expect(f.project([record], { policy: supplied as BookyJourneyPassportOptions["policy"] })).toEqual({ entities: [], completedJourneys: [] });
    }
  });

  it("withdraws the entire contributor on version, definition, review, public relation or offline availability changes", () => {
    const f = fixture(), record = f.saved(undefined, "en", 1);
    expect(fixture([{ id: "test-route", version: 2 }]).project([record]).entities).toEqual([]);
    expect(fixture([{ id: "test-route", title: "New independently reviewed title" }]).project([record]).entities).toEqual([]);
    for (const content of [{ ...f.content, journeyApprovals: [] }, { ...f.content, dialogueApprovals: [] },
      { ...f.content, availability: f.content.availability.map(route => ({ ...route, nodes: route.nodes.map(node => ({ ...node, available: false })) })) }]) {
      expect(f.project([record], { content }).entities).toEqual([]);
    }
    expect(f.project([record], { publicBooks: [] }).entities).toEqual([]);
    expect(f.project([record], { publicCountries: [] }).entities).toEqual([]);
    const offline = { ...f.content, availability: f.content.availability.map(route => ({ ...route,
      nodes: route.nodes.map(node => ({ ...node, offlineAvailable: false })) })) };
    expect(f.project([record], { content: offline, connectivity: "offline" }).entities).toEqual([]);
  });

  it("requires both freshly admitted locale definitions and displays only the current locale title", () => {
    const specs: Spec[] = [{ id: "test-route", locale: "ru" }, { id: "test-route", locale: "en" }];
    const f = fixture(specs), record = f.saved("test-route", "ru"), before = JSON.stringify(record);
    const result = f.project([record]); expect(result.entities).toHaveLength(3);
    expect(result.completedJourneys[0]).toEqual({ id: "test-route", version: 1, locale: "en", title: "Synthetic test-route en" });
    for (const locale of ["ru", "en"]) {
      const content = { ...f.content, journeyApprovals: f.content.journeyApprovals.filter(item => item.locale !== locale) };
      expect(f.project([record], { content })).toEqual({ entities: [], completedJourneys: [] });
    }
    const changed = fixture([{ id: "test-route", locale: "ru" }, { id: "test-route", locale: "en", work: false }]);
    expect(changed.project([record]).entities).toEqual([]);
    expect(JSON.stringify(record)).toBe(before);
  });

  it("never credits activity target/options as navigation, and rejects saved progress after derived authorship changes", () => {
    const f = fixture([{ id: "test-route", activity: true, work: false }]), record = f.saved();
    const result = f.project([record]);
    expect(result.entities).toEqual([{ kind: "country", countryId: f.country.id }, { kind: "writer", countryId: f.country.id, writerId: "test-writer" }]);
    expect(result.completedJourneys).toHaveLength(1);
    f.book.authorship!.authors[0].writerId = "other-writer";
    expect(f.project([record])).toEqual({ entities: [], completedJourneys: [] });
    expect(f.saved().definitionChecksum).toBe(record.definitionChecksum);
  });

  it("fails closed on hostile, future, duplicate or malformed saved progress without invoking getters", () => {
    const f = fixture(), record = f.saved(), getter = vi.fn(() => { throw Error("must not execute"); });
    const hostile = Object.defineProperty({ ...preference([record]) }, "records", { enumerable: true, get: getter });
    const bad: unknown[] = [hostile, { ...preference([record]), schemaVersion: 2 }, preference([record, record]),
      preference([{ ...record, acknowledgedNodeIds: ["writer"], resumeNodeId: "work" }]),
      { ...preference([record]), unknown: true }];
    for (const confirmedProgress of bad) expect(f.project([], { confirmedProgress: confirmedProgress as BookyJourneyProgressPreference }))
      .toEqual({ entities: [], completedJourneys: [] });
    expect(getter).not.toHaveBeenCalled();
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


describe("sourced facts do not add passive passport navigation credit", () => {
  function factSetup() {
    const base = fixture([{ id: "test-route", locale: "ru", work: false }, { id: "test-route", locale: "en", work: false }]);
    const content = withReviewedFact(base.content), options = { ...base.options, content };
    const plan = createBookyJourneyCatalog({ ...options, locale: "ru", completedPrerequisites: [] }).plans[0];
    if (!plan) throw Error("invalid-synthetic-passport-fact");
    const saved = (count: number) => createBookyJourneyProgressRecord(policy, plan, plan.nodes.slice(0, count).map(node => node.id), plan.nodes[count]?.id ?? null)!;
    return { base, content, options, plan, saved };
  }

  it("keeps entity counts unchanged across fact acknowledgement and gives completion only after the explicit final checkpoint", () => {
    const f = factSetup(), project = (count: number) => createBookyJourneyPassport({ ...f.options, confirmedProgress: preference([f.saved(count)]) });
    const before = project(2), acknowledged = project(3), completed = project(4);
    expect(before.entities.map(entity => entity.kind)).toEqual(["country", "writer"]);
    expect(acknowledged).toEqual(before); expect(acknowledged.completedJourneys).toEqual([]);
    expect(completed.entities).toEqual(before.entities);
    expect(completed.completedJourneys).toEqual([{ id: "test-route", version: 1, locale: "en", title: "Synthetic test-route en" }]);
    expect(JSON.stringify(preference([f.saved(4)]))).not.toMatch(/"(?:spec|dialogues|contentChecksum|factualSources|url|body)"/u);
  });

  it("withdraws the contributor on changed fact meaning or either locale review and restores only exact admitted history", () => {
    const f = factSetup(), record = f.saved(4), confirmedProgress = preference([record]), bytes = JSON.stringify(confirmedProgress);
    for (const locale of ["ru", "en"] as const) {
      const changed = withReviewedFact(f.base.content, locale);
      expect(createBookyJourneyPassport({ ...f.options, content: changed, confirmedProgress })).toEqual({ entities: [], completedJourneys: [] });
      const revoked = { ...f.content, dialogueApprovals: f.content.dialogueApprovals.filter(item => item.locale !== locale || item.id !== "test-route-fact-dialogue") };
      expect(createBookyJourneyPassport({ ...f.options, content: revoked, confirmedProgress })).toEqual({ entities: [], completedJourneys: [] });
    }
    expect(createBookyJourneyPassport({ ...f.options, confirmedProgress }).completedJourneys).toHaveLength(1);
    expect(JSON.stringify(confirmedProgress)).toBe(bytes);
  });
});
