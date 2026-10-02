import { decodeChildProfiles, type LocalChildProfile } from "./childProfile";
import { decodeChildDataScope, sameChildDataScope, type ChildDataScope } from "./childDataNamespace";

export interface ChildStartupRoute {
  readonly kind: "home" | "country" | "writer" | "work" | "storyworld";
  readonly entityId: string | null;
}
export interface ChildStartupRequest { readonly locale: "ru" | "en"; readonly route: ChildStartupRoute }
export interface ChildSecureSelection {
  readonly schemaVersion: 1;
  readonly mode: "child";
  readonly selectionRevision: number;
  readonly profileId: string;
  readonly profileRevision: number;
  /** Digest of the authenticated profile registry, including parent topic rules. */
  readonly profileChecksum: string;
  readonly policyVersion: string;
  readonly policyChecksum: string;
}
export interface ChildStartupChallenge {
  readonly generation: number;
  readonly request: Readonly<ChildStartupRequest>;
}
export interface ChildSelectionChallenge extends ChildStartupChallenge { readonly selection: Readonly<ChildSecureSelection> }
export interface ChildPackageChallenge extends ChildSelectionChallenge { readonly profile: LocalChildProfile }
export interface ChildRouteChallenge extends ChildPackageChallenge { readonly scope: ChildDataScope; readonly validUntilEpochMs: number }

/** Constructor-owned authenticated native snapshot. Deletion/missing/newer data
 * must be unavailable, never an inferred adult mode or first-install permission.
 * All profile/policy changes advance protected selection/profile revisions and
 * their digests atomically. Preferences cannot implement this contract. */
export interface ChildSecureModePort {
  restore(challenge: ChildStartupChallenge, signal: AbortSignal): Promise<unknown>;
  // Success shape: {status:'restored', challenge:<same object>, selection:ChildSecureSelection}.
}
export interface ChildAuthenticatedProfilePort {
  /** Authenticate exact registry bytes/digest and revision from selection before
   * returning {status:'restored',challenge:<same>,registry:unknown}. No adult history. */
  restore(challenge: ChildSelectionChallenge, signal: AbortSignal): Promise<unknown>;
}
export interface ChildCurrentPolicyPort {
  /** Confirm independently current exact policy version/checksum; success is
   * {status:'verified',challenge:<same>}. A version string/UI flag is not proof. */
  verify(challenge: ChildSelectionChallenge, signal: AbortSignal): Promise<unknown>;
}
export interface ChildVerifiedPackagePort {
  /** Validate exact child-only package, current review/rights and every entity's
   * exact-age/topic/locale decision through its separate index before success:
   * {status:'verified',challenge:<same>,scope:ChildDataScope,validUntilEpochMs:number}.
   * Signature/integrity alone (including existing S08 fixtures) is insufficient.
   * Never fetch an adult index and hide its results after retrieval. */
  verify(challenge: ChildPackageChallenge, signal: AbortSignal): Promise<unknown>;
}
export interface ChildVerifiedRoutePort {
  /** Resolve the requested route only within the verified child package/index;
   * work/media access remains per entity. Success {status:'verified',challenge:<same>}. */
  verify(challenge: ChildRouteChallenge, signal: AbortSignal): Promise<unknown>;
}
export interface ChildStartupOptions {
  secureModePort?: ChildSecureModePort;
  profilePort?: ChildAuthenticatedProfilePort;
  policyPort?: ChildCurrentPolicyPort;
  packagePort?: ChildVerifiedPackagePort;
  routePort?: ChildVerifiedRoutePort;
  /** Independently trusted current epoch for review/rights freshness across
   * restarts, or adapters must establish that time and refuse uncertainty.
   * Ambient Date.now alone does not establish expiry admission. */
  clock: { nowEpochMs(): number };
  /** Explicit operational timeout, not a fabricated native calibration. */
  timeoutMs: number;
  /** Trusted host lifecycle input; absence must not imply a foreground app. */
  initialVisibility: "active" | "background";
}
export type ChildStartupOutcome = Readonly<{ status: "ready" | "sealed" | "cancelled" | "expired" | "disposed" }>;
export type ChildStartupSnapshot = Readonly<{ phase: "sealed" | "restoring" | "ready" | "disposed" }>;
export interface ChildReadyView { readonly profile: LocalChildProfile; readonly scope: ChildDataScope; readonly route: ChildStartupRoute }

