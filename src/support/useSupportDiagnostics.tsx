import { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";
import { usePlatformServices } from "../platform/PlatformServices";
import { isControlledWebEdition } from "../platform/distribution";
import { usePwaOfflineRepairAccess } from "../pwa/PwaAccessBoundary";
import { createSupportDiagnosticSession } from "./supportDiagnosticSession";
import { observeNativeDiagnosticStorage } from "./supportDiagnosticObservations";
import { projectSupportDiagnostics, type DiagnosticCatalog, type DiagnosticItems,
  type DiagnosticWebgl, type PwaDiagnosticObservation, type SupportDiagnosticInput } from "./supportDiagnostics";

export type SupportPwaReader = () => PwaDiagnosticObservation;
export type RegisterSupportPwaReader = (read: SupportPwaReader) => () => void;
/** Null in pre-access help and all child trees. Carries no admission, raw profile or credentials. */
export const SupportPwaObservationContext = createContext<RegisterSupportPwaReader | null>(null);
export const useSupportPwaObservation = () => useContext(SupportPwaObservationContext);
export type SupportAppObservation = Readonly<{
  graphicsTier: SupportDiagnosticInput["graphicsTier"]; activeItems: DiagnosticItems | null;
  webgl: DiagnosticWebgl | null; catalog: DiagnosticCatalog;
}>;

export function useSupportDiagnostics(options: {
  readonly active: boolean; readonly language: "ru" | "en"; readonly readApp: () => SupportAppObservation;
}) {
  const platform = usePlatformServices();
  const pwaAccess = usePwaOfflineRepairAccess();
  const latest = useRef(options);
  // Read the committed outer-panel/catalog view; background and admission are checked live below.
  useLayoutEffect(() => { latest.current = options; });
  const reader = useRef<SupportPwaReader | null>(null);
  const registerPwaReader = useMemo<RegisterSupportPwaReader>(() => read => {
    reader.current = read;
    return () => { if (reader.current === read) reader.current = null; };
  }, []);
  // Each platform/access identity has its own lease; a replaced session cannot reopen after cleanup.
  const lifetime = useMemo(() => ({ mounted: false }), [platform, pwaAccess]);
  const session = useMemo(() => {
    const canUse = () => {
      if (!lifetime.mounted || !latest.current.active || platform.getSnapshot().visibility !== "active") return false;
      if (platform.kind === "web") {
        const deadline = pwaAccess?.getDeadline();
        return isControlledWebEdition && typeof deadline === "number" && Number.isFinite(deadline);
      }
      return platform.childApp?.isAdultDiagnosticsAllowed?.() === true;
    };
    return createSupportDiagnosticSession({
      canUse,
      read: () => {
        // This method is reached only after consent and a fresh admission check.
        if (!canUse()) return null;
        const app = latest.current.readApp();
        let pwa: PwaDiagnosticObservation | null = null;
        let nativeStorage = null;
        if (platform.kind === "web") {
          try { pwa = reader.current?.() ?? null; } catch { /* Unknown, never raw errors. */ }
        } else if (platform.downloads) {
          try { nativeStorage = observeNativeDiagnosticStorage(platform.downloads.getSnapshot().space); }
          catch { /* This display observation has no storage mutation or authority. */ }
        }
        return projectSupportDiagnostics({ platform: platform.kind, graphicsTier: app.graphicsTier,
          activeItems: app.activeItems, webgl: app.webgl, pwa, nativeStorage }, app.catalog);
      },
    });
  }, [platform, pwaAccess, lifetime]);
  useLayoutEffect(() => {
    lifetime.mounted = true;
    const stops: (() => void)[] = [];
    try {
      // Clear on every authority transition, including a same-view refresh or revocation.
      stops.push(platform.subscribe(session.clear));
      if (pwaAccess) stops.push(pwaAccess.subscribe(session.clear));
      if (platform.childApp) stops.push(platform.childApp.subscribe(session.clear));
    } catch { lifetime.mounted = false; session.clear(); }
    return () => {
      lifetime.mounted = false; session.clear();
      for (const stop of stops) { try { stop(); } catch { /* Already revoked locally. */ } }
    };
  }, [platform, pwaAccess, session, lifetime]);
  useLayoutEffect(() => { session.clear(); }, [session, options.active, options.language]);
  return { session, registerPwaReader };
}
