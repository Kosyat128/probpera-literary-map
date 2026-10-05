
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";


import AppErrorBoundary from "../components/AppErrorBoundary";
import BootstrapErrorBoundary from "../components/BootstrapErrorBoundary";


import { InterfaceLanguageProvider, resolveInitialInterfaceLanguage, type HostLanguagePersistence } from "../i18n/InterfaceLanguage";
import { PlatformServicesProvider } from "../platform/PlatformServices";

import { installSafeWebStorage } from "../utils/safeWebStorage";
import type { InitializedHostPlatform } from "./initializeHostPlatform";
import { createHostLanguageStatus, HostRuntimeStatus, type HostLanguageStatusController } from "./HostRuntimeStatus";
import "../styles/editorial-fonts.css";
import "../index.css";
import "../community/community-accessibility.css";
import "../styles/stage5-home-art-direction.css";
import "../styles/stage5-home-layout.css";
import "../styles/stage5-book-shelf.css";
import "../styles/stage5f-responsive-accessibility.css";
import "../styles/book-dossier.css";
import "../styles/book-shelf-controls.css";
import "../styles/book-reader-refinement.css";
import "../styles/editorial-card-layout.css";
import "../styles/community-editorial-layout.css";
import "../styles/calendar-layout.css";
import "../styles/navigation-panels.css";
import "../styles/atlas-intro-layout.css";
import "../styles/site-typography.css";
import "../styles/article-reading-layout.css";
import "../styles/search-account-layout.css";
import "../styles/community-layout.css";
import "../styles/header-preserved.css";
import "./host.css";

import { ChildNativeClosedView, NativeProfileControls } from "../child/ChildNativeBoundary";
import { NativeChildSceneHost } from "./NativeChildSceneHost";
import { childNativePresentationServices, type ChildNativeAppSnapshot } from "../child/childNativeAppBridge";
import type { PlatformServices } from "../platform/ports";

let mounted = false;

/** The native LOCAL V2 result is admitted before App, Auth, adult history,
 * downloads, CMS effects or any private route is imported and mounted. */
