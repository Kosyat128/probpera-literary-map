import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createParentGate, PARENT_GATE_ACTIONS, type ParentGateChallenge, type ParentGateContext,
  type ParentGateOptions, type ParentGateOutcome, type ParentGateRequest, type ParentVerificationResult } from "./parentGate";

const context: ParentGateContext = { profileId: "synthetic-child", policyVersion: "synthetic-policy-v1",
  profileRevision: 1, routeRevision: 0, mode: "child", visibility: "active" };
const scope: ParentGateRequest = { action: "open-external", targetChecksum: "a".repeat(64) };
const requiredActions = ["exit-child-mode", "switch-adult-profile", "change-exact-age", "change-blocked-topics", "open-adult-store",
  "initiate-purchase", "restore-purchases", "open-external", "share", "account-change", "export-child-data", "delete-child-data",
  "diagnostics", "expand-access-settings", "enable-licensed-pack", "view-legal-commercial"] as const;
type Verifier = (challenge: ParentGateChallenge, signal: AbortSignal) => Promise<ParentVerificationResult>;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(verifier?: Verifier) {
  let time = 100, nonce = 0;
  const challenges: ParentGateChallenge[] = [], signals: AbortSignal[] = [];
  // Explicit test-owned ports model verification, never actual parental approval or secure storage.
  const verify = vi.fn((challenge: ParentGateChallenge, signal: AbortSignal) => {
    challenges.push(challenge); signals.push(signal);
    return verifier ? verifier(challenge, signal) : Promise.resolve({ status: "verified", challenge } as const);
  });
  const options: ParentGateOptions = { verificationPort: { verify }, clock: { nowMonotonicMs: () => time },
    policy: { capabilityLifetimeMs: 1_000, verificationTimeoutMs: 2_000 },
    randomSource: { getRandomValues(bytes) { bytes.fill(++nonce); return bytes; } } };
  const gate = createParentGate(options);
  gate.setContext(context);
  return { gate, options, verify, challenges, signals, setTime: (value: number) => { time = value; },
    advance: async (duration: number) => { time += duration; await vi.advanceTimersByTimeAsync(duration); } };
}
function capability(result: ParentGateOutcome) {
  expect(result.status).toBe("verified");
  if (result.status !== "verified") throw new Error("Synthetic verification did not complete.");
  return result.capability;
}

