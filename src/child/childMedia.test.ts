import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChildMediaLoader, childMediaContainerMatches, decodeChildMediaManifest,
  type ChildMediaDelivery, type ChildMediaManifest, type ChildMediaOptions, type ChildMediaReadRequest,
  type ChildMediaReviewChallenge } from "./childMedia";
import { createChildMemoryDataPorts, createVerifiedChildIndex, type ChildReviewChallenge } from "./childIndex";
import { childPayloadBytes, type ChildEntityPayload, type ChildEntityReference } from "./childPackage";
import type { ChildAccessInput, ChildEntityKind } from "./childAccessPolicy";
import type { ChildDataScope } from "./childDataNamespace";
import type { ChildPackageChallenge, ChildRouteChallenge } from "./childStartup";

// All profiles, review/rights/time/inventory ports and content below are explicit
// synthetic local fixtures. Real hashing and the actual compiler/index supply
// programming evidence, never human approval, real media delivery or OS claims.
const initialTime = Date.parse("2026-10-02T12:00:00.000Z");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const png = () => new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlAAAAABJRU5ErkJggg==", "base64"));
function wave() {
  const bytes = new Uint8Array(46), view = new DataView(bytes.buffer);
  const ascii = (at: number, value: string) => [...value].forEach((char, index) => { bytes[at + index] = char.charCodeAt(0); });
  ascii(0, "RIFF"); view.setUint32(4, 38, true); ascii(8, "WAVE"); ascii(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true); view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, "data"); view.setUint32(40, 2, true); return bytes;
}
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
const settle = async () => { for (let index = 0; index < 96; index++) await Promise.resolve(); };

