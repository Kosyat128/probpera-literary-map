import type { OpenLinkResult, PlatformServices, PlatformSnapshot, PreferenceStore } from "../platform/ports";

export interface HostListenerHandle { remove(): void | Promise<void>; }
export interface HostAppState { readonly isActive: boolean; }
export interface HostNetworkState { readonly connected: boolean; }
export interface HostAppBridge {
  getState(): Promise<HostAppState>;
  addListener(event: "appStateChange", listener: (state: HostAppState) => void): Promise<HostListenerHandle>;
}
export interface HostNetworkBridge {
  getStatus(): Promise<HostNetworkState>;
  addListener(event: "networkStatusChange", listener: (state: HostNetworkState) => void): Promise<HostListenerHandle>;
}
export interface HostPreferenceBridge {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}
export interface HostPlatformFailure {
  readonly operation: "app-listener" | "app-state" | "network-listener" | "network-status" | "listener-remove"
    | "subscriber" | "preference-get" | "preference-set" | "preference-remove" | "link-policy" | "browser-open" | "mail-open";
  readonly reason: "unavailable" | "invalid-response" | "readback-mismatch" | "callback-failed";
}
interface HostPlatformCapabilities {
  /** Already resolved by host initialization; this adapter performs no language IO. */
  readonly languages: readonly string[];
  readonly app?: HostAppBridge;
  readonly network?: HostNetworkBridge;
  readonly preferences?: HostPreferenceBridge;
  readonly openBrowser?: (options: { url: string }) => Promise<void>;
  readonly openMail?: (options: { url: string }) => Promise<{ completed: boolean }>;
  /** Evaluated at dispatch. Only literal true permits a link; omitted denies all. */
  readonly allowExternalLink?: (canonicalUrl: string) => boolean;
  /** Sanitized operation/category only; never receives URLs, stored values or raw errors. */
  readonly onFailure?: (failure: HostPlatformFailure) => void | Promise<void>;
}
export type HostPlatformServicesOptions = HostPlatformCapabilities & (
  | { readonly kind: "android"; readonly channel: "dev" | "googlePlay" | "ruStore" }
  | { readonly kind: "ios"; readonly channel: "dev" | "appStore" }
);

// Exact canonical non-secret preference policy, matching WebPlatformAdapter.
const preferenceValues = new Map<string, readonly string[]>([
  ["probpera-interface-language", ["ru", "en"]],
  ["probpera-display-mode", ["dark", "light", "book"]],
]);
const supportMail = "mailto:probperasite@yandex.ru";

