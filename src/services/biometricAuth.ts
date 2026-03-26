import { Capacitor } from '@capacitor/core';

const SERVER_KEY = 'dommuss-agenda';
const BIOMETRIC_ENABLED_KEY = 'biometricLoginEnabled';

export function isBiometricEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
}

export function setBiometricEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function canUseBiometric(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    const result = await NativeBiometric.isAvailable();
    return !!result.isAvailable;
  } catch {
    return false;
  }
}

export async function saveBiometricCredentials(email: string, password: string): Promise<void> {
  const { NativeBiometric } = await import('capacitor-native-biometric');
  await NativeBiometric.setCredentials({
    username: email,
    password,
    server: SERVER_KEY,
  });
}

export async function hasBiometricCredentials(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    const creds = await NativeBiometric.getCredentials({ server: SERVER_KEY });
    return !!creds?.username && !!creds?.password;
  } catch {
    return false;
  }
}

export async function clearBiometricCredentials(): Promise<void> {
  const { NativeBiometric } = await import('capacitor-native-biometric');
  await NativeBiometric.deleteCredentials({
    server: SERVER_KEY,
  });
}

export async function loginWithBiometricPrompt(): Promise<{ email: string; password: string }> {
  const { NativeBiometric } = await import('capacitor-native-biometric');
  await NativeBiometric.verifyIdentity({
    title: 'Ingresar a Dommuss Agenda',
    subtitle: 'Usá tu huella o biometría',
    description: 'Confirmá tu identidad para completar el inicio de sesión',
  });
  const creds = await NativeBiometric.getCredentials({ server: SERVER_KEY });
  return { email: creds.username, password: creds.password };
}

