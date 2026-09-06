import React from "react";
import { createRoot } from "react-dom/client";
import App from "../App";
import { AccountlessReaderProvider } from "../community/AuthContext";
import AppErrorBoundary from "../components/AppErrorBoundary";
import BootstrapErrorBoundary from "../components/BootstrapErrorBoundary";
import SiteDesignRuntime from "../cms/SiteDesignRuntime";
import SiteTypographyRuntime from "../cms/SiteTypographyRuntime";
import { InterfaceLanguageProvider, resolveInitialInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { PlatformServicesProvider } from "../platform/PlatformServices";
import { installSafeWebStorage } from "../utils/safeWebStorage";
import type { InitializedHostPlatform } from "./initializeHostPlatform";
import { createHostLanguageStatus, HostRuntimeStatus } from "./HostRuntimeStatus";
import "../styles/editorial-fonts.css";
import "../index.css";
import "../community/community-accessibility.css";
import "../styles/stage5-home-art-direction.css";
import "../styles/stage5-home-layout.css";
import "../styles/stage5-book-shelf.css";
import "../styles/stage5f-responsive-accessibility.css";
import "../styles/book-dossier.css";
import "../styles/editorial-card-layout.css";
import "../styles/community-editorial-layout.css";
import "../styles/calendar-layout.css";
import "../styles/navigation-panels.css";
import "../styles/atlas-intro-layout.css";
import "../styles/site-typography.css";
import "../styles/header-preserved.css";
import "./host.css";

let mounted = false;

/** One canonical app/provider/scene tree. No PWA worker, license or remote entry. */
export function mountHostApp({ services, initialization }: InitializedHostPlatform) {
  if (mounted) throw new Error("The native product is already mounted.");
  const target = document.getElementById("root");
  if (!target || services.kind === "web") throw new Error("A native host root is required.");
  const language = resolveInitialInterfaceLanguage(
    initialization.preference.value, undefined, services.getSystemLanguages()
  );
  const languageStatus = createHostLanguageStatus(services.preferences, language, initialization.preference.status === "ready");
  installSafeWebStorage();
  document.documentElement.lang = language;
  document.title = language === "ru" ? "Литературная планета" : "Literary Planet";
  mounted = true;
  const root = createRoot(target);
  root.render(
    <React.StrictMode>
      <BootstrapErrorBoundary>
        <PlatformServicesProvider services={services}>
          <InterfaceLanguageProvider hostLanguage={languageStatus.persistence}>
            <AccountlessReaderProvider>
              <SiteTypographyRuntime />
              <SiteDesignRuntime />
              <HostRuntimeStatus controller={languageStatus} />
              <AppErrorBoundary><App /></AppErrorBoundary>
            </AccountlessReaderProvider>
          </InterfaceLanguageProvider>
        </PlatformServicesProvider>
      </BootstrapErrorBoundary>
    </React.StrictMode>
  );
  let unmounted = false;
  return Object.freeze({
    unmount() {
      if (unmounted) return;
      unmounted = true;
      languageStatus.dispose();
      root.unmount();
    },
  });
}

/** Initialization failure leaves a real localized error, never a browser SDK fallback. */
export function showHostInitializationFailure() {
  const target = document.getElementById("root");
  if (!target) return;
  const ru = document.documentElement.lang === "ru";
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent = ru
    ? "Не удалось запустить приложение. Закройте его и попробуйте снова."
    : "The app could not start. Close it and try again.";
  target.replaceChildren(message);
}
