import { describe, expect, it, vi } from "vitest";
import { contentTextHash } from "../planet/contentExportHash";
import type { BookyJourneyPlan } from "./bookyJourney";
import type { BookArchiveEntry, Country } from "../planet/types";
import { resolveBookyJourneyActivity, type BookyJourneyActivitySpec } from "./bookyJourneyActivity";
import { getBookyJourneyFactChecksum, type BookyJourneyFactSpec } from "./bookyJourneyFact";
import { createBookyReaderPolicy, serializeBookyReaderPolicy } from "./bookyReaderPolicy";
import { BOOKY_JOURNEY_PROGRESS_MAX_LENGTH, BOOKY_JOURNEY_PROGRESS_MAX_RECORDS, BOOKY_JOURNEY_PROGRESS_MAX_NODES,
  DEFAULT_BOOKY_JOURNEY_PROGRESS, createBookyJourneyProgressRecord, decodeBookyJourneyProgress,
  parseBookyJourneyProgress, serializeBookyJourneyProgress, type BookyJourneyProgressPreference,
  type BookyJourneyProgressRecord, type BookyJourneyProgressNode } from "./bookyJourneyProgress";

const policy = createBookyReaderPolicy({ age: 35, readingLevel: "fluent" }, "2026-09-23T12:00:00.000Z", 1)!;
// Semantic codec fixtures only. These deliberately contain no editorial review
// receipts and must never be used to claim that a route was admitted.
function plan(id = "test-journey", locale: "en" | "ru" = "en", version = 1): BookyJourneyPlan {
  const nodes: Omit<BookyJourneyProgressNode, "activity" | "fact">[] = [
    { id: "country", kind: "country", screen: "globe", entity: { kind: "country", countryId: "test-country" } },
    { id: "writer", kind: "writer", screen: "globe", entity: { kind: "writer", countryId: "test-country", writerId: "test-writer" } },
    { id: "work", kind: "work", screen: "collection", entity: { kind: "work", countryId: "test-country", writerId: "test-writer", workId: "test-work" } },
    { id: "checkpoint", kind: "checkpoint", screen: "globe", entity: null },
  ];
  return { id, version, locale, title: "Synthetic title never persisted", definitionChecksum: "a".repeat(64),
    nodes: nodes.map(node => ({ ...node, coordinates: null, dialogue: {} as BookyJourneyPlan["nodes"][number]["dialogue"] })) };
}
function fixture(route = plan(), acknowledged: readonly string[] = ["country"], resume: string | null = "writer") {
  const record = createBookyJourneyProgressRecord(policy, route, acknowledged, resume);
  if (!record) throw new Error("invalid-synthetic-progress-fixture");
  return { schemaVersion: 1, audience: "adult", revision: 1, activeRecordId: record.recordId, records: [record] } as const;
}
const changedRecord = (change: Partial<BookyJourneyProgressRecord> | Record<string, unknown>) => {
  const value = fixture(); return { ...value, records: [{ ...value.records[0], ...change }] };
};

