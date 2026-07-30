import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ActivityTracker from './community/ActivityTracker';
import { AuthProvider } from './community/AuthContext';
import CmsPageReader, { currentCmsPage } from './components/CmsPageReader';
import { InterfaceLanguageProvider } from './i18n/InterfaceLanguage';
import './index.css';

const cmsPage = currentCmsPage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InterfaceLanguageProvider>
      <AuthProvider>
        <ActivityTracker />
        {cmsPage ? <CmsPageReader page={cmsPage} /> : <App />}
      </AuthProvider>
    </InterfaceLanguageProvider>
  </React.StrictMode>
);