function fixture(locale: "ru" | "en" = "ru", narration = false, vector = false) {
  const startup: ChildPackageChallenge = { generation: 1, request: { locale, route: { kind: "home", entityId: null } },
    selection: { schemaVersion: 1, mode: "child", selectionRevision: 1, profileId: "synthetic-child", profileRevision: 1,
      profileChecksum: "a".repeat(64), policyVersion: "synthetic-policy-v1", policyChecksum: "b".repeat(64) },
    profile: { id: "synthetic-child", label: "Synthetic private nickname", exactAge: 9, ageBand: "9-11", locale,
      ageConfirmedAt: "2026-10-01T00:00:00.000Z", readingLevel: null, allowedTopics: null, blockedTopics: [],
      soundEnabled: false, motion: "calm", narrationEnabled: false } };
  function record(kind: ChildEntityKind, references: readonly ChildEntityReference[] = []) {
    const payload: ChildEntityPayload = { title: `Synthetic ${locale} ${kind}`, text: "Synthetic fixture only", terms: ["synthetic"], references };
    const checksum = hash(childPayloadBytes(payload));
    const policy: ChildAccessInput["entity"] = { id: `synthetic.${kind}`, kind, sourceVersion: "synthetic-source-v1",
      policyVersion: "synthetic-policy-v1", minAge: 3, maxAge: 17, reviewStatus: "approved", topics: ["synthetic-topic"],
      topicTagsComplete: true, commercialAvailability: "included-in-base", localizedContent: [{ locale, contentChecksum: checksum,
        reviewStatus: "approved", available: true, reviewerId: "synthetic-reviewer", reviewedAt: initialTime - 1000 }],
      rights: { status: "approved", basis: "original", platforms: ["web-pwa"], territories: ["RU"],
        validFrom: initialTime - 1000, expiresAt: initialTime + 60_000 } };
    return { payload, policy, reference: { kind, id: policy.id, contentChecksum: checksum } as ChildEntityReference };
  }
  const media = record(narration ? "narration" : "image"), work = record("work", [media.reference]), home = record("activity", [work.reference]);
  const packageValue = { schemaVersion: 1, namespace: "child", packageId: "synthetic-child-package", packageVersion: 1,
    locale, exactAge: 9, policyVersion: startup.selection.policyVersion, policyChecksum: startup.selection.policyChecksum,
    validFromEpochMs: initialTime - 1000, validUntilEpochMs: initialTime + 60_000, home: home.reference,
    entities: [media, work, home].map(row => ({ policy: row.policy, payload: row.payload })) };
  const packageBytes = () => new TextEncoder().encode(JSON.stringify(packageValue));
  const state = { time: initialTime, host: true, context: null as ChildRouteChallenge | null, reviewUntil: initialTime + 60_000 };
  const digest = { sha256: vi.fn(async (value: Uint8Array) => hash(value)) };
  const indexReview = { verify: vi.fn(async (challenge: ChildReviewChallenge): Promise<unknown> =>
    ({ status: "verified", challenge, validUntilEpochMs: initialTime + 60_000 })) };
  const index = createVerifiedChildIndex({ source: { async load() { return packageBytes(); } }, digest, review: indexReview,
    ports: createChildMemoryDataPorts(), isCurrent: value => state.host && JSON.stringify(value) === JSON.stringify(startup),
    clock: { nowEpochMs: () => state.time }, timeoutMs: 100, platform: "web-pwa", territory: "RU", initialVisibility: "active" });
  const scope: ChildDataScope = { schemaVersion: 1, namespace: "child", profileId: startup.profile.id, profileRevision: 1,
    exactAge: 9, locale, policyVersion: startup.selection.policyVersion, policyChecksum: startup.selection.policyChecksum,
    packageId: packageValue.packageId, packageVersion: 1, packageChecksum: hash(packageBytes()) };
  const mediaBytes = narration ? wave() : vector ? new Uint8Array(readFileSync(new URL("../../public/assets/country-flags/ru.svg", import.meta.url))) : png();
  const asset = { assetId: "synthetic-asset", owner: work.reference, entity: media.reference,
    inventoryKey: narration ? "synthetic.wav" : vector ? "synthetic.svg" : "synthetic.png", sha256: hash(mediaBytes), bytes: mediaBytes.length,
    mime: narration ? "audio/wav" as const : vector ? "image/svg+xml" as const : "image/png" as const };
  const manifest: ChildMediaManifest = { schemaVersion: 1, namespace: "child", scope,
    validFromEpochMs: initialTime - 1000, validUntilEpochMs: initialTime + 60_000, assets: [asset] };
  const manifestBytes = () => new TextEncoder().encode(JSON.stringify(manifest));
  const source = { load: vi.fn(async (_context: ChildRouteChallenge, _signal: AbortSignal): Promise<unknown> => manifestBytes()) };
  const review = { verify: vi.fn(async (challenge: ChildMediaReviewChallenge, _signal: AbortSignal): Promise<unknown> =>
    ({ status: "verified", challenge, validUntilEpochMs: state.reviewUntil })) };
  const inventory = { entries: [{ inventoryKey: asset.inventoryKey, sha256: asset.sha256, bytes: asset.bytes, mime: asset.mime }],
    read: vi.fn(async (_request: ChildMediaReadRequest, _signal: AbortSignal): Promise<unknown> => mediaBytes.slice()) };
  const options: ChildMediaOptions = { index, context: () => state.context, isCurrent: captured => state.host
    && JSON.stringify(captured) === JSON.stringify(state.context), manifestSource: source, review, inventory, digest,
    clock: { nowEpochMs: () => state.time }, timeoutMs: 100, platform: "web-pwa", territory: "RU", initialVisibility: "active" };
  const loader = createChildMediaLoader(options), input = { assetId: asset.assetId, owner: work.reference };
  async function admit() {
    const proof = await index.packagePort.verify(startup, new AbortController().signal);
    expect(proof).toMatchObject({ status: "verified", challenge: startup });
    const verified = proof as { scope: ChildDataScope; validUntilEpochMs: number };
    state.context = { ...clone(startup), scope: verified.scope, validUntilEpochMs: verified.validUntilEpochMs };
  }
  const visit = (visitor: (value: ChildMediaDelivery) => void = vi.fn(), signal = new AbortController().signal) => loader.visitMedia(input, signal, visitor);
  return { state, startup, packageValue, scope, media, work, home, mediaBytes, asset, manifest, manifestBytes, source,
    review, inventory, digest, index, indexReview, options, loader, input, admit, visit };
}
afterEach(() => vi.useRealTimers());

