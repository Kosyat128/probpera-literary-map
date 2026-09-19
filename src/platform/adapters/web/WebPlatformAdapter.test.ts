import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { installSafeWebStorage } from "../../../utils/safeWebStorage";
import { GLOBE_EDITION_IDS } from "../../../components/globeEditions";
import {
  createWebPlatformAdapter,
  type WebAdapterWindow,
} from "./WebPlatformAdapter";

const WELCOME = "probpera-planet-welcome-v1";
const GRAPHICS = "probpera-planet-graphics-quality-v1";
const DOWNLOAD_NETWORK = "probpera-planet-download-network-v1";
const EDITION = "probpera.globe-edition.v2", LEGACY_STYLE = "probpera.globe-style.v1";
const STAND = "probpera-planet-stand-v1";
const BACKGROUND = "probpera-planet-background-v1";
const COMPOSITION = "probpera-planet-composition-v1";
const compositionRecord = () => ({ schemaVersion: 1, commitId: "adapter-fixture:1", selection: {
  editionId: "rand-mcnally-1887", standId: "stand.base.wood", backgroundId: "background.base.library",
} });

function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() { return entries.size; },
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    key: vi.fn((index: number) => [...entries.keys()][index] ?? null),
    removeItem: vi.fn((key: string) => { entries.delete(key); }),
    setItem: vi.fn((key: string, value: string) => { entries.set(key, value); }),
  };
}
function browserEnvironment() {
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
  const navigator = { onLine: true, languages: ["ru-RU", "en-US"], language: "ru-RU" };
  const browser = Object.assign(new EventTarget(), {
    document,
    navigator,
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    open: vi.fn<NonNullable<WebAdapterWindow["open"]>>(() => null),
  });
  const windowAdd = vi.spyOn(browser, "addEventListener");
  const windowRemove = vi.spyOn(browser, "removeEventListener");
  const documentAdd = vi.spyOn(document, "addEventListener");
  const documentRemove = vi.spyOn(document, "removeEventListener");
  return { browser, document, navigator, windowAdd, windowRemove, documentAdd, documentRemove };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("browser capabilities and subscription lifetime", () => {
  it("observes explicit transport changes while online and removes the exact shared listener", () => {
    const env = browserEnvironment();
    const connection = Object.assign(new EventTarget(), { type: "wifi", effectiveType: "4g" });
    const add = vi.spyOn(connection, "addEventListener");
    const remove = vi.spyOn(connection, "removeEventListener");
    Object.assign(env.navigator, { connection });
    const adapter = createWebPlatformAdapter({ window: env.browser });
    expect(add).not.toHaveBeenCalled();
    expect(adapter.getSnapshot().networkType).toBe("wifi");
    const listener = vi.fn();
    const stopFirst = adapter.subscribe(listener);
    const stopSecond = adapter.subscribe(listener);
    connection.type = "cellular";
    connection.dispatchEvent(new Event("change"));
    expect(adapter.getSnapshot()).toEqual({ connectivity: "online", visibility: "active", networkType: "cellular" });
    expect(listener).toHaveBeenCalledTimes(1);
    connection.type = "ethernet";
    connection.dispatchEvent(new Event("change"));
    expect(adapter.getSnapshot().networkType).toBe("ethernet");
    const current = adapter.getSnapshot();
    connection.dispatchEvent(new Event("change"));
    expect(adapter.getSnapshot()).toBe(current);
    expect(listener).toHaveBeenCalledTimes(2);
    env.navigator.onLine = false;
    env.browser.dispatchEvent(new Event("offline"));
    expect(adapter.getSnapshot().networkType).toBeUndefined();
    stopFirst(); stopFirst();
    expect(remove).not.toHaveBeenCalled();
    stopSecond(); stopSecond();
    expect(add).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls).toEqual(add.mock.calls);
    connection.type = "wifi";
    connection.dispatchEvent(new Event("change"));
    expect(listener).toHaveBeenCalledTimes(3);
  });
  it("keeps unknown, unsupported and speed-only network information unknown", () => {
    const env = browserEnvironment();
    const connection = Object.assign(new EventTarget(), { type: "unknown" });
    const speed = vi.fn(() => "4g");
    Object.defineProperty(connection, "effectiveType", { get: speed });
    Object.assign(env.navigator, { connection });
    const adapter = createWebPlatformAdapter({ window: env.browser });
    for (const type of ["unknown", "other", "none", "mixed", "4g", ""]) {
      connection.type = type;
      expect(adapter.getSnapshot().networkType).toBeUndefined();
    }
    Reflect.deleteProperty(connection, "type");
    expect(adapter.getSnapshot().networkType).toBeUndefined();
    expect(speed).not.toHaveBeenCalled();
  });
  it("contains denied connection getters and listener methods without disabling online events", () => {
    const env = browserEnvironment();
    const connection = Object.assign(new EventTarget(), { type: "wifi" });
    const denied = vi.fn(() => { throw new Error("denied"); });
    Object.defineProperty(env.navigator, "connection", { configurable: true, get: denied });
    const adapter = createWebPlatformAdapter({ window: env.browser });
    expect(denied).not.toHaveBeenCalled();
    expect(adapter.getSnapshot().networkType).toBeUndefined();
    Object.defineProperty(env.navigator, "connection", { get: () => connection });
    Object.defineProperty(connection, "type", { get: denied });
    vi.spyOn(connection, "addEventListener").mockImplementation(denied);
    vi.spyOn(connection, "removeEventListener").mockImplementation(denied);
    const listener = vi.fn();
    const stop = adapter.subscribe(listener);
    expect(adapter.getSnapshot().networkType).toBeUndefined();
    env.navigator.onLine = false;
    env.browser.dispatchEvent(new Event("offline"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(() => { stop(); stop(); }).not.toThrow();
    expect(env.windowRemove.mock.calls).toEqual(env.windowAdd.mock.calls);
  });
  it("has no module-global browser reads or constructor listeners/storage/open side effects", async () => {
    const env = browserEnvironment();
    const storageGetter = vi.fn(() => { throw new Error("Storage must remain lazy"); });
    Object.defineProperty(env.browser, "localStorage", { configurable: true, get: storageGetter });
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const windowGetter = vi.fn(() => env.browser);
    Object.defineProperty(globalThis, "window", { configurable: true, get: windowGetter });
    onTestFinished(() => {
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
    });
    vi.resetModules();
    const imported = await import("./WebPlatformAdapter");
    expect(windowGetter).not.toHaveBeenCalled();
    expect(storageGetter).not.toHaveBeenCalled();
    const adapter = imported.createWebPlatformAdapter();
    expect(adapter.kind).toBe("web");
    expect(adapter.channel).toBe("web");
    expect(Object.isFrozen(adapter)).toBe(true);
    expect(storageGetter).not.toHaveBeenCalled();
    expect(env.windowAdd).not.toHaveBeenCalled();
    expect(env.documentAdd).not.toHaveBeenCalled();
    expect(env.browser.open).not.toHaveBeenCalled();
  });

  it("supports explicit SSR without falling back to an ambient browser", async () => {
    const env = browserEnvironment();
    vi.stubGlobal("window", env.browser);
    const adapter = createWebPlatformAdapter({ window: null });
    const first = adapter.getSnapshot();
    expect(first).toEqual({ connectivity: "unknown", visibility: "active" });
    expect(Object.isFrozen(first)).toBe(true);
    expect(adapter.getSnapshot()).toBe(first);
    expect(adapter.getSystemLanguages()).toEqual([]);
    expect(await adapter.preferences.set("probpera-interface-language", "en")).toBe(false);
    expect(adapter.openExternalLink("https://probpera.ru/")).toBe("unavailable");
    const unsubscribe = adapter.subscribe(vi.fn());
    unsubscribe();
    unsubscribe();
    expect(env.windowAdd).not.toHaveBeenCalled();
    expect(env.browser.open).not.toHaveBeenCalled();
  });

  it("caches immutable snapshots and notifies only actual network/visibility changes", () => {
    const env = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: env.browser });
    const first = adapter.getSnapshot();
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);
    expect(listener).not.toHaveBeenCalled();
    expect(first).toEqual({ connectivity: "online", visibility: "active" });
    env.browser.dispatchEvent(new Event("online"));
    env.document.dispatchEvent(new Event("visibilitychange"));
    expect(adapter.getSnapshot()).toBe(first);
    expect(listener).not.toHaveBeenCalled();
    env.navigator.onLine = false;
    env.browser.dispatchEvent(new Event("offline"));
    const offline = adapter.getSnapshot();
    expect(offline).not.toBe(first);
    expect(offline.connectivity).toBe("offline");
    expect(listener).toHaveBeenCalledTimes(1);
    env.document.visibilityState = "hidden";
    env.document.dispatchEvent(new Event("visibilitychange"));
    const hidden = adapter.getSnapshot();
    expect(hidden).not.toBe(offline);
    expect(Object.isFrozen(hidden)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    env.document.dispatchEvent(new Event("visibilitychange"));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("retains independent duplicate subscriptions and exact idempotent cleanup", () => {
    const env = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: env.browser });
    const listener = vi.fn();
    const removeFirst = adapter.subscribe(listener);
    const removeSecond = adapter.subscribe(listener);
    expect(env.windowAdd.mock.calls.map(([event]) => event)).toEqual(["online", "offline"]);
    expect(env.documentAdd.mock.calls.map(([event]) => event)).toEqual(["visibilitychange"]);
    env.navigator.onLine = false;
    env.browser.dispatchEvent(new Event("offline"));
    expect(listener).toHaveBeenCalledTimes(1);
    removeFirst();
    removeFirst();
    expect(env.windowRemove).not.toHaveBeenCalled();
    env.navigator.onLine = true;
    env.browser.dispatchEvent(new Event("online"));
    expect(listener).toHaveBeenCalledTimes(2);
    removeSecond();
    removeSecond();
    expect(env.windowRemove.mock.calls).toEqual(env.windowAdd.mock.calls);
    expect(env.documentRemove.mock.calls).toEqual(env.documentAdd.mock.calls);
    env.navigator.onLine = false;
    env.browser.dispatchEvent(new Event("offline"));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("supports StrictMode subscribe-cleanup-resubscribe with no listener accumulation", () => {
    const env = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: env.browser });
    const listener = vi.fn();
    adapter.subscribe(listener)();
    const unsubscribe = adapter.subscribe(listener);
    env.navigator.onLine = false;
    env.browser.dispatchEvent(new Event("offline"));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(env.windowAdd).toHaveBeenCalledTimes(4);
    expect(env.windowRemove.mock.calls).toEqual(env.windowAdd.mock.calls);
    expect(env.documentRemove.mock.calls).toEqual(env.documentAdd.mock.calls);
  });

  it("catches state changes between snapshot read and subscription", () => {
    const env = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: env.browser });
    adapter.getSnapshot();
    env.navigator.onLine = false;
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(adapter.getSnapshot().connectivity).toBe("offline");
    unsubscribe();
  });

  it("does not suppress event notifications when another consumer read the new snapshot first", () => {
    const env = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: env.browser });
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);
    env.navigator.onLine = false;
    const current = adapter.getSnapshot();
    expect(listener).not.toHaveBeenCalled();
    env.browser.dispatchEvent(new Event("offline"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(adapter.getSnapshot()).toBe(current);
    unsubscribe();
  });

  it("allows listeners to unsubscribe another callback during notification", () => {
    const env = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: env.browser });
    const second = vi.fn();
    let removeSecond = () => {};
    const removeFirst = adapter.subscribe(() => removeSecond());
    removeSecond = adapter.subscribe(second);
    env.navigator.onLine = false;
    env.browser.dispatchEvent(new Event("offline"));
    expect(second).not.toHaveBeenCalled();
    removeFirst();
  });

  it("falls back truthfully when network or visibility properties throw", () => {
    const env = browserEnvironment();
    Object.defineProperty(env.navigator, "onLine", { get() { throw new Error("Unavailable"); } });
    Object.defineProperty(env.document, "visibilityState", { get() { throw new Error("Unavailable"); } });
    const adapter = createWebPlatformAdapter({ window: env.browser });
    expect(adapter.getSnapshot()).toEqual({ connectivity: "unknown", visibility: "active" });
  });
});

