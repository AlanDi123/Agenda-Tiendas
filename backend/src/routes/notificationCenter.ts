/**
 * Notification Center Routes — historial de notificaciones + marcar leído
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import db from '../db';
import { notificationLogs, userPreferences } from '../db/schema';
import { createError } from '../middleware/errorHandler';

const router = Router();

/** GET /api/v1/notification-center — Listar notificaciones del usuario */
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const unreadOnly = req.query.unread === 'true';

    const conditions = unreadOnly
      ? and(eq(notificationLogs.userId, userId), eq(notificationLogs.read, false))
      : eq(notificationLogs.userId, userId);

    const rows = await db.select()
      .from(notificationLogs)
      .where(conditions)
      .orderBy(desc(notificationLogs.createdAt))
      .limit(limit);

    const unreadCount = rows.filter((r: typeof rows[0]) => !r.read).length;

    res.json({ success: true, data: { notifications: rows, unreadCount } });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/notification-center/:id/read — Marcar como leído */
router.patch('/:id/read', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { id } = req.params;

    await db.update(notificationLogs)
      .set({ read: true, readAt: new Date() })
      .where(and(eq(notificationLogs.id, id), eq(notificationLogs.userId, userId)));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/notification-center/read-all */
router.patch('/read-all', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId!;

    await db.update(notificationLogs)
      .set({ read: true, readAt: new Date() })
      .where(and(eq(notificationLogs.userId, userId), eq(notificationLogs.read, false)));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/notification-center/preferences */
router.get('/preferences', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId!;

    const prefs = await db.select().from(userPreferences)
      .where(eq(userPreferences.userId, userId)).limit(1);

    res.json({ success: true, data: prefs[0] ?? null });
  } catch (err) {
    next(err);
  }
});

const updatePrefsSchema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  weeklySummaryEnabled: z.boolean().optional(),
  dndStart: z.string().optional(),
  dndEnd: z.string().optional(),
  timezone: z.string().optional(),
  preferredView: z.enum(['month', 'week', 'day']).optional(),
});

/** PATCH /api/v1/notification-center/preferences */
router.patch('/preferences', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const updates = updatePrefsSchema.parse(req.body);

    const existing = await db.select({ id: userPreferences.id })
      .from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);

    if (existing.length) {
      await db.update(userPreferences)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId));
    } else {
      await db.insert(userPreferences).values({ userId, ...updates });
    }

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return next(createError('Datos inválidos', 400, 'VALIDATION_ERROR'));
    next(err);
  }
});

export { router as notificationCenterRoutes };
