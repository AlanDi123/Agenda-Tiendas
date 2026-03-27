/**
 * Push Registration Service — Registro seguro con manejo de errores robusto.
 * Si Firebase no está configurado, la app sigue funcionando sin push.
 */

import { Capacitor } from '@capacitor/core';
import { apiFetch } from '../config/api';

const TOKEN_KEY = 'lastRegisteredPushToken';

export async function registerDeviceTokenAfterLogin(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const pushMod = await import('@capacitor/push-notifications').catch(() => null);
    const PushNotifications = pushMod?.PushNotifications;
    if (!PushNotifications) return;

    const permStatus = await PushNotifications.checkPermissions().catch(
      () => ({ receive: 'denied' as const })
    );

    if (permStatus.receive === 'prompt') {
      const result = await PushNotifications.requestPermissions().catch(
        () => ({ receive: 'denied' as const })
      );
      if (result.receive !== 'granted') return;
    } else if (permStatus.receive !== 'granted') {
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 8_000);

      PushNotifications.addListener('registration', async (token: { value: string }) => {
        clearTimeout(timeout);
        const fcmToken = token.value;
        const lastToken = localStorage.getItem(TOKEN_KEY);
        if (lastToken === fcmToken) { resolve(); return; }

        try {
          const res = await apiFetch('/api/v1/devices/token', {
            method: 'POST',
            auth: true,
            json: {
              token: fcmToken,
              platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
              deviceId: `${Capacitor.getPlatform()}-${Date.now()}`,
            },
          });
          if (res.ok) localStorage.setItem(TOKEN_KEY, fcmToken);
        } catch {
          // Fallo de registro silencioso: se reintentará al próximo login
        }
        resolve();
      }).catch(() => { clearTimeout(timeout); resolve(); });

      PushNotifications.addListener('registrationError', (err: unknown) => {
        clearTimeout(timeout);
        console.warn('[PushRegistration] Firebase no configurado o error de registro:', err);
        resolve();
      }).catch(() => { clearTimeout(timeout); resolve(); });

      PushNotifications.register().catch((err: unknown) => {
        clearTimeout(timeout);
        console.warn('[PushRegistration] register() falló:', err);
        resolve();
      });
    });
  } catch (err) {
    console.warn('[PushRegistration] Error inesperado (no bloqueante):', err);
  }
}

export async function unregisterDeviceToken(): Promise<void> {
  localStorage.removeItem(TOKEN_KEY);
}