describe("non-secret best-effort canonical preferences", () => {
  it("round-trips only the bounded composition record and distinguishes malformed storage from confirmed absence", async () => {
    const env = browserEnvironment(), adapter = createWebPlatformAdapter({ window: env.browser });
    const fresh = createWebPlatformAdapter({ window: env.browser }), value = JSON.stringify(compositionRecord(), null, 2);
    expect(await adapter.preferences.get(COMPOSITION)).toBeNull();
    expect(await adapter.preferences.set(COMPOSITION, value)).toBe(true);
    expect(await fresh.preferences.get(COMPOSITION)).toBe(value);
    expect(env.browser.localStorage.setItem).toHaveBeenCalledTimes(1);
    for (const key of [COMPOSITION + ":en", COMPOSITION + "\u0000", "probpera-planet-composition-v2"]) {
      expect(await fresh.preferences.get(key)).toBeNull(); expect(await fresh.preferences.set(key, value)).toBe(false);
      expect(await fresh.preferences.remove(key)).toBe(false);
    }
    for (const invalid of ["{}", "null", JSON.stringify({ ...compositionRecord(), approval: true }),
      JSON.stringify({ ...compositionRecord(), selection: { ...compositionRecord().selection, backgroundId: "background.base.child-room" } })]) {
      const writes = vi.mocked(env.browser.localStorage.setItem).mock.calls.length;
      expect(await fresh.preferences.set(COMPOSITION, invalid)).toBe(false);
      expect(env.browser.localStorage.setItem).toHaveBeenCalledTimes(writes);
      env.browser.localStorage.setItem(COMPOSITION, invalid);
      await expect(fresh.preferences.get(COMPOSITION)).rejects.toThrow("composition-preference-unavailable");
    }
    expect(await fresh.preferences.remove(COMPOSITION)).toBe(true);
    expect(await fresh.preferences.get(COMPOSITION)).toBeNull();
  });

  it("reports composition storage failure without promising absence or an acknowledged write", async () => {
    const env = browserEnvironment(), adapter = createWebPlatformAdapter({ window: env.browser });
    vi.mocked(env.browser.localStorage.getItem).mockImplementationOnce(() => { throw new Error("Read denied"); });
    await expect(adapter.preferences.get(COMPOSITION)).rejects.toThrow("composition-preference-unavailable");
    vi.mocked(env.browser.localStorage.setItem).mockImplementationOnce(() => { throw new Error("Write denied"); });
    expect(await adapter.preferences.set(COMPOSITION, JSON.stringify(compositionRecord()))).toBe(false);
    await expect(createWebPlatformAdapter({ window: null }).preferences.get(COMPOSITION)).rejects.toThrow("composition-preference-unavailable");
    vi.mocked(env.browser.localStorage.getItem).mockImplementation(() => { throw new Error("Read denied"); });
    installSafeWebStorage(env.browser, null);
    expect(env.browser.localStorage.getItem(COMPOSITION)).toBeNull();
    await expect(createWebPlatformAdapter({ window: env.browser }).preferences.get(COMPOSITION)).rejects.toThrow("composition-preference-unavailable");
    await expect(createWebPlatformAdapter({ window: env.browser }).preferences.get(BACKGROUND)).rejects.toThrow("customization-preference-unavailable");
  });

  it("confines the new background preference to its exact adult IDs and browser key", async () => {
    const env = browserEnvironment(), adapter = createWebPlatformAdapter({ window: env.browser });
    const fresh = createWebPlatformAdapter({ window: env.browser });
    for (const value of ["background.base.site-starfield", "background.base.library"]) {
      expect(await adapter.preferences.set(BACKGROUND, value)).toBe(true);
      expect(await fresh.preferences.get(BACKGROUND)).toBe(value);
    }
    expect(env.browser.localStorage.length).toBe(1);
    expect(await fresh.preferences.remove(BACKGROUND)).toBe(true);
    for (const value of ["canonical", "stand.base.wood", "background.base.child-room", "library", "background.base.library "]) {
      expect(await fresh.preferences.set(BACKGROUND, value)).toBe(false);
      env.browser.localStorage.setItem(BACKGROUND, value); await expect(fresh.preferences.get(BACKGROUND)).rejects.toThrow("customization-preference-unavailable");
    }
    vi.mocked(env.browser.localStorage.getItem).mockClear(); vi.mocked(env.browser.localStorage.setItem).mockClear();
    vi.mocked(env.browser.localStorage.removeItem).mockClear();
    for (const key of [BACKGROUND + ":en", BACKGROUND + "\u0000"]) {
      expect(await fresh.preferences.get(key)).toBeNull(); expect(await fresh.preferences.set(key, "background.base.library")).toBe(false);
      expect(await fresh.preferences.remove(key)).toBe(false);
    }
    expect(env.browser.localStorage.getItem).not.toHaveBeenCalled();
    expect(env.browser.localStorage.setItem).not.toHaveBeenCalled(); expect(env.browser.localStorage.removeItem).not.toHaveBeenCalled();
  });

  it("round-trips only exact adult stand choices without extending browser storage authority", async () => {
    const env = browserEnvironment(), adapter = createWebPlatformAdapter({ window: env.browser });
    const recreated = createWebPlatformAdapter({ window: env.browser });
    for (const value of ["canonical", "stand.base.three-whales", "stand.base.portrait-pushkin", "stand.base.portrait-hemingway", "stand.base.portrait-tolstoy", "stand.base.museum", "stand.base.wood", "stand.base.book-stack"]) {
      expect(await adapter.preferences.set(STAND, value)).toBe(true);
      expect(await recreated.preferences.get(STAND)).toBe(value);
    }
    expect(env.browser.localStorage.length).toBe(1);
    expect(await recreated.preferences.remove(STAND)).toBe(true);
    expect(await recreated.preferences.get(STAND)).toBeNull();
    for (const value of ["wood", "base.stand.wood", "stand.base.child-book-cloud", "stand.base.wood ", "constructor"]) {
      expect(await recreated.preferences.set(STAND, value)).toBe(false);
      env.browser.localStorage.setItem(STAND, value);
      await expect(recreated.preferences.get(STAND)).rejects.toThrow("customization-preference-unavailable");
    }
    vi.mocked(env.browser.localStorage.getItem).mockClear();
    vi.mocked(env.browser.localStorage.setItem).mockClear();
    vi.mocked(env.browser.localStorage.removeItem).mockClear();
    for (const key of [STAND + ":en", STAND + "\u0000", "probpera-planet-stand-v2"]) {
      expect(await recreated.preferences.get(key)).toBeNull();
      expect(await recreated.preferences.set(key, "canonical")).toBe(false);
      expect(await recreated.preferences.remove(key)).toBe(false);
    }
    expect(env.browser.localStorage.getItem).not.toHaveBeenCalled();
    expect(env.browser.localStorage.setItem).not.toHaveBeenCalled();
    expect(env.browser.localStorage.removeItem).not.toHaveBeenCalled();
  });

  it("round-trips canonical globe IDs and exact legacy styles without a second locale-specific preference", async () => {
    const { browser } = browserEnvironment(), adapter = createWebPlatformAdapter({ window: browser });
    const recreated = createWebPlatformAdapter({ window: browser });
    for (const value of GLOBE_EDITION_IDS) {
      expect(await adapter.preferences.set(EDITION, value)).toBe(true);
      expect(await recreated.preferences.get(EDITION)).toBe(value);
      expect(await recreated.preferences.set(LEGACY_STYLE, value)).toBe(false);
    }
    for (const value of ["antique", "modern", "earth"]) {
      for (const key of [EDITION, LEGACY_STYLE]) {
        expect(await adapter.preferences.set(key, value)).toBe(true);
        expect(await recreated.preferences.get(key)).toBe(value);
      }
    }
    expect(browser.localStorage.length).toBe(2);
    expect(browser.sessionStorage.setItem).not.toHaveBeenCalled();
  });

  it("filters corrupt edition values and blocks arbitrary or locale-suffixed edition keys", async () => {
    const { browser } = browserEnvironment(), adapter = createWebPlatformAdapter({ window: browser });
    for (const key of [EDITION, LEGACY_STYLE]) {
      for (const value of ["", "earth ", "NASA-BLUE-MARBLE", "constructor", "skin.base.earth"]) {
        expect(await adapter.preferences.set(key, value)).toBe(false); expect(browser.localStorage.setItem).not.toHaveBeenCalled();
        browser.localStorage.setItem(key, value); await expect(adapter.preferences.get(key)).rejects.toThrow("edition-preference-unavailable");
        vi.mocked(browser.localStorage.setItem).mockClear();
      }
    }
    const reads = vi.mocked(browser.localStorage.getItem).mock.calls.length;
    for (const key of [EDITION + ":en", LEGACY_STYLE + "\u0000", "probpera.globe-edition.v3", "entitlements"]) {
      expect(await adapter.preferences.set(key, "earth")).toBe(false);
      expect(await adapter.preferences.get(key)).toBeNull(); expect(await adapter.preferences.remove(key)).toBe(false);
    }
    expect(browser.localStorage.getItem).toHaveBeenCalledTimes(reads);
    expect(browser.localStorage.setItem).not.toHaveBeenCalled(); expect(browser.localStorage.removeItem).not.toHaveBeenCalled();
  });
  it.each(["any-network", "wifi-only"])("restores only the allowlisted download policy %s", async value => {
    const { browser } = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: browser });
    expect(await adapter.preferences.set(DOWNLOAD_NETWORK, value)).toBe(true);
    const recreated = createWebPlatformAdapter({ window: browser });
    expect(await recreated.preferences.get(DOWNLOAD_NETWORK)).toBe(value);
    expect(await recreated.preferences.set(DOWNLOAD_NETWORK, "4g")).toBe(false);
    expect(await recreated.preferences.remove(DOWNLOAD_NETWORK)).toBe(true);
    browser.localStorage.setItem(DOWNLOAD_NETWORK, "cellular");
    expect(await recreated.preferences.get(DOWNLOAD_NETWORK)).toBeNull();
  });
  it.each(["high", "balanced", "economy"])("restores graphics quality %s through a fresh web adapter", async value => {
    const { browser } = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: browser });
    expect(await adapter.preferences.set(GRAPHICS, value)).toBe(true);
    const recreated = createWebPlatformAdapter({ window: browser });
    expect(await recreated.preferences.get(GRAPHICS)).toBe(value);
    expect(recreated.preferences.persistence).toBe("best-effort");
    expect(browser.localStorage.length).toBe(1);
    expect(await recreated.preferences.remove(GRAPHICS)).toBe(true);
    expect(await adapter.preferences.get(GRAPHICS)).toBeNull();
    expect(browser.sessionStorage.getItem).not.toHaveBeenCalled();
    expect(browser.sessionStorage.setItem).not.toHaveBeenCalled();
  });
  it("rejects unsupported graphics values and lookalike keys without storage writes", async () => {
    const { browser } = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: browser });
    for (const value of ["", "High", "auto", "high ", "economy\u0000"]) {
      expect(await adapter.preferences.set(GRAPHICS, value)).toBe(false);
      expect(browser.localStorage.setItem).not.toHaveBeenCalled();
      browser.localStorage.setItem(GRAPHICS, value);
      expect(await adapter.preferences.get(GRAPHICS)).toBeNull();
      vi.mocked(browser.localStorage.setItem).mockClear();
    }
    for (const key of [GRAPHICS + ":en", GRAPHICS + "\u0000"]) {
      expect(await adapter.preferences.set(key, "high")).toBe(false);
      expect(await adapter.preferences.get(key)).toBeNull();
      expect(await adapter.preferences.remove(key)).toBe(false);
    }
    expect(browser.localStorage.setItem).not.toHaveBeenCalled();
    expect(browser.localStorage.removeItem).not.toHaveBeenCalled();
  });
  it("uses existing namespaced values and validates both stored and written preferences", async () => {
    const { browser } = browserEnvironment();
    browser.localStorage.setItem("probpera-interface-language", "ru");
    const adapter = createWebPlatformAdapter({ window: browser });
    expect(adapter.preferences.persistence).toBe("best-effort");
    expect(await adapter.preferences.get("probpera-interface-language")).toBe("ru");
    expect(await adapter.preferences.set("probpera-interface-language", "en")).toBe(true);
    expect(browser.localStorage.getItem("probpera-interface-language")).toBe("en");
    expect(await adapter.preferences.set("probpera-display-mode", "book")).toBe(true);
    expect(await adapter.preferences.get("probpera-display-mode")).toBe("book");
    expect(await adapter.preferences.set("probpera-interface-language", "fr")).toBe(false);
    browser.localStorage.setItem("probpera-display-mode", "malformed");
    expect(await adapter.preferences.get("probpera-display-mode")).toBeNull();
    expect(await adapter.preferences.remove("probpera-interface-language")).toBe(true);
    expect(await adapter.preferences.get("probpera-interface-language")).toBeNull();
    expect(browser.sessionStorage.getItem).not.toHaveBeenCalled();
  });

  it.each(["__proto__", "constructor", "toString", "token", "entitlements", "probpera-entitlements", "child-profile", "probpera-profile", WELCOME + ":entitlements", WELCOME + "\u0000", "probpera-interface-language\u0000", "interface-language"])("rejects unapproved key %j without touching storage", async (key) => {
    const { browser } = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: browser });
    expect(await adapter.preferences.get(key)).toBeNull();
    expect(await adapter.preferences.set(key, "en")).toBe(false);
    expect(await adapter.preferences.remove(key)).toBe(false);
    expect(browser.localStorage.getItem).not.toHaveBeenCalled();
    expect(browser.localStorage.setItem).not.toHaveBeenCalled();
    expect(browser.localStorage.removeItem).not.toHaveBeenCalled();
  });

  it("persists the exact welcome marker through a fresh adapter using only existing local storage", async () => {
    const { browser } = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: browser });
    expect(await adapter.preferences.get(WELCOME)).toBeNull();
    expect(await adapter.preferences.set(WELCOME, "completed")).toBe(true);
    expect(browser.localStorage.setItem).toHaveBeenCalledExactlyOnceWith(WELCOME, "completed");
    const recreated = createWebPlatformAdapter({ window: browser });
    expect(await recreated.preferences.get(WELCOME)).toBe("completed");
    expect(recreated.preferences.persistence).toBe("best-effort");
    expect(browser.localStorage.length).toBe(1);
    expect(await recreated.preferences.remove(WELCOME)).toBe(true);
    expect(await adapter.preferences.get(WELCOME)).toBeNull();
    expect(browser.sessionStorage.getItem).not.toHaveBeenCalled();
    expect(browser.sessionStorage.setItem).not.toHaveBeenCalled();
  });

  it.each(["", "complete", "Completed", "true", " completed", "completed\u0000", '{"completed":true,"entitlements":"paid"}'])(
    "rejects invalid welcome values on both write and stored read: %j", async value => {
      const { browser } = browserEnvironment();
      browser.localStorage.setItem(WELCOME, "completed");
      vi.mocked(browser.localStorage.setItem).mockClear();
      const adapter = createWebPlatformAdapter({ window: browser });
      expect(await adapter.preferences.set(WELCOME, value)).toBe(false);
      expect(browser.localStorage.setItem).not.toHaveBeenCalled();
      expect(browser.localStorage.getItem).not.toHaveBeenCalled();
      expect(browser.localStorage.getItem(WELCOME)).toBe("completed");
      browser.localStorage.setItem(WELCOME, value);
      expect(await adapter.preferences.get(WELCOME)).toBeNull();
    });

  it("handles inaccessible/quota-limited storage without installing a facade", async () => {
    const { browser } = browserEnvironment();
    const storage = browser.localStorage;
    vi.mocked(storage.setItem).mockImplementation(() => { throw new Error("Quota exceeded"); });
    const adapter = createWebPlatformAdapter({ window: browser });
    expect(await adapter.preferences.set("probpera-interface-language", "en")).toBe(false);
    const unavailable = vi.fn(() => { throw new Error("Privacy mode"); });
    Object.defineProperty(browser, "localStorage", { configurable: true, get: unavailable });
    expect(await adapter.preferences.get("probpera-interface-language")).toBeNull();
    expect(await adapter.preferences.set("probpera-interface-language", "en")).toBe(false);
    expect(await adapter.preferences.remove("probpera-interface-language")).toBe(false);
    expect(Object.getOwnPropertyDescriptor(browser, "localStorage")?.get).toBe(unavailable);
  });

  it("reuses a subsequently installed safe memory fallback without claiming durability", async () => {
    const { browser } = browserEnvironment();
    Object.defineProperty(browser, "localStorage", { configurable: true, get() { throw new Error("Privacy mode"); } });
    const adapter = createWebPlatformAdapter({ window: browser });
    expect(installSafeWebStorage(browser, null)).toBe(true);
    expect(await adapter.preferences.set("probpera-interface-language", "en")).toBe(true);
    expect(await adapter.preferences.get("probpera-interface-language")).toBe("en");
    expect(adapter.preferences.persistence).toBe("best-effort");
    expect(await adapter.preferences.remove("probpera-interface-language")).toBe(true);
    expect(await adapter.preferences.get("probpera-interface-language")).toBeNull();
  });

  it("does not acknowledge writes/removals that a storage shim silently ignores", async () => {
    const { browser } = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: browser });
    browser.localStorage.setItem("probpera-interface-language", "ru");
    vi.mocked(browser.localStorage.setItem).mockImplementation(() => {});
    vi.mocked(browser.localStorage.removeItem).mockImplementation(() => {});
    expect(await adapter.preferences.set("probpera-interface-language", "en")).toBe(false);
    expect(await adapter.preferences.remove("probpera-interface-language")).toBe(false);
    expect(await adapter.preferences.get("probpera-interface-language")).toBe("ru");
  });
});

