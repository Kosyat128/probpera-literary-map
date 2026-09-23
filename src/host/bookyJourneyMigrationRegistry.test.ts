import { describe, expect, it, vi } from "vitest";
import { getBookyJourneyChecksum, type BookyJourneyDefinition, type BookyJourneyPlan } from "./bookyJourney";
import { getBookyJourneyMigrationChecksum, type BookyJourneyMigration } from "./bookyJourneyMigration";
import { readBookyJourneyMigrationContent, type BookyJourneyMigrationContent } from "./bookyJourneyMigrationContent";
import { createBookyJourneyMigrationRegistry } from "./bookyJourneyMigrationRegistry";
import { createBookyJourneyProgressRecord } from "./bookyJourneyProgress";
import { createBookyReaderPolicy } from "./bookyReaderPolicy";

const reviewedAt = "2026-09-22T12:00:00.000Z", now = "2026-09-23T12:00:00.000Z";
const policy = createBookyReaderPolicy({ age: 30, readingLevel: "plain" }, reviewedAt, 1)!;
function definition(version = 1, prefix = ""): BookyJourneyDefinition {
  return { schemaVersion: 1, id: "synthetic-journey", version, locale: "en", audience: "adult",
    ageRange: { min: 18, max: 120 }, readingLevel: "plain", title: "Synthetic registry fixture", prerequisites: [], nodes: [
      { id: `${prefix}country`, kind: "country", screen: "globe", entity: { kind: "country", countryId: "synthetic-country" },
        dialogue: { id: "country-dialogue", version: 1, contentChecksum: "a".repeat(64) } },
      { id: `${prefix}checkpoint`, kind: "checkpoint", screen: "globe", entity: null,
        dialogue: { id: "checkpoint-dialogue", version: 1, contentChecksum: "b".repeat(64) } },
    ] };
}
function hostPlan(source: BookyJourneyDefinition): BookyJourneyPlan {
  // A structural stand-in for an already admitted host plan. These fixtures
  // do not create production review receipts or prove editorial admission.
  return { id: source.id, version: source.version, locale: source.locale, title: source.title,
    definitionChecksum: getBookyJourneyChecksum(source)!, nodes: source.nodes.map(node => {
      if (node.kind === "activity") throw Error("This structural fixture covers ordinary nodes only");
      return { id: node.id, kind: node.kind, screen: node.screen, entity: node.entity,
        coordinates: null, dialogue: {} as BookyJourneyPlan["nodes"][number]["dialogue"] };
    }) };
}
function fixture() {
  const historicalDefinition = definition(), currentPlan = hostPlan(definition(2, "new-"));
  const savedRecord = createBookyJourneyProgressRecord(policy, hostPlan(historicalDefinition), ["country"], "checkpoint")!;
  const migration: BookyJourneyMigration = { schemaVersion: 1, id: "synthetic-v1-v2", journeyId: historicalDefinition.id,
    locale: "en", fromVersion: 1, fromDefinitionChecksum: savedRecord.definitionChecksum, toVersion: 2,
    toDefinitionChecksum: currentPlan.definitionChecksum, nodeMap: { country: "new-country", checkpoint: "new-checkpoint" }, safeCheckpointId: null };
  const receipt = { id: migration.id, checksum: getBookyJourneyMigrationChecksum(migration)!,
    reviewer: "synthetic-test-reviewer-not-real", reviewedAt };
  const content: BookyJourneyMigrationContent = { historicalDefinitions: [historicalDefinition], migrations: [migration],
    approvedMigrationReceipts: [receipt] };
  return { historicalDefinition, currentPlan, savedRecord, migration, receipt, content };
}
const resolve = (content: unknown, f = fixture()) => createBookyJourneyMigrationRegistry(content).resolve(f.savedRecord, f.currentPlan, policy, now);