const id = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/u.test(value);
const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const epoch = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;
function data(value: unknown, fields: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== fields.length || names.some(key => typeof key !== "string" || !fields.includes(key) ||
    !descriptors[key].enumerable || !("value" in descriptors[key]))) return null;
  const result: Record<string, unknown> = Object.create(null);
  for (const field of fields) result[field] = descriptors[field].value;
  return result;
}
function request(value: unknown): ChildStartupRequest | null {
  const parsed = data(value, ["locale", "route"]), route = parsed && data(parsed.route, ["kind", "entityId"]);
  if (!parsed || !route || parsed.locale !== "ru" && parsed.locale !== "en" ||
    typeof route.kind !== "string" || !["home", "country", "writer", "work", "storyworld"].includes(route.kind) ||
    (route.kind === "home" ? route.entityId !== null : !id(route.entityId))) return null;
  return Object.freeze({ locale: parsed.locale, route: Object.freeze(route as unknown as ChildStartupRoute) });
}
function selection(value: unknown): ChildSecureSelection | null {
  const parsed = data(value, ["schemaVersion", "mode", "selectionRevision", "profileId", "profileRevision", "profileChecksum", "policyVersion", "policyChecksum"]);
  if (!parsed || parsed.schemaVersion !== 1 || parsed.mode !== "child" || !positive(parsed.selectionRevision) || !id(parsed.profileId) ||
    !positive(parsed.profileRevision) || !hex(parsed.profileChecksum) || !id(parsed.policyVersion) || !hex(parsed.policyChecksum)) return null;
  return Object.freeze(parsed as unknown as ChildSecureSelection);
}
const sameSelection = (a: ChildSecureSelection, b: ChildSecureSelection) => JSON.stringify(a) === JSON.stringify(b);

/** Unintegrated child-only startup seam. It never emits adult readiness. There
 * are no OS adapters, actual reviewed content or frame/render guarantees here.
 * Snapshots report progress only and cannot authorize content. A future host
 * must seal and clear visible child content on all selection/lifecycle changes.
 * visitReady revalidates protected selection/policy/package/route before a
 * synchronous view handoff; async executors need a separate cancellation seam. */
