import { describe, expect, it, vi } from "vitest";
import { contentTextHash } from "../planet/contentExportHash";
import type { Country, BookArchiveEntry } from "../planet/types";
import { createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialoguePayload, type BookyDialogueRecord } from "./bookyDialogueRegistry";
import { bookyJourneyEntityId, getBookyJourneyChecksum, type BookyJourneyContext,
  type BookyJourneyDefinition, type BookyJourneyTrust } from "./bookyJourney";
import { resolveBookyJourneyNode, type BookyJourneyHostRequest, type BookyJourneyHostSnapshot } from "./bookyJourneyHost";

const now = "2026-09-20T12:00:00.000Z", reviewedAt = "2026-09-19T12:00:00.000Z";
function fixture(locale: "ru" | "en" = "en", includeWork = true) {
  // Synthetic catalog, policy and reviewers only. These fixtures confer no
  // production journey, content, child-policy or human approval.
  const country: Country = { id: "test-country", name: "Synthetic country", coordinates: [20, 30], writers: [{ id: "test-writer" }] };
  const book: BookArchiveEntry = { id: "test-work", title: "Synthetic work", countryId: country.id, countryName: country.name,
    writerId: "test-writer", writerName: "Synthetic writer", country, writer: country.writers[0], editorial: { status: "verified" } };
  const allNodes: BookyJourneyDefinition["nodes"] = [
    { id: "country", kind: "country", entity: { kind: "country", countryId: country.id }, screen: "globe", dialogue: { id: "test-country-line", version: 1, contentChecksum: "" } },
    { id: "writer", kind: "writer", entity: { kind: "writer", countryId: country.id, writerId: "test-writer" }, screen: "globe", dialogue: { id: "test-writer-line", version: 1, contentChecksum: "" } },
    { id: "work", kind: "work", entity: { kind: "work", countryId: country.id, writerId: "test-writer", workId: book.id }, screen: "collection", dialogue: { id: "test-work-line", version: 1, contentChecksum: "" } },
    { id: "checkpoint", kind: "checkpoint", entity: null, screen: "globe", dialogue: { id: "test-checkpoint-line", version: 1, contentChecksum: "" } },
  ];
  const nodes = includeWork ? allNodes : [allNodes[0], allNodes[3]];
  const records: BookyDialogueRecord[] = nodes.map(node => {
    const copy = { title: locale === "ru" ? "Проверка" : "Test", body: locale === "ru" ? "Текст тестового интерфейса." : "Synthetic interface text.", caption: "Synthetic caption", reduced: "Test" };
    const payload: BookyDialoguePayload = { id: node.dialogue.id, locale, version: 1, audience: "adult", ageRange: { min: 18, max: 120 },
      readingLevel: "plain", intent: "navigation", screens: [node.screen], context: `test-journey:${node.id}`,
      entityIds: node.entity ? [bookyJourneyEntityId(node.entity)] : [], claimKind: "interface-guidance", factualSources: [], copy,
      narration: null, prohibitedTags: [], provenance: { kind: "editorial", sourcePath: "test/fixture.ts", sourceVersion: 1,
        sourceRef: node.id, sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
    const review = { status: "approved" as const, reviewer: "synthetic-reviewer-not-real", reviewedAt, contentChecksum: getBookyDialogueContentChecksum(payload)! };
    return { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
  });
  const definition: BookyJourneyDefinition = { schemaVersion: 1, id: "test-journey", version: 1, locale, audience: "adult",
    ageRange: { min: 18, max: 120 }, readingLevel: "plain", title: locale === "ru" ? "Тестовый маршрут" : "Synthetic journey", prerequisites: [],
    nodes: nodes.map((node, index) => ({ ...node, dialogue: { ...node.dialogue, contentChecksum: records[index].review.contentChecksum } })) };
  const context: BookyJourneyContext = { audience: "adult", age: 30, locale, readingLevel: "plain", now, connectivity: "online", completedPrerequisites: [],
    availability: definition.nodes.map(node => ({ nodeId: node.id, locale, dialogueContentChecksum: node.dialogue.contentChecksum, available: true, offlineAvailable: true })) };
  const trust: BookyJourneyTrust = { currentVersions: [{ id: definition.id, version: 1 }], approvedReviews: [
    { id: definition.id, version: 1, locale, definitionChecksum: getBookyJourneyChecksum(definition)!, reviewer: "synthetic-journey-reviewer-not-real", reviewedAt },
  ], dialogueRegistry: createBookyDialogueRegistry(records, { canonicalEntityIds: records.flatMap(record => [...record.payload.entityIds]),
    approvedReviews: records.map(record => ({ id: record.payload.id, locale, version: 1,
      contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt })) }), publicCountries: [country], publicBooks: [book] };
  let host: BookyJourneyHostSnapshot | null = Object.freeze({ revision: 1, enabled: true, active: true, access: "adult",
    countryStatus: "ready", booksStatus: "ready", context, definition, trust });
  const request: BookyJourneyHostRequest = { journeyId: definition.id, version: 1, locale,
    definitionChecksum: getBookyJourneyChecksum(definition)!, nodeId: "country", hostRevision: 1 };
  const read = () => host;
  const update = (change: Partial<BookyJourneyHostSnapshot>) => {
    host = Object.freeze({ ...host!, ...change, revision: host!.revision + 1 });
    return { ...request, hostRevision: host.revision };
  };
  return { request, context, trust, definition, records, read, update, clear: () => { host = null; } };
}

describe("fresh host admission of Booky journey nodes", () => {
  it.each(["ru", "en"] as const)("returns a frozen exact %s offer from a complete reviewed route", locale => {
    const f = fixture(locale), read = vi.fn(f.read);
    const offer = resolveBookyJourneyNode(f.request, read)!;
    expect(offer).not.toBeNull();
    expect(offer).toMatchObject({ ...f.request, node: { id: "country", coordinates: [20, 30] } });
    expect(offer.node.dialogue.payload.locale).toBe(locale);
    expect(Object.isFrozen(offer)).toBe(true);
    expect(Object.isFrozen(offer.node.dialogue.payload.copy)).toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("requires actual explicit policy and an enabled active adult application", () => {
    const f = fixture(), initial = f.read()!;
    for (const change of [{ enabled: false }, { active: false }, { access: "child" as const }, { access: "blocked" as const }, { context: null }]) {
      const host = { ...initial, ...change };
      expect(resolveBookyJourneyNode(f.request, () => host)).toBeNull();
    }
    for (const change of [{ age: undefined }, { readingLevel: undefined }, { audience: "child", age: 12 }]) {
      const host = { ...initial, context: { ...f.context, ...change } as unknown as BookyJourneyContext };
      expect(resolveBookyJourneyNode(f.request, () => host)).toBeNull();
    }
    f.clear();
    expect(resolveBookyJourneyNode(f.request, f.read)).toBeNull();
  });

  it("suspends retained catalog plans on country reload and does not retain prior admission", () => {
    const f = fixture();
    expect(resolveBookyJourneyNode(f.request, f.read)).not.toBeNull();
    for (const countryStatus of ["idle", "loading", "error"] as const) {
      const request = f.update({ countryStatus });
      expect(resolveBookyJourneyNode(request, f.read)).toBeNull();
    }
    const request = f.update({ countryStatus: "ready" });
    expect(resolveBookyJourneyNode(f.request, f.read)).toBeNull();
    expect(resolveBookyJourneyNode(request, f.read)).not.toBeNull();
  });

  it("requires current books for the whole work route, while country-only routes remain independent", () => {
    for (const includeWork of [true, false]) {
      const f = fixture("en", includeWork);
      for (const booksStatus of ["idle", "loading", "error"] as const) {
        const request = f.update({ booksStatus });
        const offer = resolveBookyJourneyNode(request, f.read);
        if (includeWork) expect(offer).toBeNull(); else expect(offer).not.toBeNull();
      }
    }
  });

  it("preserves ready offline catalogs and checks every node's actual availability", () => {
    const f = fixture();
    for (const connectivity of ["offline", "unknown"] as const) {
      const request = f.update({ context: { ...f.context, connectivity } });
      expect(resolveBookyJourneyNode(request, f.read)).not.toBeNull();
      const unavailable = f.update({ context: { ...f.context, connectivity,
        availability: f.context.availability.map(item => item.nodeId === "work" ? { ...item, offlineAvailable: false } : item) } });
      expect(resolveBookyJourneyNode(unavailable, f.read)).toBeNull();
    }
  });

  it("binds requests to exact route, locale, node, checksum, version and current host revision", () => {
    const f = fixture();
    for (const change of [{ journeyId: "other" }, { version: 2 }, { locale: "ru" }, { nodeId: "absent" },
      { definitionChecksum: "b".repeat(64) }, { hostRevision: 0 }]) {
      expect(resolveBookyJourneyNode({ ...f.request, ...change }, f.read)).toBeNull();
    }
    const request = f.update({ trust: { ...f.trust, currentVersions: [{ id: "test-journey", version: 2 }] } });
    expect(resolveBookyJourneyNode(request, f.read)).toBeNull();
  });

  it("rechecks independent review revocation and entity withdrawal after previous success", () => {
    const f = fixture();
    expect(resolveBookyJourneyNode(f.request, f.read)).not.toBeNull();
    for (const change of [{ approvedReviews: [] }, { publicCountries: [] }, { publicBooks: [] },
      { dialogueRegistry: createBookyDialogueRegistry(f.records) }]) {
      const request = f.update({ trust: { ...f.trust, ...change } });
      expect(resolveBookyJourneyNode(request, f.read)).toBeNull();
    }
  });

  it("rejects host replacement from an injected resolver before offering any admitted node", () => {
    const f = fixture(), registry = f.trust.dialogueRegistry;
    const request = f.update({ trust: { ...f.trust, dialogueRegistry: { ...registry, resolve(value) {
      f.update({ access: "blocked" });
      return registry.resolve(value);
    } } } });
    expect(resolveBookyJourneyNode(request, f.read)).toBeNull();
    const g = fixture();
    expect(resolveBookyJourneyNode(g.request, () => ({ ...g.read()! }))).toBeNull();
    let reads = 0;
    expect(resolveBookyJourneyNode(g.request, () => ++reads === 1 ? g.read() : null)).toBeNull();
  });

  it("fails closed when host reads or dialogue resolution throw", () => {
    const f = fixture(), fail = () => { throw new Error("Unavailable"); };
    expect(resolveBookyJourneyNode(f.request, fail)).toBeNull();
    let reads = 0;
    expect(resolveBookyJourneyNode(f.request, () => ++reads === 1 ? f.read() : fail())).toBeNull();
    const request = f.update({ trust: { ...f.trust, dialogueRegistry: { size: 0, rejections: [], resolve: fail } } });
    expect(resolveBookyJourneyNode(request, f.read)).toBeNull();
  });

  it("rejects malformed and accessor requests without reading host or executing accessors", () => {
    const f = fixture(), read = vi.fn(f.read), getter = vi.fn(() => "test-journey");
    const accessor = Object.defineProperty({ ...f.request }, "journeyId", { enumerable: true, get: getter });
    const hidden = Object.defineProperty({ ...f.request }, "journeyId", { enumerable: false, value: "test-journey" });
    for (const input of [null, [], accessor, hidden, Object.create(f.request), { ...f.request, extra: true },
      { ...f.request, [Symbol("extra")]: true }, { ...f.request, nodeId: undefined }, { ...f.request, version: 1.5 },
      { ...f.request, journeyId: "a".repeat(97) }, { ...f.request, definitionChecksum: "invalid" },
      { ...f.request, hostRevision: -1 }, { ...f.request, hostRevision: Number.MAX_SAFE_INTEGER + 1 }]) {
      expect(resolveBookyJourneyNode(input, read)).toBeNull();
    }
    expect(getter).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});
