import { describe, expect, it, vi } from "vitest";
import { getBookyJourneyCharacterChecksum, type BookyJourneyCharacterSpec } from "./bookyJourneyCharacter";
import { getBookyJourneyChecksum, type BookyJourneyDefinition, type BookyJourneyPlan } from "./bookyJourney";
import { createBookyJourneyProgressRecord, type BookyJourneyProgressNode } from "./bookyJourneyProgress";
import { getBookyJourneyFactChecksum, type BookyJourneyFactSpec } from "./bookyJourneyFact";
import { createBookyReaderPolicy } from "./bookyReaderPolicy";
import type { BookArchiveEntry, Country } from "../planet/types";
import { resolveBookyJourneyActivity, type BookyJourneyActivitySpec } from "./bookyJourneyActivity";
import { getBookyJourneyMigrationChecksum, resolveBookyJourneyMigration,
  type BookyJourneyMigration, type BookyJourneyMigrationInput } from "./bookyJourneyMigration";

const now = "2026-09-23T12:00:00.000Z", reviewedAt = "2026-09-22T12:00:00.000Z";
const policy = createBookyReaderPolicy({ age: 30, readingLevel: "plain" }, reviewedAt, 1)!;
type PlainNode = Omit<BookyJourneyProgressNode, "activity" | "fact" | "character">;
const nodes: readonly PlainNode[] = [
  { id: "country", kind: "country", screen: "globe", entity: { kind: "country", countryId: "synthetic-country" } },
  { id: "writer", kind: "writer", screen: "globe", entity: { kind: "writer", countryId: "synthetic-country", writerId: "synthetic-writer" } },
  { id: "work", kind: "work", screen: "collection", entity: { kind: "work", countryId: "synthetic-country", writerId: "synthetic-writer", workId: "synthetic-work" } },
  { id: "checkpoint", kind: "checkpoint", screen: "globe", entity: null },
];
function definition(version: number, semanticNodes = nodes): BookyJourneyDefinition {
  return { schemaVersion: 1, id: "synthetic-journey", version, locale: "en", audience: "adult", ageRange: { min: 18, max: 120 },
    readingLevel: "plain", title: "Synthetic migration test", prerequisites: [],
    nodes: semanticNodes.map(node => ({ ...node, dialogue: { id: `test-${node.id}`, version: 1, contentChecksum: "a".repeat(64) } })) };
}
function hostPlan(source: BookyJourneyDefinition, author?: string): BookyJourneyPlan {
  // Synthetic host-plan stand-in ONLY. Editorial admission is tested at its own
  // boundary; this suite neither creates production review nor invokes navigation.
  return { id: source.id, version: source.version, locale: source.locale, title: source.title,
    definitionChecksum: getBookyJourneyChecksum(source)!,
    ...(source.overview ? { overview: { ...source.overview, offlineAvailable: true } } : {}),
    nodes: source.nodes.map(({ activity: spec, fact: factSpec, character: characterSpec, ...node }) => {
      const compiled = { ...node, coordinates: null, dialogue: {} as BookyJourneyPlan["nodes"][number]["dialogue"] };
      if (node.kind === "sourced-fact") {
        if (!factSpec || !node.entity) throw Error("invalid-synthetic-migration-fact");
        return { ...compiled, fact: { spec: factSpec, semanticChecksum: getBookyJourneyFactChecksum(factSpec, node.entity, node.screen)! } };
      }
      if (node.kind === "character") {
        if (!characterSpec) throw Error("invalid-synthetic-migration-character");
        return { ...compiled, character: { spec: characterSpec, semanticChecksum: getBookyJourneyCharacterChecksum(characterSpec)! } };
      }
      if (node.kind !== "activity") return compiled;
      const activity = resolveBookyJourneyActivity(spec, {
        publicCountries: [{ id: "synthetic-country", writers: [{ id: "synthetic-writer" }, { id: "other-writer" }] }] as Country[],
        publicBooks: [{ id: "synthetic-work", countryId: "synthetic-country", writerId: "synthetic-writer", editorial: { status: "verified" },
          ...(author ? { authorship: { kind: "single", authors: [{ countryId: "synthetic-country", writerId: author }] } } : {}) }] as BookArchiveEntry[],
      });
      if (!activity) throw Error("invalid-synthetic-migration-activity");
      return { ...compiled, activity, activityChoices: activity.spec.choices.map(choice => ({ id: choice.id, label: choice.writer.writerId })) };
    }) };
}
function reviewed(input: BookyJourneyMigrationInput, change: Partial<BookyJourneyMigration> = {}): BookyJourneyMigrationInput {
  const migration = { ...input.migration, ...change }, checksum = getBookyJourneyMigrationChecksum(migration);
  return { ...input, migration, approvedMigrationReceipts: checksum ? [{ id: migration.id, checksum,
    reviewer: "synthetic-test-reviewer-not-real", reviewedAt }] : [] };
}
function fixture(acknowledgedCount = 2, targetNodes: readonly PlainNode[] = nodes.map(node => ({ ...node, id: `new-${node.id}` }))): BookyJourneyMigrationInput {
  const historicalDefinition = definition(1), currentPlan = hostPlan(definition(2, targetNodes));
  const savedRecord = createBookyJourneyProgressRecord(policy, hostPlan(historicalDefinition),
    nodes.slice(0, acknowledgedCount).map(node => node.id), nodes[acknowledgedCount]?.id ?? null)!;
  const input: BookyJourneyMigrationInput = { savedRecord, historicalDefinition, currentPlan, currentPolicy: policy, now,
    migration: { schemaVersion: 1, id: "synthetic-v1-v2", journeyId: historicalDefinition.id, locale: "en", fromVersion: 1,
      fromDefinitionChecksum: savedRecord.definitionChecksum, toVersion: 2, toDefinitionChecksum: currentPlan.definitionChecksum,
      nodeMap: Object.fromEntries(nodes.map(node => [node.id, targetNodes.find(target => target.id === `new-${node.id}`)?.id ?? null])),
      safeCheckpointId: null }, approvedMigrationReceipts: [] };
  return reviewed(input);
}

