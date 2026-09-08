import { describe, expect, it, vi } from "vitest";
import { createHostPlatformServices, type HostAppBridge, type HostAppState, type HostListenerHandle,
  type HostNetworkBridge, type HostNetworkState, type HostPlatformServicesOptions, type HostPreferenceBridge } from "./HostPlatformServices";

const LANGUAGE = "probpera-interface-language";
const DISPLAY = "probpera-display-mode";
const WELCOME = "probpera-planet-welcome-v1";
const MAIL = "mailto:probperasite@yandex.ru";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let count = 0; count < 12; count++) await Promise.resolve(); }
function fixture(overrides: Partial<Omit<HostPlatformServicesOptions, "kind" | "channel">> = {}) {
  const appEvents: ((state: HostAppState) => void)[] = [];
  const networkEvents: ((state: HostNetworkState) => void)[] = [];
  const appHandles: HostListenerHandle[] = [];
  const networkHandles: HostListenerHandle[] = [];
  const app = {
    getState: vi.fn<HostAppBridge["getState"]>(async () => ({ isActive: true })),
    addListener: vi.fn<HostAppBridge["addListener"]>(async (_event, listener) => {
      appEvents.push(listener);
      const handle = { remove: vi.fn(async () => undefined) };
      appHandles.push(handle);
      return handle;
    }),
  };
  const network = {
    getStatus: vi.fn<HostNetworkBridge["getStatus"]>(async () => ({ connected: true })),
    addListener: vi.fn<HostNetworkBridge["addListener"]>(async (_event, listener) => {
      networkEvents.push(listener);
      const handle = { remove: vi.fn(async () => undefined) };
      networkHandles.push(handle);
      return handle;
    }),
  };
  const memory = new Map<string, string>();
  const preferences = {
    get: vi.fn<HostPreferenceBridge["get"]>(async ({ key }) => ({ value: memory.get(key) ?? null })),
    set: vi.fn<HostPreferenceBridge["set"]>(async ({ key, value }) => { memory.set(key, value); }),
    remove: vi.fn<HostPreferenceBridge["remove"]>(async ({ key }) => { memory.delete(key); }),
  };
  const openBrowser = vi.fn(async (_options: { url: string }): Promise<void> => undefined);
  const openMail = vi.fn(async (_options: { url: string }) => ({ completed: true }));
  const onFailure = vi.fn();
  const services = createHostPlatformServices({ kind: "android", channel: "dev", languages: ["ru", "en"],
    app, network, preferences, openBrowser, openMail, onFailure, ...overrides });
  return { services, app, network, preferences, memory, appEvents, networkEvents, appHandles, networkHandles, openBrowser, openMail, onFailure };
}

describe("SDK-free host identity and stable snapshots", () => {
  it("does no native IO at construction or during repeated snapshot/language reads", () => {
    const f = fixture();
    const snapshot = f.services.getSnapshot();
    expect(snapshot).toEqual({ connectivity: "unknown", visibility: "active" });
    expect(f.services.getSnapshot()).toBe(snapshot);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(f.services.getSystemLanguages()).toBe(f.services.getSystemLanguages());
    for (const method of [f.app.getState, f.app.addListener, f.network.getStatus, f.network.addListener,
      f.preferences.get, f.preferences.set, f.openBrowser, f.openMail]) expect(method).not.toHaveBeenCalled();
  });
  it("copies and validates the pre-resolved language snapshot without ambient fallback", () => {
    const languages = ["ru-RU", "EN-us", "bad_tag", "", "en-US", "fr"];
    const f = fixture({ languages });
    languages.push("de");
    expect(f.services.getSystemLanguages()).toEqual(["ru-RU", "en-US", "fr"]);
    expect(Object.isFrozen(f.services.getSystemLanguages())).toBe(true);
    expect(fixture({ languages: [] }).services.getSystemLanguages()).toEqual([]);
  });
  it.each([
    ["android", "dev"], ["android", "googlePlay"], ["android", "ruStore"], ["ios", "dev"], ["ios", "appStore"],
  ])("preserves the injected %s/%s distribution", (kind, channel) => {
    const services = createHostPlatformServices({ kind, channel, languages: [] } as HostPlatformServicesOptions);
    expect(services.kind).toBe(kind);
    expect(services.channel).toBe(channel);
  });
  it.each([["web", "web"], ["ios", "googlePlay"], ["android", "appStore"], ["ios", "unknown"]])(
    "rejects invalid %s/%s before native calls", (kind, channel) => {
      expect(() => createHostPlatformServices({ kind, channel, languages: [] } as unknown as HostPlatformServicesOptions))
        .toThrow("Invalid native platform distribution");
    });
});

