import { contentPackageCanonicalJson, contentPackageHash, inspectContentPackageEnvelope, normalizeContentPackageExpected,
  type ContentPackageEnvelope, type ContentPackageExpected } from "./contentPackageProtocol.mjs";
import { normalizeContentPackageBaseUrl, type ContentPackageFetch } from "./contentPackageTransport";
import type { createContentPackageCache, ContentPackageDownloadProgress } from "./contentPackageCache";
import { createDownloadNetworkPreference, type DownloadNetworkPreferenceSnapshot, type DownloadNetworkPolicy,
  type DownloadNetworkType, type DownloadPreferenceStore } from "./DownloadNetworkPreference";
import { contentDownloadOptionalPackages, type ContentDownloadRetention } from "./ContentDownloadRetention";
import { inspectContentPackage, type ContentPackageInspectionResult, type StagedContentInspection } from "./contentPackageInspection";

export interface ContentDownloadDescriptor {
  readonly id: string;
  readonly title: Readonly<{ ru: string; en: string }>;
  readonly envelope: ContentPackageEnvelope;
  readonly expected: ContentPackageExpected;
  readonly manifestSha256: string;
  readonly previous: Readonly<{ expected: ContentPackageExpected; manifestSha256: string }> | null;
  readonly baseUrl: string;
  readonly retention?: ContentDownloadRetention;
  /** Trusted semantic format opt-in, never inferred from generic QA bytes. */
  readonly inspection?: "adult-candidate-v1";
}
export type ContentDownloadPhase = "unchecked" | "checking" | "not-saved" | "downloading" | "verifying" | "pausing" | "paused" | "waiting-wifi" | "cancelling" | "saved" | "cancelled" | "error" | "unavailable" | "clearing" | "cleared" | "protected" | "clear-error" | "uninstalling" | "uninstalled" | "cleanup-pending" | "uninstall-error" | "update-available";
export interface ContentStorageSpace {
  readonly phase: "unchecked" | "checking" | "ready" | "unavailable";
  readonly availableBytes: number | null;
  readonly kind: "browser-estimate" | "device" | null;
}
export type ContentStorageSpaceReader = () => Promise<{ availableBytes: number; kind: "browser-estimate" | "device" }>;
export interface ContentDownloadLifecycle {
  getSnapshot(): { readonly visibility: "active" | "background"; readonly connectivity: "online" | "offline" | "unknown"; readonly networkType?: DownloadNetworkType };
  subscribe(listener: () => void): () => void;
}
export interface ContentDownloadItem {
  readonly id: string; readonly title: Readonly<{ ru: string; en: string }>;
  readonly phase: ContentDownloadPhase; readonly totalBytes: number; readonly completedBytes: number;
  readonly qaOnly: true;
  readonly optional: boolean;
  /** Exact observed selection, never silently refreshed after confirmation. */
  readonly removalReceipt: string | null;
  /** Version associated with the observed saved or retired selection. */
  readonly savedVersion: number | null;
  /** Small status only; detached package units are available through getInspection. */
  readonly inspection?: ContentDownloadInspection;
}
export interface ContentDownloadInspectionSummary {
  readonly unitCount: number; readonly diagnosticCount: number; readonly missingLocaleCount: number;
  readonly staleUnitCount: number; readonly removedUnitCount: number;
  readonly deliveredUnitsHash: string; readonly fullCandidateHash: string;
  readonly selectionRole: "current" | "rollback";
}
export interface ContentDownloadInspection {
  readonly phase: "unavailable" | "ready" | "inspecting" | "inspected" | "error";
  readonly manifestSha256: string | null; readonly selectionSha256: string | null;
  readonly summary: ContentDownloadInspectionSummary | null; readonly reason: string | null;
}
export interface ContentDownloadsSnapshot {
  readonly items: readonly ContentDownloadItem[];
  readonly available: boolean;
  readonly space: ContentStorageSpace;
  readonly network: DownloadNetworkPreferenceSnapshot & { readonly type: DownloadNetworkType };
}
export interface ContentDownloads {
  getSnapshot(): ContentDownloadsSnapshot;
  subscribe(listener: () => void): () => void;
  check(id: string): Promise<void>;
  download(id: string): Promise<void>;
  discard(id: string): Promise<void>;
  uninstall(id: string, selectionSha256: string): Promise<void>;
  inspect(id: string, selectionSha256: string): Promise<void>;
  getInspection(id: string): StagedContentInspection | null;
  checkSpace(): Promise<void>;
  loadNetworkPreference(): Promise<void>;
  setNetworkPolicy(policy: DownloadNetworkPolicy): Promise<void>;
  pause(id: string): void;
  cancel(id: string): void;
  dispose(): void;
}
export type ContentPackageCache = ReturnType<typeof createContentPackageCache>;

