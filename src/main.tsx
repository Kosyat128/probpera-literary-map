import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ActivityTracker from './community/ActivityTracker';
import { AuthProvider } from './community/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ActivityTracker />
      <App />
    </AuthProvider>
  </React.StrictMode>
);
