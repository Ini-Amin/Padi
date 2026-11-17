import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { daftarkanServiceWorker } from './pwa';
import './style.css';

// PWA: daftarkan service worker di build produksi saja (pwa.ts menjaga
// lingkungan tanpa service worker, dev server dan test tidak terpengaruh).
void daftarkanServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
