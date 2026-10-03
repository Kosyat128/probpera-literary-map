import { createClient } from "@supabase/supabase-js";
import { createCanonicalSupabaseServices, type CanonicalSupabaseOptions } from "./supabase";

export interface ChildCheckpointTransportPolicy { timeoutMs: number; monotonicNow: () => number }
export interface ChildCheckpointCaptureRequest {
  /** UUID coordinates use canonical lowercase, matching PostgreSQL receipts. */
  installationId: string; authorityEpoch: string; guardianSubject: string; guardianSessionId: string;
  guardianSessionEpoch: number; expectedRevision: number; expectedRecordSha256: string;
  operationSha256: string; contextSha256: string; nextRecordSha256: string; operationTimeoutMs: number;
}
export interface ChildCheckpointReceipt {
  readonly installation_id: string; readonly authority_epoch: string; readonly guardian_subject: string;
  readonly guardian_session_id: string; readonly guardian_session_epoch: number; readonly revision: number;
  readonly record_sha256: string; readonly operation_sha256: string; readonly context_sha256: string;
  readonly next_record_sha256: string; readonly captured_server_ms: number; readonly server_time_ms: number;
  readonly completed_server_ms: number; readonly expires_at_ms: number;
}
export type ChildCheckpointCaptureReceipt = Readonly<ChildCheckpointReceipt>;
export type ChildCheckpointAdvanceReceipt = Readonly<ChildCheckpointReceipt>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const MAX_COUNTER = 9007199254740990, MAX_EXPECTED = MAX_COUNTER - 1, MAX_CAPTURE_TIME = MAX_COUNTER - 60000;
const REQUEST_FIELDS = ["installationId", "authorityEpoch", "guardianSubject", "guardianSessionId", "guardianSessionEpoch", "expectedRevision", "expectedRecordSha256", "operationSha256", "contextSha256", "nextRecordSha256", "operationTimeoutMs"] as const;
const RECEIPT_FIELDS = ["installation_id", "authority_epoch", "guardian_subject", "guardian_session_id", "guardian_session_epoch", "revision", "record_sha256", "operation_sha256", "context_sha256", "next_record_sha256", "captured_server_ms", "server_time_ms", "completed_server_ms", "expires_at_ms"] as const;
const CONFIG_FIELDS = ["canonicalProjectUrl", "publishableKey", "serviceRoleKey", "recentAuthenticationSeconds"] as const;
const unavailable = () => new Error("Canonical child checkpoint ledger unavailable");
function data(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw unavailable();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw unavailable();
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (required.some(field => !Object.prototype.hasOwnProperty.call(descriptors, field)) || names.some(key => typeof key !== "string"
    || !required.includes(key) && !optional.includes(key) || !descriptors[key].enumerable || !("value" in descriptors[key]))) throw unavailable();
  const copy: Record<string, unknown> = Object.create(null);
  for (const name of names as string[]) copy[name] = descriptors[name].value;
  return copy;
}
const integer = (value: unknown, maximum: number): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
const uuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const hash = (value: unknown): value is string => typeof value === "string" && HASH.test(value);
function request(value: unknown): Readonly<ChildCheckpointCaptureRequest> {
  const copy = data(value, REQUEST_FIELDS);
  if (![copy.installationId, copy.authorityEpoch, copy.guardianSubject, copy.guardianSessionId].every(uuid)
    || ![copy.expectedRecordSha256, copy.operationSha256, copy.contextSha256, copy.nextRecordSha256].every(hash)
    || !integer(copy.guardianSessionEpoch, MAX_COUNTER) || !integer(copy.expectedRevision, MAX_EXPECTED)
    || !integer(copy.operationTimeoutMs, 60000) || copy.operationTimeoutMs < 1 || copy.nextRecordSha256 === copy.expectedRecordSha256) throw unavailable();
  return Object.freeze(copy) as unknown as Readonly<ChildCheckpointCaptureRequest>;
}
function receipt(value: unknown, binding: Readonly<ChildCheckpointCaptureRequest>, original?: ChildCheckpointCaptureReceipt): ChildCheckpointReceipt {
  const copy = data(value, RECEIPT_FIELDS);
  if (copy.installation_id !== binding.installationId || copy.authority_epoch !== binding.authorityEpoch
    || copy.guardian_subject !== binding.guardianSubject || copy.guardian_session_id !== binding.guardianSessionId
    || copy.guardian_session_epoch !== binding.guardianSessionEpoch || copy.operation_sha256 !== binding.operationSha256
    || copy.context_sha256 !== binding.contextSha256 || copy.next_record_sha256 !== binding.nextRecordSha256
    || copy.revision !== binding.expectedRevision + (original ? 1 : 0)
    || copy.record_sha256 !== (original ? binding.nextRecordSha256 : binding.expectedRecordSha256)
    || !integer(copy.captured_server_ms, MAX_CAPTURE_TIME) || !integer(copy.server_time_ms, MAX_COUNTER)
    || !integer(copy.completed_server_ms, MAX_COUNTER) || !integer(copy.expires_at_ms, MAX_COUNTER)
    || copy.server_time_ms < copy.captured_server_ms || copy.completed_server_ms < copy.server_time_ms
    || copy.completed_server_ms >= copy.expires_at_ms || copy.expires_at_ms !== copy.captured_server_ms + binding.operationTimeoutMs
    || (original ? copy.captured_server_ms !== original.captured_server_ms || copy.expires_at_ms !== original.expires_at_ms
      || copy.server_time_ms < original.server_time_ms : copy.server_time_ms !== copy.captured_server_ms)) throw unavailable();
  return Object.freeze(copy) as unknown as ChildCheckpointReceipt;
}
function rpcArgs(binding: Readonly<ChildCheckpointCaptureRequest>, capture: boolean): Readonly<Record<string, unknown>> {
  const copy: Record<string, unknown> = { p_installation_id: binding.installationId, p_authority_epoch: binding.authorityEpoch,
    p_guardian_subject: binding.guardianSubject, p_guardian_session_id: binding.guardianSessionId, p_guardian_session_epoch: binding.guardianSessionEpoch,
    p_expected_revision: binding.expectedRevision, p_expected_record_sha256: binding.expectedRecordSha256,
    p_operation_sha256: binding.operationSha256, p_context_sha256: binding.contextSha256, p_next_record_sha256: binding.nextRecordSha256 };
  if (capture) copy.p_operation_timeout_ms = binding.operationTimeoutMs;
  return Object.freeze(copy);
}

