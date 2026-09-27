import { describe, expect, it, vi } from "vitest";
import type { Country, BookArchiveEntry } from "../planet/types";
import { contentTextHash } from "../planet/contentExportHash";
import { createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialoguePayload, type BookyDialogueRecord } from "./bookyDialogueRegistry";
import { bookyJourneyDialogueContext, bookyJourneyEntityId, compileBookyJourney, getBookyJourneyChecksum,
  type BookyJourneyContext, type BookyJourneyDefinition, type BookyJourneyTrust } from "./bookyJourney";
import { getBookyJourneyFactChecksum, type BookyJourneyFactSpec } from "./bookyJourneyFact";
import { resolveBookyJourneyNode, type BookyJourneyHostOffer, type BookyJourneyHostSnapshot } from "./bookyJourneyHost";
import { bookyJourneyRouteKey, createBookyJourneyRuntime, type BookyJourneyRuntimeHost } from "./bookyJourneyRuntime";
import { createBookyReaderPolicy, serializeBookyReaderPolicy } from "./bookyReaderPolicy";
import { DEFAULT_BOOKY_JOURNEY_PROGRESS, createBookyJourneyProgressRecord,
  type BookyJourneyProgressPreference } from "./bookyJourneyProgress";
import { getBookyJourneyMigrationChecksum, resolveBookyJourneyMigration, type BookyJourneyMigration } from "./bookyJourneyMigration";
import { createBookDossierCharacterViewToken, type BookDossierCharacterViewReceipt } from "../books/bookDossierCharacterView";

