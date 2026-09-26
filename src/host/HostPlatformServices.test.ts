import { BOOKY_JOURNEY_PROGRESS_KEY as JOURNEY_PROGRESS, BOOKY_JOURNEY_PROGRESS_MAX_LENGTH } from "./bookyJourneyProgress";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHostPlatformServices, type HostAppBridge, type HostAppState, type HostListenerHandle,
  type HostNetworkBridge, type HostNetworkState, type HostPlatformServicesOptions, type HostPreferenceBridge } from "./HostPlatformServices";
import { GLOBE_EDITION_IDS } from "../components/globeEditions";
import { BOOKY_MOTION_PREFERENCE_KEY as MOTION } from "./bookyMotionPreference";

describe("Booky motion native preference port", () => {
  it("allows only exact motion writes and preserves raw unknown reads", async () => {
    const f = fixture(), store = f.services.preferences;
    expect(await store.get(MOTION)).toBeNull();
    for (const value of ["system", "calm"]) {
      expect(await store.set(MOTION, value)).toBe(true); expect(await store.get(MOTION)).toBe(value);
    }
    f.preferences.set.mockClear();
    for (const value of ["", "CALM", "calm ", "future", "{}", null, true]) {
      expect(await store.set(MOTION, value as string)).toBe(false);
    }
    expect(f.preferences.set).not.toHaveBeenCalled();
    f.memory.set(MOTION, "future"); expect(await store.get(MOTION)).toBe("future");
    expect(f.memory.get(MOTION)).toBe("future"); expect(await store.set(MOTION + "-other", "calm")).toBe(false);
    expect(await store.get(MOTION + "-other")).toBeNull();
    expect(await store.remove(MOTION)).toBe(true); expect(await store.get(MOTION)).toBeNull();
  });
  it("rejects unavailable or nonstring reads and requires actual writes/readback", async () => {
    const f = fixture(), store = f.services.preferences;
    f.preferences.get.mockRejectedValueOnce(Error("private")); await expect(store.get(MOTION)).rejects.toThrow("booky-motion-preference-unavailable");
    f.preferences.get.mockResolvedValueOnce({ value: true } as unknown as { value: string }); await expect(store.get(MOTION)).rejects.toThrow("booky-motion-preference-unavailable");
    f.preferences.set.mockResolvedValueOnce(undefined); expect(await store.set(MOTION, "calm")).toBe(false);
    f.preferences.set.mockRejectedValueOnce(Error("private")); expect(await store.set(MOTION, "calm")).toBe(false);
    f.preferences.set.mockResolvedValueOnce(false as unknown as void); expect(await store.set(MOTION, "calm")).toBe(false);
    f.preferences.get.mockRejectedValueOnce(Error("private")); expect(await store.set(MOTION, "calm")).toBe(false);
    expect(await store.set(MOTION, "system")).toBe(true);
    f.preferences.remove.mockResolvedValueOnce(undefined); expect(await store.remove(MOTION)).toBe(false);
    await expect(fixture({ preferences: undefined }).services.preferences.get(MOTION)).rejects.toThrow("booky-motion-preference-unavailable");
  });
  it("orders motion writes and their confirmations before subsequent reads", async () => {
    const f = fixture(), gate = deferred<void>(), trace: string[] = [];
    f.preferences.set.mockImplementation(async ({ key, value }) => { trace.push("set:" + value); if (value === "calm") await gate.promise; f.memory.set(key, value); });
    f.preferences.get.mockImplementation(async ({ key }) => { const value = f.memory.get(key) ?? null; trace.push("get:" + value); return { value }; });
    const first = f.services.preferences.set(MOTION, "calm"), second = f.services.preferences.set(MOTION, "system"), read = f.services.preferences.get(MOTION);
    await flush(); expect(trace).toEqual(["set:calm"]); gate.resolve();
    expect(await Promise.all([first, second, read])).toEqual([true, true, "system"]);
    expect(trace).toEqual(["set:calm", "get:calm", "set:system", "get:system", "get:system"]);
  });
});

const LANGUAGE = "probpera-interface-language";
const DISPLAY = "probpera-display-mode";
const WELCOME = "probpera-planet-welcome-v1";
const GRAPHICS = "probpera-planet-graphics-quality-v1";
const DOWNLOAD_NETWORK = "probpera-planet-download-network-v1";
const EDITION = "probpera.globe-edition.v2", LEGACY_STYLE = "probpera.globe-style.v1";
const STAND = "probpera-planet-stand-v1";
const BACKGROUND = "probpera-planet-background-v1";
const COMPOSITION = "probpera-planet-composition-v1";
const BOOKY = "probpera-booky-adult-v1";
const READER_POLICY = "probpera-booky-reader-policy-v1";
const journeyProgressRecord = () => ({ schemaVersion: 1, audience: "adult", revision: 1, activeRecordId: null, records: [] });
const RECENT = "probpera-planet-recent-adult-v1";
const MAIL = "mailto:probperasite@yandex.ru";
const compositionRecord = () => ({ schemaVersion: 1, commitId: "adapter-fixture:1", selection: {
  editionId: "rand-mcnally-1887", standId: "stand.base.wood", backgroundId: "background.base.library",
} });
const bookyRecord = () => ({ schemaVersion: 2, audience: "adult", visible: true, resume: { route: "overview", routeVersion: 1, stepId: "search" }, progress: [] });
const readerPolicyRecord = () => ({ schemaVersion: 1, audience: "adult", age: 35, readingLevel: "fluent",
  confirmedAt: "2026-09-23T00:00:00.000Z", revision: 1 });
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

