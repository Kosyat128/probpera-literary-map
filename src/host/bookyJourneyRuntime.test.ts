import { describe, expect, it, vi } from "vitest";
import type { Country, BookArchiveEntry } from "../planet/types";
import { contentTextHash } from "../planet/contentExportHash";
import { createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialoguePayload, type BookyDialogueRecord } from "./bookyDialogueRegistry";
import { bookyJourneyEntityId, compileBookyJourney, getBookyJourneyChecksum,
  type BookyJourneyContext, type BookyJourneyDefinition, type BookyJourneyTrust } from "./bookyJourney";
import { resolveBookyJourneyNode, type BookyJourneyHostOffer, type BookyJourneyHostSnapshot } from "./bookyJourneyHost";
import { bookyJourneyRouteKey, createBookyJourneyRuntime, type BookyJourneyRuntimeHost } from "./bookyJourneyRuntime";
import { createBookyReaderPolicy, serializeBookyReaderPolicy } from "./bookyReaderPolicy";
import { DEFAULT_BOOKY_JOURNEY_PROGRESS, createBookyJourneyProgressRecord,
  type BookyJourneyProgressPreference } from "./bookyJourneyProgress";

const now = "2026-09-23T12:00:00.000Z", reviewedAt = "2026-09-22T12:00:00.000Z";
function fixture(locale: "ru" | "en" = "en", options: { id?: string; version?: number; workId?: string; writerNodeId?: string; title?: string;
  checkpointScreen?: "globe" | "collection" } = {}) {
  // Synthetic reviewers, content, public catalog and receipts ONLY for tests.
  // No production draft receives approval, narration or child eligibility.
  const journeyId = options.id ?? "test-journey";
  const country: Country = { id: "test-country", name: "Synthetic country", coordinates: [20, 30], writers: [{ id: "test-writer" }] };
  const book: BookArchiveEntry = { id: options.workId ?? "test-work", title: "Synthetic work", countryId: country.id, countryName: country.name,
    writerId: "test-writer", writerName: "Synthetic writer", country, writer: country.writers[0], editorial: { status: "verified" } };
  const nodes: BookyJourneyDefinition["nodes"] = [
    { id: "country", kind: "country", entity: { kind: "country", countryId: country.id }, screen: "globe", dialogue: { id: "test-country", version: 1, contentChecksum: "" } },
    { id: options.writerNodeId ?? "writer", kind: "writer", entity: { kind: "writer", countryId: country.id, writerId: "test-writer" }, screen: "globe", dialogue: { id: "test-writer", version: 1, contentChecksum: "" } },
    { id: "work", kind: "work", entity: { kind: "work", countryId: country.id, writerId: "test-writer", workId: book.id }, screen: "collection", dialogue: { id: "test-work", version: 1, contentChecksum: "" } },
    { id: "checkpoint", kind: "checkpoint", entity: null, screen: options.checkpointScreen ?? "globe", dialogue: { id: "test-checkpoint", version: 1, contentChecksum: "" } },
  ];
  const records: BookyDialogueRecord[] = nodes.map(node => {
    const copy = { title: `${locale}: ${node.id}`, body: `${locale}: synthetic test instruction.`, caption: "Synthetic test caption", reduced: "Test" };
    const payload: BookyDialoguePayload = { id: node.dialogue.id, locale, version: 1, audience: "adult", ageRange: { min: 18, max: 120 },
      readingLevel: "plain", intent: "navigation", screens: [node.screen], context: `${journeyId}:${node.id}`,
      entityIds: node.entity ? [bookyJourneyEntityId(node.entity)] : [], claimKind: "interface-guidance", factualSources: [], copy,
      narration: null, prohibitedTags: [], provenance: { kind: "editorial", sourcePath: "test/runtime.ts", sourceVersion: 1,
        sourceRef: node.id, sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
    const review = { status: "approved" as const, reviewer: "synthetic-reviewer-not-real", reviewedAt, contentChecksum: getBookyDialogueContentChecksum(payload)! };
    return { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
  });
  const definition: BookyJourneyDefinition = { schemaVersion: 1, id: journeyId, version: options.version ?? 1, locale, audience: "adult",
    ageRange: { min: 18, max: 120 }, readingLevel: "plain", title: options.title ?? `${locale}: Synthetic journey`, prerequisites: [],
    nodes: nodes.map((node, index) => ({ ...node, dialogue: { ...node.dialogue, contentChecksum: records[index].review.contentChecksum } })) };
  const context: BookyJourneyContext = { audience: "adult", age: 30, locale, readingLevel: "plain", now, connectivity: "online", completedPrerequisites: [],
    availability: definition.nodes.map(node => ({ nodeId: node.id, locale, dialogueContentChecksum: node.dialogue.contentChecksum, available: true, offlineAvailable: true })) };
  const trust: BookyJourneyTrust = { currentVersions: [{ id: definition.id, version: definition.version }], approvedReviews: [
    { id: definition.id, version: definition.version, locale, definitionChecksum: getBookyJourneyChecksum(definition)!, reviewer: "synthetic-journey-reviewer-not-real", reviewedAt },
  ], dialogueRegistry: createBookyDialogueRegistry(records, { canonicalEntityIds: records.flatMap(record => [...record.payload.entityIds]),
    approvedReviews: records.map(record => ({ id: record.payload.id, locale, version: 1,
      contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt })) }), publicCountries: [country], publicBooks: [book] };
  const plan = compileBookyJourney(definition, context, trust);
  if (!plan) throw new Error("invalid-synthetic-runtime-fixture");
  return { definition, context, trust, plan };
}
function setup() {
  const initial = fixture(), sources = new Map([[bookyJourneyRouteKey(initial.plan), initial]]);
  let host: BookyJourneyRuntimeHost;
  const resolve: BookyJourneyRuntimeHost["resolve"] = (plan, nodeId) => {
    const source = sources.get(bookyJourneyRouteKey(plan));
    if (!source) return null;
    const boundary: BookyJourneyHostSnapshot = Object.freeze({ revision: host.revision, enabled: true, active: host.active,
      access: "adult", countryStatus: "ready", booksStatus: "ready", context: source.context, definition: source.definition, trust: source.trust });
    return resolveBookyJourneyNode({ journeyId: plan.id, version: plan.version, locale: plan.locale,
      definitionChecksum: plan.definitionChecksum, nodeId, hostRevision: host.revision }, () => boundary);
  };
  host = Object.freeze({ revision: 1, active: true, profileKey: "adult-policy:1", locale: "en", plans: [initial.plan], resolve,
    view: Object.freeze({ screen: "globe", countryId: null, writerId: null, workId: null, settled: true }) });
  const readHost = vi.fn(() => host), navigate = vi.fn((_offer: BookyJourneyHostOffer, _signal: AbortSignal) => true);
  const runtime = createBookyJourneyRuntime({ readHost, navigate });
  const patch = (change: Partial<BookyJourneyRuntimeHost>) => { host = Object.freeze({ ...host, ...change, revision: host.revision + 1 }); };
  const display = (index: number, overrides: Partial<BookyJourneyRuntimeHost["view"]> = {}) => {
    const node = host.plans[0].nodes[index], entity = node.entity;
    patch({ view: Object.freeze({ screen: node.screen, countryId: entity?.countryId ?? null,
      writerId: entity && entity.kind !== "country" ? entity.writerId : null,
      workId: entity?.kind === "work" ? entity.workId : null, settled: true, ...overrides }) }); runtime.refresh();
  };
  const start = () => { runtime.refresh(); return runtime.start(bookyJourneyRouteKey(host.plans[0]), runtime.getSnapshot().revision); };
  const switchSource = (source: ReturnType<typeof fixture>) => {
    sources.set(bookyJourneyRouteKey(source.plan), source); patch({ locale: source.plan.locale, plans: [source.plan] }); runtime.refresh();
  };
  return { initial, runtime, readHost, navigate, patch, display, start, switchSource, host: () => host, resolve };
}
const explicitPolicy = createBookyReaderPolicy({ age: 30, readingLevel: "plain" }, reviewedAt, 1)!;
const durableProfileKey = serializeBookyReaderPolicy(explicitPolicy)!;
function durableSetup() {
  const f = setup(); f.patch({ profileKey: durableProfileKey }); return f;
}
function savedWriter() {
  const f = durableSetup(); f.start(); f.display(0); f.runtime.next(f.runtime.getSnapshot().revision); f.display(1);
  const preference = f.runtime.getProgressIntent().preference; f.runtime.dispose(); return preference;
}

describe("reviewed Booky journey runtime", () => {
  it("has no constructor IO and exposes only currently admitted routes under an explicit profile", () => {
    const f = setup(); expect(f.readHost).not.toHaveBeenCalled(); expect(f.navigate).not.toHaveBeenCalled();
    f.patch({ profileKey: null }); f.runtime.refresh();
    expect(f.runtime.getSnapshot()).toMatchObject({ status: "profile-required", routes: [], active: null });
    f.patch({ profileKey: "adult-policy:1", resolve: () => null }); f.runtime.refresh();
    expect(f.runtime.getSnapshot()).toMatchObject({ status: "unavailable", routes: [] });
    f.patch({ resolve: f.resolve }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().routes).toEqual([{ key: bookyJourneyRouteKey(f.initial.plan), title: f.initial.plan.title }]);
    const stable = f.runtime.getSnapshot(); f.runtime.refresh(); expect(f.runtime.getSnapshot()).toBe(stable);
    expect(Object.isFrozen(stable.routes)).toBe(true); f.runtime.dispose();
  });

  it("opens explicitly, checks settled exact views and acknowledges each prefix only through Next", () => {
    const f = setup(); expect(f.start()).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ index: 0, completedCount: 0, phase: "navigating", canNext: false });
    f.display(0, { settled: false }); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    f.display(0, { writerId: "automatically-selected-other-writer" });
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "ready", canNext: true, completedCount: 0 });
    for (let index = 0; index < 4; ++index) {
      if (index > 0) f.display(index);
      expect(f.runtime.getSnapshot().active?.completedCount).toBe(index);
      expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
    }
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "complete", completedCount: 4, index: 3, total: 4, canNext: false, canOpen: false });
    expect(f.navigate).toHaveBeenCalledTimes(4); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(Object.isFrozen(f.runtime.getSnapshot().active)).toBe(true); f.runtime.dispose();
  });

  it("rejects stale UI revisions and never treats a delayed view as an automatic acknowledgement", () => {
    const f = setup(); f.start(); const old = f.runtime.getSnapshot().revision;
    f.display(0); expect(f.runtime.next(old)).toBe(false);
    expect(f.runtime.getSnapshot().active?.completedCount).toBe(0);
    const ready = f.runtime.getSnapshot().revision; f.patch({ view: { ...f.host().view, settled: false } });
    expect(f.runtime.next(ready)).toBe(false);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", completedCount: 0 });
    f.display(0); expect(f.runtime.getSnapshot().active?.phase).toBe("paused");
    expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(true); f.runtime.dispose();
  });

  it("requires exact writer and work tuples and the checkpoint's own screen", () => {
    const f = setup(); f.start(); f.display(0); f.runtime.next(f.runtime.getSnapshot().revision);
    f.display(1, { countryId: "other-country" });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    f.runtime.resume(f.runtime.getSnapshot().revision); f.display(1); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
    f.display(2, { workId: "other-work" }); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    f.runtime.resume(f.runtime.getSnapshot().revision); f.display(2); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
    f.display(3, { screen: "collection" }); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    f.runtime.resume(f.runtime.getSnapshot().revision); f.display(3, { countryId: "irrelevant", writerId: "irrelevant", workId: "irrelevant" });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true); f.runtime.dispose();
  });

  it.each([false, "throw"])("rolls back Next without acknowledgement when navigation returns %s", failure => {
    const f = setup(); f.start(); f.display(0);
    f.navigate.mockImplementationOnce(() => { if (failure === "throw") throw Error("unavailable"); return false; });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getSnapshot().active).toMatchObject({ index: 0, completedCount: 0, phase: "failed", canOpen: true, canNext: false });
    expect(f.runtime.open(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active?.phase).toBe("navigating");
    f.display(0);
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active?.completedCount).toBe(1); f.runtime.dispose();
  });

  it("pauses on background/collapse, aborts the old request and requires deliberate resume", () => {
    const f = setup(); f.start(); const signal = f.navigate.mock.calls[0][1];
    f.patch({ active: false }); f.runtime.refresh();
    expect(signal.aborted).toBe(true); expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", node: null, title: null });
    f.patch({ active: true }); f.runtime.refresh(); f.display(0);
    expect(f.navigate).toHaveBeenCalledOnce(); expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", completedCount: 0 });
    expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(true); expect(f.navigate).toHaveBeenCalledTimes(2); f.runtime.dispose();
  });

  it.each(["resume", "open"] as const)("waits for a fresh view when %s targets the already settled writer", action => {
    const f = setup(); f.start(); f.display(0); f.runtime.next(f.runtime.getSnapshot().revision); f.display(1);
    if (action === "resume") {
      f.patch({ active: false }); f.runtime.refresh();
      f.patch({ active: true }); f.runtime.refresh();
      expect(f.runtime.getSnapshot().active?.phase).toBe("paused");
    }
    expect(f.runtime[action](f.runtime.getSnapshot().revision)).toBe(true);
    const signal = f.navigate.mock.calls[2][1];
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "navigating", canNext: false, index: 1, completedCount: 1 });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    f.patch({ plans: [...f.host().plans] }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().active?.phase).toBe("navigating");
    f.display(1, { settled: false });
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "navigating", canNext: false, completedCount: 1 });
    expect(signal.aborted).toBe(false);
    f.display(1);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "ready", canNext: true, completedCount: 1 });
    expect(signal.aborted).toBe(false); f.runtime.dispose();
  });

  it("accepts a new identical view receipt for an explicit no-op without inventing acknowledgement", () => {
    const f = setup(); f.display(0); expect(f.start()).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "navigating", canNext: false, completedCount: 0 });
    f.display(0);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "ready", canNext: true, completedCount: 0 });
    f.runtime.dispose();
  });

  it("hides revoked source/policy copy and retains progress only for the original explicit profile", () => {
    const f = setup(); f.start(); f.display(0); f.runtime.next(f.runtime.getSnapshot().revision);
    f.patch({ profileKey: "different-adult-policy" }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().active).toMatchObject({ title: null, node: null, phase: "unavailable", index: 1, completedCount: 1 });
    expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(false);
    f.patch({ profileKey: "adult-policy:1", plans: [] }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().active?.node).toBeNull();
    f.patch({ plans: [f.initial.plan] }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", index: 1, completedCount: 1 });
    expect(f.navigate).toHaveBeenCalledTimes(2); f.runtime.dispose();
  });

  it("rebinds an approved locale with identical semantic topology and cancels pending movement", () => {
    const f = setup(); f.start(); f.display(0); f.runtime.next(f.runtime.getSnapshot().revision);
    const signal = f.navigate.mock.calls[1][1]; f.switchSource(fixture("ru"));
    expect(signal.aborted).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ title: "ru: Synthetic journey", index: 1, completedCount: 1, phase: "paused" });
    expect(f.runtime.getSnapshot().active?.node?.dialogue.payload.locale).toBe("ru");
    expect(f.navigate).toHaveBeenCalledTimes(2); expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(true); f.runtime.dispose();
  });

  it("preserves a settled node on locale switch without navigating or adding acknowledgement", () => {
    const f = setup(); f.start(); f.display(0); f.switchSource(fixture("ru"));
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "ready", index: 0, completedCount: 0, canNext: true });
    expect(f.navigate).toHaveBeenCalledOnce(); f.runtime.dispose();
  });

  it.each([{ writerNodeId: "changed-writer-node" }, { workId: "different-work" }, { checkpointScreen: "collection" as const }])(
    "does not migrate incompatible locale topology %j", change => {
      const f = setup(); f.start(); f.display(0); f.switchSource(fixture("ru", change));
      expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", node: null, title: null, completedCount: 0 });
      expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(false); f.runtime.dispose();
    });

  it.each([{ version: 2 }, { title: "Changed reviewed definition" }])("never auto-migrates changed route bindings %j", change => {
    const f = setup(); f.start(); f.display(0); f.switchSource(fixture("en", change));
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", node: null, title: null });
    expect(f.navigate).toHaveBeenCalledOnce(); expect(f.runtime.reset(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active).toBeNull(); expect(f.start()).toBe(true); f.runtime.dispose();
  });

  it("lets a reentrant view pause before a pending navigation is dispatched", () => {
    const f = setup(); const remove = f.runtime.subscribe(() => {
      const state = f.runtime.getSnapshot(); if (state.active?.phase === "navigating") f.runtime.pause(state.revision);
    });
    expect(f.start()).toBe(false); expect(f.navigate).not.toHaveBeenCalled();
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", completedCount: 0 }); remove(); f.runtime.dispose();
  });

  it("fails closed for nested resolver callbacks without leaking stale copy or navigation", () => {
    const f = setup(); f.start(); f.display(0);
    f.patch({ resolve(plan, nodeId) { f.runtime.refresh(); return f.resolve(plan, nodeId); } }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", node: null, title: null, completedCount: 0 });
    expect(f.navigate).toHaveBeenCalledOnce(); f.runtime.dispose();
  });

  it("rechecks the source after observers and after the navigation port before acknowledging", () => {
    const f = setup(); f.start(); f.display(0);
    f.navigate.mockImplementationOnce(() => { f.patch({ profileKey: null }); return true; });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getSnapshot()).toMatchObject({ status: "profile-required", active: { index: 0, completedCount: 0, phase: "unavailable", node: null } });
    f.runtime.dispose();
    const second = setup(); second.runtime.subscribe(() => {
      if (second.runtime.getSnapshot().active?.phase === "navigating") second.patch({ resolve: () => null });
    });
    expect(second.start()).toBe(false); expect(second.navigate).not.toHaveBeenCalled();
    expect(second.runtime.getSnapshot().active?.node).toBeNull(); second.runtime.dispose();
  });

  it("accepts synchronous displayed-view updates without mistaking them for source revocation", () => {
    const f = setup(); f.navigate.mockImplementation(offer => {
      const index = f.host().plans[0].nodes.findIndex(node => node.id === offer.nodeId); f.display(index); return true;
    });
    expect(f.start()).toBe(true); expect(f.runtime.getSnapshot().active?.phase).toBe("ready");
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ index: 1, completedCount: 1, phase: "ready" }); f.runtime.dispose();
  });

  it("denies throwing readers and resolver failures, and disposes without later work", () => {
    const f = setup(); f.start(); f.readHost.mockImplementationOnce(() => { throw Error("read failed"); }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", node: null });
    f.patch({ resolve: () => { throw Error("revoked"); } }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().routes).toEqual([]);
    const signal = f.navigate.mock.calls[0][1]; f.runtime.dispose(); const reads = f.readHost.mock.calls.length;
    const revision = f.runtime.getSnapshot().revision; f.runtime.refresh();
    expect(f.runtime.start(bookyJourneyRouteKey(f.initial.plan), revision)).toBe(false);
    expect(f.readHost).toHaveBeenCalledTimes(reads); expect(signal.aborted).toBe(true);
    expect(f.runtime.getSnapshot()).toMatchObject({ active: null, routes: [], status: "unavailable" });
  });
});

