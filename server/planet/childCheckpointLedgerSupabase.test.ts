import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { createCanonicalChildCheckpointLedger, type ChildCheckpointCaptureRequest, type ChildCheckpointReceipt } from "./childCheckpointLedgerSupabase";
import type { CanonicalSupabaseOptions } from "./supabase";

type MutableReceipt = { -readonly [Key in keyof ChildCheckpointReceipt]: ChildCheckpointReceipt[Key] };

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const project = "https://child-checkpoint-fixture.supabase.invalid";
const secret = "isolated-server-checkpoint-fixture", publishable = "isolated-publishable-checkpoint-fixture";
function request(): ChildCheckpointCaptureRequest {
  return { installationId: randomUUID(), authorityEpoch: randomUUID(), guardianSubject: randomUUID(), guardianSessionId: randomUUID(),
    guardianSessionEpoch: 2, expectedRevision: 4, expectedRecordSha256: hash("original full record"), operationSha256: hash("original " + randomUUID()),
    contextSha256: hash("original context"), nextRecordSha256: hash("next full record"), operationTimeoutMs: 5000 };
}
function captureReceipt(binding: ChildCheckpointCaptureRequest): ChildCheckpointReceipt {
  return { installation_id: binding.installationId, authority_epoch: binding.authorityEpoch, guardian_subject: binding.guardianSubject,
    guardian_session_id: binding.guardianSessionId, guardian_session_epoch: binding.guardianSessionEpoch, revision: binding.expectedRevision,
    record_sha256: binding.expectedRecordSha256, operation_sha256: binding.operationSha256, context_sha256: binding.contextSha256,
    next_record_sha256: binding.nextRecordSha256, captured_server_ms: 10000, server_time_ms: 10000, completed_server_ms: 10010,
    expires_at_ms: 10000 + binding.operationTimeoutMs };
}
const advanceReceipt = (binding: ChildCheckpointCaptureRequest): ChildCheckpointReceipt => ({ ...captureReceipt(binding),
  revision: binding.expectedRevision + 1, record_sha256: binding.nextRecordSha256, server_time_ms: 10005, completed_server_ms: 10006 });
interface Observation { url: string; method: string | undefined; cache: RequestCache | undefined; redirect: RequestRedirect | undefined;
  signal: AbortSignal | null | undefined; abortedAtSend: boolean | undefined; body: Record<string, unknown>; authorization: string | null; apiKey: string | null }
function fixture(timeoutMs = 1000) {
  let host = 0, local = 0;
  vi.spyOn(performance, "now").mockImplementation(() => host);
  const binding = request(), observations: Observation[] = [];
  let respond: (name: string) => Response | Promise<Response> = name => Response.json(name === "planet_capture_child_checkpoint" ? captureReceipt(binding) : advanceReceipt(binding));
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    observations.push({ url, method: init?.method, cache: init?.cache, redirect: init?.redirect, signal: init?.signal,
      abortedAtSend: init?.signal?.aborted, body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      authorization: headers.get("authorization"), apiKey: headers.get("apikey") });
    const pathParts = new URL(url).pathname.split("/"); return respond(pathParts[pathParts.length - 1]);
  });
  const options: CanonicalSupabaseOptions = { canonicalProjectUrl: project, publishableKey: publishable, serviceRoleKey: secret,
    recentAuthenticationSeconds: 300, fetch: fetcher };
  const policy = { timeoutMs, monotonicNow: () => local };
  const ledger = createCanonicalChildCheckpointLedger(options, policy);
  return { binding, ledger, options, policy, fetcher, observations,
    host(value: number) { host = value; }, local(value: number) { local = value; }, response(provider: typeof respond) { respond = provider; } };
}
const expectedArgs = (binding: ChildCheckpointCaptureRequest, capture: boolean) => ({ p_installation_id: binding.installationId,
  p_authority_epoch: binding.authorityEpoch, p_guardian_subject: binding.guardianSubject, p_guardian_session_id: binding.guardianSessionId,
  p_guardian_session_epoch: binding.guardianSessionEpoch, p_expected_revision: binding.expectedRevision, p_expected_record_sha256: binding.expectedRecordSha256,
  p_operation_sha256: binding.operationSha256, p_context_sha256: binding.contextSha256, p_next_record_sha256: binding.nextRecordSha256,
  ...(capture ? { p_operation_timeout_ms: binding.operationTimeoutMs } : {}) });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