describe("one-use Parent Gate authority without UI or secure storage integration", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("covers the sixteen separately required protected actions", () => expect(PARENT_GATE_ACTIONS).toEqual(requiredActions));
  it.each(requiredActions)("binds one explicit verified %s action to a single execution", async action => {
    const h = harness(), request = { ...scope, action }, work = vi.fn();
    const token = capability(await h.gate.request(request));
    expect(h.verify).toHaveBeenCalledTimes(1);
    expect(h.challenges[0]).toMatchObject({ action, targetChecksum: scope.targetChecksum, context });
    expect(h.challenges[0].id).toMatch(/^[a-f0-9]{64}$/u);
    expect(Object.isFrozen(h.challenges[0])).toBe(true);
    expect(Object.isFrozen(h.challenges[0].context)).toBe(true);
    expect(h.gate.consume(token, request, work)).toBe(true);
    expect(h.gate.consume(token, request, work)).toBe(false);
    expect(work).toHaveBeenCalledTimes(1);
  });
  it("starts sealed and stays unavailable without a trusted secure verification port", async () => {
    const h = harness(), gate = createParentGate({ ...h.options, verificationPort: undefined });
    expect(gate.getSnapshot()).toEqual({ phase: "sealed" });
    expect(await gate.request(scope)).toEqual({ status: "denied" });
    gate.setContext(context);
    expect(await gate.request(scope)).toEqual({ status: "unavailable" });
    expect(gate.consume({ parentGatePassed: true }, scope, vi.fn())).toBe(false);
    expect(h.verify).not.toHaveBeenCalled();
  });
  it("rejects forged booleans, status flags and copied verification challenges", async () => {
    for (const fake of [true, { approved: true }, { status: "verified" }, { status: "verified", challenge: {} },
      { status: "denied", challenge: {} }, { status: "verified", challenge: {}, parentPin: "synthetic-secret" }]) {
      const h = harness(async () => fake as ParentVerificationResult);
      expect((await h.gate.request(scope)).status).not.toBe("verified");
    }
    const h = harness(async challenge => ({ status: "verified", challenge: { ...challenge } }));
    expect(await h.gate.request(scope)).toEqual({ status: "denied" });
  });
  it("requires the private token object and the same controller instance", async () => {
    const h = harness(), other = harness(), token = capability(await h.gate.request(scope)), work = vi.fn();
    for (const fake of [true, {}, { ...token }, JSON.parse(JSON.stringify(token)), "approved"]) {
      expect(h.gate.consume(fake, scope, work)).toBe(false);
    }
    expect(other.gate.consume(token, scope, work)).toBe(false);
    expect(h.gate.consume(token, scope, work)).toBe(true);
    expect(work).toHaveBeenCalledTimes(1);
  });
  it.each([{ ...scope, action: "share" }, { ...scope, targetChecksum: "b".repeat(64) }, { ...scope, approved: true }, null])
    ("burns a token even when its presented scope is wrong: %j", async wrong => {
      const h = harness(), token = capability(await h.gate.request(scope)), work = vi.fn();
      expect(h.gate.consume(token, wrong, work)).toBe(false);
      expect(h.gate.consume(token, scope, work)).toBe(false);
      expect(work).not.toHaveBeenCalled();
    });
  it.each([scope, { ...scope, action: "share" }, { ...scope, parentGatePassed: true }])
    ("retires every unused token on any newer intent: %j", async next => {
      const h = harness(), token = capability(await h.gate.request(scope)), work = vi.fn();
      await h.gate.request(next);
      expect(h.gate.consume(token, scope, work)).toBe(false);
      expect(work).not.toHaveBeenCalled();
    });
  it("supersedes an in-flight verification even when the new request is identical", async () => {
    const first = deferred<ParentVerificationResult>(), second = deferred<ParentVerificationResult>();
    let calls = 0;
    const h = harness(() => ++calls === 1 ? first.promise : second.promise);
    const old = h.gate.request(scope), fresh = h.gate.request(scope);
    expect(await old).toEqual({ status: "cancelled" });
    expect(h.signals[0].aborted).toBe(true);
    first.resolve({ status: "verified", challenge: h.challenges[0] });
    second.resolve({ status: "verified", challenge: h.challenges[1] });
    const token = capability(await fresh);
    expect(h.gate.consume(token, scope, vi.fn())).toBe(true);
  });
  it.each([
    { ...context, profileId: "synthetic-other-child" }, { ...context, policyVersion: "synthetic-policy-v2" },
    { ...context, profileRevision: 2 }, { ...context, routeRevision: 1 }, { ...context, visibility: "background" }, null,
  ])("fences pending verification and unused authority on context change: %j", async next => {
    const completed = harness(), token = capability(await completed.gate.request(scope)), work = vi.fn();
    completed.gate.setContext(next);
    expect(completed.gate.consume(token, scope, work)).toBe(false);
    const result = deferred<ParentVerificationResult>(), pending = harness(() => result.promise), request = pending.gate.request(scope);
    pending.gate.setContext(next);
    expect(await request).toEqual({ status: "cancelled" });
    expect(pending.signals[0].aborted).toBe(true);
    result.resolve({ status: "verified", challenge: pending.challenges[0] });
    await Promise.resolve(); await Promise.resolve();
    expect(pending.gate.getSnapshot().phase).not.toBe("authorized");
    expect(work).not.toHaveBeenCalled();
  });
  it("keeps the same valid context stable but does not revive background or previous-process tokens", async () => {
    const h = harness(), token = capability(await h.gate.request(scope));
    h.gate.setContext({ ...context });
    expect(h.gate.consume(token, scope, vi.fn())).toBe(true);
    const old = capability(await h.gate.request(scope));
    h.gate.setContext({ ...context, visibility: "background" });
    h.gate.setContext(context);
    expect(h.gate.consume(old, scope, vi.fn())).toBe(false);
    const restarted = harness();
    expect(restarted.gate.consume(old, scope, vi.fn())).toBe(false);
  });
  it.each(["back", "navigation", "callback", "notification"])("supports explicit %s cancellation without late authority", async () => {
    const result = deferred<ParentVerificationResult>(), h = harness(() => result.promise), request = h.gate.request(scope);
    h.gate.cancel();
    expect(await request).toEqual({ status: "cancelled" });
    result.resolve({ status: "verified", challenge: h.challenges[0] });
    await Promise.resolve(); await Promise.resolve();
    expect(h.gate.getSnapshot()).toEqual({ phase: "ready" });
    expect(h.signals[0].aborted).toBe(true);
  });
  it("is terminal after dispose and observes late rejection after cancellation", async () => {
    const result = deferred<ParentVerificationResult>(), h = harness(() => result.promise), request = h.gate.request(scope);
    h.gate.dispose();
    expect(await request).toEqual({ status: "disposed" });
    result.reject(new Error("synthetic-sensitive-native-error"));
    await Promise.resolve(); await Promise.resolve();
    h.gate.setContext(context); h.gate.cancel();
    expect(await h.gate.request(scope)).toEqual({ status: "disposed" });
    expect(h.gate.getSnapshot()).toEqual({ phase: "disposed" });
  });
  it("expires pending verification by its explicit timer and ignores subsequent secure bookkeeping", async () => {
    const result = deferred<ParentVerificationResult>(), h = harness(() => result.promise), request = h.gate.request(scope);
    await h.advance(2_000);
    expect(await request).toEqual({ status: "expired" });
    expect(h.signals[0].aborted).toBe(true);
    result.resolve({ status: "verified", challenge: h.challenges[0] });
    await Promise.resolve(); await Promise.resolve();
    expect(h.gate.getSnapshot()).toEqual({ phase: "ready" });
  });
  it("also checks verification expiry at response time without relying on timer delivery", async () => {
    const result = deferred<ParentVerificationResult>(), h = harness(() => result.promise), request = h.gate.request(scope);
    h.setTime(2_100);
    result.resolve({ status: "verified", challenge: h.challenges[0] });
    expect(await request).toEqual({ status: "expired" });
  });
  it.each([[1_099, true], [1_100, false], [1_101, false]] as const)
    ("uses the exclusive capability lifetime at monotonic time %i", async (time, allowed) => {
      const h = harness(), token = capability(await h.gate.request(scope)), work = vi.fn();
      h.setTime(time);
      expect(h.gate.consume(token, scope, work)).toBe(allowed);
      expect(work).toHaveBeenCalledTimes(allowed ? 1 : 0);
    });
  it.each([99, NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1])("permanently closes authority when the clock fails: %s", async time => {
    const h = harness(), token = capability(await h.gate.request(scope)), work = vi.fn();
    h.setTime(time);
    expect(h.gate.consume(token, scope, work)).toBe(false);
    h.setTime(200);
    expect(await h.gate.request(scope)).toEqual({ status: "unavailable" });
    expect(work).not.toHaveBeenCalled();
  });
  it("accepts finite fractional monotonic readings without converting to wall time", async () => {
    const h = harness(); h.setTime(100.25);
    const token = capability(await h.gate.request(scope));
    h.setTime(1_100.24);
    expect(h.gate.consume(token, scope, vi.fn())).toBe(true);
  });
  it("denies overflowing verification and capability deadline arithmetic", async () => {
    const initial = harness(); initial.setTime(Number.MAX_SAFE_INTEGER - 1);
    expect(await initial.gate.request(scope)).toEqual({ status: "unavailable" });
    expect(initial.verify).not.toHaveBeenCalled();
    const result = deferred<ParentVerificationResult>(), h = harness(() => result.promise);
    h.setTime(Number.MAX_SAFE_INTEGER - 2_001);
    const request = h.gate.request(scope);
    h.setTime(Number.MAX_SAFE_INTEGER - 999);
    result.resolve({ status: "verified", challenge: h.challenges[0] });
    expect(await request).toEqual({ status: "unavailable" });
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2_147_483_648])("requires an explicit valid timer policy: %s", duration => {
    const h = harness();
    expect(() => createParentGate({ ...h.options, policy: { ...h.options.policy, capabilityLifetimeMs: duration } })).toThrow();
    expect(() => createParentGate({ ...h.options, policy: { ...h.options.policy, verificationTimeoutMs: duration } })).toThrow();
  });
  it("never falls back to insecure randomness when the secure random source is unavailable", async () => {
    const h = harness(), gate = createParentGate({ ...h.options,
      randomSource: { getRandomValues() { throw new Error("synthetic-random-unavailable"); } } });
    gate.setContext(context);
    expect(await gate.request(scope)).toEqual({ status: "unavailable" });
    expect(h.verify).not.toHaveBeenCalled();
  });
  it("commits cancellation before a trusted port's synchronous reentrant cancel", async () => {
    let cancel = () => {};
    const h = harness(async challenge => { cancel(); return { status: "verified", challenge }; });
    cancel = h.gate.cancel;
    expect(await h.gate.request(scope)).toEqual({ status: "cancelled" });
    expect(h.gate.getSnapshot()).toEqual({ phase: "ready" });
  });
  it("does not let an abort listener reenter and be overwritten by an older request", async () => {
    const pending = deferred<ParentVerificationResult>();
    let reenter = () => {};
    const h = harness((_, signal) => { signal.addEventListener("abort", () => reenter(), { once: true }); return pending.promise; });
    const first = h.gate.request(scope);
    reenter = () => h.gate.setContext({ ...context, visibility: "background" });
    expect(await h.gate.request(scope)).toEqual({ status: "cancelled" });
    expect(await first).toEqual({ status: "cancelled" });
    expect(h.gate.getSnapshot()).toEqual({ phase: "sealed" });
    expect(h.verify).toHaveBeenCalledTimes(1);
  });
  it("burns before a callback can reentrantly reuse the same token or throw", async () => {
    const h = harness(), token = capability(await h.gate.request(scope)), second = vi.fn();
    const work = vi.fn(() => { expect(h.gate.consume(token, scope, second)).toBe(false); h.gate.cancel(); throw new Error("synthetic-private-error"); });
    expect(h.gate.consume(token, scope, work)).toBe(false);
    expect(work).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(h.gate.consume(token, scope, second)).toBe(false);
  });
  it("rejects unexpected async completion and observes its rejection after burning the token", async () => {
    const h = harness(), token = capability(await h.gate.request(scope));
    const work = vi.fn(async () => { throw new Error("synthetic-private-async-action-error"); });
    expect(h.gate.consume(token, scope, work)).toBe(false);
    h.gate.cancel();
    await Promise.resolve(); await Promise.resolve();
    expect(work).toHaveBeenCalledTimes(1);
    expect(h.gate.consume(token, scope, vi.fn())).toBe(false);
    expect(h.gate.getSnapshot()).toEqual({ phase: "ready" });
  });
  it("fences reentrant clock, scope and response inspection", async () => {
    const h = harness(), token = capability(await h.gate.request(scope)), work = vi.fn();
    const maliciousScope = new Proxy(scope, { getPrototypeOf() { h.gate.cancel(); return Object.prototype; } });
    expect(h.gate.consume(token, maliciousScope, work)).toBe(false);
    expect(work).not.toHaveBeenCalled();
    let gate!: ReturnType<typeof createParentGate>, calls = 0;
    gate = createParentGate({ ...h.options, clock: { nowMonotonicMs() { if (++calls === 3) gate.cancel(); return 100; } } });
    gate.setContext(context);
    expect(await gate.request(scope)).toEqual({ status: "cancelled" });
    let cancel = () => {};
    const port = harness(async challenge => new Proxy({ status: "verified", challenge } as const,
      { getPrototypeOf() { cancel(); return Object.prototype; } }));
    cancel = port.gate.cancel;
    expect(await port.gate.request(scope)).toEqual({ status: "cancelled" });
  });
  it("denies malformed contexts and requests without executing their getters", async () => {
    const h = harness(); let reads = 0;
    const getter = { ...scope };
    Object.defineProperty(getter, "action", { enumerable: true, get() { reads++; return "open-external"; } });
    for (const value of [true, null, [], "approved", { ...scope, parentGatePassed: true }, { ...scope, action: "constructor" },
      { ...scope, targetChecksum: "unknown" }, Object.create(scope), getter]) {
      expect((await h.gate.request(value)).status).not.toBe("verified");
    }
    for (const value of [true, null, { ...context, mode: "adult" }, { ...context, profileRevision: 0 },
      { ...context, routeRevision: NaN }, { ...context, approved: true }, Object.create(context)]) {
      h.gate.setContext(value);
      expect(await h.gate.request(scope)).toEqual({ status: "denied" });
    }
    expect(reads).toBe(0);
    expect(h.verify).not.toHaveBeenCalled();
  });
  it.each(["denied", "blocked", "unavailable"] as const)("retains the secure port's sanitized %s result", async status => {
    const h = harness(async () => ({ status }));
    expect(await h.gate.request(scope)).toEqual({ status });
  });
  it("keeps credentials, challenge identity and child details out of public snapshots and outcomes", async () => {
    const h = harness(async () => { throw new Error("synthetic-private-PIN-verifier-marker"); });
    const result = await h.gate.request(scope);
    expect(result).toEqual({ status: "unavailable" });
    const exposed = JSON.stringify({ snapshot: h.gate.getSnapshot(), result });
    expect(exposed).not.toContain("synthetic-private");
    expect(exposed).not.toContain(context.profileId);
    expect(exposed).not.toContain(scope.targetChecksum);
    expect(exposed).not.toContain(h.challenges[0].id);
    const success = harness(), token = capability(await success.gate.request(scope));
    expect(JSON.stringify(token)).toBe("{}");
    expect(Object.isFrozen(token)).toBe(true);
    expect(success.gate.getSnapshot()).toEqual({ phase: "authorized" });
  });
});
