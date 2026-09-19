import { contentPackageCanonicalJson, contentPackageHash, inspectContentPackageEnvelope, normalizeContentPackageExpected,
  type ContentPackageEnvelope, type ContentPackageExpected } from "./contentPackageProtocol.mjs";
import { normalizeContentPackageBaseUrl, type ContentPackageFetch } from "./contentPackageTransport";
import type { createContentPackageCache, ContentPackageDownloadProgress } from "./contentPackageCache";
import { createDownloadNetworkPreference, type DownloadNetworkPreferenceSnapshot, type DownloadNetworkPolicy,
  type DownloadNetworkType, type DownloadPreferenceStore } from "./DownloadNetworkPreference";
import { contentDownloadOptionalPackages, type ContentDownloadRetention } from "./ContentDownloadRetention";

export interface ContentDownloadDescriptor {
  readonly id: string;
  readonly title: Readonly<{ ru: string; en: string }>;
  readonly envelope: ContentPackageEnvelope;
  readonly expected: ContentPackageExpected;
  readonly manifestSha256: string;
  readonly previous: Readonly<{ expected: ContentPackageExpected; manifestSha256: string }> | null;
  readonly baseUrl: string;
  readonly retention?: ContentDownloadRetention;
}
export type ContentDownloadPhase = "unchecked" | "checking" | "not-saved" | "downloading" | "verifying" | "pausing" | "paused" | "waiting-wifi" | "cancelling" | "saved" | "cancelled" | "error" | "unavailable" | "clearing" | "cleared" | "protected" | "clear-error" | "uninstalling" | "uninstalled" | "cleanup-pending" | "uninstall-error";
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
  const createCache = options.createCache, fetch = options.fetch;
  let cache: ContentPackageCache | undefined, disposed = false;
  let snapshot: ContentDownloadsSnapshot = Object.freeze({ available: !!createCache && !!fetch,
    network: Object.freeze({ policy: options.preferences ? "wifi-only" : "any-network", status: options.preferences ? "unloaded" : "session-only", type: "unknown" }),
    space: Object.freeze({ phase: "unchecked", availableBytes: null, kind: null }),
    items: Object.freeze([...descriptors.values()].map(value => Object.freeze({ id: value.id, title: Object.freeze({ ...value.title }),
      totalBytes: value.envelope.manifest.files.reduce((sum, file) => sum + file.bytes, 0), completedBytes: 0,
      phase: "unchecked" as ContentDownloadPhase, qaOnly: true as const, optional: value.retention === "optional", removalReceipt: null }))) });
  type Task = { controller: AbortController; promise: Promise<void>; mode: "check" | "download" | "discard" | "uninstall"; interruption: "pause" | "cancel" | "wifi" | null };
  const listeners = new Set<() => void>(), pending = new Map<string, Task>();
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
  function update(id: string, phase: ContentDownloadPhase, completedBytes?: number, removalReceipt?: string | null) {
    if (disposed) return;
    snapshot = Object.freeze({ ...snapshot, items: Object.freeze(snapshot.items.map(item => item.id === id
      ? Object.freeze({ ...item, phase, completedBytes: Math.min(item.totalBytes, Math.max(0, completedBytes ?? item.completedBytes)),
        removalReceipt: removalReceipt === undefined ? item.removalReceipt : removalReceipt }) : item)) });
    notify();
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
    for (const [id, task] of pending) {
      if (state.visibility === "background" || (task.mode === "download" && state.connectivity === "offline")) interrupt(id, "pause");
      else if (task.mode === "download" && requiresWifi()) interrupt(id, "wifi");
    }
    if (changed) notify();
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
    if (mode === "uninstall") {
      const displayed = snapshot.items.find(item => item.id === id)!;
      if (!displayed.optional || !receipt(selectionSha256) || displayed.removalReceipt !== selectionSha256
        || !["saved", "protected", "cleanup-pending"].includes(displayed.phase)) return Promise.resolve();
    }
    const item = descriptors.get(id)!, controller = new AbortController(), signal = controller.signal;
    const task: Task = { controller, promise: Promise.resolve(), mode, interruption: null };
    const interruptedPhase = () => task.interruption === "pause" ? "paused" as const : task.interruption === "wifi" ? "waiting-wifi" as const : "cancelled" as const;
    task.promise = Promise.resolve().then(async () => {
      if (signal.aborted) { update(id, interruptedPhase()); return; }
      if (!createCache || (mode === "download" && !fetch)) { update(id, mode === "uninstall" ? "uninstall-error" : mode === "discard" ? "clear-error" : "unavailable", undefined, null); return; }
      if (mode === "uninstall") {
        cache ??= createCache();
        const result = await cache.uninstall({ expected: item.expected, manifestSha256: item.manifestSha256, selectionSha256: selectionSha256!, signal });
        // Retirement may have committed before cancellation or cleanup failure.
        // Its receipt is authoritative even if byte cleanup needs another try.
        update(id, result.ok ? result.cleanupComplete ? "uninstalled" : "cleanup-pending" : "uninstall-error",
          result.ok ? 0 : undefined, result.ok ? receipt(result.selectionSha256) : null);
        return;
      }
      if (mode === "discard") {
        cache ??= createCache();
        const result = await cache.discard({ expected: item.expected, manifestSha256: item.manifestSha256, signal });
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
      if (current.ok) { update(id, "saved", item.envelope.manifest.files.reduce((sum, file) => sum + file.bytes, 0), receipt(current.selectionSha256)); return; }
      if (mode === "check") {
        if (current.reason === "content-package-removed" && "selectionSha256" in current && "cleanupComplete" in current) {
          update(id, current.cleanupComplete ? "uninstalled" : "cleanup-pending", 0, receipt(current.selectionSha256));
        } else update(id, current.reason === "content-generation-not-selected" ? "not-saved" : "error", undefined, null);
        return;
      }
      let prior: string | null = null;
      if (item.previous) {
        const result = await cache.read({ ...item.previous, signal });
        if (result.ok) prior = result.manifestSha256;
      }
      if (signal.aborted) { update(id, interruptedPhase()); return; }
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
      const result = await cache.download({ envelope: item.envelope, expected: item.expected, manifestSha256: item.manifestSha256,
        expectedCurrentManifestSha256: prior, baseUrl: item.baseUrl, fetch: guardedFetch, signal, onProgress });
      // An abort during atomic selection can still commit; report that outcome.
      update(id, result.ok ? "saved" : signal.aborted ? interruptedPhase() : "error", result.ok ? item.envelope.manifest.files.reduce((sum, file) => sum + file.bytes, 0) : undefined,
        result.ok ? receipt(result.selectionSha256) : null);
    }).catch(() => update(id, mode === "uninstall" ? "uninstall-error" : mode === "discard" ? "clear-error" : signal.aborted ? interruptedPhase() : "unavailable", undefined, null)).finally(() => {
      if (pending.get(id) === task) pending.delete(id);
    });
    pending.set(id, task);
    update(id, mode === "uninstall" ? "uninstalling" : mode === "discard" ? "clearing" : "checking", mode === "discard" || mode === "uninstall" ? undefined : 0,
      mode === "uninstall" ? selectionSha256 : null);
    return task.promise;
  }
  return Object.freeze({ getSnapshot: () => snapshot,
    subscribe(listener: () => void) { if (disposed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    check: (id: string) => run(id, "check"), download: (id: string) => run(id, "download"),
    discard: (id: string) => run(id, "discard"), uninstall: (id: string, selectionSha256: string) => run(id, "uninstall", selectionSha256), checkSpace,
    loadNetworkPreference, setNetworkPolicy: (policy: DownloadNetworkPolicy) => networkPreference.set(policy),
    pause: (id: string) => interrupt(id, "pause"),
    cancel(id: string) {
      if (pending.has(id)) interrupt(id, "cancel");
      else if (snapshot.items.some(item => item.id === id && ["paused", "waiting-wifi"].includes(item.phase))) update(id, "cancelled");
    },
    dispose() { disposed = true; networkPreference.dispose(); cancelSpace?.(); for (const task of pending.values()) task.controller.abort(); detachLifecycle(); listeners.clear(); },
  });
}
