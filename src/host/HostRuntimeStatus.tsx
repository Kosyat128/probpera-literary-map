import { useEffect, useSyncExternalStore } from "react";
import { useInterfaceLanguage, type HostLanguagePersistence, type InterfaceLanguage } from "../i18n/InterfaceLanguage";
import { usePlatformSnapshot } from "../platform/PlatformServices";
import type { PreferenceStore } from "../platform/ports";

export type HostLanguageStatus = "idle" | "saving" | "failed" | "read-unavailable";
export interface HostLanguageStatusController {
  readonly persistence: HostLanguagePersistence;
  getSnapshot(): HostLanguageStatus;
  getServerSnapshot(): HostLanguageStatus;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

/** Tracks persistence outcomes only. The canonical provider alone owns language. */
export function createHostLanguageStatus(preferences: PreferenceStore, initialLanguage: InterfaceLanguage, readAvailable: boolean): HostLanguageStatusController {
  const initialStatus: HostLanguageStatus = readAvailable ? "idle" : "read-unavailable";
  let status: HostLanguageStatus = initialStatus;
  let version = 0;
  let disposed = false;
  let latestOutcome: "pending" | "success" | "failure" | null = null;
  const listeners = new Set<() => void>();
  function publish(next: HostLanguageStatus) {
    if (disposed || status === next) return;
    status = next;
    for (const listener of [...listeners]) {
      if (disposed) break;
      if (listeners.has(listener)) {
        try { listener(); } catch { /* Persistence reporting must preserve the chosen locale. */ }
      }
    }
  }
  const persistence: HostLanguagePersistence = Object.freeze({
    initialLanguage,
    persist(nextLanguage: InterfaceLanguage) {
      if (disposed) return Promise.resolve(false);
      const attempt = ++version;
      latestOutcome = "pending";
      publish("saving");
      return Promise.resolve().then(() => preferences.set("probpera-interface-language", nextLanguage)).then(saved => {
        if (!disposed && attempt === version) {
          latestOutcome = saved === true ? "success" : "failure";
          if (saved === true) publish("idle");
        }
        return saved === true;
      }, () => {
        if (!disposed && attempt === version) latestOutcome = "failure";
        return false;
      });
    },
    onFailure() {
      // The provider callback has no attempt ID. Consult only the latest outcome;
      // an old failure cannot replace a newer pending or successful write.
      if (latestOutcome === "failure") publish("failed");
    },
  });
  return Object.freeze({
    persistence,
    getSnapshot: () => status,
    getServerSnapshot: () => initialStatus,
    subscribe(listener: () => void) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() { disposed = true; ++version; listeners.clear(); },
  });
}

/** Internal preparation copy. No editorial or native release approval is implied. */
export const hostRuntimeCopy = {
  source: "ai-draft", reviewStatus: "draft", releaseReady: false,
  locales: {
    ru: {
      title: "Литературная планета",
      offline: "Нет соединения с сетью.",
      unknown: "Состояние сети неизвестно.",
      saving: "Сохраняем язык…",
      failed: "Не удалось сохранить язык. Выбранный язык продолжает действовать.",
      "read-unavailable": "Не удалось прочитать сохранённый язык. Переключение языка доступно.",
    },
    en: {
      title: "Literary Planet",
      offline: "No network connection.",
      unknown: "Network status is unknown.",
      saving: "Saving language…",
      failed: "The language choice could not be saved. Your selected language remains active.",
      "read-unavailable": "Your saved language could not be read. You can still change the language.",
    },
  },
} as const;

export function HostRuntimeStatus({ controller }: { readonly controller: HostLanguageStatusController }) {
  // This subscription owns native App/Network listener lifetimes through the port.
  const { connectivity } = usePlatformSnapshot();
  const { language } = useInterfaceLanguage();
  const persistence = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const copy = hostRuntimeCopy.locales[language];
  useEffect(() => { document.title = copy.title; }, [copy.title]);
  if (connectivity === "online" && persistence === "idle") return null;
  return (
    <div className="connectivity-status host-runtime-status" role="status" aria-live="polite" aria-atomic="true"
      data-host-connectivity={connectivity} data-host-language-persistence={persistence}>
      {connectivity !== "online" ? <span data-host-network-hint>{copy[connectivity]}</span> : null}
      {persistence !== "idle" ? <span data-host-language-notice>{copy[persistence]}</span> : null}
    </div>
  );
}