describe("Booky literary journey semantic progress codec", () => {
  it("projects only immutable semantic IDs and binds the full explicit policy without saving it", () => {
    const source = plan(), value = fixture(source), stored = value.records[0];
    const fingerprint = contentTextHash(serializeBookyReaderPolicy(policy)!);
    expect(stored.policyFingerprint).toBe(fingerprint);
    expect(stored.recordId).toBe(contentTextHash(JSON.stringify([fingerprint, source.id, source.version])));
    expect(stored).toEqual({ recordId: stored.recordId, policyFingerprint: fingerprint,
      journeyId: source.id, journeyVersion: 1, locale: "en", definitionChecksum: source.definitionChecksum,
      nodes: source.nodes.map(({ id, kind, screen, entity }) => ({ id, kind, screen, entity })),
      acknowledgedNodeIds: ["country"], resumeNodeId: "writer" });
    const encoded = serializeBookyJourneyProgress(value)!;
    expect(encoded).not.toContain(source.title);
    for (const forbidden of ["Synthetic title", "age", "confirmedAt", "coordinates", "dialogue", "review", "camera"]) {
      expect(encoded).not.toContain(`"${forbidden}"`);
    }
    const restored = parseBookyJourneyProgress(encoded)!;
    expect(restored).toEqual(value); expect(restored).not.toBe(value);
    expect(Object.isFrozen(restored)).toBe(true); expect(Object.isFrozen(restored.records)).toBe(true);
    expect(Object.isFrozen(restored.records[0])).toBe(true); expect(Object.isFrozen(restored.records[0].nodes)).toBe(true);
    expect(Object.isFrozen(restored.records[0].nodes[1].entity)).toBe(true);
    expect(Object.isFrozen(restored.records[0].acknowledgedNodeIds)).toBe(true);
    expect(restored.records[0].nodes[0].entity).not.toBe(source.nodes[0].entity);
  });

  it("keeps locale variants in one record identity and changes identity for policy or route version", () => {
    const initial = fixture().records[0], translated = fixture(plan("test-journey", "ru")).records[0];
    expect(translated.recordId).toBe(initial.recordId);
    expect(translated.locale).toBe("ru");
    expect(fixture(plan("test-journey", "en", 2)).records[0].recordId).not.toBe(initial.recordId);
    const revisedPolicy = { ...policy, revision: 2 };
    expect(createBookyJourneyProgressRecord(revisedPolicy, plan(), [], "country")?.recordId).not.toBe(initial.recordId);
    expect(createBookyJourneyProgressRecord({ ...policy, age: 36 }, plan(), [], "country")?.recordId).not.toBe(initial.recordId);
  });

  it("supports exact empty, paused and fully acknowledged records without granting admission", () => {
    expect(parseBookyJourneyProgress(DEFAULT_BOOKY_JOURNEY_PROGRESS)).toEqual(DEFAULT_BOOKY_JOURNEY_PROGRESS);
    expect(decodeBookyJourneyProgress(null)).toEqual({ preference: null, error: null });
    expect(fixture(plan(), [], "country").records[0].acknowledgedNodeIds).toEqual([]);
    const completed = fixture(plan(), ["country", "writer", "work", "checkpoint"], null);
    expect(parseBookyJourneyProgress(completed)).toEqual(completed);
    const unknown = fixture(plan("unknown-journey", "en", 900_000));
    expect(parseBookyJourneyProgress(unknown)).toEqual(unknown);
    // Parsing is intentionally independent of policy/catalog/review availability.
    expect(parseBookyJourneyProgress({ ...unknown, activeRecordId: null })).not.toBeNull();
  });

  it.each([
    [[], "writer"], [["writer"], "work"], [["country", "country"], "work"],
    [["country", "work"], "checkpoint"], [["country"], null], [["country"], "country"],
    [["country", "writer", "work", "checkpoint"], "checkpoint"],
    [["country", "writer", "work", "checkpoint", "extra"], null],
  ] as const)("rejects non-prefix acknowledgements %j with cursor %s", (acknowledged, cursor) => {
    expect(createBookyJourneyProgressRecord(policy, plan(), acknowledged, cursor)).toBeNull();
    expect(parseBookyJourneyProgress(changedRecord({ acknowledgedNodeIds: acknowledged, resumeNodeId: cursor }))).toBeNull();
  });

  it.each([
    { schemaVersion: 0 }, { schemaVersion: 1.5 }, { audience: "child" }, { revision: -1 }, { revision: 1.5 },
    { revision: Number.MAX_SAFE_INTEGER + 1 }, { activeRecordId: "b".repeat(64) }, { locale: "en" }, { records: null },
  ])("rejects envelope violations %j", change => {
    expect(parseBookyJourneyProgress({ ...fixture(), ...change })).toBeNull();
  });

  it.each([
    { recordId: "b".repeat(64) }, { policyFingerprint: "b".repeat(64) }, { journeyId: "Changed" },
    { journeyVersion: 0 }, { journeyVersion: 1_000_001 }, { locale: "fr" }, { definitionChecksum: "A".repeat(64) },
    { resumeNodeId: "missing" }, { title: "unexpected copy" }, { nodes: [] },
  ])("rejects record violations %j", change => {
    expect(parseBookyJourneyProgress(changedRecord(change))).toBeNull();
  });

  it("rejects duplicate route identities, unknown fields, mismatched entities/screens and altered topology", () => {
    const value = fixture(), stored = value.records[0];
    expect(parseBookyJourneyProgress({ ...value, records: [stored, stored] })).toBeNull();
    expect(parseBookyJourneyProgress({ ...value, records: [stored, fixture(plan("test-journey", "ru")).records[0]] })).toBeNull();
    for (const nodeChange of [
      { kind: "writer" }, { screen: "collection" }, { entity: null },
      { entity: { kind: "country", countryId: "test-country", writerId: "not-allowed" } },
      { entity: { kind: "country", countryId: "contains space" } }, { coordinates: [1, 2] },
    ]) {
      expect(parseBookyJourneyProgress(changedRecord({ nodes: [{ ...stored.nodes[0], ...nodeChange }, ...stored.nodes.slice(1)] }))).toBeNull();
    }
    expect(parseBookyJourneyProgress(changedRecord({ nodes: [stored.nodes[0], stored.nodes[0], ...stored.nodes.slice(2)] }))).toBeNull();
    expect(parseBookyJourneyProgress(changedRecord({ nodes: [...stored.nodes].reverse() }))).toBeNull();
    expect(parseBookyJourneyProgress(changedRecord({ nodes: stored.nodes.slice(0, 3) }))).toBeNull();
  });

  it("preserves unsupported future or oversized bytes distinctly from malformed supported data", () => {
    const future = JSON.stringify({ schemaVersion: 2, ...Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`future${index}`, true])) });
    expect(decodeBookyJourneyProgress(future)).toEqual({ preference: null, error: "unsupported" });
    expect(decodeBookyJourneyProgress(" ".repeat(BOOKY_JOURNEY_PROGRESS_MAX_LENGTH + 1)).error).toBe("unsupported");
    expect(decodeBookyJourneyProgress('"' + "я".repeat(BOOKY_JOURNEY_PROGRESS_MAX_LENGTH / 2) + '"').error).toBe("unsupported");
    expect(decodeBookyJourneyProgress('{"schemaVersion":1,"unexpected":true}').error).toBe("invalid");
    for (const raw of ["", "null", "[]", "{}", "false", "broken", fixture()]) {
      expect(decodeBookyJourneyProgress(raw)).toEqual({ preference: null, error: "invalid" });
    }
    expect(serializeBookyJourneyProgress(future)).toBeNull();
  });

  it("rejects limits without truncation or silently evicting historical records", () => {
    const records = Array.from({ length: BOOKY_JOURNEY_PROGRESS_MAX_RECORDS }, (_, index) => fixture(plan(`journey-${index}`)).records[0]);
    const bounded = { ...DEFAULT_BOOKY_JOURNEY_PROGRESS, revision: 1, records };
    expect(parseBookyJourneyProgress(bounded)?.records).toHaveLength(BOOKY_JOURNEY_PROGRESS_MAX_RECORDS);
    expect(parseBookyJourneyProgress({ ...bounded, records: [...records, fixture(plan("one-too-many")).records[0]] })).toBeNull();
    const source = plan(), checkpoint = source.nodes[3];
    const maximum = { ...source, nodes: [source.nodes[0], ...Array.from({ length: BOOKY_JOURNEY_PROGRESS_MAX_NODES - 2 },
      (_, index) => ({ ...source.nodes[1], id: `writer-${index}` })), checkpoint] };
    expect(createBookyJourneyProgressRecord(policy, maximum, [], "country")?.nodes).toHaveLength(BOOKY_JOURNEY_PROGRESS_MAX_NODES);
    expect(createBookyJourneyProgressRecord(policy, { ...maximum, nodes: [...maximum.nodes, { ...checkpoint, id: "extra" }] }, [], "country")).toBeNull();
    const largeEntity = "😀".repeat(100);
    const largeRecords = Array.from({ length: 8 }, (_, route) => {
      const largePlan: BookyJourneyPlan = { ...source, id: `large-${route}`, nodes: [source.nodes[0],
        ...Array.from({ length: BOOKY_JOURNEY_PROGRESS_MAX_NODES - 2 }, (_, index) => ({ ...source.nodes[2], id: `work-${index}`,
          entity: { kind: "work" as const, countryId: largeEntity, writerId: largeEntity, workId: largeEntity } })), checkpoint] };
      return fixture(largePlan, [], "country").records[0];
    });
    expect(parseBookyJourneyProgress({ ...bounded, records: largeRecords })).toBeNull();
    expect(largeRecords).toHaveLength(8);
  });

  it("never invokes own accessors, toJSON, array accessors or inherited state", () => {
    const getter = vi.fn(() => 1), toJSON = vi.fn(() => fixture());
    const value = fixture();
    const accessor = { ...value }; Object.defineProperty(accessor, "revision", { enumerable: true, get: getter });
    expect(parseBookyJourneyProgress(accessor)).toBeNull();
    expect(parseBookyJourneyProgress({ ...value, toJSON })).toBeNull();
    expect(parseBookyJourneyProgress(Object.create(value))).toBeNull();
    expect(parseBookyJourneyProgress({ ...value, [Symbol("extra")]: true })).toBeNull();
    const hidden = { ...value }; Object.defineProperty(hidden, "revision", { enumerable: false, value: 1 });
    expect(parseBookyJourneyProgress(hidden)).toBeNull();
    const records: BookyJourneyProgressRecord[] = [value.records[0]];
    Object.defineProperty(records, "0", { enumerable: true, get: getter });
    expect(parseBookyJourneyProgress({ ...value, records })).toBeNull();
    expect(parseBookyJourneyProgress({ ...value, records: new Array(1) })).toBeNull();
    expect(parseBookyJourneyProgress({ ...value, records: Object.assign([...value.records], { extra: true }) })).toBeNull();
    const source = plan(); Object.defineProperty(source.nodes[0].entity!, "countryId", { enumerable: true, get: getter });
    expect(createBookyJourneyProgressRecord(policy, source, [], "country")).toBeNull();
    const badPolicy = { ...policy }; Object.defineProperty(badPolicy, "age", { enumerable: true, get: getter });
    expect(createBookyJourneyProgressRecord(badPolicy, plan(), [], "country")).toBeNull();
    expect(getter).not.toHaveBeenCalled(); expect(toJSON).not.toHaveBeenCalled();
  });

  it("copies null-prototype own data and keeps canonical serialization stable", () => {
    const source = Object.assign(Object.create(null), fixture()) as BookyJourneyProgressPreference;
    const once = serializeBookyJourneyProgress(source)!;
    expect(serializeBookyJourneyProgress(parseBookyJourneyProgress(once))).toBe(once);
    expect(serializeBookyJourneyProgress(null)).toBeNull();
    expect(Object.isFrozen(DEFAULT_BOOKY_JOURNEY_PROGRESS.records)).toBe(true);
  });
});

