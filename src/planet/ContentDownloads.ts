import { contentPackageCanonicalJson, contentPackageHash, inspectContentPackageEnvelope, normalizeContentPackageExpected,
  type ContentPackageEnvelope, type ContentPackageExpected } from "./contentPackageProtocol.mjs";
import { normalizeContentPackageBaseUrl, type ContentPackageFetch } from "./contentPackageTransport";
import type { createContentPackageCache, ContentPackageDownloadProgress } from "./contentPackageCache";

export interface ContentDownloadDescriptor {
  readonly id: string;
  readonly title: Readonly<{ ru: string; en: string }>;
  readonly envelope: ContentPackageEnvelope;
  readonly expected: ContentPackageExpected;
  readonly manifestSha256: string;
  readonly previous: Readonly<{ expected: ContentPackageExpected; manifestSha256: string }> | null;
  readonly baseUrl: string;
}
export type ContentDownloadPhase = "unchecked" | "checking" | "not-saved" | "downloading" | "verifying" | "pausing" | "paused" | "cancelling" | "saved" | "cancelled" | "error" | "unavailable" | "clearing" | "cleared" | "protected" | "clear-error";
export interface ContentStorageSpace {
  readonly phase: "unchecked" | "checking" | "ready" | "unavailable";
  readonly availableBytes: number | null;
  readonly kind: "browser-estimate" | "device" | null;
}
export type ContentStorageSpaceReader = () => Promise<{ availableBytes: number; kind: "browser-estimate" | "device" }>;
export interface ContentDownloadLifecycle {
  getSnapshot(): { readonly visibility: "active" | "background"; readonly connectivity: "online" | "offline" | "unknown" };
  subscribe(listener: () => void): () => void;
}
export interface ContentDownloadItem {
  readonly id: string; readonly title: Readonly<{ ru: string; en: string }>;
  readonly phase: ContentDownloadPhase; readonly totalBytes: number; readonly completedBytes: number;
  readonly qaOnly: true;
}
export interface ContentDownloadsSnapshot {
  readonly items: readonly ContentDownloadItem[];
  readonly available: boolean;
  readonly space: ContentStorageSpace;
}
export interface ContentDownloads {
  getSnapshot(): ContentDownloadsSnapshot;
  subscribe(listener: () => void): () => void;
  check(id: string): Promise<void>;
  download(id: string): Promise<void>;
  discard(id: string): Promise<void>;
  checkSpace(): Promise<void>;
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
  const createCache = options.createCache, fetch = options.fetch;
  let cache: ContentPackageCache | undefined, disposed = false;
  let snapshot: ContentDownloadsSnapshot = Object.freeze({ available: !!createCache && !!fetch,
    space: Object.freeze({ phase: "unchecked", availableBytes: null, kind: null }),
    items: Object.freeze([...descriptors.values()].map(value => Object.freeze({ id: value.id, title: Object.freeze({ ...value.title }),
      totalBytes: value.envelope.manifest.files.reduce((sum, file) => sum + file.bytes, 0), completedBytes: 0,
      phase: "unchecked" as ContentDownloadPhase, qaOnly: true as const }))) });
  type Task = { controller: AbortController; promise: Promise<void>; mode: "check" | "download" | "discard"; interruption: "pause" | "cancel" | null };
  const listeners = new Set<() => void>(), pending = new Map<string, Task>();
  let unsubscribeLifecycle: (() => void) | undefined;
  let spacePending: Promise<void> | undefined, cancelSpace: (() => void) | undefined;
  function notify() {
    for (const listener of [...listeners]) { try { listener(); } catch { /* Observers cannot own downloads. */ } }
  }
  function update(id: string, phase: ContentDownloadPhase, completedBytes?: number) {
    if (disposed) return;
    snapshot = Object.freeze({ ...snapshot, items: Object.freeze(snapshot.items.map(item => item.id === id
      ? Object.freeze({ ...item, phase, completedBytes: Math.min(item.totalBytes, Math.max(0, completedBytes ?? item.completedBytes)) }) : item)) });
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
  function interrupt(id: string, reason: "pause" | "cancel") {
    const task = pending.get(id);
    if (!task || task.mode === "discard" || task.interruption === "cancel" || task.interruption === reason) return;
    task.interruption = reason;
    // Fence progress and reentrant observers before announcing the transition.
    task.controller.abort();
    update(id, reason === "pause" ? "pausing" : "cancelling");
  }
  function observeLifecycle() {
    if (disposed || !options.lifecycle) return;
    const state = options.lifecycle.getSnapshot();
    for (const [id, task] of pending) {
      if (state.visibility === "background" || (task.mode === "download" && state.connectivity === "offline")) interrupt(id, "pause");
    }
    // Foreground/network recovery never restarts a transfer without a user action.
  }
  function detachLifecycle() {
    const unsubscribe = unsubscribeLifecycle;
    unsubscribeLifecycle = undefined;
    try { unsubscribe?.(); } catch { /* A host cleanup failure cannot change saved bytes. */ }
  }
  function run(id: string, mode: Task["mode"]): Promise<void> {
    if (disposed || !descriptors.has(id)) return Promise.resolve();
    if (pending.has(id)) return pending.get(id)!.promise;
    const item = descriptors.get(id)!, controller = new AbortController(), signal = controller.signal;
    const task: Task = { controller, promise: Promise.resolve(), mode, interruption: null };
    const interruptedPhase = () => task.interruption === "pause" ? "paused" as const : "cancelled" as const;
    task.promise = Promise.resolve().then(async () => {
      if (signal.aborted) { update(id, interruptedPhase()); return; }
      if (!createCache || (mode === "download" && !fetch)) { update(id, mode === "discard" ? "clear-error" : "unavailable"); return; }
      if (mode === "discard") {
        cache ??= createCache();
        const result = await cache.discard({ expected: item.expected, manifestSha256: item.manifestSha256, signal });
        update(id, result.ok ? "cleared" : result.reason === "content-generation-protected" ? "protected" : "clear-error", result.ok ? 0 : undefined);
        return;
      }
      // Keep one observation until platform disposal. Native snapshot reads are
      // synchronous; detaching while paused would miss foreground events and
      // reject Resume using a stale background snapshot before getState returns.
      if (options.lifecycle && !unsubscribeLifecycle) {
        const unsubscribe = options.lifecycle.subscribe(observeLifecycle);
        if (disposed) { try { unsubscribe(); } catch { /* Disposal remains final. */ } return; }
        unsubscribeLifecycle = unsubscribe;
      }
      observeLifecycle();
      if (signal.aborted) { update(id, interruptedPhase()); return; }
      cache ??= createCache();
      const current = await cache.read({ expected: item.expected, manifestSha256: item.manifestSha256, signal });
      if (signal.aborted) { update(id, interruptedPhase()); return; }
      if (current.ok) { update(id, "saved", item.envelope.manifest.files.reduce((sum, file) => sum + file.bytes, 0)); return; }
      if (mode === "check") { update(id, current.reason === "content-generation-not-selected" ? "not-saved" : "error"); return; }
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
      const result = await cache.download({ envelope: item.envelope, expected: item.expected, manifestSha256: item.manifestSha256,
        expectedCurrentManifestSha256: prior, baseUrl: item.baseUrl, fetch: fetch!, signal, onProgress });
      // An abort during atomic selection can still commit; report that outcome.
      update(id, result.ok ? "saved" : signal.aborted ? interruptedPhase() : "error", result.ok ? item.envelope.manifest.files.reduce((sum, file) => sum + file.bytes, 0) : undefined);
    }).catch(() => update(id, mode === "discard" ? "clear-error" : signal.aborted ? interruptedPhase() : "unavailable")).finally(() => {
      if (pending.get(id) === task) pending.delete(id);
    });
    pending.set(id, task);
    update(id, mode === "discard" ? "clearing" : "checking", mode === "discard" ? undefined : 0);
    return task.promise;
  }
  return Object.freeze({ getSnapshot: () => snapshot,
    subscribe(listener: () => void) { if (disposed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    check: (id: string) => run(id, "check"), download: (id: string) => run(id, "download"),
    discard: (id: string) => run(id, "discard"), checkSpace,
    pause: (id: string) => interrupt(id, "pause"),
    cancel(id: string) {
      if (pending.has(id)) interrupt(id, "cancel");
      else if (snapshot.items.some(item => item.id === id && item.phase === "paused")) update(id, "cancelled");
    },
    dispose() { disposed = true; cancelSpace?.(); for (const task of pending.values()) task.controller.abort(); detachLifecycle(); listeners.clear(); },
  });
}
