import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ApkInstaller } from '@bixbyte/capacitor-apk-installer';
import type { UpdateCheckResult, UpdateCheckResponse } from '../types/update';

// ─── Configuración GitHub ────────────────────────────────────────────────────
const GITHUB_REPO = 'AlanDi123/Agenda-Tiendas';
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GH_HEADERS = {
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'DommussAgenda-UpdateCheck/1.0',
} as const;
const LAST_CHECK_KEY   = 'update_last_check';
const DISMISSED_PREFIX = 'update_dismissed_';
const CHECK_INTERVAL_MS = 0; // TODO: Volver a poner en 30 * 60 * 1000 en producción

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

// ─── Chequeo de actualización — 100% GitHub Releases ────────────────────────
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

    // Buscar el .apk firmado en los assets del release
    const apkAsset = release.assets?.find(
      (a: { name: string }) =>
        a.name.endsWith('-signed.apk') || a.name.endsWith('.apk')
    );

    const apkUrl: string =
      apkAsset?.browser_download_url ??
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

// ─── Instalador nativo de APK ────────────────────────────────────────────────
export async function downloadAndInstall(
  apkUrl: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  try {
    onProgress?.(5);

    // 1. SOLICITAR PERMISOS TOTALES DE ALMACENAMIENTO
    try {
      const fsPerms = await Filesystem.checkPermissions();
      if (fsPerms.publicStorage !== 'granted') {
        await Filesystem.requestPermissions();
      }
    } catch (e) {
      console.warn('[UpdateService] Ignorando chequeo de almacenamiento (OS limit):', e);
    }

    // 2. SOLICITAR PERMISOS DE INSTALACIÓN
    const installPerm = await ApkInstaller.checkInstallPermission();
    if (!installPerm.hasPermission) {
      await ApkInstaller.requestInstallPermission();
      // Pausa para que Android registre el permiso cuando el usuario vuelve a la app
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    onProgress?.(15);

    // 3. DESCARGA SEGURA
    const fileName = 'agenda-update.apk';

    // Limpiar archivo anterior fallido si existe
    try {
      await Filesystem.deleteFile({ path: fileName, directory: Directory.External });
    } catch { /* no existe, ignorar */ }

    await Filesystem.downloadFile({
      url: apkUrl,
      path: fileName,
      directory: Directory.External,
    });

    onProgress?.(80);

    // 4. VERIFICACIÓN FÍSICA — confirmar que el archivo existe y obtener su ruta real
    const fileStat = await Filesystem.stat({
      directory: Directory.External,
      path: fileName,
    });

    onProgress?.(100);

    // Limpiar prefijo 'file://' que marea al instalador en Xiaomi/Samsung
    const cleanPath = fileStat.uri.replace('file://', '');

    // 5. EJECUTAR INSTALADOR
    await ApkInstaller.installApk({ filePath: cleanPath });

  } catch (err) {
    console.error('[UpdateService] Cancelado o fallido:', err);
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: apkUrl });
    } catch {
      window.open(apkUrl, '_system');
    }
    throw new Error('Permisos insuficientes o error del sistema. Abriendo navegador...');
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
    const updateKeys = [LAST_CHECK_KEY];
    const { value: keys } = await Preferences.get({ key: '_all_keys' }).catch(() => ({ value: null }));
    if (keys) {
      (keys as unknown as string[])
        .filter((k: string) => k.startsWith(DISMISSED_PREFIX) || k === LAST_CHECK_KEY)
        .forEach((k: string) => updateKeys.push(k));
    }
    await Promise.all(
      updateKeys.map((k) =>
        Preferences.remove({ key: k }).catch(() => {
          void 0;
        })
      )
    );
  } catch {
    void 0;
  }
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
      apkUrl: data.assets?.find((a: { name: string }) => a.name.endsWith('.apk'))?.browser_download_url ?? '',
      changelog: data.body ?? '',
      publishedAt: data.published_at ?? new Date().toISOString(),
    };
  } catch { return null; }
}

export async function initializeUpdateChecker(
  onUpdateAvailable: (update: UpdateCheckResult) => void
): Promise<void> {
  try {
    const result = await checkForUpdates(false);
    if (result.hasUpdate && result.updateInfo) {
      const dismissed = await isUpdateDismissed(result.updateInfo.latestVersion);
      if (!dismissed) onUpdateAvailable(result.updateInfo);
    }
  } catch {
    void 0;
  }
}
