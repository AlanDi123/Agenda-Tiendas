/**
 * Push Registration Service — sincroniza el token FCM/APNs con el backend
 * tras el login. Solo se ejecuta en plataformas nativas.
 */

import { Capacitor } from '@capacitor/core';
import { apiFetch } from '../config/api';

const TOKEN_KEY = 'lastRegisteredPushToken';

export async function registerDeviceTokenAfterLogin(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const pushMod = await import('@capacitor/push-notifications' as string).catch(() => null);
    const PushNotifications = pushMod?.PushNotifications;
    if (!PushNotifications) return;

    // Pedir permiso de forma diferida (no en splash)
    const { receive } = await PushNotifications.checkPermissions();
    if (receive !== 'granted') return;

    // Obtener token
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Token timeout')), 8000);
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
        } catch {}
        resolve();
      });

      PushNotifications.addListener('registrationError', (err: unknown) => {
        clearTimeout(timeout);
        console.warn('[PushRegistration] Error de registro:', err);
        resolve();
      });

      PushNotifications.register();
    });
  } catch (err) {
    console.warn('[PushRegistration] Error:', err);
  }
}

export async function unregisterDeviceToken(): Promise<void> {
  const lastToken = localStorage.getItem(TOKEN_KEY);
  if (!lastToken) return;
  try {
    await apiFetch('/api/v1/devices/token', {
      method: 'DELETE',
      auth: true,
      json: { token: lastToken },
    });
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}
