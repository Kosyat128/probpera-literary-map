import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { createHostPlatformServices, type HostPreferenceBridge } from "./HostPlatformServices";
import { BOOKY_SIZE_PREFERENCE_KEY } from "./bookySizePreference";

const language = "probpera-interface-language", theme = "probpera-display-mode";
const keys = [language, theme, BOOKY_SIZE_PREFERENCE_KEY];
export const NATIVE_PREFERENCE_DIAGNOSTIC_CASES = ["write", "read", "remove", "corrupt", "unsupported-language", "unsupported-theme",
  "parallel", "plugin-failure", "timeout", "absent", "clear"] as const;
type DiagnosticCase = typeof NATIVE_PREFERENCE_DIAGNOSTIC_CASES[number];
type Result = Readonly<{ schemaVersion: 1; runId: string; case: DiagnosticCase; status: "PASS" | "FAIL"; backend: "native-os" | "synthetic-boundary" }>;
const assert = (condition: unknown) => { if (condition !== true) throw new Error("native-preference-diagnostic-failed"); };

/** Dev fixture only: the existing JS preference policy wraps the real native
 * plugin. Exact per-run OS keys isolate fixtures without changing the plugin's
 * global group, reading production keys, scanning or clearing storage. Fault
 * and timeout cases deliberately substitute a synthetic boundary and say so.
 * This API never exposes secrets, account state, child authority or raw IO. */
export function createNativePreferenceDiagnostics(kind: "android" | "ios", native: HostPreferenceBridge) {
  const raw = { get: native.get.bind(native), set: native.set.bind(native), remove: native.remove.bind(native) };
  let busy = false;
  return Object.freeze({ async run(runId: string, phase: string): Promise<Result> {
    if (busy || typeof runId !== "string" || !/^[a-f0-9]{32}$/u.test(runId)
      || !NATIVE_PREFERENCE_DIAGNOSTIC_CASES.includes(phase as DiagnosticCase)) throw new Error("native-preference-diagnostic-unavailable");
    busy = true;
    const caseName = phase as DiagnosticCase, prefix = "literary-native-runtime-" + runId + ":";
    const mapped = (key: string) => { if (!keys.includes(key)) throw new Error("native-preference-diagnostic-unavailable"); return prefix + key; };
    const bridge: HostPreferenceBridge = {
      get: options => raw.get({ key: mapped(options.key) }),
      set: options => raw.set({ key: mapped(options.key), value: options.value }),
      remove: options => raw.remove({ key: mapped(options.key) }),
    };
    const synthetic = phase === "plugin-failure" || phase === "timeout";
    try {
      let calls = 0;
      const fault: HostPreferenceBridge = phase === "timeout" ? {
        get: () => { calls++; return new Promise(() => undefined); },
        set: () => { calls++; return new Promise(() => undefined); },
        remove: () => { calls++; return new Promise(() => undefined); },
      } : {
        get: async () => { calls++; throw new Error("synthetic-plugin-failure"); },
        set: async () => { calls++; throw new Error("synthetic-plugin-failure"); },
        remove: async () => { calls++; throw new Error("synthetic-plugin-failure"); },
      };
      const platform = kind === "android" ? { kind: "android" as const, channel: "dev" as const } : { kind: "ios" as const, channel: "dev" as const };
      const host = createHostPlatformServices({ ...platform, languages: [], preferences: synthetic ? fault : bridge, preferenceTimeoutMs: synthetic ? 50 : 1500 });
      const store = host.preferences;
      if (phase === "write") {
        assert(await store.set(language, "en")); assert(await store.set(theme, "book")); assert(await store.set(BOOKY_SIZE_PREFERENCE_KEY, "large"));
        assert((await raw.get({ key: mapped(language) })).value === "en");
        assert((await raw.get({ key: mapped(theme) })).value === "book");
        assert((await raw.get({ key: mapped(BOOKY_SIZE_PREFERENCE_KEY) })).value === "large");
      } else if (phase === "read") {
        assert(await store.get(language) === "en"); assert(await store.get(theme) === "book"); assert(await store.get(BOOKY_SIZE_PREFERENCE_KEY) === "large");
      } else if (phase === "remove" || phase === "clear") {
        for (const key of keys) { assert(await store.remove(key)); assert((await raw.get({ key: mapped(key) })).value === null); }
      } else if (phase === "absent") {
        for (const key of keys) assert((await raw.get({ key: mapped(key) })).value === null);
      } else if (phase === "corrupt") {
        await raw.set({ key: mapped(language), value: "synthetic-invalid-language" });
        assert((await raw.get({ key: mapped(language) })).value === "synthetic-invalid-language"); assert(await store.get(language) === null);
      } else if (phase === "unsupported-language" || phase === "unsupported-theme") {
        const key = phase === "unsupported-language" ? language : theme, before = (await raw.get({ key: mapped(key) })).value;
        assert(await store.set(key, "synthetic-unsupported") === false); assert((await raw.get({ key: mapped(key) })).value === before);
      } else if (phase === "parallel") {
        const writes = await Promise.all([store.set(language, "ru"), store.set(language, "en"), store.set(language, "ru")]);
        assert(writes.every(value => value === true)); assert((await raw.get({ key: mapped(language) })).value === "ru");
      } else {
        assert(await store.get(language) === null); assert(await store.set(language, "en") === false);
        assert(calls === (phase === "timeout" ? 1 : 2));
      }
      return Object.freeze({ schemaVersion: 1, runId, case: caseName, status: "PASS", backend: synthetic ? "synthetic-boundary" : "native-os" });
    } catch {
      return Object.freeze({ schemaVersion: 1, runId, case: caseName, status: "FAIL", backend: synthetic ? "synthetic-boundary" : "native-os" });
    } finally { busy = false; }
  } });
}

declare global { interface Window { __LITERARY_PLANET_NATIVE_PREFERENCES_QA__?: ReturnType<typeof createNativePreferenceDiagnostics>; } }
export function installNativePreferenceDiagnostics(kind: "android" | "ios") {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== kind || window.__LITERARY_PLANET_NATIVE_PREFERENCES_QA__) return;
  Object.defineProperty(window, "__LITERARY_PLANET_NATIVE_PREFERENCES_QA__", {
    value: createNativePreferenceDiagnostics(kind, Preferences), writable: false, configurable: false, enumerable: false,
  });
}
