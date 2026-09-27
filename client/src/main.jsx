import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
// Fonts ship with the app rather than from a font CDN, so the interface looks
// the same on an air-gapped machine as it does online.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource-variable/orbitron/wght.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './index.css';

// The offline service worker belongs to the built app only. Under the Vite
// dev server it would serve source files from its cache ahead of the edited
// ones, so there any worker left from a build is removed instead.
if ('serviceWorker' in navigator && !import.meta.env.PROD) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
}

// Register Air-Gapped Offline PWA Service Worker
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[WESEE PWA] Offline Service Worker registered, scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[WESEE PWA] Service Worker registration failed:', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* The session sits above the router: the guards inside App read it, and
          a 401 anywhere clears it from here. */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
