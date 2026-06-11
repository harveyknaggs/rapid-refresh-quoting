import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
// import { Gate } from './Gate.tsx'; // passcode gate disabled for now — re-wrap <App/> in <Gate> to re-enable
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Service worker removed — with hashed asset filenames it could serve stale/blank pages after a deploy.
// Actively unregister any previously-installed worker and clear its caches so returning users self-heal.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  if (typeof caches !== 'undefined') caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
}
