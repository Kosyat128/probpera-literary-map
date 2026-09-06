import type { PlatformBackEvent, PlatformNavigation, PlatformNavigationListenerHandle } from "../platform/ports";

export interface NativeNavigationBridgeFailure {
  readonly operation: "launch-url" | "url-listener" | "back-listener" | "listener-remove";
  readonly reason: "unavailable" | "timeout" | "invalid-response" | "callback-failed";
}
export interface NativeNavigationBridgeOptions {
  readonly getLaunchUrl: () => Promise<unknown>;
  readonly subscribeUrl: (listener: (event: unknown) => void) => PlatformNavigationListenerHandle | Promise<PlatformNavigationListenerHandle>;
  readonly subscribeBack?: (listener: (event: unknown) => void) => PlatformNavigationListenerHandle | Promise<PlatformNavigationListenerHandle>;
  readonly timeoutMs?: number;
  readonly onFailure?: (failure: NativeNavigationBridgeFailure) => void | Promise<void>;
}

export class NativeNavigationBridgeError extends Error {
  constructor(readonly operation: NativeNavigationBridgeFailure["operation"], readonly reason: NativeNavigationBridgeFailure["reason"]) {
    super("Native navigation " + operation + " " + reason);
    this.name = "NativeNavigationBridgeError";
  }
}

function launchValue(value: unknown): Readonly<{ url: string }> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid launch payload");
  const url = (value as { url?: unknown }).url;
  if (typeof url !== "string" || !url || url.length > 4096) throw new Error("Invalid launch URL");
  // Trust/origin/route policy is deliberately handled by the canonical intake, not the plugin bridge.
  return Object.freeze({ url });
}
function backValue(value: unknown): PlatformBackEvent {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof (value as { canGoBack?: unknown }).canGoBack !== "boolean") throw new Error("Invalid Back payload");
  return Object.freeze({ canGoBack: (value as PlatformBackEvent).canGoBack });
}

/** SDK-free plugin lifetime boundary. Construction performs no plugin or browser IO. */
export function createNativeNavigationBridge(options: NativeNavigationBridgeOptions): PlatformNavigation {
  const timeoutMs = options.timeoutMs ?? 1500;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new Error("Invalid native navigation bridge timeout.");
  if (typeof options.getLaunchUrl !== "function" || typeof options.subscribeUrl !== "function" || (options.subscribeBack !== undefined && typeof options.subscribeBack !== "function")) throw new Error("Native navigation bindings are required.");
  const report = (operation: NativeNavigationBridgeFailure["operation"], reason: NativeNavigationBridgeFailure["reason"]) => {
    const failure = Object.freeze({ operation, reason });
    try { void Promise.resolve(options.onFailure?.(failure)).catch(() => {}); } catch { /* Diagnostics cannot break native input handling. */ }
    return new NativeNavigationBridgeError(operation, reason);
  };
  const removeNative = (handle: PlatformNavigationListenerHandle): Promise<void> => new Promise((resolve, reject) => {
    let settled = false;
    const finish = (reason?: "unavailable" | "timeout") => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (reason) reject(report("listener-remove", reason)); else resolve();
    };
    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    try { void Promise.resolve(handle.remove()).then(() => finish(), () => finish("unavailable")); }
    catch { finish("unavailable"); }
  });
  function subscribe<T>(operation: "url-listener" | "back-listener", bind: (callback: (event: unknown) => void) => PlatformNavigationListenerHandle | Promise<PlatformNavigationListenerHandle>, normalize: (event: unknown) => T, listener: (event: T) => void): Promise<PlatformNavigationListenerHandle> {
    if (typeof listener !== "function") return Promise.reject(report(operation, "invalid-response"));
    return new Promise((resolve, reject) => {
      let alive = true, settled = false;
      const fail = (reason: NativeNavigationBridgeFailure["reason"]) => {
        if (settled) return; settled = true; alive = false; clearTimeout(timer); reject(report(operation, reason));
      };
      const timer = setTimeout(() => fail("timeout"), timeoutMs);
      const callback = (value: unknown) => {
        if (!alive) return;
        let normalized: T;
        try { normalized = normalize(value); } catch { report(operation, "invalid-response"); return; }
        try { void Promise.resolve(listener(normalized)).catch(() => { report(operation, "callback-failed"); }); }
        catch { report(operation, "callback-failed"); }
      };
      try {
        void Promise.resolve(bind(callback)).then(handle => {
          if (!handle || typeof handle.remove !== "function") { fail("invalid-response"); return; }
          if (settled) { void removeNative(handle).catch(() => {}); return; }
          settled = true; clearTimeout(timer);
          let removal: Promise<void> | undefined;
          resolve(Object.freeze({ remove() {
            if (removal) return removal;
            alive = false;
            removal = removeNative(handle);
            // Observe even if a caller uses a synchronous cleanup without awaiting the returned promise.
            void removal.catch(() => {});
            return removal;
          } }));
        }, () => fail("unavailable")).catch(() => fail("invalid-response"));
      } catch { fail("unavailable"); }
    });
  }
  return Object.freeze({
    getLaunchUrl() {
      return new Promise<Readonly<{ url: string }> | undefined>((resolve, reject) => {
        let settled = false;
        const fail = (reason: NativeNavigationBridgeFailure["reason"]) => {
          if (settled) return; settled = true; clearTimeout(timer); reject(report("launch-url", reason));
        };
        const timer = setTimeout(() => fail("timeout"), timeoutMs);
        try {
          void Promise.resolve(options.getLaunchUrl()).then(value => {
            if (settled) return;
            try { const result = launchValue(value); settled = true; clearTimeout(timer); resolve(result); }
            catch { fail("invalid-response"); }
          }, () => fail("unavailable"));
        } catch { fail("unavailable"); }
      });
    },
    subscribeUrl(listener: (url: string) => void) {
      return subscribe("url-listener", options.subscribeUrl, event => {
        const value = launchValue(event); if (!value) throw new Error("Missing URL event"); return value.url;
      }, listener);
    },
    ...(options.subscribeBack ? { subscribeBack(listener: (event: PlatformBackEvent) => void) { return subscribe("back-listener", options.subscribeBack!, backValue, listener); } } : {}),
  });
}