describe("system language preferences", () => {
  it("returns an immutable detached navigator preference list without changing its order", () => {
    const env = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: env.browser });
    const languages = adapter.getSystemLanguages();
    expect(languages).toEqual(["ru-RU", "en-US"]);
    expect(Object.isFrozen(languages)).toBe(true);
    expect(languages).not.toBe(env.navigator.languages);
    env.navigator.languages[0] = "en-GB";
    expect(languages[0]).toBe("ru-RU");
    expect(adapter.getSystemLanguages()[0]).toBe("en-GB");
  });

  it("falls back only to navigator.language when language list is empty or unavailable", () => {
    const env = browserEnvironment();
    env.navigator.languages = [];
    const adapter = createWebPlatformAdapter({ window: env.browser });
    expect(adapter.getSystemLanguages()).toEqual(["ru-RU"]);
    Object.defineProperty(env.navigator, "languages", { get() { throw new Error("Unavailable"); } });
    expect(adapter.getSystemLanguages()).toEqual(["ru-RU"]);
    Object.defineProperty(env.navigator, "language", { get() { throw new Error("Unavailable"); } });
    expect(adapter.getSystemLanguages()).toEqual([]);
  });
});

describe("explicit external HTTPS navigation", () => {
  it("opens once with privacy features and reports unobservable popup outcome as requested", () => {
    const { browser } = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: browser });
    const input = "https://пример.рф/книга?q=english%20title";
    expect(browser.open).not.toHaveBeenCalled();
    expect(adapter.openExternalLink(input)).toBe("requested");
    expect(browser.open).toHaveBeenCalledExactlyOnceWith(new URL(input).href, "_blank", "noopener,noreferrer");
  });

  it("reports an observable handle, absent capability and browser exception truthfully", () => {
    const { browser } = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: browser });
    browser.open.mockReturnValue({});
    expect(adapter.openExternalLink("HTTPS://probpera.ru/en/")).toBe("opened");
    browser.open.mockImplementation(() => { throw new Error("Browser denied access"); });
    expect(adapter.openExternalLink("https://probpera.ru/en/")).toBe("unavailable");
    const unavailable = createWebPlatformAdapter({ window: new EventTarget() });
    expect(unavailable.openExternalLink("https://probpera.ru/")).toBe("unavailable");
  });

  it.each([
    "javascript:alert(1)", "data:text/html,test", "http://probpera.ru", "file:///tmp/file", "//probpera.ru", "/en/", "https:probpera.ru", "https:///probpera.ru", "https://", "https://user:secret@probpera.ru", "https://@probpera.ru", "https://probpera.ru\\@example.test", " https://probpera.ru", "https://probpera.ru ", "https://probpera.ru/\npage", "https://probpera.ru/%0Apage", "https://probpera.ru/%00", "https://probpera.ru/%7f", "https://probpera.ru/%c2%85", "https://probpera.ru/%5c", "https://probpera.ru/%invalid",
  ])("blocks unsafe or ambiguous URL %j without opening a window", (url) => {
    const { browser } = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: browser });
    expect(adapter.openExternalLink(url)).toBe("blocked");
    expect(browser.open).not.toHaveBeenCalled();
  });
});
