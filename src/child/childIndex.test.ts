import { createHash, webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChildMemoryDataPorts, createVerifiedChildIndex, type ChildIndexPurpose, type ChildReviewChallenge,
  type ChildScopedDataPort, type ChildScopedDataRequest } from "./childIndex";
import { childPayloadBytes, compileChildPackage, copyChildPackageChallenge, createChildWebCryptoDigest,
  type ChildEntityPayload, type ChildEntityReference, type ChildIndexedEntity } from "./childPackage";
import type { ChildAccessInput, ChildEntityKind } from "./childAccessPolicy";
import { createChildStartup, type ChildPackageChallenge, type ChildRouteChallenge } from "./childStartup";
import { childDataNamespace, type ChildDataScope } from "./childDataNamespace";

// All review/profile/time/storage ports and records are explicit synthetic local
// fixtures. Real hashing/compilation/CAS exercise no human approval or OS claim.
const initialTime = Date.parse("2026-10-02T12:00:00.000Z");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
const settle = async () => { for (let index = 0; index < 32; index++) await Promise.resolve(); };

function fixture(locale: "ru" | "en" = "ru") {
  const challenge: ChildPackageChallenge = { generation: 1, request: { locale, route: { kind: "home", entityId: null } },
    selection: { schemaVersion: 1, mode: "child", selectionRevision: 1, profileId: "synthetic-child", profileRevision: 1,
      profileChecksum: "a".repeat(64), policyVersion: "synthetic-policy-v1", policyChecksum: "b".repeat(64) },
    profile: { id: "synthetic-child", label: "Synthetic private nickname", exactAge: 9, ageBand: "9-11", locale,
      ageConfirmedAt: "2026-10-01T00:00:00.000Z", readingLevel: null, allowedTopics: null, blockedTopics: [],
      soundEnabled: false, motion: "calm", narrationEnabled: false } };
  function record(kind: ChildEntityKind, references: readonly ChildEntityReference[] = []) {
    const payload: ChildEntityPayload = { title: `Synthetic ${locale} ${kind}`, text: `Synthetic reviewed ${kind} text`,
      terms: [kind, locale === "ru" ? "синтетический" : "synthetic"], references };
    const checksum = hash(childPayloadBytes(payload));
    const policy: ChildAccessInput["entity"] = { id: `synthetic.${kind}`, kind, sourceVersion: "synthetic-source-v1",
      policyVersion: "synthetic-policy-v1", minAge: 3, maxAge: 17, reviewStatus: "approved", topics: ["synthetic-topic"],
      topicTagsComplete: true, commercialAvailability: "included-in-base", localizedContent: [{ locale, contentChecksum: checksum,
        reviewStatus: "approved", available: true, reviewerId: "synthetic-reviewer", reviewedAt: initialTime - 1000 }],
      rights: { status: "approved", basis: "original", platforms: ["web-pwa"], territories: ["RU"],
        validFrom: initialTime - 10_000, expiresAt: initialTime + 60_000 } };
    return { policy, payload, reference: { kind, id: policy.id, contentChecksum: checksum } as ChildEntityReference };
  }
  const image = record("image"), work = record("work", [image.reference]), writer = record("writer", [work.reference]);
  const home = record("activity", [writer.reference]), search = record("search-result", [work.reference]),
    recent = record("recent", [work.reference]), link = record("deep-link", [work.reference]), offline = record("offline-package", [writer.reference]);
  const records = [image, work, writer, home, search, recent, link, offline];
  const packageValue = { schemaVersion: 1, namespace: "child", packageId: "synthetic-child-package", packageVersion: 1,
    locale, exactAge: 9, policyVersion: "synthetic-policy-v1", policyChecksum: "b".repeat(64),
    validFromEpochMs: initialTime - 1000, validUntilEpochMs: initialTime + 60_000,
    home: home.reference, entities: records.map(row => ({ policy: row.policy, payload: row.payload })) };
  const state = { time: initialTime, host: true, current: challenge, reviewUntil: initialTime + 60_000 };
  const bytes = () => new TextEncoder().encode(JSON.stringify(packageValue));
  const digest = { sha256: vi.fn(async (value: Uint8Array) => hash(value)) };
  const source = { load: vi.fn(async (_startup: ChildPackageChallenge, _signal: AbortSignal): Promise<unknown> => bytes()) };
  const review = { verify: vi.fn(async (proof: ChildReviewChallenge, _signal: AbortSignal): Promise<unknown> =>
    ({ status: "verified", challenge: proof, validUntilEpochMs: state.reviewUntil })) };
  function wrap(port: ChildScopedDataPort) { return { read: vi.fn((request: ChildScopedDataRequest, signal: AbortSignal) => port.read(request, signal)),
    compareAndSet: vi.fn((request: ChildScopedDataRequest, revision: number, value: unknown, signal: AbortSignal) => port.compareAndSet(request, revision, value, signal)) }; }
  const memory = createChildMemoryDataPorts(), ports = {} as Record<ChildIndexPurpose, ReturnType<typeof wrap>>;
  for (const purpose of ["search", "history", "cache", "offline"] as const) ports[purpose] = wrap(memory[purpose]);
  const options = { source, digest, review, ports, isCurrent: (value: ChildPackageChallenge) => state.host && JSON.stringify(value) === JSON.stringify(state.current),
    clock: { nowEpochMs: () => state.time }, timeoutMs: 100, platform: "web-pwa" as const, territory: "RU", initialVisibility: "active" as const };
  const index = createVerifiedChildIndex(options);
  const compile = (value: unknown = bytes()) => compileChildPackage(value, { challenge: state.current, platform: "web-pwa", territory: "RU",
    nowEpochMs: state.time, signal: new AbortController().signal, digest });
  async function admit(value = state.current, signal = new AbortController().signal) {
    const proof = await index.packagePort.verify(value, signal);
    expect(proof).toMatchObject({ status: "verified", challenge: value });
    return proof as { status: "verified"; challenge: ChildPackageChallenge; scope: ChildDataScope; validUntilEpochMs: number };
  }
  return { state, challenge, records, packageValue, bytes, digest, source, review, ports, index, options, compile, admit,
    image: image.reference, work: work.reference, writer: writer.reference, home: home.reference, search: search.reference,
    recent: recent.reference, link: link.reference, offline: offline.reference };
}
afterEach(() => vi.useRealTimers());