describe("Booky journey migration inventory registry", () => {
  it("keeps production inventory stable, deeply frozen and empty", () => {
    const content = readBookyJourneyMigrationContent();
    expect(readBookyJourneyMigrationContent()).toBe(content);
    expect(content).toEqual({ historicalDefinitions: [], migrations: [], approvedMigrationReceipts: [] });
    expect(Object.isFrozen(content)).toBe(true);
    for (const values of Object.values(content)) expect(Object.isFrozen(values)).toBe(true);
    expect(resolve(content)).toBeNull();
  });

  it("resolves one independently reviewed exact mapping without changing historical progress", () => {
    const f = fixture(), before = JSON.stringify(f.savedRecord), registry = createBookyJourneyMigrationRegistry(f.content);
    const offer = registry.resolve(f.savedRecord, f.currentPlan, policy, now)!;
    expect(offer).toMatchObject({ migrationId: f.migration.id, migrationChecksum: f.receipt.checksum, preservedRecord: f.savedRecord,
      targetRecord: { journeyVersion: 2, acknowledgedNodeIds: ["new-country"], resumeNodeId: "new-checkpoint" } });
    expect(offer.targetRecord.recordId).not.toBe(f.savedRecord.recordId);
    expect(JSON.stringify(f.savedRecord)).toBe(before); expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(offer)).toBe(true); expect(Object.isFrozen(offer.targetRecord.nodes)).toBe(true);
    expect(registry.resolve(f.savedRecord, f.currentPlan, policy, now)).toEqual(offer);
  });

  it("requires a separate exact receipt with a valid reviewer and applicable review time", () => {
    const f = fixture();
    for (const approvedMigrationReceipts of [[], [{ ...f.receipt, id: "unbound-review" }],
      [{ ...f.receipt, checksum: "c".repeat(64) }], [{ ...f.receipt, reviewer: "" }],
      [{ ...f.receipt, reviewedAt: "2026-09-24T12:00:00.000Z" }]]) {
      expect(resolve({ ...f.content, approvedMigrationReceipts }, f)).toBeNull();
    }
    expect(resolve({ ...f.content, migrations: [{ ...f.migration, review: f.receipt }] }, f)).toBeNull();
  });

  it("binds exact history, target version, locale, policy and time while leaving unknown future records intact", () => {
    const f = fixture(), registry = createBookyJourneyMigrationRegistry(f.content);
    for (const currentPlan of [{ ...f.currentPlan, version: 3 }, { ...f.currentPlan, locale: "ru" as const },
      { ...f.currentPlan, definitionChecksum: "c".repeat(64) }]) {
      expect(registry.resolve(f.savedRecord, currentPlan, policy, now)).toBeNull();
    }
    for (const currentPolicy of [null, { ...policy, age: 31 }, { ...policy, revision: 2 }]) {
      expect(registry.resolve(f.savedRecord, f.currentPlan, currentPolicy, now)).toBeNull();
    }
    expect(registry.resolve(f.savedRecord, f.currentPlan, policy, "2026-09-21T12:00:00.000Z")).toBeNull();
    expect(registry.resolve(f.savedRecord, f.currentPlan, policy, "not-a-time")).toBeNull();
    expect(resolve({ ...f.content, historicalDefinitions: [{ ...f.historicalDefinition, title: "Changed history" }] }, f)).toBeNull();
    expect(resolve({ ...f.content, historicalDefinitions: [definition(7)] }, f)).toBeNull();
    const future = createBookyJourneyProgressRecord(policy, hostPlan(definition(900_000)), ["country"], "checkpoint")!;
    const retained = JSON.stringify(future); expect(registry.resolve(future, f.currentPlan, policy, now)).toBeNull();
    expect(JSON.stringify(future)).toBe(retained);
  });

  it("rejects duplicate histories, migration IDs, origin-target mappings and receipt IDs as a whole", () => {
    const f = fixture();
    for (const content of [
      { ...f.content, historicalDefinitions: [f.historicalDefinition, f.historicalDefinition] },
      { ...f.content, migrations: [f.migration, f.migration] },
      { ...f.content, migrations: [f.migration, { ...f.migration, id: "ambiguous-alternative" }] },
      { ...f.content, approvedMigrationReceipts: [f.receipt, f.receipt] },
      { ...f.content, migrations: [f.migration, { ...f.migration, id: "missing-history", fromVersion: 7, toVersion: 8 }] },
    ]) expect(resolve(content, f)).toBeNull();
  });

  it("does not execute accessors or toJSON on inventory or caller-owned records", () => {
    const f = fixture(), getter = vi.fn(() => [f.historicalDefinition]);
    const content = { ...f.content }; Object.defineProperty(content, "historicalDefinitions", { enumerable: true, get: getter });
    expect(resolve(content, f)).toBeNull(); expect(getter).not.toHaveBeenCalled();
    const toJSON = vi.fn(() => f.content); expect(resolve({ ...f.content, toJSON }, f)).toBeNull(); expect(toJSON).not.toHaveBeenCalled();
    const saved = { ...f.savedRecord }, recordGetter = vi.fn(() => f.savedRecord.journeyId);
    Object.defineProperty(saved, "journeyId", { enumerable: true, get: recordGetter });
    expect(createBookyJourneyMigrationRegistry(f.content).resolve(saved, f.currentPlan, policy, now)).toBeNull();
    expect(recordGetter).not.toHaveBeenCalled();
  });

  it("rejects oversized, sparse, extended and inherited envelopes without offering a partial inventory", () => {
    const f = fixture(), sparse = new Array(2); sparse[0] = f.historicalDefinition;
    for (const content of [
      { ...f.content, historicalDefinitions: Array.from({ length: 129 }, (_, index) => definition(index + 1)) },
      { ...f.content, historicalDefinitions: sparse },
      { ...f.content, extra: true }, Object.create(f.content),
      { ...f.content, migrations: [{ ...f.migration, id: "x".repeat(8193) }] },
    ]) expect(resolve(content, f)).toBeNull();
  });

  it("keeps the validated snapshot independent from later owner mutations", () => {
    const f = fixture();
    const owner = JSON.parse(JSON.stringify(f.content)) as {
      historicalDefinitions: Array<{ title: string }>;
      migrations: Array<{ nodeMap: Record<string, string | null> }>;
      approvedMigrationReceipts: Array<{ checksum: string }>;
    };
    const registry = createBookyJourneyMigrationRegistry(owner), method = registry.resolve;
    const before = method(f.savedRecord, f.currentPlan, policy, now); expect(before).not.toBeNull();
    owner.historicalDefinitions[0].title = "Changed after snapshot";
    owner.migrations[0].nodeMap.country = null; owner.approvedMigrationReceipts[0].checksum = "d".repeat(64);
    owner.historicalDefinitions.length = 0;
    expect(registry.resolve).toBe(method); expect(method(f.savedRecord, f.currentPlan, policy, now)).toEqual(before);
    expect(resolve(owner, f)).toBeNull();
  });
});
