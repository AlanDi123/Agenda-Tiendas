/**
 * App Version Routes
 * Handles mobile app version checking and manifest serving
 * 
 * Endpoints:
 * GET /api/v1/app/version - Get latest version manifest
 * POST /api/v1/app/version/manifest - Update manifest (admin only)
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import prisma from '../lib/prisma';
import { z } from 'zod';

const router = Router();

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
// Get latest version manifest
// ============================================
router.get('/version', async (_req: Request, res: Response, next) => {
  try {
    // Option 1: Read from database (if stored there)
    const manifest = await prisma.appVersion.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (manifest) {
      return res.json({
        success: true,
        data: {
          latestVersion: manifest.latestVersion,
          versionCode: manifest.versionCode,
          mandatory: manifest.mandatory,
          minVersion: manifest.minVersion,
          apkUrl: manifest.apkUrl,
          changelog: manifest.changelog,
          publishedAt: manifest.publishedAt,
          buildNumber: manifest.buildNumber,
        },
      });
    }

    // Option 2: Read from static file (fallback)
    // In production, this would be served from a CDN or S3
    const defaultManifest = {
      latestVersion: '0.0.1',
      versionCode: 1,
      mandatory: false,
      minVersion: '0.0.1',
      apkUrl: 'https://github.com/AlanDi123/Agenda-Tiendas/releases/latest/download/app-release-signed.apk',
      changelog: 'Initial release',
      publishedAt: new Date().toISOString(),
    };

    return res.json({
      success: true,
      data: defaultManifest,
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================
// GET /api/v1/app/version/check
// Check if update is available for specific version
// Query params: version (current app version)
// ============================================
router.get('/version/check', async (_req: Request, res: Response, next) => {
  try {
    const version = _req.query.version as string | undefined;

    if (!version || typeof version !== 'string') {
      throw createError('Missing or invalid version parameter', 400, 'INVALID_VERSION');
    }

    // Get latest manifest
    const manifest = await prisma.appVersion.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!manifest) {
      return res.json({
        success: true,
        data: {
          updateAvailable: false,
          currentVersion: version,
        },
      });
    }

    // Compare versions
    const updateAvailable = compareVersions(manifest.latestVersion, version) > 0;
    const isMinVersionSupported = !manifest.minVersion ||
      compareVersions(version, manifest.minVersion) >= 0;

    return res.json({
      success: true,
      data: {
        updateAvailable,
        currentVersion: version,
        latestVersion: manifest.latestVersion,
        versionCode: manifest.versionCode,
        mandatory: manifest.mandatory,
        minVersionSupported: isMinVersionSupported,
        apkUrl: manifest.apkUrl,
        changelog: manifest.changelog,
        publishedAt: manifest.publishedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================
// POST /api/v1/app/version/manifest
// Update version manifest (admin only)
// Called by CI/CD pipeline after release
// ============================================
router.post('/version/manifest', authMiddleware, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const manifestData = manifestSchema.parse(req.body);

    // Deactivate previous manifests
    await prisma.appVersion.updateMany({
      where: { active: true },
      data: { active: false },
    });

    // Create new manifest
    const manifest = await prisma.appVersion.create({
      data: {
        ...manifestData,
        active: true,
      },
    });

    res.json({
      success: true,
      data: {
        latestVersion: manifest.latestVersion,
        versionCode: manifest.versionCode,
        publishedAt: manifest.publishedAt,
      },
      message: 'Version manifest updated successfully',
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

/**
 * Compare two semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
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
