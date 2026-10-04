import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { Browser } from "@capacitor/browser";
import { AppLauncher } from "@capacitor/app-launcher";
import { createHostPlatformServices, type HostPlatformServicesOptions } from "../../../host/HostPlatformServices";
import { createNativeNavigationBridge } from "../../../host/NativeNavigationBridge";
import { createChildNativeAppController, type ChildNativeAppPlugin } from "../../../child/childNativeAppBridge";
import type { NativeContentStoreBridge } from "../../../host/nativeContentStorage";
import { createNativeSecureStorage, type NativeSecureStoreBridge } from "../../../host/nativeSecureStorage";
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
    secureStore: registerPlugin<NativeSecureStoreBridge>("PlanetSecureStore"),
    child: registerPlugin<ChildNativeAppPlugin>("PlanetChild"),
  };
  assertNativeHostBindings(bindings, "android");
  const initialization = await initializeHostPlatform({
    getAppLanguage: () => bindings.app.getAppLanguage(),
    readLanguagePreference: () => bindings.preferences.get({ key: "probpera-interface-language" }),
    timeoutMs: options.timeoutMs,
  });
  const hostOptions: HostPlatformServicesOptions = {
    kind: "android", channel, languages: initialization.language.value === null ? [] : [initialization.language.value],
    app: bindings.app, network: bindings.network, preferences: bindings.preferences,
    getAppLanguage: () => bindings.app.getAppLanguage(), languageTimeoutMs: options.timeoutMs,
    openBrowser: input => bindings.browser.open(input),
    openMail: input => bindings.appLauncher.openUrl(input),
    allowExternalLink: options.allowExternalLink, onFailure: options.onFailure,
  };
  const services = createHostPlatformServices(hostOptions);
  const navigation = createNativeNavigationBridge({
    getLaunchUrl: () => bindings.app.getLaunchUrl(),
    subscribeUrl: listener => bindings.app.addListener("appUrlOpen", listener),
    subscribeBack: listener => bindings.app.addListener("backButton", listener),
    timeoutMs: options.timeoutMs, onFailure: options.onNavigationFailure,
  });
  const childApp = createChildNativeAppController({
    plugin: bindings.child && bindings.core.isPluginAvailable("PlanetChild") ? bindings.child : null,
    lifecycle: services,
  });
  const secureStorage = createNativeSecureStorage(bindings.secureStore && bindings.core.isPluginAvailable("PlanetSecureStore")
    ? bindings.secureStore : null, options.timeoutMs);
  return Object.freeze({ services: Object.freeze({ ...services, navigation, secureStorage, childApp }), initialization,
    async createAdultServices() {
      const { createNativeContentDownloads } = await import("../../../host/createNativeContentDownloads");
      const adult = createHostPlatformServices(hostOptions);
      const downloads = createNativeContentDownloads(bindings.contentStore && bindings.core.isPluginAvailable("PlanetContentStore")
        ? bindings.contentStore : null, { lifecycle: adult, preferences: adult.preferences });
      return Object.freeze({ ...adult, navigation, downloads, secureStorage, childApp });
    },
  });
}
