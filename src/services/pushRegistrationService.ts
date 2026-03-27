/**
 * Push Registration Service — sincroniza el token FCM/APNs con el backend.
 *
 * IMPORTANTE: Solo funciona cuando Firebase (google-services.json) está
 * configurado en el proyecto Android.  Sin esa configuración, el plugin
 * de push notifications devuelve un error de registro que se captura y se
 * ignora silenciosamente — NUNCA se deja propagar para evitar crashes.
 */

import { Capacitor } from '@capacitor/core';
import { apiFetch } from '../config/api';

const TOKEN_KEY = 'lastRegisteredPushToken';
const PUSH_FAILED_KEY = 'pushRegFailed';

/** Marca la sesión actual como "fallida" para no reintentar y crashear. */
function markFailed(): void {
  try { sessionStorage.setItem(PUSH_FAILED_KEY, '1'); } catch {}
}
function hasFailed(): boolean {
  try { return !!sessionStorage.getItem(PUSH_FAILED_KEY); } catch { return false; }
}

export async function registerDeviceTokenAfterLogin(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (hasFailed()) return; // ya falló antes en esta sesión, no reintentar

  // Timeout global: si tarda más de 10s, abortamos silenciosamente
  await Promise.race([
    _doRegister(),
    new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
  ]).catch(() => { markFailed(); });
}

async function _doRegister(): Promise<void> {
  try {
    const pushMod = await import('@capacitor/push-notifications').catch(() => null);
    const PushNotifications = pushMod?.PushNotifications;
    if (!PushNotifications) return;

    // Pedir permiso explícitamente (muestra diálogo en Android 13+)
    // En versiones anteriores devuelve 'granted' automáticamente
    const permResult = await PushNotifications.requestPermissions().catch(
      () => ({ receive: 'denied' as const })
    );
    if (permResult.receive !== 'granted') return;

    // Registrar con timeout de 8s por si Firebase no está configurado
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 8_000); // no rechaza, solo resuelve

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
        } catch { /* registro falló: se reintentará al próximo login */ }

        resolve();
      }).catch(() => { clearTimeout(timeout); resolve(); });

      PushNotifications.addListener('registrationError', (err: unknown) => {
        clearTimeout(timeout);
        console.warn('[PushRegistration] Error de registro (Firebase no configurado?):', err);
        markFailed(); // no intentar de nuevo en esta sesión
        resolve();
      }).catch(() => { clearTimeout(timeout); resolve(); });

      PushNotifications.register().catch((err: unknown) => {
        clearTimeout(timeout);
        console.warn('[PushRegistration] register() falló:', err);
        markFailed();
        resolve();
      });
    });
  } catch (err) {
    console.warn('[PushRegistration] Error inesperado:', err);
    markFailed();
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
