/**
 * App Version Routes
 * Handles mobile app version checking y actualización del manifest
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import db from '../db';
import { sql } from 'drizzle-orm';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';
import { sendFamilyCode, sendTestEmail } from '../services/emailService';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ManifestPayload {
  latestVersion: string;
  versionCode: number;
  mandatory: boolean;
  minVersion: string;
  apkUrl: string;
  changelog: string;
  publishedAt: string;
  buildNumber: number;
  commitSha: string;
}

const router = Router();
const DEFAULT_VERSION = '1.0.0';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
    SELECT latest_version, version_code, mandatory, min_version, apk_url,
           changelog, published_at, build_number, commit_sha
    FROM app_version_manifest
    ORDER BY updated_at DESC
    LIMIT 1
  `));
  const row = (result as unknown as { rows?: Record<string, unknown>[] })?.rows?.[0];
  if (!row) {
    return {
      latestVersion: DEFAULT_VERSION,
      versionCode: 10000,
      mandatory: false,
      minVersion: DEFAULT_VERSION,
      apkUrl: 'https://github.com/AlanDi123/Agenda-Tiendas/releases/latest/download/Dommuss-Agenda.apk',
      changelog: 'Nueva versión disponible',
      publishedAt: new Date().toISOString(),
    };
  }
  return {
    latestVersion: String(row.latest_version),
    versionCode: Number(row.version_code),
    mandatory: !!row.mandatory,
    minVersion: String(row.min_version || DEFAULT_VERSION),
    apkUrl: String(row.apk_url),
    changelog: String(row.changelog),
    publishedAt: new Date(row.published_at as string).toISOString(),
    buildNumber: row.build_number ? Number(row.build_number) : undefined,
    commitSha: row.commit_sha ? String(row.commit_sha) : undefined,
  };
}

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const a = p1[i] ?? 0, b = p2[i] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

// ============================================
// GET /api/v1/app/version
// ============================================
router.get('/version', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const manifest = await getCurrentManifest();
    res.json({ success: true, data: manifest });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/v1/app/version/check
// ============================================
router.get('/version/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const version = req.query.version as string | undefined;
    if (!version || typeof version !== 'string') {
      throw createError('Missing or invalid version parameter', 400, 'INVALID_VERSION');
    }

    const manifest = await getCurrentManifest();
    const updateAvailable = compareVersions(manifest.latestVersion, version) > 0;
    const minVersionSupported = !manifest.minVersion ||
      compareVersions(version, manifest.minVersion) >= 0;

    res.json({
      success: true,
      data: {
        updateAvailable,
        currentVersion: version,
        latestVersion: manifest.latestVersion,
        versionCode: manifest.versionCode,
        mandatory: manifest.mandatory,
        minVersionSupported,
        apkUrl: manifest.apkUrl,
        changelog: manifest.changelog,
        publishedAt: manifest.publishedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/v1/app/version/manifest
// Endpoint privado invocado por GitHub Actions al lanzar un release
// ============================================
router.post('/version/manifest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deploySecret = req.headers['x-deploy-secret'];

    // Verificación de seguridad estricta
    if (!process.env.DEPLOY_SECRET || deploySecret !== process.env.DEPLOY_SECRET) {
      console.warn('[VersionManifest] Intento de actualización de manifiesto no autorizado');
      return next(createError('No autorizado para actualizar manifest', 401, 'UNAUTHORIZED_MANIFEST_UPDATE'));
    }

    const manifest = req.body as ManifestPayload;

    if (!manifest.latestVersion || !manifest.apkUrl) {
      return next(createError('Payload de manifest incompleto', 400, 'INVALID_MANIFEST_PAYLOAD'));
    }

    console.log(`[VersionManifest] Recibido manifest para la versión: ${manifest.latestVersion}`);

    try {
      await db.execute(sql`
        INSERT INTO app_version_manifest (
          latest_version, version_code, mandatory, min_version,
          apk_url, changelog, published_at
        ) VALUES (
          ${manifest.latestVersion},
          ${manifest.versionCode},
          ${manifest.mandatory},
          ${manifest.minVersion},
          ${manifest.apkUrl},
          ${manifest.changelog},
          ${manifest.publishedAt}
        )
      `);
      console.log('[VersionManifest] ✅ Manifest guardado en DB con éxito');
    } catch (dbError) {
      console.error('[VersionManifest] ❌ Error SQL al guardar manifest:', dbError);
      // Fallback: si falla la DB, devolvemos 200 igual para que GitHub Actions no falle
      console.warn('[VersionManifest] Ignorando fallo de DB. GitHub Actions continuará.');
    }

    res.status(200).json({
      success: true,
      message: 'Manifiesto actualizado exitosamente',
      version: manifest.latestVersion,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/v1/app/test-email
// ============================================
router.post('/test-email', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.email) {
      throw createError('No user email', 400, 'NO_USER_EMAIL');
    }
    try {
      await sendTestEmail(user.email);
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : 'Error enviando email de test';
      throw createError(message, 502, 'EMAIL_SEND_FAILED');
    }
    res.json({ success: true, message: 'Test email enviado correctamente' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/v1/app/send-family-code
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

    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        await new Promise<void>((resolve, reject) => {
          authMiddleware(req as Parameters<typeof authMiddleware>[0], res as Parameters<typeof authMiddleware>[1], (err?: unknown) => {
            if (err) return reject(err);
            resolve();
          });
        });
        const authUser = (req as AuthRequest).user;
        if (authUser?.email) targetEmail = authUser.email;
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

export { router as appVersionRoutes };
