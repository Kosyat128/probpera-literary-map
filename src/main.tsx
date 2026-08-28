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
import { InterfaceLanguageProvider } from './i18n/InterfaceLanguage';
import ConnectivityStatus from './mobile/ConnectivityStatus';
import { registerServiceWorker } from './mobile/registerServiceWorker';
import { installSafeWebStorage } from './utils/safeWebStorage';
import './index.css';
import './community/community-accessibility.css';
import './styles/stage5-home-art-direction.css';
import './styles/stage5-home-layout.css';

import './styles/stage5-book-shelf.css';
import './styles/stage5f-responsive-accessibility.css';
installSafeWebStorage();

const cmsPage = currentCmsPage();
const cmsEditMode = prepareCmsEditDocument();
// The editor must always compare against the current deployment. A service
// worker inside its iframe could otherwise keep an obsolete visual snapshot.
if (!cmsEditMode) {
  registerServiceWorker();
  startYandexMetrika();
}

function ConsentAwareActivityTracker() {
  const consent = useAnalyticsConsent();
  return consent === 'granted' ? <ActivityTracker /> : null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BootstrapErrorBoundary>
      <InterfaceLanguageProvider>
        <AuthProvider>
          <CmsDirectEditBridge />
          {!cmsEditMode && <AuthTurnstileGate />}
          {!cmsEditMode && <ConsentAwareActivityTracker />}
          {!cmsEditMode && <AnalyticsConsent />}
          <ClientDiagnostics />
          <ConnectivityStatus />
          <AppErrorBoundary>
            {cmsPage ? <CmsPageReader page={cmsPage} /> : <App />}
          </AppErrorBoundary>
        </AuthProvider>
      </InterfaceLanguageProvider>
    </BootstrapErrorBoundary>
  </React.StrictMode>
);
