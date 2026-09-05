import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { installSafeWebStorage } from "../../../utils/safeWebStorage";
import {
  createWebPlatformAdapter,
  type WebAdapterWindow,
} from "./WebPlatformAdapter";

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

  it.each(["__proto__", "constructor", "toString", "token", "entitlements", "probpera-entitlements", "probpera-interface-language\u0000", "interface-language"])("rejects unapproved key %j without touching storage", async (key) => {
    const { browser } = browserEnvironment();
    const adapter = createWebPlatformAdapter({ window: browser });
    expect(await adapter.preferences.get(key)).toBeNull();
    expect(await adapter.preferences.set(key, "en")).toBe(false);
    expect(await adapter.preferences.remove(key)).toBe(false);
    expect(browser.localStorage.getItem).not.toHaveBeenCalled();
    expect(browser.localStorage.setItem).not.toHaveBeenCalled();
    expect(browser.localStorage.removeItem).not.toHaveBeenCalled();
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
