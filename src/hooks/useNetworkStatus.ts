import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Estado de red: eventos del navegador + @capacitor/network en nativo (si está disponible).
 */
export function useNetworkStatus(): boolean {
  const [connected, setConnected] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine
  );

  useEffect(() => {
    const syncFromNavigator = () => {
      setConnected(navigator.onLine);
    };

    window.addEventListener('online', syncFromNavigator);
    window.addEventListener('offline', syncFromNavigator);

    let removeCapListener: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      void import('@capacitor/network')
        .then(({ Network }) =>
          Network.addListener('networkStatusChange', (status) => {
            setConnected(status.connected);
          }).then((handle) => {
            removeCapListener = () => {
              void handle.remove();
            };
          })
        )
        .catch(() => {
          /* plugin missing — navigator events suffice */
        });

      void import('@capacitor/network')
        .then(({ Network }) => Network.getStatus())
        .then((status) => setConnected(status.connected))
        .catch(syncFromNavigator);
    }

    return () => {
      window.removeEventListener('online', syncFromNavigator);
      window.removeEventListener('offline', syncFromNavigator);
      removeCapListener?.();
    };
  }, []);

  return connected;
}
