/** All protected actions required by binding V12 specification 11, section 8. */
export const PARENT_GATE_ACTIONS = Object.freeze([
  "exit-child-mode", "switch-adult-profile", "change-exact-age", "change-blocked-topics", "open-adult-store",
  "initiate-purchase", "restore-purchases", "open-external", "share", "account-change", "export-child-data",
  "delete-child-data", "diagnostics", "expand-access-settings", "enable-licensed-pack", "view-legal-commercial",
] as const);
export type ParentGateAction = typeof PARENT_GATE_ACTIONS[number];
export interface ParentGateContext {
  readonly profileId: string;
  readonly policyVersion: string;
  readonly profileRevision: number;
  readonly routeRevision: number;
  readonly mode: "child";
  readonly visibility: "active" | "background";
}
export interface ParentGateRequest {
  readonly action: ParentGateAction;
  /** Host-computed checksum of the exact protected action target/payload. */
  readonly targetChecksum: string;
}
export interface ParentGateChallenge extends ParentGateRequest {
  readonly id: string;
  readonly context: Readonly<ParentGateContext>;
  readonly generation: number;
  /** Verification deadline, exclusive; the capability has a separate private lifetime. */
  readonly expiresAtMonotonicMs: number;
}
export type ParentVerificationResult = Readonly<{ status: "verified"; challenge: ParentGateChallenge }>
  | Readonly<{ status: "denied" | "unavailable" | "blocked" }>;
/**
 * Trusted bootstrap dependency only, never supplied by a UI request. A real
 * implementation must use platform secure storage, a salted slow PIN verifier
 * and atomic durable attempt charging/increasing backoff BEFORE derivation.
 * A successful attempt must be durably finalized before returning the exact
 * captured challenge. Crash/restart and clock uncertainty must not reset those
 * penalties. PreferenceStore, raw booleans and Family Link are not substitutes.
 * No implementation of that secure storage or PIN verification is provided here.
 */
export interface ParentVerificationPort {
  verify(challenge: ParentGateChallenge, signal: AbortSignal): Promise<ParentVerificationResult>;
}
export interface ParentGateClock { nowMonotonicMs(): number }
export interface ParentGateRandomSource { getRandomValues(bytes: Uint8Array): Uint8Array }
export interface ParentGateOptions {
  readonly verificationPort?: ParentVerificationPort;
  readonly clock: ParentGateClock;
  /** Explicit operational policy; no production timing/backoff values are invented. */
  readonly policy: Readonly<{ capabilityLifetimeMs: number; verificationTimeoutMs: number }>;
  /** Trusted private host binding; ordinary hosts use WebCrypto, never Math.random. */
  readonly randomSource?: ParentGateRandomSource;
}
declare const capabilityBrand: unique symbol;
export type ParentGateCapability = Readonly<{ [capabilityBrand]: true }>;
export type ParentGateOutcome = Readonly<{ status: "verified"; capability: ParentGateCapability }>
  | Readonly<{ status: "denied" | "unavailable" | "blocked" | "cancelled" | "expired" | "invalid" | "disposed" }>;
export type ParentGatePhase = "sealed" | "ready" | "verifying" | "authorized" | "blocked" | "unavailable" | "disposed";
export interface ParentGateSnapshot { readonly phase: ParentGatePhase }

const actions = new Set<string>(PARENT_GATE_ACTIONS);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/u.test(value);
const checksum = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const revision = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const timerDuration = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value)
  && value > 0 && value <= 2_147_483_647;
function dataObject(value: unknown, fields: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== fields.length || keys.some(key => typeof key !== "string" || !fields.includes(key)
    || !descriptors[key].enumerable || !("value" in descriptors[key]))) return null;
  const copy: Record<string, unknown> = Object.create(null);
  for (const field of fields) copy[field] = descriptors[field].value;
  return copy;
}
function parseContext(value: unknown): Readonly<ParentGateContext> | null {
  try {
    const data = dataObject(value, ["profileId", "policyVersion", "profileRevision", "routeRevision", "mode", "visibility"]);
    if (!data || !identifier(data.profileId) || !identifier(data.policyVersion) || !revision(data.profileRevision)
      || data.profileRevision < 1 || !revision(data.routeRevision) || data.mode !== "child"
      || data.visibility !== "active" && data.visibility !== "background") return null;
    return Object.freeze(data as unknown as ParentGateContext);
  } catch { return null; }
}
function parseRequest(value: unknown): Readonly<ParentGateRequest> | null {
  try {
    const data = dataObject(value, ["action", "targetChecksum"]);
    return data && typeof data.action === "string" && actions.has(data.action) && checksum(data.targetChecksum)
      ? Object.freeze(data as unknown as ParentGateRequest) : null;
  } catch { return null; }
}
function sameContext(a: ParentGateContext | null, b: ParentGateContext | null): boolean {
  return a === b || !!a && !!b && a.profileId === b.profileId && a.policyVersion === b.policyVersion
    && a.profileRevision === b.profileRevision && a.routeRevision === b.routeRevision
    && a.mode === b.mode && a.visibility === b.visibility;
}

