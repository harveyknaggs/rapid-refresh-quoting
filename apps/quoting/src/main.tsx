import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { Gate } from './Gate.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Gate>
      <App />
    </Gate>
  </React.StrictMode>,
);

// Register the service worker in production builds only (avoids dev caching surprises).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
