
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './contexts/AppProvider';
import { ToastProvider } from './hooks/useToast';
import { getBackendUrl } from './services/apiConfig';

// Profile service configuration
const profileServiceUrl = getBackendUrl();
const profileServiceToken = (import.meta.env.VITE_PROFILE_API_TOKEN || process.env.PROFILE_API_TOKEN || '').trim();

const profileServiceConfig = {
  baseUrl: profileServiceUrl,
  token: profileServiceToken || undefined,
};

// Temporary buildProfileFile function - will be replaced with proper implementation from App
const buildProfileFile = () => ({});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <AppProvider profileServiceConfig={profileServiceConfig} buildProfileFile={buildProfileFile}>
        <App />
      </AppProvider>
    </ToastProvider>
  </React.StrictMode>
);