describe("strict actual child package compilation", () => {
  it("uses an independent actual WebCrypto SHA-256 known vector", async () => {
    const digest = createChildWebCryptoDigest(webcrypto.subtle as unknown as SubtleCrypto);
    expect(await digest.sha256(new TextEncoder().encode("abc")))
      .toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it.each(["ru", "en"] as const)("compiles exact %s payload bytes and immutable scope with independent entity digests", async locale => {
    const f = fixture(locale), result = await f.compile();
    expect(result?.scope).toMatchObject({ namespace: "child", exactAge: 9, locale, packageChecksum: hash(f.bytes()) });
    expect(result?.entities).toHaveLength(8); expect(result?.home).toEqual(f.home);
    expect(Object.isFrozen(result?.entities[0].policy.rights.platforms)).toBe(true);
    f.packageValue.entities[0].payload = { ...f.packageValue.entities[0].payload, title: "Changed synthetic input" };
    expect(result?.entities[0].payload.title).toBe(`Synthetic ${locale} image`);
  });
  it("rejects adult/newer/mismatched package coordinates and uncertain validity before indexing", async () => {
    const f = fixture();
    const edits = [{ namespace: "adult" }, { schemaVersion: 2 }, { exactAge: 10 }, { locale: "en" },
      { policyChecksum: "c".repeat(64) }, { validFromEpochMs: initialTime + 1 }, { validUntilEpochMs: initialTime }];
    for (const edit of edits) expect(await f.compile(new TextEncoder().encode(JSON.stringify({ ...f.packageValue, ...edit })))).toBeNull();
  });
  it("rejects malformed UTF-8, oversized bytes, strings and copied approval objects", async () => {
    const f = fixture();
    for (const input of [new Uint8Array([0xc0, 0xaf]), new Uint8Array(8 * 1024 * 1024 + 1), "approved", { approved: true }, new Uint8Array()])
      expect(await f.compile(input)).toBeNull();
  });
  it("does not unlock an older work merely because its writer is eligible", async () => {
    const f = fixture(); f.packageValue.entities[1].policy = { ...f.packageValue.entities[1].policy, minAge: 10 };
    expect(await f.compile()).toBeNull();
  });
  it("binds reviewed payload digests and all reference kinds/IDs/checksums before any index", async () => {
    const mutations = [
      (f: ReturnType<typeof fixture>) => { f.packageValue.entities[1].payload = { ...f.packageValue.entities[1].payload, title: "Unreviewed synthetic title" }; },
      (f: ReturnType<typeof fixture>) => { f.packageValue.entities.push(clone(f.packageValue.entities[1])); },
      (f: ReturnType<typeof fixture>) => { f.packageValue.entities = f.packageValue.entities.filter(row => row.policy.kind !== "image"); },
      (f: ReturnType<typeof fixture>) => { f.packageValue.home = { ...f.home, contentChecksum: "d".repeat(64) }; },
      (f: ReturnType<typeof fixture>) => { f.packageValue.entities[1].policy = { ...f.packageValue.entities[1].policy,
        localizedContent: [{ ...f.packageValue.entities[1].policy.localizedContent[0], locale: "en" }] }; },
    ];
    for (const mutate of mutations) { const f = fixture(); mutate(f); expect(await f.compile()).toBeNull(); }
  });
  it("rejects current review/topic/rights/commercial failures on a referenced image, not only top-level works", async () => {
    for (const failure of ["review", "topic", "rights", "expired", "territory", "optional"] as const) {
      const f = fixture(), image = f.packageValue.entities[0];
      if (failure === "review") image.policy = { ...image.policy, reviewStatus: "not-reviewed" };
      if (failure === "topic") f.state.current = { ...f.challenge, profile: { ...f.challenge.profile, blockedTopics: ["synthetic-topic"] } };
      if (failure === "rights") image.policy = { ...image.policy, rights: { ...image.policy.rights, basis: "licensed" } };
      if (failure === "expired") image.policy = { ...image.policy, rights: { ...image.policy.rights, expiresAt: initialTime } };
      if (failure === "territory") image.policy = { ...image.policy, rights: { ...image.policy.rights, territories: ["GB"] } };
      if (failure === "optional") image.policy = { ...image.policy, commercialAvailability: "optional" };
      expect(await f.compile(), failure).toBeNull();
    }
  });
  it("snapshots the authenticated profile before an awaited digest and refuses getter authority", async () => {
    const f = fixture(), late = deferred<string>(); f.digest.sha256.mockImplementationOnce(() => late.promise);
    const compiling = f.compile(); (f.challenge.profile as { exactAge: number }).exactAge = 11;
    late.resolve(hash(f.bytes())); const result = await compiling;
    expect(result?.scope.exactAge).toBe(9);
    const getter = vi.fn(() => f.challenge.selection);
    expect(copyChildPackageChallenge({ ...f.challenge, get selection() { return getter(); } }, initialTime)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });
});

describe("actual verified child index and distinct scoped data ports", () => {
  it("supplies real compilation and route admission to the existing sealed startup with explicit synthetic protected ports", async () => {
    const f = fixture(), startup = createChildStartup({ clock: f.options.clock, timeoutMs: 100, initialVisibility: "active",
      secureModePort: { async restore(challenge) { return { status: "restored", challenge, selection: clone(f.challenge.selection) }; } },
      profilePort: { async restore(challenge) { return { status: "restored", challenge, registry: { schemaVersion: 1,
        policyVersion: f.challenge.selection.policyVersion, activeProfileId: f.challenge.profile.id, profiles: [clone(f.challenge.profile)] } }; } },
      policyPort: { async verify(challenge) { return { status: "verified", challenge }; } },
      packagePort: f.index.packagePort, routePort: f.index.routePort });
    expect(await startup.start(f.challenge.request)).toEqual({ status: "ready" });
    const visitor = vi.fn(); expect(await f.index.visitSearch("синтетический", visitor)).toBe(true); expect(visitor.mock.calls[0][0]).toHaveLength(1);
    startup.background(); f.index.background(); expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    expect(await f.index.visitEntity(f.work, vi.fn())).toBe(false);
  });
  it("keeps every operation sealed before admission and reports no private profile in snapshots", async () => {
    const f = fixture(), visit = vi.fn();
    expect(await f.index.visitEntity(f.work, visit)).toBe(false); expect(await f.index.visitSearch("", visit)).toBe(false);
    expect(await f.index.rememberRecent(f.recent)).toBe(false); expect(await f.index.downloadOffline(f.offline)).toBe(false);
    expect(f.source.load).not.toHaveBeenCalled(); expect(f.review.verify).not.toHaveBeenCalled();
    expect(f.index.getSnapshot()).toEqual({ phase: "sealed" }); expect(JSON.stringify(f.index.getSnapshot())).not.toContain("nickname");
  });
  it("requires an independent exact current review challenge, not signatures, booleans or copied challenges", async () => {
    for (const answer of [true, { approved: true }, "verified", "copied"] as const) {
      const f = fixture(); f.review.verify.mockImplementationOnce(async proof => answer === "copied"
        ? { status: "verified", challenge: { ...proof }, validUntilEpochMs: f.state.reviewUntil } : answer);
      expect(await f.index.packagePort.verify(f.challenge, new AbortController().signal)).toMatchObject({ status: "unavailable" });
      expect(f.index.getSnapshot()).toEqual({ phase: "sealed" }); expect(f.ports.search.compareAndSet).not.toHaveBeenCalled();
    }
  });
  it("searches only reviewed search-result entries, exposes canonical IDs and calls distinct child namespaces", async () => {
    const f = fixture(), proof = await f.admit(), visitor = vi.fn();
    expect(await f.index.visitSearch("СИНТЕТИЧЕСКИЙ", visitor)).toBe(true);
    expect(visitor.mock.calls[0][0].map((row: ChildIndexedEntity) => row.reference)).toEqual([f.search]);
    expect(f.review.verify).toHaveBeenCalledTimes(2);
    expect(f.ports.search.read.mock.calls.every(([request]) => request.key === childDataNamespace(proof.scope, "search"))).toBe(true);
    expect(f.ports.history.read).not.toHaveBeenCalled(); expect(f.ports.offline.read).not.toHaveBeenCalled();
    expect(f.ports.search.compareAndSet.mock.calls[0][0].lease).toEqual({});
  });
  it("requires separate deep-link approval and never resolves an adult or wrong-kind route", async () => {
    const f = fixture(); const proof = await f.admit();
    const route = { ...f.challenge, scope: proof.scope, validUntilEpochMs: proof.validUntilEpochMs } as ChildRouteChallenge;
    expect(await f.index.routePort.verify(route, new AbortController().signal)).toMatchObject({ status: "verified", challenge: route });
    f.index.retire();
    f.state.current = { ...f.challenge, request: { locale: "ru", route: { kind: "work", entityId: f.work.id } } };
    const second = await f.admit();
    const workRoute: ChildRouteChallenge = { ...f.state.current, scope: second.scope, validUntilEpochMs: second.validUntilEpochMs };
    expect(await f.index.routePort.verify(workRoute, new AbortController().signal)).toMatchObject({ status: "verified" });
    const wrongRoute = { ...workRoute, request: { locale: "ru", route: { kind: "writer", entityId: f.work.id } } };
    expect(await f.index.routePort.verify(wrongRoute as ChildRouteChallenge, new AbortController().signal)).toMatchObject({ status: "unavailable" });
    f.packageValue.entities = f.packageValue.entities.filter(row => row.policy.kind !== "deep-link");
    const third = await f.admit();
    expect(await f.index.routePort.verify({ ...workRoute, scope: third.scope, validUntilEpochMs: third.validUntilEpochMs }, new AbortController().signal))
      .toMatchObject({ status: "unavailable" });
  });
  it("persists only a separately approved recent entry and ignores adult/other-scope history without fallback", async () => {
    const f = fixture(), proof = await f.admit(), visitor = vi.fn();
    expect(await f.index.rememberRecent(f.work)).toBe(false); expect(await f.index.rememberRecent(f.recent)).toBe(true);
    expect(await f.index.visitHistory(visitor)).toBe(true); expect(visitor.mock.calls[0][0][0].reference).toEqual(f.recent);
    expect(f.ports.history.read.mock.calls.every(([request]) => request.key === childDataNamespace(proof.scope, "history"))).toBe(true);
    f.ports.history.read.mockResolvedValueOnce({ revision: 1, value: { schemaVersion: 1, scope: { ...proof.scope, profileId: "other-child" }, references: [f.recent] } });
    const forbidden = vi.fn(); expect(await f.index.visitHistory(forbidden)).toBe(false); expect(forbidden).not.toHaveBeenCalled();
    expect(f.index.getSnapshot()).toEqual({ phase: "sealed" });
  });
  it("downloads and reads the whole approved transitive offline graph through the separate offline port", async () => {
    const f = fixture(), proof = await f.admit(), visitor = vi.fn();
    expect(await f.index.downloadOffline(f.offline)).toBe(true); expect(await f.index.visitOffline(f.offline, visitor)).toBe(true);
    expect(visitor.mock.calls[0][0].map((row: ChildIndexedEntity) => row.reference.kind)).toEqual(["offline-package", "writer", "work", "image"]);
    expect(f.ports.offline.read.mock.calls.every(([request]) => request.key.startsWith(childDataNamespace(proof.scope, "offline")! + "/item/"))).toBe(true);
    expect(f.ports.cache.read).not.toHaveBeenCalled();
  });
  it("rejects altered cache payloads and non-data getters without executing them", async () => {
    const f = fixture(), proof = await f.admit(), visitor = vi.fn(), getter = vi.fn(() => "Adult fallback");
    expect(await f.index.cache(f.work)).toBe(true);
    const bad = { title: "Synthetic ru work", get text() { return getter(); }, terms: ["work"], references: [f.image] };
    f.ports.cache.read.mockResolvedValueOnce({ revision: 1, value: { schemaVersion: 1, scope: proof.scope,
      entries: [{ reference: f.work, payload: bad }, { reference: f.image, payload: f.records[0].payload }] } });
    expect(await f.index.visitCache(f.work, visitor)).toBe(false); expect(visitor).not.toHaveBeenCalled(); expect(getter).not.toHaveBeenCalled();
  });
  it("validates every cached search reference instead of filtering a corrupt/adult answer", async () => {
    const f = fixture(), proof = await f.admit(), visitor = vi.fn();
    f.ports.search.read.mockResolvedValueOnce({ revision: 2, value: { schemaVersion: 1, scope: proof.scope,
      references: [f.search, { kind: "work", id: "adult.work", contentChecksum: "d".repeat(64) }] } });
    expect(await f.index.visitSearch("", visitor)).toBe(false); expect(visitor).not.toHaveBeenCalled();
    expect(f.index.getSnapshot()).toEqual({ phase: "sealed" });
  });
  it("rereads exact current rights review before every lookup and refuses revocation or exclusive expiry", async () => {
    const f = fixture(), visitor = vi.fn(); await f.admit();
    f.review.verify.mockResolvedValueOnce({ status: "revoked" });
    expect(await f.index.visitEntity(f.work, visitor)).toBe(false); expect(visitor).not.toHaveBeenCalled();
    await f.admit(); f.state.time = initialTime + 60_000;
    expect(await f.index.visitEntity(f.work, visitor)).toBe(false); expect(f.index.getSnapshot()).toEqual({ phase: "sealed" });
  });
  it("refuses a mutated route challenge after awaited review rather than echoing a proof for the changed target", async () => {
    const f = fixture(), admitted = await f.admit(), late = deferred<unknown>();
    const route: ChildRouteChallenge = { ...clone(f.challenge), scope: admitted.scope, validUntilEpochMs: admitted.validUntilEpochMs };
    f.review.verify.mockImplementationOnce(() => late.promise);
    const pending = f.index.routePort.verify(route, new AbortController().signal); await settle();
    (route as { request: ChildPackageChallenge["request"] }).request = { locale: "ru", route: { kind: "work", entityId: f.work.id } };
    const proof = f.review.verify.mock.calls[f.review.verify.mock.calls.length - 1][0];
    late.resolve({ status: "verified", challenge: proof, validUntilEpochMs: f.state.reviewUntil });
    expect(await pending).toMatchObject({ status: "unavailable", challenge: route });
  });
  it("consumes rejected async visitor returns and denies their unbounded content execution", async () => {
    const f = fixture(); await f.admit();
    expect(await f.index.visitEntity(f.work, async () => { throw new Error("Synthetic private callback rejection"); })).toBe(false);
    await settle(); expect(f.index.getSnapshot()).toEqual({ phase: "sealed" });
  });
  it("retires all old query/history/cache/offline admission on profile, locale, policy and package scope changes", async () => {
    for (const dimension of ["profile", "locale", "policy", "package"] as const) {
      const f = fixture(), visitor = vi.fn(); await f.admit();
      if (dimension === "profile") f.state.current = { ...f.challenge, selection: { ...f.challenge.selection, profileRevision: 2 } };
      if (dimension === "locale") f.state.current = { ...f.challenge, request: { ...f.challenge.request, locale: "en" } };
      if (dimension === "policy") f.state.current = { ...f.challenge, selection: { ...f.challenge.selection, policyChecksum: "c".repeat(64) } };
      if (dimension === "package") { f.packageValue.packageVersion = 2; f.index.retire(); }
      expect(await f.index.visitEntity(f.work, visitor), dimension).toBe(false); expect(await f.index.visitSearch("", visitor)).toBe(false);
      expect(await f.index.visitHistory(visitor)).toBe(false); expect(await f.index.visitCache(f.work, visitor)).toBe(false);
      expect(await f.index.visitOffline(f.offline, visitor)).toBe(false); expect(visitor).not.toHaveBeenCalled();
    }
  });
});

describe("child index synchronous host-callback validity", () => {
  it.each(["source", "review"] as const)("settles a hung %s at the original timer deadline after pre-scheduling host work", async phase => {
    vi.useFakeTimers(); vi.setSystemTime(initialTime);
    const f = fixture(), late = deferred<unknown>();
    let outsideInspection = true, consume = true, outcome: unknown;
    if (phase === "source") f.source.load.mockImplementationOnce(() => late.promise);
    else f.review.verify.mockImplementationOnce(() => late.promise);
    const index = createVerifiedChildIndex({ ...f.options, clock: { nowEpochMs: () => Date.now() }, isCurrent: captured => {
      const admitted = f.options.isCurrent(captured);
      // The first inspection precedes the bounded operation. Spend time in
      // its subsequent pre-scheduling host inspection without restarting it.
      if (outsideInspection) outsideInspection = false;
      else if (consume) { consume = false; vi.advanceTimersByTime(40); }
      return admitted;
    } });
    const pending = index.packagePort.verify(f.challenge, new AbortController().signal);
    void pending.then(value => { outcome = value; });
    await settle();
    expect(Date.now()).toBe(initialTime + 40);
    expect(f.source.load).toHaveBeenCalledTimes(1);
    expect(f.review.verify).toHaveBeenCalledTimes(phase === "source" ? 0 : 1);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(59);
    expect(Date.now()).toBe(initialTime + 99); expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(Date.now()).toBe(initialTime + 100);
    expect(await pending).toEqual({ status: "unavailable", challenge: f.challenge });
    expect(outcome).toEqual({ status: "unavailable", challenge: f.challenge });
    late.reject(new Error("synthetic-late-original-deadline")); await settle();
    expect(index.getSnapshot()).toEqual({ phase: "sealed" }); index.dispose();
  });

  it.each(["package", "review"] as const)("seals getSnapshot when host inspection consumes exclusive %s validity", async boundary => {
    const f = fixture(); if (boundary === "review") f.state.reviewUntil = initialTime + 2;
    let consume = false, limit = 0;
    const index = createVerifiedChildIndex({ ...f.options, isCurrent: captured => {
      const admitted = f.options.isCurrent(captured);
      if (consume) { consume = false; f.state.time = limit; }
      return admitted;
    } });
    const proof = await index.packagePort.verify(f.challenge, new AbortController().signal);
    expect(proof).toMatchObject({ status: "verified" });
    limit = (proof as { validUntilEpochMs: number }).validUntilEpochMs; consume = true;
    expect(index.getSnapshot()).toEqual({ phase: "sealed" });
    index.dispose();
  });

  it.each(["review", "operation"] as const)("denies scoped commit authority if its final host callback consumes %s validity", async boundary => {
    const f = fixture(); let consume = false, observedCurrent: boolean | undefined;
    const index = createVerifiedChildIndex({ ...f.options, isCurrent: captured => {
      const admitted = f.options.isCurrent(captured);
      if (consume) { consume = false; f.state.time = boundary === "review" ? f.state.reviewUntil : initialTime + 100; }
      return admitted;
    } });
    expect(await index.packagePort.verify(f.challenge, new AbortController().signal)).toMatchObject({ status: "verified" });
    f.ports.history.read.mockImplementationOnce(async request => {
      consume = true; observedCurrent = request.isCurrent(); return { revision: 0, value: null };
    });
    const visitor = vi.fn();
    expect(await index.visitHistory(visitor)).toBe(false);
    expect(observedCurrent).toBe(false);
    expect(visitor).not.toHaveBeenCalled();
    expect(index.getSnapshot()).toEqual({ phase: "sealed" });
    index.dispose();
  });

  it.each(["review", "operation"] as const)("never hands content to a visitor after synchronous host work exhausts %s validity", async boundary => {
    let deliveries = 0;
    // Sweep the available budget, without depending on a fixed host-call count.
    for (let budget = 1; budget <= 16; budget++) {
      const f = fixture(); if (boundary === "review") f.state.reviewUntil = initialTime + budget;
      let consuming = false, firstObservedAt: number | null = null, observedAt: number | null = null;
      const index = createVerifiedChildIndex({ ...f.options, timeoutMs: boundary === "operation" ? budget : 100,
        isCurrent: captured => {
          const admitted = f.options.isCurrent(captured);
          if (consuming) { f.state.time++; if (firstObservedAt === null) firstObservedAt = f.state.time; }
          return admitted;
        } });
      expect(await index.packagePort.verify(f.challenge, new AbortController().signal)).toMatchObject({ status: "verified" });
      consuming = true;
      const visitor = vi.fn(() => { observedAt = f.state.time; });
      await index.visitEntity(f.work, visitor);
      if (visitor.mock.calls.length) {
        deliveries++;
        const limit = boundary === "review" ? f.state.reviewUntil : firstObservedAt! + budget;
        expect(observedAt, boundary + " remaining budget " + budget).toBeLessThan(limit);
      }
      consuming = false; index.dispose();
    }
    expect(deliveries).toBeGreaterThan(0);
  });

  it.each(["rollback", "throw"] as const)("seals a clock that fails after host inspection by %s", async failure => {
    const f = fixture(); let arm = false, failClock = false;
    const index = createVerifiedChildIndex({ ...f.options, clock: { nowEpochMs() {
      if (failClock) throw new Error("synthetic-post-host-clock-detail"); return f.state.time;
    } }, isCurrent: captured => {
      const admitted = f.options.isCurrent(captured);
      if (arm) { arm = false; if (failure === "rollback") f.state.time--; else failClock = true; }
      return admitted;
    } });
    expect(await index.packagePort.verify(f.challenge, new AbortController().signal)).toMatchObject({ status: "verified" });
    arm = true; expect(index.getSnapshot()).toEqual({ phase: "sealed" });
    failClock = false; f.state.time = initialTime;
    expect(await index.packagePort.verify(f.challenge, new AbortController().signal)).toMatchObject({ status: "unavailable" });
    index.dispose();
  });

  it("preserves a newer admission reentered by the post-host clock", async () => {
    const f = fixture(); let arm = false, reenter = false, replacement: Promise<unknown> | null = null;
    const index = createVerifiedChildIndex({ ...f.options, clock: { nowEpochMs() {
      if (reenter) {
        reenter = false; f.state.current = { ...f.challenge, generation: 2 };
        replacement = index.packagePort.verify(f.state.current, new AbortController().signal);
      }
      return f.state.time;
    } }, isCurrent: captured => {
      const admitted = f.options.isCurrent(captured);
      if (arm) { arm = false; reenter = true; }
      return admitted;
    } });
    expect(await index.packagePort.verify(f.challenge, new AbortController().signal)).toMatchObject({ status: "verified" });
    arm = true; expect(index.getSnapshot()).toEqual({ phase: "loading" });
    expect(replacement).not.toBeNull(); expect(await replacement).toMatchObject({ status: "verified" });
    expect(index.getSnapshot()).toEqual({ phase: "ready" }); index.dispose();
  });

  it("preserves a newer admission reentered directly by host inspection", async () => {
    const f = fixture(); let arm = false, replacement: Promise<unknown> | null = null;
    const index = createVerifiedChildIndex({ ...f.options, isCurrent: captured => {
      const admitted = f.options.isCurrent(captured);
      if (arm) {
        arm = false; f.state.current = { ...f.challenge, generation: 2 };
        replacement = index.packagePort.verify(f.state.current, new AbortController().signal);
      }
      return admitted;
    } });
    expect(await index.packagePort.verify(f.challenge, new AbortController().signal)).toMatchObject({ status: "verified" });
    arm = true; expect(index.getSnapshot()).toEqual({ phase: "loading" });
    expect(await replacement).toMatchObject({ status: "verified" });
    expect(index.getSnapshot()).toEqual({ phase: "ready" }); index.dispose();
  });

  it("retains readiness when synchronous host work stays within the original validity", async () => {
    const f = fixture(); let consume = false;
    const index = createVerifiedChildIndex({ ...f.options, isCurrent: captured => {
      const admitted = f.options.isCurrent(captured); if (consume) f.state.time++; return admitted;
    } });
    expect(await index.packagePort.verify(f.challenge, new AbortController().signal)).toMatchObject({ status: "verified" });
    consume = true; expect(index.getSnapshot()).toEqual({ phase: "ready" });
    const visitor = vi.fn(); expect(await index.visitEntity(f.work, visitor)).toBe(true);
    expect(visitor).toHaveBeenCalledOnce(); index.dispose();
  });
});

describe("child scope generation, cancellation, bounded time and CAS races", () => {
  it("latches background without source I/O and requires explicit foreground plus fresh admission", async () => {
    const f = fixture(); await f.admit(); f.index.background(); const loads = f.source.load.mock.calls.length;
    expect(await f.index.packagePort.verify(f.challenge, new AbortController().signal)).toMatchObject({ status: "unavailable" });
    expect(f.source.load).toHaveBeenCalledTimes(loads); f.index.foreground(); await f.admit();
    expect(f.index.getSnapshot()).toEqual({ phase: "ready" });
  });
  it("seals before a host visibility/profile inspection can reenter another admission", async () => {
    const f = fixture(), late = deferred<unknown>(); f.source.load.mockImplementationOnce(() => late.promise);
    const first = f.index.packagePort.verify(f.challenge, new AbortController().signal); await settle();
    expect(f.index.getSnapshot()).toEqual({ phase: "loading" }); f.index.background(); f.index.foreground();
    await f.admit(); late.resolve(f.bytes()); expect(await first).toMatchObject({ status: "unavailable" });
    expect(f.index.getSnapshot()).toEqual({ phase: "ready" });
  });
  it("rejects original late proof after equal-value A→B→A without sealing the final A", async () => {
    const f = fixture(), old = deferred<unknown>(); f.source.load.mockImplementationOnce(() => old.promise);
    const first = f.index.packagePort.verify(f.challenge, new AbortController().signal); await settle();
    f.state.current = { ...f.challenge, generation: 2 }; await f.admit(); f.state.current = f.challenge; await f.admit();
    old.resolve(f.bytes()); expect(await first).toMatchObject({ status: "unavailable" });
    const visitor = vi.fn(); expect(await f.index.visitEntity(f.work, visitor)).toBe(true); expect(visitor).toHaveBeenCalledOnce();
  });
  it("consumes an old rejected port after newer ready without an unhandled rejection or retirement", async () => {
    const f = fixture(), old = deferred<unknown>(); f.source.load.mockImplementationOnce(() => old.promise);
    const first = f.index.packagePort.verify(f.challenge, new AbortController().signal); await settle();
    await f.admit(); old.reject(new Error("SYNTHETIC PRIVATE DIAGNOSTIC")); await settle();
    expect(await first).toMatchObject({ status: "unavailable" }); expect(f.index.getSnapshot()).toEqual({ phase: "ready" });
  });
  it("does not cancel a newer admission reentered by a synchronous old-port abort listener", async () => {
    const f = fixture(), old = deferred<unknown>(); let replacement: Promise<unknown> | null = null;
    f.source.load.mockImplementationOnce(async (_challenge, signal) => {
      signal.addEventListener("abort", () => { f.state.current = { ...f.challenge, generation: 2 };
        replacement = f.index.packagePort.verify(f.state.current, new AbortController().signal); }, { once: true });
      return old.promise;
    });
    const first = f.index.packagePort.verify(f.challenge, new AbortController().signal); await settle();
    expect(await f.index.packagePort.verify(f.challenge, new AbortController().signal)).toMatchObject({ status: "unavailable" });
    expect(replacement).not.toBeNull(); expect(await replacement).toMatchObject({ status: "verified" });
    old.reject(new Error("Synthetic superseded source")); expect(await first).toMatchObject({ status: "unavailable" }); await settle();
    expect(f.index.getSnapshot()).toEqual({ phase: "ready" });
  });
  it("external abort seals pending compilation and cannot publish a late review answer", async () => {
    const f = fixture(), old = deferred<unknown>(), controller = new AbortController(); f.review.verify.mockImplementationOnce(() => old.promise);
    const admission = f.index.packagePort.verify(f.challenge, controller.signal); await settle(); controller.abort();
    expect(await admission).toMatchObject({ status: "unavailable" });
    const proof = f.review.verify.mock.calls[0][0]; old.resolve({ status: "verified", challenge: proof, validUntilEpochMs: f.state.reviewUntil }); await settle();
    expect(f.index.getSnapshot()).toEqual({ phase: "sealed" }); expect(f.ports.search.compareAndSet).not.toHaveBeenCalled();
  });
  it("bounds hung loading, verification and scoped reads with no late content callback", async () => {
    for (const phase of ["source", "review", "history"] as const) {
      vi.useFakeTimers(); const f = fixture(), old = deferred<unknown>(), visitor = vi.fn();
      if (phase === "history") await f.admit();
      if (phase === "source") f.source.load.mockImplementationOnce(() => old.promise);
      if (phase === "review") f.review.verify.mockImplementationOnce(() => old.promise);
      if (phase === "history") f.ports.history.read.mockImplementationOnce(() => old.promise);
      const pending = phase === "history" ? f.index.visitHistory(visitor) : f.index.packagePort.verify(f.challenge, new AbortController().signal);
      await settle(); await vi.advanceTimersByTimeAsync(100);
      expect(await pending).toEqual(phase === "history" ? false : { status: "unavailable", challenge: f.challenge });
      old.reject(new Error("Synthetic late failure")); await settle(); expect(visitor).not.toHaveBeenCalled();
      expect(f.index.getSnapshot()).toEqual({ phase: "sealed" }); f.index.dispose(); vi.useRealTimers();
    }
  });
  it("enforces elapsed trusted deadlines even when operational timers have not fired", async () => {
    vi.useFakeTimers(); const f = fixture(), old = deferred<unknown>(); f.source.load.mockImplementationOnce(() => old.promise);
    const pending = f.index.packagePort.verify(f.challenge, new AbortController().signal); await settle();
    f.state.time += 100; old.resolve(f.bytes()); expect(await pending).toMatchObject({ status: "unavailable" });
    expect(f.ports.search.compareAndSet).not.toHaveBeenCalled(); expect(f.index.getSnapshot()).toEqual({ phase: "sealed" });
  });
  it("never hands content to a visitor after a delayed scoped read crosses its trusted deadline without timer delivery", async () => {
    for (const purpose of ["search", "history", "cache", "offline"] as const) {
      vi.useFakeTimers(); const f = fixture(), visitor = vi.fn(); await f.admit();
      if (purpose === "history") expect(await f.index.rememberRecent(f.recent)).toBe(true);
      if (purpose === "cache") expect(await f.index.cache(f.work)).toBe(true);
      if (purpose === "offline") expect(await f.index.downloadOffline(f.offline)).toBe(true);
      const realRead = f.ports[purpose].read.getMockImplementation()!, delayed = deferred<unknown>();
      f.ports[purpose].read.mockImplementationOnce(async (request, signal) => {
        const result = await realRead(request, signal); await delayed.promise; return result;
      });
      const pending = purpose === "search" ? f.index.visitSearch("", visitor) : purpose === "history" ? f.index.visitHistory(visitor)
        : purpose === "cache" ? f.index.visitCache(f.work, visitor) : f.index.visitOffline(f.offline, visitor);
      await settle(); f.state.time += 100; delayed.resolve(null);
      expect(await pending, purpose).toBe(false); expect(visitor).not.toHaveBeenCalled();
      expect(f.index.getSnapshot()).toEqual({ phase: "sealed" }); f.index.dispose(); vi.useRealTimers();
    }
  });
  it("permanently seals clock rollback/uncertainty rather than extending previous rights", async () => {
    for (const time of [initialTime - 1, NaN]) {
      const f = fixture(); await f.admit(); f.state.time = time;
      expect(await f.index.visitEntity(f.work, vi.fn())).toBe(false); f.state.time = initialTime;
      expect(await f.index.packagePort.verify(f.challenge, new AbortController().signal)).toMatchObject({ status: "unavailable" });
    }
  });
  it("does not commit a late scoped CAS after retirement, including a same-value new admission", async () => {
    const f = fixture(), deferredCommit = deferred<void>(); await f.admit();
    const realCommit = f.ports.history.compareAndSet.getMockImplementation()!;
    f.ports.history.compareAndSet.mockImplementationOnce(async (request, revision, value, signal) => {
      await deferredCommit.promise; return realCommit(request, revision, value, signal);
    });
    const old = f.index.rememberRecent(f.recent); await settle(); await f.admit(); deferredCommit.resolve();
    expect(await old).toBe(false); const visitor = vi.fn(); expect(await f.index.visitHistory(visitor)).toBe(true);
    expect(visitor.mock.calls[0][0]).toEqual([]); expect(f.index.getSnapshot()).toEqual({ phase: "ready" });
  });
  it("merges concurrent owned history intentions with CAS while keeping independent cache/offline slots", async () => {
    const f = fixture(); await f.admit();
    expect(await Promise.all([f.index.rememberRecent(f.recent), f.index.rememberRecent(f.recent)])).toEqual([true, true]);
    expect(await f.index.cache(f.work)).toBe(true); expect(await f.index.downloadOffline(f.offline)).toBe(true);
    const history = vi.fn(), cache = vi.fn(); expect(await f.index.visitHistory(history)).toBe(true); expect(await f.index.visitCache(f.work, cache)).toBe(true);
    expect(history.mock.calls[0][0]).toHaveLength(1); expect(cache.mock.calls[0][0].map((row: ChildIndexedEntity) => row.reference.kind)).toEqual(["work", "image"]);
  });
  it("never publishes a stale read after host retirement during a synchronous data descriptor inspection", async () => {
    const f = fixture(), visitor = vi.fn(); await f.admit();
    const target = { revision: 1, value: null };
    f.ports.history.read.mockResolvedValueOnce(new Proxy(target, { ownKeys(value) { f.index.retire(); return Reflect.ownKeys(value); } }));
    expect(await f.index.visitHistory(visitor)).toBe(false); expect(visitor).not.toHaveBeenCalled();
  });
  it("rejects mutable startup input before publishing an otherwise valid package", async () => {
    const f = fixture(), old = deferred<unknown>(); f.source.load.mockImplementationOnce(() => old.promise);
    const pending = f.index.packagePort.verify(f.challenge, new AbortController().signal); await settle();
    (f.challenge.selection as { profileChecksum: string }).profileChecksum = "c".repeat(64);
    old.resolve(f.bytes()); expect(await pending).toMatchObject({ status: "unavailable" }); expect(f.index.getSnapshot()).toEqual({ phase: "sealed" });
  });
  it("dispose seals every capability and consumes late results without profile diagnostics", async () => {
    const f = fixture(), old = deferred<unknown>(); f.source.load.mockImplementationOnce(() => old.promise);
    const pending = f.index.packagePort.verify(f.challenge, new AbortController().signal); await settle(); f.index.dispose();
    old.reject(new Error("Synthetic private nickname")); expect(await pending).toMatchObject({ status: "unavailable" }); await settle();
    expect(f.index.getSnapshot()).toEqual({ phase: "disposed" }); expect(JSON.stringify(f.index.getSnapshot())).not.toContain("nickname");
    expect(await f.index.visitSearch("", vi.fn())).toBe(false);
  });
});
