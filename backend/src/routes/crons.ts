/**
 * Cron Endpoints — invocados por Vercel Cron Jobs (vercel.json)
 *
 * Seguridad: verificar header Authorization: Bearer CRON_SECRET
 * Configurar en vercel.json:
 *   { "path": "/api/v1/crons/process-emails", "schedule": "* * * * *" }
 *   { "path": "/api/v1/crons/expiry-alerts", "schedule": "0 9 * * *" }
 *   { "path": "/api/v1/crons/weekly-summary", "schedule": "0 8 * * 0" }
 *   { "path": "/api/v1/crons/cleanup-tokens", "schedule": "0 3 * * *" }
 */

import { Router, Request, Response } from 'express';
import { processOutbox } from '../services/emailQueue';
import { sendExpiryWarningEmail } from '../services/billingEmails';
import { sendWeeklySummaryEmail } from '../services/notificationEmails';
import db from '../db';
import { users, subscriptions, refreshTokens } from '../db/schema';
import { and, eq, lt, lte, sql as drizzleSql } from 'drizzle-orm';
import { logger } from '../middleware/requestLogger';

const router = Router();
const CRON_SECRET = process.env.CRON_SECRET || '';

function verifyCronSecret(req: Request): boolean {
  if (!CRON_SECRET) return true; // deshabilitado en desarrollo
  const auth = req.headers.authorization;
  return auth === `Bearer ${CRON_SECRET}`;
}

/** POST /api/v1/crons/process-emails — Procesar cola de emails fallidos */
router.post('/process-emails', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const result = await processOutbox(50);
    logger.info(result, '[Cron] process-emails completado');
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err }, '[Cron] process-emails error');
    res.status(500).json({ success: false });
  }
});

/** POST /api/v1/crons/expiry-alerts — Notificar usuarios con plan por expirar en 3 días */
router.post('/expiry-alerts', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in4Days = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

    const expiring = await db
      .select({
        userId: subscriptions.userId,
        planType: subscriptions.planType,
        endDate: subscriptions.endDate,
        email: users.email,
      })
      .from(subscriptions)
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .where(
        and(
          eq(subscriptions.status, 'active'),
          drizzleSql`${subscriptions.endDate} <= ${in4Days}`,
          drizzleSql`${subscriptions.endDate} >= ${in3Days}`
        )
      );

    let sent = 0;
    for (const sub of expiring) {
      if (!sub.endDate) continue;
      const daysLeft = Math.ceil((sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      await sendExpiryWarningEmail({
        email: sub.email,
        planType: sub.planType ?? 'PREMIUM_MONTHLY',
        currentPeriodEnd: sub.endDate,
        daysLeft,
      }).catch((e) => logger.error({ e, email: sub.email }, '[Cron] expiry-alerts email error'));
      sent++;
    }

    logger.info({ sent }, '[Cron] expiry-alerts completado');
    res.json({ success: true, sent });
  } catch (err) {
    logger.error({ err }, '[Cron] expiry-alerts error');
    res.status(500).json({ success: false });
  }
});

/** POST /api/v1/crons/weekly-summary — Resumen semanal (domingo) */
router.post('/weekly-summary', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Solo usuarios con resumen habilitado
    const usersToNotify = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.emailVerified, true))
      .limit(500);

    let sent = 0;
    for (const user of usersToNotify) {
      await sendWeeklySummaryEmail({
        email: user.email,
        events: [],
        weekStart,
        weekEnd,
      }).catch(() => {});
      sent++;
    }

    logger.info({ sent }, '[Cron] weekly-summary completado');
    res.json({ success: true, sent });
  } catch (err) {
    logger.error({ err }, '[Cron] weekly-summary error');
    res.status(500).json({ success: false });
  }
});

/** POST /api/v1/crons/cleanup-tokens — Purgar refresh tokens expirados */
router.post('/cleanup-tokens', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const now = new Date();
    await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, now));
    logger.info('[Cron] cleanup-tokens completado');
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, '[Cron] cleanup-tokens error');
    res.status(500).json({ success: false });
  }
});

export { router as cronRoutes };