describe("native subscription lifetimes and ordering", () => {
  it("shares one native listener pair with independent duplicate callback cleanup", async () => {
    const f = fixture();
    const callback = vi.fn();
    const other = vi.fn();
    const first = f.services.subscribe(callback);
    const duplicate = f.services.subscribe(callback);
    const last = f.services.subscribe(other);
    await flush();
    expect(f.app.addListener).toHaveBeenCalledTimes(1);
    expect(f.network.addListener).toHaveBeenCalledTimes(1);
    expect(f.app.addListener.mock.calls[0][0]).toBe("appStateChange");
    expect(f.network.addListener.mock.calls[0][0]).toBe("networkStatusChange");
    callback.mockClear(); other.mockClear();
    const stable = f.services.getSnapshot();
    f.networkEvents[0]({ connected: true });
    expect(f.services.getSnapshot()).toBe(stable);
    expect(callback).not.toHaveBeenCalled();
    f.networkEvents[0]({ connected: false });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
    first(); first();
    f.networkEvents[0]({ connected: true });
    expect(callback).toHaveBeenCalledTimes(2);
    duplicate();
    f.networkEvents[0]({ connected: false });
    expect(callback).toHaveBeenCalledTimes(2);
    expect(f.networkHandles[0].remove).not.toHaveBeenCalled();
    last(); last();
    expect(f.appHandles[0].remove).toHaveBeenCalledTimes(1);
    expect(f.networkHandles[0].remove).toHaveBeenCalledTimes(1);
  });
  it("removes handles that arrive after cleanup and isolates a newer subscription lifetime", async () => {
    const f = fixture();
    const lateApp = deferred<HostListenerHandle>();
    const lateNetwork = deferred<HostListenerHandle>();
    let oldApp!: (state: HostAppState) => void;
    let oldNetwork!: (state: HostNetworkState) => void;
    f.app.addListener.mockImplementationOnce((_event, callback) => { oldApp = callback; return lateApp.promise; });
    f.network.addListener.mockImplementationOnce((_event, callback) => { oldNetwork = callback; return lateNetwork.promise; });
    const stopOld = f.services.subscribe(vi.fn());
    stopOld();
    const currentCallback = vi.fn();
    const stopNew = f.services.subscribe(currentCallback);
    await flush();
    const snapshot = f.services.getSnapshot();
    const appHandle = { remove: vi.fn(async () => undefined) };
    const networkHandle = { remove: vi.fn(async () => undefined) };
    lateApp.resolve(appHandle); lateNetwork.resolve(networkHandle);
    await flush();
    oldApp({ isActive: false }); oldNetwork({ connected: false });
    expect(f.services.getSnapshot()).toBe(snapshot);
    expect(appHandle.remove).toHaveBeenCalledTimes(1);
    expect(networkHandle.remove).toHaveBeenCalledTimes(1);
    expect(f.app.getState).toHaveBeenCalledTimes(2);
    expect(f.network.getStatus).toHaveBeenCalledTimes(2);
    stopNew();
  });
  it("initializes independently of pending registration and does not reread over events when handles arrive", async () => {
    const f = fixture();
    const appRegistration = deferred<HostListenerHandle>();
    const networkRegistration = deferred<HostListenerHandle>();
    let appEvent!: (state: HostAppState) => void;
    let networkEvent!: (state: HostNetworkState) => void;
    f.app.addListener.mockImplementation((_event, callback) => { appEvent = callback; return appRegistration.promise; });
    f.network.addListener.mockImplementation((_event, callback) => { networkEvent = callback; return networkRegistration.promise; });
    const stop = f.services.subscribe(vi.fn());
    await flush();
    expect(f.services.getSnapshot()).toEqual({ visibility: "active", connectivity: "online" });
    appEvent({ isActive: false }); networkEvent({ connected: false });
    const appHandle = { remove: vi.fn(async () => undefined) };
    const networkHandle = { remove: vi.fn(async () => undefined) };
    appRegistration.resolve(appHandle); networkRegistration.resolve(networkHandle);
    await flush();
    expect(f.services.getSnapshot()).toEqual({ visibility: "background", connectivity: "offline" });
    expect(f.app.getState).toHaveBeenCalledTimes(1);
    expect(f.network.getStatus).toHaveBeenCalledTimes(1);
    stop();
    expect(appHandle.remove).toHaveBeenCalledTimes(1);
    expect(networkHandle.remove).toHaveBeenCalledTimes(1);
  });
  it("does not start stale initial reads after synchronous registration callbacks supplied state", async () => {
    const f = fixture();
    const appHandle = { remove: vi.fn(async () => undefined) };
    const networkHandle = { remove: vi.fn(async () => undefined) };
    f.app.addListener.mockImplementation(async (_event, callback) => { callback({ isActive: false }); return appHandle; });
    f.network.addListener.mockImplementation(async (_event, callback) => { callback({ connected: false }); return networkHandle; });
    const stop = f.services.subscribe(vi.fn());
    await flush();
    expect(f.services.getSnapshot()).toEqual({ visibility: "background", connectivity: "offline" });
    expect(f.app.getState).not.toHaveBeenCalled();
    expect(f.network.getStatus).not.toHaveBeenCalled();
    stop();
  });
  it("does not let initial asynchronous reads overwrite newer app/network events", async () => {
    const f = fixture();
    const appRead = deferred<HostAppState>();
    const networkRead = deferred<HostNetworkState>();
    f.app.getState.mockReturnValue(appRead.promise);
    f.network.getStatus.mockReturnValue(networkRead.promise);
    const stop = f.services.subscribe(vi.fn());
    await flush();
    expect(f.app.getState).toHaveBeenCalledTimes(1);
    f.appEvents[0]({ isActive: false });
    f.networkEvents[0]({ connected: false });
    appRead.resolve({ isActive: true }); networkRead.resolve({ connected: true });
    await flush();
    expect(f.services.getSnapshot()).toEqual({ visibility: "background", connectivity: "offline" });
    stop();
  });
  it("refreshes the network on resume and fences an older read and a later event", async () => {
    const f = fixture();
    const first = deferred<HostNetworkState>();
    const resume = deferred<HostNetworkState>();
    f.network.getStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(resume.promise);
    const stop = f.services.subscribe(vi.fn());
    await flush();
    f.appEvents[0]({ isActive: false });
    f.appEvents[0]({ isActive: true });
    expect(f.network.getStatus).toHaveBeenCalledTimes(2);
    first.resolve({ connected: true });
    await flush();
    expect(f.services.getSnapshot().connectivity).toBe("unknown");
    f.networkEvents[0]({ connected: false });
    resume.resolve({ connected: true });
    await flush();
    expect(f.services.getSnapshot().connectivity).toBe("offline");
    f.appEvents[0]({ isActive: true });
    expect(f.network.getStatus).toHaveBeenCalledTimes(2);
    stop();
  });
  it("ignores both completed reads and events after the last unsubscribe", async () => {
    const f = fixture();
    const pending = deferred<HostNetworkState>();
    f.network.getStatus.mockReturnValue(pending.promise);
    const callback = vi.fn();
    const stop = f.services.subscribe(callback);
    await flush();
    stop();
    const snapshot = f.services.getSnapshot();
    pending.resolve({ connected: false });
    f.appEvents[0]({ isActive: false });
    f.networkEvents[0]({ connected: true });
    await flush();
    expect(f.services.getSnapshot()).toBe(snapshot);
    expect(callback).not.toHaveBeenCalled();
  });
  it("continues independent state reads after listener registration rejection", async () => {
    const f = fixture();
    f.app.addListener.mockRejectedValue(new Error("native app unavailable"));
    f.network.addListener.mockRejectedValue(new Error("native network unavailable"));
    const stop = f.services.subscribe(vi.fn());
    await flush();
    expect(f.services.getSnapshot()).toEqual({ visibility: "active", connectivity: "online" });
    expect(f.onFailure.mock.calls.map(([failure]) => failure.operation)).toEqual(["app-listener", "network-listener"]);
    stop();
  });
  it("rejects malformed network/app events without throwing through the native callback", async () => {
    const f = fixture();
    const stop = f.services.subscribe(vi.fn());
    await flush();
    f.appEvents[0]({ isActive: false });
    f.networkEvents[0]({ connected: "yes" } as unknown as HostNetworkState);
    f.appEvents[0]({ isActive: "yes" } as unknown as HostAppState);
    expect(f.services.getSnapshot()).toEqual({ connectivity: "unknown", visibility: "background" });
    expect(() => f.networkEvents[0](Object.defineProperty({}, "connected", { get() { throw new Error("native getter"); } }) as HostNetworkState)).not.toThrow();
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "network-status", reason: "invalid-response" });
    stop();
  });
  it("isolates callback exceptions, late callback rejection and a rejecting error sink", async () => {
    const errors = vi.fn(async () => { throw new Error("sink failure"); });
    const f = fixture({ onFailure: errors });
    const stopA = f.services.subscribe(() => { throw new Error("subscriber failure"); });
    const stopB = f.services.subscribe(async () => { throw new Error("async subscriber failure"); });
    const healthy = vi.fn();
    const stopC = f.services.subscribe(healthy);
    await flush();
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith({ operation: "subscriber", reason: "callback-failed" });
    f.networkHandles[0].remove = vi.fn(async () => { throw new Error("remove failure"); });
    stopA(); stopB(); stopC();
    await flush();
    expect(errors).toHaveBeenCalledWith({ operation: "listener-remove", reason: "unavailable" });
  });
  it("honors unsubscribe during notification and reports absent capabilities", async () => {
    const f = fixture();
    const skipped = vi.fn();
    let stopSecond: () => void = () => undefined;
    const stopFirst = f.services.subscribe(() => stopSecond());
    stopSecond = f.services.subscribe(skipped);
    await flush();
    expect(skipped).not.toHaveBeenCalled();
    stopFirst();
    const missing = fixture({ app: undefined, network: undefined });
    const stopMissing = missing.services.subscribe(vi.fn());
    expect(missing.services.getSnapshot()).toEqual({ connectivity: "unknown", visibility: "active" });
    expect(missing.onFailure).toHaveBeenCalledWith({ operation: "app-listener", reason: "unavailable" });
    expect(missing.onFailure).toHaveBeenCalledWith({ operation: "network-listener", reason: "unavailable" });
    stopMissing();
  });
  it("observes initial native read rejection without inventing a connected snapshot", async () => {
    const f = fixture();
    f.app.getState.mockRejectedValue(new Error("state failure"));
    f.network.getStatus.mockRejectedValue(new Error("network failure"));
    const stop = f.services.subscribe(vi.fn());
    await flush();
    expect(f.services.getSnapshot()).toEqual({ connectivity: "unknown", visibility: "active" });
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "app-state", reason: "unavailable" });
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "network-status", reason: "unavailable" });
    stop();
  });
  it("contains malformed handles and synchronous removal errors without global cleanup", async () => {
    const f = fixture();
    const remove = vi.fn(() => { throw new Error("remove failure"); });
    f.app.addListener.mockResolvedValue({ remove });
    f.network.addListener.mockResolvedValue({} as HostListenerHandle);
    const stop = f.services.subscribe(vi.fn());
    await flush();
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "network-listener", reason: "invalid-response" });
    expect(() => stop()).not.toThrow();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "listener-remove", reason: "unavailable" });
  });
});

