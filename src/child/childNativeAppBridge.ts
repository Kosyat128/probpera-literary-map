import { childDataArray, childRecord, decodeChildEntityPayload, decodeChildEntityReference,
  type ChildEntityPayload, type ChildEntityReference } from "./childPackage";
import { PARENT_GATE_ACTIONS, type ParentGateAction } from "./parentGate";
import { decodeChildNativeMediaAsset, decodeChildNativeMediaAssets, decodeChildNativeMediaLayout,
  decodeChildNativeMediaPresentation, decodeChildNativeMediaRetirement, childNativeMediaOwner, childNativeMediaToken,
  type ChildNativeMediaController } from "./childNativeMedia";
import { decodeChildNativeSceneSummaries, decodeChildNativeScene, decodeChildNativeSceneBudgetDecline, decodeChildNativeWebResource, decodeChildNativeModelWebResource, decodeChildNativeModelChunk, decodeChildNativeSceneRetired, childNativeSceneId,
  type ChildNativeScene, type ChildNativeSceneController, type ChildNativeSceneRecipient } from "./childNativeScene";
import { childNativeAppearanceRevision, childNativeAppearanceFromScene, sameChildNativeAppearance,
  decodeChildNativeProfileAppearance, decodeChildNativeAppearanceRestore } from "./childNativeAppearance";
import { childNativeJourneyId, childNativeJourneyRevision, decodeChildNativeJourneySummaries,
  decodeChildNativeProfileJourney, decodeChildNativeJourneyResult, type ChildNativeJourneyController } from "./childNativeJourney";
import { childNativeDiscoveryShelf, decodeChildNativeDiscovery, decodeChildNativePassport, decodeChildNativeCountryOpen,
  decodeChildNativeRemovalTarget, type ChildNativeDiscoveryController, type ChildNativePassportController } from "./childNativeDiscoveryPassport";
import { CHILD_NATIVE_EXPORT_IDLE, childNativeExportProfileId, decodeChildNativeExportReply,
  type ChildNativeExportReceipt, type ChildNativeExportState } from "./childNativeExport";
import localPolicy from "./childNativeLocalV2Policy.json";
import { decodeChildNativeRouteDownload } from "./childNativeOfflinePackages";
import { decodeChildNativeRouteSave } from "./childNativePassportProgram";
import type { PlatformServices, PreferenceStore } from "../platform/ports";

/** LOCAL V2 process authority is native. No V1 trusted wall/boot epoch or
 * protected snapshot/PIN secret crosses this Capacitor presentation boundary. */
export interface ChildNativeAppPlugin {
  bootstrap(request: unknown): Promise<unknown>;
  readContext(request: unknown): Promise<unknown>;
  perform(request: unknown): Promise<unknown>;
  retire(request: unknown): Promise<unknown>;
  readEntity(request: unknown): Promise<unknown>;
  search(request: unknown): Promise<unknown>;
  readCollection(request: unknown): Promise<unknown>;
  writeCollection(request: unknown): Promise<unknown>;
  listMedia?(request: unknown): Promise<unknown>;
  presentMedia?(request: unknown): Promise<unknown>;
  releaseMedia?(request: unknown): Promise<unknown>;
  listScenes?(request: unknown): Promise<unknown>;
  openScene?(request: unknown): Promise<unknown>;
  releaseScene?(request: unknown): Promise<unknown>;
  acquireWebResource?(request: unknown): Promise<unknown>;
  readWebResourceChunk?(request: unknown): Promise<unknown>;
  releaseWebResource?(request: unknown): Promise<unknown>;
  readSceneSelection?(request: unknown): Promise<unknown>;
  rememberSceneSelection?(request: unknown): Promise<unknown>;
  rollbackSceneSelection?(request: unknown): Promise<unknown>;
  restoreSceneSelection?(request: unknown): Promise<unknown>;
  listJourneys?(request: unknown): Promise<unknown>;
  readJourneyProgress?(request: unknown): Promise<unknown>;
  openJourney?(request: unknown): Promise<unknown>;
  advanceJourney?(request: unknown): Promise<unknown>;
  closeJourney?(request: unknown): Promise<unknown>;
  listDiscovery?(request: unknown): Promise<unknown>;
  readPassport?(request: unknown): Promise<unknown>;
  recordCountryOpen?(request: unknown): Promise<unknown>;
  saveJourneyRoute?(request: unknown): Promise<unknown>;
  readJourneyRouteDownload?(request: unknown): Promise<unknown>;
  resumeJourneyRoute?(request: unknown): Promise<unknown>;
  cancelJourneyRoute?(request: unknown): Promise<unknown>;
  addListener(event: "invalidated", listener: (value: unknown) => void): Promise<{ remove(): Promise<void> }>;
}
export const CHILD_NATIVE_LOCAL_POLICY_VERSION = localPolicy.version;
export const CHILD_NATIVE_LOCAL_POLICY_CHECKSUM = "2a9fb86861697ae053d0af87b40bdd53e2454700520a96d36a456414b9014d8c";
export type ChildNativeStatus = "first-install-required" | "unenrolled" | "adult" | "child" | "blocked-child" | "unavailable";
export type ChildNativeReason = "unavailable" | "pending" | "corrupt" | "unsupported" | "expired" | "missing-pins" | "cancelled" | "blocked";
export interface ChildNativeContext {
  readonly token: string; readonly generation: number; readonly revision: number;
  readonly selectionRevision: number; readonly profileRevision: number;
  readonly policyVersion: string; readonly policyChecksum: string;
  readonly mode: "adult" | "child"; readonly profileId: string | null; readonly locale: "ru" | "en";
  readonly package: Readonly<{ id: string; version: number; checksum: string }> | null;
  readonly home: ChildEntityReference | null; readonly remainingLifetimeMs: number;
}
export interface ChildNativeProfileSummary {
  readonly id: string; readonly label: string; readonly exactAge: number; readonly locale: "ru" | "en";
}
export interface ChildNativeAppSnapshot {
  readonly phase: "sealed" | "transition" | "ready" | "disposed";
  readonly status: ChildNativeStatus; readonly reason: ChildNativeReason | null;
  readonly context: ChildNativeContext | null; readonly profiles: readonly ChildNativeProfileSummary[];
}
export interface ChildNativeEntity {
  readonly reference: ChildEntityReference; readonly payload: ChildEntityPayload;
}
export type ChildNativeCollection = "favorites" | "recent" | "offline";
export interface ChildNativeCollectionValue {
  readonly revision: number; readonly references: readonly ChildEntityReference[];
}
export type ChildNativeAction = ParentGateAction | "first-install" | "enroll-pin" | "replace-pin" | "recover-pin" | "create-profile" | "enter-child";
export interface ChildNativeAppController {
  readonly discovery?: ChildNativeDiscoveryController;
  readonly passport?: ChildNativePassportController;
  readonly journeys?: ChildNativeJourneyController;
  readonly media?: ChildNativeMediaController;
  readonly scenes?: ChildNativeSceneController;
  /** A native save result only, never a context/PIN/content capability. */
  exportChildData?(profileId: string): Promise<ChildNativeExportReceipt | null>;
  getExportSnapshot?(): ChildNativeExportState;
  getSnapshot(): ChildNativeAppSnapshot;
  subscribe(listener: () => void): () => void;
  /** A concrete host synchronously clears old child content/routes/resources.
   * An inert canonical renderer may remain; native independently joins owners. */
  attachPresentationBarrier(clear: () => void): () => void;
  start(): Promise<void>;
  refresh(): Promise<void>;
  perform(action: ChildNativeAction, target?: unknown): Promise<boolean>;
  suspend(): Promise<void>;
  dispose(): Promise<void>;
  readEntity(reference: ChildEntityReference): Promise<ChildNativeEntity | null>;
  search(query: string): Promise<readonly ChildNativeEntity[] | null>;
  readCollection(collection: ChildNativeCollection): Promise<ChildNativeCollectionValue | null>;
  writeCollection(collection: ChildNativeCollection, expectedRevision: number,
    references: readonly ChildEntityReference[]): Promise<ChildNativeCollectionValue | null>;
}
const tokens = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{32}$/u.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/u.test(v);
const id = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(v);
const safe = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && !Object.is(v, -0) && v < Number.MAX_SAFE_INTEGER;
const positive = (v: unknown): v is number => safe(v) && v > 0;
const statuses: readonly string[] = ["first-install-required", "unenrolled", "adult", "child", "blocked-child", "unavailable"];
const reasons: readonly string[] = ["unavailable", "pending", "corrupt", "unsupported", "expired", "missing-pins", "cancelled", "blocked"];
const textKinds = new Set(["country", "writer", "biography", "work", "character", "storyworld", "fact", "quote",
  "activity", "quiz", "search-result", "recommendation", "favorite", "recent", "offline-package", "deep-link"]);