describe("native app language refresh on resume", () => {
  const cleanup: (() => void)[] = [];
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { for (const stop of cleanup.splice(0)) stop(); vi.useRealTimers(); });
  function observe(f: ReturnType<typeof fixture>, listener = vi.fn()) {
    const stop = f.services.subscribe(listener); cleanup.push(stop); return stop;
  }
  const resume = (f: ReturnType<typeof fixture>, index = 0) => {
    f.appEvents[index]({ isActive: false }); f.appEvents[index]({ isActive: true });
  };

  it("reads only on a genuine resume and preserves canonical language identity through transport changes", async () => {
    const getAppLanguage = vi.fn(async () => ({ value: "EN-us" }));
    const f = fixture({ languages: ["ru-RU"], getAppLanguage });
    const initial = f.services.getSystemLanguages();
    expect(f.services.getSnapshot().systemLanguages).toBe(initial);
    expect(getAppLanguage).not.toHaveBeenCalled();
    observe(f); await flush();
    f.appEvents[0]({ isActive: true }); await flush();
    expect(getAppLanguage).not.toHaveBeenCalled();
    resume(f); await flush();
    const accepted = f.services.getSystemLanguages();
    expect(accepted).toEqual(["en-US"]); expect(accepted).not.toBe(initial);
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(f.services.getSnapshot().systemLanguages).toBe(accepted);
    f.networkEvents[0]({ connected: true, connectionType: "wifi" });
    f.networkEvents[0]({ connected: true, connectionType: "unknown" });
    expect(f.services.getSnapshot().systemLanguages).toBe(accepted);
    const stable = f.services.getSnapshot();
    f.appEvents[0]({ isActive: true }); await flush();
    expect(f.services.getSnapshot()).toBe(stable); expect(getAppLanguage).toHaveBeenCalledTimes(1);
    resume(f); await flush();
    expect(getAppLanguage).toHaveBeenCalledTimes(2);
    expect(f.services.getSystemLanguages()).toBe(accepted);
    expect(f.services.getSnapshot().systemLanguages).toBe(accepted);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains the prior language after invalid responses, errors and a bounded timeout without retrying", async () => {
    const getAppLanguage = vi.fn<NonNullable<HostPlatformServicesOptions["getAppLanguage"]>>();
    const f = fixture({ languages: ["ru"], getAppLanguage, languageTimeoutMs: 25 });
    observe(f); await flush(); const initial = f.services.getSystemLanguages();
    const malformed = [null, [], {}, { value: ["en"] }, { value: "en_US" }, { value: "en,ru" },
      { value: " en" }, { value: "en\n" }, { value: "x".repeat(129) },
      Object.defineProperty({}, "value", { get() { throw new Error("private-native-value"); } })];
    for (const result of malformed) {
      getAppLanguage.mockResolvedValueOnce(result); resume(f); await flush();
      expect(f.services.getSystemLanguages()).toBe(initial); expect(vi.getTimerCount()).toBe(0);
    }
    getAppLanguage.mockImplementationOnce(() => { throw new Error("private-native-throw"); });
    resume(f); await flush();
    getAppLanguage.mockRejectedValueOnce(new Error("private-native-rejection")); resume(f); await flush();
    const held = deferred<unknown>(); getAppLanguage.mockReturnValueOnce(held.promise);
    resume(f); await flush(); const active = f.services.getSnapshot();
    await vi.advanceTimersByTimeAsync(25);
    expect(f.services.getSnapshot()).toBe(active); expect(vi.getTimerCount()).toBe(0);
    held.resolve({ value: "en" }); await flush();
    expect(f.services.getSystemLanguages()).toBe(initial);
    const reads = getAppLanguage.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000); f.appEvents[0]({ isActive: true }); await flush();
    expect(getAppLanguage).toHaveBeenCalledTimes(reads);
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "app-language", reason: "invalid-response" });
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "app-language", reason: "unavailable" });
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("private-native");
    getAppLanguage.mockResolvedValueOnce({ value: "en-GB" }); resume(f); await flush();
    expect(f.services.getSystemLanguages()).toEqual(["en-GB"]);
    for (const languageTimeoutMs of [0, 10_001, 1.5, NaN]) {
      expect(() => fixture({ getAppLanguage, languageTimeoutMs })).toThrow("Native language timeout");
    }
  });

  it("fences overlapping resumes and detached results without treating resubscription as a resume", async () => {
    const first = deferred<unknown>(), second = deferred<unknown>(), detached = deferred<unknown>();
    const getAppLanguage = vi.fn<NonNullable<HostPlatformServicesOptions["getAppLanguage"]>>()
      .mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockReturnValueOnce(detached.promise);
    const f = fixture({ languages: ["ru"], getAppLanguage }); const stop = observe(f); await flush();
    resume(f); await flush(); resume(f); await flush();
    second.resolve({ value: "en-GB" }); await flush(); const accepted = f.services.getSystemLanguages();
    first.resolve({ value: "de-DE" }); await flush();
    expect(f.services.getSystemLanguages()).toBe(accepted); expect(accepted).toEqual(["en-GB"]);
    resume(f); await flush(); expect(vi.getTimerCount()).toBe(1);
    f.appEvents[0]({ isActive: false }); expect(vi.getTimerCount()).toBe(0);
    stop(); observe(f); await flush();
    expect(getAppLanguage).toHaveBeenCalledTimes(3);
    detached.resolve({ value: "fr-FR" }); await flush();
    expect(f.services.getSystemLanguages()).toBe(accepted);
    f.appEvents[0]({ isActive: false }); f.appEvents[0]({ isActive: true }); await flush();
    expect(getAppLanguage).toHaveBeenCalledTimes(3);
    const last = deferred<unknown>(); getAppLanguage.mockReturnValueOnce(last.promise);
    resume(f, 1); await flush(); cleanup[cleanup.length - 1]();
    expect(vi.getTimerCount()).toBe(0);
    last.reject(new Error("late-after-detach")); await flush();
    expect(f.services.getSystemLanguages()).toBe(accepted);
  });

  it("reserves read ownership before reentrant notifications and revalidates result accessors", async () => {
    const getAppLanguage = vi.fn<NonNullable<HostPlatformServicesOptions["getAppLanguage"]>>();
    const f = fixture({ languages: ["ru"], getAppLanguage });
    let interrupt = false;
    observe(f, vi.fn(() => {
      if (interrupt && f.services.getSnapshot().visibility === "active") {
        interrupt = false; f.appEvents[0]({ isActive: false }); f.appEvents[0]({ isActive: true });
      }
    })); await flush();
    getAppLanguage.mockResolvedValueOnce({ value: "en" }); interrupt = true;
    resume(f); await flush();
    expect(getAppLanguage).toHaveBeenCalledTimes(1); expect(f.services.getSystemLanguages()).toEqual(["en"]);
    getAppLanguage.mockResolvedValueOnce(Object.defineProperty({}, "value", { get() {
      f.appEvents[0]({ isActive: false }); return "de";
    } })); resume(f); await flush();
    expect(f.services.getSnapshot().visibility).toBe("background");
    expect(f.services.getSystemLanguages()).toEqual(["en"]); expect(vi.getTimerCount()).toBe(0);
    getAppLanguage.mockResolvedValueOnce({ value: "fr" });
    f.appEvents[0]({ isActive: true });
    f.appEvents[0]({ isActive: false }); await flush();
    expect(getAppLanguage).toHaveBeenCalledTimes(2);
    expect(f.services.getSystemLanguages()).toEqual(["en"]); expect(vi.getTimerCount()).toBe(0);
  });
});

