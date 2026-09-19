import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { Browser } from "@capacitor/browser";
import { AppLauncher } from "@capacitor/app-launcher";
import { createHostPlatformServices } from "../../../host/HostPlatformServices";
import { createNativeNavigationBridge } from "../../../host/NativeNavigationBridge";
import { createNativeContentDownloads } from "../../../host/createNativeContentDownloads";
import type { NativeContentStoreBridge } from "../../../host/nativeContentStorage";
import {
  assertNativeHostBindings, initializeHostPlatform,
  type InitializedHostPlatform, type NativeHostAdapterOptions,
} from "../../../host/initializeHostPlatform";

export interface AndroidPlatformAdapterOptions extends NativeHostAdapterOptions {
  readonly channel?: "dev" | "googlePlay" | "ruStore";
}

/** The real Android plugin boundary; bootstrap does not mount or select a locale. */
export async function createAndroidPlatformAdapter(options: AndroidPlatformAdapterOptions = {}): Promise<InitializedHostPlatform> {
  const channel = options.channel ?? "dev";
  if (!["dev", "googlePlay", "ruStore"].includes(channel)) throw new Error("Invalid Android distribution channel");
  const bindings = options.bindings ?? {
    core: Capacitor, app: App, network: Network, preferences: Preferences, browser: Browser, appLauncher: AppLauncher,
    contentStore: registerPlugin<NativeContentStoreBridge>("PlanetContentStore"),
  };
  assertNativeHostBindings(bindings, "android");
  const initialization = await initializeHostPlatform({
    getAppLanguage: () => bindings.app.getAppLanguage(),
    readLanguagePreference: () => bindings.preferences.get({ key: "probpera-interface-language" }),
    timeoutMs: options.timeoutMs,
  });
  const services = createHostPlatformServices({
    kind: "android", channel, languages: initialization.language.value === null ? [] : [initialization.language.value],
    app: bindings.app, network: bindings.network, preferences: bindings.preferences,
    openBrowser: input => bindings.browser.open(input),
    openMail: input => bindings.appLauncher.openUrl(input),
    allowExternalLink: options.allowExternalLink, onFailure: options.onFailure,
  });
  const navigation = createNativeNavigationBridge({
    getLaunchUrl: () => bindings.app.getLaunchUrl(),
    subscribeUrl: listener => bindings.app.addListener("appUrlOpen", listener),
    subscribeBack: listener => bindings.app.addListener("backButton", listener),
    timeoutMs: options.timeoutMs, onFailure: options.onNavigationFailure,
  });
  const downloads = createNativeContentDownloads(bindings.contentStore && bindings.core.isPluginAvailable("PlanetContentStore") ? bindings.contentStore : null, { lifecycle: services, preferences: services.preferences });
  return Object.freeze({ services: Object.freeze({ ...services, navigation, downloads }), initialization });
}