describe("exact non-secret preferences with serialized readback", () => {
  it.each([[LANGUAGE, "ru"], [LANGUAGE, "en"], [DISPLAY, "dark"], [DISPLAY, "light"], [DISPLAY, "book"], [WELCOME, "completed"]])(
    "accepts canonical %s=%s with readback and best-effort semantics", async (key, value) => {
      const f = fixture();
      expect(f.services.preferences.persistence).toBe("best-effort");
      expect(await f.services.preferences.set(key, value)).toBe(true);
      expect(await f.services.preferences.get(key)).toBe(value);
      expect(await f.services.preferences.remove(key)).toBe(true);
      expect(await f.services.preferences.get(key)).toBeNull();
    });
  it.each([["access_token", "secret"], ["entitlements", "paid"], ["child-profile", "completed"], ["probpera-profile", "completed"],
    [WELCOME + ":entitlements", "completed"], [WELCOME + "\u0000", "completed"], [LANGUAGE, "fr"], [LANGUAGE, "EN"],
    [DISPLAY, "auto"], ["probpera-interface-language ", "ru"], ["__proto__", "ru"]])(
    "does not forward disallowed preference %s=%s", async (key, value) => {
      const f = fixture();
      expect(await f.services.preferences.set(key, value)).toBe(false);
      expect(f.preferences.set).not.toHaveBeenCalled();
      expect(f.preferences.get).not.toHaveBeenCalled();
      if (![LANGUAGE, DISPLAY].includes(key)) {
        expect(await f.services.preferences.get(key)).toBeNull();
        expect(await f.services.preferences.remove(key)).toBe(false);
        expect(f.preferences.get).not.toHaveBeenCalled();
        expect(f.preferences.remove).not.toHaveBeenCalled();
      }
    });
  it("reads only the welcome completion marker through a fresh native adapter without creating profile state", async () => {
    const f = fixture();
    expect(await f.services.preferences.get(WELCOME)).toBeNull();
    expect(await f.services.preferences.set(WELCOME, "completed")).toBe(true);
    const recreated = createHostPlatformServices({ kind: "ios", channel: "dev", languages: ["en"], preferences: f.preferences });
    expect(await recreated.preferences.get(WELCOME)).toBe("completed");
    expect([...f.memory]).toEqual([[WELCOME, "completed"]]);
    expect(recreated.preferences.persistence).toBe("best-effort");
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith({ key: WELCOME, value: "completed" });
  });
  it.each(["", "complete", "Completed", "true", " completed", "completed\u0000", '{"completed":true,"entitlements":"paid"}'])(
    "rejects invalid welcome values on both write and native read: %j", async value => {
      const f = fixture(); f.memory.set(WELCOME, "completed");
      expect(await f.services.preferences.set(WELCOME, value)).toBe(false);
      expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.get).not.toHaveBeenCalled();
      expect(f.memory.get(WELCOME)).toBe("completed");
      f.memory.set(WELCOME, value);
      expect(await f.services.preferences.get(WELCOME)).toBeNull();
      expect(f.onFailure.mock.calls).toEqual([[{ operation: "preference-get", reason: "invalid-response" }]]);
    });
  it("serializes writes, their readbacks, reads and deletion for the same key", async () => {
    const f = fixture();
    const gate = deferred<void>();
    const trace: string[] = [];
    f.preferences.set.mockImplementation(async ({ key, value }) => { trace.push(`set:${value}`); if (value === "ru") await gate.promise; f.memory.set(key, value); });
    f.preferences.get.mockImplementation(async ({ key }) => { trace.push(`get:${f.memory.get(key) ?? "null"}`); return { value: f.memory.get(key) ?? null }; });
    f.preferences.remove.mockImplementation(async ({ key }) => { trace.push("remove"); f.memory.delete(key); });
    const operations = [f.services.preferences.set(LANGUAGE, "ru"), f.services.preferences.set(LANGUAGE, "en"),
      f.services.preferences.get(LANGUAGE), f.services.preferences.remove(LANGUAGE), f.services.preferences.get(LANGUAGE)];
    await flush();
    expect(trace).toEqual(["set:ru"]);
    gate.resolve();
    expect(await Promise.all(operations)).toEqual([true, true, "en", true, null]);
    expect(trace).toEqual(["set:ru", "get:ru", "set:en", "get:en", "get:en", "remove", "get:null", "get:null"]);
  });
  it("does not block another allowed key behind a pending language write", async () => {
    const f = fixture();
    const gate = deferred<void>();
    f.preferences.set.mockImplementation(async ({ key, value }) => { if (key === LANGUAGE) await gate.promise; f.memory.set(key, value); });
    const language = f.services.preferences.set(LANGUAGE, "en");
    expect(await f.services.preferences.set(DISPLAY, "book")).toBe(true);
    expect(await f.services.preferences.get(DISPLAY)).toBe("book");
    gate.resolve();
    expect(await language).toBe(true);
  });
  it("recovers the queue after a rejected write without exposing error or preference data", async () => {
    const f = fixture();
    f.preferences.set.mockRejectedValueOnce(new Error("sensitive native diagnostic secret=example"));
    expect(await Promise.all([f.services.preferences.set(LANGUAGE, "ru"), f.services.preferences.set(LANGUAGE, "en")])).toEqual([false, true]);
    expect(await f.services.preferences.get(LANGUAGE)).toBe("en");
    expect(f.onFailure.mock.calls).toEqual([[{ operation: "preference-set", reason: "unavailable" }]]);
  });
  it("reports readback mismatch instead of inventing in-memory persistence", async () => {
    const f = fixture();
    f.preferences.set.mockResolvedValue(undefined);
    expect(await f.services.preferences.set(LANGUAGE, "ru")).toBe(false);
    f.memory.set(LANGUAGE, "en");
    f.preferences.remove.mockResolvedValue(undefined);
    expect(await f.services.preferences.remove(LANGUAGE)).toBe(false);
    expect(await f.services.preferences.get(LANGUAGE)).toBe("en");
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "preference-set", reason: "readback-mismatch" });
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "preference-remove", reason: "readback-mismatch" });
  });
  it.each([{ value: "owned" }, { value: true }, {}, null])("rejects a malformed/unallowlisted native read: %j", async (result) => {
    const f = fixture();
    f.preferences.get.mockResolvedValue(result as unknown as { value: string | null });
    expect(await f.services.preferences.get(LANGUAGE)).toBeNull();
    expect(await f.services.preferences.set(LANGUAGE, "en")).toBe(false);
    expect(await f.services.preferences.remove(LANGUAGE)).toBe(false);
  });
  it("reports missing preferences rather than using ambient browser storage", async () => {
    const f = fixture({ preferences: undefined });
    expect(await f.services.preferences.get(LANGUAGE)).toBeNull();
    expect(await f.services.preferences.set(LANGUAGE, "en")).toBe(false);
    expect(await f.services.preferences.remove(LANGUAGE)).toBe(false);
    expect(f.onFailure.mock.calls.map(([failure]) => failure.operation)).toEqual(["preference-get", "preference-set", "preference-remove"]);
  });
  it("validates and returns the same single observed value from a native response", async () => {
    const f = fixture();
    const getter = vi.fn().mockReturnValueOnce("en").mockReturnValue("unallowlisted");
    f.preferences.get.mockResolvedValue(Object.defineProperty({}, "value", { get: getter }) as { value: string });
    expect(await f.services.preferences.get(LANGUAGE)).toBe("en");
    expect(getter).toHaveBeenCalledTimes(1);
    expect(await f.services.preferences.get(LANGUAGE)).toBeNull();
  });
});

