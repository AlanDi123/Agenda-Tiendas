/**
 * App Update Service - Platform Loader
 * 
 * This module dynamically loads the correct update service
 * based on the current platform (web or native).
 * 
 * IMPORTANT: This file only imports @capacitor/core for platform detection.
 * All Capacitor-specific imports are isolated in updateService.native.ts
 */

import { Capacitor } from '@capacitor/core';

import type { VersionManifest, UpdateCheckResult, UpdateCheckResponse } from '../types/update';

// Cache for the loaded service
let _service: typeof import('./updateService.web') | typeof import('./updateService.native') | null = null;
let _isNative: boolean | null = null;

/**
 * Detect if we're running on a native platform
 * Caches the result to avoid repeated checks
 */
function isNativePlatform(): boolean {
  if (_isNative === null) {
    _isNative = Capacitor.isNativePlatform();
  }
  return _isNative;
}

/**
 * Get the appropriate service for the current platform
 * Uses dynamic imports to avoid bundling native code in web builds
 */
async function getService() {
  if (_service) {
    return _service;
  }

  if (isNativePlatform()) {
    _service = await import('./updateService.native');
  } else {
    _service = await import('./updateService.web');
  }

  return _service;
}

// ============================================
// RE-EXPORTED TYPES
// ============================================

export type { VersionManifest, UpdateCheckResult, UpdateCheckResponse };

// ============================================
// WRAPPER FUNCTIONS
// ============================================

/**
 * Compare two semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export async function compareVersions(v1: string, v2: string): Promise<number> {
  const service = await getService();
  return service.compareVersions(v1, v2);
}

/**
 * Check if version1 is newer than version2
 */
export async function isNewerVersion(version1: string, version2: string): Promise<boolean> {
  const service = await getService();
  return service.isNewerVersion(version1, version2);
}

/**
 * Check for updates from backend
 * On web: always returns no update
 * On native: checks backend and returns update info if available
 */
export async function checkForUpdates(force = false): Promise<UpdateCheckResponse> {
  const service = await getService();
  return service.checkForUpdates(force);
}

/**
 * Get full version manifest
 * On web: returns null
 * On native: fetches manifest from backend
 */
export async function getVersionManifest(): Promise<VersionManifest | null> {
  const service = await getService();
  return service.getVersionManifest();
}

/**
 * Download and install APK
 * On web: throws error (not supported)
 * On native: opens browser to download APK
 */
export async function downloadAndInstall(apkUrl: string, onProgress?: (percent: number) => void): Promise<void> {
  const service = await getService();
  return service.downloadAndInstall(apkUrl, onProgress);
}

/**
 * Get current app version
 * On web: returns '0.0.0-web'
 * On native: returns app version from native info
 */
export async function getCurrentVersion(): Promise<string> {
  const service = await getService();
  return service.getCurrentVersion();
}

/**
 * Dismiss update notification
 * On web: no-op
 * On native: saves to Preferences
 */
export async function dismissUpdate(version: string): Promise<void> {
  const service = await getService();
  return service.dismissUpdate(version);
}

/**
 * Check if update was dismissed
 * On web: always returns false
 * On native: checks Preferences
 */
export async function isUpdateDismissed(version: string): Promise<boolean> {
  const service = await getService();
  return service.isUpdateDismissed(version);
}

/**
 * Initialize update checker
 * Call this on app start to check for updates in background
 * On web: no-op
 * On native: checks for updates and calls callback if available
 */
export async function initializeUpdateChecker(
  onUpdateAvailable?: (update: UpdateCheckResult) => void
): Promise<void> {
  const service = await getService();
  return service.initializeUpdateChecker(onUpdateAvailable);
}

/**
 * Clear all update preferences
 * On web: no-op
 * On native: clears Preferences
 */
export async function clearUpdatePreferences(): Promise<void> {
  const service = await getService();
  return service.clearUpdatePreferences();
}

/**
 * Check if we should check for updates (respect interval)
 * On web: always returns false
 * On native: checks last check timestamp
 */
export async function shouldCheckForUpdates(): Promise<boolean> {
  const service = await getService();
  return service.shouldCheckForUpdates();
}
