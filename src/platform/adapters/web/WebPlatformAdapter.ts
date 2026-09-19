import type {
  PlatformServices,
  PlatformSnapshot,
  PreferenceStore,
} from "../../ports";
import {
  readWebStorage,
  removeWebStorage,
  writeWebStorage,
} from "../../../utils/safeWebStorage";
import { createWebContentDownloads, type WebContentHost } from "./WebContentDownloads";
import type { ContentDownloads } from "../../../planet/ContentDownloads";
import { GLOBE_EDITION_IDS } from "../../../planet/editions";
import { GLOBE_STAND_IDS, GLOBE_STAND_PREFERENCE_KEY } from "../../../planet/globeStands";
import { GLOBE_BACKGROUND_IDS, GLOBE_BACKGROUND_PREFERENCE_KEY } from "../../../planet/globeBackgrounds";

type EventHost = Pick<EventTarget, "addEventListener" | "removeEventListener">;
export interface WebAdapterConnection extends EventHost { readonly type?: string; }
export interface WebAdapterDocument extends EventHost {
  readonly visibilityState?: DocumentVisibilityState;
}
export interface WebAdapterNavigator {
  readonly connection?: WebAdapterConnection;
  readonly locks?: NonNullable<WebContentHost["navigator"]>["locks"];
  readonly storage?: NonNullable<WebContentHost["navigator"]>["storage"];
  readonly onLine?: boolean;
  readonly languages?: readonly string[];
  readonly language?: string;
}
export interface WebAdapterWindow extends EventHost, WebContentHost {
  readonly localStorage?: Storage;
  readonly sessionStorage?: Storage;
  readonly document?: WebAdapterDocument;
  readonly navigator?: WebAdapterNavigator;
  open?(url: string, target: string, features: string): object | null;
}
export interface WebPlatformAdapterOptions {
  /** Omitted uses the browser; null explicitly disables ambient browser access. */
  readonly window?: WebAdapterWindow | null;
  readonly document?: WebAdapterDocument | null;
  readonly navigator?: WebAdapterNavigator | null;
  /** Explicit controller injection for controlled UI tests. */
  readonly downloads?: ContentDownloads;
}

// Exact existing non-secret preferences; this is not an arbitrary storage port.
const preferenceValues = new Map<string, readonly string[]>([
  ["probpera-interface-language", ["ru", "en"]],
  ["probpera-display-mode", ["dark", "light", "book"]],
  ["probpera-planet-welcome-v1", ["completed"]],
  ["probpera-planet-graphics-quality-v1", ["high", "balanced", "economy"]],
  ["probpera-planet-download-network-v1", ["any-network", "wifi-only"]],
  ["probpera.globe-edition.v2", [...GLOBE_EDITION_IDS, "antique", "modern", "earth"]],
  ["probpera.globe-style.v1", ["antique", "modern", "earth"]],
  [GLOBE_STAND_PREFERENCE_KEY, GLOBE_STAND_IDS],
  [GLOBE_BACKGROUND_PREFERENCE_KEY, GLOBE_BACKGROUND_IDS],
]);

