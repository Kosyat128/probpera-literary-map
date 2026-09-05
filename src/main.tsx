import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ActivityTracker from './community/ActivityTracker';
import AuthTurnstileGate from './community/AuthTurnstileGate';
import ClientDiagnostics from './community/ClientDiagnostics';
import { AuthProvider } from './community/AuthContext';
import AppErrorBoundary from './components/AppErrorBoundary';
import BootstrapErrorBoundary from './components/BootstrapErrorBoundary';
import { startYandexMetrika } from './analytics/yandexMetrika';
import AnalyticsConsent from './analytics/AnalyticsConsent';
import { useAnalyticsConsent } from './analytics/useAnalyticsConsent';
import CmsPageReader, { currentCmsPage } from './components/CmsPageReader';
import CmsDirectEditBridge, { prepareCmsEditDocument } from './cms/directEditBridge';
import SiteDesignRuntime from './cms/SiteDesignRuntime';
import SiteTypographyRuntime from './cms/SiteTypographyRuntime';
import { InterfaceLanguageProvider, useInterfaceLanguage } from './i18n/InterfaceLanguage';
import PublicLocaleMetadata from './i18n/PublicLocaleMetadata';
import ConnectivityStatus from './mobile/ConnectivityStatus';
import { registerServiceWorker } from './mobile/registerServiceWorker';
import { installSafeWebStorage } from './utils/safeWebStorage';
import { PlatformServicesProvider } from './platform/PlatformServices';
import { createWebPlatformAdapter } from './platform/adapters/web/WebPlatformAdapter';
import { isControlledWebEdition } from './platform/distribution';
import { createPwaLicenseRuntime } from './pwa/PwaLicenseRuntime';
import PwaEdition from './pwa/PwaEdition';
import PwaLocaleMetadata from './pwa/PwaLocaleMetadata';
import PwaConnectivity from './pwa/PwaConnectivity';
import { registerPwaWorker } from './pwa/registerPwaWorker';
import { planetAccountRoute, type PlanetAccountMode } from './pwa/accountRoutes';
import { planetAccountCopy } from './pwa/accountCopy';
import './pwa/pwa.css';
import './styles/editorial-fonts.css';
import './index.css';
import './community/community-accessibility.css';
import './styles/stage5-home-art-direction.css';
import './styles/stage5-home-layout.css';

import './styles/stage5-book-shelf.css';
import './styles/stage5f-responsive-accessibility.css';
import './styles/book-dossier.css';
import './styles/editorial-card-layout.css';
import './styles/community-editorial-layout.css';
import './styles/calendar-layout.css';
import './styles/navigation-panels.css';
import './styles/atlas-intro-layout.css';
import './styles/site-typography.css';
import './styles/header-preserved.css';
installSafeWebStorage();
const PlanetAccountPage = React.lazy(() => import('./pwa/PlanetAccountPage'));
const platformServices = createWebPlatformAdapter();
const localQa = __LITERARY_PLANET_LOCAL_QA__ && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const pwaRuntime = isControlledWebEdition ? createPwaLicenseRuntime({
  authority: __LITERARY_PLANET_LOCAL_QA__ && !localQa ? null : __LITERARY_PLANET_LICENSE_AUTHORITY__,
  origin: window.location.origin,
  storage: window.localStorage,
  allowLocalQa: localQa,
}) : null;
const pwaWorker = isControlledWebEdition ? registerPwaWorker({ controlledDistribution: true, allowLocalQa: localQa }) : null;
if (isControlledWebEdition && __LITERARY_PLANET_LOCAL_QA__ && localQa) {
  void import('./pwa/qaSceneProbe').then(({ installPwaSceneProbe }) => installPwaSceneProbe(window));
}

const accountMode = isControlledWebEdition ? null : planetAccountRoute(window.location.pathname);
const publicContent = !isControlledWebEdition && !accountMode;
const cmsPage = publicContent ? currentCmsPage() : null;
const cmsEditMode = publicContent ? prepareCmsEditDocument() : false;
// The editor must always compare against the current deployment. A service
// worker inside its iframe could otherwise keep an obsolete visual snapshot.
if (publicContent && !cmsEditMode) {
  registerServiceWorker();
  startYandexMetrika();
}

function ConsentAwareActivityTracker() {
  const consent = useAnalyticsConsent();
  return consent === 'granted' ? <ActivityTracker /> : null;
}

function AccountEntry({ mode }: { mode: PlanetAccountMode }) {
  const { language } = useInterfaceLanguage();
  return <React.Suspense fallback={<main className="pwa-access"><p role="status">{planetAccountCopy.locales[language].loadingAccount}</p></main>}>
    <PlanetAccountPage mode={mode} />
  </React.Suspense>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BootstrapErrorBoundary>
      <PlatformServicesProvider services={platformServices}>
        <InterfaceLanguageProvider>
          {isControlledWebEdition && <PwaLocaleMetadata />}
          {!isControlledWebEdition && <PublicLocaleMetadata />}
          <AuthProvider>
            {!accountMode && <SiteTypographyRuntime />}
            {!accountMode && <SiteDesignRuntime />}
            {publicContent && <CmsDirectEditBridge />}
            {!isControlledWebEdition && !cmsEditMode && <AuthTurnstileGate />}
            {publicContent && !cmsEditMode && <ConsentAwareActivityTracker />}
            {publicContent && !cmsEditMode && <AnalyticsConsent />}
            {publicContent && <ClientDiagnostics />}
            {pwaWorker ? <PwaConnectivity controller={pwaWorker} /> : <ConnectivityStatus />}
            <AppErrorBoundary>
              {accountMode ? <AccountEntry mode={accountMode} /> : pwaRuntime ? <PwaEdition runtime={pwaRuntime}><App /></PwaEdition>
                : cmsPage ? <CmsPageReader page={cmsPage} /> : <App />}
            </AppErrorBoundary>
          </AuthProvider>
        </InterfaceLanguageProvider>
      </PlatformServicesProvider>
    </BootstrapErrorBoundary>
  </React.StrictMode>
);
