/**
 * App Version Routes
 * Handles mobile app version checking
 * Simplified version without database dependency
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';
import { sendFamilyCode, sendTestEmail } from '../services/emailService';
import db from '../db';
import { sql } from 'drizzle-orm';

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
    'https://github.com/AlanDi123/Agenda-Tiendas/releases/latest/download/app-release-signed.apk',
  changelog: process.env.APP_CHANGELOG || 'Nueva versión disponible',
  publishedAt: process.env.APP_PUBLISHED_AT || new Date().toISOString(),
};

let versionTableReady = false;

async function ensureVersionTable(): Promise<void> {
  if (versionTableReady) return;
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS app_version_manifest (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      latest_version TEXT NOT NULL,
      version_code INTEGER NOT NULL,
      mandatory BOOLEAN NOT NULL DEFAULT false,
      min_version TEXT,
      apk_url TEXT NOT NULL,
      changelog TEXT NOT NULL,
      published_at TIMESTAMP NOT NULL,
      build_number INTEGER,
      commit_sha TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));
  versionTableReady = true;
}

async function getCurrentManifest() {
  await ensureVersionTable();
  const result = await db.execute(sql.raw(`
    SELECT latest_version, version_code, mandatory, min_version, apk_url, changelog, published_at, build_number, commit_sha
    FROM app_version_manifest
    ORDER BY updated_at DESC
    LIMIT 1
  `));
  const row = (result as any)?.rows?.[0];
  if (!row) return DEFAULT_VERSION;
  return {
    latestVersion: row.latest_version,
    versionCode: Number(row.version_code),
    mandatory: !!row.mandatory,
    minVersion: row.min_version || DEFAULT_VERSION.minVersion,
    apkUrl: row.apk_url,
    changelog: row.changelog,
    publishedAt: new Date(row.published_at).toISOString(),
    buildNumber: row.build_number ? Number(row.build_number) : undefined,
    commitSha: row.commit_sha || undefined,
  };
}

async function upsertManifest(m: z.infer<typeof manifestSchema>): Promise<void> {
  await ensureVersionTable();
  const esc = (v: string) => v.replace(/'/g, "''");
  await db.execute(sql.raw(`
    INSERT INTO app_version_manifest (
      latest_version, version_code, mandatory, min_version, apk_url, changelog, published_at, build_number, commit_sha, updated_at
    ) VALUES (
      '${esc(m.latestVersion)}',
      ${m.versionCode},
      ${m.mandatory ? 'true' : 'false'},
      ${m.minVersion ? `'${esc(m.minVersion)}'` : 'NULL'},
      '${esc(m.apkUrl)}',
      '${esc(m.changelog)}',
      '${esc(m.publishedAt)}',
      ${m.buildNumber ?? 'NULL'},
      ${m.commitSha ? `'${esc(m.commitSha)}'` : 'NULL'},
      NOW()
    )
  `));
}

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
    const manifest = await getCurrentManifest();
    return res.json({
      success: true,
      data: manifest,
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

    const currentManifest = await getCurrentManifest();

    // Compare versions
    const updateAvailable = compareVersions(currentManifest.latestVersion, version) > 0;
    const isMinVersionSupported = !currentManifest.minVersion ||
      compareVersions(version, currentManifest.minVersion) >= 0;

    return res.json({
      success: true,
      data: {
        updateAvailable,
        currentVersion: version,
        latestVersion: currentManifest.latestVersion,
        versionCode: currentManifest.versionCode,
        mandatory: currentManifest.mandatory,
        minVersionSupported: isMinVersionSupported,
        apkUrl: currentManifest.apkUrl,
        changelog: currentManifest.changelog,
        publishedAt: currentManifest.publishedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================
// POST /api/v1/app/test-resend
// Envía un mail de prueba al email del usuario logueado (para validar Resend)
// ============================================
router.post('/test-resend', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.email) {
      throw createError('No user email', 400, 'NO_USER_EMAIL');
    }

    try {
      await sendTestEmail({ to: user.email });
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : 'Error enviando email de test';
      throw createError(message, 502, 'EMAIL_SEND_FAILED');
    }
    res.json({ success: true, message: 'Test email enviado' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/v1/app/send-family-code
// Envía el código de familia al mail del owner logueado
// ============================================
const sendFamilyCodeSchema = z.object({
  familyCode: z.string().min(4).max(16),
  familyName: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
});

router.post('/send-family-code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = sendFamilyCodeSchema.parse(req.body);
    let targetEmail = parsed.email?.trim().toLowerCase();

    // Si viene Authorization válido, priorizar email autenticado
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        await new Promise<void>((resolve, reject) => {
          authMiddleware(req as any, res as any, (err?: unknown) => {
            if (err) return reject(err);
            resolve();
          });
        });
        const authUser = (req as AuthRequest).user;
        if (authUser?.email) {
          targetEmail = authUser.email;
        }
      }
    } catch {
      // Si falla auth, seguimos con email del body
    }

    if (!targetEmail) {
      throw createError('No user email', 400, 'NO_USER_EMAIL');
    }

    await sendFamilyCode(targetEmail, parsed.familyName || 'Tu familia', parsed.familyCode.toUpperCase());
    res.json({ success: true, message: 'Código de familia enviado' });
  } catch (error) {
    next(error);
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
      await upsertManifest(parsed.data);
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
      await upsertManifest(parsed.data);
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
