import { describe, expect, it, vi } from "vitest";
import { createChildStartup, type ChildPackageChallenge, type ChildRouteChallenge, type ChildSecureSelection,
  type ChildSelectionChallenge, type ChildStartupChallenge, type ChildStartupOptions, type ChildStartupRequest } from "./childStartup";
import type { ChildDataScope } from "./childDataNamespace";

// Trusted synthetic port projections only. They prove no OS restoration,
// actual reviewed package, native storage, human approval or rendered isolation.
const initialTime = Date.parse("2026-10-02T12:00:00.000Z");
const checksum = (character: string) => character.repeat(64);
const intent = (locale: "ru" | "en" = "ru"): ChildStartupRequest => ({ locale, route: { kind: "home", entityId: null } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function fixture(locale: "ru" | "en" = "ru") {
  const state = {
    time: initialTime,
    validUntil: initialTime + 60_000,
    selection: { schemaVersion: 1, mode: "child", selectionRevision: 1, profileId: "synthetic-child-one", profileRevision: 1,
      profileChecksum: checksum("a"), policyVersion: "synthetic-policy-v1", policyChecksum: checksum("b") } as ChildSecureSelection,
    registry: { schemaVersion: 1, policyVersion: "synthetic-policy-v1", activeProfileId: "synthetic-child-one", profiles: [{
      id: "synthetic-child-one", label: "Synthetic Reader", exactAge: 9, locale,
      ageConfirmedAt: "2026-10-01T12:00:00.000Z", readingLevel: null, allowedTopics: null, blockedTopics: ["violence"],
      soundEnabled: false, motion: "calm", narrationEnabled: false,
    }] },
    scope: { schemaVersion: 1, namespace: "child", profileId: "synthetic-child-one", profileRevision: 1, exactAge: 9, locale,
      policyVersion: "synthetic-policy-v1", policyChecksum: checksum("b"), packageId: "synthetic-child-only-package",
      packageVersion: 1, packageChecksum: checksum("c") } as ChildDataScope,
  };
  const calls: string[] = [];
  const mode = vi.fn(async (challenge: ChildStartupChallenge, _signal: AbortSignal): Promise<unknown> => {
    calls.push("mode"); return { status: "restored", challenge, selection: clone(state.selection) };
  });
  const profile = vi.fn(async (challenge: ChildSelectionChallenge, _signal: AbortSignal): Promise<unknown> => {
    calls.push("profile"); return { status: "restored", challenge, registry: clone(state.registry) };
  });
  const policy = vi.fn(async (challenge: ChildSelectionChallenge, _signal: AbortSignal): Promise<unknown> => {
    calls.push("policy"); return { status: "verified", challenge };
  });
  const pack = vi.fn(async (challenge: ChildPackageChallenge, _signal: AbortSignal): Promise<unknown> => {
    calls.push("package"); return { status: "verified", challenge, scope: clone(state.scope), validUntilEpochMs: state.validUntil };
  });
  const route = vi.fn(async (challenge: ChildRouteChallenge, _signal: AbortSignal): Promise<unknown> => {
    calls.push("route"); return { status: "verified", challenge };
  });
  const options: ChildStartupOptions = {
    secureModePort: { restore: mode }, profilePort: { restore: profile }, policyPort: { verify: policy },
    packagePort: { verify: pack }, routePort: { verify: route }, clock: { nowEpochMs: () => state.time }, timeoutMs: 10_000,
    initialVisibility: "active",
  };
  return { state, calls, mode, profile, policy, pack, route, options };
}
type Fixture = ReturnType<typeof fixture>;
const stages = ["mode", "profile", "policy", "pack", "route"] as const;
type Stage = typeof stages[number];
function replaceProof(f: Fixture, stage: Stage, alter: (proof: Record<string, unknown>) => unknown) {
  const selected = f[stage] as unknown as {
    getMockImplementation(): (challenge: unknown, signal: AbortSignal) => Promise<Record<string, unknown>>;
    mockImplementationOnce(implementation: (challenge: unknown, signal: AbortSignal) => Promise<unknown>): void;
  };
  const implementation = selected.getMockImplementation()!;
  // Each public port has a more specific challenge, while the test mutator
  // intentionally observes only its otherwise valid returned proof shape.
  selected.mockImplementationOnce(async (challenge, signal) => alter(await implementation(challenge, signal)));
}

describe("sealed child-only startup boundary", () => {
  it.each(["ru", "en"] as const)("orders every trusted dependency and rechecks secure selection for %s", async locale => {
    const f = fixture(locale), startup = createChildStartup(f.options);
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    expect(await startup.start(intent(locale))).toEqual({ status: "ready" });
    expect(f.calls).toEqual(["mode", "profile", "policy", "package", "route", "mode"]);
    expect(f.mode.mock.calls[0][0]).toBe(f.mode.mock.calls[1][0]);
    expect(startup.getSnapshot()).toEqual({ phase: "ready" });
    expect(Object.isFrozen(startup.getSnapshot())).toBe(true);
    expect(Object.keys(startup.getSnapshot())).toEqual(["phase"]);
  });

  it("passes frozen private projections, preserving exact requested child routes", async () => {
    for (const kind of ["home", "country", "writer", "work", "storyworld"] as const) {
      const f = fixture(), startup = createChildStartup(f.options), route = { kind, entityId: kind === "home" ? null : "synthetic-entity" };
      expect(await startup.start({ locale: "ru", route })).toEqual({ status: "ready" });
      const challenge = f.route.mock.calls[0][0];
      expect(challenge.request.route).toEqual(route);
      for (const value of [challenge, challenge.request, challenge.request.route, challenge.selection, challenge.profile, challenge.scope])
        expect(Object.isFrozen(value)).toBe(true);
      expect(challenge.profile.exactAge).toBe(9);
      expect(challenge.scope.namespace).toBe("child");
    }
  });

  it.each(["secureModePort", "profilePort", "policyPort", "packagePort", "routePort"] as const)("requires %s with no preference or adult fallback", async missing => {
    const f = fixture(), startup = createChildStartup({ ...f.options, [missing]: undefined });
    expect(await startup.start(intent())).toEqual({ status: "sealed" });
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    expect(f.calls).toEqual([]);
    expect(await startup.visitReady(vi.fn())).toBe(false);
  });

  it("requires explicit bounded operational timeout and valid clock contract", () => {
    const f = fixture();
    for (const timeoutMs of [0, -1, 1.5, NaN, Infinity, 2_147_483_648])
      expect(() => createChildStartup({ ...f.options, timeoutMs })).toThrow(TypeError);
    expect(() => createChildStartup({ ...f.options, clock: {} } as ChildStartupOptions)).toThrow(TypeError);
    for (const initialVisibility of [undefined, "unknown", true])
      expect(() => createChildStartup({ ...f.options, initialVisibility } as unknown as ChildStartupOptions)).toThrow(TypeError);
  });

  it("rejects malformed, newer, adult, external and uncertain routes before reading any port", async () => {
    const values: unknown[] = [null, true, {}, { ...intent(), approved: true }, { ...intent(), locale: "fr" },
      { locale: "ru", route: { kind: "adult", entityId: "adult-item" } },
      { locale: "ru", route: { kind: "external", entityId: "website" } },
      { locale: "ru", route: { kind: "home", entityId: "unexpected" } },
      { locale: "ru", route: { kind: "writer", entityId: null } },
      { locale: "ru", route: { kind: "work", entityId: "../adult-index" } },
      { locale: "ru", route: { kind: "home", entityId: null, schemaVersion: 2 } }];
    for (const value of values) {
      const f = fixture(), startup = createChildStartup(f.options);
      expect(await startup.start(value)).toEqual({ status: "sealed" });
      expect(f.calls).toEqual([]);
    }
  });

  it("does not coerce route objects or invoke request accessors", async () => {
    const f = fixture(), startup = createChildStartup(f.options), coercion = vi.fn(() => "home"), getter = vi.fn(() => "ru");
    expect(await startup.start({ locale: "ru", route: { kind: { toString: coercion }, entityId: "synthetic-entity" } })).toEqual({ status: "sealed" });
    const accessor = Object.defineProperty({ route: intent().route }, "locale", { get: getter, enumerable: true });
    expect(await startup.start(accessor)).toEqual({ status: "sealed" });
    expect(coercion).not.toHaveBeenCalled();
    expect(getter).not.toHaveBeenCalled();
    expect(f.calls).toEqual([]);
  });

  it("rejects missing, corrupt, newer and adult secure selection", async () => {
    for (const selection of [null, {}, { ...fixture().state.selection, schemaVersion: 2 },
      { ...fixture().state.selection, mode: "adult" }, { ...fixture().state.selection, profileRevision: 0 },
      { ...fixture().state.selection, profileChecksum: "unchecked" }, { ...fixture().state.selection, parentApproved: true }]) {
      const f = fixture(), startup = createChildStartup(f.options);
      replaceProof(f, "mode", proof => ({ ...proof, selection }));
      expect(await startup.start(intent())).toEqual({ status: "sealed" });
      expect(f.profile).not.toHaveBeenCalled();
    }
  });

  it("requires authenticated exact active-profile metadata under the current policy", async () => {
    const valid = fixture().state.registry;
    const values = [null, {}, { ...valid, schemaVersion: 2 }, { ...valid, policyVersion: "synthetic-policy-v2" },
      { ...valid, activeProfileId: null }, { ...valid, activeProfileId: "other-child", profiles: [{ ...valid.profiles[0], id: "other-child" }] },
      { ...valid, profiles: [{ ...valid.profiles[0], exactAge: 18 }] },
      { ...valid, profiles: [{ ...valid.profiles[0], locale: "fr" }] },
      { ...valid, profiles: [{ ...valid.profiles[0], parentApproved: true }] }];
    for (const registry of values) {
      const f = fixture(), startup = createChildStartup(f.options);
      replaceProof(f, "profile", proof => ({ ...proof, registry }));
      expect(await startup.start(intent())).toEqual({ status: "sealed" });
      expect(f.policy).not.toHaveBeenCalled();
    }
  });

  it.each(stages)("rejects copied challenges, approval booleans and extra proof fields at %s", async stage => {
    for (const mutate of [(proof: Record<string, unknown>) => ({ ...proof, challenge: clone(proof.challenge) }),
      (_proof: Record<string, unknown>) => true,
      (proof: Record<string, unknown>) => ({ ...proof, parentApproved: true }),
      (proof: Record<string, unknown>) => ({ ...proof, status: "unavailable" })]) {
      const f = fixture(), startup = createChildStartup(f.options);
      replaceProof(f, stage, mutate);
      expect(await startup.start(intent())).toEqual({ status: "sealed" });
      expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    }
  });

  it("binds child package to exact profile, revision, age, locale, policy and hashes", async () => {
    const patches = [{ namespace: "adult" }, { schemaVersion: 2 }, { profileId: "other-child" }, { profileRevision: 2 },
      { exactAge: 10 }, { locale: "en" }, { policyVersion: "synthetic-policy-v2" }, { policyChecksum: checksum("d") },
      { packageChecksum: "signature-only" }, { packageVersion: 0 }, { reviewed: true }];
    for (const patch of patches) {
      const f = fixture(), startup = createChildStartup(f.options);
      replaceProof(f, "pack", proof => ({ ...proof, scope: { ...f.state.scope, ...patch } }));
      expect(await startup.start(intent())).toEqual({ status: "sealed" });
      expect(f.route).not.toHaveBeenCalled();
    }
  });

  it("requires explicit future reviewed-package validity", async () => {
    for (const validUntilEpochMs of [null, Infinity, NaN, "future", initialTime - 1, initialTime, 8_640_000_000_000_001]) {
      const f = fixture(), startup = createChildStartup(f.options);
      replaceProof(f, "pack", proof => ({ ...proof, validUntilEpochMs }));
      expect(await startup.start(intent())).toEqual({ status: "sealed" });
      expect(f.route).not.toHaveBeenCalled();
    }
  });

  it("keeps a route denied by its child index sealed and skips final restore", async () => {
    const f = fixture(), startup = createChildStartup(f.options);
    replaceProof(f, "route", proof => ({ ...proof, status: "denied" }));
    expect(await startup.start({ locale: "ru", route: { kind: "work", entityId: "synthetic-excluded-work" } })).toEqual({ status: "sealed" });
    expect(f.mode).toHaveBeenCalledTimes(1);
  });

  it("rechecks all protected selection coordinates after async route work", async () => {
    for (const patch of [{ selectionRevision: 2 }, { profileRevision: 2 }, { profileChecksum: checksum("d") },
      { policyChecksum: checksum("e") }, { profileId: "other-child" }, { mode: "adult" }]) {
      const f = fixture(), startup = createChildStartup(f.options);
      f.route.mockImplementationOnce(async challenge => {
        f.state.selection = { ...f.state.selection, ...patch } as ChildSecureSelection;
        return { status: "verified", challenge };
      });
      expect(await startup.start(intent())).toEqual({ status: "sealed" });
      expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    }
  });

  it.each(stages)("sanitizes rejected %s port without exposing its error", async stage => {
    const f = fixture(), startup = createChildStartup(f.options);
    f[stage].mockRejectedValueOnce(new Error("synthetic-private-port-detail"));
    expect(await startup.start(intent())).toEqual({ status: "sealed" });
    expect(JSON.stringify(startup.getSnapshot())).not.toContain("synthetic-private");
  });

  it.each(["invalidate", "background", "dispose"] as const)("revokes pending and ready state on %s despite ignored abort", async operation => {
    const f = fixture(), startup = createChildStartup(f.options), late = deferred<unknown>();
    let challenge!: ChildStartupChallenge, signal!: AbortSignal;
    f.mode.mockImplementationOnce((captured, capturedSignal) => { challenge = captured; signal = capturedSignal; return late.promise; });
    const pending = startup.start(intent());
    startup[operation]();
    expect(await pending).toEqual({ status: operation === "dispose" ? "disposed" : "cancelled" });
    expect(signal.aborted).toBe(true);
    late.resolve({ status: "restored", challenge, selection: f.state.selection });
    await Promise.resolve();
    expect(f.profile).not.toHaveBeenCalled();
    expect(startup.getSnapshot()).toEqual({ phase: operation === "dispose" ? "disposed" : "sealed" });
    expect(await startup.visitReady(vi.fn())).toBe(false);
    if (operation === "dispose") expect(await startup.start(intent())).toEqual({ status: "disposed" });
    else {
      if (operation === "background") {
        expect(await startup.start(intent())).toEqual({ status: "sealed" });
        startup.foreground();
      }
      expect(await startup.start(intent())).toEqual({ status: "ready" });
      startup[operation]();
      expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    }
  });

  it("requires an explicit foreground transition and fresh proofs after initial background", async () => {
    const f = fixture(), startup = createChildStartup({ ...f.options, initialVisibility: "background" }), visit = vi.fn();
    expect(await startup.start(intent())).toEqual({ status: "sealed" });
    expect(await startup.visitReady(visit)).toBe(false);
    expect(f.calls).toEqual([]);
    startup.foreground();
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    startup.background();
    const count = f.mode.mock.calls.length;
    expect(await startup.start(intent())).toEqual({ status: "sealed" });
    expect(f.mode).toHaveBeenCalledTimes(count);
    startup.foreground();
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    expect(await startup.visitReady(visit)).toBe(false);
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    expect(visit).not.toHaveBeenCalled();
  });

  it("rejects late proofs across a background and foreground cycle", async () => {
    const f = fixture(), startup = createChildStartup(f.options), late = deferred<unknown>();
    let challenge!: ChildStartupChallenge;
    f.mode.mockImplementationOnce(value => { challenge = value; return late.promise; });
    const old = startup.start(intent());
    startup.background();
    startup.foreground();
    expect(await old).toEqual({ status: "cancelled" });
    late.resolve({ status: "restored", challenge, selection: f.state.selection });
    await Promise.resolve();
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    expect(f.profile).not.toHaveBeenCalled();
    expect(await startup.start(intent())).toEqual({ status: "ready" });
  });

  it("fences a superseded operation and ignores its late proof after a new ready selection", async () => {
    const f = fixture(), startup = createChildStartup(f.options), late = deferred<unknown>();
    let oldChallenge!: ChildStartupChallenge;
    f.mode.mockImplementationOnce(challenge => { oldChallenge = challenge; return late.promise; });
    const old = startup.start(intent());
    expect(await startup.start({ locale: "ru", route: { kind: "country", entityId: "synthetic-country" } })).toEqual({ status: "ready" });
    expect(await old).toEqual({ status: "cancelled" });
    late.resolve({ status: "restored", challenge: oldChallenge, selection: { ...f.state.selection, mode: "adult" } });
    await Promise.resolve();
    expect(startup.getSnapshot()).toEqual({ phase: "ready" });
    expect(f.profile).toHaveBeenCalledTimes(1);
  });

  it("rejects the original generation after an equal-value A to B to A sequence", async () => {
    const f = fixture(), startup = createChildStartup(f.options), late = deferred<unknown>();
    let originalChallenge!: ChildStartupChallenge;
    f.mode.mockImplementationOnce(challenge => { originalChallenge = challenge; return late.promise; });
    const original = startup.start(intent());
    expect(await startup.start({ locale: "ru", route: { kind: "country", entityId: "synthetic-country-b" } })).toEqual({ status: "ready" });
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    expect(await original).toEqual({ status: "cancelled" });
    const currentChallenge = f.route.mock.calls[1][0];
    expect(currentChallenge.request).toEqual(originalChallenge.request);
    expect(currentChallenge.generation).not.toBe(originalChallenge.generation);
    late.resolve({ status: "restored", challenge: originalChallenge, selection: clone(f.state.selection) });
    await Promise.resolve();
    expect(f.profile).toHaveBeenCalledTimes(2);
    expect(startup.getSnapshot()).toEqual({ phase: "ready" });
  });

  it("ignores a rejected superseded port after a newer generation reaches ready", async () => {
    const f = fixture(), startup = createChildStartup(f.options), oldPort = deferred<unknown>();
    f.mode.mockImplementationOnce(() => oldPort.promise);
    const original = startup.start(intent());
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    expect(await original).toEqual({ status: "cancelled" });
    oldPort.reject(new Error("synthetic-obsolete-native-detail"));
    // Let the obsolete pipeline's catch execute; it must neither leak a
    // rejection nor invoke sealing against the current generation.
    await Promise.resolve();
    await Promise.resolve();
    expect(startup.getSnapshot()).toEqual({ phase: "ready" });
    expect(f.profile).toHaveBeenCalledTimes(1);
  });

  it("does not continue to policy after reentrant cancellation while inspecting profile data", async () => {
    const f = fixture(), startup = createChildStartup(f.options);
    const registry = new Proxy(f.state.registry, { ownKeys(target) { startup.invalidate(); return Reflect.ownKeys(target); } });
    replaceProof(f, "profile", proof => ({ ...proof, registry }));
    expect(await startup.start(intent())).toEqual({ status: "cancelled" });
    expect(f.policy).not.toHaveBeenCalled();
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
  });

  it("keeps a reentrant new start from an old abort listener as the only current operation", async () => {
    const f = fixture(), startup = createChildStartup(f.options), oldProof = deferred<unknown>();
    let reentrant: Promise<unknown> | undefined;
    f.mode.mockImplementationOnce((_challenge, signal) => {
      signal.addEventListener("abort", () => { reentrant = startup.start({ locale: "ru", route: { kind: "writer", entityId: "synthetic-writer" } }); });
      return oldProof.promise;
    });
    const old = startup.start(intent()), displaced = startup.start(intent());
    expect(await old).toEqual({ status: "cancelled" });
    expect(await displaced).toEqual({ status: "cancelled" });
    expect(await reentrant).toEqual({ status: "ready" });
    expect(f.route.mock.calls[0][0].request.route.entityId).toBe("synthetic-writer");
  });

  it("expires a pending operation and ignores a late native answer", async () => {
    vi.useFakeTimers();
    try {
      const f = fixture(), startup = createChildStartup({ ...f.options, timeoutMs: 50 }), late = deferred<unknown>();
      let challenge!: ChildStartupChallenge, signal!: AbortSignal;
      f.mode.mockImplementationOnce((value, abortSignal) => { challenge = value; signal = abortSignal; return late.promise; });
      const pending = startup.start(intent());
      await vi.advanceTimersByTimeAsync(50);
      expect(await pending).toEqual({ status: "expired" });
      expect(signal.aborted).toBe(true);
      late.resolve({ status: "restored", challenge, selection: f.state.selection });
      await Promise.resolve();
      expect(f.profile).not.toHaveBeenCalled();
      expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    } finally { vi.useRealTimers(); }
  });

  it("checks its trusted deadline even when timer delivery is suspended", async () => {
    vi.useFakeTimers();
    try {
      const f = fixture(), startup = createChildStartup({ ...f.options, timeoutMs: 50 });
      f.route.mockImplementationOnce(async challenge => {
        f.state.time += 50;
        return { status: "verified", challenge };
      });
      expect(await startup.start(intent())).toEqual({ status: "expired" });
      expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    } finally { vi.useRealTimers(); }
  });

  it("seals permanently on trusted clock rollback rather than extending package lifetime", async () => {
    const f = fixture(), startup = createChildStartup(f.options);
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    f.state.time--;
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    f.state.time = initialTime + 1;
    expect(await startup.start(intent())).toEqual({ status: "sealed" });
    expect(f.mode).toHaveBeenCalledTimes(2);
  });

  it("seals invalid, throwing and overflow-prone clock readings without consulting ports", async () => {
    for (const value of [NaN, Infinity, -1, 1.5, 8_640_000_000_000_001]) {
      const f = fixture(), startup = createChildStartup({ ...f.options, clock: { nowEpochMs: () => value } });
      expect(await startup.start(intent())).toEqual({ status: "sealed" });
      expect(f.calls).toEqual([]);
    }
    const f = fixture(), startup = createChildStartup({ ...f.options, clock: { nowEpochMs() { throw new Error("synthetic-clock-detail"); } } });
    expect(await startup.start(intent())).toEqual({ status: "sealed" });
    expect(f.calls).toEqual([]);
  });

  it("retires a ready view at the exclusive package expiry boundary", async () => {
    const f = fixture(), startup = createChildStartup(f.options), visit = vi.fn();
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    f.state.time = f.state.validUntil;
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    expect(await startup.visitReady(visit)).toBe(false);
    expect(visit).not.toHaveBeenCalled();
  });

  it("rejects package expiry during asynchronous route verification", async () => {
    const f = fixture(), startup = createChildStartup(f.options);
    f.state.validUntil = initialTime + 100;
    f.route.mockImplementationOnce(async challenge => { f.state.time += 100; return { status: "verified", challenge }; });
    expect(await startup.start(intent())).toEqual({ status: "expired" });
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
  });

  it("revalidates every port before a synchronous ready-view handoff", async () => {
    const f = fixture(), startup = createChildStartup(f.options), visit = vi.fn();
    expect(await startup.visitReady(visit)).toBe(false);
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    f.calls.length = 0;
    expect(await startup.visitReady(visit)).toBe(true);
    expect(f.calls).toEqual(["mode", "profile", "policy", "package", "route", "mode"]);
    expect(visit).toHaveBeenCalledTimes(1);
    expect(visit.mock.calls[0][0]).toMatchObject({ profile: { id: "synthetic-child-one", exactAge: 9 },
      scope: { namespace: "child", locale: "ru" }, route: intent().route });
    expect(Object.isFrozen(visit.mock.calls[0][0])).toBe(true);
    expect(JSON.stringify(startup.getSnapshot())).not.toMatch(/Synthetic Reader|synthetic-child|violence|exactAge|profileChecksum/u);
  });

  it("retires old readiness while visit revalidation is pending", async () => {
    const f = fixture(), startup = createChildStartup(f.options), late = deferred<unknown>(), visit = vi.fn();
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    let challenge!: ChildStartupChallenge;
    f.mode.mockImplementationOnce(value => { challenge = value; return late.promise; });
    const visiting = startup.visitReady(visit);
    expect(startup.getSnapshot()).toEqual({ phase: "restoring" });
    expect(visit).not.toHaveBeenCalled();
    late.resolve({ status: "restored", challenge, selection: f.state.selection });
    expect(await visiting).toBe(true);
    expect(visit).toHaveBeenCalledTimes(1);
  });

  it("does not reuse readiness after protected profile or policy revision changes", async () => {
    for (const patch of [{ profileRevision: 2 }, { profileChecksum: checksum("d") }, { policyChecksum: checksum("e") }]) {
      const f = fixture(), startup = createChildStartup(f.options), visit = vi.fn();
      expect(await startup.start(intent())).toEqual({ status: "ready" });
      f.state.selection = { ...f.state.selection, ...patch };
      expect(await startup.visitReady(visit)).toBe(false);
      expect(visit).not.toHaveBeenCalled();
      expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    }
  });

  it("does not hand off an old package after locale, version or checksum changes", async () => {
    for (const patch of [{ locale: "en" }, { packageVersion: 2 }, { packageChecksum: checksum("d") }]) {
      const f = fixture(), startup = createChildStartup(f.options), visit = vi.fn();
      expect(await startup.start(intent())).toEqual({ status: "ready" });
      f.state.scope = { ...f.state.scope, ...patch } as ChildDataScope;
      expect(await startup.visitReady(visit)).toBe(false);
      expect(visit).not.toHaveBeenCalled();
    }
  });

  it("requires independent current-policy and route proof again on every visit", async () => {
    for (const stage of ["policy", "route"] as const) {
      const f = fixture(), startup = createChildStartup(f.options), visit = vi.fn();
      expect(await startup.start(intent())).toEqual({ status: "ready" });
      replaceProof(f, stage, proof => ({ ...proof, status: "denied" }));
      expect(await startup.visitReady(visit)).toBe(false);
      expect(visit).not.toHaveBeenCalled();
      expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    }
  });

  it("cannot hand off another generation's ready view after a reentrant newer start", async () => {
    const f = fixture(), startup = createChildStartup(f.options), visit = vi.fn();
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    let newer: Promise<unknown> | undefined;
    const original = f.mode.getMockImplementation()!;
    f.mode.mockImplementationOnce((challenge, signal) => {
      newer = startup.start({ locale: "ru", route: { kind: "country", entityId: "synthetic-new-country" } });
      return original(challenge, signal);
    });
    expect(await startup.visitReady(visit)).toBe(false);
    expect(await newer).toEqual({ status: "ready" });
    expect(visit).not.toHaveBeenCalled();
    expect(startup.getSnapshot()).toEqual({ phase: "ready" });
  });

  it("denies the final handoff if clock inspection reenters invalidation", async () => {
    const f = fixture();
    let inspect = false;
    const startup = createChildStartup({ ...f.options, clock: { nowEpochMs() {
      if (inspect) { inspect = false; startup.invalidate(); }
      return f.state.time;
    } } });
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    inspect = true;
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    expect(await startup.visitReady(vi.fn())).toBe(false);
  });

  it.each(["invalidate", "background", "dispose"] as const)("rejects a ready-view handoff revoked synchronously by %s", async operation => {
    const f = fixture(), startup = createChildStartup(f.options);
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    const visit = vi.fn(() => { startup[operation](); });
    expect(await startup.visitReady(visit)).toBe(false);
    expect(visit).toHaveBeenCalledTimes(1);
    expect(startup.getSnapshot()).toEqual({ phase: operation === "dispose" ? "disposed" : "sealed" });
  });

  it("rejects a ready-view handoff replaced synchronously while preserving the new route", async () => {
    const f = fixture(), startup = createChildStartup(f.options);
    const nextIntent: ChildStartupRequest = { locale: "ru", route: { kind: "country", entityId: "synthetic-next-country" } };
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    let replacement: Promise<unknown> | undefined;
    expect(await startup.visitReady(() => { replacement = startup.start(nextIntent); })).toBe(false);
    expect(await replacement).toEqual({ status: "ready" });
    expect(startup.getSnapshot()).toEqual({ phase: "ready" });
    const nextVisit = vi.fn();
    expect(await startup.visitReady(nextVisit)).toBe(true);
    expect(nextVisit.mock.calls[0][0].route).toEqual(nextIntent.route);
  });

  it("rejects a ready-view handoff across synchronous A to B to A replacement", async () => {
    const f = fixture(), startup = createChildStartup(f.options);
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    let intermediate: Promise<unknown> | undefined, replacement: Promise<unknown> | undefined, handedGeneration = -1;
    expect(await startup.visitReady(() => {
      handedGeneration = f.route.mock.calls[f.route.mock.calls.length - 1][0].generation;
      intermediate = startup.start({ locale: "ru", route: { kind: "country", entityId: "synthetic-intermediate-country" } });
      replacement = startup.start(intent());
    })).toBe(false);
    expect(await intermediate).toEqual({ status: "cancelled" });
    expect(await replacement).toEqual({ status: "ready" });
    const current = f.route.mock.calls[f.route.mock.calls.length - 1][0];
    expect(current.request).toEqual(intent());
    expect(current.generation).toBeGreaterThan(handedGeneration);
    expect(startup.getSnapshot()).toEqual({ phase: "ready" });
  });

  it("rejects a ready-view handoff that reaches package expiry inside the callback", async () => {
    const f = fixture(), startup = createChildStartup(f.options);
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    expect(await startup.visitReady(() => { f.state.time = f.state.validUntil; })).toBe(false);
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    const lateVisit = vi.fn();
    expect(await startup.visitReady(lateVisit)).toBe(false);
    expect(lateVisit).not.toHaveBeenCalled();
  });

  it("rejects a ready-view handoff after synchronous clock rollback and keeps the clock sealed", async () => {
    const f = fixture(), startup = createChildStartup(f.options);
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    expect(await startup.visitReady(() => { f.state.time--; })).toBe(false);
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    f.state.time = initialTime;
    expect(await startup.start(intent())).toEqual({ status: "sealed" });
  });

  it("rejects a ready-view handoff if its post-callback clock throws", async () => {
    const f = fixture(); let failClock = false;
    const startup = createChildStartup({ ...f.options, clock: { nowEpochMs() {
      if (failClock) throw new Error("synthetic-post-callback-clock-detail");
      return f.state.time;
    } } });
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    expect(await startup.visitReady(() => { failClock = true; })).toBe(false);
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    failClock = false;
    expect(await startup.start(intent())).toEqual({ status: "sealed" });
  });

  it.each(["invalidate", "start"] as const)("rejects a ready-view handoff when its post-callback clock reenters %s", async operation => {
    const f = fixture(); let reenter = false, replacement: Promise<unknown> | undefined;
    const nextIntent: ChildStartupRequest = { locale: "ru", route: { kind: "writer", entityId: "synthetic-clock-writer" } };
    const startup = createChildStartup({ ...f.options, clock: { nowEpochMs() {
      if (reenter) {
        reenter = false;
        if (operation === "invalidate") startup.invalidate(); else replacement = startup.start(nextIntent);
      }
      return f.state.time;
    } } });
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    expect(await startup.visitReady(() => { reenter = true; })).toBe(false);
    if (operation === "invalidate") expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
    else {
      expect(await replacement).toEqual({ status: "ready" });
      expect(startup.getSnapshot()).toEqual({ phase: "ready" });
      expect(f.route.mock.calls[f.route.mock.calls.length - 1][0].request.route).toEqual(nextIntent.route);
    }
  });

  it("accepts a ready-view handoff after a synchronous callback within the original package validity", async () => {
    const f = fixture(), startup = createChildStartup(f.options);
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    const visit = vi.fn(() => { f.state.time++; });
    expect(await startup.visitReady(visit)).toBe(true);
    expect(visit).toHaveBeenCalledTimes(1);
    expect(startup.getSnapshot()).toEqual({ phase: "ready" });
  });

  it("sanitizes throwing or asynchronous view callbacks without claiming a synchronous handoff", async () => {
    const f = fixture(), startup = createChildStartup(f.options);
    expect(await startup.start(intent())).toEqual({ status: "ready" });
    expect(await startup.visitReady(() => { throw new Error("synthetic-view-detail"); })).toBe(false);
    expect(await startup.visitReady(async () => { throw new Error("synthetic-async-view-detail"); })).toBe(false);
    expect(startup.getSnapshot()).toEqual({ phase: "ready" });
  });

  it.each(["ru", "en"] as const)("seals a locked %s profile before policy, package or route reads in the other locale", async locale => {
    const f = fixture(locale), startup = createChildStartup(f.options), visit = vi.fn();
    Object.assign(f.state.registry.profiles[0], { localeLocked: true });
    const other = locale === "ru" ? "en" : "ru";
    f.state.scope = { ...f.state.scope, locale: other };
    expect(await startup.start(intent(other))).toEqual({ status: "sealed" });
    expect(f.calls).toEqual(["mode", "profile"]);
    expect(f.policy).not.toHaveBeenCalled();
    expect(f.pack).not.toHaveBeenCalled();
    expect(f.route).not.toHaveBeenCalled();
    expect(await startup.visitReady(visit)).toBe(false);
    expect(visit).not.toHaveBeenCalled();
  });

  it.each(["ru", "en"] as const)("passes the whole immutable locked %s profile only to independently verified readers", async locale => {
    const f = fixture(locale), startup = createChildStartup(f.options), visit = vi.fn();
    Object.assign(f.state.registry.profiles[0], { localeLocked: true });
    expect(await startup.start(intent(locale))).toEqual({ status: "ready" });
    expect(f.pack.mock.calls[0][0].profile.localeLocked).toBe(true);
    expect(Object.isFrozen(f.pack.mock.calls[0][0].profile)).toBe(true);
    expect(await startup.visitReady(visit)).toBe(true);
    expect(visit.mock.calls[0][0]).toMatchObject({ profile: { locale, localeLocked: true }, scope: { locale } });
    expect(f.pack).toHaveBeenCalledTimes(2);
    expect(f.route).toHaveBeenCalledTimes(2);
  });

  it("permits an absent or false lock to choose another locale but still requires that locale's package approval", async () => {
    for (const localeLocked of [undefined, false]) {
      for (const approved of [true, false]) {
        const f = fixture("ru"), startup = createChildStartup(f.options);
        if (localeLocked !== undefined) Object.assign(f.state.registry.profiles[0], { localeLocked });
        f.state.scope = { ...f.state.scope, locale: "en" };
        if (!approved) replaceProof(f, "pack", proof => ({ ...proof, status: "denied" }));
        expect(await startup.start(intent("en"))).toEqual({ status: approved ? "ready" : "sealed" });
        expect(f.pack).toHaveBeenCalledTimes(1);
        expect(f.pack.mock.calls[0][0].profile.locale).toBe("ru");
        expect(f.route).toHaveBeenCalledTimes(approved ? 1 : 0);
      }
    }
  });

  it("rechecks the parent's lock before every ready-view callback even when a profile port supplies stale selection coordinates", async () => {
    const f = fixture("ru"), startup = createChildStartup(f.options), visit = vi.fn();
    f.state.scope = { ...f.state.scope, locale: "en" };
    expect(await startup.start(intent("en"))).toEqual({ status: "ready" });
    Object.assign(f.state.registry.profiles[0], { localeLocked: true });
    f.calls.length = 0;
    expect(await startup.visitReady(visit)).toBe(false);
    expect(f.calls).toEqual(["mode", "profile"]);
    expect(f.pack).toHaveBeenCalledTimes(1);
    expect(f.route).toHaveBeenCalledTimes(1);
    expect(visit).not.toHaveBeenCalled();
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
  });

  it("rejects a parent locale-lock revision changed while an otherwise approved route is pending", async () => {
    const f = fixture("ru"), startup = createChildStartup(f.options);
    Object.assign(f.state.registry.profiles[0], { localeLocked: true });
    f.route.mockImplementationOnce(async challenge => {
      f.state.registry.profiles[0].locale = "en";
      f.state.selection = { ...f.state.selection, selectionRevision: 2, profileRevision: 2, profileChecksum: checksum("d") };
      return { status: "verified", challenge };
    });
    expect(await startup.start(intent("ru"))).toEqual({ status: "sealed" });
    expect(f.mode).toHaveBeenCalledTimes(2);
    expect(startup.getSnapshot()).toEqual({ phase: "sealed" });
  });

  it("restores the lock freshly after background and foreground instead of resuming an unlocked locale", async () => {
    const f = fixture("ru"), startup = createChildStartup(f.options), visit = vi.fn();
    f.state.scope = { ...f.state.scope, locale: "en" };
    expect(await startup.start(intent("en"))).toEqual({ status: "ready" });
    startup.background();
    Object.assign(f.state.registry.profiles[0], { localeLocked: true });
    f.state.selection = { ...f.state.selection, selectionRevision: 2, profileRevision: 2, profileChecksum: checksum("d") };
    expect(await startup.start(intent("en"))).toEqual({ status: "sealed" });
    startup.foreground(); f.calls.length = 0;
    expect(await startup.visitReady(visit)).toBe(false);
    expect(await startup.start(intent("en"))).toEqual({ status: "sealed" });
    expect(f.calls).toEqual(["mode", "profile"]);
    expect(f.pack).toHaveBeenCalledTimes(1);
    expect(f.route).toHaveBeenCalledTimes(1);
    expect(visit).not.toHaveBeenCalled();
    f.state.scope = { ...f.state.scope, locale: "ru", profileRevision: 2 };
    expect(await startup.start(intent("ru"))).toEqual({ status: "ready" });
  });

  it("does not publish an old unlocked locale after a new locked profile supersedes its pending restoration", async () => {
    const f = fixture("ru"), startup = createChildStartup(f.options), entered = deferred<ChildSelectionChallenge>(), late = deferred<unknown>();
    const oldRegistry = clone(f.state.registry);
    f.state.scope = { ...f.state.scope, locale: "en" };
    f.profile.mockImplementationOnce(challenge => { entered.resolve(challenge); return late.promise; });
    const old = startup.start(intent("en")), oldChallenge = await entered.promise;
    Object.assign(f.state.registry.profiles[0], { localeLocked: true });
    f.state.selection = { ...f.state.selection, selectionRevision: 2, profileRevision: 2, profileChecksum: checksum("d") };
    f.state.scope = { ...f.state.scope, locale: "ru", profileRevision: 2 };
    expect(await startup.start(intent("ru"))).toEqual({ status: "ready" });
    expect(await old).toEqual({ status: "cancelled" });
    late.resolve({ status: "restored", challenge: oldChallenge, registry: oldRegistry });
    await Promise.resolve(); await Promise.resolve();
    expect(f.pack).toHaveBeenCalledTimes(1);
    expect(f.route.mock.calls[0][0].request.locale).toBe("ru");
    expect(f.route.mock.calls[0][0].profile.localeLocked).toBe(true);
    expect(startup.getSnapshot()).toEqual({ phase: "ready" });
  });

  it("rejects a locale-lock accessor before all content readers without invoking it", async () => {
    const f = fixture(), startup = createChildStartup(f.options), getter = vi.fn(() => true);
    const registry = clone(f.state.registry);
    Object.defineProperty(registry.profiles[0], "localeLocked", { enumerable: true, get: getter });
    replaceProof(f, "profile", proof => ({ ...proof, registry }));
    expect(await startup.start(intent())).toEqual({ status: "sealed" });
    expect(getter).not.toHaveBeenCalled();
    expect(f.policy).not.toHaveBeenCalled();
    expect(f.pack).not.toHaveBeenCalled();
    expect(f.route).not.toHaveBeenCalled();
  });
});
