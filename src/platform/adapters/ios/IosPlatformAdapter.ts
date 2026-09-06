import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { Browser } from "@capacitor/browser";
import { AppLauncher } from "@capacitor/app-launcher";
import { createHostPlatformServices } from "../../../host/HostPlatformServices";
import {
  assertNativeHostBindings, initializeHostPlatform,
  type InitializedHostPlatform, type NativeHostAdapterOptions,
} from "../../../host/initializeHostPlatform";

export interface IosPlatformAdapterOptions extends NativeHostAdapterOptions {
  readonly channel?: "dev" | "appStore";
}

/** The real iOS plugin boundary; bootstrap does not mount or select a locale. */
export async function createIosPlatformAdapter(options: IosPlatformAdapterOptions = {}): Promise<InitializedHostPlatform> {
  const channel = options.channel ?? "dev";
  if (!["dev", "appStore"].includes(channel)) throw new Error("Invalid iOS distribution channel");
  const bindings = options.bindings ?? {
    core: Capacitor, app: App, network: Network, preferences: Preferences, browser: Browser, appLauncher: AppLauncher,
  };
  assertNativeHostBindings(bindings, "ios");
  const initialization = await initializeHostPlatform({
    getAppLanguage: () => bindings.app.getAppLanguage(),
    readLanguagePreference: () => bindings.preferences.get({ key: "probpera-interface-language" }),
    timeoutMs: options.timeoutMs,
  });
  const services = createHostPlatformServices({
    kind: "ios", channel, languages: initialization.language.value === null ? [] : [initialization.language.value],
    app: bindings.app, network: bindings.network, preferences: bindings.preferences,
    openBrowser: input => bindings.browser.open(input),
    openMail: input => bindings.appLauncher.openUrl(input),
    allowExternalLink: options.allowExternalLink, onFailure: options.onFailure,
  });
  return Object.freeze({ services, initialization });
}
