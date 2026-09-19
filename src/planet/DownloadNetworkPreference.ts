export type DownloadNetworkPolicy = "any-network" | "wifi-only";
export type DownloadNetworkType = "wifi" | "cellular" | "ethernet" | "unknown";
export interface DownloadPreferenceStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
}
export interface DownloadNetworkPreferenceSnapshot {
  readonly policy: DownloadNetworkPolicy;
  readonly status: "unloaded" | "loading" | "ready" | "saving" | "session-only";
}
export const DOWNLOAD_NETWORK_PREFERENCE = "probpera-planet-download-network-v1";
const valid = (value: unknown): value is DownloadNetworkPolicy => value === "wifi-only" || value === "any-network";

/** Local non-secret intent. No constructor IO, automatic transfers or telemetry.
 * New app installations default to Wi-Fi; capability-only fixtures have no stored intent. */
export function createDownloadNetworkPreference(store: DownloadPreferenceStore | undefined, changed: () => void) {
  let snapshot: DownloadNetworkPreferenceSnapshot = Object.freeze({ policy: store ? "wifi-only" : "any-network", status: store ? "unloaded" : "session-only" });
  let revision = 0, disposed = false, loadPending: Promise<void> | undefined, loaded = !store;
  let writeTail: Promise<unknown> = Promise.resolve();
  const cancellations = new Set<() => void>();
  function publish(next: DownloadNetworkPreferenceSnapshot) {
    if (disposed) return;
    snapshot = Object.freeze(next); changed();
  }
  function bounded<T>(operation: Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
    return new Promise(resolve => {
      let settled = false;
      const finish = (value: { ok: true; value: T } | { ok: false }) => {
        if (settled) return; settled = true; clearTimeout(timer); cancellations.delete(cancel); resolve(value);
      };
      const cancel = () => finish({ ok: false }), timer = setTimeout(cancel, 4000);
      cancellations.add(cancel);
      void operation.then(value => finish({ ok: true, value }), cancel);
    });
  }
  function load(): Promise<void> {
    if (disposed || loaded) return Promise.resolve();
    if (loadPending) return loadPending;
    const token = revision;
    loadPending = Promise.resolve().then(async () => {
      if (disposed || token !== revision) return;
      const read = await bounded(Promise.resolve().then(() => disposed ? null : store!.get(DOWNLOAD_NETWORK_PREFERENCE)));
      if (disposed || token !== revision) return;
      loaded = true;
      const accepted = read.ok && (read.value === null || valid(read.value));
      publish({ policy: read.ok && valid(read.value) ? read.value : "wifi-only", status: accepted ? "ready" : "session-only" });
    });
    publish({ ...snapshot, status: "loading" });
    return loadPending;
  }
  function set(policy: DownloadNetworkPolicy): Promise<void> {
    if (disposed || !valid(policy)) return Promise.resolve();
    const token = ++revision; loaded = true;
    // Enforce the new choice synchronously, before persistence or a next fetch.
    publish({ policy, status: store ? "saving" : "session-only" });
    if (!store || disposed) return Promise.resolve();
    // Retain native write ordering even when the UI wait times out. Late writes
    // cannot overtake a newer preference, and stale results cannot change the UI.
    const write = writeTail.then(() => disposed ? false : store.set(DOWNLOAD_NETWORK_PREFERENCE, policy));
    writeTail = write.catch(() => undefined);
    return bounded(write).then(result => {
      if (!disposed && revision === token) publish({ policy, status: result.ok && result.value === true ? "ready" : "session-only" });
    });
  }
  return Object.freeze({ getSnapshot: () => snapshot, load, set,
    dispose() { disposed = true; for (const cancel of [...cancellations]) cancel(); } });
}