describe("awaited explicit native link handoff", () => {
  it("denies all external URLs without an explicit injected policy", async () => {
    const f = fixture();
    expect(await f.services.openExternalLink("https://probpera.ru/")).toBe("blocked");
    expect(await f.services.openExternalLink(MAIL)).toBe("blocked");
    expect(f.openBrowser).not.toHaveBeenCalled();
    expect(f.openMail).not.toHaveBeenCalled();
  });
  it("waits for actual browser completion and reports only requested", async () => {
    const f = fixture({ allowExternalLink: () => true });
    const pending = deferred<void>();
    f.openBrowser.mockReturnValue(pending.promise);
    let resolved = false;
    const result = Promise.resolve(f.services.openExternalLink("HTTPS://PROBPERA.RU/en/?country=russia#atlas")).then(value => { resolved = true; return value; });
    await flush();
    expect(resolved).toBe(false);
    expect(f.openBrowser).toHaveBeenCalledExactlyOnceWith({ url: "https://probpera.ru/en/?country=russia#atlas" });
    pending.resolve();
    expect(await result).toBe("requested");
  });
  it("uses the exact mail handoff, awaits it and never opens a second browser", async () => {
    const f = fixture({ allowExternalLink: () => true });
    const pending = deferred<{ completed: boolean }>();
    f.openMail.mockReturnValue(pending.promise);
    let resolved = false;
    const result = Promise.resolve(f.services.openExternalLink(MAIL)).then(value => { resolved = true; return value; });
    await flush();
    expect(resolved).toBe(false);
    pending.resolve({ completed: true });
    expect(await result).toBe("requested");
    expect(f.openMail).toHaveBeenCalledExactlyOnceWith({ url: MAIL });
    expect(f.openBrowser).not.toHaveBeenCalled();
  });
  it.each(["http://probpera.ru", "javascript:alert(1)", "data:text/html,hi", "/en/", "//probpera.ru", "https:probpera.ru",
    "https:///probpera.ru", "https://user:pass@probpera.ru", "https://@probpera.ru", "https://probpera.ru\\@example.test",
    " https://probpera.ru", "https://probpera.ru/line\nnext", "https://probpera.ru/%0a", "https://probpera.ru/%5c",
    "https://probpera.ru/%7f", "https://probpera.ru/%C2%85", "https://probpera.ru/%E2%80%A8", "https://probpera.ru/%zz",
    "https://probpera.ru/a b", "mailto:other@example.test", "MAILTO:probperasite@yandex.ru", "mailto:probperasite@yandex.ru?subject=x",
    "mailto:probperasite@yandex.ru?bcc=other@example.test", "mailto:probperasite@yandex.ru,other@example.test", "tel:123", "intent://mail"]) (
    "rejects unsafe or unapproved URL syntax before policy/native dispatch: %s", async (url) => {
      const policy = vi.fn(() => true);
      const f = fixture({ allowExternalLink: policy });
      expect(await f.services.openExternalLink(url)).toBe("blocked");
      expect(policy).not.toHaveBeenCalled();
      expect(f.openBrowser).not.toHaveBeenCalled();
      expect(f.openMail).not.toHaveBeenCalled();
    });
  it("evaluates the current injected denial policy for each action", async () => {
    let childDenied = true;
    const policy = vi.fn((url: string) => !childDenied && new URL(url).origin === "https://probpera.ru");
    const f = fixture({ allowExternalLink: policy });
    expect(await f.services.openExternalLink("https://probpera.ru/")).toBe("blocked");
    childDenied = false;
    expect(await f.services.openExternalLink("https://probpera.ru/")).toBe("requested");
    childDenied = true;
    expect(await f.services.openExternalLink("https://probpera.ru/")).toBe("blocked");
    expect(f.openBrowser).toHaveBeenCalledTimes(1);
  });
  it("catches policy exceptions and late policy rejections without dispatch or unhandled errors", async () => {
    const rejected = deferred<boolean>();
    const policy = vi.fn<NonNullable<HostPlatformServicesOptions["allowExternalLink"]>>()
      .mockImplementationOnce(() => { throw new Error("private policy state"); })
      .mockImplementationOnce(() => rejected.promise as unknown as boolean);
    const f = fixture({ allowExternalLink: policy, onFailure: () => { throw new Error("sink"); } });
    expect(await f.services.openExternalLink("https://probpera.ru/")).toBe("blocked");
    expect(await f.services.openExternalLink("https://probpera.ru/")).toBe("blocked");
    rejected.reject(new Error("late policy denial"));
    await flush();
    expect(f.openBrowser).not.toHaveBeenCalled();
  });
  it("does not treat an asynchronous or truthy nonboolean policy as permission", async () => {
    const f = fixture({ allowExternalLink: (() => Promise.resolve(true)) as unknown as (url: string) => boolean });
    expect(await f.services.openExternalLink("https://probpera.ru/")).toBe("blocked");
    expect(f.openBrowser).not.toHaveBeenCalled();
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "link-policy", reason: "invalid-response" });
  });
  it("observes native rejection and false/malformed OS handoff without false success or retries", async () => {
    const f = fixture({ allowExternalLink: () => true });
    f.openBrowser.mockRejectedValue(new Error("url=secret-native-diagnostic"));
    expect(await f.services.openExternalLink("https://probpera.ru/")).toBe("unavailable");
    f.openMail.mockResolvedValueOnce({ completed: false }).mockResolvedValueOnce({ completed: "true" } as unknown as { completed: boolean })
      .mockRejectedValueOnce(new Error("mail native failure"));
    expect(await f.services.openExternalLink(MAIL)).toBe("unavailable");
    expect(await f.services.openExternalLink(MAIL)).toBe("unavailable");
    expect(await f.services.openExternalLink(MAIL)).toBe("unavailable");
    expect(f.openBrowser).toHaveBeenCalledTimes(1);
    expect(f.openMail).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("secret");
  });
  it("reports unavailable native handlers instead of falling back to window navigation", async () => {
    const f = fixture({ allowExternalLink: () => true, openBrowser: undefined, openMail: undefined });
    expect(await f.services.openExternalLink("https://probpera.ru/")).toBe("unavailable");
    expect(await f.services.openExternalLink(MAIL)).toBe("unavailable");
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "browser-open", reason: "unavailable" });
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "mail-open", reason: "unavailable" });
  });
});