const now = "2026-09-23T12:00:00.000Z", reviewedAt = "2026-09-22T12:00:00.000Z";
function fixture(locale: "ru" | "en" = "en", options: { id?: string; version?: number; workId?: string; writerNodeId?: string; title?: string;
  checkpointScreen?: "globe" | "collection"; activity?: boolean; activityAuthor?: "test-writer" | "other-writer";
  overview?: BookyJourneyDefinition["overview"]; offlineAvailable?: boolean; character?: boolean; consecutiveCharacter?: boolean } = {}) {
  // Synthetic reviewers, content, public catalog and receipts ONLY for tests.
  // No production draft receives approval, narration or child eligibility.
  const journeyId = options.id ?? "test-journey";
  const country: Country = { id: "test-country", name: "Synthetic country", coordinates: [20, 30], writers: [{ id: "test-writer" }] };
  const book: BookArchiveEntry = { id: options.workId ?? "test-work", title: "Synthetic work", countryId: country.id, countryName: country.name,
    writerId: "test-writer", writerName: "Synthetic writer", country, writer: country.writers[0], editorial: { status: "verified" } };
  if (options.activity) {
    country.writers[0].name = "Synthetic First Writer";
    country.writers.push({ id: "other-writer", name: "Synthetic Second Writer" });
  }
  if (options.activityAuthor) book.authorship = { kind: "single", authors: [{ countryId: country.id, writerId: options.activityAuthor }] };
  const nodes: BookyJourneyDefinition["nodes"] = [
    { id: "country", kind: "country", entity: { kind: "country", countryId: country.id }, screen: "globe", dialogue: { id: "test-country", version: 1, contentChecksum: "" } },
    options.activity ? { id: "activity", kind: "activity", entity: null, screen: "globe", dialogue: { id: "test-activity", version: 1, contentChecksum: "" },
      activity: { schemaVersion: 1, id: "test-match-author", version: 1, type: "match-work-author",
        targetWork: { kind: "work", countryId: country.id, writerId: "test-writer", workId: book.id }, choices: [
          { id: "first", writer: { kind: "writer", countryId: country.id, writerId: "test-writer" } },
          { id: "second", writer: { kind: "writer", countryId: country.id, writerId: "other-writer" } },
        ] } }
      : { id: options.writerNodeId ?? "writer", kind: "writer", entity: { kind: "writer", countryId: country.id, writerId: "test-writer" }, screen: "globe", dialogue: { id: "test-writer", version: 1, contentChecksum: "" } },
    options.activity ? { id: "after-activity", kind: "checkpoint", entity: null, screen: "globe",
      dialogue: { id: "test-after-activity", version: 1, contentChecksum: "" } }
      : { id: "work", kind: "work", entity: { kind: "work", countryId: country.id, writerId: "test-writer", workId: book.id }, screen: "collection", dialogue: { id: "test-work", version: 1, contentChecksum: "" } },
    { id: "checkpoint", kind: "checkpoint", entity: null, screen: options.checkpointScreen ?? "globe", dialogue: { id: "test-checkpoint", version: 1, contentChecksum: "" } },
  ];
  if (options.character) {
    const work = { kind: "work" as const, countryId: country.id, writerId: "test-writer", workId: book.id };
    (nodes as BookyJourneyDefinition["nodes"][number][]).splice(3, 0, {
      id: "character", kind: "character", entity: work, screen: "collection",
      dialogue: { id: "test-character", version: 1, contentChecksum: "a".repeat(64) },
      character: { schemaVersion: 1, id: "test-character-spec", version: 1, work,
        bindings: ["ru", "en"].map(language => ({ locale: language, dossierVersion: "test-v1", sectionId: "test-page",
          blockId: "test-block", itemId: "test-item", readingMode: "BEFORE_READING", projectionChecksum: "a".repeat(64),
          dialogue: { id: "test-character", version: 1, contentChecksum: "a".repeat(64) } })) as unknown as NonNullable<BookyJourneyDefinition["nodes"][number]["character"]>["bindings"] },
    });
    if (options.consecutiveCharacter) {
      const first = nodes[3];
      (nodes as BookyJourneyDefinition["nodes"][number][]).splice(4, 0, { ...first, id: "next-character",
        dialogue: { ...first.dialogue, id: "test-next-character" }, character: { ...first.character!, id: "test-next-character-spec",
          bindings: first.character!.bindings.map(binding => ({ ...binding, dialogue: { ...binding.dialogue, id: "test-next-character" } })) as unknown as NonNullable<typeof first.character>["bindings"] } });
    }
  }
  const records: BookyDialogueRecord[] = nodes.map(node => {
    const copy = { title: `${locale}: ${node.id}`, body: `${locale}: synthetic test instruction.`, caption: "Synthetic test caption", reduced: "Test" };
    const payload: BookyDialoguePayload = { id: node.dialogue.id, locale, version: 1, audience: "adult", ageRange: { min: 18, max: 120 },
      readingLevel: "plain", intent: node.kind === "activity" ? "activity" : "navigation", screens: [node.screen], context: bookyJourneyDialogueContext(journeyId, node)!,
      entityIds: node.activity ? [node.activity.targetWork, ...node.activity.choices.map(choice => choice.writer)].map(bookyJourneyEntityId)
        : node.entity ? [bookyJourneyEntityId(node.entity)] : [], claimKind: "interface-guidance", factualSources: [], copy,
      narration: null, prohibitedTags: [], provenance: { kind: "editorial", sourcePath: "test/runtime.ts", sourceVersion: 1,
        sourceRef: node.id, sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
    const review = { status: "approved" as const, reviewer: "synthetic-reviewer-not-real", reviewedAt, contentChecksum: getBookyDialogueContentChecksum(payload)! };
    return { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
  });
  const definition: BookyJourneyDefinition = { schemaVersion: 1, id: journeyId, version: options.version ?? 1, locale, audience: "adult",
    ageRange: { min: 18, max: 120 }, readingLevel: "plain", title: options.title ?? `${locale}: Synthetic journey`, prerequisites: [],
    ...(options.overview ? { overview: options.overview } : {}),
    nodes: nodes.map((node, index) => ({ ...node, dialogue: { ...node.dialogue, contentChecksum: records[index].review.contentChecksum },
      ...(node.character ? { character: { ...node.character, bindings: node.character.bindings.map(binding => binding.locale === locale
        ? { ...binding, dialogue: { ...binding.dialogue, contentChecksum: records[index].review.contentChecksum } } : binding) as unknown as typeof node.character.bindings } } : {}) })) };
  const context: BookyJourneyContext = { audience: "adult", age: 30, locale, readingLevel: "plain", now, connectivity: "online", completedPrerequisites: [],
    availability: definition.nodes.map(node => ({ nodeId: node.id, locale, dialogueContentChecksum: node.dialogue.contentChecksum, available: true,
      offlineAvailable: options.offlineAvailable ?? true })) };
  const trust: BookyJourneyTrust = { currentVersions: [{ id: definition.id, version: definition.version }], approvedReviews: [
    { id: definition.id, version: definition.version, locale, definitionChecksum: getBookyJourneyChecksum(definition)!, reviewer: "synthetic-journey-reviewer-not-real", reviewedAt },
  ], characterPublicationAvailable: options.character === true, dialogueRegistry: createBookyDialogueRegistry(records, { canonicalEntityIds: [...new Set(records.flatMap(record => [...record.payload.entityIds]))],
    approvedReviews: records.map(record => ({ id: record.payload.id, locale, version: 1,
      contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt })) }), publicCountries: [country], publicBooks: [book] };
  const plan = compileBookyJourney(definition, context, trust);
  if (!plan) throw new Error("invalid-synthetic-runtime-fixture");
  return { definition, context, trust, plan };
}
function setup(initial = fixture()) {
  const sources = new Map([[bookyJourneyRouteKey(initial.plan), initial]]);
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
function migrationSetup({ complete = false, active = true } = {}) {
  const f = durableSetup(), target = fixture("en", { version: 2, writerNodeId: "writer-v2" });
  const old = createBookyJourneyProgressRecord(explicitPolicy, f.initial.plan,
    complete ? f.initial.plan.nodes.map(node => node.id) : ["country"], complete ? null : "writer")!;
  const preference = { ...DEFAULT_BOOKY_JOURNEY_PROGRESS, activeRecordId: old.recordId, records: [old] };
  const migration: BookyJourneyMigration = { schemaVersion: 1, id: "test-version-migration", journeyId: old.journeyId,
    locale: "en", fromVersion: 1, fromDefinitionChecksum: old.definitionChecksum, toVersion: 2,
    toDefinitionChecksum: target.plan.definitionChecksum, nodeMap: { country: "country", writer: "writer-v2", work: "work", checkpoint: "checkpoint" },
    safeCheckpointId: null };
  const migrationChecksum = getBookyJourneyMigrationChecksum(migration)!;
  const validResolver: NonNullable<BookyJourneyRuntimeHost["resolveMigration"]> = (savedRecord, currentPlan) => {
    const result = resolveBookyJourneyMigration({ savedRecord, currentPlan, historicalDefinition: f.initial.definition,
      currentPolicy: explicitPolicy, migration, now, approvedMigrationReceipts: [{ id: migration.id, checksum: migrationChecksum,
        reviewer: "synthetic-migration-reviewer-not-real", reviewedAt }] });
    return result ? { migrationId: migration.id, migrationChecksum, ...result } : null;
  };
  const resolveMigration = vi.fn(validResolver);
  f.switchSource(target); f.patch({ active, resolveMigration }); f.runtime.restoreProgress(preference, 0);
  return { ...f, target, old, preference, validResolver, resolveMigration };
}

function characterRuntime(consecutiveCharacter = false) {
  const f = setup(fixture("en", { character: true, consecutiveCharacter }));
  let shown: BookDossierCharacterViewReceipt | null = null;
  const canOpenCharacter = vi.fn(() => true);
  const canAcknowledgeCharacter = vi.fn((_plan, _nodeId, receipt) => receipt === shown);
  f.patch({ profileKey: durableProfileKey, canOpenCharacter, canAcknowledgeCharacter });
  const receipt: BookDossierCharacterViewReceipt = { token: createBookDossierCharacterViewToken(), bookKey: "test-country:test-writer:test-work", cacheKey: "synthetic",
    anchor: { sectionId: "test-page", blockId: "test-block", itemId: "test-item", dossierVersion: "test-v1", locale: "en", readingMode: "BEFORE_READING" } };
  const reachWork = () => { f.start(); f.display(0); f.runtime.next(f.runtime.getSnapshot().revision); f.display(1);
    f.runtime.next(f.runtime.getSnapshot().revision); f.display(2); };
  return { ...f, receipt, canOpenCharacter, canAcknowledgeCharacter, reachWork, show: (value = receipt) => { shown = value; } };
}
describe("current-only character runtime acknowledgement", () => {
  it("admits preceding navigation without consulting the future live dossier", () => {
    const f = characterRuntime(); f.canOpenCharacter.mockReturnValue(false); f.reachWork();
    expect(f.runtime.getSnapshot().active).toMatchObject({ index: 2, completedCount: 2, phase: "ready" });
    expect(f.canOpenCharacter).not.toHaveBeenCalled(); const progress = f.runtime.getProgressIntent();
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(progress); expect(f.runtime.getSnapshot().active?.node?.kind).toBe("work");
  });
  it("uses the settled existing work for character readiness but never generic Next or opening credit", () => {
    const f = characterRuntime(); f.reachWork(); const view = f.host().view;
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true); expect(f.host().view).toBe(view);
    expect(f.runtime.getSnapshot().active).toMatchObject({ index: 3, completedCount: 3, phase: "ready", canOpen: true, canNext: false });
    const progress = f.runtime.getProgressIntent();
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.open(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getProgressIntent()).toBe(progress);
    f.show(); expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active?.completedCount).toBe(4);
    expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(false);
  });
  it("exposes the target synchronously before character navigation is invoked", () => {
    const f = characterRuntime(); f.reachWork();
    f.navigate.mockImplementationOnce(offer => {
      expect(offer.node.kind).toBe("character");
      expect(f.runtime.getSnapshot().active).toMatchObject({ node: { id: "character" }, phase: "navigating", completedCount: 2 }); return true;
    });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
  });
  it("rejects a stale UI revision and a replaced host inside acknowledgement validation", () => {
    const f = characterRuntime(); f.reachWork(); f.runtime.next(f.runtime.getSnapshot().revision); f.show();
    const old = f.runtime.getSnapshot().revision; f.patch({}); f.runtime.refresh(); const progress = f.runtime.getProgressIntent();
    expect(f.runtime.acknowledgeCharacter(f.receipt, old)).toBe(false);
    f.canAcknowledgeCharacter.mockImplementationOnce(() => { f.patch({ active: false }); return true; });
    expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(progress);
  });
  it("rejects revoked or altered current static character offers without changing saved prefix", () => {
    const f = characterRuntime(); f.reachWork(); f.runtime.next(f.runtime.getSnapshot().revision); f.show();
    const progress = f.runtime.getProgressIntent();
    f.patch({ resolve: (plan, id) => {
      const offer = f.resolve(plan, id); return offer?.node.kind === "character" ? { ...offer, node: { ...offer.node,
        character: { ...offer.node.character!, semanticChecksum: "f".repeat(64) } } } : offer;
    } }); f.runtime.refresh();
    expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(progress);
  });
  it("requires an exact receipt for character credit and a separate explicit final checkpoint", () => {
    const f = characterRuntime(); f.reachWork(); f.runtime.next(f.runtime.getSnapshot().revision); f.show();
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "navigating", completedCount: 4, canNext: false });
    const progress = f.runtime.getProgressIntent();
    expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(progress);
    f.display(4); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "complete", completedCount: 5 });
  });
  it("rechecks character acknowledgement after abort listeners revoke the receipt", () => {
    const f = characterRuntime(); f.reachWork(); f.runtime.next(f.runtime.getSnapshot().revision); f.show();
    const progress = f.runtime.getProgressIntent(), signal = f.navigate.mock.calls[f.navigate.mock.calls.length - 1]![1];
    signal.addEventListener("abort", () => { f.canAcknowledgeCharacter.mockReturnValue(false); });
    expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(progress);
  });
  it("finishes when the host defers only its acknowledgement-owned navigation abort cleanup", () => {
    const f = characterRuntime(); f.reachWork(); f.runtime.next(f.runtime.getSnapshot().revision); f.show();
    let acknowledging = true, deferred = false;
    f.navigate.mock.calls[f.navigate.mock.calls.length - 1]![1].addEventListener("abort", () => {
      if (acknowledging) deferred = true; else f.canAcknowledgeCharacter.mockReturnValue(false);
    });
    expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(true);
    acknowledging = false; if (deferred) f.canAcknowledgeCharacter.mockReturnValue(false);
    expect(deferred).toBe(true); expect(f.runtime.getSnapshot().active?.completedCount).toBe(4);
    expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(false);
  });
  it("advances consecutive admitted character nodes through distinct modal acknowledgements", () => {
    const f = characterRuntime(true); f.reachWork(); f.runtime.next(f.runtime.getSnapshot().revision); f.show();
    f.navigate.mockImplementationOnce(offer => {
      expect(offer.node.id).toBe("next-character");
      expect(f.runtime.getSnapshot().active?.node?.id).toBe("next-character"); return true;
    });
    expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ node: { id: "next-character" }, phase: "ready", completedCount: 4, canNext: false });
    expect(f.runtime.acknowledgeCharacter(f.receipt, f.runtime.getSnapshot().revision)).toBe(false);
    const second = { ...f.receipt, token: createBookDossierCharacterViewToken() }; f.show(second);
    expect(f.runtime.acknowledgeCharacter(second, f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ node: { id: "checkpoint" }, completedCount: 5 });
  });
});