function safeHttpsUrl(input: string): string | null {
  if (typeof input !== "string" || !/^https:\/\/[^/?#]/iu.test(input)) return null;
  if (/[\u0000-\u0020\u007f-\u009f\u2028\u2029\\]/u.test(input)) return null;
  try {
    if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029\\]/u.test(decodeURIComponent(input))) return null;
    const url = new URL(input);
    const authority = input.slice(input.indexOf(":") + 3).split(/[/?#]/u, 1)[0];
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || authority.includes("@")) return null;
    return url.href;
  } catch { return null; }
}

interface Lifetime {
  alive: boolean;
  appSequence: number;
  networkSequence: number;
  readonly handles: Set<HostListenerHandle>;
}

/** SDK-free native capabilities. Constructor and snapshot reads have no native IO. */
export function createHostPlatformServices(options: HostPlatformServicesOptions): PlatformServices {
  const channels = options.kind === "android" ? ["dev", "googlePlay", "ruStore"]
    : options.kind === "ios" ? ["dev", "appStore"] : [];
  if (!channels.includes(options.channel)) throw new Error("Invalid native platform distribution");
  const languages: string[] = [];
  if (Array.isArray(options.languages)) for (const value of options.languages.slice(0, 32)) {
    if (typeof value !== "string" || !value || value.length > 100) continue;
    try {
      const canonical = Intl.getCanonicalLocales(value)[0];
      if (canonical && !languages.includes(canonical)) languages.push(canonical);
    } catch { /* Invalid host language is unavailable, never a browser fallback. */ }
  }
  const languageSnapshot = Object.freeze(languages);
  function report(operation: HostPlatformFailure["operation"], reason: HostPlatformFailure["reason"]) {
    try {
      void Promise.resolve(options.onFailure?.(Object.freeze({ operation, reason }))).catch(() => undefined);
    } catch { /* Error reporting must not reject or break the host lifecycle. */ }
  }
  function observeCallback(value: unknown, operation: HostPlatformFailure["operation"]) {
    void Promise.resolve(value).catch(() => report(operation, "callback-failed"));
  }

  const preferenceTails = new Map<string, Promise<void>>();
  function serialPreference<T>(key: string, operation: HostPlatformFailure["operation"], fallback: T, work: () => Promise<T>): Promise<T> {
    const result = (preferenceTails.get(key) ?? Promise.resolve()).then(work).catch(() => {
      report(operation, "unavailable");
      return fallback;
    });
    const tail = result.then(() => undefined);
    preferenceTails.set(key, tail);
    void tail.then(() => { if (preferenceTails.get(key) === tail) preferenceTails.delete(key); });
    return result;
  }
  async function readPreference(key: string, operation: HostPlatformFailure["operation"]): Promise<{ valid: boolean; value: string | null }> {
    if (!options.preferences) { report(operation, "unavailable"); return { valid: false, value: null }; }
    const result = await options.preferences.get({ key });
    const value = result?.value;
    if (value !== null && !preferenceValues.get(key)?.includes(value)) {
      report(operation, "invalid-response");
      return { valid: false, value: null };
    }
    return { valid: true, value };
  }
  const preferences: PreferenceStore = Object.freeze({
    persistence: "best-effort" as const,
    get(key: string) {
      if (!preferenceValues.has(key)) return Promise.resolve(null);
      return serialPreference(key, "preference-get", null, async () => (await readPreference(key, "preference-get")).value);
    },
    set(key: string, value: string) {
      if (!preferenceValues.get(key)?.includes(value)) return Promise.resolve(false);
      return serialPreference(key, "preference-set", false, async () => {
        if (!options.preferences) { report("preference-set", "unavailable"); return false; }
        await options.preferences.set({ key, value });
        const result = await readPreference(key, "preference-set");
        if (result.valid && result.value === value) return true;
        if (result.valid) report("preference-set", "readback-mismatch");
        return false;
      });
    },
    remove(key: string) {
      if (!preferenceValues.has(key)) return Promise.resolve(false);
      return serialPreference(key, "preference-remove", false, async () => {
        if (!options.preferences) { report("preference-remove", "unavailable"); return false; }
        await options.preferences.remove({ key });
        const result = await readPreference(key, "preference-remove");
        if (result.valid && result.value === null) return true;
        if (result.valid) report("preference-remove", "readback-mismatch");
        return false;
      });
    },
  });

  let snapshot: PlatformSnapshot = Object.freeze({ connectivity: "unknown", visibility: "active" });
  let lifetime: Lifetime | null = null;
  const subscribers = new Map<() => void, number>();
  const current = (session: Lifetime) => session.alive && lifetime === session && subscribers.size > 0;
  function publish(session: Lifetime, next: PlatformSnapshot) {
    if (!current(session) || (next.connectivity === snapshot.connectivity && next.visibility === snapshot.visibility)) return;
    snapshot = Object.freeze(next);
    for (const listener of [...subscribers.keys()]) {
      if (!current(session)) break;
      if (!subscribers.has(listener)) continue;
      try { observeCallback(listener(), "subscriber"); } catch { report("subscriber", "callback-failed"); }
    }
  }
  function acceptNetwork(session: Lifetime, state: HostNetworkState) {
    const connected = state?.connected;
    if (typeof connected !== "boolean") report("network-status", "invalid-response");
    // A native connectivity hint never proves an authority endpoint is reachable.
    publish(session, { ...snapshot, connectivity: typeof connected === "boolean" ? connected ? "online" : "offline" : "unknown" });
  }
  function acceptApp(session: Lifetime, state: HostAppState) {
    const isActive = state?.isActive;
    if (typeof isActive !== "boolean") { report("app-state", "invalid-response"); return; }
    const resumed = isActive && snapshot.visibility === "background";
    publish(session, { ...snapshot, visibility: isActive ? "active" : "background" });
    if (resumed && current(session)) void readNetwork(session);
  }
  async function readNetwork(session: Lifetime) {
    if (!current(session)) return;
    const sequence = ++session.networkSequence;
    try {
      if (!options.network) { report("network-status", "unavailable"); return; }
      const state = await options.network.getStatus();
      if (current(session) && sequence === session.networkSequence) acceptNetwork(session, state);
    } catch { if (current(session) && sequence === session.networkSequence) report("network-status", "unavailable"); }
  }
  async function readApp(session: Lifetime) {
    if (!current(session)) return;
    const sequence = ++session.appSequence;
    try {
      if (!options.app) { report("app-state", "unavailable"); return; }
      const state = await options.app.getState();
      if (current(session) && sequence === session.appSequence) acceptApp(session, state);
    } catch { if (current(session) && sequence === session.appSequence) report("app-state", "unavailable"); }
  }
  function removeHandle(handle: HostListenerHandle) {
    try { void Promise.resolve(handle.remove()).catch(() => report("listener-remove", "unavailable")); }
    catch { report("listener-remove", "unavailable"); }
  }
  async function register(session: Lifetime, operation: "app-listener" | "network-listener", add: () => Promise<HostListenerHandle>) {
    try {
      const handle = await add();
      if (!handle || typeof handle.remove !== "function") report(operation, "invalid-response");
      else if (!current(session)) removeHandle(handle);
      else session.handles.add(handle);
    } catch { report(operation, "unavailable"); }
  }
  function attach() {
    const session: Lifetime = { alive: true, appSequence: 0, networkSequence: 0, handles: new Set() };
    lifetime = session;
    if (options.app) {
      const sequence = session.appSequence;
      void register(session, "app-listener", () => options.app!.addListener("appStateChange", state => {
        if (!current(session)) return;
        ++session.appSequence;
        try { acceptApp(session, state); } catch { report("app-state", "invalid-response"); }
      }));
      // A pending registration must not block initialization. A synchronous event
      // already supplies newer state; later events fence this independent read.
      if (current(session) && session.appSequence === sequence) void readApp(session);
    }
    else report("app-listener", "unavailable");
    if (!current(session)) return;
    if (options.network) {
      const sequence = session.networkSequence;
      void register(session, "network-listener", () => options.network!.addListener("networkStatusChange", state => {
        if (!current(session)) return;
        ++session.networkSequence;
        try { acceptNetwork(session, state); } catch { report("network-status", "invalid-response"); }
      }));
      if (current(session) && session.networkSequence === sequence) void readNetwork(session);
    }
    else report("network-listener", "unavailable");
  }
  function detach() {
    const previous = lifetime;
    lifetime = null;
    if (!previous) return;
    previous.alive = false;
    for (const handle of previous.handles) removeHandle(handle);
    previous.handles.clear();
  }

  return Object.freeze({
    kind: options.kind,
    channel: options.channel,
    preferences,
    getSnapshot: () => snapshot,
    getSystemLanguages: () => languageSnapshot,
    subscribe(listener: () => void) {
      if (typeof listener !== "function") { report("subscriber", "invalid-response"); return () => undefined; }
      const first = subscribers.size === 0;
      subscribers.set(listener, (subscribers.get(listener) ?? 0) + 1);
      if (first) attach();
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        const count = subscribers.get(listener) ?? 0;
        if (count > 1) subscribers.set(listener, count - 1);
        else subscribers.delete(listener);
        if (!subscribers.size) detach();
      };
    },
    async openExternalLink(input: string): Promise<OpenLinkResult> {
      const url = input === supportMail ? supportMail : safeHttpsUrl(input);
      if (!url) return "blocked";
      try {
        const allowed: unknown = options.allowExternalLink?.(url);
        if (allowed !== true) {
          if (allowed !== undefined && allowed !== false) {
            report("link-policy", "invalid-response");
            observeCallback(allowed, "link-policy");
          }
          return "blocked";
        }
      } catch { report("link-policy", "callback-failed"); return "blocked"; }
      const operation = url === supportMail ? "mail-open" : "browser-open";
      try {
        if (url === supportMail) {
          if (!options.openMail) { report(operation, "unavailable"); return "unavailable"; }
          const result = await options.openMail({ url });
          if (!result || result.completed !== true) {
            report(operation, result?.completed === false ? "unavailable" : "invalid-response");
            return "unavailable";
          }
        } else {
          if (!options.openBrowser) { report(operation, "unavailable"); return "unavailable"; }
          await options.openBrowser({ url });
        }
        // Native presentation/OS handoff is observable; delivery/page success is not.
        return "requested";
      } catch { report(operation, "unavailable"); return "unavailable"; }
    },
  });
}