/** Trusted application configuration, never a downloaded source of authority. */
function descriptor(input: ContentDownloadDescriptor): ContentDownloadDescriptor {
  const source = JSON.parse(contentPackageCanonicalJson(input)) as ContentDownloadDescriptor;
  if (!/^[a-z0-9][a-z0-9._-]{0,95}$/u.test(source.id) || [source.title.ru, source.title.en].some(value => typeof value !== "string" || !value.trim() || value.length > 160)) throw new Error("invalid-content-download-descriptor");
  const expected = normalizeContentPackageExpected(source.expected);
  if (expected.namespace !== "adult") throw new Error("adult-download-controller-required");
  if (source.inspection !== undefined && source.inspection !== "adult-candidate-v1") throw new Error("invalid-content-inspection-format");
  const { manifest } = inspectContentPackageEnvelope(source.envelope, expected);
  if (source.manifestSha256 !== contentPackageHash(contentPackageCanonicalJson(manifest))) throw new Error("invalid-content-download-pin");
  if (source.previous) {
    const prior = normalizeContentPackageExpected(source.previous.expected);
    if (prior.packageId !== expected.packageId || prior.namespace !== "adult" || prior.version >= expected.version
      || !/^[a-f0-9]{64}$/u.test(source.previous.manifestSha256)) throw new Error("invalid-content-download-previous");
  }
  return { ...source, expected, baseUrl: normalizeContentPackageBaseUrl(source.baseUrl) };
}

/** A platform-lifetime controller. Closing a panel or changing RU/EN does not
 * cancel transfers. It cannot activate QA bytes or change the canonical archive. */