function safeHttpsUrl(input: string): string | null {
  if (typeof input !== "string" || !/^https:\/\/[^/?#]/iu.test(input)) return null;
  if (/[\u0000-\u0020\u007f-\u009f\u2028\u2029\\]/u.test(input)) return null;
  try {
    // Do not let URL normalization silently discard encoded/raw control bytes.
    if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029\\]/u.test(decodeURIComponent(input))) return null;
    const url = new URL(input);
    const authority = input.slice(input.indexOf(":") + 3).split(/[/?#]/u, 1)[0];
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || authority.includes("@")) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Creates capabilities only: no listeners, storage installation, fetch or scene state. */
export function createWebPlatformAdapter(
  options: WebPlatformAdapterOptions = {}
): PlatformServices {
  const browser = options.window === undefined
    ? (typeof window === "undefined" ? null : window)
    : options.window;
  const documentHost = options.document === undefined ? browser?.document ?? null : options.document;
  const navigatorHost: WebAdapterNavigator | null = options.navigator === undefined ? browser?.navigator ?? null : options.navigator;
  // Getters defer storage access until an explicitly requested preference operation.
  const storageHost = browser ? {
    get localStorage(): Storage {
      const storage = browser.localStorage;
      if (!storage) throw new Error("Local storage unavailable");
      return storage;
    },
    get sessionStorage(): Storage {
      const storage = browser.sessionStorage;
      if (!storage) throw new Error("Session storage unavailable");
      return storage;
    },
  } : null;
  const preferences: PreferenceStore = Object.freeze({
    persistence: "best-effort" as const,
    async get(key: string) {
      const permitted = preferenceValues.get(key);
      if (!permitted) return null;
      const value = readWebStorage("local", key, storageHost);
      return value !== null && permitted.includes(value) ? value : null;
    },
    async set(key: string, value: string) {
      if (!preferenceValues.get(key)?.includes(value)) return false;
      // The existing safe facade may acknowledge an in-memory fallback. This
      // means current-page acceptance, never durable/secure ownership evidence.
      return writeWebStorage("local", key, value, storageHost)
        && readWebStorage("local", key, storageHost) === value;
    },
    async remove(key: string) {
      if (!preferenceValues.has(key)) return false;
      return removeWebStorage("local", key, storageHost)
        && readWebStorage("local", key, storageHost) === null;
    },
  });

  let snapshot: PlatformSnapshot | undefined;
  let lastNotifiedSnapshot: PlatformSnapshot | undefined;
  let connectionListenerHost: WebAdapterConnection | null = null;
  const listeners = new Map<() => void, number>();
  function connectionHost(): WebAdapterConnection | null {
    try { return navigatorHost?.connection ?? null; }
    catch { return null; }
  }
  function getSnapshot(): PlatformSnapshot {
    let connectivity: PlatformSnapshot["connectivity"] = "unknown";
    let visibility: PlatformSnapshot["visibility"] = "active";
    try {
      const online = navigatorHost?.onLine;
      if (typeof online === "boolean") connectivity = online ? "online" : "offline";
    } catch { /* Capability unavailable; do not infer connectivity from locale. */ }
    try {
      if (documentHost?.visibilityState === "hidden") visibility = "background";
    } catch { /* SSR or a restricted host has no observable visibility. */ }
    let networkType: PlatformSnapshot["networkType"];
    try {
      const type = connectionHost()?.type;
      if (connectivity === "online" && visibility === "active"
        && (type === "wifi" || type === "cellular" || type === "ethernet")) networkType = type;
    } catch { /* A speed estimate or denied type is never proof of Wi-Fi. */ }
    if (!snapshot || snapshot.connectivity !== connectivity || snapshot.visibility !== visibility || snapshot.networkType !== networkType) {
      snapshot = Object.freeze({ connectivity, visibility, ...(networkType ? { networkType } : {}) });
    }
    return snapshot;
  }
  function refresh() {
    const previous = lastNotifiedSnapshot;
    const next = getSnapshot();
    lastNotifiedSnapshot = next;
    if (!previous || previous === next) return;
    // Duplicate subscriptions retain independent cleanup but notify once per
    // distinct callback. Snapshot iteration tolerates unsubscribe during notify.
    for (const listener of [...listeners.keys()]) if (listeners.has(listener)) listener();
  }
  function attach() {
    browser?.addEventListener("online", refresh);
    browser?.addEventListener("offline", refresh);
    documentHost?.addEventListener("visibilitychange", refresh);
    const connection = connectionHost();
    if (connection) {
      connectionListenerHost = connection;
      try { connection.addEventListener("change", refresh); }
      catch { /* Optional capability may be denied; other lifecycle listeners remain active. */ }
    }
  }
  function detach() {
    browser?.removeEventListener("online", refresh);
    browser?.removeEventListener("offline", refresh);
    documentHost?.removeEventListener("visibilitychange", refresh);
    const connection = connectionListenerHost;
    connectionListenerHost = null;
    try { connection?.removeEventListener("change", refresh); }
    catch { /* Cleanup is best-effort and must remain idempotent. */ }
  }
  function subscribe(listener: () => void) {
      const first = listeners.size === 0;
      listeners.set(listener, (listeners.get(listener) ?? 0) + 1);
      if (first) {
        lastNotifiedSnapshot = snapshot;
        attach();
        // Covers an actual change between render/read and subscription without
        // notifying on an unchanged initial snapshot.
        refresh();
      }
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        const count = listeners.get(listener) ?? 0;
        if (count > 1) listeners.set(listener, count - 1);
        else listeners.delete(listener);
        if (!listeners.size) detach();
      };
  }

  return Object.freeze({
    kind: "web" as const,
    channel: "web" as const,
    preferences,
    downloads: options.downloads ?? createWebContentDownloads(browser, undefined, { getSnapshot, subscribe }, preferences),
    getSnapshot,
    subscribe,
    getSystemLanguages() {
      let languages: string[] = [];
      try {
        const requested = navigatorHost?.languages;
        if (Array.isArray(requested)) {
          languages = requested.filter((value) => typeof value === "string" && value.length > 0);
        }
      } catch { /* Fall back only to the navigator's single language preference. */ }
      if (!languages.length) {
        try {
          const language = navigatorHost?.language;
          if (typeof language === "string" && language.length) languages = [language];
        } catch { /* No observable language preference. */ }
      }
      return Object.freeze(languages);
    },
    openExternalLink(input: string) {
      const url = safeHttpsUrl(input);
      if (!url) return "blocked";
      try {
        if (!browser?.open) return "unavailable";
        const handle = browser.open(url, "_blank", "noopener,noreferrer");
        // HTML window-open steps return null even on success with noopener.
        // https://html.spec.whatwg.org/multipage/nav-history-apis.html#window-open-steps
        // Never retry or claim popup blocking/success without an observable handle.
        return handle && typeof handle === "object" ? "opened" : "requested";
      } catch {
        return "unavailable";
      }
    },
  });
}