const contextFields = ["token", "generation", "revision", "selectionRevision", "profileRevision", "policyVersion",
  "policyChecksum", "mode", "profileId", "locale", "package", "home", "remainingLifetimeMs"];
const emptyProfiles: readonly ChildNativeProfileSummary[] = Object.freeze([]);
const sealed: ChildNativeAppSnapshot = Object.freeze({ phase: "sealed", status: "unavailable", reason: null, context: null, profiles: emptyProfiles });
function reference(value: unknown): ChildEntityReference | null {
  const ref = decodeChildEntityReference(value);
  return ref && textKinds.has(ref.kind) ? ref : null;
}
function refs(value: unknown, maximum = 64): readonly ChildEntityReference[] | null {
  const list = childDataArray(value, maximum);
  if (!list) return null;
  const copied = list.map(reference);
  if (copied.some(row => row === null) || new Set(copied.map(row => row!.kind + "/" + row!.id)).size !== copied.length) return null;
  return Object.freeze(copied as ChildEntityReference[]);
}
function entity(value: unknown): ChildNativeEntity | null {
  const row = childRecord(value, ["reference", "payload"]), ref = row && reference(row.reference);
  const payload = row && decodeChildEntityPayload(row.payload);
  if (!ref || !payload || payload.references.some(ref => !textKinds.has(ref.kind))) return null;
  return Object.freeze({ reference: ref, payload });
}
function collectionValue(value: unknown, maximum = 64): ChildNativeCollectionValue | null {
  const row = childRecord(value, ["revision", "references"]), references = row && refs(row.references, maximum);
  return row && safe(row.revision) && references ? Object.freeze({ revision: row.revision, references }) : null;
}
function summary(value: unknown): ChildNativeProfileSummary | null {
  const row = childRecord(value, ["id", "label", "exactAge", "locale"]);
  if (!row || !id(row.id) || typeof row.label !== "string" || row.label.length < 1 || row.label.length > 80
    || row.label.trim() !== row.label || /[\u0000-\u001f\u007f]/u.test(row.label)
    || !safe(row.exactAge) || row.exactAge < 3 || row.exactAge > 17 || row.locale !== "ru" && row.locale !== "en") return null;
  return Object.freeze(row as unknown as ChildNativeProfileSummary);
}
function context(value: unknown): ChildNativeContext | null {
  const row = childRecord(value, contextFields);
  if (!row || !tokens(row.token) || !positive(row.generation) || !positive(row.revision)
    || !positive(row.selectionRevision) || !positive(row.profileRevision)
    || row.policyVersion !== CHILD_NATIVE_LOCAL_POLICY_VERSION || row.policyChecksum !== CHILD_NATIVE_LOCAL_POLICY_CHECKSUM
    || row.mode !== "adult" && row.mode !== "child" || row.profileId !== null && !id(row.profileId)
    || row.locale !== "ru" && row.locale !== "en" || !positive(row.remainingLifetimeMs) || row.remainingLifetimeMs > 60_000) return null;
  const pkg = row.package === null ? null : childRecord(row.package, ["id", "version", "checksum"]);
  const home = row.home === null ? null : reference(row.home);
  if (row.package !== null && (!pkg || !id(pkg.id) || !positive(pkg.version) || !hash(pkg.checksum))
    || row.home !== null && (!home || home.kind !== "activity")
    || (pkg === null) !== (home === null) || row.mode === "adult" && (pkg !== null || home !== null)
    || row.mode === "child" && row.profileId === null) return null;
  return Object.freeze({ ...row, package: pkg ? Object.freeze(pkg) : null, home }) as unknown as ChildNativeContext;
}
/** A strict immutable projection of a correlated real native reply. A decoded
 * DTO alone cannot construct native admission, reset a PIN or repair storage. */
export function decodeChildNativeAppReply(value: unknown, requestId: string): ChildNativeAppSnapshot | null {
  try {
    const row = childRecord(value, ["version", "requestId", "status", "reason", "context", "profiles"]);
    if (!row || row.version !== 2 || row.requestId !== requestId || !tokens(requestId)
      || typeof row.status !== "string" || !statuses.includes(row.status)
      || row.reason !== null && (typeof row.reason !== "string" || !reasons.includes(row.reason))) return null;
    const rawProfiles = childDataArray(row.profiles, 4);
    if (!rawProfiles) return null;
    const profiles = rawProfiles.map(summary);
    if (profiles.some(p => p === null) || new Set(profiles.map(p => p!.id)).size !== profiles.length) return null;
    const current = row.context === null ? null : context(row.context);
    if (row.context !== null && !current) return null;
    const status = row.status as ChildNativeStatus;
    if (["first-install-required", "unavailable"].includes(status) ? current !== null || profiles.length !== 0
      : current === null) return null;
    if ((status === "adult" || status === "unenrolled") && (current!.mode !== "adult" || current!.package !== null)
      || status === "unenrolled" && profiles.length !== 0
      || status === "child" && (current!.mode !== "child" || !current!.package || !current!.home)
      || status === "blocked-child" && (current!.mode !== "child" || current!.package !== null)
      || current?.profileId !== null && current?.profileId !== undefined && !profiles.some(p => p!.id === current.profileId)) return null;
    return Object.freeze({ phase: status === "unavailable" ? "sealed" : "ready", status,
      reason: row.reason as ChildNativeReason | null, context: current,
      profiles: Object.freeze(profiles as ChildNativeProfileSummary[]) });
  } catch { return null; }
}
function randomId(): string {
  const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
  const result = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""); bytes.fill(0); return result;
}
function targetCopy(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  let nodes = 0;
  function copy(item: unknown, depth: number): unknown {
    if (++nodes > 4096 || depth > 12) throw new TypeError("Invalid native action target");
    if (item === null || typeof item === "boolean") return item;
    if (typeof item === "string" && item.length <= 32768 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(item)) return item;
    if (typeof item === "number" && safe(item)) return item;
    if (Array.isArray(item)) {
      const values = childDataArray(item, 64); if (!values) throw new TypeError("Invalid native action target");
      return Object.freeze(values.map(v => copy(v, depth + 1)));
    }
    if (item && typeof item === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(item))) {
      const descriptors = Object.getOwnPropertyDescriptors(item), output: Record<string, unknown> = Object.create(null);
      const fields = Reflect.ownKeys(descriptors);
      if (fields.length > 64) throw new TypeError("Invalid native action target");
      for (const field of fields) {
        if (typeof field !== "string" || !/^[a-zA-Z][a-zA-Z0-9]{0,63}$/u.test(field)
          || !descriptors[field].enumerable || !("value" in descriptors[field])) throw new TypeError("Invalid native action target");
        output[field] = copy(descriptors[field].value, depth + 1);
      }
      return Object.freeze(output);
    }
    throw new TypeError("Invalid native action target");
  }
  const copied = copy(value, 0);
  if (new TextEncoder().encode(JSON.stringify(copied)).byteLength > 65536) throw new TypeError("Invalid native action target");
  return copied;
}
export interface ChildNativeAppOptions {
  readonly plugin: ChildNativeAppPlugin | null;
  readonly lifecycle: Pick<PlatformServices, "getSnapshot" | "subscribe">;
  /** Test injection measures local timeout only, never PIN/rights/native time. */
  readonly nowMs?: () => number; readonly requestId?: () => string;
  readonly timeoutMs?: number;
}
/** One real host-lifetime controller. Native identities/clock/leases remain
 * native owned; this controller invalidates all JS observers before dispatch. */