export function createChildStartup(options: ChildStartupOptions) {
  if (!options || typeof options.clock?.nowEpochMs !== "function" || !positive(options.timeoutMs) || options.timeoutMs > 2_147_483_647 ||
    options.initialVisibility !== "active" && options.initialVisibility !== "background")
    throw new TypeError("Explicit valid child startup clock and timeout required");
  const clock = options.clock.nowEpochMs.bind(options.clock), timeoutMs = options.timeoutMs;
  const mode = options.secureModePort?.restore.bind(options.secureModePort), profiles = options.profilePort?.restore.bind(options.profilePort),
    policy = options.policyPort?.verify.bind(options.policyPort), packages = options.packagePort?.verify.bind(options.packagePort),
    routes = options.routePort?.verify.bind(options.routePort);
  let generation = 0, disposed = false, brokenClock = false, lastNow = -1, visible = options.initialVisibility === "active";
  let snapshot: ChildStartupSnapshot = Object.freeze({ phase: "sealed" });
  let ready: ChildRouteChallenge | null = null;
  type Operation = { generation: number; deadlineEpochMs: number; abort: AbortController; timer: ReturnType<typeof setTimeout> | null;
    resolve: (outcome: ChildStartupOutcome) => void };
  let pending: Operation | null = null;
  const result = (status: ChildStartupOutcome["status"]): ChildStartupOutcome => Object.freeze({ status });
  const phase = (value: ChildStartupSnapshot["phase"]) => { snapshot = Object.freeze({ phase: value }); };
  function seal(status: ChildStartupOutcome["status"]): number {
    const old = pending; pending = null; ready = null;
    if (generation === Number.MAX_SAFE_INTEGER) brokenClock = true; else generation++;
    const ticket = generation; phase(disposed ? "disposed" : "sealed");
    if (old) { if (old.timer !== null) clearTimeout(old.timer); old.resolve(result(status)); old.abort.abort(); }
    return ticket;
  }
  function now(): number | null {
    if (brokenClock || disposed) return null;
    try {
      const time = clock();
      if (!epoch(time) || time < lastNow) { brokenClock = true; seal("sealed"); return null; }
      lastNow = time; return time;
    } catch { brokenClock = true; seal("sealed"); return null; }
  }
  const current = (operation: Operation) => pending === operation && operation.generation === generation &&
    !operation.abort.signal.aborted && !disposed && !brokenClock && visible;
  function stop(operation: Operation, status: ChildStartupOutcome["status"]): void {
    if (current(operation)) seal(status);
  }
  async function pipeline(operation: Operation, intent: ChildStartupRequest, expected: ChildRouteChallenge | null): Promise<void> {
    if (!mode || !profiles || !policy || !packages || !routes) { stop(operation, "sealed"); return; }
    const signal = operation.abort.signal, challenge: ChildStartupChallenge = Object.freeze({ generation: operation.generation, request: intent });
    const modeProof = data(await mode(challenge, signal), ["status", "challenge", "selection"]);
    if (!current(operation)) return;
    const restored = modeProof?.status === "restored" && modeProof.challenge === challenge ? selection(modeProof.selection) : null;
    if (!current(operation)) return;
    if (!restored || expected && !sameSelection(restored, expected.selection)) { stop(operation, "sealed"); return; }
    const scoped: ChildSelectionChallenge = Object.freeze({ ...challenge, selection: restored });
    const profileProof = data(await profiles(scoped, signal), ["status", "challenge", "registry"]);
    if (!current(operation)) return;
    const at = now(); if (at === null || !current(operation)) return;
    const decoded = profileProof?.status === "restored" && profileProof.challenge === scoped ?
      decodeChildProfiles(profileProof.registry, { policyVersion: restored.policyVersion, now: at }) : null;
    if (!current(operation)) return;
    const profile = decoded?.registry?.profiles.find(row => row.id === restored.profileId);
    if (!profile || decoded?.registry?.activeProfileId !== restored.profileId) { stop(operation, "sealed"); return; }
    const policyProof = data(await policy(scoped, signal), ["status", "challenge"]);
    if (!current(operation)) return;
    if (policyProof?.status !== "verified" || policyProof.challenge !== scoped) { stop(operation, "sealed"); return; }
    const packageChallenge: ChildPackageChallenge = Object.freeze({ ...scoped, profile });
    const packageProof = data(await packages(packageChallenge, signal), ["status", "challenge", "scope", "validUntilEpochMs"]);
    if (!current(operation)) return;
    const scope = packageProof?.status === "verified" && packageProof.challenge === packageChallenge ? decodeChildDataScope(packageProof.scope) : null;
    const checkedAt = now(); if (checkedAt === null || !current(operation)) return;
    if (!scope || scope.profileId !== profile.id || scope.profileRevision !== restored.profileRevision || scope.exactAge !== profile.exactAge ||
      scope.locale !== intent.locale || scope.policyVersion !== restored.policyVersion || scope.policyChecksum !== restored.policyChecksum ||
      !epoch(packageProof!.validUntilEpochMs) || packageProof!.validUntilEpochMs <= checkedAt ||
      expected && !sameChildDataScope(expected.scope, scope)) { stop(operation, "sealed"); return; }
    const routeChallenge: ChildRouteChallenge = Object.freeze({ ...packageChallenge, scope, validUntilEpochMs: packageProof!.validUntilEpochMs as number });
    const routeProof = data(await routes(routeChallenge, signal), ["status", "challenge"]);
    if (!current(operation)) return;
    if (routeProof?.status !== "verified" || routeProof.challenge !== routeChallenge) { stop(operation, "sealed"); return; }
    // Recheck protected selection after all asynchronous child dependencies.
    const finalProof = data(await mode(challenge, signal), ["status", "challenge", "selection"]);
    if (!current(operation)) return;
    const finalSelection = finalProof?.status === "restored" && finalProof.challenge === challenge ? selection(finalProof.selection) : null;
    const completedAt = now(); if (completedAt === null || !current(operation)) return;
    if (!finalSelection || !sameSelection(restored, finalSelection)) { stop(operation, "sealed"); return; }
    if (completedAt >= routeChallenge.validUntilEpochMs || completedAt >= operation.deadlineEpochMs) { stop(operation, "expired"); return; }
    ready = routeChallenge; pending = null;
    if (operation.timer !== null) clearTimeout(operation.timer);
    phase("ready"); operation.resolve(result("ready"));
  }
  function begin(value: unknown, expected: ChildRouteChallenge | null): Promise<ChildStartupOutcome> {
    if (disposed) return Promise.resolve(result("disposed"));
    const ticket = seal("cancelled"); let intent: ChildStartupRequest | null;
    try { intent = request(value); } catch { intent = null; }
    if (generation !== ticket || disposed) return Promise.resolve(result("cancelled"));
    if (!visible) return Promise.resolve(result("sealed"));
    const startedAt = !intent || brokenClock ? null : now();
    if (startedAt === null) return Promise.resolve(result("sealed"));
    const deadlineEpochMs = startedAt + timeoutMs;
    if (!epoch(deadlineEpochMs) || deadlineEpochMs <= startedAt) { brokenClock = true; seal("sealed"); return Promise.resolve(result("sealed")); }
    if (generation !== ticket || disposed) return Promise.resolve(result("cancelled"));
    return new Promise(resolve => {
      const operation: Operation = { generation: ticket, deadlineEpochMs, abort: new AbortController(), timer: null, resolve };
      pending = operation; phase("restoring");
      operation.timer = setTimeout(() => { if (current(operation)) seal("expired"); }, timeoutMs);
      void pipeline(operation, intent!, expected).catch(() => stop(operation, "sealed"));
    });
  }
  return Object.freeze({
    getSnapshot(): ChildStartupSnapshot {
      if (ready) { const time = now(); if (time !== null && ready && time >= ready.validUntilEpochMs) seal("expired"); }
      return snapshot;
    },
    start(value: unknown): Promise<ChildStartupOutcome> { return begin(value, null); },
    invalidate(): void { if (!disposed) seal("cancelled"); },
    background(): void { if (!disposed) { visible = false; seal("cancelled"); } },
    foreground(): void { if (!disposed) { visible = true; seal("cancelled"); } },
    dispose(): void { if (!disposed) { disposed = true; seal("disposed"); } },
    async visitReady(callback: (view: ChildReadyView) => void): Promise<boolean> {
      const expected = ready;
      if (!expected || disposed || typeof callback !== "function") return false;
      const validation = begin(expected.request, expected), visitGeneration = generation;
      const outcome = await validation, captured = ready;
      if (outcome.status !== "ready" || !captured || captured.generation !== visitGeneration || generation !== visitGeneration) return false;
      const time = now();
      if (time === null || ready !== captured || time >= captured.validUntilEpochMs) { if (ready === captured) seal("expired"); return false; }
      try {
        const completion: unknown = callback(Object.freeze({ profile: captured.profile, scope: captured.scope, route: captured.request.route }));
        if (completion !== undefined) { void Promise.resolve(completion).catch(() => {}); return false; }
        return true;
      } catch { return false; }
    },
  });
}