describe("child media manifest and exact local inventory", () => {
  it.each(["ru", "en"] as const)("delivers unchanged canonical static SVG bytes through exact synthetic %s policy/review/inventory", async locale => {
    const f = fixture(locale, false, true); await f.admit(); const visitor = vi.fn(); expect(await f.visit(visitor)).toBe(true);
    expect(visitor.mock.calls[0][0].asset.mime).toBe("image/svg+xml"); expect(visitor.mock.calls[0][0].bytes).toEqual(f.mediaBytes);
    expect(f.review.verify).toHaveBeenCalledTimes(2); expect(f.inventory.read).toHaveBeenCalledTimes(1);
    expect(decodeChildMediaManifest({ ...f.manifest, assets: [{ ...f.asset, bytes: 256 * 1024 + 1 }] })).toBeNull();
  });
  it("reports the actual intersected media review expiry without extending the first bound", async () => {
    const f = fixture(); await f.admit();
    f.review.verify.mockImplementationOnce(async challenge => ({ status: "verified", challenge, validUntilEpochMs: initialTime + 20 }));
    f.review.verify.mockImplementationOnce(async challenge => ({ status: "verified", challenge, validUntilEpochMs: initialTime + 40 }));
    const visitor = vi.fn(); expect(await f.visit(visitor)).toBe(true);
    expect(visitor.mock.calls[0][0].validUntilEpochMs).toBe(initialTime + 20);
  });
  it.each(["ru", "en"] as const)("hands off exact %s PNG bytes through the actual compiled active child index", async locale => {
    const f = fixture(locale); await f.admit(); const visitor = vi.fn(); expect(await f.visit(visitor)).toBe(true);
    const value: ChildMediaDelivery = visitor.mock.calls[0][0]; expect(value.scope.locale).toBe(locale);
    expect(value.bytes).toEqual(f.mediaBytes); expect(value.bytes).not.toBe(f.mediaBytes);
    expect(Object.isFrozen(value.asset.owner)).toBe(true); expect(f.review.verify).toHaveBeenCalledTimes(2);
    expect(f.inventory.read.mock.calls[0][0].context.scope).toEqual(f.scope);
    expect(f.inventory.read.mock.calls[0][0].isCurrent()).toBe(false);
  });
  it("supports self-contained exact WAV narration without a codec/renderer claim", async () => {
    const f = fixture("en", true); await f.admit(); const visitor = vi.fn(); expect(await f.visit(visitor)).toBe(true);
    expect(visitor.mock.calls[0][0].asset.mime).toBe("audio/wav"); expect(visitor.mock.calls[0][0].bytes).toEqual(wave());
  });
  it("keeps unavailable/startup/background snapshots sealed and reveals no profile or media bytes", async () => {
    const f = fixture(), visitor = vi.fn(); expect(await f.visit(visitor)).toBe(false); expect(f.source.load).not.toHaveBeenCalled();
    await f.admit(); f.loader.background(); expect(await f.visit(visitor)).toBe(false);
    expect(JSON.stringify(f.loader.getSnapshot())).toBe('{"phase":"sealed"}'); expect(visitor).not.toHaveBeenCalled();
  });
  it("rejects adult/newer/unknown/getter/sparse manifest authority without invoking accessors", () => {
    const f = fixture(), getter = vi.fn(() => f.scope);
    for (const value of [{ ...f.manifest, namespace: "adult" }, { ...f.manifest, schemaVersion: 2 },
      { ...f.manifest, approved: true }, { ...f.manifest, assets: new Array(1) }, { ...f.manifest, get scope() { return getter(); } }])
      expect(decodeChildMediaManifest(value)).toBeNull();
    expect(getter).not.toHaveBeenCalled(); expect(Object.isFrozen(decodeChildMediaManifest(f.manifest)?.assets)).toBe(true);
  });
  it("rejects raw URLs, traversal, active/unsupported MIME and duplicate relationships", () => {
    const f = fixture();
    for (const entry of [{ inventoryKey: "https://remote.test/a.png" }, { inventoryKey: "../adult.png" },
      { inventoryKey: "adult/child.png" }, { mime: "image/avif" }, { mime: "text/html" }, { mime: "model/gltf-binary" },
      { bytes: 32 * 1024 * 1024 + 1 }, { sha256: "A".repeat(64) }, { entity: { ...f.asset.entity, kind: "work" } }])
      expect(decodeChildMediaManifest({ ...f.manifest, assets: [{ ...f.asset, ...entry }] })).toBeNull();
    expect(decodeChildMediaManifest({ ...f.manifest, assets: [f.asset, { ...f.asset, assetId: "second" }] })).toBeNull();
  });
  it("rejects malformed/oversized manifest bytes and does not touch the media inventory", async () => {
    for (const bytes of [new Uint8Array([0xc0, 0xaf]), new Uint8Array(512 * 1024 + 1), "approved", { approved: true }]) {
      const f = fixture(); await f.admit(); f.source.load.mockResolvedValueOnce(bytes);
      expect(await f.visit()).toBe(false); expect(f.inventory.read).not.toHaveBeenCalled();
    }
  });
  it("requires an independent current review bound to the exact manifest checksum and challenge identity", async () => {
    for (const answer of [true, { approved: true }, "copied", "expired"] as const) {
      const f = fixture(); await f.admit(); f.review.verify.mockImplementationOnce(async challenge => answer === "copied"
        ? { status: "verified", challenge: { ...challenge }, validUntilEpochMs: f.state.reviewUntil }
        : answer === "expired" ? { status: "verified", challenge, validUntilEpochMs: f.state.time } : answer);
      expect(await f.visit()).toBe(false); expect(f.inventory.read).not.toHaveBeenCalled();
    }
    const f = fixture(); await f.admit(); await f.visit();
    expect(f.review.verify.mock.calls[0][0].manifestChecksum).toBe(hash(f.manifestBytes()));
  });
  it("never treats a package metadata scope as proof for a different active compiled lease", async () => {
    const f = fixture(); await f.admit(); f.state.context = { ...f.state.context!, scope: { ...f.scope, packageChecksum: "c".repeat(64) } };
    (f.manifest as { scope: ChildDataScope }).scope = f.state.context.scope;
    expect(await f.visit()).toBe(false); expect(f.inventory.read).not.toHaveBeenCalled();
  });
  it("rejects every changed scope coordinate before reading bytes", async () => {
    const changes = [{ profileId: "another-child" }, { profileRevision: 2 }, { exactAge: 10 }, { locale: "en" },
      { policyVersion: "another-policy" }, { policyChecksum: "c".repeat(64) }, { packageId: "another-package" },
      { packageVersion: 2 }, { packageChecksum: "d".repeat(64) }];
    for (const change of changes) { const f = fixture(); await f.admit(); (f.manifest as { scope: ChildDataScope }).scope = { ...f.scope, ...change } as ChildDataScope;
      expect(await f.visit()).toBe(false); expect(f.inventory.read).not.toHaveBeenCalled(); }
  });
  it("requires the exact owner and explicit canonical owner→media relationship", async () => {
    const f = fixture(); await f.admit(); f.input.owner = f.home.reference;
    expect(await f.visit()).toBe(false); expect(f.inventory.read).not.toHaveBeenCalled();
    const g = fixture(); await g.admit(); (g.manifest as unknown as { assets: unknown[] }).assets = [{ ...g.asset, owner: g.home.reference }]; g.input.owner = g.home.reference;
    expect(await g.visit()).toBe(false); expect(g.inventory.read).not.toHaveBeenCalled();
  });
  it("requires the separately configured inventory, with no caller or manifest fallback", async () => {
    for (const change of [{ inventoryKey: "unlisted.png" }, { sha256: "c".repeat(64) }, { bytes: 3 }]) {
      const f = fixture(); await f.admit(); (f.manifest as unknown as { assets: unknown[] }).assets = [{ ...f.asset, ...change }];
      expect(await f.visit()).toBe(false); expect(f.inventory.read).not.toHaveBeenCalled();
    }
  });
  it("copies the constructor inventory and ignores later caller mutations", async () => {
    const f = fixture(); await f.admit(); f.inventory.entries[0].sha256 = "e".repeat(64);
    expect(await f.visit()).toBe(true);
  });
  it("requires exact byte length, SHA and self-contained MIME container before delivery", async () => {
    for (const changed of [new Uint8Array([1, 2]), new Uint8Array(png().length), (() => { const value = png(); value[30] ^= 1; return value; })()]) {
      const f = fixture(); await f.admit(); f.inventory.read.mockResolvedValueOnce(changed); const visitor = vi.fn();
      expect(await f.visit(visitor)).toBe(false); expect(visitor).not.toHaveBeenCalled();
    }
    expect(childMediaContainerMatches(wave(), "image/png")).toBe(false);
    expect(childMediaContainerMatches(png(), "audio/wav")).toBe(false);
  });
  it("rechecks the independent media review after the bytes were read", async () => {
    const f = fixture(); await f.admit(); f.review.verify.mockImplementationOnce(async challenge => ({ status: "verified", challenge, validUntilEpochMs: f.state.reviewUntil }));
    f.review.verify.mockResolvedValueOnce({ status: "unavailable" }); const visitor = vi.fn();
    expect(await f.visit(visitor)).toBe(false); expect(f.inventory.read).toHaveBeenCalledTimes(1); expect(visitor).not.toHaveBeenCalled();
  });
  it("does not inherit actual active-index review/rights permission from an eligible owner", async () => {
    const f = fixture(); await f.admit(); f.indexReview.verify.mockResolvedValue({ status: "unavailable" });
    expect(await f.visit()).toBe(false); expect(f.inventory.read).not.toHaveBeenCalled();
  });
});

