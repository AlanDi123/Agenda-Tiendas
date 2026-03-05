/**
 * Update Service Types
 * Shared types for app update functionality
 */

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

export interface UpdateCheckResponse {
  hasUpdate: boolean;
  platform: 'web' | 'android' | 'ios';
  updateInfo?: UpdateCheckResult;
}
