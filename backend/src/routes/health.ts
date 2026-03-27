/**
 * Health Check Routes — Deep checks: DB + Gmail SMTP
 */

import { Router } from 'express';
import { checkDatabaseConnection } from '../db';
import { verifySmtpConnection } from '../services/emailService';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.get('/ready', async (_req, res) => {
  try {
    const connected = await checkDatabaseConnection();
    if (connected) {
      res.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ status: 'not_ready', database: 'disconnected', timestamp: new Date().toISOString() });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/** Deep health: DB SELECT 1 + Gmail SMTP verify */
router.get('/deep', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};
  let healthy = true;

  try {
    const dbOk = await checkDatabaseConnection();
    checks.database = dbOk ? 'ok' : 'error';
    if (!dbOk) healthy = false;
  } catch {
    checks.database = 'error';
    healthy = false;
  }

  try {
    const smtpOk = await verifySmtpConnection();
    checks.smtp = smtpOk ? 'ok' : 'error';
    if (!smtpOk) healthy = false;
  } catch {
    checks.smtp = 'error';
    healthy = false;
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

router.get('/live', (_req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

export { router as healthRoutes };