export function createChildNativeAppController(options: ChildNativeAppOptions): ChildNativeAppController {
  const timeout = options.timeoutMs ?? 60_000, now = options.nowMs ?? (() => performance.now()), nextId = options.requestId ?? randomId;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 60_000) throw new RangeError("Invalid native child timeout");
  let snapshot = sealed, epoch = 0, expiry = 0, timer: ReturnType<typeof setTimeout> | null = null;
  let removalInFlight = false;
  let exportState = CHILD_NATIVE_EXPORT_IDLE;
  let pendingExport: { readonly profileId: string; readonly context: ChildNativeContext; readonly deadline: number;
    requestId: string | null; cancelled: boolean; dispatched: boolean } | null = null;
  const exportRequestIds = new Set<string>();
  let started = false, disposed = false, busy = false, uncertain = false, resumeAfterControl = false, visibility = options.lifecycle.getSnapshot().visibility;
  let lifecycleStop: (() => void) | null = null, barrier: (() => void) | null = null;
  let nativeEvents: { remove(): Promise<void> } | null = null;
  let retirement: Promise<boolean> | null = null, dataTail: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>(), deliveries = new Set<Promise<void>>();
  let mediaTouched = false, mediaRetirement: Promise<boolean> | null = null;
  let sceneTouched = false, sceneRetirement: Promise<boolean> | null = null;
  const sceneRecipients = new Set<ChildNativeSceneRecipient>(), sceneDrains = new Set<Promise<void>>();
  type SceneCleanupOwnership = { context: ChildNativeContext; retirement: Promise<boolean> | null; released: boolean };
  // Exact decoded DTO identity binds cleanup to its original admitted context.
  // A retired DTO only joins that context's actual native revocation receipt;
  // it cannot dispatch data, acquire resources, or admit a replacement context.
  const sceneOwnership = new WeakMap<ChildNativeScene, SceneCleanupOwnership>();
  const liveSceneOwnership = new Set<SceneCleanupOwnership>();
  function ownScene(scene: ChildNativeScene | null, context: ChildNativeContext) {
    if (scene) {
      const owner: SceneCleanupOwnership = { context, retirement: null, released: false };
      sceneOwnership.set(scene, owner); liveSceneOwnership.add(owner);
    }
    return scene;
  }
  function clearSceneRecipients() {
    for (const recipient of [...sceneRecipients]) {
      try {
        recipient.clear();
        const drain=Promise.resolve().then(()=>recipient.join());sceneDrains.add(drain);
        void drain.then(()=>sceneDrains.delete(drain),()=>{uncertain=true;});
      } catch { uncertain=true; }
    }
  }
  async function joinedSceneRecipients(): Promise<boolean> {
    try {await Promise.all([...sceneDrains]);return !uncertain;} catch {uncertain=true;return false;}
  }
  function revokeScenes(c: ChildNativeContext | null): Promise<boolean> {
    if(sceneRetirement)return sceneRetirement;
    if(!c||c.mode!=="child"||!sceneTouched)return Promise.resolve(true);
    if(typeof options.plugin?.releaseScene!=="function"){uncertain=true;return Promise.resolve(false);}
    const retiring = [...liveSceneOwnership].filter(owner => owner.context === c);
    const work=(async()=>{
      try {
        const original=request(),raw=await invoke("releaseScene",{...original,contextToken:c.token,sceneToken:null});
        const row=childRecord(raw,["version","requestId","status","contextToken","generation","value"]);
        const ok=!!row&&row.version===2&&row.requestId===original.requestId&&row.status==="ok"&&row.contextToken===c.token
          &&row.generation===c.generation&&decodeChildNativeSceneRetired(row.value,"sceneToken",null);
        if(ok) {
          sceneTouched=false;
          for (const owner of retiring) { owner.released=true; liveSceneOwnership.delete(owner); }
        }
        return ok;
      } catch {return false;}
    })();
    for (const owner of retiring) owner.retirement=work;
    sceneRetirement=work;void work.then(ok=>{if(ok&&sceneRetirement===work)sceneRetirement=null;});return work;
  }
  /** Null-token release is REVOCATION ONLY. Native entry conceals/increments
   * its own presentation epoch before enqueue, so a late decoder cannot paint
   * after the synchronous host seal. Success still requires actual native joins. */
  function revokeMedia(c: ChildNativeContext | null): Promise<boolean> {
    if (mediaRetirement) return mediaRetirement;
    if (!c || c.mode !== "child" || !mediaTouched || typeof options.plugin?.releaseMedia !== "function") return Promise.resolve(true);
    if(sceneTouched&&!sceneRetirement)clearSceneRecipients();
    const sceneRelease = revokeScenes(c);
    const work = (async () => {
      try {
        if(!await sceneRelease || !await joinedSceneRecipients())return false;
        const original = request(), raw = await invoke("releaseMedia", { ...original, contextToken: c.token, presentationToken: null });
        const row = childRecord(raw, ["version", "requestId", "status", "contextToken", "generation", "value"]);
        const ok = !!row && row.version === 2 && row.requestId === original.requestId && row.status === "ok"
          && row.contextToken === c.token && row.generation === c.generation && decodeChildNativeMediaRetirement(row.value, null);
        if (ok) mediaTouched = false;
        return ok;
      } catch { return false; }
    })();
    mediaRetirement = work;
    // Preserve an unsuccessful native revocation until the original context has
    // actually retired. A held decoder must not erase that result before perform.
    void work.then(ok => { if (ok && mediaRetirement === work) mediaRetirement = null; });
    return work;
  }
  function clearTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
  function publish(next: ChildNativeAppSnapshot) {
    snapshot = next;
    for (const listener of [...listeners]) if (listeners.has(listener)) {
      try { listener(); } catch { /* A presentation observer cannot grant native authority. */ }
    }
  }
  function observeExport(phase: ChildNativeExportState["phase"], receipt: ChildNativeExportReceipt | null = null) {
    exportState = Object.freeze({ phase, receipt }); publish(snapshot);
  }
  function cancelExport() {
    if (pendingExport) { pendingExport.cancelled = true; observeExport("unavailable"); }
  }
  function seal(reason: ChildNativeReason | null, phase: ChildNativeAppSnapshot["phase"] = "sealed") {
    const outgoing = snapshot.context;
    clearSceneRecipients();
    void revokeScenes(outgoing);
    void revokeMedia(outgoing);
    ++epoch; expiry = 0; clearTimer();
    snapshot = Object.freeze({ phase, status: "unavailable", reason, context: null, profiles: emptyProfiles });
    // Host barrier has no authorization return. Failure keeps native startup closed.
    try { barrier?.(); } catch { uncertain = true; }
    publish(snapshot);
  }
  function current(c: ChildNativeContext, generation: number): boolean {
    try { return !disposed && !busy && !uncertain && visibility === "active" && snapshot.phase === "ready"
      && snapshot.context === c && epoch === generation && now() < expiry; } catch { return false; }
  }
  async function invoke(method: Exclude<keyof ChildNativeAppPlugin, "addListener">, request: unknown): Promise<unknown> {
    const plugin = options.plugin; if (!plugin || typeof plugin[method] !== "function") throw new Error("Native child unavailable");
    let settled!: () => void; const completion = new Promise<void>(resolve => { settled = resolve; });
    deliveries.add(completion);
    const call = plugin[method];
    const raw = Promise.resolve().then(() => call!.call(plugin, request));
    void raw.then(() => { settled(); deliveries.delete(completion); }, () => { settled(); deliveries.delete(completion); });
    return new Promise((resolve, reject) => {
      const deadline = setTimeout(() => { uncertain = true; reject(new Error("Native child unavailable")); }, timeout);
      void raw.then(value => { clearTimeout(deadline); resolve(value); }, () => { clearTimeout(deadline); reject(new Error("Native child unavailable")); });
    });
  }

  async function registerNativeEvents(listener: (raw: unknown) => void): Promise<{ remove(): Promise<void> }> {
    const plugin = options.plugin;
    if (!plugin || typeof plugin.addListener !== "function") throw new Error("Native lifecycle unavailable");
    let closed = false, settle!: () => void;
    const completion = new Promise<void>(resolve => { settle = resolve; }); deliveries.add(completion);
    const raw = Promise.resolve().then(() => plugin.addListener("invalidated", listener));
    return new Promise((resolve, reject) => {
      const deadline = setTimeout(() => { closed = true; uncertain = true; reject(new Error("Native lifecycle unavailable")); }, timeout);
      void raw.then(async handle => {
        try {
          if (!handle || typeof handle.remove !== "function") throw new Error("Native lifecycle unavailable");
          if (closed || disposed) { await handle.remove(); if (!closed) reject(new Error("Native lifecycle unavailable")); }
          else resolve(handle);
        } catch { uncertain = true; reject(new Error("Native lifecycle unavailable")); }
        finally { clearTimeout(deadline); settle(); deliveries.delete(completion); }
      }, () => { clearTimeout(deadline); settle(); deliveries.delete(completion); reject(new Error("Native lifecycle unavailable")); });
    });
  }
  async function joinedDeliveries(): Promise<boolean> {
    const owned = [...deliveries]; if (!owned.length) return true;
    return new Promise(resolve => {
      let ended = false;
      const deadline = setTimeout(() => { if (!ended) { ended = true; resolve(false); } }, timeout);
      void Promise.all(owned).then(() => { if (!ended) { ended = true; clearTimeout(deadline); resolve(true); } });
    });
  }
  function request(): { version: 2; requestId: string } {
    const requestId = nextId(); if (!tokens(requestId)) throw new Error("Native request unavailable");
    return { version: 2, requestId };
  }
  async function retire(c: ChildNativeContext | null): Promise<boolean> {
    if (retirement) return retirement;
    const work = (async () => {
      try {
        // Cleanup failure must prevent a successor, never suppress native revocation.
        const sceneReleased=sceneRetirement?await sceneRetirement:true;
        const recipientsReleased=await joinedSceneRecipients();
        if (mediaRetirement) await mediaRetirement;
        const original = request(), raw = await invoke("retire", { ...original, contextToken: c?.token ?? null });
        const row = childRecord(raw, ["version", "requestId", "status", "contextToken"]);
        if (!row || row.version !== 2 || row.requestId !== original.requestId || row.status !== "retired"
          || row.contextToken !== (c?.token ?? null) || !await joinedDeliveries()) return false;
        mediaTouched = false; mediaRetirement = null;sceneTouched=false;sceneRetirement=null;
        return sceneReleased && recipientsReleased;
      } catch { return false; }
    })();
    retirement = work;
    const ok = await work;
    if (retirement === work) retirement = null;
    if (!ok) uncertain = true;
    return ok;
  }
  function admit(next: ChildNativeAppSnapshot, dispatchAt: number): boolean {
    if (disposed || uncertain || visibility !== "active" || next.phase !== "ready") {
      publish(Object.freeze({ ...sealed, reason: next.reason ?? "unavailable" })); return false;
    }
    const remaining = next.context?.remainingLifetimeMs;
    if (remaining !== undefined) {
      // Starting at dispatch is deliberately conservative; this never supplies
      // a native clock sample or refreshes an original native deadline.
      expiry = dispatchAt + remaining;
      if (!Number.isFinite(expiry) || now() >= expiry) return false;
      timer = setTimeout(() => {
        const previous = snapshot.context; seal("expired");
        // A successor is a fresh secure bootstrap after the actual native owner
        // has retired. No old token, scope or clock sample is renewed in place.
        void retire(previous).then(ok => { if (ok && !uncertain && !disposed && visibility === "active") void bootstrap(); });
      }, Math.max(1, expiry - now()));
    }
    publish(next); return true;
  }
  async function bootstrap(): Promise<void> {
    if (disposed || busy || uncertain || !barrier || visibility !== "active") return;
    busy = true; resumeAfterControl = false; const previous = snapshot.context; seal(null, "transition"); const originalEpoch = epoch;
    try {
      if (uncertain) throw new Error("Presentation retirement unavailable");
      if (retirement && !await retirement || previous && !await retire(previous)) throw new Error("Native retirement unavailable");
      if (disposed || uncertain || epoch !== originalEpoch || visibility !== "active") return;
      const original = request(), dispatched = now(), raw = await invoke("bootstrap", original);
      const next = decodeChildNativeAppReply(raw, original.requestId);
      if (disposed || epoch !== originalEpoch || !next || !await joinedDeliveries() || !admit(next, dispatched)) {
        seal(next?.reason ?? "unavailable"); if (!await retire(next?.context ?? null)) uncertain = true;
      }
    } catch { seal("unavailable"); await retire(null); }
    finally {
      busy = false;
      if (resumeAfterControl && !disposed && !uncertain && visibility === "active") { resumeAfterControl = false; void bootstrap(); }
    }
  }
  /** Native keeps all data and save-destination custody. An expected OS picker
   * pause seals JS but cannot turn this result into a renewed child context. */
  async function exportChildData(profileId: string): Promise<ChildNativeExportReceipt | null> {
    if (busy && pendingExport) { await suspend(); return null; }
    const c = snapshot.context;
    if (!childNativeExportProfileId(profileId) || !c || !current(c, epoch) || !barrier
      || snapshot.status === "unenrolled" || !snapshot.profiles.some(profile => profile.id === profileId)) return null;
    const original = { profileId, context: c, deadline: expiry, requestId: null as string | null, cancelled: false, dispatched: false };
    pendingExport = original; busy = true; resumeAfterControl = false; seal(null, "transition");
    const originalEpoch = epoch; observeExport("saving");
    const live = () => !disposed && !uncertain && pendingExport === original && !original.cancelled;
    try {
      await dataTail;
      if (sceneRetirement && !await sceneRetirement || !await joinedSceneRecipients()
        || mediaRetirement && !await mediaRetirement || retirement && !await retirement) throw new Error("Export retirement unavailable");
      if (!live() || epoch !== originalEpoch || visibility !== "active" || now() >= original.deadline) { await retire(c); return null; }
      const requestIdentity = request(), dispatched = now();
      if (!Number.isFinite(dispatched) || dispatched < 0 || exportRequestIds.size >= 2048 || exportRequestIds.has(requestIdentity.requestId))
        throw new Error("Export request identity unavailable");
      exportRequestIds.add(requestIdentity.requestId); original.requestId = requestIdentity.requestId; original.dispatched = true;
      const raw = await invoke("perform", { ...requestIdentity, contextToken: c.token, action: "export-child-data", target: Object.freeze({ profileId }) });
      if (!live()) return null;
      const receipt = decodeChildNativeExportReply(raw, requestIdentity.requestId, profileId), completed = now();
      if (!receipt || !Number.isFinite(completed) || completed < dispatched || completed >= original.deadline
        || completed >= dispatched + timeout || !await joinedDeliveries()) throw new Error("Export result unavailable");
      if (!live()) return null;
      const joinedAt = now();
      if (!Number.isFinite(joinedAt) || joinedAt < completed || joinedAt >= original.deadline || joinedAt >= dispatched + timeout)
        throw new Error("Export completion expired");
      // Spend this original result before observers can propose cancellation or
      // replacement. It contains no reusable host/context authority.
      pendingExport = null; resumeAfterControl = true; observeExport("complete", receipt);
      return receipt;
    } catch {
      if (original.dispatched) uncertain = true;
      observeExport("unavailable"); if (!disposed) seal("unavailable"); await retire(null); return null;
    } finally {
      if (pendingExport === original) pendingExport = null;
      if (exportState.phase === "saving") observeExport("unavailable");
      busy = false;
      if (resumeAfterControl && !disposed && !uncertain && visibility === "active") { resumeAfterControl = false; void bootstrap(); }
    }
  }
  async function suspend(): Promise<void> {
    cancelExport();
    const previous = snapshot.context; seal("blocked");
    if (!await retire(previous)) uncertain = true;
  }
  async function perform(action: ChildNativeAction, target?: unknown): Promise<boolean> {
    if (action === "export-child-data") {
      let row: Record<string, unknown> | null;
      try { row = childRecord(target, ["profileId"]); } catch { return false; }
      return !!row && childNativeExportProfileId(row.profileId) && (await exportChildData(row.profileId))?.outcome === "saved";
    }
    if (busy && pendingExport) { await suspend(); return false; }
    // A replacement proposal only cancels the accepted original removal. It
    // cannot replace its authenticated target or enqueue a second operation.
    if (busy && removalInFlight) { await suspend(); return false; }
    if (disposed || busy || uncertain || !barrier || visibility !== "active"
      || !(PARENT_GATE_ACTIONS as readonly string[]).includes(action)
        && !["first-install", "enroll-pin", "replace-pin", "recover-pin", "create-profile", "enter-child"].includes(action)) return false;
    const originalContext = snapshot.context, previousStatus = snapshot.status;
    if (previousStatus === "first-install-required" ? action !== "first-install"
      : snapshot.phase !== "ready" || !originalContext) return false;
    let copied: unknown;
    try { copied = targetCopy(target); } catch { return false; }
    if (["first-install", "enroll-pin", "replace-pin", "recover-pin"].includes(action) && copied !== null) return false;
    if (action === "delete-child-data") {
      const removal = decodeChildNativeRemovalTarget(copied);
      if (!removal || !snapshot.profiles.some(profile => profile.id === removal.profileId)) return false;
      copied = removal;
    }
    let dispatchedRemoval = false; removalInFlight = action === "delete-child-data"; busy = true; resumeAfterControl = false; const originalEpoch = epoch + 1; seal(null, "transition");
    try {
      if (uncertain) { await retire(originalContext); return false; }
      await dataTail;
      if(sceneRetirement&&!await sceneRetirement||!await joinedSceneRecipients()){await retire(originalContext);return false;}
      if (mediaRetirement && !await mediaRetirement) { await retire(originalContext); return false; }
      if (retirement && !await retirement) throw new Error("Native retirement unavailable");
      // Cleanup awaits may be interrupted by cancellation, backgrounding or
      // an invalidated generation. Never arm a gate for that retired proposal.
      if (disposed || uncertain || epoch !== originalEpoch || visibility !== "active") return false;
      const original = request(), dispatched = now();
      // Native perform independently captures, invalidates and joins the real
      // original loader, command workers and UI. No JS cleared/verified flag.
      dispatchedRemoval = action === "delete-child-data";
      const raw = await invoke("perform", { ...original, contextToken: originalContext?.token ?? null, action, target: copied });
      const next = decodeChildNativeAppReply(raw, original.requestId);
      if (dispatchedRemoval && !next) uncertain = true;
      if (disposed || epoch !== originalEpoch || !next || !await joinedDeliveries() || !admit(next, dispatched)) {
        // A long native parent UI can consume more than the conservative local
        // dispatch budget. Retire that exact decoded successor before a wholly
        // fresh secure read; no expired context is published or renewed.
        const freshAfterKnown = !disposed && !uncertain && epoch === originalEpoch && visibility === "active"
          && next?.phase === "ready" && next.context !== null
          && now() >= dispatched + next.context.remainingLifetimeMs;
        seal(next?.reason ?? "unavailable");
        if (await retire(next?.context ?? null) && freshAfterKnown) resumeAfterControl = true;
        return false;
      }
      return next.reason === null && next.status !== "blocked-child";
    } catch { if (dispatchedRemoval) uncertain = true; seal("unavailable"); await retire(null); return false; }
    finally {
      removalInFlight = false; busy = false;
      if (resumeAfterControl && !disposed && !uncertain && visibility === "active") { resumeAfterControl = false; void bootstrap(); }
    }
  }
  async function data<T>(method: "readEntity" | "search" | "readCollection" | "writeCollection" | "listMedia" | "presentMedia" | "releaseMedia" | "listScenes" | "openScene" | "releaseScene" | "acquireWebResource" | "readWebResourceChunk" | "releaseWebResource" | "readSceneSelection" | "rememberSceneSelection" | "rollbackSceneSelection" | "restoreSceneSelection" | "listJourneys" | "readJourneyProgress" | "openJourney" | "advanceJourney" | "closeJourney" | "listDiscovery" | "readPassport" | "recordCountryOpen" | "saveJourneyRoute" | "readJourneyRouteDownload" | "resumeJourneyRoute" | "cancelJourneyRoute",
    input: Record<string, unknown>, decode: (value: unknown) => T | null): Promise<T | null> {
    const c = snapshot.context, generation = epoch;
    if (!c || snapshot.status !== "child" || !c.package || !current(c, generation)) return null;
    const work = dataTail.then(async () => {
    if (!current(c, generation)) return null;
    let dispatched = false;
    try {
      const original = request(); dispatched = true;
      const raw = await invoke(method, { ...original, contextToken: c.token, ...input });
      if (!current(c, generation)) {
        if (["rememberSceneSelection", "rollbackSceneSelection", "openJourney", "advanceJourney", "recordCountryOpen", "saveJourneyRoute", "resumeJourneyRoute", "cancelJourneyRoute"].includes(method)) uncertain = true;
        return null;
      }
      const row = childRecord(raw, ["version", "requestId", "status", "contextToken", "generation", "value"]);
      if (!row || row.version !== 2 || row.requestId !== original.requestId || row.status !== "ok"
        || row.contextToken !== c.token || row.generation !== c.generation) throw new Error("Native data unavailable");
      const value = decode(row.value); if (value === null || !current(c, generation)) throw new Error("Native data unavailable");
      return value;
    } catch {
      // An uncorrelated save reply cannot tell us whether native committed.
      // Keep this controller sealed until a new host lifetime independently
      // reads native state; refresh/lifecycle must not replay an uncertain save.
      if (["rememberSceneSelection", "rollbackSceneSelection", "openJourney", "advanceJourney", "recordCountryOpen", "saveJourneyRoute", "resumeJourneyRoute", "cancelJourneyRoute"].includes(method) && dispatched) uncertain = true;
      if (snapshot.context === c) { seal("unavailable"); await retire(c); }
      return null;
    }
    });
    dataTail = work.then(() => undefined, () => undefined);
    return work;
  }
  return Object.freeze({
    discovery: Object.freeze({
      list(shelf) {
        const c = snapshot.context;
        if (!c?.profileId || !c.package || !childNativeDiscoveryShelf(shelf)
          || typeof options.plugin?.listDiscovery !== "function") return Promise.resolve(null);
        return data("listDiscovery", { shelf }, raw => decodeChildNativeDiscovery(raw, c, shelf));
      },
    } satisfies ChildNativeDiscoveryController),
    passport: Object.freeze({
      read() {
        const c = snapshot.context;
        if (!c?.profileId || !c.package || typeof options.plugin?.readPassport !== "function") return Promise.resolve(null);
        return data("readPassport", {}, raw => decodeChildNativePassport(raw, c));
      },
      recordCountryOpen(input) {
        const c = snapshot.context, copied = reference(input);
        if (!c?.profileId || !c.package || !copied || copied.kind !== "country"
          || typeof options.plugin?.recordCountryOpen !== "function") return Promise.resolve(null);
        return data("recordCountryOpen", { reference: copied }, raw => decodeChildNativeCountryOpen(raw, c, copied));
      },
      saveJourneyRoute(journeyId, expectedRevision) {
        const c = snapshot.context;
        if (!c?.profileId || !c.package || !childNativeJourneyId(journeyId) || !childNativeJourneyRevision(expectedRevision)
          || expectedRevision >= Number.MAX_SAFE_INTEGER - 1 || typeof options.plugin?.saveJourneyRoute !== "function") return Promise.resolve(null);
        return data("saveJourneyRoute", { journeyId, expectedRevision }, raw => decodeChildNativeRouteSave(raw, c, journeyId, expectedRevision)
          ?? decodeChildNativeRouteDownload(raw, c, journeyId, expectedRevision));
      },
      readJourneyRouteDownload(journeyId) {
        const c = snapshot.context;
        if (!c?.profileId || !c.package || !childNativeJourneyId(journeyId)
          || typeof options.plugin?.readJourneyRouteDownload !== "function") return Promise.resolve(null);
        return data("readJourneyRouteDownload", { journeyId }, raw => decodeChildNativeRouteDownload(raw, c, journeyId));
      },
      resumeJourneyRoute(journeyId, expectedRevision) {
        const c = snapshot.context;
        if (!c?.profileId || !c.package || !childNativeJourneyId(journeyId) || !childNativeJourneyRevision(expectedRevision)
          || expectedRevision >= Number.MAX_SAFE_INTEGER - 130 || typeof options.plugin?.resumeJourneyRoute !== "function") return Promise.resolve(null);
        return data("resumeJourneyRoute", { journeyId, expectedRevision }, raw => decodeChildNativeRouteDownload(raw, c, journeyId, expectedRevision));
      },
      cancelJourneyRoute(journeyId, expectedRevision) {
        const c = snapshot.context;
        if (!c?.profileId || !c.package || !childNativeJourneyId(journeyId) || !childNativeJourneyRevision(expectedRevision)
          || expectedRevision >= Number.MAX_SAFE_INTEGER - 130 || typeof options.plugin?.cancelJourneyRoute !== "function") return Promise.resolve(null);
        return data("cancelJourneyRoute", { journeyId, expectedRevision }, raw => decodeChildNativeRouteDownload(raw, c, journeyId, expectedRevision));
      },
    } satisfies ChildNativePassportController),
    journeys: Object.freeze({
      list() {
        const c=snapshot.context;
        if(!c?.profileId||!c.package||typeof options.plugin?.listJourneys!=="function")return Promise.resolve(null);
        return data("listJourneys",{},raw=>{
          const values=decodeChildNativeJourneySummaries(raw);
          return values&&values.every(row=>row.contentVersion===c.package!.version)?values:null;
        });
      },
      readProgress() {
        const c=snapshot.context;
        if(!c?.profileId||typeof options.plugin?.readJourneyProgress!=="function")return Promise.resolve(null);
        return data("readJourneyProgress",{},raw=>decodeChildNativeProfileJourney(raw,c.profileId!));
      },
      open(journeyId,expectedRevision) {
        const c=snapshot.context;
        if(!c?.profileId||!c.package||!childNativeJourneyId(journeyId)||!childNativeJourneyRevision(expectedRevision)
          ||typeof options.plugin?.openJourney!=="function")return Promise.resolve(null);
        return data("openJourney",{journeyId,expectedRevision},raw=>{
          const value=decodeChildNativeJourneyResult(raw,c.profileId!,journeyId,c.package!.version);
          return value&&(value.revision===expectedRevision||value.revision===expectedRevision+1)?value:null;
        });
      },
      advance(expectedRevision,journeyId,currentNodeId,action) {
        const c=snapshot.context;
        if(!c?.profileId||!c.package||!childNativeJourneyId(journeyId)||!childNativeJourneyRevision(expectedRevision)
          ||expectedRevision>=Number.MAX_SAFE_INTEGER-1||currentNodeId!==null&&!childNativeJourneyId(currentNodeId)
          ||action!=="complete"&&action!=="restart"||action==="complete"&&currentNodeId===null
          ||typeof options.plugin?.advanceJourney!=="function")return Promise.resolve(null);
        return data("advanceJourney",{expectedRevision,journeyId,currentNodeId,action},raw=>{
          const value=decodeChildNativeJourneyResult(raw,c.profileId!,journeyId,c.package!.version);
          if(!value)return null;
          if(value.status==="unavailable"||value.status==="absent")return value.revision===expectedRevision?value:null;
          if(value.revision!==expectedRevision+1)return null;
          return action==="complete"?value.progress?.completedNodeIds.includes(currentNodeId!)?value:null
            :value.progress?.currentNodeId===value.journey?.nodeIds[0]?value:null;
        });
      },
      async close() {
        if(typeof options.plugin?.closeJourney!=="function")return true;
        return await data("closeJourney",{},raw=>childRecord(raw,["status"])?.status==="retired"?true:null)===true;
      },
    } satisfies ChildNativeJourneyController),
    scenes:Object.freeze({
      readSelection() {
        const c=snapshot.context;
        if(!c?.profileId||typeof options.plugin?.readSceneSelection!=="function")return Promise.resolve(null);
        return data("readSceneSelection",{},raw=>decodeChildNativeProfileAppearance(raw,c.profileId!));
      },
      remember(scene,expectedRevision) {
        const c=snapshot.context,projected=childNativeAppearanceFromScene(scene);
        if(!c?.profileId||!projected||!childNativeMediaToken(scene.sceneToken)||sceneRetirement
          ||!childNativeAppearanceRevision(expectedRevision)||expectedRevision>=Number.MAX_SAFE_INTEGER-2
          ||typeof options.plugin?.rememberSceneSelection!=="function")return Promise.resolve(null);
        return data("rememberSceneSelection",{sceneToken:scene.sceneToken,expectedRevision},raw=>{
          const saved=decodeChildNativeProfileAppearance(raw,c.profileId!);
          return saved?.revision===expectedRevision+1&&saved.selection&&sameChildNativeAppearance(saved.selection,projected)?saved:null;
        });
      },
      rollback(scene, expectedRevision) {
        const c = snapshot.context;
        if (!c?.profileId || !childNativeMediaToken(scene.sceneToken) || sceneRetirement
          || !childNativeAppearanceRevision(expectedRevision) || expectedRevision >= Number.MAX_SAFE_INTEGER - 1
          || typeof options.plugin?.rollbackSceneSelection !== "function") return Promise.resolve(null);
        return data("rollbackSceneSelection", { sceneToken: scene.sceneToken, expectedRevision }, raw => {
          const saved = decodeChildNativeProfileAppearance(raw, c.profileId!);
          return saved?.revision === expectedRevision + 1 ? saved : null;
        });
      },
      restore(expected) {
        const c=snapshot.context;
        if(!c?.profileId||sceneRetirement||typeof options.plugin?.restoreSceneSelection!=="function")return Promise.resolve(null);
        const copied=decodeChildNativeProfileAppearance(expected,c.profileId);
        if(!copied)return Promise.resolve(null);
        // Even an uncertain reply may have minted native scene ownership.
        sceneTouched=true;
        return data("restoreSceneSelection",{expectedRevision:copied.revision},raw=>{
          const restored=decodeChildNativeAppearanceRestore(raw,c.profileId!,copied);
          if(restored?.scene)ownScene(restored.scene,c);
          return restored;
        });
      },
      list(owner) {
        const copied=childNativeMediaOwner(owner);if(!copied||typeof options.plugin?.listScenes!=="function")return Promise.resolve(null);
        return data("listScenes",{owner:copied},raw=>decodeChildNativeSceneSummaries(raw,copied));
      },
      open(owner,sceneId) {
        const c=snapshot.context,copied=childNativeMediaOwner(owner);
        if(!c||!copied||!childNativeSceneId(sceneId)||sceneRetirement||typeof options.plugin?.openScene!=="function")return Promise.resolve(null);
        sceneTouched=true;return data("openScene",{owner:copied,sceneId},raw=>ownScene(decodeChildNativeScene(raw,copied,sceneId),c));
      },
      acquire(scene,slot) {
        if(!childNativeMediaToken(scene.sceneToken)||sceneRetirement||typeof options.plugin?.acquireWebResource!=="function"
          ||![scene.skin,scene.stand.asset,scene.background.asset].includes(slot))return Promise.resolve(null);
        sceneTouched=true;
        return data("acquireWebResource",{sceneToken:scene.sceneToken,slotId:slot.slotId},raw=>decodeChildNativeWebResource(raw,scene,slot) ?? decodeChildNativeSceneBudgetDecline(raw,scene,slot,null));
      },
      acquireModel(scene,resource,tier) {
        const admitted=scene.modelPackage?.tiers.find(t=>t.tier===tier);
        if(!admitted || !admitted.models.some(m=>m.model===resource||m.dependencies.includes(resource))
          || !childNativeMediaToken(scene.sceneToken)||sceneRetirement||typeof options.plugin?.acquireWebResource!=="function")return Promise.resolve(null);
        sceneTouched=true;
        return data("acquireWebResource",{sceneToken:scene.sceneToken,slotId:resource.kind,assetId:resource.assetId,tier},raw=>decodeChildNativeModelWebResource(raw,scene,resource) ?? decodeChildNativeSceneBudgetDecline(raw,scene,resource,tier));
      },
      readModelChunk(scene,output,resource,offset,byteLength) {
        const owned=scene.modelPackage?.tiers.some(t=>t.models.some(m=>[m.model,...m.dependencies].includes(resource)));
        if(!owned || resource.kind==="texture" || output.sceneToken!==scene.sceneToken || output.assetId!==resource.assetId
          || !childNativeMediaToken(scene.sceneToken) || !childNativeMediaToken(output.resourceToken) || sceneRetirement
          || !Number.isSafeInteger(offset) || Object.is(offset,-0) || offset<0 || offset>=resource.encodedBytes
          || !Number.isSafeInteger(byteLength) || byteLength<1 || byteLength>65536 || byteLength>resource.encodedBytes-offset
          || typeof options.plugin?.readWebResourceChunk!=="function")return Promise.resolve(null);
        return data("readWebResourceChunk",{sceneToken:scene.sceneToken,resourceToken:output.resourceToken,offset,byteLength},raw=>decodeChildNativeModelChunk(raw,scene,output,resource,offset,byteLength));
      },
      async releaseResource(resourceToken) {
        if(resourceToken!==null&&!childNativeMediaToken(resourceToken))return false;
        return await data("releaseWebResource",{resourceToken},raw=>decodeChildNativeSceneRetired(raw,"resourceToken",resourceToken)?true:null)===true;
      },
      async release(sceneToken, scene) {
        if(sceneToken===null)return scene ? false : this.releaseAll();
        if(!childNativeMediaToken(sceneToken))return false;
        const owner=scene ? sceneOwnership.get(scene) : undefined;
        if(scene && (!owner || scene.sceneToken!==sceneToken))return false;
        if(owner?.retirement)return await owner.retirement;
        if(owner?.released)return true;
        if(owner && snapshot.context!==owner.context)return false;
        const released=await data("releaseScene",{sceneToken},raw=>decodeChildNativeSceneRetired(raw,"sceneToken",sceneToken)?true:null)===true;
        // A seal may occur while an ordinary release is queued/in flight. Its
        // exact original cohort's bulk ACK, never an absent context, can join it.
        if(owner?.retirement)return await owner.retirement;
        if(released && owner){owner.released=true;liveSceneOwnership.delete(owner);}
        return released;
      },
      async releaseAll() {
        const c=snapshot.context,ok=sceneRetirement?await sceneRetirement:await revokeScenes(c);await dataTail;
        if(!ok&&c&&snapshot.context===c){seal("unavailable");await retire(c);}return ok&&!uncertain;
      },
      attachRecipient(recipient) {
        if(!recipient||typeof recipient.clear!=="function"||typeof recipient.join!=="function")throw new TypeError("Concrete child renderer recipient required");
        sceneRecipients.add(recipient);return()=>{
          recipient.clear();sceneRecipients.delete(recipient);
          const drain=Promise.resolve().then(()=>recipient.join());sceneDrains.add(drain);
          void drain.then(()=>sceneDrains.delete(drain),()=>{uncertain=true;});
        };
      },
    } satisfies ChildNativeSceneController),
    media: Object.freeze({
      list(owner) {
        const copied = childNativeMediaOwner(owner); if (!copied || typeof options.plugin?.listMedia !== "function") return Promise.resolve(null);
        return data("listMedia", { owner: copied }, raw => decodeChildNativeMediaAssets(raw, copied));
      },
      async present(asset, layout) {
        const copied = decodeChildNativeMediaAsset(asset), geometry = decodeChildNativeMediaLayout(layout);
        if (!copied || !geometry || mediaRetirement || typeof options.plugin?.presentMedia !== "function") return null;
        const c = snapshot.context; if (!c || snapshot.status !== "child") return null;
        mediaTouched = true;
        return data("presentMedia", { owner: copied.owner, assetId: copied.assetId, layout: geometry },
          raw => decodeChildNativeMediaPresentation(raw, copied.assetId));
      },
      async release(presentationToken) {
        if (presentationToken === null) return this.releaseAll();
        if (!childNativeMediaToken(presentationToken) || typeof options.plugin?.releaseMedia !== "function") return false;
        clearSceneRecipients();
        if(!await revokeScenes(snapshot.context) || !await joinedSceneRecipients())return false;
        const value = await data("releaseMedia", { presentationToken }, raw =>
          decodeChildNativeMediaRetirement(raw, presentationToken) ? true : null);
        if (value) mediaTouched = false;
        return value === true;
      },
      async releaseAll() {
        const c = snapshot.context; if (!c || snapshot.status !== "child") return !mediaTouched;
        const ok = await revokeMedia(c);
        await dataTail;

        if (!ok && snapshot.context === c) { seal("unavailable"); await retire(c); }
        return ok && snapshot.context === c;
      },
    } satisfies ChildNativeMediaController),
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { if (disposed) return () => undefined; listeners.add(listener); return () => { listeners.delete(listener); }; },
    attachPresentationBarrier(clear: () => void) {
      if (barrier && barrier !== clear) throw new Error("A native child presentation owner already exists");
      barrier = clear; return () => { if (barrier === clear) barrier = null; };
    },
    async start() {
      if (started || disposed) return;
      if (!barrier) { publish(Object.freeze({ ...sealed, reason: "unavailable" })); return; }
      started = true;
      try {
        if (!options.plugin || typeof options.plugin.addListener !== "function") throw new Error("Native lifecycle unavailable");
        const registration = registerNativeEvents(raw => {
          const row = childRecord(raw, ["version", "contextToken", "generation", "reason"]), c = snapshot.context;
          if (!row || row.version !== 2 || row.contextToken !== null && !tokens(row.contextToken)
            || !safe(row.generation) || !["cancelled", "expired", "unavailable", "pending", "corrupt"].includes(row.reason as string)) {
            uncertain = true; cancelExport(); seal("unavailable"); void retire(c); return;
          }
          if (disposed || (c ? row.contextToken !== c.token || row.generation !== c.generation : !busy)) return;
          cancelExport();
          const reason = row.reason === "cancelled" ? "blocked" : row.reason as ChildNativeReason;
          if (busy) { resumeAfterControl = true; seal(reason); }
          else { seal(reason); void retire(c); }
        });
        const handle = await registration;
        if (!handle || typeof handle.remove !== "function") throw new Error("Native lifecycle unavailable");
        if (disposed) { await handle.remove(); return; }
        nativeEvents = handle;
      } catch { seal("unavailable"); return; }
      lifecycleStop = options.lifecycle.subscribe(() => {
        const next = options.lifecycle.getSnapshot().visibility;
        if (next === visibility) return; visibility = next;
        if (next === "background") {
          // Actual native owner UI may temporarily pause the app. During an
          // original control request its SDK owns that distinction; JS hides
          // every private tree, waits its real completion, then retires/restores.
          if (busy) { resumeAfterControl = true; seal("blocked"); } else void suspend();
        } else if (!uncertain) void bootstrap();
      });
      await bootstrap();
    },
    refresh: bootstrap, perform, suspend, exportChildData, getExportSnapshot: () => exportState,
    async dispose() {
      if (disposed) return; const previous = snapshot.context; disposed = true; cancelExport();
      lifecycleStop?.(); lifecycleStop = null; seal("blocked", "disposed");
      await retire(previous);
      try { await nativeEvents?.remove(); } catch { uncertain = true; }
      nativeEvents = null; barrier = null; listeners.clear();sceneRecipients.clear();
    },
    readEntity(ref: ChildEntityReference) {
      const copied = reference(ref); if (!copied) return Promise.resolve(null);
      return data("readEntity", { reference: copied }, raw => {
        const result = entity(raw); return result && result.reference.kind === copied.kind
          && result.reference.id === copied.id && result.reference.contentChecksum === copied.contentChecksum ? result : null;
      });
    },
    search(query: string) {
      if (typeof query !== "string" || query.length > 240 || /[\u0000-\u001f\u007f]/u.test(query)) return Promise.resolve(null);
      return data("search", { query }, raw => {
        const rows = childDataArray(raw, 64); if (!rows) return null;
        const result = rows.map(entity);
        return result.every(row => row && row.reference.kind === "search-result")
          && new Set(result.map(row => row!.reference.id)).size === result.length
          ? Object.freeze(result as ChildNativeEntity[]) : null;
      });
    },
    readCollection(collection: ChildNativeCollection) {
      if (!["favorites", "recent", "offline"].includes(collection)) return Promise.resolve(null);
      return data("readCollection", { collection }, raw => collectionValue(raw, collection === "recent" ? 100 : 64));
    },
    writeCollection(collection: ChildNativeCollection, expectedRevision: number, references: readonly ChildEntityReference[]) {
      const copied = refs(references);
      if (!["favorites", "recent", "offline"].includes(collection) || !safe(expectedRevision) || !copied) return Promise.resolve(null);
      return data("writeCollection", { collection, expectedRevision, references: copied }, raw => collectionValue(raw, collection === "recent" ? 100 : 64));
    },
  });
}
/** A child tree gets no adult history/download/Auth/session/link capability.
 * The original non-secret Booky size port stays read-only and stable. */
export function childNativePresentationServices(services: PlatformServices): PlatformServices {
  const preferences: PreferenceStore = Object.freeze({
    persistence: services.preferences.persistence,
    get: (key: string) => key === "probpera-booky-size-v1" ? services.preferences.get(key) : Promise.resolve(null),
    set: async () => false, remove: async () => false,
  });
  return Object.freeze({ kind: services.kind, channel: services.channel, preferences,
    getSnapshot: services.getSnapshot, subscribe: services.subscribe,
    getSystemLanguages: services.getSystemLanguages, openExternalLink: () => "blocked" as const });
}
