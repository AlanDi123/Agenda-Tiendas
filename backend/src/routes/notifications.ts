import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

/**
 * POST /api/v1/notifications/family
 * Notifica a todos los miembros de la familia sobre un cambio en un evento
 */
router.post('/family', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const actor = (req as AuthRequest).user;
    const { action, eventTitle, startDate, familyMemberEmails } = req.body;

    if (!userId || !actor) throw createError('No autenticado', 401);
    if (!action || !eventTitle) throw createError('Datos incompletos', 400);

    // Los emails de los miembros se envían desde el frontend (los tiene en el environment local)
    const emails: string[] = Array.isArray(familyMemberEmails)
      ? familyMemberEmails.filter((e: string) => e && e !== actor.email)
      : [];

    // No awaitar — no bloquear la respuesta (el email se envía asíncronamente)
    if (emails.length > 0) {
      const { sendFamilyEventNotification } = await import('../services/emailService');
      sendFamilyEventNotification(
        emails,
        actor.email.split('@')[0],
        action,
        eventTitle,
        startDate ? new Date(startDate) : undefined
      ).catch((err: unknown) =>
        console.error('[Notifications] Error sending family notification:', err)
      );
    }

    res.json({ success: true, notified: emails.length });
  } catch (error) {
    next(error);
  }
});

export { router as notificationRoutes };