/** Private server transport only. Receipts are DB mechanics, never signed/native
 * authority, authenticated guardian/action proof, recovery or clock provenance.
 * Ambiguous failures burn the local attempt; no retry, reset or fallback occurs.
 * Caller Auth/action/provisioning validation and native absolute deadlines remain
 * independent requirements. Neither local clock is a trusted child clock. */
export function createCanonicalChildCheckpointLedger(options: CanonicalSupabaseOptions, policy: ChildCheckpointTransportPolicy) {
  const configData = data(options, CONFIG_FIELDS, ["fetch", "now"]), policyData = data(policy, ["timeoutMs", "monotonicNow"]);
  if (typeof configData.canonicalProjectUrl !== "string" || typeof configData.publishableKey !== "string" || typeof configData.serviceRoleKey !== "string"
    || !integer(configData.recentAuthenticationSeconds, 900) || configData.recentAuthenticationSeconds < 1
    || configData.fetch !== undefined && typeof configData.fetch !== "function" || configData.now !== undefined && typeof configData.now !== "function"
    || !integer(policyData.timeoutMs, 10000) || policyData.timeoutMs < 1 || typeof policyData.monotonicNow !== "function") throw unavailable();
  const config = Object.freeze(configData) as unknown as CanonicalSupabaseOptions;
  // Reuse canonical configuration/key policy and installed SDK without I/O.
  createCanonicalSupabaseServices(config);
  const origin = new URL(config.canonicalProjectUrl).origin, fetcher = config.fetch ?? globalThis.fetch;
  const timeoutMs = policyData.timeoutMs, localClock = policyData.monotonicNow as () => number;
  if (!globalThis.performance || typeof globalThis.performance.now !== "function") throw unavailable();
  const hostClock = globalThis.performance.now.bind(globalThis.performance);
  const aborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;
  if (!aborted) throw unavailable();
  let lastLocal = -1, lastHost = -1, failedClock = false, readingLocal = false, snapshotting = false;
  const spent = new Set<string>();
  type Original = { binding: Readonly<ChildCheckpointCaptureRequest>; localDeadline: number; hostDeadline: number; attempted: boolean };
  const originals = new WeakMap<object, Original>();
  function hostTime(): number {
    if (failedClock) throw unavailable();
    const value = hostClock();
    if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || value < lastHost) { failedClock = true; throw unavailable(); }
    lastHost = value; return value;
  }
  function localTime(): number {
    if (failedClock || readingLocal) { failedClock = true; throw unavailable(); }
    readingLocal = true;
    try {
      const value = localClock();
      if (failedClock || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || value < lastLocal) { failedClock = true; throw unavailable(); }
      lastLocal = value; return value;
    } catch { failedClock = true; throw unavailable(); }
    finally { readingLocal = false; }
  }
  function isAborted(signal?: AbortSignal): boolean {
    if (signal === undefined) return false;
    try { return aborted!.call(signal) as boolean; } catch { throw unavailable(); }
  }
  async function rpc(binding: Readonly<ChildCheckpointCaptureRequest>, capture: boolean, original: Original,
    startedHost: number, startedLocal: number, signal?: AbortSignal): Promise<ChildCheckpointReceipt> {
    const hostDeadline = Math.min(startedHost + timeoutMs, original.hostDeadline), localDeadline = Math.min(startedLocal + timeoutMs, original.localDeadline);
    if (!Number.isFinite(hostDeadline) || hostDeadline > Number.MAX_SAFE_INTEGER || !Number.isFinite(localDeadline) || localDeadline > Number.MAX_SAFE_INTEGER) throw unavailable();
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined, listener = false, settled = false;
    let cancel!: () => void;
    const cancelled = new Promise<never>((_, reject) => { cancel = () => { controller.abort(); reject(unavailable()); }; });
    // Cancellation can occur in a synchronous host clock callback before the
    // SDK promise is installed in the race. Keep that refusal observed too.
    void cancelled.catch(() => {});
    function current() {
      if (settled || controller.signal.aborted || isAborted(signal)) throw unavailable();
      const at = localTime(), hostAt = hostTime();
      // Final state check follows the last external clock callback.
      if (settled || controller.signal.aborted || isAborted(signal) || failedClock || at >= localDeadline || hostAt >= hostDeadline) throw unavailable();
    }
    try {
      if (isAborted(signal)) throw unavailable();
      if (signal) { EventTarget.prototype.addEventListener.call(signal, "abort", cancel, { once: true }); listener = true; }
      current(); timer = setTimeout(cancel, Math.max(0, hostDeadline - hostTime()));
      const name = capture ? "planet_capture_child_checkpoint" : "planet_advance_child_checkpoint";
      const serverFetch: typeof fetch = async (input, init) => {
        current();
        const endpoint = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        const method = init?.method ?? (input instanceof Request ? input.method : "GET");
        if (endpoint.origin !== origin || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
          || endpoint.pathname !== "/rest/v1/rpc/" + name || method !== "POST") throw unavailable();
        const response = await fetcher(input, { ...init, signal: controller.signal, redirect: "error", cache: "no-store" });
        current(); return response;
      };
      const service = createClient(config.canonicalProjectUrl, config.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: serverFetch },
      });
      const work = Promise.resolve(service.rpc(name, rpcArgs(binding, capture)).abortSignal(controller.signal).retry(false));
      const result = await Promise.race([work, cancelled]);
      current(); if (result.error) throw unavailable();
      const validated = receipt(result.data, binding, capture ? undefined : originalReceipt(original));
      current(); return validated;
    } catch { throw unavailable(); }
    finally {
      settled = true; if (timer !== undefined) clearTimeout(timer);
      if (listener && signal) EventTarget.prototype.removeEventListener.call(signal, "abort", cancel);
      controller.abort();
    }
  }
  // Capture identity is stored separately from immutable server fields. A copy
  // or another adapter's receipt has no authority to consume this attempt.
  const originalReceipts = new WeakMap<Original, ChildCheckpointCaptureReceipt>();
  function originalReceipt(original: Original): ChildCheckpointCaptureReceipt {
    const value = originalReceipts.get(original); if (!value) throw unavailable(); return value;
  }
  function completedCurrent(original: Original, startedHost: number, startedLocal: number, signal?: AbortSignal) {
    // rpc cleanup aborts its transport signal. Provider listeners can change
    // owner/clock synchronously there; publish only after their callbacks finish.
    if (isAborted(signal) || failedClock) throw unavailable();
    const at = localTime(), hostAt = hostTime();
    if (isAborted(signal) || failedClock || at >= Math.min(startedLocal + timeoutMs, original.localDeadline)
      || hostAt >= Math.min(startedHost + timeoutMs, original.hostDeadline)) throw unavailable();
  }
  return Object.freeze({
    async capture(value: ChildCheckpointCaptureRequest, signal?: AbortSignal): Promise<ChildCheckpointCaptureReceipt> {
      const startedHost = hostTime();
      if (snapshotting) throw unavailable();
      let binding: Readonly<ChildCheckpointCaptureRequest>;
      snapshotting = true; try { binding = request(value); } finally { snapshotting = false; }
      const key = [binding.installationId, binding.authorityEpoch, binding.guardianSubject, binding.operationSha256].join("/");
      if (spent.has(key) || spent.size >= 2048) throw unavailable();
      spent.add(key); if (isAborted(signal)) throw unavailable();
      const startedLocal = localTime();
      const original: Original = { binding, localDeadline: startedLocal + binding.operationTimeoutMs,
        hostDeadline: startedHost + binding.operationTimeoutMs, attempted: false };
      if (!Number.isFinite(original.localDeadline) || original.localDeadline > Number.MAX_SAFE_INTEGER || original.localDeadline <= startedLocal
        || !Number.isFinite(original.hostDeadline) || original.hostDeadline > Number.MAX_SAFE_INTEGER || original.hostDeadline <= startedHost) throw unavailable();
      const captured = await rpc(binding, true, original, startedHost, startedLocal, signal);
      completedCurrent(original, startedHost, startedLocal, signal);
      originals.set(captured, original); originalReceipts.set(original, captured); return captured;
    },
    async advance(captured: ChildCheckpointCaptureReceipt, signal?: AbortSignal): Promise<ChildCheckpointAdvanceReceipt> {
      const startedHost = hostTime();
      if (!captured || typeof captured !== "object") throw unavailable();
      const original = originals.get(captured); if (!original || original.attempted) throw unavailable();
      original.attempted = true; if (isAborted(signal)) throw unavailable();
      const startedLocal = localTime();
      const advanced = await rpc(original.binding, false, original, startedHost, startedLocal, signal);
      completedCurrent(original, startedHost, startedLocal, signal);
      return advanced;
    },
  });
}