export function mountHostApp({ services, initialization, createAdultServices }: InitializedHostPlatform) {
  if (mounted) throw new Error("The native product is already mounted.");
  const target = document.getElementById("root");
  if (!target || services.kind === "web" || !services.childApp) throw new Error("A native child bootstrap owner is required.");
  const controller = services.childApp;
  let adultLanguage = resolveInitialInterfaceLanguage(initialization.preference.value, undefined, services.getSystemLanguages());
  const followsSystem = services.kind === "android" && initialization.preference.status === "ready" && initialization.preference.value === null;
  installSafeWebStorage();
  mounted = true;
  const root = createRoot(target), publicServices = childNativePresentationServices(services);
  let stopped = false, generation = 0, activeKey: string | null = null;
  let adult: PlatformServices | null = null, languageStatus: HostLanguageStatusController | null = null;
  function retireAdult() {
    languageStatus?.dispose(); languageStatus = null;
    adult?.recentHistory?.dispose?.(); adult?.downloads?.dispose(); adult = null;
  }
  function locale(value: "ru" | "en") {
    document.documentElement.lang = value; document.title = value === "ru" ? "Литературная планета" : "Literary Planet";
  }
  let closedOwner: { key: string; persistence: HostLanguagePersistence } | null = null;
  let childOwner: { key: string; profileId: string; persistence: HostLanguagePersistence } | null = null;
  function childTree(snapshot: ChildNativeAppSnapshot) {
    const owner=childOwner;
    if(!owner)return closed(snapshot,generation);
    return <BootstrapErrorBoundary key={owner.key}>
      <PlatformServicesProvider services={publicServices}>
        <InterfaceLanguageProvider hostLanguage={owner.persistence}>
          <AppErrorBoundary><NativeChildSceneHost snapshot={snapshot} controller={controller} profileId={owner.profileId}/></AppErrorBoundary>
        </InterfaceLanguageProvider>
      </PlatformServicesProvider>
    </BootstrapErrorBoundary>;
  }
  function closed(snapshot: ChildNativeAppSnapshot, key: number) {
    const language = snapshot.context?.locale ?? adultLanguage;
    const ownerKey = "sealed-" + key + "-" + language;
    if (closedOwner?.key !== ownerKey) {
      closedOwner = { key: ownerKey, persistence: Object.freeze({ initialLanguage: language, persist: async () => false }) };
    }
    const persistence = closedOwner.persistence;
    locale(language);
    return <BootstrapErrorBoundary key={ownerKey}>
      <PlatformServicesProvider services={publicServices}>
        <InterfaceLanguageProvider hostLanguage={persistence}>
          <ChildNativeClosedView snapshot={snapshot} controller={controller} />
        </InterfaceLanguageProvider>
      </PlatformServicesProvider>
    </BootstrapErrorBoundary>;
  }
  function clearPresentation() {
    if (stopped) return;
    ++generation; activeKey = null;
    // The actual old child content/effects/material recipients clear synchronously.
    // Its canonical renderer can remain inert for a same-profile successor.
    // This barrier supplies no native commit receipt or permission.
    flushSync(() => { const value=controller.getSnapshot();root.render(childOwner?childTree(value):closed(value,generation)); });
    retireAdult();
  }
  const detachBarrier = controller.attachPresentationBarrier(clearPresentation);
  const stopSnapshot = controller.subscribe(() => { void renderCurrent(); });
  async function renderCurrent() {
    if (stopped) return;
    const snapshot = controller.getSnapshot(), context = snapshot.context;
    if (snapshot.phase !== "ready" || snapshot.status === "first-install-required" || snapshot.status === "blocked-child" || !context) {
      // All non-ready publications have already crossed clearPresentation.
      if (snapshot.phase === "ready") { ++generation; activeKey = null; retireAdult(); }
      root.render(childOwner?childTree(snapshot):closed(snapshot,generation));return;
    }
    if (activeKey === context.token) return;
    const attempt = ++generation;
    activeKey = context.token;
    if (snapshot.status === "child") {
      if(!context.profileId){await controller.suspend();return;}
      if(!childOwner||childOwner.profileId!==context.profileId) {
        // A new profile has its own shell, language owner and child state.
        childOwner={key:"native-child-"+attempt,profileId:context.profileId,
          persistence:Object.freeze({initialLanguage:context.locale,persist:async()=>false})};
      }
      locale(context.locale);
      flushSync(()=>{root.render(childTree(snapshot));});
      return;
    }
    if (snapshot.status !== "adult" && snapshot.status !== "unenrolled") return;
    if(childOwner){childOwner=null;flushSync(()=>root.render(closed(snapshot,generation)));}
    let candidate: PlatformServices | null = null;
    try {
      // No static adult imports or provider effects are present in the child
      // branch. A completion for an old context is discarded before mounting.
      const [app, auth, typography, design, history, servicesForAdult] = await Promise.all([
        import("../App"), import("../community/AuthContext"), import("../cms/SiteTypographyRuntime"),
        import("../cms/SiteDesignRuntime"), import("../planet/RecentHistory"), createAdultServices().then(value => {
          // Keep the recipient owned even if another import rejects first.
          if (stopped || generation !== attempt || controller.getSnapshot().context !== context) {
            value.recentHistory?.dispose?.(); value.downloads?.dispose();
            throw new Error("The native adult context has retired.");
          }
          candidate = value;
          return value;
        }),
      ]);
      candidate = servicesForAdult;
      if (stopped || generation !== attempt || controller.getSnapshot().context !== context) {
        candidate.recentHistory?.dispose?.(); candidate.downloads?.dispose(); return;
      }
      adult = candidate;
      languageStatus = createHostLanguageStatus(adult.preferences, adultLanguage, initialization.preference.status === "ready", followsSystem ? adult : undefined);
      const status = languageStatus;
      const persistence: HostLanguagePersistence = Object.freeze({ ...status.persistence,
        persist(next: "ru" | "en") { adultLanguage = next; return status.persistence.persist(next); },
      });
      const App = app.default, AccountlessReaderProvider = auth.AccountlessReaderProvider;
      const SiteTypographyRuntime = typography.default, SiteDesignRuntime = design.default, RecentHistoryProvider = history.RecentHistoryProvider;
      const application = <AppErrorBoundary><App nativeProfileControls={<NativeProfileControls controller={controller} />} /></AppErrorBoundary>;
      locale(adultLanguage);
      root.render(<BootstrapErrorBoundary key={context.token}>
        <PlatformServicesProvider services={adult}>
          <InterfaceLanguageProvider hostLanguage={persistence}>
            <AccountlessReaderProvider>
              <SiteTypographyRuntime /><SiteDesignRuntime /><HostRuntimeStatus controller={status} />
              {adult.recentHistory ? <RecentHistoryProvider store={adult.recentHistory}>{application}</RecentHistoryProvider> : application}
            </AccountlessReaderProvider>
          </InterfaceLanguageProvider>
        </PlatformServicesProvider>
      </BootstrapErrorBoundary>);
    } catch {
      candidate?.recentHistory?.dispose?.(); candidate?.downloads?.dispose();
      if (!stopped && generation === attempt) await controller.suspend();
    }
  }
  // The very first committed tree is sealed; native IO starts after this
  // concrete barrier exists, and no saved browser value can admit an adult.
  flushSync(() => { root.render(closed(controller.getSnapshot(), generation)); });
  void controller.start();
  return Object.freeze({
    async unmount() {
      if (stopped) return;
      clearPresentation();
      await controller.dispose();
      stopped = true; ++generation; stopSnapshot(); detachBarrier(); retireAdult();
      services.recentHistory?.dispose?.(); services.downloads?.dispose();
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