describe("media lifecycle, exact context and delivery fencing", () => {
  it.each(["retire", "background", "dispose"] as const)("fences a late local read after %s", async action => {
    const f = fixture(); await f.admit(); const late = deferred<unknown>(); f.inventory.read.mockReturnValueOnce(late.promise);
    const visitor = vi.fn(), pending = f.visit(visitor); await settle(); expect(f.inventory.read).toHaveBeenCalledTimes(1);
    f.loader[action](); expect(await pending).toBe(false); late.resolve(f.mediaBytes); await settle(); expect(visitor).not.toHaveBeenCalled();
  });
  it("external cancellation and a newer media request revoke old callbacks and inventory leases", async () => {
    const f = fixture(); await f.admit(); const late = deferred<unknown>(); f.inventory.read.mockReturnValueOnce(late.promise);
    const controller = new AbortController(), visitor = vi.fn(), old = f.visit(visitor, controller.signal); await settle();
    const oldRequest = f.inventory.read.mock.calls[0][0]; controller.abort(); expect(await old).toBe(false); expect(oldRequest.isCurrent()).toBe(false);
    const next = vi.fn(); expect(await f.visit(next)).toBe(true); late.resolve(f.mediaBytes); await settle(); expect(visitor).not.toHaveBeenCalled();
    const secondLate = deferred<unknown>(); f.inventory.read.mockReturnValueOnce(secondLate.promise); const superseded = f.visit(visitor); await settle();
    expect(await f.visit(next)).toBe(true); expect(await superseded).toBe(false); secondLate.resolve(f.mediaBytes); await settle(); expect(visitor).not.toHaveBeenCalled();
  });
  it("denies A→B→A startup generations and changed parent topic rules during a deferred read", async () => {
    for (const change of ["generation", "topics", "locale", "route"] as const) {
      const f = fixture(); await f.admit(); const late = deferred<unknown>(); f.inventory.read.mockReturnValueOnce(late.promise);
      const visitor = vi.fn(), pending = f.visit(visitor); await settle();
      if (change === "generation") f.state.context = { ...f.state.context!, generation: 3 };
      if (change === "topics") f.state.context = { ...f.state.context!, profile: { ...f.state.context!.profile, blockedTopics: ["synthetic-topic"] } };
      if (change === "locale") f.state.context = { ...f.state.context!, request: { ...f.state.context!.request, locale: "en" } };
      if (change === "route") f.state.context = { ...f.state.context!, request: { locale: "ru", route: { kind: "work", entityId: f.work.reference.id } } };
      late.resolve(f.mediaBytes); expect(await pending).toBe(false); expect(visitor).not.toHaveBeenCalled();
    }
  });
  it("checks an elapsed deadline immediately before delivery even without timer dispatch", async () => {
    const f = fixture(); await f.admit(); const late = deferred<unknown>(); f.inventory.read.mockReturnValueOnce(late.promise);
    const visitor = vi.fn(), pending = f.visit(visitor); await settle(); f.state.time += 100; late.resolve(f.mediaBytes);
    expect(await pending).toBe(false); expect(visitor).not.toHaveBeenCalled();
  });
  it("rechecks context and review expiry after synchronous trusted-port callbacks", async () => {
    const f = fixture(); await f.admit(); let change = false;
    const loader = createChildMediaLoader({ ...f.options, isCurrent: captured => {
      const admitted = f.options.isCurrent(captured);
      if (change) f.state.context = { ...f.state.context!, generation: 2 };
      return admitted;
    } });
    f.inventory.read.mockImplementationOnce(async request => { change = true; expect(request.isCurrent()).toBe(false); return f.mediaBytes; });
    const visitor = vi.fn(); expect(await loader.visitMedia(f.input, new AbortController().signal, visitor)).toBe(false);
    expect(visitor).not.toHaveBeenCalled();
    const g = fixture(); await g.admit(); g.state.reviewUntil = initialTime + 2;
    const expiring = createChildMediaLoader({ ...g.options, isCurrent: captured => {
      const admitted = g.options.isCurrent(captured); if (change) g.state.time = initialTime + 2; return admitted;
    } });
    change = false; g.inventory.read.mockImplementationOnce(async request => { change = true; expect(request.isCurrent()).toBe(false); return g.mediaBytes; });
    expect(await expiring.visitMedia(g.input, new AbortController().signal, visitor)).toBe(false); expect(visitor).not.toHaveBeenCalled();
  });
  it("charges no admission from rollback, unknown clocks or expired review/manifest intervals", async () => {
    for (const time of [initialTime - 1, NaN, Infinity, initialTime + 60_000]) {
      const f = fixture(); await f.admit(); expect(await f.visit()).toBe(true); f.state.time = time; const visitor = vi.fn();
      expect(await f.visit(visitor)).toBe(false); expect(visitor).not.toHaveBeenCalled();
    }
    const f = fixture(); await f.admit(); (f.manifest as { validFromEpochMs: number }).validFromEpochMs = initialTime + 1;
    expect(await f.visit()).toBe(false);
  });
  it("settles a hung read at the explicit timeout and consumes its late rejection", async () => {
    vi.useFakeTimers(); const f = fixture(); await f.admit(); const late = deferred<unknown>(); f.inventory.read.mockReturnValueOnce(late.promise);
    const visitor = vi.fn(), pending = f.visit(visitor); await settle(); await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toBe(false); late.reject(new Error("synthetic late rejection")); await settle(); expect(visitor).not.toHaveBeenCalled();
  });
  it("handles synchronous callback retirement and consumes an unexpected async rejection", async () => {
    const f = fixture(); await f.admit(); expect(await f.visit(() => f.loader.retire())).toBe(false);
    expect(await f.visit(async () => { throw new Error("synthetic unexpected async visitor"); })).toBe(false); await settle();
    expect(await f.visit(() => { throw new Error("synthetic sync visitor"); })).toBe(false);
  });
  it("does not let abort-listener reentrancy retire a newer request", async () => {
    const f = fixture(); await f.admit(); const late = deferred<unknown>(); let replacement: Promise<boolean> | null = null;
    f.inventory.read.mockImplementationOnce(async (_request, signal) => { signal.addEventListener("abort", () => { replacement = f.visit(); }, { once: true }); return late.promise; });
    const old = f.visit(); await settle(); f.loader.retire(); expect(await old).toBe(false);
    expect(await replacement).toBe(true); late.resolve(f.mediaBytes); await settle();
  });
  it("rejects truthy host flags, malformed inputs and invalid construction policies", async () => {
    const f = fixture(); await f.admit(); const loader = createChildMediaLoader({ ...f.options, isCurrent: () => "yes" as unknown as boolean });
    expect(await loader.visitMedia(f.input, new AbortController().signal, vi.fn())).toBe(false);
    expect(await f.loader.visitMedia({ ...f.input, approved: true }, new AbortController().signal, vi.fn())).toBe(false);
    for (const edit of [{ timeoutMs: 0 }, { timeoutMs: 2_147_483_648 }, { initialVisibility: undefined }, { inventory: { ...f.inventory, entries: [] } }])
      expect(() => createChildMediaLoader({ ...f.options, ...edit } as ChildMediaOptions)).toThrow(TypeError);
  });
});
