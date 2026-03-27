/**
 * Device Token Routes — registro, actualización y eliminación de tokens FCM/APNs
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import db from '../db';
import { deviceTokens } from '../db/schema';
import { createError } from '../middleware/errorHandler';

const router = Router();

const registerTokenSchema = z.object({
  token: z.string().min(10).max(512),
  platform: z.enum(['android', 'ios', 'web']),
  deviceId: z.string().optional(),
});

/** POST /api/v1/devices/token — Registrar o actualizar token FCM */
router.post('/token', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { token, platform, deviceId } = registerTokenSchema.parse(req.body);

    // Upsert: si el token ya existe, reactivarlo; si no, crearlo
    const existing = await db.select({ id: deviceTokens.id })
      .from(deviceTokens)
      .where(eq(deviceTokens.token, token))
      .limit(1);

    if (existing.length) {
      await db.update(deviceTokens)
        .set({ userId, platform, deviceId: deviceId ?? null, isActive: true, updatedAt: new Date() })
        .where(eq(deviceTokens.token, token));
    } else {
      await db.insert(deviceTokens).values({
        userId,
        token,
        platform,
        deviceId: deviceId ?? null,
        isActive: true,
      });
    }

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return next(createError('Datos inválidos', 400, 'VALIDATION_ERROR'));
    next(err);
  }
});

/** DELETE /api/v1/devices/token — Desregistrar token (logout) */
router.delete('/token', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { token } = z.object({ token: z.string() }).parse(req.body);

    await db.update(deviceTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, userId)));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export { router as deviceRoutes };
