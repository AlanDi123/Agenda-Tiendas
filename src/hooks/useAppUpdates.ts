/**
 * useAppUpdates Hook
 * 
 * React hook for managing app update checks and update modal state.
 * Handles initialization of the update checker and provides
 * methods to dismiss and install updates.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { UpdateCheckResult } from '../types/update';
import {
  initializeUpdateChecker,
  dismissUpdate as dismissUpdateService,
  downloadAndInstall as downloadAndInstallService,
} from '../services/updateService';

interface UseAppUpdatesReturn {
  /** Current update info if available */
  updateInfo: UpdateCheckResult | null;
  /** Whether an update is available */
  hasUpdate: boolean;
  /** Whether the update is mandatory */
  isMandatory: boolean;
  /** Whether currently checking for updates */
  checking: boolean;
  /** Whether currently downloading/installing update */
  downloading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manually check for updates */
  checkForUpdate: () => Promise<void>;
  /** Dismiss the current update */
  dismissUpdate: () => Promise<void>;
  /** Download and install the current update */
  installUpdate: () => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
}

/**
 * Hook for managing app updates
 */
export function useAppUpdates(): UseAppUpdatesReturn {
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if initialization has been done
  const initializedRef = useRef(false);

  /**
   * Handle update available callback
   */
  const handleUpdateAvailable = useCallback((update: UpdateCheckResult) => {
    setUpdateInfo(update);
    setChecking(false);
  }, []);

  /**
   * Initialize update checker on mount
   */
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Initialize in background without blocking UI
    initializeUpdateChecker(handleUpdateAvailable).catch((err) => {
      console.error('[useAppUpdates] Failed to initialize:', err);
    });
  }, [handleUpdateAvailable]);

  /**
   * Manually check for updates
   */
  const checkForUpdate = useCallback(async () => {
    setChecking(true);
    setError(null);

    try {
      const { checkForUpdates } = await import('../services/updateService');
      const result = await checkForUpdates(true);

      if (result.hasUpdate && result.updateInfo) {
        setUpdateInfo(result.updateInfo);
      } else {
        setUpdateInfo(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error checking for updates');
      setUpdateInfo(null);
    } finally {
      setChecking(false);
    }
  }, []);

  /**
   * Dismiss the current update
   */
  const dismissUpdate = useCallback(async () => {
    if (!updateInfo) return;

    try {
      await dismissUpdateService(updateInfo.latestVersion);
      setUpdateInfo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error dismissing update');
    }
  }, [updateInfo]);

  /**
   * Download and install the current update
   */
  const installUpdate = useCallback(async () => {
    if (!updateInfo) return;

    setDownloading(true);
    setError(null);

    try {
      await downloadAndInstallService(updateInfo.apkUrl);
      // Dismiss the update after successful download initiation
      await dismissUpdateService(updateInfo.latestVersion);
      setUpdateInfo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error installing update');
    } finally {
      setDownloading(false);
    }
  }, [updateInfo]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    updateInfo,
    hasUpdate: !!updateInfo,
    isMandatory: updateInfo?.mandatory ?? false,
    checking,
    downloading,
    error,
    checkForUpdate,
    dismissUpdate,
    installUpdate,
    clearError,
  };
}