describe("reviewed Booky journey runtime", () => {
  it("has no constructor IO and exposes only currently admitted routes under an explicit profile", () => {
    const f = setup(); expect(f.readHost).not.toHaveBeenCalled(); expect(f.navigate).not.toHaveBeenCalled();
    f.patch({ profileKey: null }); f.runtime.refresh();
    expect(f.runtime.getSnapshot()).toMatchObject({ status: "profile-required", routes: [], active: null });
    f.patch({ profileKey: "adult-policy:1", resolve: () => null }); f.runtime.refresh();
    expect(f.runtime.getSnapshot()).toMatchObject({ status: "unavailable", routes: [] });
    f.patch({ resolve: f.resolve }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().routes).toEqual([{ key: bookyJourneyRouteKey(f.initial.plan), title: f.initial.plan.title, canStart: true }]);
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

describe("explicit reviewed Booky journey migration", () => {
  it("discovers the offer on inactive-to-active cold restore without migrating or exposing old copy", () => {
    const f = migrationSetup({ active: false });
    expect(f.runtime.getSnapshot().migrations).toEqual([]);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", node: null });
    f.patch({ active: true }); f.runtime.refresh();
    expect(f.runtime.getSnapshot()).toMatchObject({ migrations: [{ key: expect.any(String), title: f.target.plan.title,
      fromVersion: 1, toVersion: 2 }], active: { phase: "unavailable", title: null, node: null, completedCount: 1 } });
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference: f.preference });
    f.runtime.refresh(); expect(f.navigate).not.toHaveBeenCalled();
    expect(Object.isFrozen(f.runtime.getSnapshot().migrations)).toBe(true); f.runtime.dispose();
  });

  it("migrates explicitly to the mapped cursor and preserves the full historical record", () => {
    const f = migrationSetup(), state = f.runtime.getSnapshot(), calls = f.resolveMigration.mock.calls.length;
    expect(f.runtime.migrate(state.migrations[0].key, state.revision)).toBe(true);
    expect(f.resolveMigration.mock.calls.length).toBeGreaterThanOrEqual(calls + 3);
    expect(f.navigate).toHaveBeenCalledOnce(); expect(f.navigate.mock.calls[0][0].nodeId).toBe("writer-v2");
    expect(f.runtime.getProgressIntent()).toMatchObject({ revision: 1, preference: { records: [f.old,
      { journeyVersion: 2, acknowledgedNodeIds: ["country"], resumeNodeId: "writer-v2" }] } });
    const next = f.runtime.getProgressIntent().preference;
    expect(next.activeRecordId).toBe(next.records[1].recordId); expect(f.runtime.getSnapshot().migrations).toEqual([]);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "navigating", index: 1, completedCount: 1, canNext: false });
    f.display(1); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getProgressIntent().preference.records[0]).toEqual(f.old);
    expect(f.runtime.getProgressIntent().preference.records[1].acknowledgedNodeIds).toEqual(["country", "writer-v2"]);
    expect(f.runtime.migrate(state.migrations[0].key, f.runtime.getSnapshot().revision)).toBe(false); f.runtime.dispose();
  });

  it.each([false, "throw"])("restores the old active session and intent when migration navigation returns %s", failure => {
    const f = migrationSetup(), state = f.runtime.getSnapshot(), intent = f.runtime.getProgressIntent();
    f.navigate.mockImplementationOnce(() => { if (failure === "throw") throw Error("cancelled"); return false; });
    expect(f.runtime.migrate(state.migrations[0].key, state.revision)).toBe(false);
    expect(f.navigate.mock.calls[0][1].aborted).toBe(true); expect(f.runtime.getProgressIntent()).toBe(intent);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", index: 1, completedCount: 1, node: null });
    expect(f.runtime.getSnapshot().migrations).toHaveLength(1); f.runtime.dispose();
  });

  it("rejects stale gestures and withdrawn migration review before dispatch", () => {
    const f = migrationSetup(), state = f.runtime.getSnapshot();
    f.patch({ view: { ...f.host().view } }); f.runtime.refresh();
    expect(f.runtime.migrate(state.migrations[0].key, state.revision)).toBe(false);
    const current = f.runtime.getSnapshot(); f.resolveMigration.mockReturnValue(null);
    expect(f.runtime.migrate(current.migrations[0].key, current.revision)).toBe(false);
    expect(f.runtime.getSnapshot().migrations).toEqual([]); expect(f.navigate).not.toHaveBeenCalled();
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference: f.preference }); f.runtime.dispose();
  });

  it("rechecks review after view observers and after the navigation port, aborting revoked migration", () => {
    const before = migrationSetup(), initial = before.runtime.getSnapshot();
    const remove = before.runtime.subscribe(() => {
      if (before.runtime.getSnapshot().active?.phase === "navigating") before.resolveMigration.mockReturnValue(null);
    });
    expect(before.runtime.migrate(initial.migrations[0].key, initial.revision)).toBe(false);
    expect(before.navigate).not.toHaveBeenCalled(); expect(before.runtime.getProgressIntent().preference).toEqual(before.preference);
    remove(); before.runtime.dispose();
    const after = migrationSetup(), state = after.runtime.getSnapshot();
    after.navigate.mockImplementationOnce(() => { after.resolveMigration.mockReturnValue(null); return true; });
    expect(after.runtime.migrate(state.migrations[0].key, state.revision)).toBe(false);
    expect(after.navigate.mock.calls[0][1].aborted).toBe(true);
    expect(after.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", completedCount: 1, node: null });
    expect(after.runtime.getProgressIntent()).toEqual({ revision: 0, preference: after.preference }); after.runtime.dispose();
  });

  it("rejects forged progress, altered historical records, wrong target topology and resolver accessors", () => {
    const f = migrationSetup(), valid = f.validResolver(f.old, f.target.plan)!;
    const forgedAcknowledgements = createBookyJourneyProgressRecord(explicitPolicy, f.target.plan, ["country", "writer-v2"], "work")!;
    const alteredHistory = createBookyJourneyProgressRecord(explicitPolicy, f.initial.plan, [], "country")!;
    const changedTopology = { ...valid.targetRecord, nodes: valid.targetRecord.nodes.map(node => node.kind === "writer"
      ? { ...node, entity: { kind: "writer" as const, countryId: "test-country", writerId: "different-writer" } } : node) };
    for (const change of [{ targetRecord: forgedAcknowledgements }, { preservedRecord: alteredHistory }, { targetRecord: changedTopology },
      { targetRecord: { ...valid.targetRecord, definitionChecksum: "b".repeat(64) } }, { migrationChecksum: "invalid" }]) {
      f.resolveMigration.mockReturnValue({ ...valid, ...change }); f.runtime.refresh();
      expect(f.runtime.getSnapshot().migrations).toEqual([]);
    }
    const getter = vi.fn(() => valid.migrationId), accessor = { ...valid };
    Object.defineProperty(accessor, "migrationId", { enumerable: true, get: getter });
    f.resolveMigration.mockReturnValue(accessor); f.runtime.refresh();
    expect(getter).not.toHaveBeenCalled(); expect(f.runtime.getSnapshot().migrations).toEqual([]);
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference: f.preference }); expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });

  it("offers no overwrite of existing target history and no eviction when history is full", () => {
    const f = migrationSetup(), key = f.runtime.getSnapshot().migrations[0].key;
    const existing = createBookyJourneyProgressRecord(explicitPolicy, f.target.plan, [], "country")!;
    const withTarget = { ...f.preference, records: [f.old, existing] };
    expect(f.runtime.restoreProgress(withTarget, 0)).toBe(true); expect(f.runtime.getSnapshot().migrations).toEqual([]);
    expect(f.runtime.migrate(key, f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent().preference.records).toEqual([f.old, existing]);
    const records = [f.old, ...Array.from({ length: 31 }, (_, index) => createBookyJourneyProgressRecord(explicitPolicy,
      { ...f.initial.plan, id: `historical-${index}` }, [], "country")!)];
    expect(f.runtime.restoreProgress({ ...f.preference, records }, 0)).toBe(true);
    expect(f.runtime.getSnapshot().migrations).toEqual([]); expect(f.runtime.getProgressIntent().preference.records).toEqual(records);
    expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });

  it("activates a fully completed migration only after fresh review and without navigation", () => {
    const f = migrationSetup({ complete: true }), state = f.runtime.getSnapshot();
    expect(f.runtime.migrate(state.migrations[0].key, state.revision)).toBe(true);
    expect(f.navigate).not.toHaveBeenCalled();
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "complete", completedCount: 4, canOpen: false, canNext: false });
    expect(f.runtime.getProgressIntent()).toMatchObject({ revision: 1, preference: { records: [f.old,
      { acknowledgedNodeIds: ["country", "writer-v2", "work", "checkpoint"], resumeNodeId: null }] } });
    f.runtime.refresh(); expect(f.runtime.getProgressIntent().revision).toBe(1); f.runtime.dispose();
  });

  it.each(["pause", "reset"] as const)("respects a reentrant %s before migration dispatch without committing a target", action => {
    const f = migrationSetup(), state = f.runtime.getSnapshot();
    const remove = f.runtime.subscribe(() => {
      const snapshot = f.runtime.getSnapshot();
      if (snapshot.active?.phase === "navigating") f.runtime[action](snapshot.revision);
    });
    expect(f.runtime.migrate(state.migrations[0].key, state.revision)).toBe(false); expect(f.navigate).not.toHaveBeenCalled();
    expect(f.runtime.getProgressIntent().preference.records).toEqual(action === "reset" ? [] : [f.old]);
    expect(f.runtime.getProgressIntent().revision).toBe(action === "reset" ? 1 : 0); remove(); f.runtime.dispose();
  });

  it("fails closed for nested or throwing migration sources and for revoked current-plan admission", () => {
    const f = migrationSetup();
    f.resolveMigration.mockImplementation((old, current) => { f.runtime.refresh(); return f.validResolver(old, current); });
    f.runtime.refresh(); expect(f.runtime.getSnapshot().migrations).toEqual([]);
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference: f.preference });
    f.resolveMigration.mockImplementation(() => { throw Error("revoked"); }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().migrations).toEqual([]);
    f.resolveMigration.mockImplementation(f.validResolver); f.patch({ resolve: () => null }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().migrations).toEqual([]); expect(f.runtime.getSnapshot().routes).toEqual([]);
    expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });
});

