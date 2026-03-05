/**
 * App Update Service - Native Platform (Android/iOS)
 * 
 * This module provides the full implementation for checking and
 * installing app updates on native platforms.
 * 
 * IMPORTANT: This file imports Capacitor modules - it MUST only be
 * loaded on native platforms via dynamic import.
 */

import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';

import type { VersionManifest, UpdateCheckResult, UpdateCheckResponse } from '../types/update';

// ============================================
// CONSTANTS
// ============================================

const LAST_CHECK_KEY = 'last_update_check';
const DISMISSED_KEY_PREFIX = 'update_dismissed_';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============================================
// VERSION COMPARISON
// ============================================

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

// ============================================
// UPDATE CHECKING
// ============================================

/**
 * Get current app version from native app info
 */
export async function getCurrentVersion(): Promise<string> {
  const info = await App.getInfo();
  return info.version;
}

/**
 * Check if we should check for updates (respect interval)
 */
export async function shouldCheckForUpdates(): Promise<boolean> {
  try {
    const { value: lastCheckStr } = await Preferences.get({ key: LAST_CHECK_KEY });

    if (!lastCheckStr) return true;

    const lastCheck = new Date(lastCheckStr).getTime();
    const now = Date.now();

    return (now - lastCheck) > CHECK_INTERVAL_MS;
  } catch {
    // If preferences fail, always check
    return true;
  }
}

/**
 * Check for updates from backend
 */
export async function checkForUpdates(force = false): Promise<UpdateCheckResponse> {
  try {
    // Check if we should check (unless forced)
    if (!force) {
      const shouldCheck = await shouldCheckForUpdates();
      if (!shouldCheck) {
        console.log('[UpdateService.native] Skipping update check (too soon)');
        return {
          hasUpdate: false,
          platform: 'android',
        };
      }
    }

    // Get current version
    const currentVersion = await getCurrentVersion();

    // Call backend API
    const response = await fetch(`${API_BASE_URL}/api/v1/app/version/check?version=${currentVersion}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Update check failed: ${response.status}`);
    }

    const result = await response.json();

    // Save last check timestamp
    await Preferences.set({
      key: LAST_CHECK_KEY,
      value: new Date().toISOString(),
    });

    if (result.success && result.data.updateAvailable) {
      return {
        hasUpdate: true,
        platform: 'android',
        updateInfo: result.data as UpdateCheckResult,
      };
    }

    return {
      hasUpdate: false,
      platform: 'android',
    };
  } catch (error) {
    console.error('[UpdateService.native] Error checking for updates:', error);
    return {
      hasUpdate: false,
      platform: 'android',
    };
  }
}

/**
 * Get full version manifest
 */
export async function getVersionManifest(): Promise<VersionManifest | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/app/version`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      return result.data as VersionManifest;
    }

    return null;
  } catch (error) {
    console.error('[UpdateService.native] Error fetching version manifest:', error);
    return null;
  }
}

// ============================================
// DOWNLOAD & INSTALL
// ============================================

/**
 * Download and install APK
 * Opens the APK URL in browser which triggers download
 * On Android, user can then open the APK to install
 */
export async function downloadAndInstall(apkUrl: string): Promise<void> {
  try {
    // Check if device is Android
    const deviceInfo = await Device.getInfo();

    if (deviceInfo.platform !== 'android') {
      throw new Error('APK installation is only supported on Android');
    }

    // Open APK URL in browser
    // This triggers the download on Android
    await Browser.open({
      url: apkUrl,
      toolbarColor: '#2D3E50',
    });

    // Note: On Android, the user will need to:
    // 1. Wait for download to complete
    // 2. Open the downloaded APK
    // 3. Grant "Install from Unknown Sources" permission if needed
    // 4. Complete installation

  } catch (error) {
    console.error('[UpdateService.native] Error downloading APK:', error);
    throw error;
  }
}

// ============================================
// STORAGE & PREFERENCES
// ============================================

/**
 * Save that user dismissed an update
 */
export async function dismissUpdate(version: string): Promise<void> {
  try {
    await Preferences.set({
      key: `${DISMISSED_KEY_PREFIX}${version}`,
      value: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[UpdateService.native] Error dismissing update:', error);
  }
}

/**
 * Check if user dismissed a specific update
 */
export async function isUpdateDismissed(version: string): Promise<boolean> {
  try {
    const { value } = await Preferences.get({
      key: `${DISMISSED_KEY_PREFIX}${version}`
    });
    return !!value;
  } catch {
    return false;
  }
}

/**
 * Clear all update preferences
 */
export async function clearUpdatePreferences(): Promise<void> {
  try {
    await Preferences.clear();
  } catch (error) {
    console.error('[UpdateService.native] Error clearing update preferences:', error);
  }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize update checker
 * Call this on app start to check for updates in background
 */
export async function initializeUpdateChecker(
  onUpdateAvailable?: (update: UpdateCheckResult) => void
): Promise<void> {
  try {
    // Check for updates in background
    const result = await checkForUpdates(false);

    if (result.hasUpdate && result.updateInfo && onUpdateAvailable) {
      // Check if user dismissed this update
      const dismissed = await isUpdateDismissed(result.updateInfo.latestVersion);
      
      if (!dismissed) {
        onUpdateAvailable(result.updateInfo);
      }
    }
  } catch (error) {
    console.error('[UpdateService.native] Failed to initialize update checker:', error);
  }
}
