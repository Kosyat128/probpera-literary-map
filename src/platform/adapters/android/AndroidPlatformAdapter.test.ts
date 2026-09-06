import { afterEach, describe, expect, it, vi } from "vitest";
import type { NativeHostBindings } from "../../../host/initializeHostPlatform";
import { createAndroidPlatformAdapter } from "./AndroidPlatformAdapter";

function native() {
  return {
    core: { getPlatform: vi.fn(() => "android"), isNativePlatform: vi.fn(() => true), isPluginAvailable: vi.fn((_name: string) => true) },
    app: { getState: vi.fn(async () => ({ isActive: true })), getAppLanguage: vi.fn(async () => ({ value: "ru-RU" })), getLaunchUrl: vi.fn(async () => undefined), addListener: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })) },
    network: { getStatus: vi.fn(async () => ({ connected: false })), addListener: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })) },
    preferences: { get: vi.fn(async (_options: { key: string }) => ({ value: "en" as string | null })), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) },
    browser: { open: vi.fn(async (): Promise<void> => undefined) }, appLauncher: { openUrl: vi.fn(async () => ({ completed: true })) },
  } satisfies NativeHostBindings;
}

describe("Android Capacitor bindings", () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("rejects the actual Node/Web SDK environment without invoking a web fallback", async () => {
    await expect(createAndroidPlatformAdapter()).rejects.toThrow("Required android native platform bindings are unavailable");
  });

  it.each(["dev", "googlePlay", "ruStore"] as const)("binds %s with explicit initialization and no premature listeners or link action", async channel => {
    const bindings = native();
    const result = await createAndroidPlatformAdapter({ bindings, channel });
    expect(result.services.kind).toBe("android"); expect(result.services.channel).toBe(channel);
    expect(result.initialization).toEqual({ language: { status: "ready", value: "ru-RU" }, preference: { status: "ready", value: "en" } });
    expect(result.services.getSystemLanguages()).toEqual(["ru-RU"]);
    expect(result.services.getSystemLanguages()).toBe(result.services.getSystemLanguages());
    expect(Object.isFrozen(result)).toBe(true);
    expect(bindings.preferences.get).toHaveBeenCalledExactlyOnceWith({ key: "probpera-interface-language" });
    expect(bindings.app.getState).not.toHaveBeenCalled(); expect(bindings.network.getStatus).not.toHaveBeenCalled();
    expect(bindings.app.addListener).not.toHaveBeenCalled(); expect(bindings.network.addListener).not.toHaveBeenCalled();
    expect(bindings.browser.open).not.toHaveBeenCalled(); expect(bindings.appLauncher.openUrl).not.toHaveBeenCalled();
  });

  it.each(["web", "ios", "custom"])("rejects mismatching platform %s before bootstrap", async platform => {
    const bindings = native(); bindings.core.getPlatform.mockReturnValue(platform);
    await expect(createAndroidPlatformAdapter({ bindings })).rejects.toThrow("Required android native platform");
    expect(bindings.app.getAppLanguage).not.toHaveBeenCalled(); expect(bindings.preferences.get).not.toHaveBeenCalled();
  });

  it("requires native=true even when a platform string claims android", async () => {
    const bindings = native(); bindings.core.isNativePlatform.mockReturnValue(false);
    await expect(createAndroidPlatformAdapter({ bindings })).rejects.toThrow("Required android native platform");
    expect(bindings.app.getAppLanguage).not.toHaveBeenCalled();
  });

  it.each(["App", "Network", "Preferences", "Browser", "AppLauncher"])("fails closed when native %s is unavailable", async missing => {
    const bindings = native(); bindings.core.isPluginAvailable.mockImplementation(name => name !== missing);
    await expect(createAndroidPlatformAdapter({ bindings })).rejects.toThrow("Required android native platform");
    expect(bindings.app.getAppLanguage).not.toHaveBeenCalled(); expect(bindings.preferences.get).not.toHaveBeenCalled();
  });

  it("does not accept a reported plugin without its required binding method", async () => {
    const bindings = native();
    await expect(createAndroidPlatformAdapter({ bindings: { ...bindings, browser: {} } as unknown as NativeHostBindings })).rejects.toThrow("Required android native platform");
    expect(bindings.app.getAppLanguage).not.toHaveBeenCalled();
  });

  it("sanitizes core bridge failures before any native readers run", async () => {
    const bindings = native(); bindings.core.isPluginAvailable.mockImplementation(() => { throw new Error("private-native-details"); });
    await expect(createAndroidPlatformAdapter({ bindings })).rejects.toThrow("Required android native platform bindings are unavailable");
    expect(bindings.preferences.get).not.toHaveBeenCalled();
  });

  it("rejects another store channel before any native action", async () => {
    const bindings = native();
    await expect(createAndroidPlatformAdapter({ bindings, channel: "appStore" as never })).rejects.toThrow("Invalid Android distribution");
    expect(bindings.core.getPlatform).not.toHaveBeenCalled(); expect(bindings.app.getAppLanguage).not.toHaveBeenCalled();
  });

  it("bounds a stalled language bridge without inventing a ranked device list", async () => {
    vi.useFakeTimers(); const bindings = native();
    bindings.app.getAppLanguage.mockImplementation(() => new Promise(() => undefined));
    const operation = createAndroidPlatformAdapter({ bindings, timeoutMs: 20 });
    await vi.advanceTimersByTimeAsync(20); const result = await operation;
    expect(result.initialization.language).toEqual({ status: "timeout", value: null });
    expect(result.initialization.preference).toEqual({ status: "ready", value: "en" });
    expect(result.services.getSystemLanguages()).toEqual([]); expect(vi.getTimerCount()).toBe(0);
  });

  it("exposes native preference rejection separately from the app language", async () => {
    const bindings = native(); bindings.preferences.get.mockRejectedValue(new Error("storage unavailable"));
    const result = await createAndroidPlatformAdapter({ bindings });
    expect(result.initialization.preference).toEqual({ status: "unavailable", value: null });
    expect(result.initialization.language.status).toBe("ready");
  });

  it("keeps external actions denied until host policy explicitly allows them", async () => {
    const bindings = native(); const { services } = await createAndroidPlatformAdapter({ bindings });
    expect(await services.openExternalLink("https://probpera.ru/en/planet-account/")).toBe("blocked");
    expect(await services.openExternalLink("mailto:probperasite@yandex.ru")).toBe("blocked");
    expect(bindings.browser.open).not.toHaveBeenCalled(); expect(bindings.appLauncher.openUrl).not.toHaveBeenCalled();
  });

  it("awaits Browser rejection and routes exact support mail through AppLauncher", async () => {
    const bindings = native(), onFailure = vi.fn();
    const { services } = await createAndroidPlatformAdapter({ bindings, allowExternalLink: () => true, onFailure });
    bindings.browser.open.mockRejectedValueOnce(new Error("private URL native failure"));
    expect(await services.openExternalLink("https://probpera.ru/en/planet-account/")).toBe("unavailable");
    expect(onFailure).toHaveBeenCalledWith({ operation: "browser-open", reason: "unavailable" });
    expect(await services.openExternalLink("mailto:probperasite@yandex.ru")).toBe("requested");
    expect(bindings.appLauncher.openUrl).toHaveBeenCalledExactlyOnceWith({ url: "mailto:probperasite@yandex.ru" });
    expect(bindings.browser.open).toHaveBeenCalledTimes(1);
    bindings.appLauncher.openUrl.mockResolvedValueOnce({ completed: false });
    expect(await services.openExternalLink("mailto:probperasite@yandex.ru")).toBe("unavailable");
    expect(await services.openExternalLink("mailto:someone@example.test")).toBe("blocked");
  });
});
