import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import type { UpdateCheckResult, UpdateCheckResponse } from '../types/update';

// ─── Configuración ──────────────────────────────────────────────────────────
const GITHUB_REPO = 'AlanDi123/Agenda-Tiendas';
const GH_HEADERS = {
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'DommussAgenda-UpdateCheck/1.0',
} as const;
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const LAST_CHECK_KEY = 'update_last_check';
const DISMISSED_PREFIX = 'update_dismissed_';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

// ─── Helpers de versión ──────────────────────────────────────────────────────
export function compareVersions(v1: string, v2: string): number {
  const p1 = v1.replace(/^v/, '').split('.').map(Number);
  const p2 = v2.replace(/^v/, '').split('.').map(Number);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const a = p1[i] ?? 0, b = p2[i] ?? 0;
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

// ─── Chequeo de actualización vía GitHub Releases ───────────────────────────
export async function checkForUpdates(force = false): Promise<UpdateCheckResponse> {
  try {
    if (!force) {
      const { value: lastCheck } = await Preferences.get({ key: LAST_CHECK_KEY });
      if (lastCheck && Date.now() - new Date(lastCheck).getTime() < CHECK_INTERVAL_MS) {
        return { hasUpdate: false, platform: 'android' };
      }
    }

    const currentVersion = await getCurrentVersion();

    const response = await fetch(GITHUB_RELEASES_API, {
      headers: { ...GH_HEADERS },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn('[UpdateService] GitHub API error:', response.status);
      return { hasUpdate: false, platform: 'android' };
    }

    const release = await response.json();
    await Preferences.set({ key: LAST_CHECK_KEY, value: new Date().toISOString() });

    const latestVersion: string = release.tag_name?.replace(/^v/, '') ?? '0.0.0';

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      return { hasUpdate: false, platform: 'android' };
    }

    const apkAsset = release.assets?.find(
      (a: any) => a.name.endsWith('.apk') || a.name.endsWith('-signed.apk')
    );

    const apkUrl: string = apkAsset?.browser_download_url ??
      `https://github.com/${GITHUB_REPO}/releases/download/v${latestVersion}/app-release-signed.apk`;

    const updateInfo: UpdateCheckResult = {
      latestVersion,
      currentVersion,
      updateAvailable: true,
      apkUrl,
      changelog: release.body
        ? release.body.replace(/#+\s/g, '').replace(/\*\*/g, '').slice(0, 300)
        : `Versión ${latestVersion} disponible`,
      mandatory: release.body?.includes('[MANDATORY]') ?? false,
      publishedAt: release.published_at ?? new Date().toISOString(),
      versionCode: 0,
      minVersionSupported: true,
    };

    return { hasUpdate: true, platform: 'android', updateInfo };
  } catch (err) {
    console.warn('[UpdateService] checkForUpdates failed:', err);
    return { hasUpdate: false, platform: 'android' };
  }
}

// ─── Instalar actualización ──────────────────────────────────────────────────
export async function downloadAndInstall(
  apkUrl: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  onProgress?.(10);
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: apkUrl });
    onProgress?.(100);
  } catch {
    window.open(apkUrl, '_system');
    onProgress?.(100);
  }
}

// ─── Dismiss ─────────────────────────────────────────────────────────────────
export async function dismissUpdate(version: string): Promise<void> {
  await Preferences.set({
    key: `${DISMISSED_PREFIX}${version}`,
    value: new Date().toISOString(),
  }).catch(() => {});
}

export async function isUpdateDismissed(version: string): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: `${DISMISSED_PREFIX}${version}` });
    return !!value;
  } catch { return false; }
}

export async function clearUpdatePreferences(): Promise<void> {
  try {
    await Preferences.clear();
  } catch {}
}

export async function shouldCheckForUpdates(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: LAST_CHECK_KEY });
    if (!value) return true;
    return (Date.now() - new Date(value).getTime()) > CHECK_INTERVAL_MS;
  } catch { return true; }
}

export async function getVersionManifest(): Promise<import('../types/update').VersionManifest | null> {
  try {
    const res = await fetch(GITHUB_RELEASES_API, {
      headers: { ...GH_HEADERS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      latestVersion: data.tag_name?.replace(/^v/, '') ?? '0.0.0',
      versionCode: 0,
      mandatory: false,
      minVersion: '0.0.0',
      apkUrl: data.assets?.[0]?.browser_download_url ?? '',
      changelog: data.body ?? '',
      publishedAt: data.published_at ?? new Date().toISOString(),
    };
  } catch { return null; }
}

// ─── Inicialización ──────────────────────────────────────────────────────────
export async function initializeUpdateChecker(
  onUpdateAvailable: (update: UpdateCheckResult) => void
): Promise<void> {
  try {
    const result = await checkForUpdates(false);
    if (result.hasUpdate && result.updateInfo) {
      const dismissed = await isUpdateDismissed(result.updateInfo.latestVersion);
      if (!dismissed) onUpdateAvailable(result.updateInfo);
    }
  } catch {}
}
