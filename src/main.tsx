import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ActivityTracker from './community/ActivityTracker';
import ClientDiagnostics from './community/ClientDiagnostics';
import { AuthProvider } from './community/AuthContext';
import AppErrorBoundary from './components/AppErrorBoundary';
import CmsPageReader, { currentCmsPage } from './components/CmsPageReader';
import CmsDirectEditBridge, { prepareCmsEditDocument } from './cms/directEditBridge';
import { InterfaceLanguageProvider } from './i18n/InterfaceLanguage';
import ConnectivityStatus from './mobile/ConnectivityStatus';
import { registerServiceWorker } from './mobile/registerServiceWorker';
import './index.css';

const cmsPage = currentCmsPage();
const cmsEditMode = prepareCmsEditDocument();
// The editor must always compare against the current deployment. A service
// worker inside its iframe could otherwise keep an obsolete visual snapshot.
if (!cmsEditMode) registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InterfaceLanguageProvider>
      <AuthProvider>
        <CmsDirectEditBridge />
        <ActivityTracker />
        <ClientDiagnostics />
        <ConnectivityStatus />
        <AppErrorBoundary>
          {cmsPage ? <CmsPageReader page={cmsPage} /> : <App />}
        </AppErrorBoundary>
      </AuthProvider>
    </InterfaceLanguageProvider>
  </React.StrictMode>
);
