import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppLogger } from './services/logger'
import { Capacitor } from '@capacitor/core'

// Llamada SINCRONICA via bridge nativo — antes de que React empiece
// Evita rollback de Capgo por notifyAppReady() tardío
if (Capacitor.isNativePlatform()) {
  try {
    (window as any).Capacitor?.Plugins?.CapacitorUpdater?.notifyAppReady?.();
  } catch (_) {}
  // Fallback import — solo si el bridge directo no está disponible
  import('@capgo/capacitor-updater').then(({ CapacitorUpdater }) => {
    CapacitorUpdater.notifyAppReady().catch(() => {});
  }).catch(() => {});
}

// Global error handler for uncaught errors
window.onerror = (message, source, lineno, colno, error) => {
  AppLogger.log('error', `Global Error: ${message}`, {
    message: String(message),
    source,
    lineno,
    colno,
    stack: error?.stack
  });
  return false; // Let default handler run
};

// Global handler for unhandled promise rejections
window.onunhandledrejection = (event) => {
  AppLogger.log('error', `Unhandled Promise Rejection: ${event.reason}`, event.reason);
};

// Capture uncaught exceptions in React
const originalConsoleError = console.error;
console.error = (...args) => {
  AppLogger.log('error', 'Console Error', args.join(' '));
  originalConsoleError(...args);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
