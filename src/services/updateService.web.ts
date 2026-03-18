/**
 * App Update Service - Web Platform
 * 
 * This module provides dummy implementations for web platforms.
 * Web does not support APK updates, so all functions return
 * safe defaults indicating no updates are available.
 * 
 * IMPORTANT: This file MUST NOT import any Capacitor modules.
 */

import type { VersionManifest, UpdateCheckResult, UpdateCheckResponse } from '../types/update';

/**
 * Compare two semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

/**
 * Check if version1 is newer than version2
 */
export function isNewerVersion(version1: string, version2: string): boolean {
  return compareVersions(version1, version2) > 0;
}

/**
 * Check for updates - Web implementation
 * Always returns no update available since web uses PWA updates
 */
export async function checkForUpdates(_force = false): Promise<UpdateCheckResponse> {
  console.log('[UpdateService.web] Update checks are disabled on web platform');
  return {
    hasUpdate: false,
    platform: 'web',
  };
}

/**
 * Get full version manifest - Web implementation
 * Returns null as web doesn't use APK updates
 */
export async function getVersionManifest(): Promise<VersionManifest | null> {
  console.log('[UpdateService.web] Version manifest not available on web platform');
  return null;
}

/**
 * Download and install APK - Web implementation
 * Throws error as APK installation is not supported on web
 */
export async function downloadAndInstall(
  _apkUrl: string,
  _onProgress?: (percent: number) => void
): Promise<void> {
  throw new Error('APK installation is only supported on Android devices');
}

/**
 * Get current app version - Web implementation
 * Returns the version from package.json or a default
 */
export async function getCurrentVersion(): Promise<string> {
  // Web doesn't have a native version, return a default
  return '0.0.0-web';
}

/**
 * Dismiss update notification - Web implementation
 * No-op on web as updates are handled via service worker
 */
export async function dismissUpdate(_version: string): Promise<void> {
  console.log('[UpdateService.web] Dismissing update (no-op on web)');
}

/**
 * Check if update was dismissed - Web implementation
 * Always returns false on web
 */
export async function isUpdateDismissed(_version: string): Promise<boolean> {
  return false;
}

/**
 * Initialize update checker - Web implementation
 * No-op on web as updates are handled via PWA service worker
 */
export async function initializeUpdateChecker(
  _onUpdateAvailable?: (_update: UpdateCheckResult) => void
): Promise<void> {
  console.log('[UpdateService.web] Update checker not initialized on web platform');
}

/**
 * Clear all update preferences - Web implementation
 * No-op on web
 */
export async function clearUpdatePreferences(): Promise<void> {
  console.log('[UpdateService.web] Clear update preferences (no-op on web)');
}

/**
 * Check if we should check for updates - Web implementation
 * Always returns false on web
 */
export async function shouldCheckForUpdates(): Promise<boolean> {
  return false;
}