describe("explicit reviewed Booky journey version migration", () => {
  it("renames equivalent node IDs, preserves the old record and transfers only the acknowledged prefix", () => {
    const input = fixture(), original = JSON.stringify(input.savedRecord), result = resolveBookyJourneyMigration(input)!;
    expect(result.preservedRecord).toEqual(input.savedRecord);
    expect(JSON.stringify(input.savedRecord)).toBe(original);
    expect(result.targetRecord).toMatchObject({ journeyVersion: 2, locale: "en", policyFingerprint: input.savedRecord.policyFingerprint,
      acknowledgedNodeIds: ["new-country", "new-writer"], resumeNodeId: "new-work" });
    expect(result.targetRecord.recordId).not.toBe(input.savedRecord.recordId);
    expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.preservedRecord.nodes)).toBe(true);
    expect(Object.isFrozen(result.targetRecord.acknowledgedNodeIds)).toBe(true);
    expect(getBookyJourneyMigrationChecksum({ ...input.migration })).toBe(input.approvedMigrationReceipts[0].checksum);
  });

  it("requires a separate exact migration receipt and rejects embedded or stale approval claims", () => {
    const input = fixture(), receipt = input.approvedMigrationReceipts[0];
    for (const approvedMigrationReceipts of [[], [{ ...receipt, id: "other-migration" }], [{ ...receipt, checksum: "b".repeat(64) }],
      [{ ...receipt, reviewedAt: "2026-09-24T12:00:00.000Z" }], [{ ...receipt, reviewer: "" }]]) {
      expect(resolveBookyJourneyMigration({ ...input, approvedMigrationReceipts })).toBeNull();
    }
    expect(resolveBookyJourneyMigration({ ...input, migration: { ...input.migration, review: receipt } })).toBeNull();
    expect(resolveBookyJourneyMigration({ ...input, migration: { ...input.migration, id: "changed-after-review" } })).toBeNull();
    expect(resolveBookyJourneyMigration({ ...input, approvedMigrationReceipts: [receipt, receipt] })).toBeNull();
    expect(resolveBookyJourneyMigration({ ...input, approvedMigrationReceipts: [receipt, { ...receipt, checksum: "b".repeat(64) }] })).toBeNull();
    expect(resolveBookyJourneyMigration({ ...input, now: "2026-09-23" })).toBeNull();
  });

  it("binds both exact definitions, current policy, route identity and a strictly advancing version", () => {
    const input = fixture();
    for (const change of [
      { historicalDefinition: { ...input.historicalDefinition, title: "Changed history" } },
      { currentPlan: { ...input.currentPlan, definitionChecksum: "b".repeat(64) } },
      { currentPlan: { ...input.currentPlan, id: "different-journey" } },
      { currentPlan: { ...input.currentPlan, locale: "ru" } },
      { currentPolicy: { ...policy, age: 31 } }, { currentPolicy: { ...policy, revision: 2 } },
      { currentPolicy: { ...policy, audience: "child", age: 12 } },
    ]) expect(resolveBookyJourneyMigration({ ...input, ...change })).toBeNull();
    for (const change of [{ fromVersion: 2 }, { toVersion: 1 }, { toVersion: 0 }, { schemaVersion: 2 }, { journeyId: "different-journey" }]) {
      expect(resolveBookyJourneyMigration(reviewed(input, change as Partial<BookyJourneyMigration>))).toBeNull();
    }
    const forged = { ...input.savedRecord, nodes: input.savedRecord.nodes.map((node, index) => index === 1
      ? { ...node, entity: { kind: "writer", countryId: "synthetic-country", writerId: "different-writer" } } : node) };
    expect(resolveBookyJourneyMigration({ ...input, savedRecord: forged })).toBeNull();
  });

  it("never transfers acknowledgement to a different country, writer, work, kind or screen", () => {
    const variations = [
      { index: 0, entity: { kind: "country", countryId: "different-country" } },
      { index: 1, entity: { kind: "writer", countryId: "synthetic-country", writerId: "different-writer" } },
      { index: 2, entity: { kind: "work", countryId: "synthetic-country", writerId: "synthetic-writer", workId: "different-work" } },
      { index: 1, kind: "country", entity: { kind: "country", countryId: "synthetic-country" } },
    ];
    for (const { index, ...change } of variations) {
      const target = nodes.map((node, at) => ({ ...node, id: `new-${node.id}`, ...(index === at ? change : {}) })) as PlainNode[];
      expect(resolveBookyJourneyMigration(fixture(3, target))).toBeNull();
    }
    const target = nodes.map(node => ({ ...node, id: `new-${node.id}`, ...(node.kind === "checkpoint" ? { screen: "collection" as const } : {}) }));
    expect(resolveBookyJourneyMigration(fixture(4, target))).toBeNull();
  });

  it("rejects partial, unknown, duplicate and out-of-order maps rather than sorting progress into a prefix", () => {
    const input = fixture();
    for (const nodeMap of [
      { country: "new-country", writer: "new-writer" },
      { ...input.migration.nodeMap, invented: null },
      { ...input.migration.nodeMap, work: "missing-target" },
      { ...input.migration.nodeMap, work: "new-writer" },
      { ...input.migration.nodeMap, country: "new-writer", writer: "new-country" },
    ] as Array<Record<string, string | null>>) expect(resolveBookyJourneyMigration(reviewed(input, { nodeMap }))).toBeNull();
    const skipped = fixture(2, [nodes[0], { ...nodes[1], id: "inserted-writer" }, nodes[1], nodes[2], nodes[3]]
      .map(node => ({ ...node, id: `new-${node.id}` })));
    expect(resolveBookyJourneyMigration(skipped)).toBeNull();
  });

  it("uses an explicit next checkpoint when the old cursor is retired, retaining all historical progress", () => {
    const input = fixture(2, [nodes[0], nodes[1], nodes[3]].map(node => ({ ...node, id: `new-${node.id}` })));
    const proposal = reviewed(input, { safeCheckpointId: "new-checkpoint" });
    const result = resolveBookyJourneyMigration(proposal)!;
    expect(result.targetRecord).toMatchObject({ acknowledgedNodeIds: ["new-country", "new-writer"], resumeNodeId: "new-checkpoint" });
    expect(result.preservedRecord).toEqual(input.savedRecord);
    expect(resolveBookyJourneyMigration(input)).toBeNull();
  });

  it("never skips new unacknowledged nodes to reach a checkpoint or accepts an ordinary node as fallback", () => {
    const input = fixture(1);
    expect(resolveBookyJourneyMigration(reviewed(input, { nodeMap: { ...input.migration.nodeMap, writer: null },
      safeCheckpointId: "new-checkpoint" }))).toBeNull();
    expect(resolveBookyJourneyMigration(reviewed(input, { nodeMap: { ...input.migration.nodeMap, writer: null },
      safeCheckpointId: "new-writer" }))).toBeNull();
    expect(resolveBookyJourneyMigration(reviewed(input, { nodeMap: { ...input.migration.nodeMap, writer: "new-work", work: null } }))).toBeNull();
  });

  it("keeps completion only for a full target prefix, otherwise requires the exact next checkpoint", () => {
    const completed = fixture(4), result = resolveBookyJourneyMigration(completed)!;
    expect(result.targetRecord).toMatchObject({ acknowledgedNodeIds: ["new-country", "new-writer", "new-work", "new-checkpoint"], resumeNodeId: null });
    const target = [...nodes.slice(0, 3).map(node => ({ ...node, id: `new-${node.id}` })), { ...nodes[3], id: "replacement-checkpoint" }];
    const renewed = reviewed(fixture(4, target), { safeCheckpointId: "replacement-checkpoint" });
    expect(resolveBookyJourneyMigration(renewed)?.targetRecord).toMatchObject({ acknowledgedNodeIds: ["new-country", "new-writer", "new-work"],
      resumeNodeId: "replacement-checkpoint" });
    const newWork = { ...nodes[2], id: "unacknowledged-work" };
    expect(resolveBookyJourneyMigration(reviewed(fixture(4, [...target.slice(0, 3), newWork, target[3]]),
      { safeCheckpointId: "replacement-checkpoint" }))).toBeNull();
    // A completed intermediate checkpoint must not complete a still-running
    // historical route merely because its remaining cursor is retired.
    const short = fixture(0, [nodes[0], nodes[3]].map(node => ({ ...node, id: `new-${node.id}` })));
    const historicalDefinition = definition(1, [nodes[0], { ...nodes[3], id: "mid-checkpoint" }, ...nodes.slice(1)]);
    const savedRecord = createBookyJourneyProgressRecord(policy, hostPlan(historicalDefinition), ["country", "mid-checkpoint"], "writer")!;
    const unfinished = reviewed({ ...short, historicalDefinition, savedRecord }, {
      fromDefinitionChecksum: savedRecord.definitionChecksum,
      nodeMap: { country: "new-country", "mid-checkpoint": "new-checkpoint", writer: null, work: null, checkpoint: null },
    });
    expect(resolveBookyJourneyMigration(unfinished)).toBeNull();
  });

  it("never invokes supplied getters, toJSON, inherited state or array accessors", () => {
    const input = fixture(), getter = vi.fn(() => input.migration), toJSON = vi.fn(() => input);
    const accessor = { ...input }; Object.defineProperty(accessor, "migration", { enumerable: true, get: getter });
    expect(resolveBookyJourneyMigration(accessor)).toBeNull();
    expect(resolveBookyJourneyMigration({ ...input, toJSON })).toBeNull();
    expect(resolveBookyJourneyMigration(Object.create(input))).toBeNull();
    expect(resolveBookyJourneyMigration({ ...input, [Symbol("extra")]: true })).toBeNull();
    const nodeMap = { ...input.migration.nodeMap }; Object.defineProperty(nodeMap, "country", { enumerable: true, get: getter });
    expect(getBookyJourneyMigrationChecksum({ ...input.migration, nodeMap })).toBeNull();
    const receipts = [...input.approvedMigrationReceipts]; Object.defineProperty(receipts, "0", { enumerable: true, get: getter });
    expect(resolveBookyJourneyMigration({ ...input, approvedMigrationReceipts: receipts })).toBeNull();
    expect(getter).not.toHaveBeenCalled(); expect(toJSON).not.toHaveBeenCalled();
  });

  it("bounds candidate data, rejects unknown fields and does not mutate historical records on rejection", () => {
    const input = fixture(), original = JSON.stringify(input.savedRecord);
    expect(resolveBookyJourneyMigration({ ...input, extra: true })).toBeNull();
    expect(resolveBookyJourneyMigration({ ...input, approvedMigrationReceipts: Array(129).fill(input.approvedMigrationReceipts[0]) })).toBeNull();
    expect(getBookyJourneyMigrationChecksum({ ...input.migration,
      nodeMap: Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`node-${index}`, null])) })).toBeNull();
    expect(resolveBookyJourneyMigration({ ...input, now: "x".repeat(8193) })).toBeNull();
    const cycle: Record<string, unknown> = {}; cycle.cycle = cycle;
    expect(resolveBookyJourneyMigration({ ...input, currentPlan: cycle })).toBeNull();
    expect(JSON.stringify(input.savedRecord)).toBe(original);
  });
});