describe("explicit saved Booky journey history", () => {
  function historySetup() {
    const f = durableSetup(), second = fixture("en", { id: "second-journey", title: "Second synthetic journey" });
    f.switchSource(second); f.patch({ plans: [f.initial.plan, second.plan] });
    const firstRecord = createBookyJourneyProgressRecord(explicitPolicy, f.initial.plan, ["country"], "writer")!;
    const secondRecord = createBookyJourneyProgressRecord(explicitPolicy, second.plan, [], "country")!;
    const preference = { ...DEFAULT_BOOKY_JOURNEY_PROGRESS, activeRecordId: firstRecord.recordId, records: [firstRecord, secondRecord] };
    f.runtime.restoreProgress(preference, 0);
    return { ...f, firstRecord, secondRecord, preference };
  }

  it("always exposes immutable bounded semantic history with only freshly admitted titles", () => {
    const empty = durableSetup(); expect(empty.runtime.getSnapshot().history).toEqual([]); empty.runtime.dispose();
    const f = historySetup(), state = f.runtime.getSnapshot();
    expect(state.history).toEqual([
      { key: f.firstRecord.recordId, title: f.initial.plan.title, journeyId: "test-journey", version: 1, locale: "en",
        completedCount: 1, total: 4, selected: true, canSelect: true, available: true },
      { key: f.secondRecord.recordId, title: "Second synthetic journey", journeyId: "second-journey", version: 1, locale: "en",
        completedCount: 0, total: 4, selected: false, canSelect: true, available: true },
    ]);
    expect(Object.isFrozen(state.history)).toBe(true); expect(Object.isFrozen(state.history[0])).toBe(true);
    f.patch({ resolve: () => null }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().history.every(item => item.title === null && !item.available && item.canSelect)).toBe(true);
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference: f.preference }); f.runtime.dispose();
  });

  it("selects without navigation, acknowledgement or alteration of either saved record", () => {
    const f = historySetup(), state = f.runtime.getSnapshot();
    expect(f.runtime.selectHistory(f.secondRecord.recordId, state.revision)).toBe(true);
    expect(f.runtime.getProgressIntent()).toEqual({ revision: 1,
      preference: { ...f.preference, activeRecordId: f.secondRecord.recordId } });
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", completedCount: 0, index: 0 });
    expect(f.runtime.getSnapshot().history.map(item => item.selected)).toEqual([false, true]);
    expect(f.navigate).not.toHaveBeenCalled();
    expect(f.runtime.selectHistory(f.firstRecord.recordId, f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", completedCount: 1, index: 1 });
    expect(f.runtime.getProgressIntent().preference.records).toEqual(f.preference.records);
    expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });

  it("selects unavailable old history to reveal migration and completed history without replay", () => {
    const f = migrationSetup();
    f.runtime.restoreProgress({ ...f.preference, activeRecordId: null }, 0);
    expect(f.runtime.getSnapshot()).toMatchObject({ active: null, migrations: [], history: [
      { title: null, available: false, canSelect: true, selected: false },
    ] });
    expect(f.runtime.selectHistory(f.old.recordId, f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot()).toMatchObject({ active: { phase: "unavailable", completedCount: 1 }, migrations: [{ fromVersion: 1, toVersion: 2 }] });
    expect(f.navigate).not.toHaveBeenCalled(); expect(f.runtime.getProgressIntent().preference.records).toEqual([f.old]); f.runtime.dispose();
    const completed = durableSetup(), plan = completed.initial.plan;
    const record = createBookyJourneyProgressRecord(explicitPolicy, plan, plan.nodes.map(node => node.id), null)!;
    completed.runtime.restoreProgress({ ...DEFAULT_BOOKY_JOURNEY_PROGRESS, records: [record] }, 0);
    expect(completed.runtime.selectHistory(record.recordId, completed.runtime.getSnapshot().revision)).toBe(true);
    expect(completed.runtime.getSnapshot().active).toMatchObject({ phase: "complete", completedCount: 4, canNext: false, canOpen: false });
    expect(completed.navigate).not.toHaveBeenCalled(); expect(completed.runtime.getProgressIntent().preference.records).toEqual([record]); completed.runtime.dispose();
  });

  it("requires fresh revision and active explicit policy; other-profile history can only be deleted", () => {
    const f = historySetup(), old = f.runtime.getSnapshot().revision;
    f.patch({ view: { ...f.host().view } });
    expect(f.runtime.deleteHistory(f.firstRecord.recordId, old)).toBe(false);
    expect(f.runtime.selectHistory(f.secondRecord.recordId, old)).toBe(false);
    for (const profileKey of [null, "opaque-policy", serializeBookyReaderPolicy({ ...explicitPolicy, revision: 2 })]) {
      f.patch({ profileKey }); f.runtime.refresh();
      const state = f.runtime.getSnapshot();
      expect(state.history.every(item => item.title === null && !item.available && !item.canSelect)).toBe(true);
      expect(f.runtime.selectHistory(f.firstRecord.recordId, state.revision)).toBe(false);
      if (!profileKey || profileKey === "opaque-policy") expect(f.runtime.deleteHistory(f.firstRecord.recordId, state.revision)).toBe(false);
    }
    f.patch({ active: false }); f.runtime.refresh();
    expect(f.runtime.deleteHistory(f.firstRecord.recordId, f.runtime.getSnapshot().revision)).toBe(false);
    f.patch({ active: true }); f.runtime.refresh();
    expect(f.runtime.deleteHistory(f.firstRecord.recordId, f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getProgressIntent().preference).toMatchObject({ activeRecordId: null, records: [f.secondRecord] });
    expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });

  it("deletes one inactive record without disturbing the active navigation, then aborts selected deletion", () => {
    const f = historySetup(); expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(true);
    const signal = f.navigate.mock.calls[0][1], active = f.runtime.getSnapshot().active;
    expect(f.runtime.deleteHistory(f.secondRecord.recordId, f.runtime.getSnapshot().revision)).toBe(true);
    expect(signal.aborted).toBe(false); expect(f.runtime.getSnapshot().active).toEqual(active);
    expect(f.runtime.getProgressIntent().preference).toMatchObject({ activeRecordId: f.firstRecord.recordId, records: [f.firstRecord] });
    expect(f.runtime.deleteHistory(f.firstRecord.recordId, f.runtime.getSnapshot().revision)).toBe(true);
    expect(signal.aborted).toBe(true); expect(f.runtime.getSnapshot()).toMatchObject({ active: null, history: [] });
    expect(f.runtime.getProgressIntent().preference).toMatchObject({ activeRecordId: null, records: [] });
    expect(f.navigate).toHaveBeenCalledOnce();
    const intent = f.runtime.getProgressIntent();
    expect(f.runtime.deleteHistory(f.firstRecord.recordId, f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(intent); f.runtime.dispose();
  });

  it.each(["selectHistory", "deleteHistory"] as const)("rejects %s when an abort observer revokes the profile before mutation", action => {
    const f = historySetup(); f.runtime.resume(f.runtime.getSnapshot().revision);
    const intent = f.runtime.getProgressIntent(), signal = f.navigate.mock.calls[0][1];
    signal.addEventListener("abort", () => f.patch({ profileKey: null }), { once: true });
    const key = action === "selectHistory" ? f.secondRecord.recordId : f.firstRecord.recordId;
    expect(f.runtime[action](key, f.runtime.getSnapshot().revision)).toBe(false);
    expect(signal.aborted).toBe(true); expect(f.runtime.getProgressIntent()).toBe(intent);
    expect(f.runtime.getSnapshot().history.every(item => item.title === null && !item.canSelect)).toBe(true); f.runtime.dispose();
  });

  it("preserves a newer reentrant deletion and rejects nested source-driven selection", () => {
    const f = historySetup(); let changed = false;
    const remove = f.runtime.subscribe(() => {
      if (!changed && f.runtime.getProgressIntent().preference.activeRecordId === f.secondRecord.recordId) {
        changed = true; f.runtime.deleteHistory(f.secondRecord.recordId, f.runtime.getSnapshot().revision);
      }
    });
    expect(f.runtime.selectHistory(f.secondRecord.recordId, f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toMatchObject({ revision: 2, preference: { activeRecordId: null, records: [f.firstRecord] } });
    remove();
    const intent = f.runtime.getProgressIntent();
    f.patch({ resolve: (plan, nodeId) => {
      expect(f.runtime.selectHistory(f.firstRecord.recordId, f.runtime.getSnapshot().revision)).toBe(false);
      return f.resolve(plan, nodeId);
    } });
    f.runtime.refresh(); expect(f.runtime.getProgressIntent()).toBe(intent);
    expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });

  it("hides same-version edits and mismatched topology but permits admitted equivalent locale selection", () => {
    const f = historySetup(), original = f.runtime.getProgressIntent();
    for (const source of [fixture("en", { title: "Edited version without migration" }), fixture("ru", { workId: "different-work" })]) {
      f.switchSource(source);
      expect(f.runtime.getSnapshot().history[0]).toMatchObject({ title: null, available: false, canSelect: true });
      expect(f.runtime.selectHistory(f.firstRecord.recordId, f.runtime.getSnapshot().revision)).toBe(true);
      expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", node: null });
    }
    f.switchSource(fixture("ru"));
    expect(f.runtime.getSnapshot().history[0]).toMatchObject({ title: "ru: Synthetic journey", available: true });
    expect(f.runtime.selectHistory(f.firstRecord.recordId, f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", completedCount: 1, index: 1 });
    expect(f.runtime.getProgressIntent().preference.records).toEqual(original.preference.records);
    expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });
});

describe("Booky saved journey capacity", () => {
  function historical(f: ReturnType<typeof durableSetup>, count: number, policy = explicitPolicy) {
    return Array.from({ length: count }, (_, index) => createBookyJourneyProgressRecord(policy,
      { ...f.initial.plan, id: `capacity-history-${index}` }, [], "country")!);
  }

  it("exposes immutable empty capacity without constructor reads or semantic writes", () => {
    const f = durableSetup(), initial = f.runtime.getSnapshot();
    expect(initial.historyCapacity).toEqual({ used: 0, limit: 32, full: false });
    expect(Object.isFrozen(initial.historyCapacity)).toBe(true); expect(f.readHost).not.toHaveBeenCalled();
    const intent = f.runtime.getProgressIntent(); f.runtime.refresh();
    expect(f.runtime.getSnapshot().routes[0].canStart).toBe(true);
    expect(f.runtime.getProgressIntent()).toBe(intent); expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });

  it("keeps Start, Next and Resume available for an existing exact-profile record at 32 slots", () => {
    const f = durableSetup(), current = createBookyJourneyProgressRecord(explicitPolicy, f.initial.plan, ["country"], "writer")!;
    const others = historical(f, 31), records = [current, ...others];
    f.runtime.restoreProgress({ ...DEFAULT_BOOKY_JOURNEY_PROGRESS, activeRecordId: current.recordId, records }, 0);
    expect(f.runtime.getSnapshot().historyCapacity).toEqual({ used: 32, limit: 32, full: true });
    expect(f.runtime.getSnapshot().routes[0].canStart).toBe(true); expect(f.start()).toBe(true);
    expect(f.navigate.mock.calls[0][0].nodeId).toBe("writer");
    f.display(1); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true); f.display(2);
    expect(f.runtime.pause(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().historyCapacity).toEqual({ used: 32, limit: 32, full: true });
    expect(f.runtime.getSnapshot().routes[0].canStart).toBe(true);
    expect(f.runtime.getProgressIntent().preference.records[0].acknowledgedNodeIds).toEqual(["country", "writer"]);
    expect(f.runtime.getProgressIntent().preference.records.slice(1)).toEqual(others); f.runtime.dispose();
  });

  it("denies a fresh route at capacity without navigating and enables it after explicit selected deletion", () => {
    const f = durableSetup(), records = historical(f, 32);
    f.runtime.restoreProgress({ ...DEFAULT_BOOKY_JOURNEY_PROGRESS, activeRecordId: records[0].recordId, records }, 0);
    const before = f.runtime.getProgressIntent();
    expect(f.runtime.getSnapshot().historyCapacity).toEqual({ used: 32, limit: 32, full: true });
    expect(f.runtime.getSnapshot().routes[0].canStart).toBe(false); expect(f.start()).toBe(false);
    expect(f.navigate).not.toHaveBeenCalled(); expect(f.runtime.getProgressIntent()).toBe(before);
    expect(f.runtime.deleteHistory(records[0].recordId, f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().historyCapacity).toEqual({ used: 31, limit: 32, full: false });
    expect(f.runtime.getSnapshot().routes[0].canStart).toBe(true);
    expect(f.runtime.getProgressIntent().preference.records).toEqual(records.slice(1));
    expect(f.start()).toBe(true); expect(f.runtime.getSnapshot().historyCapacity.full).toBe(true);
    expect(f.runtime.getProgressIntent().preference.records.slice(0, 31)).toEqual(records.slice(1)); f.runtime.dispose();
  });

  it("counts other-profile records without mistaking their matching route id for a reusable slot", () => {
    const f = durableSetup(), otherPolicy = createBookyReaderPolicy({ age: 31, readingLevel: "plain" }, reviewedAt, 2)!;
    const otherCurrent = createBookyJourneyProgressRecord(otherPolicy, f.initial.plan, [], "country")!;
    const others = historical(f, 31, otherPolicy), records = [otherCurrent, ...others];
    f.runtime.restoreProgress({ ...DEFAULT_BOOKY_JOURNEY_PROGRESS, activeRecordId: otherCurrent.recordId, records }, 0);
    expect(f.runtime.getSnapshot().historyCapacity).toEqual({ used: 32, limit: 32, full: true });
    expect(f.runtime.getSnapshot().history.every(item => item.title === null && !item.canSelect)).toBe(true);
    expect(f.runtime.getSnapshot().routes[0].canStart).toBe(false); expect(f.start()).toBe(false);
    expect(f.navigate).not.toHaveBeenCalled();
    expect(f.runtime.deleteHistory(otherCurrent.recordId, f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().routes[0].canStart).toBe(true); expect(f.start()).toBe(true);
    expect(f.runtime.getProgressIntent().preference.records.slice(0, 31)).toEqual(others);
    expect(f.runtime.getSnapshot().historyCapacity.used).toBe(32); f.runtime.dispose();
  });

  it("never exposes an unreviewed migration merely because an explicit deletion frees capacity", () => {
    const f = migrationSetup(), others = historical(f, 31);
    f.runtime.restoreProgress({ ...f.preference, records: [f.old, ...others] }, 0);
    expect(f.runtime.getSnapshot().historyCapacity.full).toBe(true);
    expect(f.runtime.getSnapshot().routes[0].canStart).toBe(false);
    expect(f.runtime.getSnapshot().migrations).toEqual([]);
    f.resolveMigration.mockReturnValue(null); f.runtime.refresh();
    expect(f.runtime.deleteHistory(others[0].recordId, f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().historyCapacity).toEqual({ used: 31, limit: 32, full: false });
    expect(f.runtime.getSnapshot().routes[0].canStart).toBe(true);
    expect(f.runtime.getSnapshot().migrations).toEqual([]);
    expect(f.runtime.getProgressIntent().preference.records).toEqual([f.old, ...others.slice(1)]);
    expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });
});

function activitySetup() {
  const f = setup(fixture("en", { activity: true }));
  f.patch({ profileKey: durableProfileKey });
  expect(f.start()).toBe(true); f.display(0);
  expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true); f.display(1);
  return f;
}

describe("explicit reviewed journey activity answers", () => {
  it("keeps wrong and correct choices ephemeral until a separate settled Next acknowledges the activity", () => {
    const f = activitySetup(), intent = f.runtime.getProgressIntent(), moves = f.navigate.mock.calls.length;
    expect(f.runtime.getSnapshot().active).toMatchObject({ index: 1, completedCount: 1, canNext: false,
      answer: { choiceId: null, status: "unanswered", canAnswer: true } });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.answer("second", f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ canNext: false, answer: { choiceId: "second", status: "incorrect", canAnswer: true } });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.answer("first", f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ canNext: true, answer: { choiceId: "first", status: "correct", canAnswer: true } });
    expect(Object.isFrozen(f.runtime.getSnapshot().active?.answer)).toBe(true);
    expect(f.runtime.getProgressIntent()).toBe(intent); expect(f.navigate).toHaveBeenCalledTimes(moves);
    expect(JSON.stringify(intent.preference)).not.toContain('"choiceId"');
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
    expect(f.runtime.getSnapshot().active).toMatchObject({ index: 2, completedCount: 2, answer: null });
    const record = f.runtime.getProgressIntent().preference.records[0];
    expect(record.acknowledgedNodeIds).toEqual(["country", "activity"]);
    expect(record.nodes[1].activity).toEqual({ id: "test-match-author", version: 1,
      semanticChecksum: f.initial.plan.nodes[1].activity!.semanticChecksum });
    expect(JSON.stringify(record)).not.toContain('"correctChoiceId"'); f.runtime.dispose();
  });

  it("rejects stale or unknown choices and requires an actually settled current globe view", () => {
    const f = activitySetup(), original = f.runtime.getSnapshot(), intent = f.runtime.getProgressIntent();
    expect(f.runtime.answer("missing", original.revision)).toBe(false);
    expect(f.runtime.answer("first", original.revision - 1)).toBe(false);
    expect(f.runtime.getSnapshot()).toBe(original);
    f.display(1, { settled: false });
    expect(f.runtime.answer("first", f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", answer: { status: "unanswered", canAnswer: false } });
    f.display(1); expect(f.runtime.answer("first", f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(true); f.display(1, { screen: "collection" });
    expect(f.runtime.answer("first", f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(intent); f.runtime.dispose();
  });

  it.each(["pause", "background", "profile", "revocation", "unsettled"] as const)("forgets a correct answer after %s without writing progress", event => {
    const f = activitySetup(), intent = f.runtime.getProgressIntent();
    expect(f.runtime.answer("first", f.runtime.getSnapshot().revision)).toBe(true);
    if (event === "pause") f.runtime.pause(f.runtime.getSnapshot().revision);
    else {
      f.patch(event === "background" ? { active: false } : event === "profile" ? { profileKey: null }
        : event === "revocation" ? { resolve: () => null } : { view: { ...f.host().view, settled: false } });
      f.runtime.refresh();
    }
    expect(f.runtime.getSnapshot().active?.canNext).toBe(false);
    expect(f.runtime.getSnapshot().active?.answer?.choiceId ?? null).toBeNull();
    expect(f.runtime.getProgressIntent()).toBe(intent);
    f.patch({ active: true, profileKey: durableProfileKey, resolve: f.resolve }); f.display(1);
    expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(true); f.display(1);
    expect(f.runtime.getSnapshot().active).toMatchObject({ canNext: false, completedCount: 1,
      answer: { choiceId: null, status: "unanswered", canAnswer: true } }); f.runtime.dispose();
  });

  it("clears choices on an independently admitted equivalent locale without navigating or acknowledging", () => {
    const f = activitySetup(), intent = f.runtime.getProgressIntent(), moves = f.navigate.mock.calls.length;
    f.runtime.answer("first", f.runtime.getSnapshot().revision);
    f.switchSource(fixture("ru", { activity: true }));
    expect(f.runtime.getSnapshot().active).toMatchObject({ index: 1, completedCount: 1, phase: "ready", canNext: false,
      answer: { choiceId: null, status: "unanswered", canAnswer: true } });
    expect(f.runtime.getSnapshot().active?.node?.dialogue.payload.locale).toBe("ru");
    expect(f.runtime.getProgressIntent()).toBe(intent); expect(f.navigate).toHaveBeenCalledTimes(moves); f.runtime.dispose();
  });

  it("requires a new answer after reopen or fresh-runtime restoration of the exact unacknowledged activity", () => {
    const f = activitySetup(); f.runtime.answer("first", f.runtime.getSnapshot().revision);
    expect(f.runtime.open(f.runtime.getSnapshot().revision)).toBe(true); f.display(1);
    expect(f.runtime.getSnapshot().active?.answer?.status).toBe("unanswered");
    f.runtime.answer("first", f.runtime.getSnapshot().revision);
    const saved = f.runtime.getProgressIntent().preference; f.runtime.dispose();
    const restored = setup(fixture("en", { activity: true })); restored.patch({ profileKey: durableProfileKey });
    expect(restored.runtime.restoreProgress(saved, 0)).toBe(true);
    expect(restored.runtime.getSnapshot().active).toMatchObject({ phase: "paused", completedCount: 1, canNext: false,
      answer: { status: "unanswered", choiceId: null, canAnswer: false } });
    expect(restored.navigate).not.toHaveBeenCalled();
    expect(restored.runtime.resume(restored.runtime.getSnapshot().revision)).toBe(true); restored.display(1);
    expect(restored.runtime.next(restored.runtime.getSnapshot().revision)).toBe(false); restored.runtime.dispose();
  });

  it.each(["answer", "next"] as const)("recompiles current factual authorship during %s even when the raw route and host revision are unchanged", action => {
    const f = activitySetup(), intent = f.runtime.getProgressIntent(), moves = f.navigate.mock.calls.length;
    if (action === "next") expect(f.runtime.answer("first", f.runtime.getSnapshot().revision)).toBe(true);
    f.initial.trust.publicBooks[0].authorship = { kind: "single", authors: [{ countryId: "test-country", writerId: "other-writer" }] };
    const revision = f.runtime.getSnapshot().revision;
    expect(action === "answer" ? f.runtime.answer("first", revision) : f.runtime.next(revision)).toBe(false);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", node: null, answer: null, completedCount: 1 });
    expect(f.runtime.getProgressIntent()).toBe(intent); expect(f.navigate).toHaveBeenCalledTimes(moves); f.runtime.dispose();
  });

  it("does not adopt saved activity progress after derived authorship changes under the same reviewed definition", () => {
    const f = activitySetup(); f.runtime.answer("first", f.runtime.getSnapshot().revision);
    const old = f.initial.plan, intent = f.runtime.getProgressIntent();
    const changed = fixture("en", { activity: true, activityAuthor: "other-writer" });
    expect(changed.plan.definitionChecksum).toBe(old.definitionChecksum);
    expect(changed.plan.nodes[1].activity!.semanticChecksum).not.toBe(old.nodes[1].activity!.semanticChecksum);
    f.switchSource(changed);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", completedCount: 1, answer: null });
    expect(f.runtime.getSnapshot().history[0].available).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(intent); f.runtime.dispose();
  });

  it.each(["pause", "silent-revocation"] as const)("honors reentrant %s after publishing a choice", event => {
    const f = activitySetup(), intent = f.runtime.getProgressIntent(), moves = f.navigate.mock.calls.length;
    const stop = f.runtime.subscribe(() => {
      const state = f.runtime.getSnapshot();
      if (state.active?.answer?.status !== "correct") return;
      if (event === "pause") f.runtime.pause(state.revision); else f.patch({ resolve: () => null });
    });
    expect(f.runtime.answer("first", f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getSnapshot().active?.canNext).toBe(false);
    expect(f.runtime.getSnapshot().active?.answer?.choiceId ?? null).toBeNull();
    expect(f.runtime.getProgressIntent()).toBe(intent); expect(f.navigate).toHaveBeenCalledTimes(moves); stop(); f.runtime.dispose();
  });

  it("rejects forged migration of an acknowledged activity when only its derived semantic author changed", () => {
    const f = setup(fixture("en", { activity: true })); f.patch({ profileKey: durableProfileKey });
    const old = createBookyJourneyProgressRecord(explicitPolicy, f.initial.plan, ["country", "activity"], "after-activity")!;
    const target = fixture("en", { activity: true, activityAuthor: "other-writer", version: 2 });
    const forged = createBookyJourneyProgressRecord(explicitPolicy, target.plan, ["country", "activity"], "after-activity")!;
    const preference = { ...DEFAULT_BOOKY_JOURNEY_PROGRESS, activeRecordId: old.recordId, records: [old] };
    f.switchSource(target); f.patch({ resolveMigration: () => ({ migrationId: "test-forged-activity", migrationChecksum: "a".repeat(64),
      preservedRecord: old, targetRecord: forged }) });
    expect(f.runtime.restoreProgress(preference, 0)).toBe(true);
    expect(f.runtime.getSnapshot().migrations).toEqual([]);
    expect(f.runtime.getProgressIntent().preference).toEqual(preference); expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });

  it("rejects stale public choice labels before accepting a gesture", () => {
    const f = activitySetup(), intent = f.runtime.getProgressIntent();
    f.initial.trust.publicCountries[0].writers[0].name = "Renamed Synthetic Writer";
    expect(f.runtime.answer("first", f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getSnapshot().active?.answer).toBeNull();
    expect(f.runtime.getProgressIntent()).toBe(intent); f.runtime.dispose();
  });


  it("withdraws canNext on refresh when current activity authority changes without an answer or Next gesture", () => {
    const f = activitySetup(), intent = f.runtime.getProgressIntent();
    f.runtime.answer("first", f.runtime.getSnapshot().revision);
    f.initial.trust.publicBooks[0].authorship = { kind: "single", authors: [{ countryId: "test-country", writerId: "other-writer" }] };
    f.runtime.refresh();
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", canNext: false, answer: null });
    expect(f.runtime.getProgressIntent()).toBe(intent); f.runtime.dispose();
  });

  it("preserves ordinary-node Next behavior and rejects answer gestures outside an activity", () => {
    const f = setup(); f.start(); f.display(0);
    expect(f.runtime.getSnapshot().active).toMatchObject({ answer: null, canNext: true });
    expect(f.runtime.answer("first", f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true); f.runtime.dispose();
    expect(f.runtime.answer("first", f.runtime.getSnapshot().revision)).toBe(false);
  });

  it.each(["observer", "navigation-port"] as const)("rechecks every activity after %s changes authorship while Next targets an ordinary node", edge => {
    const f = activitySetup(), intent = f.runtime.getProgressIntent(), moves = f.navigate.mock.calls.length;
    expect(f.runtime.answer("first", f.runtime.getSnapshot().revision)).toBe(true);
    const changeAuthor = () => { f.initial.trust.publicBooks[0].authorship = {
      kind: "single", authors: [{ countryId: "test-country", writerId: "other-writer" }] }; };
    const stop = edge === "observer" ? f.runtime.subscribe(() => {
      const active = f.runtime.getSnapshot().active;
      if (active?.phase === "navigating" && active.index === 2) changeAuthor();
    }) : () => {};
    if (edge === "navigation-port") f.navigate.mockImplementationOnce(() => { changeAuthor(); return true; });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(intent);
    expect(f.runtime.getProgressIntent().preference.records[0].acknowledgedNodeIds).toEqual(["country"]);
    expect(f.runtime.getSnapshot().active).toMatchObject({ index: 1, completedCount: 1, phase: "unavailable", answer: null, canNext: false });
    expect(f.navigate).toHaveBeenCalledTimes(moves + (edge === "navigation-port" ? 1 : 0));
    expect(f.navigate.mock.calls[f.navigate.mock.calls.length - 1]![1].aborted).toBe(true); stop(); f.runtime.dispose();
  });

  it("rechecks earlier activity semantics before final completion at an ordinary checkpoint", () => {
    const f = activitySetup(); f.runtime.answer("first", f.runtime.getSnapshot().revision);
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true); f.display(2);
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true); f.display(3);
    const intent = f.runtime.getProgressIntent(), moves = f.navigate.mock.calls.length;
    f.initial.trust.publicBooks[0].authorship = { kind: "single", authors: [{ countryId: "test-country", writerId: "other-writer" }] };
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getProgressIntent()).toBe(intent);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", completedCount: 3, canNext: false });
    expect(f.navigate).toHaveBeenCalledTimes(moves); f.runtime.dispose();
  });

});


describe("current admitted journey overview in runtime route offers", () => {
  const overview = { description: "Synthetic overview for the reviewed route", estimatedDurationMinutes: 12 };

  it("keeps old route fieldsets exact and projects immutable optional overview without persisting it", () => {
    const legacy = setup(); legacy.runtime.refresh();
    expect(legacy.runtime.getSnapshot().routes[0]).toEqual({ key: bookyJourneyRouteKey(legacy.initial.plan),
      title: legacy.initial.plan.title, canStart: true });
    expect(Object.prototype.hasOwnProperty.call(legacy.runtime.getSnapshot().routes[0], "overview")).toBe(false); legacy.runtime.dispose();
    const f = setup(fixture("en", { overview })); f.patch({ profileKey: durableProfileKey }); f.runtime.refresh();
    const route = f.runtime.getSnapshot().routes[0];
    expect(route).toMatchObject({ title: f.initial.plan.title, canStart: true, overview: { ...overview, offlineAvailable: true } });
    expect(Object.isFrozen(route.overview)).toBe(true); expect(route.overview).not.toBe(f.initial.plan.overview);
    expect(f.runtime.start(route.key, f.runtime.getSnapshot().revision)).toBe(true);
    const record = f.runtime.getProgressIntent().preference.records[0];
    expect(record.definitionChecksum).toBe(f.initial.plan.definitionChecksum);
    for (const field of ["overview", "description", "estimatedDurationMinutes", "offlineAvailable"]) {
      expect(JSON.stringify(record)).not.toContain('"' + field + '"');
    }
    f.runtime.dispose();
  });

  it("revises derived offline availability without silently accepting a stale Start gesture", () => {
    const f = setup(fixture("en", { overview })); f.runtime.refresh();
    const previous = f.runtime.getSnapshot(), intent = f.runtime.getProgressIntent();
    const changed = fixture("en", { overview, offlineAvailable: false });
    expect(changed.plan.definitionChecksum).toBe(f.initial.plan.definitionChecksum);
    f.switchSource(changed);
    const current = f.runtime.getSnapshot();
    expect(current.routes[0].key).toBe(previous.routes[0].key);
    expect(current.routes[0].overview).toEqual({ ...overview, offlineAvailable: false });
    expect(current.revision).toBeGreaterThan(previous.revision);
    expect(f.runtime.start(previous.routes[0].key, previous.revision)).toBe(false);
    expect(f.navigate).not.toHaveBeenCalled(); expect(f.runtime.getProgressIntent()).toBe(intent);
    expect(f.runtime.start(current.routes[0].key, current.revision)).toBe(true); f.runtime.dispose();
  });

  it("withdraws overview copy after revoked admission, including revocation immediately before Start", () => {
    const f = setup(fixture("en", { overview })); f.runtime.refresh();
    const previous = f.runtime.getSnapshot(), intent = f.runtime.getProgressIntent();
    f.patch({ resolve: () => null });
    expect(f.runtime.start(previous.routes[0].key, previous.revision)).toBe(false);
    expect(f.runtime.getSnapshot().routes).toEqual([]);
    expect(JSON.stringify(f.runtime.getSnapshot())).not.toContain(overview.description);
    expect(f.navigate).not.toHaveBeenCalled(); expect(f.runtime.getProgressIntent()).toBe(intent);
    f.patch({ resolve: f.resolve }); f.runtime.refresh();
    const restored = f.runtime.getSnapshot();
    expect(restored.routes[0].overview).toEqual({ ...overview, offlineAvailable: true });
    expect(f.runtime.start(previous.routes[0].key, previous.revision)).toBe(false);
    expect(f.runtime.start(restored.routes[0].key, restored.revision)).toBe(true); f.runtime.dispose();
  });

  it("replaces authored overview only through its newly admitted definition binding", () => {
    const f = setup(fixture("en", { overview })); f.runtime.refresh(); const previous = f.runtime.getSnapshot();
    const revised = { ...overview, description: "New independently reviewed description", estimatedDurationMinutes: 18 };
    const changed = fixture("en", { overview: revised });
    expect(changed.plan.definitionChecksum).not.toBe(f.initial.plan.definitionChecksum);
    f.switchSource(changed);
    expect(f.runtime.getSnapshot().routes[0].overview).toEqual({ ...revised, offlineAvailable: true });
    expect(f.runtime.start(previous.routes[0].key, previous.revision)).toBe(false);
    expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });

  it("rejects present but malformed overview instead of inventing legacy fallback copy or executing accessors", () => {
    const f = setup(), base = f.initial.plan;
    for (const value of [null, undefined, { ...overview, offlineAvailable: "yes" }, { ...overview, offlineAvailable: true, extra: true }]) {
      f.patch({ plans: [{ ...base, overview: value } as unknown as typeof base] }); f.runtime.refresh();
      expect(f.runtime.getSnapshot().routes).toEqual([]);
    }
    const accessor = { ...base }, getter = vi.fn(() => ({ ...overview, offlineAvailable: true }));
    Object.defineProperty(accessor, "overview", { enumerable: true, get: getter });
    f.patch({ plans: [accessor] }); f.runtime.refresh();
    expect(f.runtime.getSnapshot().routes).toEqual([]); expect(getter).not.toHaveBeenCalled();
    expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });
});


/** These facts, sources and independent reviews are synthetic test fixtures.
 * Both locale payload hashes are bound before compiling the requested locale. */
function sourcedFactFixture(locale: "ru" | "en" = "en", kind: "country" | "writer" | "work" = "work",
  options: { factVersion?: number; changedLocale?: "ru" | "en"; routeVersion?: number } = {}): ReturnType<typeof fixture> {
  const base = fixture(locale, { version: options.routeVersion }), anchor = base.definition.nodes.find(node => node.kind === kind)!;
  const placeholder: BookyJourneyFactSpec = { schemaVersion: 1, id: "test-fact", version: options.factVersion ?? 1, dialogues: [
    { locale: "ru", id: "test-fact-dialogue", version: 1, contentChecksum: "a".repeat(64) },
    { locale: "en", id: "test-fact-dialogue", version: 1, contentChecksum: "a".repeat(64) },
  ] };
  const raw = { id: "fact", kind: "sourced-fact" as const, entity: anchor.entity, screen: anchor.screen,
    dialogue: { id: "test-fact-dialogue", version: 1, contentChecksum: "a".repeat(64) }, fact: placeholder };
  const factRecords = (["ru", "en"] as const).map(language => {
    const copy = { title: language + ": synthetic fact", body: language + ": synthetic test statement " + (options.changedLocale === language ? "changed" : "original"),
      caption: "Synthetic fact", reduced: "Synthetic fact" };
    const payload: BookyDialoguePayload = { id: raw.dialogue.id, version: 1, locale: language, audience: "adult", ageRange: { min: 18, max: 120 },
      readingLevel: "plain", intent: "sourced-fact", screens: [raw.screen], context: bookyJourneyDialogueContext(base.definition.id, raw)!,
      entityIds: [bookyJourneyEntityId(raw.entity!)], claimKind: "factual", factualSources: [{ id: "test-source", url: "https://example.org/fact", accessedAt: reviewedAt }],
      copy, narration: null, prohibitedTags: [], provenance: { kind: "editorial", sourcePath: "test/runtime-fact.ts", sourceVersion: 1,
        sourceRef: "test-fact", sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })) } };
    const review = { status: "approved" as const, reviewer: "synthetic-fact-reviewer-not-real", reviewedAt,
      contentChecksum: getBookyDialogueContentChecksum(payload)! };
    return { payload, review, checksum: getBookyDialogueChecksum({ payload, review })! };
  });
  const spec: BookyJourneyFactSpec = { ...placeholder, dialogues: [
    { locale: "ru", id: raw.dialogue.id, version: 1, contentChecksum: factRecords[0].review.contentChecksum },
    { locale: "en", id: raw.dialogue.id, version: 1, contentChecksum: factRecords[1].review.contentChecksum },
  ] };
  const selected = spec.dialogues.find(binding => binding.locale === locale)!;
  const fact = { ...raw, fact: spec, dialogue: { id: selected.id, version: selected.version, contentChecksum: selected.contentChecksum } };
  const position = base.definition.nodes.indexOf(anchor) + 1;
  const definition = { ...base.definition, nodes: [...base.definition.nodes.slice(0, position), fact, ...base.definition.nodes.slice(position)] };
  const records = [...base.plan.nodes.map(node => node.dialogue), ...factRecords];
  const context = { ...base.context, availability: definition.nodes.map(node => ({ nodeId: node.id, locale,
    dialogueContentChecksum: node.dialogue.contentChecksum, available: true, offlineAvailable: true })) };
  const trust: BookyJourneyTrust = { ...base.trust, approvedReviews: [{ id: definition.id, version: definition.version, locale,
    definitionChecksum: getBookyJourneyChecksum(definition)!, reviewer: "synthetic-journey-reviewer-not-real", reviewedAt }],
    dialogueRegistry: createBookyDialogueRegistry(records, { canonicalEntityIds: [...new Set(records.flatMap(record => [...record.payload.entityIds]))],
      approvedReviews: records.map(record => ({ id: record.payload.id, locale: record.payload.locale, version: record.payload.version,
        contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt })) }) };
  const plan = compileBookyJourney(definition, context, trust);
  if (!plan) throw Error("invalid-synthetic-sourced-fact-runtime-fixture");
  return { definition, context, trust, plan };
}
function factSetup(kind: "country" | "writer" | "work" = "work") {
  const f = setup(sourcedFactFixture("en", kind)); f.patch({ profileKey: durableProfileKey });
  const index = f.initial.plan.nodes.findIndex(node => node.kind === "sourced-fact");
  expect(f.start()).toBe(true);
  for (let position = 0; position < index; position++) { f.display(position); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true); }
  f.display(index); return { ...f, factIndex: index };
}

describe("explicit sourced-fact acknowledgement and whole-route freshness", () => {
  it.each(["country", "writer", "work"] as const)("requires the exact settled %s anchor before explicit Next and saves no fact prose", kind => {
    const f = factSetup(kind), intent = f.runtime.getProgressIntent();
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "ready", canNext: true, answer: null });
    expect(f.runtime.answer("invented-choice", f.runtime.getSnapshot().revision)).toBe(false);
    for (const changed of [{ settled: false }, { countryId: "other-country" },
      ...(kind !== "country" ? [{ writerId: "other-writer" }] : []), ...(kind === "work" ? [{ workId: "other-work" }, { screen: "globe" as const }] : [])]) {
      const movesBefore = f.navigate.mock.calls.length;
      f.display(f.factIndex, changed); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
      expect(f.runtime.getProgressIntent()).toBe(intent); expect(f.navigate).toHaveBeenCalledTimes(movesBefore);
      f.display(f.factIndex); expect(f.runtime.resume(f.runtime.getSnapshot().revision)).toBe(true); f.display(f.factIndex);
    }
    const before = f.runtime.getProgressIntent(); f.runtime.refresh(); expect(f.runtime.getProgressIntent()).toBe(before);
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true);
    const record = f.runtime.getProgressIntent().preference.records[0];
    expect(record.acknowledgedNodeIds).toEqual(f.initial.plan.nodes.slice(0, f.factIndex + 1).map(node => node.id));
    expect(record.nodes[f.factIndex].fact!.semanticChecksum).toBe(f.initial.plan.nodes[f.factIndex].fact!.semanticChecksum);
    expect(JSON.stringify(record)).not.toMatch(/"(?:spec|dialogues|contentChecksum|factualSources|url|body)"/u); f.runtime.dispose();
  });

  it("restores a saved fact paused and requires explicit resume without adding credit or navigation", () => {
    const f = factSetup(), saved = f.runtime.getProgressIntent().preference; f.runtime.dispose();
    const restored = setup(sourcedFactFixture()); restored.patch({ profileKey: durableProfileKey });
    expect(restored.runtime.restoreProgress(saved, 0)).toBe(true);
    expect(restored.runtime.getSnapshot().active).toMatchObject({ phase: "paused", completedCount: 3, node: { kind: "sourced-fact" }, canNext: false });
    expect(restored.navigate).not.toHaveBeenCalled(); expect(restored.runtime.getProgressIntent().preference).toEqual(saved);
    expect(restored.runtime.resume(restored.runtime.getSnapshot().revision)).toBe(true); restored.display(3);
    expect(restored.runtime.getProgressIntent().preference.records[0].acknowledgedNodeIds).toEqual(["country", "writer", "work"]);
    expect(restored.runtime.getSnapshot().active?.canNext).toBe(true); restored.runtime.dispose();
  });

  it("allows independently admitted locale equivalence only for the exact shared fact pair", () => {
    const f = factSetup(), old = f.runtime.getProgressIntent(); f.runtime.pause(f.runtime.getSnapshot().revision);
    const same = sourcedFactFixture("ru");
    expect(same.plan.nodes[3].fact!.semanticChecksum).toBe(f.initial.plan.nodes[3].fact!.semanticChecksum);
    f.switchSource(same); expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "paused", completedCount: 3 });
    expect(f.runtime.getProgressIntent()).toBe(old);
    f.switchSource(sourcedFactFixture("ru", "work", { changedLocale: "en" }));
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", node: null, completedCount: 3 });
    expect(f.runtime.getProgressIntent()).toBe(old); f.runtime.dispose();
  });

  it("rejects changed resolved fact bindings before Next even when the host retains its old plan and revision", () => {
    const f = factSetup(), intent = f.runtime.getProgressIntent(), moves = f.navigate.mock.calls.length;
    f.patch({ resolve: (plan, id) => {
      const offer = f.resolve(plan, id);
      return offer?.node.kind === "sourced-fact" ? { ...offer, node: { ...offer.node,
        fact: { ...offer.node.fact!, semanticChecksum: "b".repeat(64) } } } : offer;
    } });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", completedCount: 3, canNext: false });
    expect(f.runtime.getProgressIntent()).toBe(intent); expect(f.navigate).toHaveBeenCalledTimes(moves); f.runtime.dispose();
  });

  it.each(["observer", "navigation-port"] as const)("rechecks every earlier fact after %s changes a binding while Next targets a normal checkpoint", edge => {
    const f = factSetup(), intent = f.runtime.getProgressIntent(), moves = f.navigate.mock.calls.length;
    let changed = false;
    f.patch({ resolve: (plan, id) => {
      const offer = f.resolve(plan, id);
      if (!changed || offer?.node.kind !== "sourced-fact") return offer;
      const spec: BookyJourneyFactSpec = { ...offer.node.fact!.spec, version: 2 };
      return { ...offer, node: { ...offer.node, fact: { spec, semanticChecksum: getBookyJourneyFactChecksum(spec, offer.node.entity!, offer.node.screen)! } } };
    } }); f.runtime.refresh();
    const stop = edge === "observer" ? f.runtime.subscribe(() => {
      const active = f.runtime.getSnapshot().active; if (active?.phase === "navigating" && active.node?.kind === "checkpoint") changed = true;
    }) : () => {};
    if (edge === "navigation-port") f.navigate.mockImplementationOnce(() => { changed = true; return true; });
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(changed).toBe(true); expect(f.runtime.getProgressIntent()).toBe(intent);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", index: 3, completedCount: 3, canNext: false });
    expect(f.navigate).toHaveBeenCalledTimes(moves + (edge === "navigation-port" ? 1 : 0));
    expect(f.navigate.mock.calls[f.navigate.mock.calls.length - 1]![1].aborted).toBe(true); stop(); f.runtime.dispose();
  });

  it("revalidates acknowledged facts before final completion and retains the exact old prefix after revocation", () => {
    const f = factSetup(); expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(true); f.display(4);
    const intent = f.runtime.getProgressIntent(), moves = f.navigate.mock.calls.length;
    f.patch({ resolve: (plan, id) => id === "fact" ? null : f.resolve(plan, id) }); f.runtime.refresh();
    expect(f.runtime.next(f.runtime.getSnapshot().revision)).toBe(false);
    expect(f.runtime.getSnapshot().active).toMatchObject({ phase: "unavailable", completedCount: 4 });
    expect(f.runtime.getProgressIntent()).toBe(intent); expect(f.navigate).toHaveBeenCalledTimes(moves); f.runtime.dispose();
  });

  it("rejects forged migration acknowledgement when the independently reviewed target changes the fact pair", () => {
    const f = setup(sourcedFactFixture()); f.patch({ profileKey: durableProfileKey });
    const old = createBookyJourneyProgressRecord(explicitPolicy, f.initial.plan, ["country", "writer", "work", "fact"], "checkpoint")!;
    const target = sourcedFactFixture("en", "work", { changedLocale: "ru", routeVersion: 2 });
    const forged = createBookyJourneyProgressRecord(explicitPolicy, target.plan, old.acknowledgedNodeIds, "checkpoint")!;
    const saved = { ...DEFAULT_BOOKY_JOURNEY_PROGRESS, activeRecordId: old.recordId, records: [old] };
    f.switchSource(target); f.patch({ resolveMigration: () => ({ migrationId: "test-forged-fact", migrationChecksum: "a".repeat(64),
      preservedRecord: old, targetRecord: forged }) });
    expect(f.runtime.restoreProgress(saved, 0)).toBe(true); expect(f.runtime.getSnapshot().migrations).toEqual([]);
    expect(f.runtime.getProgressIntent().preference).toEqual(saved); expect(f.navigate).not.toHaveBeenCalled(); f.runtime.dispose();
  });
});
