/**
 * Health Check Routes
 * Simple endpoints for monitoring and readiness checks
 */

import { Router } from 'express';
import { checkDatabaseConnection } from '../db';

const router = Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /api/health/ready
 * Readiness check (includes database connection)
 */
router.get('/ready', async (_req, res) => {
  try {
    const connected = await checkDatabaseConnection();

    if (connected) {
      res.json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
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

/**
 * GET /api/health/live
 * Liveness check (just confirms server is running)
 */
router.get('/live', (_req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRoutes };
