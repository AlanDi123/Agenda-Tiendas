/**
 * Push Registration Service — TEMPORALMENTE DESHABILITADO
 *
 * Las llamadas a PushNotifications.register() y requestPermissions() están
 * comentadas mientras se configura google-services.json para Firebase.
 * Esto previene el crash nativo en Android sin Firebase.
 */

// import { Capacitor } from '@capacitor/core';
// import { apiFetch } from '../config/api';

// const TOKEN_KEY = 'lastRegisteredPushToken';

export async function registerDeviceTokenAfterLogin(): Promise<void> {
  // Push notifications deshabilitadas temporalmente.
  // Para activar: configurar google-services.json + descomentar el código.
  //
  // if (!Capacitor.isNativePlatform()) return;
  // const pushMod = await import('@capacitor/push-notifications').catch(() => null);
  // const PushNotifications = pushMod?.PushNotifications;
  // if (!PushNotifications) return;
  // const permResult = await PushNotifications.requestPermissions().catch(() => ({ receive: 'denied' as const }));
  // if (permResult.receive !== 'granted') return;
  // await PushNotifications.register().catch(() => {});
  return;
}

export async function unregisterDeviceToken(): Promise<void> {
  // Deshabilitado junto con el registro.
  return;
}