describe("Booky activity progress stores semantic identity only", () => {
  function activityPlan(): BookyJourneyPlan {
    const source = plan(), spec: BookyJourneyActivitySpec = { schemaVersion: 1, id: "match-test-work", version: 1,
      type: "match-work-author", targetWork: { kind: "work", countryId: "test-country", writerId: "test-writer", workId: "test-work" },
      choices: [{ id: "first", writer: { kind: "writer", countryId: "test-country", writerId: "test-writer" } },
        { id: "second", writer: { kind: "writer", countryId: "test-country", writerId: "other-writer" } }] };
    const activity = resolveBookyJourneyActivity(spec, {
      publicCountries: [{ id: "test-country", writers: [{ id: "test-writer" }, { id: "other-writer" }] }] as Country[],
      publicBooks: [{ id: "test-work", countryId: "test-country", writerId: "test-writer", editorial: { status: "verified" } }] as BookArchiveEntry[],
    });
    if (!activity) throw Error("invalid-synthetic-activity-fixture");
    return { ...source, nodes: [source.nodes[0], { id: "activity", kind: "activity", screen: "globe", entity: null,
      coordinates: null, dialogue: source.nodes[1].dialogue, activity,
      activityChoices: activity.spec.choices.map(choice => ({ id: choice.id, label: choice.writer.writerId })) }, source.nodes[3]] };
  }

  it("round-trips only task id/version/fingerprint without any selected choice or answer key", () => {
    const source = activityPlan(), value = fixture(source, ["country"], "activity"), saved = value.records[0].nodes[1];
    expect(saved).toEqual({ id: "activity", kind: "activity", screen: "globe", entity: null,
      activity: { id: "match-test-work", version: 1, semanticChecksum: source.nodes[1].activity!.semanticChecksum } });
    const encoded = serializeBookyJourneyProgress(value)!;
    expect(parseBookyJourneyProgress(encoded)).toEqual(value); expect(Object.isFrozen(saved.activity)).toBe(true);
    for (const field of ["correctChoiceId", "choiceId", "choices", "activityChoices", "label", "targetWork", "spec", "answer", "dialogue"]) {
      expect(encoded).not.toContain(`"${field}"`);
    }
    const complete = fixture(source, ["country", "activity", "checkpoint"], null);
    expect(parseBookyJourneyProgress(complete)?.records[0].nodes[1]).toEqual(saved);
  });

  it("rejects missing fingerprints, extra answers and invalid activity variants without dropping old history", () => {
    const source = activityPlan(), value = fixture(source, ["country"], "activity"), original = JSON.stringify(value);
    const saved = value.records[0], activityNode = saved.nodes[1];
    for (const change of [{ activity: undefined }, { activity: { ...activityNode.activity, semanticChecksum: "bad" } },
      { activity: { ...activityNode.activity, version: 0 } }, { activity: { ...activityNode.activity, correctChoiceId: "first" } },
      { screen: "collection" }, { entity: source.nodes[0].entity }, { kind: "checkpoint" }]) {
      const invalid = { ...value, records: [{ ...saved, nodes: [saved.nodes[0], { ...activityNode, ...change }, saved.nodes[2]] }] };
      expect(parseBookyJourneyProgress(invalid)).toBeNull();
      expect(decodeBookyJourneyProgress(JSON.stringify(invalid)).error).toBe("invalid");
    }
    expect(JSON.stringify(value)).toBe(original);
    const old = fixture(), oldBytes = JSON.stringify(old);
    expect(serializeBookyJourneyProgress(parseBookyJourneyProgress(oldBytes))).toBe(oldBytes);
    expect(oldBytes).not.toContain('"activity"');
  });

  it("does not invoke activity accessors or project mismatched authored specs as valid progress", () => {
    const source = activityPlan(), compiled = source.nodes[1], getter = vi.fn(() => compiled.activity!.semanticChecksum);
    const accessor = { ...compiled.activity! }; Object.defineProperty(accessor, "semanticChecksum", { enumerable: true, get: getter });
    expect(createBookyJourneyProgressRecord(policy, { ...source, nodes: [source.nodes[0], { ...compiled, activity: accessor }, source.nodes[2]] }, [], "country")).toBeNull();
    const mismatched = { ...compiled.activity!, spec: { ...compiled.activity!.spec, version: 2 } };
    expect(createBookyJourneyProgressRecord(policy, { ...source, nodes: [source.nodes[0], { ...compiled, activity: mismatched }, source.nodes[2]] }, [], "country")).toBeNull();
    const value = fixture(source, ["country"], "activity"), saved = value.records[0], metadata = { ...saved.nodes[1].activity! };
    Object.defineProperty(metadata, "semanticChecksum", { enumerable: true, get: getter });
    expect(parseBookyJourneyProgress({ ...value, records: [{ ...saved,
      nodes: [saved.nodes[0], { ...saved.nodes[1], activity: metadata }, saved.nodes[2]] }] })).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });
});


