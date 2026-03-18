/**
 * App Version Routes
 * Handles mobile app version checking
 * Simplified version without database dependency
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';

const router = Router();

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_VERSION = {
  latestVersion: process.env.APP_LATEST_VERSION || '1.0.0',
  versionCode: parseInt(process.env.APP_VERSION_CODE || '10000', 10),
  mandatory: process.env.APP_UPDATE_MANDATORY === 'true',
  minVersion: process.env.APP_MIN_VERSION || '1.0.0',
  apkUrl: process.env.APP_BUNDLE_URL ||
    'https://github.com/AlanDi123/Agenda-Tiendas/releases/latest/download/bundle.zip',
  changelog: process.env.APP_CHANGELOG || 'Nueva versión disponible',
  publishedAt: process.env.APP_PUBLISHED_AT || new Date().toISOString(),
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

// Middleware interno para CI/CD — acepta header x-deploy-secret
function deploySecretMiddleware(req: Request, res: Response, next: NextFunction) {
  const DEPLOY_SECRET = process.env.DEPLOY_SECRET;
  if (!DEPLOY_SECRET) {
    // Si no hay secret configurado, caer al flujo normal de admin JWT
    return next('route');
  }
  const provided = req.headers['x-deploy-secret'];
  if (provided && provided === DEPLOY_SECRET) {
    return next();
  }
  return next('route'); // si no coincide, pasa al siguiente handler (admin JWT)
}

// POST /api/v1/app/version/manifest — acepta CI via deploy secret O admin JWT
router.post(
  '/version/manifest',
  deploySecretMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = manifestSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(createError('Invalid manifest data', 400, 'VALIDATION_ERROR'));
      }
      // Actualizar el manifest en memoria (Vercel env vars se setean por CI o manualmente)
      console.log('[AppVersion] Manifest updated via deploy secret:', parsed.data);
      return res.json({ success: true, message: 'Version manifest received', data: parsed.data });
    } catch (error) {
      return next(error);
    }
  }
);

// Fallback: requiere admin JWT si no usó deploy secret
router.post(
  '/version/manifest',
  authMiddleware as any,
  requireAdmin as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = manifestSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(createError('Invalid manifest data', 400, 'VALIDATION_ERROR'));
      }
      return res.json({ success: true, message: 'Version manifest received', data: parsed.data });
    } catch (error) {
      return next(error);
    }
  }
);

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
