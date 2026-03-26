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

// Registro del ServiceWorker con manejo de errores.
// Solo en producción web (no en runtime nativo), para evitar ruido en logs
// cuando /sw.js no existe o el entorno no soporta SW.
if (
  import.meta.env.PROD &&
  !Capacitor.isNativePlatform() &&
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'serviceWorker' in navigator
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => {
        // Mantenerlo en INFO: no es un error funcional crítico para la app.
        AppLogger.info('ServiceWorker registration failed', { error: String(err) }, 'ServiceWorker');
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