describe("native subscription lifetimes and ordering", () => {
  it("publishes explicit transport changes without interpreting connectivity as Wi-Fi", async () => {
    const f = fixture();
    const listener = vi.fn();
    const stop = f.services.subscribe(listener);
    await flush();
    expect(f.services.getSnapshot().networkType).toBeUndefined();
    listener.mockClear();
    for (const connectionType of ["wifi", "cellular", "ethernet"]) {
      f.networkEvents[0]({ connected: true, connectionType });
      expect(f.services.getSnapshot()).toEqual({ connectivity: "online", visibility: "active", networkType: connectionType });
    }
    expect(listener).toHaveBeenCalledTimes(3);
    const stable = f.services.getSnapshot();
    f.networkEvents[0]({ connected: true, connectionType: "ethernet" });
    expect(f.services.getSnapshot()).toBe(stable);
    for (const connectionType of [undefined, "4g", "unknown", "none", "mixed"]) {
      f.networkEvents[0]({ connected: true, connectionType });
      expect(f.services.getSnapshot().networkType).toBeUndefined();
    }
    f.networkEvents[0]({ connected: false, connectionType: "wifi" });
    expect(f.services.getSnapshot()).toEqual({ connectivity: "offline", visibility: "active" });
    stop();
  });
  it("fences background reads and keeps the resumed transport unknown until a fresh observation", async () => {
    const f = fixture();
    const initial = deferred<HostNetworkState>();
    const resumed = deferred<HostNetworkState>();
    f.network.getStatus.mockReturnValueOnce(initial.promise).mockReturnValueOnce(resumed.promise);
    const stop = f.services.subscribe(vi.fn());
    await flush();
    f.networkEvents[0]({ connected: true, connectionType: "wifi" });
    f.appEvents[0]({ isActive: false });
    expect(f.services.getSnapshot().networkType).toBeUndefined();
    f.networkEvents[0]({ connected: true, connectionType: "wifi" });
    initial.resolve({ connected: true, connectionType: "wifi" });
    await flush();
    expect(f.services.getSnapshot().networkType).toBeUndefined();
    f.appEvents[0]({ isActive: true });
    expect(f.services.getSnapshot().networkType).toBeUndefined();
    f.networkEvents[0]({ connected: true, connectionType: "cellular" });
    resumed.resolve({ connected: true, connectionType: "wifi" });
    await flush();
    expect(f.services.getSnapshot().networkType).toBe("cellular");
    stop();
  });
  it("does not reuse known Wi-Fi after malformed native data or a failed resubscription read", async () => {
    const f = fixture();
    const stop = f.services.subscribe(vi.fn());
    await flush();
    f.networkEvents[0]({ connected: true, connectionType: "wifi" });
    f.networkEvents[0](Object.defineProperty({ connected: true }, "connectionType", { get() { throw new Error("denied"); } }));
    expect(f.services.getSnapshot().networkType).toBeUndefined();
    f.networkEvents[0]({ connected: true, connectionType: "wifi" });
    stop();
    f.network.getStatus.mockRejectedValue(new Error("unavailable"));
    const stopNext = f.services.subscribe(vi.fn());
    expect(f.services.getSnapshot().networkType).toBeUndefined();
    await flush();
    expect(f.services.getSnapshot().networkType).toBeUndefined();
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "network-status", reason: "unavailable" });
    stopNext();
  });
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
  it("restores and clears explicit journey progress through fresh native adapters without network IO", async () => {
    const f = fixture(), store = f.services.preferences, raw = JSON.stringify(journeyProgressRecord(), null, 2);
    const fresh = createHostPlatformServices({ kind: "ios", channel: "dev", languages: [], preferences: f.preferences }).preferences;
    expect(f.preferences.get).not.toHaveBeenCalled();
    expect(await store.get(JOURNEY_PROGRESS)).toBeNull();
    expect(await store.set(JOURNEY_PROGRESS, raw)).toBe(true);
    expect(await fresh.get(JOURNEY_PROGRESS)).toBe(raw);
    const boundary = raw + " ".repeat(BOOKY_JOURNEY_PROGRESS_MAX_LENGTH - new TextEncoder().encode(raw).length);
    expect(await store.set(JOURNEY_PROGRESS, boundary)).toBe(true); expect(await fresh.get(JOURNEY_PROGRESS)).toBe(boundary);
    const next = JSON.stringify({ ...journeyProgressRecord(), revision: 2 });
    f.memory.set(JOURNEY_PROGRESS, next);
    expect(await store.get(JOURNEY_PROGRESS)).toBe(next);
    expect(await fresh.remove(JOURNEY_PROGRESS)).toBe(true);
    expect(await store.get(JOURNEY_PROGRESS)).toBeNull();
    expect(f.memory.size).toBe(0);
    expect(f.network.getStatus).not.toHaveBeenCalled(); expect(f.network.addListener).not.toHaveBeenCalled();
    expect(f.openBrowser).not.toHaveBeenCalled(); expect(f.openMail).not.toHaveBeenCalled();
  });

  it("preserves raw journey-progress errors for classification while restricting writes and the exact key", async () => {
    const f = fixture(), store = f.services.preferences, raw = JSON.stringify(journeyProgressRecord());
    for (const key of [JOURNEY_PROGRESS + ":en", JOURNEY_PROGRESS + "\u0000", "probpera-booky-journey-progress-v2", "probpera-booky-journey-progress-child-v1"]) {
      expect(await store.get(key)).toBeNull(); expect(await store.set(key, raw)).toBe(false); expect(await store.remove(key)).toBe(false);
    }
    expect(f.preferences.get).not.toHaveBeenCalled(); expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
    for (const invalid of ["", "{}", "null", "bad JSON", " ".repeat(BOOKY_JOURNEY_PROGRESS_MAX_LENGTH + 1), JSON.stringify({ schemaVersion: 2, future: "private future policy" }),
      JSON.stringify({ ...journeyProgressRecord(), audience: "child" }), JSON.stringify({ ...journeyProgressRecord(), activeRecordId: "missing-record" }),
      JSON.stringify({ ...journeyProgressRecord(), approved: true })]) {
      expect(await store.set(JOURNEY_PROGRESS, invalid)).toBe(false);
      f.memory.set(JOURNEY_PROGRESS, invalid);
      expect(await store.get(JOURNEY_PROGRESS)).toBe(invalid);
      expect(f.memory.get(JOURNEY_PROGRESS)).toBe(invalid);
    }
    expect(await store.set(JOURNEY_PROGRESS, journeyProgressRecord() as never)).toBe(false);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("private future policy");
  });

  it("rejects failed or malformed journey-progress reads after success without leaking a previous value", async () => {
    const f = fixture(), store = f.services.preferences, raw = JSON.stringify(journeyProgressRecord());
    expect(await store.set(JOURNEY_PROGRESS, raw)).toBe(true);
    expect(await store.get(JOURNEY_PROGRESS)).toBe(raw);
    f.preferences.get.mockRejectedValueOnce(new Error("private reader payload"));
    await expect(store.get(JOURNEY_PROGRESS)).rejects.toThrow("booky-journey-progress-unavailable");
    for (const response of [undefined, {}, { value: undefined }, { value: false }, { value: journeyProgressRecord() }]) {
      f.preferences.get.mockResolvedValueOnce(response as never);
      await expect(store.get(JOURNEY_PROGRESS)).rejects.toThrow("booky-journey-progress-unavailable");
    }
    const absent = fixture({ preferences: undefined }).services.preferences;
    await expect(absent.get(JOURNEY_PROGRESS)).rejects.toThrow("booky-journey-progress-unavailable");
    expect(await absent.set(JOURNEY_PROGRESS, raw)).toBe(false); expect(await absent.remove(JOURNEY_PROGRESS)).toBe(false);
    f.memory.delete(JOURNEY_PROGRESS);
    expect(await store.get(JOURNEY_PROGRESS)).toBeNull();
    f.memory.set(JOURNEY_PROGRESS, raw);
    expect(await store.get(JOURNEY_PROGRESS)).toBe(raw);
    expect(f.onFailure.mock.calls.every(([value]) => Object.keys(value).sort().join() === "operation,reason")).toBe(true);
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("private reader payload");
  });

  it("never confirms rejected, false or unverified native journey-progress writes", async () => {
    const f = fixture(), store = f.services.preferences, raw = JSON.stringify(journeyProgressRecord());
    f.preferences.set.mockRejectedValueOnce(new Error("private quota failure"));
    expect(await store.set(JOURNEY_PROGRESS, raw)).toBe(false); expect(await store.get(JOURNEY_PROGRESS)).toBeNull();
    f.preferences.set.mockResolvedValueOnce(undefined);
    expect(await store.set(JOURNEY_PROGRESS, raw)).toBe(false); expect(await store.get(JOURNEY_PROGRESS)).toBeNull();
    expect(await store.set(JOURNEY_PROGRESS, raw)).toBe(true);
    f.preferences.set.mockRejectedValueOnce(new Error("private quota failure"));
    expect(await store.set(JOURNEY_PROGRESS, JSON.stringify({ ...journeyProgressRecord(), revision: 2 }))).toBe(false);
    expect(await store.get(JOURNEY_PROGRESS)).toBe(raw);
    f.preferences.set.mockResolvedValueOnce(false as never);
    expect(await store.set(JOURNEY_PROGRESS, raw)).toBe(false);
    f.preferences.get.mockResolvedValueOnce({ value: "{}" });
    expect(await store.set(JOURNEY_PROGRESS, raw)).toBe(false);
    f.preferences.get.mockRejectedValueOnce(new Error("private readback failure"));
    const next = JSON.stringify({ ...journeyProgressRecord(), revision: 2 });
    expect(await store.set(JOURNEY_PROGRESS, next)).toBe(false);
    expect(await store.get(JOURNEY_PROGRESS)).toBe(next);
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "preference-set", reason: "readback-mismatch" });
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("private");
  });

  it("keeps failed journey-progress removal unavailable and confirms only fresh native absence", async () => {
    const f = fixture(), store = f.services.preferences, raw = JSON.stringify(journeyProgressRecord());
    expect(await store.set(JOURNEY_PROGRESS, raw)).toBe(true);
    f.preferences.remove.mockRejectedValueOnce(new Error("private removal failure"));
    expect(await store.remove(JOURNEY_PROGRESS)).toBe(false); expect(await store.get(JOURNEY_PROGRESS)).toBe(raw);
    f.preferences.remove.mockResolvedValueOnce(undefined);
    expect(await store.remove(JOURNEY_PROGRESS)).toBe(false); expect(await store.get(JOURNEY_PROGRESS)).toBe(raw);
    f.preferences.get.mockRejectedValueOnce(new Error("private clear readback failure"));
    expect(await store.remove(JOURNEY_PROGRESS)).toBe(false);
    expect(await store.get(JOURNEY_PROGRESS)).toBeNull();
    f.preferences.remove.mockResolvedValueOnce(false as never);
    expect(await store.remove(JOURNEY_PROGRESS)).toBe(false);
    expect(await store.remove(JOURNEY_PROGRESS)).toBe(true);
    expect(await store.get(JOURNEY_PROGRESS)).toBeNull();
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "preference-remove", reason: "readback-mismatch" });
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("private");
  });

  it("serializes journey-progress changes and clear so a late read cannot resurrect removed policy", async () => {
    const f = fixture(), store = f.services.preferences, gate = deferred<void>();
    const raw = JSON.stringify(journeyProgressRecord());
    f.preferences.set.mockImplementationOnce(async ({ key, value }) => { await gate.promise; f.memory.set(key, value); });
    const pending = [store.set(JOURNEY_PROGRESS, raw), store.remove(JOURNEY_PROGRESS), store.get(JOURNEY_PROGRESS)];
    await flush(); expect(f.preferences.set).toHaveBeenCalledTimes(1); expect(f.preferences.remove).not.toHaveBeenCalled();
    expect(await store.set(DISPLAY, "book")).toBe(true);
    gate.resolve(); expect(await Promise.all(pending)).toEqual([true, true, null]);
    expect(f.memory.has(JOURNEY_PROGRESS)).toBe(false);
    expect(await store.get(JOURNEY_PROGRESS)).toBeNull();
  });

  it("restores and clears explicit reader policy through fresh native adapters without network IO", async () => {
    const f = fixture(), store = f.services.preferences, raw = JSON.stringify(readerPolicyRecord(), null, 2);
    const fresh = createHostPlatformServices({ kind: "ios", channel: "dev", languages: [], preferences: f.preferences }).preferences;
    expect(f.preferences.get).not.toHaveBeenCalled();
    expect(await store.get(READER_POLICY)).toBeNull();
    expect(await store.set(READER_POLICY, raw)).toBe(true);
    expect(await fresh.get(READER_POLICY)).toBe(raw);
    const next = JSON.stringify({ ...readerPolicyRecord(), age: 49, readingLevel: "plain", revision: 2 });
    f.memory.set(READER_POLICY, next);
    expect(await store.get(READER_POLICY)).toBe(next);
    expect(await fresh.remove(READER_POLICY)).toBe(true);
    expect(await store.get(READER_POLICY)).toBeNull();
    expect(f.memory.size).toBe(0);
    expect(f.network.getStatus).not.toHaveBeenCalled(); expect(f.network.addListener).not.toHaveBeenCalled();
    expect(f.openBrowser).not.toHaveBeenCalled(); expect(f.openMail).not.toHaveBeenCalled();
  });

  it("preserves raw reader-policy errors for classification while restricting writes and the exact key", async () => {
    const f = fixture(), store = f.services.preferences, raw = JSON.stringify(readerPolicyRecord());
    for (const key of [READER_POLICY + ":en", READER_POLICY + "\u0000", "probpera-booky-reader-policy-v2", "probpera-booky-reader-policy-child-v1"]) {
      expect(await store.get(key)).toBeNull(); expect(await store.set(key, raw)).toBe(false); expect(await store.remove(key)).toBe(false);
    }
    expect(f.preferences.get).not.toHaveBeenCalled(); expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
    for (const invalid of ["", "{}", "null", "bad JSON", " ".repeat(1025), JSON.stringify({ schemaVersion: 2, future: "private future policy" }),
      JSON.stringify({ ...readerPolicyRecord(), age: 17 }), JSON.stringify({ ...readerPolicyRecord(), readingLevel: "independent" }),
      JSON.stringify({ ...readerPolicyRecord(), approved: true })]) {
      expect(await store.set(READER_POLICY, invalid)).toBe(false);
      f.memory.set(READER_POLICY, invalid);
      expect(await store.get(READER_POLICY)).toBe(invalid);
      expect(f.memory.get(READER_POLICY)).toBe(invalid);
    }
    expect(await store.set(READER_POLICY, readerPolicyRecord() as never)).toBe(false);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("private future policy");
  });

  it("rejects failed or malformed reader-policy reads after success without leaking a previous value", async () => {
    const f = fixture(), store = f.services.preferences, raw = JSON.stringify(readerPolicyRecord());
    expect(await store.set(READER_POLICY, raw)).toBe(true);
    expect(await store.get(READER_POLICY)).toBe(raw);
    f.preferences.get.mockRejectedValueOnce(new Error("private reader payload"));
    await expect(store.get(READER_POLICY)).rejects.toThrow("booky-reader-policy-unavailable");
    for (const response of [undefined, {}, { value: undefined }, { value: false }, { value: readerPolicyRecord() }]) {
      f.preferences.get.mockResolvedValueOnce(response as never);
      await expect(store.get(READER_POLICY)).rejects.toThrow("booky-reader-policy-unavailable");
    }
    const absent = fixture({ preferences: undefined }).services.preferences;
    await expect(absent.get(READER_POLICY)).rejects.toThrow("booky-reader-policy-unavailable");
    expect(await absent.set(READER_POLICY, raw)).toBe(false); expect(await absent.remove(READER_POLICY)).toBe(false);
    f.memory.delete(READER_POLICY);
    expect(await store.get(READER_POLICY)).toBeNull();
    f.memory.set(READER_POLICY, raw);
    expect(await store.get(READER_POLICY)).toBe(raw);
    expect(f.onFailure.mock.calls.every(([value]) => Object.keys(value).sort().join() === "operation,reason")).toBe(true);
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("private reader payload");
  });

  it("never confirms rejected, false or unverified native reader-policy writes", async () => {
    const f = fixture(), store = f.services.preferences, raw = JSON.stringify(readerPolicyRecord());
    f.preferences.set.mockRejectedValueOnce(new Error("private write failure"));
    expect(await store.set(READER_POLICY, raw)).toBe(false); expect(await store.get(READER_POLICY)).toBeNull();
    f.preferences.set.mockResolvedValueOnce(undefined);
    expect(await store.set(READER_POLICY, raw)).toBe(false); expect(await store.get(READER_POLICY)).toBeNull();
    expect(await store.set(READER_POLICY, raw)).toBe(true);
    f.preferences.set.mockResolvedValueOnce(false as never);
    expect(await store.set(READER_POLICY, raw)).toBe(false);
    f.preferences.get.mockResolvedValueOnce({ value: "{}" });
    expect(await store.set(READER_POLICY, raw)).toBe(false);
    f.preferences.get.mockRejectedValueOnce(new Error("private readback failure"));
    const next = JSON.stringify({ ...readerPolicyRecord(), age: 49, revision: 2 });
    expect(await store.set(READER_POLICY, next)).toBe(false);
    expect(await store.get(READER_POLICY)).toBe(next);
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "preference-set", reason: "readback-mismatch" });
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("private");
  });

  it("keeps failed reader-policy removal unavailable and confirms only fresh native absence", async () => {
    const f = fixture(), store = f.services.preferences, raw = JSON.stringify(readerPolicyRecord());
    expect(await store.set(READER_POLICY, raw)).toBe(true);
    f.preferences.remove.mockRejectedValueOnce(new Error("private removal failure"));
    expect(await store.remove(READER_POLICY)).toBe(false); expect(await store.get(READER_POLICY)).toBe(raw);
    f.preferences.remove.mockResolvedValueOnce(undefined);
    expect(await store.remove(READER_POLICY)).toBe(false); expect(await store.get(READER_POLICY)).toBe(raw);
    f.preferences.get.mockRejectedValueOnce(new Error("private clear readback failure"));
    expect(await store.remove(READER_POLICY)).toBe(false);
    expect(await store.get(READER_POLICY)).toBeNull();
    f.preferences.remove.mockResolvedValueOnce(false as never);
    expect(await store.remove(READER_POLICY)).toBe(false);
    expect(await store.remove(READER_POLICY)).toBe(true);
    expect(await store.get(READER_POLICY)).toBeNull();
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "preference-remove", reason: "readback-mismatch" });
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("private");
  });

  it("serializes reader-policy changes and clear so a late read cannot resurrect removed policy", async () => {
    const f = fixture(), store = f.services.preferences, gate = deferred<void>();
    const raw = JSON.stringify(readerPolicyRecord());
    f.preferences.set.mockImplementationOnce(async ({ key, value }) => { await gate.promise; f.memory.set(key, value); });
    const pending = [store.set(READER_POLICY, raw), store.remove(READER_POLICY), store.get(READER_POLICY)];
    await flush(); expect(f.preferences.set).toHaveBeenCalledTimes(1); expect(f.preferences.remove).not.toHaveBeenCalled();
    expect(await store.set(DISPLAY, "book")).toBe(true);
    gate.resolve(); expect(await Promise.all(pending)).toEqual([true, true, null]);
    expect(f.memory.has(READER_POLICY)).toBe(false);
    expect(await store.get(READER_POLICY)).toBeNull();
  });

  it("preserves raw v1 reads and distinguishes future Booky formats without leaking their contents", async () => {
    const f = fixture(), store = f.services.preferences;
    const legacy = JSON.stringify({ schemaVersion: 1, audience: "adult", visible: true,
      resume: { route: "overview", stepId: "search" } }, null, 2);
    f.memory.set(BOOKY, legacy);
    expect(await store.get(BOOKY)).toBe(legacy);
    expect(await store.set(BOOKY, legacy)).toBe(false);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.memory.get(BOOKY)).toBe(legacy);
    for (const record of [{ schemaVersion: 99, futureField: "private future content" },
      { ...bookyRecord(), resume: { route: "overview", routeVersion: 99, stepId: "search" } },
      { ...bookyRecord(), resume: { route: "future-tour", routeVersion: 1, stepId: "search" } }]) {
      const raw = JSON.stringify(record); f.memory.set(BOOKY, raw);
      await expect(store.get(BOOKY)).rejects.toMatchObject({
        name: "BookyPreferenceUnsupportedError", message: "booky-preference-unsupported",
      });
      expect(await store.set(BOOKY, raw)).toBe(false);
      expect(f.memory.get(BOOKY)).toBe(raw);
    }
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("private future content");
  });

  it("round-trips only exact adult Booky records without granting native profile or arbitrary JSON authority", async () => {
    const f = fixture(), store = f.services.preferences;
    const fresh = createHostPlatformServices({ kind: "ios", channel: "dev", languages: [], preferences: f.preferences }).preferences;
    expect(f.preferences.get).not.toHaveBeenCalled();
    expect(await store.get(BOOKY)).toBeNull();
    for (const record of [bookyRecord(), { ...bookyRecord(), resume: { route: "country-to-book", routeVersion: 1, stepId: "choose-writer" } },
      { schemaVersion: 2, audience: "adult", visible: false, resume: null, progress: [] }]) {
      const value = JSON.stringify(record, null, 2);
      expect(await store.set(BOOKY, value)).toBe(true);
      expect(await fresh.get(BOOKY)).toBe(value);
      expect(f.memory.get(BOOKY)).toBe(value);
    }
    f.preferences.get.mockClear(); f.preferences.set.mockClear(); f.preferences.remove.mockClear();
    for (const key of [BOOKY + ":en", BOOKY + "\u0000", "probpera-booky-child-v1"]) {
      expect(await fresh.get(key)).toBeNull(); expect(await fresh.set(key, JSON.stringify(bookyRecord()))).toBe(false);
      expect(await fresh.remove(key)).toBe(false);
    }
    expect(f.preferences.get).not.toHaveBeenCalled(); expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.preferences.remove).not.toHaveBeenCalled();
    for (const invalid of ["{}", JSON.stringify({ ...bookyRecord(), audience: "child" }),
      JSON.stringify({ ...bookyRecord(), visible: "hidden" }), JSON.stringify({ ...bookyRecord(), countryId: "russia" }),
      JSON.stringify({ ...bookyRecord(), resume: { route: "overview", stepId: "choose-writer" } })]) {
      expect(await fresh.set(BOOKY, invalid)).toBe(false);
      f.memory.set(BOOKY, invalid); await expect(fresh.get(BOOKY)).rejects.toThrow("booky-preference-unavailable");
    }
    expect(await fresh.set(BOOKY, bookyRecord() as never)).toBe(false);
    expect(f.preferences.set).not.toHaveBeenCalled();
    f.preferences.get.mockResolvedValueOnce({ value: bookyRecord() } as never);
    await expect(fresh.get(BOOKY)).rejects.toThrow("booky-preference-unavailable");
    expect(await fresh.remove(BOOKY)).toBe(true); expect(await fresh.get(BOOKY)).toBeNull();
  });

  it("serializes Booky readback and reports native failure without erasing or exposing an adult choice", async () => {
    const f = fixture(), store = f.services.preferences, gate = deferred<void>();
    const first = JSON.stringify(bookyRecord()), latest = JSON.stringify({ schemaVersion: 2, audience: "adult", visible: false, resume: null, progress: [] });
    f.preferences.set.mockImplementation(async ({ key, value }) => { if (value === first) await gate.promise; f.memory.set(key, value); });
    const writes = [store.set(BOOKY, first), store.set(BOOKY, latest), store.get(BOOKY)];
    await flush(); expect(f.preferences.set).toHaveBeenCalledTimes(1);
    expect(await store.set(DISPLAY, "book")).toBe(true);
    gate.resolve(); expect(await Promise.all(writes)).toEqual([true, true, latest]);
    f.preferences.get.mockRejectedValueOnce(new Error("private bridge payload"));
    await expect(store.get(BOOKY)).rejects.toThrow("booky-preference-unavailable");
    f.preferences.get.mockResolvedValueOnce({} as never);
    await expect(store.get(BOOKY)).rejects.toThrow("booky-preference-unavailable");
    await expect(fixture({ preferences: undefined }).services.preferences.get(BOOKY)).rejects.toThrow("booky-preference-unavailable");
    f.preferences.get.mockResolvedValueOnce({ value: null });
    expect(await store.set(BOOKY, first)).toBe(false);
    expect(await store.get(BOOKY)).toBe(first);
    f.preferences.get.mockRejectedValueOnce(new Error("private readback payload"));
    expect(await store.set(BOOKY, latest)).toBe(false);
    expect(await store.get(BOOKY)).toBe(latest);
    f.preferences.remove.mockResolvedValue(undefined);
    expect(await store.remove(BOOKY)).toBe(false); expect(await store.get(BOOKY)).toBe(latest);
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "preference-set", reason: "readback-mismatch" });
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "preference-remove", reason: "readback-mismatch" });
    expect(f.onFailure.mock.calls.every(([value]) => Object.keys(value).sort().join() === "operation,reason")).toBe(true);
    expect(JSON.stringify(f.onFailure.mock.calls)).not.toContain("private");
  });

  it("confines the new background preference to its exact adult IDs and key", async () => {
    const f = fixture();
    const fresh = createHostPlatformServices({ kind: "ios", channel: "dev", languages: [], preferences: f.preferences });
    for (const value of ["background.base.site-starfield", "background.base.library", "background.base.writer-study"]) {
      expect(await f.services.preferences.set(BACKGROUND, value)).toBe(true);
      expect(await fresh.preferences.get(BACKGROUND)).toBe(value);
    }
    expect([...f.memory.keys()]).toEqual([BACKGROUND]);
    expect(await fresh.preferences.remove(BACKGROUND)).toBe(true);
    f.preferences.set.mockClear(); f.preferences.remove.mockClear();
    for (const value of ["canonical", "stand.base.wood", "background.base.child-room", "library", "background.base.library "]) {
      expect(await fresh.preferences.set(BACKGROUND, value)).toBe(false);
      f.memory.set(BACKGROUND, value); await expect(fresh.preferences.get(BACKGROUND)).rejects.toThrow("customization-preference-unavailable");
    }
    const reads = f.preferences.get.mock.calls.length;
    for (const key of [BACKGROUND + ":en", BACKGROUND + "\u0000"]) {
      expect(await fresh.preferences.get(key)).toBeNull(); expect(await fresh.preferences.set(key, "background.base.library")).toBe(false);
      expect(await fresh.preferences.remove(key)).toBe(false);
    }
    expect(f.preferences.get).toHaveBeenCalledTimes(reads);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
  });

  it("round-trips only exact adult stand choices through the stand preference key", async () => {
    const f = fixture();
    const recreated = createHostPlatformServices({ kind: "ios", channel: "dev", languages: ["en"], preferences: f.preferences });
    for (const value of ["canonical", "stand.base.three-whales", "stand.base.portrait-pushkin", "stand.base.portrait-hemingway", "stand.base.portrait-tolstoy", "stand.base.museum", "stand.base.wood", "stand.base.book-stack", "stand.base.child-book-cloud"]) {
      expect(await f.services.preferences.set(STAND, value)).toBe(true);
      expect(await recreated.preferences.get(STAND)).toBe(value);
    }
    expect([...f.memory.keys()]).toEqual([STAND]);
    expect(await recreated.preferences.remove(STAND)).toBe(true);
    expect(await recreated.preferences.get(STAND)).toBeNull();
    f.preferences.set.mockClear(); f.preferences.remove.mockClear();
    for (const value of ["wood", "base.stand.wood", "stand.base.child-book-cloud ", "stand.base.wood ", "constructor"]) {
      expect(await recreated.preferences.set(STAND, value)).toBe(false);
      f.memory.set(STAND, value); await expect(recreated.preferences.get(STAND)).rejects.toThrow("customization-preference-unavailable");
    }
    const reads = f.preferences.get.mock.calls.length;
    for (const key of [STAND + ":en", STAND + "\u0000", "probpera-planet-stand-v2"]) {
      expect(await recreated.preferences.get(key)).toBeNull();
      expect(await recreated.preferences.set(key, "canonical")).toBe(false);
      expect(await recreated.preferences.remove(key)).toBe(false);
    }
    expect(f.preferences.get).toHaveBeenCalledTimes(reads);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
  });

  it("round-trips one exact composition record without granting arbitrary native JSON storage", async () => {
    const f = fixture();
    const recreated = createHostPlatformServices({ kind: "ios", channel: "dev", languages: ["en"], preferences: f.preferences });
    const value = JSON.stringify(compositionRecord(), null, 2);
    expect(await f.services.preferences.get(COMPOSITION)).toBeNull();
    expect(await f.services.preferences.set(COMPOSITION, value)).toBe(true);
    expect(await recreated.preferences.get(COMPOSITION)).toBe(value);
    expect(f.preferences.set.mock.calls).toEqual([[{ key: COMPOSITION, value }]]);
    for (const key of [COMPOSITION + ":en", COMPOSITION + "\u0000", "probpera-planet-composition-v2"]) {
      expect(await recreated.preferences.get(key)).toBeNull();
      expect(await recreated.preferences.set(key, value)).toBe(false);
      expect(await recreated.preferences.remove(key)).toBe(false);
    }
    const cloud = JSON.stringify({ ...compositionRecord(), selection: { ...compositionRecord().selection, standId: "stand.base.child-book-cloud" } });
    expect(await recreated.preferences.set(COMPOSITION, cloud)).toBe(true);
    expect(await recreated.preferences.get(COMPOSITION)).toBe(cloud);
    const before = f.preferences.set.mock.calls.length;
    for (const invalid of ["{}", "null", JSON.stringify({ ...compositionRecord(), approval: true }),
      JSON.stringify({ ...compositionRecord(), selection: { ...compositionRecord().selection, standId: "stand.base.child-book-cloud-unknown" } })]) {
      expect(await recreated.preferences.set(COMPOSITION, invalid)).toBe(false);
      f.memory.set(COMPOSITION, invalid);
      await expect(recreated.preferences.get(COMPOSITION)).rejects.toThrow("composition-preference-unavailable");
    }
    expect(f.preferences.set).toHaveBeenCalledTimes(before);
    expect(await recreated.preferences.remove(COMPOSITION)).toBe(true);
    expect(await recreated.preferences.get(COMPOSITION)).toBeNull();
  });

  it("never converts an unavailable composition bridge or failed readback into absence or confirmed saving", async () => {
    const f = fixture(), value = JSON.stringify(compositionRecord());
    f.preferences.get.mockRejectedValueOnce(new Error("Native read unavailable"));
    await expect(f.services.preferences.get(COMPOSITION)).rejects.toThrow("composition-preference-unavailable");
    f.preferences.get.mockResolvedValueOnce({} as never);
    await expect(f.services.preferences.get(COMPOSITION)).rejects.toThrow("composition-preference-unavailable");
    await expect(fixture({ preferences: undefined }).services.preferences.get(COMPOSITION)).rejects.toThrow("composition-preference-unavailable");
    f.preferences.get.mockResolvedValueOnce({ value: null });
    expect(await f.services.preferences.set(COMPOSITION, value)).toBe(false);
    expect(f.onFailure).toHaveBeenCalledWith({ operation: "preference-set", reason: "readback-mismatch" });
    expect(await f.services.preferences.get(COMPOSITION)).toBe(value);
    f.preferences.get.mockRejectedValueOnce(new Error("Legacy background read unavailable"));
    await expect(f.services.preferences.get(BACKGROUND)).rejects.toThrow("customization-preference-unavailable");
  });

  it("round-trips canonical globe IDs and exact legacy styles through a recreated host adapter", async () => {
    const f = fixture();
    const recreated = createHostPlatformServices({ kind: "ios", channel: "dev", languages: ["en"], preferences: f.preferences });
    for (const value of GLOBE_EDITION_IDS) {
      expect(await f.services.preferences.set(EDITION, value)).toBe(true);
      expect(await recreated.preferences.get(EDITION)).toBe(value);
      expect(await recreated.preferences.set(LEGACY_STYLE, value)).toBe(false);
    }
    for (const value of ["antique", "modern", "earth"]) {
      for (const key of [EDITION, LEGACY_STYLE]) {
        expect(await f.services.preferences.set(key, value)).toBe(true);
        expect(await recreated.preferences.get(key)).toBe(value);
      }
    }
    expect([...f.memory.keys()].sort()).toEqual([EDITION, LEGACY_STYLE].sort());
  });

  it("rejects corrupt edition reads and prevents edition lookalikes from widening native storage authority", async () => {
    const f = fixture();
    for (const key of [EDITION, LEGACY_STYLE]) {
      for (const value of ["", "earth ", "NASA-BLUE-MARBLE", "constructor", "skin.base.earth"]) {
        expect(await f.services.preferences.set(key, value)).toBe(false);
        f.memory.set(key, value); await expect(f.services.preferences.get(key)).rejects.toThrow("edition-preference-unavailable");
      }
    }
    expect(f.preferences.set).not.toHaveBeenCalled();
    const reads = f.preferences.get.mock.calls.length;
    for (const key of [EDITION + ":en", LEGACY_STYLE + "\u0000", "probpera.globe-edition.v3", "entitlements"]) {
      expect(await f.services.preferences.set(key, "earth")).toBe(false);
      expect(await f.services.preferences.get(key)).toBeNull(); expect(await f.services.preferences.remove(key)).toBe(false);
    }
    expect(f.preferences.get).toHaveBeenCalledTimes(reads); expect(f.preferences.remove).not.toHaveBeenCalled();
    f.preferences.get.mockRejectedValueOnce(new Error("Bridge unavailable"));
    await expect(f.services.preferences.get(EDITION)).rejects.toThrow("edition-preference-unavailable");
    f.preferences.get.mockRejectedValueOnce(new Error("Bridge unavailable"));
    expect(await f.services.preferences.get(LANGUAGE)).toBeNull();
  });
  it.each(["any-network", "wifi-only"])("restores only the allowlisted download policy %s", async value => {
    const f = fixture();
    expect(await f.services.preferences.set(DOWNLOAD_NETWORK, value)).toBe(true);
    const recreated = createHostPlatformServices({ kind: "ios", channel: "dev", languages: [], preferences: f.preferences });
    expect(await recreated.preferences.get(DOWNLOAD_NETWORK)).toBe(value);
    expect(await recreated.preferences.set(DOWNLOAD_NETWORK, "4g")).toBe(false);
    expect(await recreated.preferences.remove(DOWNLOAD_NETWORK)).toBe(true);
    f.memory.set(DOWNLOAD_NETWORK, "cellular");
    expect(await recreated.preferences.get(DOWNLOAD_NETWORK)).toBeNull();
  });
  it.each(["android", "ios"] as const)("exposes lazy adult history through the %s bridge without widening generic preferences", async kind => {
    const f = fixture();
    const services = createHostPlatformServices({ kind, channel: "dev", languages: ["ru"], preferences: f.preferences });
    expect(f.preferences.get).not.toHaveBeenCalled();
    expect(f.preferences.set).not.toHaveBeenCalled();
    expect(await services.preferences.set(RECENT, '{"v":1,"entries":[]}')).toBe(false);
    expect(await services.preferences.get(RECENT)).toBeNull();
    expect(await services.preferences.remove(RECENT)).toBe(false);
    expect(f.preferences.get).not.toHaveBeenCalled();
    const history = services.recentHistory!;
    expect(history).toBeDefined();
    const target = { kind: "writer", countryId: "russia", writerId: "dostoevsky" } as const;
    await history.record(target);
    expect(history.getSnapshot().entries).toEqual([expect.objectContaining(target)]);
    expect([...f.memory.keys()]).toEqual([RECENT]);
    const fresh = createHostPlatformServices({ kind, channel: "dev", languages: ["en"], preferences: f.preferences });
    await fresh.recentHistory!.retry!();
    expect(fresh.recentHistory!.getSnapshot().entries).toEqual(history.getSnapshot().entries);
    await fresh.recentHistory!.clear();
    expect(fresh.recentHistory!.getSnapshot().entries).toEqual([]);
    expect(JSON.parse(f.memory.get(RECENT)!)).toEqual({ v: 1, entries: [] });
    history.dispose?.();
    fresh.recentHistory!.dispose?.();
    f.services.recentHistory?.dispose?.();
  });
  it.each(["high", "balanced", "economy"])("restores graphics quality %s through a fresh native adapter", async value => {
    const f = fixture();
    expect(await f.services.preferences.set(GRAPHICS, value)).toBe(true);
    const recreated = createHostPlatformServices({ kind: "ios", channel: "dev", languages: ["en"], preferences: f.preferences });
    expect(await recreated.preferences.get(GRAPHICS)).toBe(value);
    expect([...f.memory]).toEqual([[GRAPHICS, value]]);
    expect(recreated.preferences.persistence).toBe("best-effort");
    expect(await recreated.preferences.remove(GRAPHICS)).toBe(true);
    expect(await f.services.preferences.get(GRAPHICS)).toBeNull();
  });
  it("rejects unsupported graphics values and lookalike keys without native writes", async () => {
    const f = fixture();
    for (const value of ["", "High", "auto", "high ", "economy\u0000"]) {
      expect(await f.services.preferences.set(GRAPHICS, value)).toBe(false);
      f.memory.set(GRAPHICS, value);
      expect(await f.services.preferences.get(GRAPHICS)).toBeNull();
    }
    for (const key of [GRAPHICS + ":en", GRAPHICS + "\u0000"]) {
      expect(await f.services.preferences.set(key, "high")).toBe(false);
      expect(await f.services.preferences.get(key)).toBeNull();
      expect(await f.services.preferences.remove(key)).toBe(false);
    }
    expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.preferences.remove).not.toHaveBeenCalled();
  });
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
