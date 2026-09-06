import type { PlatformServices } from "../platform/ports";
import type { HostAppBridge, HostNetworkBridge, HostPreferenceBridge, HostPlatformServicesOptions } from "./HostPlatformServices";

export interface NativeHostBindings {
  readonly core: {
    getPlatform(): string;
    isNativePlatform(): boolean;
    isPluginAvailable(name: string): boolean;
  };
  readonly app: HostAppBridge & { getAppLanguage(): Promise<unknown> };
  readonly network: HostNetworkBridge;
  readonly preferences: HostPreferenceBridge;
  readonly browser: { open(options: { url: string }): Promise<void> };
  readonly appLauncher: { openUrl(options: { url: string }): Promise<{ completed: boolean }> };
}
export interface NativeHostAdapterOptions {
  /** Explicit injection for native bootstrap tests; omitted uses real SDK bindings. */
  readonly bindings?: NativeHostBindings;
  readonly timeoutMs?: number;
  readonly allowExternalLink?: HostPlatformServicesOptions["allowExternalLink"];
  readonly onFailure?: HostPlatformServicesOptions["onFailure"];
}
export interface InitializedHostPlatform {
  readonly services: PlatformServices;
  readonly initialization: HostPlatformInitialization;
}

/** Public SDK availability guards; no invocation of a plugin or Web fallback. */
export function assertNativeHostBindings(bindings: NativeHostBindings, kind: "android" | "ios"): void {
  try {
    if (!bindings || bindings.core?.isNativePlatform() !== true || bindings.core.getPlatform() !== kind) {
      throw new Error("Invalid native platform");
    }
    for (const plugin of ["App", "Network", "Preferences", "Browser", "AppLauncher"]) {
      if (bindings.core.isPluginAvailable(plugin) !== true) throw new Error("Missing native plugin");
    }
    const methods = [
      bindings.app?.getState, bindings.app?.addListener, bindings.app?.getAppLanguage,
      bindings.network?.getStatus, bindings.network?.addListener,
      bindings.preferences?.get, bindings.preferences?.set, bindings.preferences?.remove,
      bindings.browser?.open, bindings.appLauncher?.openUrl,
    ];
    if (methods.some(method => typeof method !== "function")) throw new Error("Missing native method");
  } catch {
    // Raw native messages/objects do not become error-screen or telemetry data.
    throw new Error("Required " + kind + " native platform bindings are unavailable");
  }
}

export type HostInitializationStatus = "ready" | "unavailable" | "timeout";
export interface HostInitializationValue<T> {
  readonly status: HostInitializationStatus;
  readonly value: T | null;
}
export interface HostPlatformInitialization {
  readonly language: HostInitializationValue<string>;
  readonly preference: HostInitializationValue<"ru" | "en">;
}
export interface HostPlatformInitializationOptions {
  readonly getAppLanguage: () => Promise<unknown>;
  readonly readLanguagePreference: () => Promise<unknown>;
  /** A caller may choose 1-10000 ms; both independent reads use the same bound. */
  readonly timeoutMs?: number;
}

function nativeValue(result: unknown): unknown {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Invalid native initialization result");
  }
  return (result as { value?: unknown }).value;
}

function appLanguage(result: unknown): string {
  const value = nativeValue(result);
  if (typeof value !== "string" || value.length === 0 || value.length > 128 || /[\s\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error("Invalid native language");
  }
  const canonical = Intl.getCanonicalLocales(value);
  if (canonical.length !== 1) throw new Error("Invalid native language");
  return canonical[0];
}

function savedPreference(result: unknown): "ru" | "en" | null {
  const value = nativeValue(result);
  if (value !== null && value !== "ru" && value !== "en") {
    throw new Error("Invalid native language preference");
  }
  return value;
}

function boundedValue<T>(operation: () => Promise<unknown>, normalize: (result: unknown) => T | null, timeoutMs: number): Promise<HostInitializationValue<T>> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (status: HostInitializationStatus, value: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Object.freeze({ status, value }));
    };
    const timer = setTimeout(() => finish("timeout", null), timeoutMs);
    // Both success and rejection handlers remain attached after timeout. A late
    // plugin completion cannot rewrite initialization or reject without a handler.
    void Promise.resolve().then(operation).then(result => {
      if (settled) return;
      try { finish("ready", normalize(result)); }
      catch { finish("unavailable", null); }
    }, () => finish("unavailable", null));
  });
}

/** Native reads only. No browser fallback, locale store, rendering or catalog IO. */
export async function initializeHostPlatform(options: HostPlatformInitializationOptions): Promise<HostPlatformInitialization> {
  const timeoutMs = options.timeoutMs ?? 1500;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new RangeError("Native initialization timeout must be 1-10000 ms");
  }
  if (typeof options.getAppLanguage !== "function" || typeof options.readLanguagePreference !== "function") {
    throw new TypeError("Native initialization requires explicit native readers");
  }
  const [language, preference] = await Promise.all([
    boundedValue(options.getAppLanguage, appLanguage, timeoutMs),
    boundedValue(options.readLanguagePreference, savedPreference, timeoutMs),
  ]);
  return Object.freeze({ language, preference });
}
