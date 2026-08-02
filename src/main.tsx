import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ActivityTracker from './community/ActivityTracker';
import ClientDiagnostics from './community/ClientDiagnostics';
import { AuthProvider } from './community/AuthContext';
import AppErrorBoundary from './components/AppErrorBoundary';
import CmsPageReader, { currentCmsPage } from './components/CmsPageReader';
import { InterfaceLanguageProvider } from './i18n/InterfaceLanguage';
import ConnectivityStatus from './mobile/ConnectivityStatus';
import { registerServiceWorker } from './mobile/registerServiceWorker';
import './index.css';

const cmsPage = currentCmsPage();
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InterfaceLanguageProvider>
      <AuthProvider>
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