/**
 * One-use in-memory action authority, not child/content/rights/entitlement
 * approval. Construction does no IO and starts sealed. Future trusted host
 * wiring must supply current context and cancel on Back, navigation, callbacks
 * and notifications; this unintegrated foundation proves none of those OS paths.
 * No PIN, verifier, challenge or child identity enters snapshots/logs/storage.
 * Abort fences late results; it does not prove native verification stopped.
 */
export function createParentGate(options: ParentGateOptions) {
  if (!options || typeof options.clock?.nowMonotonicMs !== "function"
    || !timerDuration(options.policy?.capabilityLifetimeMs) || !timerDuration(options.policy?.verificationTimeoutMs)) {
    throw new TypeError("Explicit valid Parent Gate clock and timing policy are required.");
  }
  if (options.verificationPort && typeof options.verificationPort.verify !== "function") {
    throw new TypeError("Invalid Parent Gate verification port.");
  }
  const readTime = options.clock.nowMonotonicMs.bind(options.clock);
  const verify = options.verificationPort?.verify.bind(options.verificationPort);
  const source = options.randomSource ?? globalThis.crypto;
  const random = source && typeof source.getRandomValues === "function" ? source.getRandomValues.bind(source) : null;
  const { capabilityLifetimeMs, verificationTimeoutMs } = options.policy;
  let context: Readonly<ParentGateContext> | null = null, generation = 0, disposed = false, brokenClock = false;
  let lastTime: number | null = null;
  let snapshot: ParentGateSnapshot = Object.freeze({ phase: "sealed" });
  type Authority = { challenge: ParentGateChallenge; expiresAt: number };
  let authorities = new WeakMap<object, Authority>();
  type Pending = { challenge: ParentGateChallenge; abort: AbortController; timer: ReturnType<typeof setTimeout> | null;
    resolve: (result: ParentGateOutcome) => void };
  let pending: Pending | null = null;
  const phase = (value: ParentGatePhase) => { if (snapshot.phase !== value) snapshot = Object.freeze({ phase: value }); };
  const basePhase = (): ParentGatePhase => disposed ? "disposed" : brokenClock ? "unavailable"
    : context?.visibility === "active" ? "ready" : "sealed";
  const outcome = (status: Exclude<ParentGateOutcome["status"], "verified">): ParentGateOutcome => Object.freeze({ status });
  const revoke = (status: Exclude<ParentGateOutcome["status"], "verified">): number => {
    const old = pending;
    pending = null;
    authorities = new WeakMap();
    if (generation >= Number.MAX_SAFE_INTEGER) brokenClock = true;
    else generation += 1;
    const ticket = generation;
    phase(basePhase());
    // Commit all state before abort listeners, which may synchronously reenter.
    if (old) {
      if (old.timer !== null) clearTimeout(old.timer);
      old.resolve(outcome(status));
      old.abort.abort();
    }
    return ticket;
  };
  const now = (): number | null => {
    if (brokenClock || disposed) return null;
    let value: unknown;
    try { value = readTime(); } catch { value = undefined; }
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER
      || lastTime !== null && value < lastTime) {
      brokenClock = true; revoke("unavailable"); return null;
    }
    lastTime = value;
    return value;
  };
  const deadline = (start: number, duration: number): number | null => {
    const end = start + duration;
    if (!Number.isFinite(end) || end > Number.MAX_SAFE_INTEGER || end <= start) {
      brokenClock = true; revoke("unavailable"); return null;
    }
    return end;
  };
  const current = (operation: Pending): boolean => pending === operation && !disposed && !brokenClock
    && !operation.abort.signal.aborted && generation === operation.challenge.generation
    && context === operation.challenge.context && context?.visibility === "active";
  const finish = (operation: Pending, status: Exclude<ParentGateOutcome["status"], "verified">) => {
    if (!current(operation)) return;
    pending = null;
    if (operation.timer !== null) clearTimeout(operation.timer);
    phase(status === "blocked" ? "blocked" : status === "unavailable" ? "unavailable" : basePhase());
    operation.resolve(outcome(status));
  };

  return Object.freeze({
    getSnapshot: (): ParentGateSnapshot => snapshot,
    setContext(value: unknown): void {
      const before = generation;
      const next = parseContext(value);
      if (disposed || generation !== before) return;
      if (!next || !sameContext(next, context)) { context = next; revoke("cancelled"); }
    },
    cancel(): void { if (!disposed) revoke("cancelled"); },
    dispose(): void { if (!disposed) { disposed = true; context = null; revoke("disposed"); } },
    request(value: unknown): Promise<ParentGateOutcome> {
      if (disposed) return Promise.resolve(outcome("disposed"));
      // Even an identical or malformed newer intent retires earlier authority.
      const ticket = revoke("cancelled"), scope = parseRequest(value);
      if (generation !== ticket || disposed) return Promise.resolve(outcome("cancelled"));
      if (!scope) return Promise.resolve(outcome("invalid"));
      if (!context || context.visibility !== "active") return Promise.resolve(outcome("denied"));
      if (brokenClock || !verify || !random) { phase("unavailable"); return Promise.resolve(outcome("unavailable")); }
      const requestContext = context, start = now();
      if (start === null) return Promise.resolve(outcome("unavailable"));
      const expiresAtMonotonicMs = deadline(start, verificationTimeoutMs);
      if (expiresAtMonotonicMs === null) return Promise.resolve(outcome("unavailable"));
      let id: string;
      try {
        const bytes = new Uint8Array(32);
        if (random(bytes) !== bytes) throw new Error("Unavailable random source.");
        id = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
      } catch {
        if (generation !== ticket || disposed || context !== requestContext) return Promise.resolve(outcome("cancelled"));
        phase("unavailable"); return Promise.resolve(outcome("unavailable"));
      }
      const startedAt = now();
      if (startedAt === null) return Promise.resolve(outcome("unavailable"));
      if (generation !== ticket || disposed || context !== requestContext) return Promise.resolve(outcome("cancelled"));
      if (startedAt >= expiresAtMonotonicMs) return Promise.resolve(outcome("expired"));
      const challenge: ParentGateChallenge = Object.freeze({ ...scope, id, context: requestContext,
        generation: ticket, expiresAtMonotonicMs });
      return new Promise(resolve => {
        const operation: Pending = { challenge, abort: new AbortController(), timer: null, resolve };
        pending = operation; phase("verifying");
        operation.timer = setTimeout(() => { if (current(operation)) revoke("expired"); }, expiresAtMonotonicMs - startedAt);
        let verified: Promise<ParentVerificationResult>;
        try { verified = Promise.resolve(verify(challenge, operation.abort.signal)); }
        catch { finish(operation, "unavailable"); return; }
        // Observe both promise paths, including late rejection after cancellation.
        void verified.then(result => {
          if (!current(operation)) return;
          const completedAt = now();
          if (completedAt === null || !current(operation)) return;
          if (completedAt >= challenge.expiresAtMonotonicMs) { revoke("expired"); return; }
          let data: Record<string, unknown> | null;
          try {
            const proof = dataObject(result, ["status", "challenge"]);
            data = proof?.status === "verified" ? proof : dataObject(result, ["status"]);
          } catch { data = null; }
          if (!current(operation)) return;
          if (!data) { finish(operation, "unavailable"); return; }
          if (data.status !== "verified") {
            finish(operation, data.status === "denied" || data.status === "blocked" || data.status === "unavailable"
              ? data.status : "unavailable"); return;
          }
          if (data.challenge !== challenge) { finish(operation, "denied"); return; }
          const expiresAt = deadline(completedAt, capabilityLifetimeMs);
          if (expiresAt === null || !current(operation)) return;
          const capability = Object.freeze(Object.create(null)) as ParentGateCapability;
          authorities.set(capability, { challenge, expiresAt });
          pending = null;
          if (operation.timer !== null) clearTimeout(operation.timer);
          phase("authorized");
          resolve(Object.freeze({ status: "verified", capability }));
        }, () => finish(operation, "unavailable")).catch(() => finish(operation, "unavailable"));
      });
    },
    /** Callback must return undefined synchronously. Unsupported async work may already have begun and needs its own cancellation boundary. */
    consume(capability: unknown, value: unknown, protectedCallback: () => void): boolean {
      if (!capability || typeof capability !== "object") return false;
      const authority = authorities.get(capability);
      if (!authority) return false;
      // Burn before parsing untrusted scope, reading a clock or invoking any callback.
      authorities.delete(capability);
      const oldGeneration = generation, ticket = revoke("cancelled");
      const scope = parseRequest(value);
      if (!scope || typeof protectedCallback !== "function" || disposed || brokenClock || generation !== ticket
        || authority.challenge.generation !== oldGeneration || context !== authority.challenge.context
        || context?.visibility !== "active" || scope.action !== authority.challenge.action
        || scope.targetChecksum !== authority.challenge.targetChecksum) return false;
      const consumedAt = now();
      if (consumedAt === null || generation !== ticket || context !== authority.challenge.context
        || consumedAt >= authority.expiresAt) return false;
      try {
        const result: unknown = protectedCallback();
        if (result !== undefined) {
          // A mistaken async callback cannot report successful synchronous use;
          // observe its rejection without exposing private action/native errors.
          void Promise.resolve(result).catch(() => {});
          return false;
        }
        return true;
      } catch { return false; }
    },
  });
}