describe("optional admitted journey overview does not change saved semantic bytes", () => {
  const overview = { description: "Synthetic reviewed route description", estimatedDurationMinutes: 12, offlineAvailable: true };
  it("pins the legacy serialized record and omits optional display metadata from enriched plans", () => {
    const source = plan(), legacy = serializeBookyJourneyProgress(fixture(source))!;
    expect(contentTextHash(legacy)).toBe("b63561b5c5a9f6dfe5928e5ca208b6af95544ab5734e1d3af3653d3a6d594a5f");
    expect(Object.keys(source)).toHaveLength(6);
    for (const offlineAvailable of [true, false]) {
      const enriched = { ...source, overview: { ...overview, offlineAvailable } };
      const projected = fixture(enriched);
      expect(serializeBookyJourneyProgress(projected)).toBe(legacy);
      expect(parseBookyJourneyProgress(legacy)).toEqual(projected);
      for (const key of ["overview", "description", "estimatedDurationMinutes", "offlineAvailable"]) {
        expect(legacy).not.toContain('"' + key + '"');
      }
    }
  });

  it("rejects malformed or extra overview fields without changing the original stored record", () => {
    const source = plan(), original = serializeBookyJourneyProgress(fixture(source));
    for (const value of [undefined, null, {}, { ...overview, description: " " }, { ...overview, estimatedDurationMinutes: 0 },
      { ...overview, offlineAvailable: "yes" }, { ...overview, downloaded: true }]) {
      const enriched = { ...source, overview: value } as unknown as BookyJourneyPlan;
      expect(createBookyJourneyProgressRecord(policy, enriched, ["country"], "writer")).toBeNull();
    }
    expect(createBookyJourneyProgressRecord(policy, { ...source, overview, extra: true } as BookyJourneyPlan, [], "country")).toBeNull();
    expect(serializeBookyJourneyProgress(fixture(source))).toBe(original);
  });

  it("does not invoke overview accessors or persist overview fields smuggled into history", () => {
    const source = plan(), getter = vi.fn(() => overview), nestedGetter = vi.fn(() => true);
    const accessor = { ...source };
    Object.defineProperty(accessor, "overview", { enumerable: true, get: getter });
    expect(createBookyJourneyProgressRecord(policy, accessor, [], "country")).toBeNull();
    const metadata = { ...overview };
    Object.defineProperty(metadata, "offlineAvailable", { enumerable: true, get: nestedGetter });
    expect(createBookyJourneyProgressRecord(policy, { ...source, overview: metadata }, [], "country")).toBeNull();
    const stored = fixture();
    expect(parseBookyJourneyProgress({ ...stored, records: [{ ...stored.records[0], overview }] })).toBeNull();
    expect(getter).not.toHaveBeenCalled(); expect(nestedGetter).not.toHaveBeenCalled();
  });
});


