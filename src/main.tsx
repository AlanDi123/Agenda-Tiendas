import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppLogger } from './services/logger'
import { Capacitor } from '@capacitor/core'

// notifyAppReady SINCRONICO via bridge — debe correr antes que cualquier render
// Evita el rollback automático de Capgo si aún está instalado
if (Capacitor.isNativePlatform()) {
  try {
    (window as any).Capacitor?.Plugins?.CapacitorUpdater?.notifyAppReady?.();
  } catch (_) {}
  import('@capgo/capacitor-updater')
    .then(({ CapacitorUpdater }) => CapacitorUpdater.notifyAppReady().catch(() => {}))
    .catch(() => {});
}

// Global error handlers — AppLogger ya usa referencias nativas, sin loop
window.onerror = (message, source, lineno, colno, error) => {
  AppLogger.log('error', `Global Error: ${message}`, {
    message: String(message),
    source,
    lineno,
    colno,
    stack: error?.stack
  });
  return false;
};

window.onunhandledrejection = (event) => {
  AppLogger.log('error', `Unhandled Promise Rejection: ${event.reason}`, event.reason);
};

// NO patchear console.error — AppLogger ya lo maneja internamente con referencias nativas

// Registro del ServiceWorker con manejo de errores
// VitePWA genera un registro inline que puede disparar "Unhandled Promise Rejection"
// si /sw.js no responde. Para evitarlo, registramos nosotros con .catch().
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => {
        // Usar INFO para no ensuciar el registro de errores como si fuera un fallo crítico
        AppLogger.info('ServiceWorker registration failed', { error: String(err) }, 'ServiceWorker');
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