// Installed Supabase/PostgREST SDK executes against injected local fetch only.
// No real service key, network, database, Auth/action/guardian proof, native
// clock, provisioning, device authority or recovery acceptance is represented.
describe("private canonical child checkpoint SDK transport", () => {
  it("constructs without I/O and sends only the exact canonical POST RPC tuples with fixed original server times", async () => {
    const f = fixture(); expect(f.fetcher).not.toHaveBeenCalled(); expect(Object.isFrozen(f.ledger)).toBe(true);
    const captured = await f.ledger.capture(f.binding), advanced = await f.ledger.advance(captured);
    expect(captured).toEqual(captureReceipt(f.binding)); expect(advanced).toEqual(advanceReceipt(f.binding));
    // Advance decision can precede the prior completion sample. The persisted
    // decision is the high-water; completion is deliberately validity-only.
    expect(advanced.server_time_ms).toBeLessThan(captured.completed_server_ms);
    expect(Object.isFrozen(captured)).toBe(true); expect(Object.isFrozen(advanced)).toBe(true);
    expect(f.observations).toHaveLength(2);
    for (const [index, observed] of f.observations.entries()) {
      expect(observed).toMatchObject({ url: project + "/rest/v1/rpc/planet_" + (index === 0 ? "capture" : "advance") + "_child_checkpoint",
        method: "POST", redirect: "error", cache: "no-store", abortedAtSend: false, authorization: "Bearer " + secret, apiKey: secret });
      expect(observed.body).toEqual(expectedArgs(f.binding, index === 0));
      expect(observed.signal).toBeInstanceOf(AbortSignal);
    }
    await expect(f.ledger.advance(captured)).rejects.toThrow("unavailable"); expect(f.fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects configuration/policy accessors and unknown fields without invoking getters or constructor I/O", () => {
    const f = fixture(); let reads = 0;
    for (const field of ["canonicalProjectUrl", "fetch"] as const) {
      const malicious = { ...f.options }; Object.defineProperty(malicious, field, { enumerable: true, get() { reads++; return f.options[field]; } });
      expect(() => createCanonicalChildCheckpointLedger(malicious, f.policy)).toThrow("unavailable");
    }
    const badPolicy = { ...f.policy }; Object.defineProperty(badPolicy, "monotonicNow", { enumerable: true, get() { reads++; return f.policy.monotonicNow; } });
    expect(() => createCanonicalChildCheckpointLedger(f.options, badPolicy)).toThrow("unavailable");
    expect(() => createCanonicalChildCheckpointLedger({ ...f.options, guessedProvider: true } as CanonicalSupabaseOptions, f.policy)).toThrow("unavailable");
    expect(() => createCanonicalChildCheckpointLedger({ ...f.options, canonicalProjectUrl: "https://other.invalid/path" }, f.policy)).toThrow();
    expect(() => createCanonicalChildCheckpointLedger(f.options, { ...f.policy, timeoutMs: 10001 })).toThrow("unavailable");
    expect(reads).toBe(0); expect(f.fetcher).not.toHaveBeenCalled();
  });

  it("denies descriptor/prototype/unknown/symbol request fields and malformed primitive coordinates before I/O", async () => {
    const f = fixture(); let reads = 0;
    const accessor = { ...f.binding }; Object.defineProperty(accessor, "contextSha256", { enumerable: true, get() { reads++; return f.binding.contextSha256; } });
    const inherited = Object.assign(Object.create({ ambient: true }), f.binding);
    const hidden = { ...f.binding }; Object.defineProperty(hidden, "operationSha256", { value: f.binding.operationSha256, enumerable: false });
    const malformed = [accessor, inherited, hidden, { ...f.binding, unknown: true }, { ...f.binding, [Symbol("ambient")]: true },
      ...["installationId", "authorityEpoch", "guardianSubject", "guardianSessionId"].map(field => ({ ...f.binding, [field]: "bundle.identity" })),
      { ...f.binding, installationId: f.binding.installationId.toUpperCase() }, { ...f.binding, expectedRevision: -1 },
      { ...f.binding, expectedRevision: 9007199254740990 }, { ...f.binding, guardianSessionEpoch: 1.5 },
      { ...f.binding, operationTimeoutMs: 0 }, { ...f.binding, operationTimeoutMs: 60001 },
      { ...f.binding, expectedRecordSha256: "A".repeat(64) }, { ...f.binding, operationSha256: "0".repeat(63) },
      { ...f.binding, contextSha256: null }, { ...f.binding, nextRecordSha256: f.binding.expectedRecordSha256 }];
    for (const value of malformed) await expect(f.ledger.capture(value as ChildCheckpointCaptureRequest)).rejects.toThrow("unavailable");
    expect(reads).toBe(0); expect(f.fetcher).not.toHaveBeenCalled();
    expect(await f.ledger.capture(f.binding)).toEqual(captureReceipt(f.binding));
  });

  it("detaches request/config/policy and provider output and freezes the exact primitive server tuple", async () => {
    const f = fixture(), original = { ...f.binding }, providerOutput = captureReceipt(original) as MutableReceipt;
    const parse = JSON.parse, sentinel = "detached-checkpoint-receipt";
    vi.spyOn(JSON, "parse").mockImplementation((text: string, reviver?: Parameters<typeof JSON.parse>[1]) => text === sentinel ? providerOutput : parse(text, reviver));
    f.response(() => new Response(sentinel));
    const pending = f.ledger.capture(f.binding);
    f.binding.contextSha256 = hash("mutated caller"); f.binding.nextRecordSha256 = hash("mutated caller next");
    f.options.fetch = vi.fn<typeof fetch>(() => { throw Error("mutated fetch must remain detached"); });
    f.policy.monotonicNow = () => { throw Error("mutated clock must remain detached"); }; f.policy.timeoutMs = 0;
    const captured = await pending;
    providerOutput.context_sha256 = hash("mutated provider"); providerOutput.expires_at_ms++;
    expect(captured).toEqual(captureReceipt(original)); expect(f.observations[0].body).toEqual(expectedArgs(original, true));
    expect(Object.isFrozen(captured)).toBe(true);
    expect(() => { (captured as { revision: number }).revision++; }).toThrow();
  });

  it("rejects accessor SDK data without invoking it and rejects copied/fabricated receipt identities before advance I/O", async () => {
    const f = fixture(); let reads = 0;
    const malicious = captureReceipt(f.binding), parse = JSON.parse, sentinel = "accessor-checkpoint-receipt";
    Object.defineProperty(malicious, "context_sha256", { enumerable: true, get() { reads++; return f.binding.contextSha256; } });
    vi.spyOn(JSON, "parse").mockImplementation((text: string, reviver?: Parameters<typeof JSON.parse>[1]) => text === sentinel ? malicious : parse(text, reviver));
    f.response(() => new Response(sentinel));
    await expect(f.ledger.capture(f.binding)).rejects.toThrow("unavailable");
    expect(reads).toBe(0); expect(f.fetcher).toHaveBeenCalledTimes(1);
    const copied = captureReceipt(f.binding); Object.defineProperty(copied, "revision", { enumerable: true, get() { reads++; return f.binding.expectedRevision; } });
    await expect(f.ledger.advance(copied)).rejects.toThrow("unavailable");
    expect(reads).toBe(0); expect(f.fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["binding", "revision", "digest", "renewal", "captured", "ordering", "exclusive", "unknown", "null"] as const)("rejects malformed capture receipt %s and burns the original attempt", async mode => {
    const f = fixture(), value = captureReceipt(f.binding) as unknown as Record<string, unknown>;
    if (mode === "binding") value.guardian_session_id = randomUUID();
    if (mode === "revision") value.revision = f.binding.expectedRevision + 1;
    if (mode === "digest") value.record_sha256 = f.binding.nextRecordSha256;
    if (mode === "renewal") value.expires_at_ms = Number(value.expires_at_ms) + 1;
    if (mode === "captured") value.captured_server_ms = 9007199254680991;
    if (mode === "ordering") value.server_time_ms = 10001;
    if (mode === "exclusive") value.completed_server_ms = value.expires_at_ms;
    if (mode === "unknown") value.signedAuthority = true;
    f.response(() => Response.json(mode === "null" ? null : value));
    await expect(f.ledger.capture(f.binding)).rejects.toThrow("unavailable");
    f.response(() => Response.json(captureReceipt(f.binding)));
    await expect(f.ledger.capture(f.binding)).rejects.toThrow("unavailable"); expect(f.fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["binding", "revision", "digest", "renewal", "captured", "rollback", "ordering", "exclusive", "null"] as const)("rejects malformed advance receipt %s without retry or optimistic success", async mode => {
    const f = fixture(), captured = await f.ledger.capture(f.binding), value = advanceReceipt(f.binding) as unknown as Record<string, unknown>;
    if (mode === "binding") value.context_sha256 = hash("changed context");
    if (mode === "revision") value.revision = f.binding.expectedRevision + 2;
    if (mode === "digest") value.record_sha256 = f.binding.expectedRecordSha256;
    if (mode === "renewal") value.expires_at_ms = captured.expires_at_ms + 1;
    if (mode === "captured") { value.captured_server_ms = captured.captured_server_ms + 1; value.expires_at_ms = captured.expires_at_ms + 1; }
    if (mode === "rollback") value.server_time_ms = captured.server_time_ms - 1;
    if (mode === "ordering") value.completed_server_ms = Number(value.server_time_ms) - 1;
    if (mode === "exclusive") value.completed_server_ms = captured.expires_at_ms;
    f.response(() => Response.json(mode === "null" ? null : value));
    await expect(f.ledger.advance(captured)).rejects.toThrow("unavailable");
    f.response(() => Response.json(advanceReceipt(f.binding)));
    await expect(f.ledger.advance(captured)).rejects.toThrow("unavailable"); expect(f.fetcher).toHaveBeenCalledTimes(2);
  });

  it("allows only its original receipt once, including concurrent attempts and another adapter's structurally identical copy", async () => {
    const f = fixture(), captured = await f.ledger.capture(f.binding);
    await expect(f.ledger.advance({ ...captured })).rejects.toThrow("unavailable");
    const other = createCanonicalChildCheckpointLedger(f.options, f.policy);
    await expect(other.advance(captured)).rejects.toThrow("unavailable"); expect(f.fetcher).toHaveBeenCalledTimes(1);
    const results = await Promise.allSettled([f.ledger.advance(captured), f.ledger.advance(captured)]);
    expect(results.map(result => result.status)).toEqual(["fulfilled", "rejected"]); expect(f.fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(["local", "host"] as const)("retains the original %s operation deadline after capture instead of granting a new advance budget", async clock => {
    const f = fixture(), captured = await f.ledger.capture(f.binding);
    if (clock === "local") f.local(f.binding.operationTimeoutMs); else f.host(f.binding.operationTimeoutMs);
    await expect(f.ledger.advance(captured)).rejects.toThrow("unavailable"); expect(f.fetcher).toHaveBeenCalledTimes(1);
  });

  it("starts the host budget before the first external clock callback and refuses callbacks that consumed it", async () => {
    let host = 0, clockCalls = 0; vi.spyOn(performance, "now").mockImplementation(() => host);
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(null)), binding = request();
    const ledger = createCanonicalChildCheckpointLedger({ canonicalProjectUrl: project, publishableKey: publishable, serviceRoleKey: secret,
      recentAuthenticationSeconds: 300, fetch: fetcher }, { timeoutMs: 100, monotonicNow() { clockCalls++; host = 100; return 0; } });
    await expect(ledger.capture(binding)).rejects.toThrow("unavailable");
    expect(clockCalls).toBeGreaterThan(0); expect(fetcher).not.toHaveBeenCalled();
  });

  it("denies pre-abort and abort during late provider resolution without installing a receipt or repeating I/O", async () => {
    const f = fixture(), aborted = new AbortController(); aborted.abort();
    await expect(f.ledger.capture(f.binding, aborted.signal)).rejects.toThrow("unavailable"); expect(f.fetcher).not.toHaveBeenCalled();
    const pendingBinding = { ...f.binding, operationSha256: hash("pending abort") }, controller = new AbortController();
    let resolve!: (response: Response) => void;
    f.response(() => new Promise<Response>(finish => { resolve = finish; }));
    const pending = f.ledger.capture(pendingBinding, controller.signal); const observed = pending.then(() => "accepted", () => "denied");
    await vi.waitFor(() => expect(f.fetcher).toHaveBeenCalledTimes(1)); controller.abort();
    expect(await observed).toBe("denied"); expect(f.observations[0].signal?.aborted).toBe(true);
    resolve(Response.json(captureReceipt(pendingBinding))); await Promise.resolve(); await Promise.resolve();
    await expect(f.ledger.capture(pendingBinding)).rejects.toThrow("unavailable"); expect(f.fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects abort in the last clock callback after SDK body decoding with observations outside callbacks", async () => {
    let host = 0, decoded = false, observedAbort = false; const controller = new AbortController();
    vi.spyOn(performance, "now").mockImplementation(() => host); const binding = request();
    const fetcher = vi.fn<typeof fetch>(async () => {
      const response = Response.json(captureReceipt(binding)), text = response.text.bind(response);
      response.text = async () => { const value = await text(); decoded = true; return value; }; return response;
    });
    const ledger = createCanonicalChildCheckpointLedger({ canonicalProjectUrl: project, publishableKey: publishable, serviceRoleKey: secret,
      recentAuthenticationSeconds: 300, fetch: fetcher }, { timeoutMs: 1000, monotonicNow() {
      if (decoded) { observedAbort = true; controller.abort(); } return 0;
    } });
    await expect(ledger.capture(binding, controller.signal)).rejects.toThrow("unavailable");
    expect(decoded).toBe(true); expect(observedAbort).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1); host = 0;
  });

  it.each(["rollback", "invalid", "throw"] as const)("rejects late local clock %s and permanently fails that adapter clock", async mode => {
    let decoded = false, observedFault = false; vi.spyOn(performance, "now").mockReturnValue(0); const binding = request();
    const fetcher = vi.fn<typeof fetch>(async () => {
      const response = Response.json(captureReceipt(binding)), text = response.text.bind(response);
      response.text = async () => { const value = await text(); decoded = true; return value; }; return response;
    });
    const ledger = createCanonicalChildCheckpointLedger({ canonicalProjectUrl: project, publishableKey: publishable, serviceRoleKey: secret,
      recentAuthenticationSeconds: 300, fetch: fetcher }, { timeoutMs: 1000, monotonicNow() {
      if (decoded) { observedFault = true; if (mode === "throw") throw Error("fixture clock"); return mode === "rollback" ? 9 : NaN; } return 10;
    } });
    await expect(ledger.capture(binding)).rejects.toThrow("unavailable");
    expect(decoded).toBe(true); expect(observedFault).toBe(true);
    await expect(ledger.capture({ ...binding, operationSha256: hash("after clock fault") })).rejects.toThrow("unavailable"); expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("bounds a fetch that ignores cancellation and refuses a late response without retries", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); const f = fixture(100);
    let resolve!: (response: Response) => void, markStarted!: () => void;
    const started = new Promise<void>(notify => { markStarted = notify; });
    f.response(() => new Promise<Response>(finish => { resolve = finish; markStarted(); }));
    const pending = f.ledger.capture(f.binding), observed = pending.then(() => "accepted", () => "denied");
    await started;
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(await observed).toBe("denied"); expect(f.observations[0].signal?.aborted).toBe(true);
    resolve(Response.json(captureReceipt(f.binding))); await Promise.resolve(); await Promise.resolve();
    await expect(f.ledger.capture(f.binding)).rejects.toThrow("unavailable"); expect(f.fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([["capture", "owner"], ["capture", "clock"], ["advance", "owner"], ["advance", "clock"]] as const)(
    "refuses %s after cleanup abort listener changed the %s, preserving the original call timeout", async (mode, action) => {
      const f = fixture(), owner = new AbortController();
      const captured = mode === "advance" ? await f.ledger.capture(f.binding) : undefined;
      let cleanupActions = 0, observedClock = 0;
      f.response(name => {
        const transport = f.observations[f.observations.length - 1].signal;
        transport?.addEventListener("abort", () => {
          cleanupActions++;
          if (action === "owner") owner.abort(); else { observedClock = 1000; f.local(observedClock); }
        }, { once: true });
        return Response.json(name === "planet_capture_child_checkpoint" ? captureReceipt(f.binding) : advanceReceipt(f.binding));
      });
      await expect(mode === "capture" ? f.ledger.capture(f.binding, owner.signal) : f.ledger.advance(captured!, owner.signal)).rejects.toThrow("unavailable");
      expect(cleanupActions).toBe(1);
      if (action === "owner") expect(owner.signal.aborted).toBe(true); else expect(observedClock).toBe(1000);
      expect(f.fetcher).toHaveBeenCalledTimes(mode === "capture" ? 1 : 2);
      // Spending survives cleanup refusal. Completion cannot mint a copy with
      // a renewed transport deadline or make another request for this original.
      if (mode === "capture") await expect(f.ledger.capture(f.binding)).rejects.toThrow("unavailable");
      else await expect(f.ledger.advance(captured!)).rejects.toThrow("unavailable");
      expect(f.fetcher).toHaveBeenCalledTimes(mode === "capture" ? 1 : 2);
    });

  it.each(["http", "throw", "late"] as const)("denies %s transport failure and performs no automatic or repeated original operation request", async mode => {
    const f = fixture();
    f.response(() => { if (mode === "throw") throw Error("ambiguous transport"); if (mode === "late") f.local(1000);
      return mode === "http" ? Response.json({ code: "P0001", message: "isolated refusal" }, { status: 503 }) : Response.json(captureReceipt(f.binding)); });
    await expect(f.ledger.capture(f.binding)).rejects.toThrow("unavailable");
    await expect(f.ledger.capture(f.binding)).rejects.toThrow("unavailable"); expect(f.fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps the spent registry bounded with no eviction or silent reset at its capacity", async () => {
    const f = fixture(), controller = new AbortController(); controller.abort();
    for (let index = 0; index < 2048; index++) {
      await expect(f.ledger.capture({ ...f.binding, operationSha256: hash("spent " + index) }, controller.signal)).rejects.toThrow("unavailable");
    }
    await expect(f.ledger.capture(f.binding)).rejects.toThrow("unavailable");
    await expect(f.ledger.capture({ ...f.binding, operationSha256: hash("spent 0") })).rejects.toThrow("unavailable");
    expect(f.fetcher).not.toHaveBeenCalled();
  });
});
