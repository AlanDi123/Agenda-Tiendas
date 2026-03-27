/**
 * Push Registration Service — DESACTIVADO
 * Requiere google-services.json en la carpeta android/ para funcionar.
 * Sin ese archivo, la app crashea con IllegalStateException al iniciar Firebase.
 */

export async function registerDeviceTokenAfterLogin(): Promise<void> {
  console.warn('[Push] Registro Push desactivado temporalmente por falta de google-services.json');
  return;
}

export async function unregisterDeviceToken(): Promise<void> {
  return;
}
