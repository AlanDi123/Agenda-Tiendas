import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import type { VersionManifest, UpdateCheckResult, UpdateCheckResponse } from '../types/update';

const DISMISSED_KEY_PREFIX = 'update_dismissed_';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
const LAST_CHECK_KEY = 'last_update_check';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const a = p1[i] || 0, b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export function isNewerVersion(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) > 0;
}

export async function getCurrentVersion(): Promise<string> {
  try {
    const info = await App.getInfo();
    return info.version;
  } catch {
    return '0.0.0';
  }
}

export async function shouldCheckForUpdates(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: LAST_CHECK_KEY });
    if (!value) return true;
    return (Date.now() - new Date(value).getTime()) > CHECK_INTERVAL_MS;
  } catch { return true; }
}

export async function getVersionManifest(): Promise<VersionManifest | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/app/version`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.data : null;
  } catch { return null; }
}

export async function checkForUpdates(force = false): Promise<UpdateCheckResponse> {
  try {
    if (!force) {
      const should = await shouldCheckForUpdates();
      if (!should) return { hasUpdate: false, platform: 'android' };
    }

    const currentVersion = await getCurrentVersion();
    const res = await fetch(`${API_BASE_URL}/api/v1/app/version/check?version=${currentVersion}`);
    if (!res.ok) return { hasUpdate: false, platform: 'android' };

    const data = await res.json();
    await Preferences.set({ key: LAST_CHECK_KEY, value: new Date().toISOString() });

    if (data.success && data.data.updateAvailable) {
      return { hasUpdate: true, platform: 'android', updateInfo: data.data as UpdateCheckResult };
    }
    return { hasUpdate: false, platform: 'android' };
  } catch {
    return { hasUpdate: false, platform: 'android' };
  }
}

export async function dismissUpdate(version: string): Promise<void> {
  try {
    await Preferences.set({ key: `${DISMISSED_KEY_PREFIX}${version}`, value: new Date().toISOString() });
  } catch {}
}

export async function isUpdateDismissed(version: string): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: `${DISMISSED_KEY_PREFIX}${version}` });
    return !!value;
  } catch { return false; }
}

export async function clearUpdatePreferences(): Promise<void> {
  try { await Preferences.clear(); } catch {}
}

/**
 * Descarga el bundle JS/CSS/HTML desde GitHub Releases y lo aplica en caliente.
 * onProgress: callback con porcentaje 0-100
 */
export async function downloadAndInstall(
  bundleUrl: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  onProgress?.(0);

  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  
  const bundle = await CapacitorUpdater.download({
    url: bundleUrl,
    version: String(Date.now()),
  });
  onProgress?.(80);
  
  await CapacitorUpdater.set(bundle);
  onProgress?.(100);
  
  await CapacitorUpdater.reload();
}

export async function initializeUpdateChecker(
  onUpdateAvailable?: (update: UpdateCheckResult) => void
): Promise<void> {
  try {
    const result = await checkForUpdates(false);
    if (result.hasUpdate && result.updateInfo && onUpdateAvailable) {
      const dismissed = await isUpdateDismissed(result.updateInfo.latestVersion);
      if (!dismissed) onUpdateAvailable(result.updateInfo);
    }
  } catch {}
}