describe("durable Booky journey semantic intent", () => {
  it("publishes accepted semantic intent before listeners and never writes camera, pause or failed movement", () => {
    const f = durableSetup(); const seen: number[] = [];
    f.runtime.subscribe(() => seen.push(f.runtime.getProgressIntent().revision));
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference: DEFAULT_BOOKY_JOURNEY_PROGRESS });
    expect(f.start()).toBe(true);
    const started = f.runtime.getProgressIntent();
    expect(started).toMatchObject({ revision: 1, preference: { activeRecordId: expect.any(String), records: [
      { acknowledgedNodeIds: [], resumeNodeId: "country" },
    ] } });
    expect(seen[seen.length - 1]).toBe(1);
    f.display(0); f.runtime.pause(f.runtime.getSnapshot().revision); f.runtime.resume(f.runtime.getSnapshot().revision); f.display(0);
    expect(f.runtime.getProgressIntent()).toBe(started);
    f.navigate.mockReturnValueOnce(false);
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(started);
    f.runtime.open(f.runtime.getSnapshot().revision); f.display(0);
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getProgressIntent()).toMatchObject({ revision: 2, preference: { records: [
      { acknowledgedNodeIds: ["country"], resumeNodeId: "writer" },
    ] } });
    expect(Object.isFrozen(f.runtime.getProgressIntent())).toBe(true);
    expect(Object.isFrozen(f.runtime.getProgressIntent().preference.records[0].nodes)).toBe(true); f.runtime.dispose();
  });

  it("restores while inactive and requires explicit resume plus a fresh displayed receipt", () => {
    const preference = savedWriter(), f = durableSetup(); f.patch({ active: false });
    expect(f.runtime.restoreProgress(preference, 0)).toBe(true);
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference });
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", index: 1, completedCount: 1, node: null });
    expect(f.navigate).not.toHaveBeenCalled();
    f.patch({ active: true }); f.runtime.refresh(); f.display(1);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", index: 1, completedCount: 1 });
    expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active?.phase).toBe("navigating");
    expect(f.runtime.getProgressIntent().revision).toBe(0);
    f.display(1); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getProgressIntent()).toMatchObject({ revision: 1, preference: { records: [
      { acknowledgedNodeIds: ["country", "writer"], resumeNodeId: "work" },
    ] } }); f.runtime.dispose();
  });

  it("fences late restoration after Start/Next/Reset and lets a current confirmed clear abort navigation", () => {
    const preference = savedWriter(), f = durableSetup(); f.start();
    expect(f.runtime.restoreProgress(preference, 0)).toBe(false);
    const beforeNext = f.runtime.getProgressIntent().revision; f.display(0); f.runtime.next(f.runtime.getSnapshot().revision);
    expect(f.runtime.restoreProgress(preference, beforeNext)).toBe(false);
    const beforeReset = f.runtime.getProgressIntent().revision; f.runtime.reset(f.runtime.getSnapshot().revision);
    expect(f.runtime.restoreProgress(preference, beforeReset)).toBe(false);
    expect(f.runtime.getProgressIntent().preference.records).toEqual([]);
    f.start(); const signal = f.navigate.mock.calls[f.navigate.mock.calls.length - 1][1], current = f.runtime.getProgressIntent().revision;
    expect(f.runtime.restoreProgress(DEFAULT_BOOKY_JOURNEY_PROGRESS, current)).toBe(true);
    expect(signal.aborted).toBe(true); expect(f.runtime.getSnapshot().active).toBeNull();
    expect(f.runtime.getProgressIntent()).toEqual({ revision: current, preference: DEFAULT_BOOKY_JOURNEY_PROGRESS });
    f.runtime.dispose();
  });

  it("retains distinct route histories and Start resumes the saved cursor without wiping its prefix", () => {
    const f = durableSetup(); f.start(); f.display(0); f.runtime.next(f.runtime.getSnapshot().revision); f.display(1);
    const original = f.runtime.getProgressIntent().preference.records[0];
    f.switchSource(fixture("en", { id: "second-journey" })); expect(f.start()).toBe(true);
    expect(f.runtime.getProgressIntent().preference.records).toHaveLength(2);
    f.switchSource(f.initial); expect(f.start()).toBe(true);
    expect(f.navigate.mock.calls[f.navigate.mock.calls.length - 1][0].nodeId).toBe("writer");
    expect(f.runtime.getSnapshot().active).toMatchObject({ index: 1, completedCount: 1 });
    expect(f.runtime.getProgressIntent().preference.records.find(record => record.recordId === original.recordId)).toEqual(original);
    f.patch({ profileKey: null }); f.runtime.refresh();
    expect(f.runtime.reset(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getProgressIntent().preference).toMatchObject({ activeRecordId: null, records: [{ journeyId: "second-journey" }] });
    f.runtime.dispose();
  });

  it("preserves incompatible current-version edits until the exact old active record is reset", () => {
    const preference = savedWriter(), f = durableSetup(); f.switchSource(fixture("en", { title: "New independently reviewed copy" }));
    expect(f.runtime.restoreProgress(preference, 0)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", node: null, title: null, completedCount: 1 });
    expect(f.start()).toBe(false); expect(f.navigate).not.toHaveBeenCalled();
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference });
    expect(f.runtime.reset(f.runtime.getSnapshot().revision)).toBe(true); expect(f.start()).toBe(true);
    expect(f.runtime.getProgressIntent().preference.records[0].definitionChecksum).not.toBe(preference.records[0].definitionChecksum);
    f.runtime.dispose();
  });

  it("preserves old versions without automatically migrating or discarding their acknowledgements", () => {
    const preference = savedWriter(), f = durableSetup(); f.switchSource(fixture("en", { version: 2 }));
    expect(f.runtime.restoreProgress(preference, 0)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", completedCount: 1, node: null });
    expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(false); expect(f.navigate).not.toHaveBeenCalled();
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference });
    expect(f.start()).toBe(true);
    expect(f.runtime.getProgressIntent().preference.records.map(record => [record.journeyVersion, record.acknowledgedNodeIds]))
      .toEqual([[1, ["country"]], [2, []]]); f.runtime.dispose();
  });

  it("binds saved data to the current explicit profile and fresh admission, never the fingerprint alone", () => {
    const preference = savedWriter(), f = durableSetup();
    f.patch({ profileKey: serializeBookyReaderPolicy({ ...explicitPolicy, revision: 2 }) });
    f.runtime.restoreProgress(preference, 0);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", node: null, title: null });
    expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(false);
    f.patch({ profileKey: durableProfileKey, resolve: () => null }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().active?.phase).toBe("unavailable");
    f.patch({ resolve: f.resolve }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", completedCount: 1 });
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference }); expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });

  it("rebinds only admitted identical locale topology and saves that binding after an explicit gesture", () => {
    const preference = savedWriter(), f = durableSetup(); f.switchSource(fixture("ru"));
    f.runtime.restoreProgress(preference, 0);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", title: "ru: Synthetic journey", index: 1, completedCount: 1 });
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference });
    expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getProgressIntent()).toMatchObject({ revision: 1, preference: { records: [
      { locale: "ru", acknowledgedNodeIds: ["country"], resumeNodeId: "writer" },
    ] } }); f.runtime.dispose();
    const incompatible = durableSetup(); incompatible.switchSource(fixture("ru", { workId: "changed-work" }));
    incompatible.runtime.restoreProgress(preference, 0);
    expect(incompatible.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", title: null, node: null });
    expect(incompatible.start()).toBe(false); expect(incompatible.runtime.getProgressIntent()).toEqual({ revision: 0, preference });
    expect(incompatible.navigate).not.toHaveBeenCalled(); incompatible.runtime.dispose();
  });

  it("refuses history overflow without navigation or silent eviction, then frees only the reset record", () => {
    const f = durableSetup();
    const records = Array.from({ length: 32 }, (_, index) => createBookyJourneyProgressRecord(explicitPolicy,
      { ...f.initial.plan, id: `historical-${index}` }, [], "country")!);
    const preference: BookyJourneyProgressPreference = { ...DEFAULT_BOOKY_JOURNEY_PROGRESS, revision: 7,
      activeRecordId: records[0].recordId, records };
    expect(f.runtime.restoreProgress(preference, 0)).toBe(true); expect(f.start()).toBe(false);
    expect(f.navigate).not.toHaveBeenCalled(); expect(f.runtime.getProgressIntent().preference.records).toEqual(records);
    expect(f.runtime.reset(f.runtime.getSnapshot().revision)).toBe(true); expect(f.start()).toBe(true);
    const retained = f.runtime.getProgressIntent().preference.records;
    expect(retained).toHaveLength(32); expect(retained.slice(0, 31)).toEqual(records.slice(1));
    expect(retained[31].journeyId).toBe("test-journey"); f.runtime.dispose();
  });

  it("restores completed semantic data without navigation or a new completion acknowledgement", () => {
    const f = durableSetup(); f.start();
    for (let index = 0; index < 4; index++) { f.display(index); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true); }
    const preference = f.runtime.getProgressIntent().preference;
    expect(preference.records[0]).toMatchObject({ acknowledgedNodeIds: ["country", "writer", "work", "checkpoint"], resumeNodeId: null });
    f.runtime.dispose(); const restored = durableSetup(); restored.runtime.restoreProgress(preference, 0);
    expect(restored.runtime.getSnapshot().active).toMatchObject({ phase: "complete", index: 3, completedCount: 4, canNext: false });
    expect(restored.runtime.getProgressIntent()).toEqual({ revision: 0, preference }); expect(restored.navigate).not.toHaveBeenCalled();
    expect(restored.start()).toBe(true); expect(restored.navigate).not.toHaveBeenCalled();
    expect(restored.runtime.getProgressIntent()).toEqual({ revision: 1, preference });
    expect(restored.runtime.getSnapshot().active).toMatchObject({ phase: "complete", canNext: false, canOpen: false });
    restored.patch({ resolve: () => null }); restored.runtime.refresh();
    expect(restored.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", node: null });
    restored.patch({ resolve: restored.resolve }); restored.runtime.refresh();
    expect(restored.runtime.getSnapshot().active?.phase).toBe("complete");
    expect(restored.runtime.getProgressIntent().revision).toBe(1); restored.runtime.dispose();
  });

  it("never accepts unsupported/invalid restore or advances progress after a port revokes authority", () => {
    const f = durableSetup(); f.start(); f.display(0); const accepted = f.runtime.getProgressIntent();
    expect(f.runtime.restoreProgress({ ...accepted.preference, schemaVersion: 2 } as unknown as BookyJourneyProgressPreference, accepted.revision)).toBe(false);
    expect(f.runtime.restoreProgress({ ...accepted.preference, activeRecordId: "missing" }, accepted.revision)).toBe(false);
    f.navigate.mockImplementationOnce(() => { f.patch({ profileKey: null }); return true; });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(accepted); f.runtime.dispose();
  });
});
