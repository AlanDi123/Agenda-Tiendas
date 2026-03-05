/**
 * App Version Routes
 * Handles mobile app version checking
 * Simplified version without database dependency
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';

const router = Router();

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_VERSION = {
  latestVersion: '0.0.1',
  versionCode: 1,
  mandatory: false,
  minVersion: '0.0.1',
  apkUrl: 'https://github.com/AlanDi123/Agenda-Tiendas/releases/latest/download/app-release-signed.apk',
  changelog: 'Initial release',
  publishedAt: new Date().toISOString(),
};

// ============================================
// SCHEMAS
// ============================================

const manifestSchema = z.object({
  latestVersion: z.string(),
  versionCode: z.number().int().positive(),
  mandatory: z.boolean().default(false),
  minVersion: z.string().optional(),
  apkUrl: z.string().url(),
  changelog: z.string(),
  publishedAt: z.string().datetime(),
  buildNumber: z.number().int().positive().optional(),
  commitSha: z.string().optional(),
});

// ============================================
// GET /api/v1/app/version
// ============================================

router.get('/version', async (_req: Request, res: Response, next) => {
  try {
    return res.json({
      success: true,
      data: DEFAULT_VERSION,
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================
// GET /api/v1/app/version/check
// ============================================

router.get('/version/check', async (req: Request, res: Response, next) => {
  try {
    const version = req.query.version as string | undefined;

    if (!version || typeof version !== 'string') {
      throw createError('Missing or invalid version parameter', 400, 'INVALID_VERSION');
    }

    // Compare versions
    const updateAvailable = compareVersions(DEFAULT_VERSION.latestVersion, version) > 0;
    const isMinVersionSupported = !DEFAULT_VERSION.minVersion ||
      compareVersions(version, DEFAULT_VERSION.minVersion) >= 0;

    return res.json({
      success: true,
      data: {
        updateAvailable,
        currentVersion: version,
        latestVersion: DEFAULT_VERSION.latestVersion,
        versionCode: DEFAULT_VERSION.versionCode,
        mandatory: DEFAULT_VERSION.mandatory,
        minVersionSupported: isMinVersionSupported,
        apkUrl: DEFAULT_VERSION.apkUrl,
        changelog: DEFAULT_VERSION.changelog,
        publishedAt: DEFAULT_VERSION.publishedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================
// POST /api/v1/app/version/manifest
// ============================================

router.post('/version/manifest', authMiddleware, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    manifestSchema.parse(req.body);

    // In a full implementation, this would update the database
    // For now, just acknowledge receipt
    res.json({
      success: true,
      message: 'Version manifest received (storage not configured)',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid manifest data', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function compareVersions(v1: string, v2: string): number {
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

export { router as appVersionRoutes };
