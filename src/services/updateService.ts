/**
 * App Update Service
 * Handles version checking and update prompts for mobile app
 * 
 * Features:
 * - Check for updates on app start
 * - Compare versions semantically
 * - Download and trigger APK installation
 * - Store last update check timestamp
 */

import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';

// ============================================
// TYPES
// ============================================

export interface VersionManifest {
  latestVersion: string;
  versionCode: number;
  mandatory: boolean;
  minVersion?: string;
  apkUrl: string;
  changelog: string;
  publishedAt: string;
  buildNumber?: number;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  versionCode: number;
  mandatory: boolean;
  minVersionSupported: boolean;
  apkUrl: string;
  changelog: string;
  publishedAt: string;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = 'app_update_info';
const LAST_CHECK_KEY = 'last_update_check';
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
 * Get current app version
 */
export async function getCurrentVersion(): Promise<string> {
  const info = await App.getInfo();
  return info.version;
}

/**
 * Check if we should check for updates (respect interval)
 */
export async function shouldCheckForUpdates(): Promise<boolean> {
  const { value: lastCheckStr } = await Preferences.get({ key: LAST_CHECK_KEY });
  
  if (!lastCheckStr) return true;
  
  const lastCheck = new Date(lastCheckStr).getTime();
  const now = Date.now();
  
  return (now - lastCheck) > CHECK_INTERVAL_MS;
}

/**
 * Check for updates from backend
 */
export async function checkForUpdates(force = false): Promise<UpdateCheckResult | null> {
  try {
    // Check if we should check (unless forced)
    if (!force) {
      const shouldCheck = await shouldCheckForUpdates();
      if (!shouldCheck) {
        console.log('Skipping update check (too soon)');
        return null;
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
      return result.data as UpdateCheckResult;
    }

    return null;
  } catch (error) {
    console.error('Error checking for updates:', error);
    return null;
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
    console.error('Error fetching version manifest:', error);
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
    console.error('Error downloading APK:', error);
    throw error;
  }
}

/**
 * Alternative: Download APK to filesystem (requires Filesystem plugin)
 * This is more complex but provides better UX
 */
export async function downloadApkToStorage(apkUrl: string): Promise<string> {
  // This would require additional Capacitor plugins
  // For now, we use the browser-based approach
  throw new Error('Not implemented - use downloadAndInstall instead');
}

// ============================================
// STORAGE & PREFERENCES
// ============================================

/**
 * Save that user dismissed an update
 */
export async function dismissUpdate(version: string): Promise<void> {
  await Preferences.set({
    key: `${STORAGE_KEY}_dismissed_${version}`,
    value: new Date().toISOString(),
  });
}

/**
 * Check if user dismissed a specific update
 */
export async function isUpdateDismissed(version: string): Promise<boolean> {
  const { value } = await Preferences.get({ 
    key: `${STORAGE_KEY}_dismissed_${version}` 
  });
  return !!value;
}

/**
 * Clear all update preferences
 */
export async function clearUpdatePreferences(): Promise<void> {
  await Preferences.clear();
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize update checker
 * Call this on app start
 */
export async function initializeUpdateChecker(
  onUpdateAvailable?: (update: UpdateCheckResult) => void
): Promise<void> {
  try {
    // Check for updates in background
    const update = await checkForUpdates(false);
    
    if (update && onUpdateAvailable) {
      onUpdateAvailable(update);
    }
  } catch (error) {
    console.error('Failed to initialize update checker:', error);
  }
}