describe("sourced-fact progress stores only exact semantic identity", () => {
  const spec: BookyJourneyFactSpec = { schemaVersion: 1, id: "test-fact", version: 1, dialogues: [
    { locale: "ru", id: "test-fact-dialogue", version: 1, contentChecksum: "b".repeat(64) },
    { locale: "en", id: "test-fact-dialogue", version: 1, contentChecksum: "c".repeat(64) },
  ] };
  function factPlan(kind: "country" | "writer" | "work" = "work"): BookyJourneyPlan {
    const base = plan(), anchor = base.nodes.find(node => node.kind === kind)!;
    const fact = { id: "fact", kind: "sourced-fact" as const, entity: anchor.entity, screen: anchor.screen,
      coordinates: anchor.coordinates, dialogue: anchor.dialogue,
      fact: { spec, semanticChecksum: getBookyJourneyFactChecksum(spec, anchor.entity!, anchor.screen)! } };
    const index = base.nodes.indexOf(anchor);
    return { ...base, nodes: [...base.nodes.slice(0, index + 1), fact, ...base.nodes.slice(index + 1)] };
  }

  it("round-trips country, writer and work fact fingerprints without copy, source URLs or locale binding tables", () => {
    for (const kind of ["country", "writer", "work"] as const) {
      const source = factPlan(kind), value = fixture(source, source.nodes.map(node => node.id), null);
      const stored = value.records[0].nodes.find(node => node.kind === "sourced-fact")!;
      expect(stored).toEqual({ id: "fact", kind: "sourced-fact", screen: kind === "work" ? "collection" : "globe",
        entity: source.nodes.find(node => node.kind === kind)!.entity,
        fact: { id: spec.id, version: spec.version, semanticChecksum: source.nodes.find(node => node.kind === "sourced-fact")!.fact!.semanticChecksum } });
      const bytes = serializeBookyJourneyProgress(value)!;
      expect(parseBookyJourneyProgress(bytes)).toEqual(value); expect(Object.isFrozen(stored.fact)).toBe(true);
      expect(bytes).not.toMatch(/"(?:spec|dialogues|contentChecksum|body|factualSources|url)"/u);
      expect(value.records[0].nodes.filter(node => node.kind !== "sourced-fact")).toEqual(fixture().records[0].nodes);
    }
  });

  it("rejects missing, extra, mixed and wrong-anchor persisted fact variants without dropping history", () => {
    const value = fixture(factPlan()), record = value.records[0], fact = record.nodes.find(node => node.kind === "sourced-fact")!;
    for (const invalid of [{ ...fact, fact: undefined }, { ...fact, fact: { ...fact.fact, body: "not stored" } },
      { ...fact, fact: { ...fact.fact, semanticChecksum: "invalid" } }, { ...fact, activity: fact.fact },
      { ...fact, screen: "globe" }, { ...fact, entity: null }, { ...fact, kind: "work" },
      { ...fact, entity: { kind: "sourced-fact", countryId: "test-country" } }]) {
      expect(parseBookyJourneyProgress({ ...value, records: [{ ...record, nodes: record.nodes.map(node => node === fact ? invalid : node) }] })).toBeNull();
    }
    expect(parseBookyJourneyProgress(serializeBookyJourneyProgress(value))).toEqual(value);
  });

  it("projects only exact recomputed bilingual fact fingerprints and rejects forged resolved metadata", () => {
    const source = factPlan(), fact = source.nodes.find(node => node.kind === "sourced-fact")!;
    for (const changed of [{ ...fact, fact: { ...fact.fact, semanticChecksum: "d".repeat(64) } },
      { ...fact, fact: { ...fact.fact, spec: { ...spec, version: 2 } } },
      { ...fact, fact: { ...fact.fact, spec: { ...spec, dialogues: [spec.dialogues[0], { ...spec.dialogues[1], contentChecksum: "d".repeat(64) }] } } },
      { ...fact, fact: { ...fact.fact, body: "forged copy" } }, { ...fact, activity: {} },
      { ...fact, entity: { ...fact.entity, workId: "other-work" } }]) {
      expect(createBookyJourneyProgressRecord(policy, { ...source, nodes: source.nodes.map(node => node === fact ? changed : node) } as BookyJourneyPlan, [], "country")).toBeNull();
    }
  });

  it("never evaluates fact or spec getters during projection and saved-state parsing", () => {
    const source = factPlan(), fact = source.nodes.find(node => node.kind === "sourced-fact")!, getter = vi.fn(() => fact.fact);
    const hostile = Object.defineProperty({ ...fact }, "fact", { enumerable: true, get: getter });
    expect(createBookyJourneyProgressRecord(policy, { ...source, nodes: source.nodes.map(node => node === fact ? hostile : node) }, [], "country")).toBeNull();
    const value = fixture(source), record = value.records[0], saved = record.nodes.find(node => node.kind === "sourced-fact")!;
    const invalid = Object.defineProperty({ ...saved.fact }, "semanticChecksum", { enumerable: true, get: getter });
    expect(parseBookyJourneyProgress({ ...value, records: [{ ...record, nodes: record.nodes.map(node => node === saved ? { ...node, fact: invalid } : node) }] })).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });
});