describe("activity migration requires equivalent derived semantics", () => {
  const spec: BookyJourneyActivitySpec = { schemaVersion: 1, id: "match-synthetic-work", version: 1, type: "match-work-author",
    targetWork: { kind: "work", countryId: "synthetic-country", writerId: "synthetic-writer", workId: "synthetic-work" },
    choices: [{ id: "owner", writer: { kind: "writer", countryId: "synthetic-country", writerId: "synthetic-writer" } },
      { id: "other", writer: { kind: "writer", countryId: "synthetic-country", writerId: "other-writer" } }] };
  function activityDefinition(version: number, task = spec): BookyJourneyDefinition {
    const source = definition(version);
    return { ...source, nodes: [source.nodes[0], { id: "activity", kind: "activity", screen: "globe", entity: null,
      activity: task, dialogue: { id: "synthetic-activity", version: 1, contentChecksum: "b".repeat(64) } }, source.nodes[3]] };
  }
  function activityFixture(count = 2, author?: string, task = spec): BookyJourneyMigrationInput {
    const historicalDefinition = activityDefinition(1), old = hostPlan(historicalDefinition);
    const currentDefinition = activityDefinition(2, task);
    const currentPlan = hostPlan({ ...currentDefinition, nodes: currentDefinition.nodes.map(node => ({ ...node, id: `new-${node.id}` })) }, author);
    const savedRecord = createBookyJourneyProgressRecord(policy, old, old.nodes.slice(0, count).map(node => node.id), old.nodes[count]?.id ?? null)!;
    return reviewed({ savedRecord, historicalDefinition, currentPlan, currentPolicy: policy, now,
      migration: { schemaVersion: 1, id: "synthetic-activity-v1-v2", journeyId: historicalDefinition.id, locale: "en", fromVersion: 1,
        fromDefinitionChecksum: savedRecord.definitionChecksum, toVersion: 2, toDefinitionChecksum: currentPlan.definitionChecksum,
        nodeMap: { country: "new-country", activity: "new-activity", checkpoint: "new-checkpoint" }, safeCheckpointId: null },
      approvedMigrationReceipts: [] });
  }

  it("transfers an acknowledged activity only with its exact saved semantic fingerprint", () => {
    const input = activityFixture(), original = JSON.stringify(input.savedRecord), result = resolveBookyJourneyMigration(input)!;
    expect(result.targetRecord.acknowledgedNodeIds).toEqual(["new-country", "new-activity"]);
    expect(result.targetRecord.resumeNodeId).toBe("new-checkpoint");
    expect(result.targetRecord.nodes[1].activity).toEqual(input.savedRecord.nodes[1].activity);
    expect(result.preservedRecord).toEqual(input.savedRecord); expect(JSON.stringify(input.savedRecord)).toBe(original);
    expect(JSON.stringify(result.targetRecord)).not.toContain("correctChoiceId");
  });

  it("rejects changed factual author, authorship provenance, question id or version despite fresh mapping review", () => {
    const original = activityFixture();
    for (const changed of [activityFixture(2, "other-writer"), activityFixture(2, "synthetic-writer"),
      activityFixture(2, undefined, { ...spec, id: "different-question" }), activityFixture(2, undefined, { ...spec, version: 2 })]) {
      expect(changed.approvedMigrationReceipts).toHaveLength(1);
      expect(resolveBookyJourneyMigration(changed)).toBeNull();
    }
    const authorChanged = activityFixture(2, "other-writer");
    expect(authorChanged.currentPlan.definitionChecksum).toBe(original.currentPlan.definitionChecksum);
    expect(authorChanged.currentPlan.nodes[1].activity!.semanticChecksum).not.toBe(original.currentPlan.nodes[1].activity!.semanticChecksum);
  });

  it("does not manufacture a saved answer for an unacknowledged changed activity", () => {
    const input = activityFixture(1, "other-writer"), result = resolveBookyJourneyMigration(input)!;
    expect(result.targetRecord.acknowledgedNodeIds).toEqual(["new-country"]);
    expect(result.targetRecord.resumeNodeId).toBe("new-activity");
    expect(result.targetRecord.nodes[1].activity!.semanticChecksum).not.toBe(input.savedRecord.nodes[1].activity!.semanticChecksum);
    expect(result.preservedRecord).toEqual(input.savedRecord);
  });

  it("rejects forged task metadata and legacy checkpoints relabelled as answered activities", () => {
    const input = activityFixture();
    const savedRecord = { ...input.savedRecord, nodes: input.savedRecord.nodes.map((node, index) => index === 1
      ? { ...node, activity: { ...node.activity!, id: "forged-task" } } : node) };
    expect(resolveBookyJourneyMigration({ ...input, savedRecord })).toBeNull();
    const legacyDefinition = definition(1, [nodes[0], { ...nodes[3], id: "activity" }, nodes[3]]);
    const legacy = hostPlan(legacyDefinition), legacySaved = createBookyJourneyProgressRecord(policy, legacy, ["country", "activity"], "checkpoint")!;
    const legacyInput = reviewed({ ...input, historicalDefinition: legacyDefinition, savedRecord: legacySaved },
      { fromDefinitionChecksum: legacySaved.definitionChecksum });
    expect(resolveBookyJourneyMigration(legacyInput)).toBeNull();
  });
});


