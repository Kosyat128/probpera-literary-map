import { afterEach, describe, expect, it, vi } from "vitest";
import type { NativeHostBindings } from "../../../host/initializeHostPlatform";
import { createIosPlatformAdapter } from "./IosPlatformAdapter";

function native() {
  return {
    core: { getPlatform: vi.fn(() => "ios"), isNativePlatform: vi.fn(() => true), isPluginAvailable: vi.fn((_name: string) => true) },
    app: { getState: vi.fn(async () => ({ isActive: true })), getAppLanguage: vi.fn(async () => ({ value: "en-GB" })), addListener: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })) },
    network: { getStatus: vi.fn(async () => ({ connected: true })), addListener: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })) },
    preferences: { get: vi.fn(async (_options: { key: string }) => ({ value: null as string | null })), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) },
    browser: { open: vi.fn(async (): Promise<void> => undefined) }, appLauncher: { openUrl: vi.fn(async () => ({ completed: true })) },
  } satisfies NativeHostBindings;
}

describe("iOS Capacitor bindings", () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("rejects actual Node/Web SDK execution instead of taking the BrowserWeb implementation", async () => {
    await expect(createIosPlatformAdapter()).rejects.toThrow("Required ios native platform bindings are unavailable");
  });

  it.each(["dev", "appStore"] as const)("initializes %s with one app-specific locale and no invented saved choice", async channel => {
    const bindings = native(); const result = await createIosPlatformAdapter({ bindings, channel });
    expect(result.services.kind).toBe("ios"); expect(result.services.channel).toBe(channel);
    expect(result.initialization).toEqual({ language: { status: "ready", value: "en-GB" }, preference: { status: "ready", value: null } });
    expect(result.services.getSystemLanguages()).toEqual(["en-GB"]);
    expect(Object.isFrozen(result.services.getSystemLanguages())).toBe(true);
    expect(bindings.preferences.get).toHaveBeenCalledExactlyOnceWith({ key: "probpera-interface-language" });
    expect(bindings.app.addListener).not.toHaveBeenCalled(); expect(bindings.network.addListener).not.toHaveBeenCalled();
    expect(bindings.app.getState).not.toHaveBeenCalled(); expect(bindings.network.getStatus).not.toHaveBeenCalled();
    expect(bindings.browser.open).not.toHaveBeenCalled(); expect(bindings.appLauncher.openUrl).not.toHaveBeenCalled();
  });

  it.each(["web", "android", "custom"])("rejects %s even when isNativePlatform is true", async platform => {
    const bindings = native(); bindings.core.getPlatform.mockReturnValue(platform);
    await expect(createIosPlatformAdapter({ bindings })).rejects.toThrow("Required ios native platform");
    expect(bindings.app.getAppLanguage).not.toHaveBeenCalled(); expect(bindings.preferences.get).not.toHaveBeenCalled();
  });

  it("requires real native platform detection", async () => {
    const bindings = native(); bindings.core.isNativePlatform.mockReturnValue(false);
    await expect(createIosPlatformAdapter({ bindings })).rejects.toThrow("Required ios native platform");
    expect(bindings.app.getAppLanguage).not.toHaveBeenCalled();
  });

  it.each(["App", "Network", "Preferences", "Browser", "AppLauncher"])("rejects a missing %s native plugin before bootstrap", async missing => {
    const bindings = native(); bindings.core.isPluginAvailable.mockImplementation(name => name !== missing);
    await expect(createIosPlatformAdapter({ bindings })).rejects.toThrow("Required ios native platform");
    expect(bindings.app.getAppLanguage).not.toHaveBeenCalled(); expect(bindings.preferences.get).not.toHaveBeenCalled();
  });

  it("rejects a missing native core or method binding", async () => {
    const bindings = native();
    await expect(createIosPlatformAdapter({ bindings: { ...bindings, core: undefined } as unknown as NativeHostBindings })).rejects.toThrow("Required ios native platform");
    await expect(createIosPlatformAdapter({ bindings: { ...bindings, appLauncher: {} } as unknown as NativeHostBindings })).rejects.toThrow("Required ios native platform");
    expect(bindings.preferences.get).not.toHaveBeenCalled();
  });

  it.each(["googlePlay", "ruStore"])("rejects Android channel %s before plugin calls", async channel => {
    const bindings = native();
    await expect(createIosPlatformAdapter({ bindings, channel: channel as never })).rejects.toThrow("Invalid iOS distribution");
    expect(bindings.core.getPlatform).not.toHaveBeenCalled();
  });

  it("times out only the unavailable preference read and ignores its eventual completion", async () => {
    vi.useFakeTimers(); const bindings = native(); let finish!: (value: { value: string | null }) => void;
    bindings.preferences.get.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const operation = createIosPlatformAdapter({ bindings, timeoutMs: 20 });
    await vi.advanceTimersByTimeAsync(20); const result = await operation;
    expect(result.initialization.preference).toEqual({ status: "timeout", value: null });
    expect(result.services.getSystemLanguages()).toEqual(["en-GB"]);
    finish({ value: "ru" }); await Promise.resolve();
    expect(result.initialization.preference.status).toBe("timeout"); expect(vi.getTimerCount()).toBe(0);
  });

  it("handles absent/malformed Bundle language data without a browser-derived locale", async () => {
    const bindings = native(); bindings.app.getAppLanguage.mockResolvedValue({ value: undefined as unknown as string });
    const result = await createIosPlatformAdapter({ bindings });
    expect(result.initialization.language).toEqual({ status: "unavailable", value: null });
    expect(result.services.getSystemLanguages()).toEqual([]);
  });

  it("awaits native presentation instead of reporting success before completion", async () => {
    const bindings = native(); let finish!: () => void;
    bindings.browser.open.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const { services } = await createIosPlatformAdapter({ bindings, allowExternalLink: () => true });
    let settled = false;
    const result = Promise.resolve(services.openExternalLink("https://probpera.ru/ru/planet-account/")).then(value => { settled = true; return value; });
    await Promise.resolve(); expect(settled).toBe(false);
    finish(); expect(await result).toBe("requested");
    expect(bindings.appLauncher.openUrl).not.toHaveBeenCalled();
  });

  it("uses AppLauncher for canonical mail and reports rejected OS handoff", async () => {
    const bindings = native(), onFailure = vi.fn();
    const { services } = await createIosPlatformAdapter({ bindings, allowExternalLink: () => true, onFailure });
    bindings.appLauncher.openUrl.mockRejectedValueOnce(new Error("no installed email handler"));
    expect(await services.openExternalLink("mailto:probperasite@yandex.ru")).toBe("unavailable");
    expect(onFailure).toHaveBeenCalledWith({ operation: "mail-open", reason: "unavailable" });
    expect(bindings.browser.open).not.toHaveBeenCalled();
    expect(await services.openExternalLink("mailto:probperasite@yandex.ru")).toBe("requested");
    expect(await services.openExternalLink("mailto:probperasite@yandex.ru?bcc=other@example.test")).toBe("blocked");
  });

  it("starts with a deny-by-default policy even for canonical support", async () => {
    const bindings = native(); const { services } = await createIosPlatformAdapter({ bindings });
    expect(await services.openExternalLink("mailto:probperasite@yandex.ru")).toBe("blocked");
    expect(bindings.appLauncher.openUrl).not.toHaveBeenCalled();
  });
});