export function createContentDownloads(options: {
  readonly descriptors: readonly ContentDownloadDescriptor[];
  readonly createCache: (() => ContentPackageCache) | null;
  readonly fetch: ContentPackageFetch | null;
  readonly lifecycle?: ContentDownloadLifecycle;
  readonly preferences?: DownloadPreferenceStore;
  /** Display only, kept in memory and never sent to a server or persisted. */
  readonly readSpace?: ContentStorageSpaceReader | null;
}): ContentDownloads {
  if (!Array.isArray(options.descriptors) || options.descriptors.length > 16) throw new Error("content-download-list-limit");
  const descriptors = new Map<string, ContentDownloadDescriptor>();
  for (const input of options.descriptors) {
    const value = descriptor(input);
    if (descriptors.has(value.id)) throw new Error("duplicate-content-download");
    descriptors.set(value.id, value);
  }
  contentDownloadOptionalPackages([...descriptors.values()]);
  const unavailableInspection: ContentDownloadInspection = Object.freeze({ phase: "unavailable", manifestSha256: null,
    selectionSha256: null, summary: null, reason: null });
  const createCache = options.createCache, fetch = options.fetch;
  let cache: ContentPackageCache | undefined, disposed = false;
  let snapshot: ContentDownloadsSnapshot = Object.freeze({ available: !!createCache && !!fetch,
    network: Object.freeze({ policy: options.preferences ? "wifi-only" : "any-network", status: options.preferences ? "unloaded" : "session-only", type: "unknown" }),
    space: Object.freeze({ phase: "unchecked", availableBytes: null, kind: null }),
    items: Object.freeze([...descriptors.values()].map(value => Object.freeze({ id: value.id, title: Object.freeze({ ...value.title }),
      totalBytes: value.envelope.manifest.files.reduce((sum, file) => sum + file.bytes, 0), completedBytes: 0,
      phase: "unchecked" as ContentDownloadPhase, qaOnly: true as const, optional: value.retention === "optional", removalReceipt: null, savedVersion: null,
      ...(value.inspection ? { inspection: unavailableInspection } : {}) }))) });
  type RemovalTarget = { expected: ContentPackageExpected; manifestSha256: string; selectionSha256: string };
  const removalTargets = new Map<string, RemovalTarget>();
  type Task = { controller: AbortController; promise: Promise<void>; mode: "check" | "download" | "discard" | "uninstall";
    interruption: "pause" | "cancel" | "wifi" | null; selectionObserved: boolean };
  const listeners = new Set<() => void>(), pending = new Map<string, Task>();
  type InspectionTarget = RemovalTarget & { selectedCurrentManifestSha256: string };
  type InspectionTask = { controller: AbortController; promise: Promise<void>; target: InspectionTarget };
  const inspectionTargets = new Map<string, InspectionTarget>(), inspectionTasks = new Map<string, InspectionTask>();
  const inspectionViews = new Map<string, StagedContentInspection>();
  const scope = (value: ContentDownloadDescriptor) => contentPackageCanonicalJson({ packageId: value.expected.packageId,
    namespace: value.expected.namespace, childPolicy: value.expected.childPolicy });
  const scopes = new Map([...descriptors].map(([id, value]) => [id, scope(value)]));
  const inspectionRevisions = new Map<string, number>();
  let unsubscribeLifecycle: (() => void) | undefined;
  let spacePending: Promise<void> | undefined, cancelSpace: (() => void) | undefined;
  const networkPreference = createDownloadNetworkPreference(options.preferences, () => {
    if (disposed) return;
    snapshot = Object.freeze({ ...snapshot, network: Object.freeze({ ...snapshot.network, ...networkPreference.getSnapshot() }) });
    observeLifecycle(); notify();
  });
  function notify() {
    for (const listener of [...listeners]) { try { listener(); } catch { /* Observers cannot own downloads. */ } }
  }
  const receipt = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null;
  function inspectionStatus(id: string, value: ContentDownloadInspection) {
    snapshot = Object.freeze({ ...snapshot, items: Object.freeze(snapshot.items.map(item => item.id === id
      ? Object.freeze({ ...item, inspection: Object.freeze(value) }) : item)) });
  }
  // Delete ownership before aborting: an uncooperative read may settle later, and
  // abort callbacks/observers may synchronously start another controller action.
  function invalidateInspection(id: string): boolean {
    if (!descriptors.get(id)?.inspection) return false;
    const task = inspectionTasks.get(id), changed = inspectionTargets.has(id) || !!task || inspectionViews.has(id);
    inspectionTasks.delete(id); inspectionTargets.delete(id); inspectionViews.delete(id);
    if (changed) inspectionStatus(id, unavailableInspection);
    task?.controller.abort();
    return changed;
  }
  function invalidateInspectionScope(id: string) {
    for (const candidate of descriptors.keys()) if (scopes.get(candidate) === scopes.get(id)) invalidateInspection(candidate);
  }
  function nextInspectionRevision(id: string) {
    const key = scopes.get(id)!, revision = (inspectionRevisions.get(key) ?? 0) + 1;
    inspectionRevisions.set(key, revision);
    return revision;
  }
  function scopeHasUnobservedTask(id: string) {
    for (const [candidate, task] of pending) if (scopes.get(candidate) === scopes.get(id) && !task.selectionObserved) return true;
    return false;
  }
  function rememberInspection(id: string, target: { expected: ContentPackageExpected; manifestSha256: string },
    selectionSha256: unknown, selectedCurrentManifestSha256: unknown, revision: number) {
    if (disposed || !descriptors.get(id)?.inspection || inspectionRevisions.get(scopes.get(id)!) !== revision
      || scopeHasUnobservedTask(id) || networkState().visibility === "background") return;
    const selected = receipt(selectionSha256), current = receipt(selectedCurrentManifestSha256);
    if (!selected || !current) return;
    inspectionTargets.set(id, { expected: target.expected, manifestSha256: target.manifestSha256,
      selectionSha256: selected, selectedCurrentManifestSha256: current });
    inspectionStatus(id, { phase: "ready", manifestSha256: target.manifestSha256, selectionSha256: selected, summary: null, reason: null });
  }
  function update(id: string, phase: ContentDownloadPhase, completedBytes?: number, removalReceipt?: string | null, savedVersion?: number | null) {
    if (disposed) return;
    if (removalReceipt === null) removalTargets.delete(id);
    snapshot = Object.freeze({ ...snapshot, items: Object.freeze(snapshot.items.map(item => item.id === id
      ? Object.freeze({ ...item, phase, completedBytes: Math.min(item.totalBytes, Math.max(0, completedBytes ?? item.completedBytes)),
        removalReceipt: removalReceipt === undefined ? item.removalReceipt : removalReceipt,
        savedVersion: savedVersion === undefined ? item.savedVersion : savedVersion }) : item)) });
    notify();
  }
  function rememberSelection(id: string, target: { expected: ContentPackageExpected; manifestSha256: string }, selectionSha256: unknown, removable: boolean) {
    const observed = removable && descriptors.get(id)?.retention === "optional" ? receipt(selectionSha256) : null;
    if (observed) removalTargets.set(id, { expected: target.expected, manifestSha256: target.manifestSha256, selectionSha256: observed });
    else removalTargets.delete(id);
    return observed;
  }
  function inspect(id: string, selectionSha256: string): Promise<void> {
    if (disposed || !descriptors.get(id)?.inspection || !createCache) return Promise.resolve();
    attachLifecycle();
    const target = inspectionTargets.get(id);
    if (disposed || networkState().visibility === "background" || !target || target.selectionSha256 !== selectionSha256
      || scopeHasUnobservedTask(id)) return Promise.resolve();
    const existing = inspectionTasks.get(id);
    if (existing) return existing.promise;
    const controller = new AbortController(), signal = controller.signal;
    const task: InspectionTask = { controller, target, promise: Promise.resolve() };
    const owns = () => !disposed && inspectionTasks.get(id) === task && inspectionTargets.get(id) === target;
    let timeout = false, stop!: (value: ContentPackageInspectionResult) => void;
    const stopped = new Promise<ContentPackageInspectionResult>(resolve => { stop = resolve; });
    const abort = () => stop({ ok: false, reason: timeout ? "inspection-timeout" : "cancelled", activationAllowed: false });
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => { timeout = true; controller.abort(); }, 10_000);
    const failed = (reason: string) => {
      if (!owns()) return;
      inspectionViews.delete(id);
      inspectionStatus(id, { phase: "error", manifestSha256: target.manifestSha256, selectionSha256: target.selectionSha256, summary: null, reason });
      notify();
    };
    task.promise = Promise.resolve().then(async () => {
      if (!owns() || signal.aborted) return;
      cache ??= createCache();
      if (!owns() || signal.aborted) return;
      // A previous Check intentionally retains no large byte snapshot. This one
      // fresh read revalidates both the signed pin and the displayed receipt.
      const result = await Promise.race([inspectContentPackage({ cache, expected: target.expected,
        manifestSha256: target.manifestSha256, selectionSha256: target.selectionSha256, signal }), stopped]);
      if (!owns()) return;
      if (signal.aborted) { if (timeout) failed("inspection-timeout"); return; }
      if (!result.ok) { failed(result.reason); return; }
      if (result.view.selectedCurrentManifestSha256 !== target.selectedCurrentManifestSha256) { failed("selection-receipt-mismatch"); return; }
      const view = result.view;
      inspectionViews.set(id, view);
      const summary: ContentDownloadInspectionSummary = Object.freeze({ unitCount: view.units.length, diagnosticCount: view.diagnostics.length,
        missingLocaleCount: view.diagnostics.filter(value => value.kind === "missing-locale-counterpart").length,
        staleUnitCount: view.diagnostics.filter(value => value.kind === "excluded-stale-unit").length,
        removedUnitCount: view.diagnostics.filter(value => value.kind === "removed-unit").length,
        deliveredUnitsHash: view.deliveredUnitsHash, fullCandidateHash: view.fullCandidateHash, selectionRole: view.selectionRole });
      inspectionStatus(id, { phase: "inspected", manifestSha256: target.manifestSha256, selectionSha256: target.selectionSha256, summary, reason: null });
      notify();
    }).catch(() => failed("content-inspection-unavailable")).finally(() => {
      clearTimeout(timer); signal.removeEventListener("abort", abort);
      if (inspectionTasks.get(id) === task) inspectionTasks.delete(id);
    });
    // Own the task before notification: reentrant observers may start a recheck,
    // mutation or disposal while receiving this same inspecting snapshot.
    inspectionTasks.set(id, task); inspectionViews.delete(id);
    inspectionStatus(id, { phase: "inspecting", manifestSha256: target.manifestSha256, selectionSha256: target.selectionSha256, summary: null, reason: null });
    notify();
    return task.promise;
  }
  function checkSpace(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (spacePending) return spacePending;
    let finish!: (value?: Awaited<ReturnType<ContentStorageSpaceReader>>) => void;
    const operation = new Promise<void>(resolve => {
      let settled = false;
      const timer = setTimeout(() => finish(), 5000);
      finish = value => {
        if (settled) return;
        settled = true; clearTimeout(timer); cancelSpace = undefined;
        const valid = value && Number.isSafeInteger(value.availableBytes) && value.availableBytes >= 0
          && ["browser-estimate", "device"].includes(value.kind);
        if (!disposed) {
          snapshot = Object.freeze({ ...snapshot, space: Object.freeze(valid
            ? { phase: "ready", availableBytes: value.availableBytes, kind: value.kind }
            : { phase: "unavailable", availableBytes: null, kind: null }) });
          notify();
        }
        resolve();
      };
    });
    spacePending = operation;
    cancelSpace = () => finish();
    snapshot = Object.freeze({ ...snapshot, space: Object.freeze({ phase: "checking", availableBytes: null, kind: null }) });
    notify();
    void Promise.resolve().then(() => !disposed && options.readSpace ? options.readSpace() : undefined).then(finish, () => finish());
    void operation.then(() => { if (spacePending === operation) spacePending = undefined; });
    return operation;
  }
  function interrupt(id: string, reason: "pause" | "cancel" | "wifi") {
    const task = pending.get(id);
    if (!task || task.mode === "discard" || task.mode === "uninstall" || task.interruption === "cancel" || task.interruption === reason) return;
    task.interruption = reason;
    // Fence progress and reentrant observers before announcing the transition.
    task.controller.abort();
    update(id, reason === "cancel" ? "cancelling" : "pausing");
  }
  function networkState(): ReturnType<ContentDownloadLifecycle["getSnapshot"]> {
    try { return options.lifecycle?.getSnapshot() ?? { visibility: "active" as const, connectivity: "unknown" as const }; }
    catch { return { visibility: "active" as const, connectivity: "unknown" as const }; }
  }
  function requiresWifi() {
    const state = networkState();
    return !["unloaded", "loading"].includes(snapshot.network.status) && snapshot.network.policy === "wifi-only"
      && (state.networkType !== "wifi" || state.connectivity !== "online");
  }
  function observeLifecycle() {
    if (disposed) return;
    const state = networkState();
    const type = state.connectivity === "online" && ["wifi", "cellular", "ethernet"].includes(state.networkType ?? "") ? state.networkType! : "unknown";
    const changed = snapshot.network.type !== type;
    if (changed) snapshot = Object.freeze({ ...snapshot, network: Object.freeze({ ...snapshot.network, type }) });
    let inspectionChanged = false;
    if (state.visibility === "background") {
      for (const id of descriptors.keys()) inspectionChanged = invalidateInspection(id) || inspectionChanged;
    }
    for (const [id, task] of pending) {
      if (state.visibility === "background" || (task.mode === "download" && state.connectivity === "offline")) interrupt(id, "pause");
      else if (task.mode === "download" && requiresWifi()) interrupt(id, "wifi");
    }
    if (changed || inspectionChanged) notify();
    // Foreground/network recovery never restarts a transfer without a user action.
  }
  function detachLifecycle() {
    const unsubscribe = unsubscribeLifecycle;
    unsubscribeLifecycle = undefined;
    try { unsubscribe?.(); } catch { /* A host cleanup failure cannot change saved bytes. */ }
  }
  function attachLifecycle() {
    if (disposed) return;
    if (options.lifecycle && !unsubscribeLifecycle) {
      const unsubscribe = options.lifecycle.subscribe(observeLifecycle);
      if (disposed) { try { unsubscribe(); } catch { /* Disposal remains final. */ } return; }
      unsubscribeLifecycle = unsubscribe;
    }
    observeLifecycle();
  }
  function loadNetworkPreference() {
    if (disposed) return Promise.resolve();
    attachLifecycle();
    return networkPreference.load();
  }
  function run(id: string, mode: Task["mode"], selectionSha256?: string): Promise<void> {
    if (disposed || !descriptors.has(id)) return Promise.resolve();
    if (pending.has(id)) return pending.get(id)!.promise;
    const removalTarget = removalTargets.get(id);
    if (mode === "uninstall") {
      const displayed = snapshot.items.find(item => item.id === id)!;
      if (!displayed.optional || !receipt(selectionSha256) || displayed.removalReceipt !== selectionSha256
        || removalTarget?.selectionSha256 !== selectionSha256
        || !["saved", "update-available", "protected", "cleanup-pending"].includes(displayed.phase)) return Promise.resolve();
    }
    const item = descriptors.get(id)!, controller = new AbortController(), signal = controller.signal;
    let inspectionRevision = nextInspectionRevision(id), mutationStarted = false;
    const mutationCompleted = () => {
      if (!mutationStarted) return;
      mutationStarted = false;
      // Another row may have begun reading the old selection while this write
      // was pending. Retire that observation even after an ambiguous failure.
      inspectionRevision = nextInspectionRevision(id);
      invalidateInspectionScope(id);
    };
    const task: Task = { controller, promise: Promise.resolve(), mode, interruption: null, selectionObserved: false };
    const interruptedPhase = () => task.interruption === "pause" ? "paused" as const : task.interruption === "wifi" ? "waiting-wifi" as const : "cancelled" as const;
    task.promise = Promise.resolve().then(async () => {
      if (signal.aborted) { update(id, interruptedPhase()); return; }
      if (!createCache || (mode === "download" && !fetch)) { update(id, mode === "uninstall" ? "uninstall-error" : mode === "discard" ? "clear-error" : "unavailable", undefined, null); return; }
      if (mode === "uninstall") {
        cache ??= createCache();
        mutationStarted = true;
        const result = await cache.uninstall({ ...removalTarget!, selectionSha256: selectionSha256!, signal });
        mutationCompleted();
        // Retirement may have committed before cancellation or cleanup failure.
        // Its receipt is authoritative even if byte cleanup needs another try.
        update(id, result.ok ? result.cleanupComplete ? "uninstalled" : "cleanup-pending" : "uninstall-error",
          result.ok ? 0 : undefined, result.ok ? rememberSelection(id, removalTarget!, result.selectionSha256, true) : null,
          removalTarget!.expected.version);
        return;
      }
      if (mode === "discard") {
        cache ??= createCache();
        mutationStarted = true;
        const result = await cache.discard({ expected: item.expected, manifestSha256: item.manifestSha256, signal });
        mutationCompleted();
        update(id, result.ok ? "cleared" : result.reason === "content-generation-protected" ? "protected" : "clear-error", result.ok ? 0 : undefined);
        return;
      }
      // Keep one observation until platform disposal. Native snapshot reads are
      // synchronous; detaching while paused would miss foreground events and
      // reject Resume using a stale background snapshot before getState returns.
      if (mode === "download") await networkPreference.load();
      if (signal.aborted) { update(id, interruptedPhase()); return; }
      attachLifecycle();
      if (signal.aborted) { update(id, interruptedPhase()); return; }
      cache ??= createCache();
      const current = await cache.read({ expected: item.expected, manifestSha256: item.manifestSha256, signal });
      if (signal.aborted) { update(id, interruptedPhase()); return; }
      if (current.ok) {
        task.selectionObserved = true;
        rememberInspection(id, item, current.selectionSha256, current.selectedCurrentManifestSha256, inspectionRevision);
        update(id, "saved", item.envelope.manifest.files.reduce((sum, file) => sum + file.bytes, 0),
          rememberSelection(id, item, current.selectionSha256, current.selectedCurrentManifestSha256 === item.manifestSha256), item.expected.version);
        return;
      }
      if (mode === "check" && current.reason === "content-package-removed" && "selectionSha256" in current && "cleanupComplete" in current) {
        update(id, current.cleanupComplete ? "uninstalled" : "cleanup-pending", 0,
          rememberSelection(id, item, current.selectionSha256, true), item.expected.version);
        return;
      }
      let prior: string | null = null;
      if (item.previous && (mode === "download" || current.reason === "content-generation-not-selected")) {
        const result = await cache.read({ ...item.previous, signal });
        if (signal.aborted) { update(id, interruptedPhase()); return; }
        if (result.ok) {
          prior = result.manifestSha256;
          if (mode === "check") {
            const selected = result.selectedCurrentManifestSha256 === item.previous.manifestSha256;
            task.selectionObserved = true;
            rememberInspection(id, item.previous, result.selectionSha256, result.selectedCurrentManifestSha256, inspectionRevision);
            update(id, selected ? "update-available" : "protected", 0,
              rememberSelection(id, item.previous, result.selectionSha256, selected), item.previous.expected.version);
            return;
          }
        } else if (mode === "check" && result.reason === "content-package-removed" && "selectionSha256" in result && "cleanupComplete" in result) {
          update(id, result.cleanupComplete ? "uninstalled" : "cleanup-pending", 0,
            rememberSelection(id, item.previous, result.selectionSha256, true), item.previous.expected.version);
          return;
        }
      }
      if (signal.aborted) { update(id, interruptedPhase()); return; }
      if (mode === "check") {
        update(id, current.reason === "content-generation-not-selected" ? "not-saved" : "error", undefined, null, null);
        return;
      }
      const onProgress = (value: ContentPackageDownloadProgress) => {
        if (signal.aborted || value.phase === "saved") return;
        update(id, value.phase, value.cachedBytes + value.downloadedBytes);
      };
      const guardedFetch: ContentPackageFetch = (...args) => {
        // Recheck synchronously at each request boundary even if a platform change
        // event was delayed. Never start a new file on a disallowed connection.
        observeLifecycle();
        if (signal.aborted) return Promise.reject(new Error("cancelled"));
        return fetch!(...args);
      };
      mutationStarted = true;
      const result = await cache.download({ envelope: item.envelope, expected: item.expected, manifestSha256: item.manifestSha256,
        expectedCurrentManifestSha256: prior, baseUrl: item.baseUrl, fetch: guardedFetch, signal, onProgress });
      mutationCompleted();
      // An abort during atomic selection can still commit; report that outcome.
      if (result.ok && !signal.aborted) {
        task.selectionObserved = true;
        rememberInspection(id, item, result.selectionSha256, item.manifestSha256, inspectionRevision);
      }
      update(id, result.ok ? "saved" : signal.aborted ? interruptedPhase() : "error", result.ok ? item.envelope.manifest.files.reduce((sum, file) => sum + file.bytes, 0) : undefined,
        result.ok ? rememberSelection(id, item, result.selectionSha256, true) : null, result.ok ? item.expected.version : null);
    }).catch(() => {
      mutationCompleted();
      update(id, mode === "uninstall" ? "uninstall-error" : mode === "discard" ? "clear-error" : signal.aborted ? interruptedPhase() : "unavailable", undefined, null);
    }).finally(() => {
      if (pending.get(id) === task) pending.delete(id);
    });
    pending.set(id, task);
    invalidateInspectionScope(id);
    update(id, mode === "uninstall" ? "uninstalling" : mode === "discard" ? "clearing" : "checking", mode === "discard" || mode === "uninstall" ? undefined : 0,
      mode === "uninstall" ? selectionSha256 : null, mode === "uninstall" ? undefined : null);
    return task.promise;
  }
  return Object.freeze({ getSnapshot: () => snapshot,
    subscribe(listener: () => void) { if (disposed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    check: (id: string) => run(id, "check"), download: (id: string) => run(id, "download"),
    discard: (id: string) => run(id, "discard"), uninstall: (id: string, selectionSha256: string) => run(id, "uninstall", selectionSha256), checkSpace,
    inspect, getInspection: (id: string) => disposed ? null : inspectionViews.get(id) ?? null,
    loadNetworkPreference, setNetworkPolicy: (policy: DownloadNetworkPolicy) => networkPreference.set(policy),
    pause: (id: string) => interrupt(id, "pause"),
    cancel(id: string) {
      if (pending.has(id)) interrupt(id, "cancel");
      else if (snapshot.items.some(item => item.id === id && ["paused", "waiting-wifi"].includes(item.phase))) update(id, "cancelled");
    },
    dispose() {
      disposed = true;
      for (const id of descriptors.keys()) invalidateInspection(id);
      networkPreference.dispose(); cancelSpace?.(); for (const task of pending.values()) task.controller.abort(); detachLifecycle(); listeners.clear();
    },
  });
}