describe("reviewed migration with optional route overview", () => {
  const overview = { description: "Synthetic route overview", estimatedDurationMinutes: 15 };
  function overviewFixture() {
    const base = fixture(), historicalDefinition = { ...definition(1), overview };
    const currentDefinition = { ...definition(2, nodes.map(node => ({ ...node, id: 'new-' + node.id }))),
      overview: { ...overview, description: "Synthetic revised route overview", estimatedDurationMinutes: 20 } };
    const currentPlan = hostPlan(currentDefinition);
    const savedRecord = createBookyJourneyProgressRecord(policy, hostPlan(historicalDefinition), ["country", "writer"], "work")!;
    return { input: reviewed({ ...base, historicalDefinition, savedRecord, currentPlan },
      { fromDefinitionChecksum: savedRecord.definitionChecksum, toDefinitionChecksum: currentPlan.definitionChecksum }), currentDefinition };
  }

  it("accepts exact enriched historical/current definitions while preserving only semantic records", () => {
    const { input } = overviewFixture(), original = JSON.stringify(input.savedRecord);
    const result = resolveBookyJourneyMigration(input)!;
    expect(result).not.toBeNull(); expect(result.preservedRecord).toEqual(input.savedRecord);
    expect(result.targetRecord).toMatchObject({ acknowledgedNodeIds: ["new-country", "new-writer"], resumeNodeId: "new-work" });
    for (const field of ["overview", "description", "estimatedDurationMinutes", "offlineAvailable"]) {
      expect(JSON.stringify(result)).not.toContain('"' + field + '"');
    }
    const offlineChanged = { ...input, currentPlan: { ...input.currentPlan, overview: { ...input.currentPlan.overview!, offlineAvailable: false } } };
    expect(resolveBookyJourneyMigration(offlineChanged)).toEqual(result);
    expect(JSON.stringify(input.savedRecord)).toBe(original);
  });

  it("requires independent mapping review for the authored overview checksum and rejects malformed compiled metadata", () => {
    const { input, currentDefinition } = overviewFixture();
    expect(resolveBookyJourneyMigration({ ...input, historicalDefinition: { ...input.historicalDefinition,
      overview: { ...overview, description: "Changed after review" } } })).toBeNull();
    const edited = hostPlan({ ...currentDefinition, overview: { ...overview, estimatedDurationMinutes: 21 } });
    expect(resolveBookyJourneyMigration({ ...input, currentPlan: edited })).toBeNull();
    for (const value of [null, undefined, {}, { ...input.currentPlan.overview, offlineAvailable: 1 },
      { ...input.currentPlan.overview, extra: true }]) {
      expect(resolveBookyJourneyMigration({ ...input, currentPlan: { ...input.currentPlan, overview: value } })).toBeNull();
    }
    const getter = vi.fn(() => input.currentPlan.overview), accessor = { ...input.currentPlan };
    Object.defineProperty(accessor, "overview", { enumerable: true, get: getter });
    expect(resolveBookyJourneyMigration({ ...input, currentPlan: accessor })).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
});


describe("sourced-fact migration keeps exact bilingual semantic meaning", () => {
  const spec: BookyJourneyFactSpec = { schemaVersion: 1, id: "test-fact", version: 1, dialogues: [
    { locale: "ru", id: "test-fact-dialogue", version: 1, contentChecksum: "b".repeat(64) },
    { locale: "en", id: "test-fact-dialogue", version: 1, contentChecksum: "a".repeat(64) },
  ] };
  function withFact(version: number, factSpec = spec): BookyJourneyDefinition {
    const base = definition(version), prefix = version === 1 ? "" : "new-";
    const fact = { id: prefix + "fact", kind: "sourced-fact" as const, screen: "collection" as const, entity: nodes[2].entity,
      dialogue: { id: factSpec.dialogues[1].id, version: factSpec.dialogues[1].version, contentChecksum: factSpec.dialogues[1].contentChecksum }, fact: factSpec };
    return { ...base, nodes: [...base.nodes.slice(0, 3).map(node => ({ ...node, id: prefix + node.id })), fact,
      { ...base.nodes[3], id: prefix + "checkpoint" }] };
  }
  function factFixture(count = 4, targetSpec = spec): BookyJourneyMigrationInput {
    const base = fixture(), historicalDefinition = withFact(1), currentPlan = hostPlan(withFact(2, targetSpec));
    const old = hostPlan(historicalDefinition), savedRecord = createBookyJourneyProgressRecord(policy, old,
      old.nodes.slice(0, count).map(node => node.id), old.nodes[count]?.id ?? null)!;
    return reviewed({ ...base, historicalDefinition, savedRecord, currentPlan }, { fromDefinitionChecksum: savedRecord.definitionChecksum,
      toDefinitionChecksum: currentPlan.definitionChecksum, nodeMap: Object.fromEntries(old.nodes.map(node => [node.id, "new-" + node.id])) });
  }

  it("transfers only acknowledged facts with the exact bilingual fingerprint and preserves the old record", () => {
    const input = factFixture(), original = JSON.stringify(input.savedRecord), result = resolveBookyJourneyMigration(input)!;
    expect(result).not.toBeNull(); expect(result.preservedRecord).toEqual(input.savedRecord);
    expect(result.targetRecord.acknowledgedNodeIds).toEqual(["new-country", "new-writer", "new-work", "new-fact"]);
    expect(result.targetRecord.resumeNodeId).toBe("new-checkpoint");
    expect(result.targetRecord.nodes[3].fact).toEqual(input.savedRecord.nodes[3].fact);
    expect(JSON.stringify(result)).not.toMatch(/"(?:spec|dialogues|contentChecksum|body|factualSources|url)"/u);
    expect(JSON.stringify(input.savedRecord)).toBe(original);
  });

  it("denies acknowledged fact transfer after either locale binding, identity or version changes despite fresh mapping review", () => {
    const alternatives: BookyJourneyFactSpec[] = [
      { ...spec, id: "other-fact" }, { ...spec, version: 2 },
      { ...spec, dialogues: [{ ...spec.dialogues[0], contentChecksum: "c".repeat(64) }, spec.dialogues[1]] },
      { ...spec, dialogues: [spec.dialogues[0], { ...spec.dialogues[1], contentChecksum: "c".repeat(64) }] },
    ];
    for (const changed of alternatives) expect(resolveBookyJourneyMigration(factFixture(4, changed))).toBeNull();
  });

  it("may retain an unacknowledged fact cursor under explicit review without manufacturing acknowledgement", () => {
    const changed: BookyJourneyFactSpec = { ...spec, version: 2 }, input = factFixture(3, changed);
    const result = resolveBookyJourneyMigration(input)!; expect(result).not.toBeNull();
    expect(result.targetRecord.acknowledgedNodeIds).toEqual(["new-country", "new-writer", "new-work"]);
    expect(result.targetRecord.resumeNodeId).toBe("new-fact"); expect(result.targetRecord.nodes[3].fact!.version).toBe(2);
    expect(result.preservedRecord.nodes[3].fact!.version).toBe(1);
  });

  it("rejects forged historical fact fingerprints even when the saved cursor has not acknowledged the fact", () => {
    const input = factFixture(3), forged = { ...input.savedRecord, nodes: input.savedRecord.nodes.map(node => node.kind === "sourced-fact"
      ? { ...node, fact: { ...node.fact!, semanticChecksum: "e".repeat(64) } } : node) };
    expect(resolveBookyJourneyMigration({ ...input, savedRecord: forged })).toBeNull();
    const getter = vi.fn(() => spec), fact = input.currentPlan.nodes[3];
    const hostile = Object.defineProperty({ ...fact.fact }, "spec", { enumerable: true, get: getter });
    expect(resolveBookyJourneyMigration({ ...input, currentPlan: { ...input.currentPlan,
      nodes: input.currentPlan.nodes.map(node => node === fact ? { ...node, fact: hostile } : node) } })).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });
});

function characterDefinition(version: number): BookyJourneyDefinition {
  const route = definition(version), work = route.nodes[2].entity as BookyJourneyCharacterSpec["work"];
  const character: BookyJourneyCharacterSpec = { schemaVersion: 1, id: "synthetic-character", version: 1, work, bindings: [
    { locale: "ru", dossierVersion: "test-v1", sectionId: "people", blockId: "characters", itemId: "person-c", readingMode: "BEFORE_READING",
      projectionChecksum: "a".repeat(64), dialogue: { id: "test-character", version: 1, contentChecksum: "a".repeat(64) } },
    { locale: "en", dossierVersion: "test-v1", sectionId: "people", blockId: "characters", itemId: "person-c", readingMode: "BEFORE_READING",
      projectionChecksum: "b".repeat(64), dialogue: { id: "test-character", version: 1, contentChecksum: "a".repeat(64) } },
  ] };
  return { ...route, nodes: [...route.nodes.slice(0, 3), { id: "character", kind: "character", screen: "collection", entity: work,
    dialogue: character.bindings[1].dialogue, character }, route.nodes[3]] };
}

describe("current-only character migration boundary", () => {
  it.each(["source", "target"] as const)("refuses character %s history without mutating its saved prefix", side => {
    const historicalDefinition = side === "source" ? characterDefinition(1) : definition(1);
    const currentPlan = hostPlan(side === "target" ? characterDefinition(2) : definition(2));
    const savedRecord = createBookyJourneyProgressRecord(policy, hostPlan(historicalDefinition), ["country", "writer"], "work")!;
    expect(savedRecord).not.toBeNull();
    const input = reviewed({ ...fixture(), historicalDefinition, currentPlan, savedRecord, migration: {
      ...fixture().migration, fromDefinitionChecksum: savedRecord.definitionChecksum, toDefinitionChecksum: currentPlan.definitionChecksum,
      nodeMap: Object.fromEntries(savedRecord.nodes.map(node => [node.id, currentPlan.nodes.some(target => target.id === node.id) ? node.id : null])),
    } });
    const before = JSON.stringify(input);
    expect(resolveBookyJourneyMigration(input)).toBeNull();
    expect(JSON.stringify(input)).toBe(before);
  });
});
