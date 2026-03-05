/**
 * Dommuss Agenda Backend - Main Server
 * Production-safe subscription validation and agenda service
 * Uses Drizzle ORM with Neon PostgreSQL serverless
 * Compatible with 32-bit Node.js environments
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { subscriptionRoutes } from './routes/subscriptions';
import { webhookRoutes } from './routes/webhooks';
import { discountRoutes } from './routes/discounts';
import { healthRoutes } from './routes/health';
import { agendaRoutes } from './routes/agenda';
import { authRoutes } from './routes/auth';
import { appVersionRoutes } from './routes/appVersion';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { checkDatabaseConnection } from './db';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const API_VERSION = 'v1';

// ============================================
// STARTUP: DATABASE CONNECTION
// ============================================

async function startServer() {
  // Check database connection
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    console.error('[Server] Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // ============================================
  // SECURITY MIDDLEWARE
  // ============================================

  // Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.use(cors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Signature', 'X-Device', 'X-App-Version'],
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],
  }));

  // Rate limiting for API endpoints
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    },
  });

  // Stricter rate limit for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many authentication attempts' },
  });

  // Very strict rate limit for webhooks
  const webhookLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 1000,
    message: { error: 'Too many webhook events' },
  });

  // ============================================
  // BODY PARSING
  // ============================================

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ============================================
  // REQUEST LOGGING
  // ============================================

  app.use(requestLogger);

  // ============================================
  // API ROUTES
  // ============================================

  // Health check (no rate limiting, no versioning)
  app.use('/api/health', healthRoutes);

  // API Versioning
  app.use(`/api/${API_VERSION}/subscriptions`, apiLimiter, subscriptionRoutes);
  app.use(`/api/${API_VERSION}/auth`, authLimiter, authRoutes);
  app.use(`/api/${API_VERSION}/agenda`, apiLimiter, agendaRoutes);
  app.use(`/api/${API_VERSION}/discounts`, authLimiter, discountRoutes);
  app.use(`/api/${API_VERSION}/app`, apiLimiter, appVersionRoutes);

  // Webhooks (separate rate limiting, signature verified in route)
  app.use('/api/webhooks', webhookLimiter, webhookRoutes);

  // ============================================
  // ERROR HANDLING
  // ============================================

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
      apiVersion: API_VERSION,
    });
  });

  // Global error handler
  app.use(errorHandler);

  // ============================================
  // SERVER STARTUP
  // ============================================

  const server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           DOMMUSS AGENDA BACKEND                          ║
╠═══════════════════════════════════════════════════════════╣
║  Environment: ${process.env.NODE_ENV || 'development'}${' '.repeat(42)}║
║  Port: ${PORT}${' '.repeat(52)}║
║  API Version: ${API_VERSION}${' '.repeat(44)}║
║  CORS Origin: ${CORS_ORIGIN}${' '.repeat(35)}║
║  Database: Neon PostgreSQL${' '.repeat(32)}║
╚═══════════════════════════════════════════════════════════╝

  Available Endpoints:
  ─────────────────────
  GET  /api/health/*           - Health checks
  POST /api/${API_VERSION}/auth/*       - Authentication
  GET  /api/${API_VERSION}/subscriptions/* - Subscription management
  POST /api/${API_VERSION}/subscriptions/checkout - Create checkout
  GET  /api/${API_VERSION}/agenda/*     - Agenda/Appointments
  POST /api/${API_VERSION}/discounts/validate - Validate discount
  POST /api/webhooks/*          - Payment webhooks
  `);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('[Server] Process terminated');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[Server] SIGINT received. Shutting down gracefully...');
    server.close(() => {
      console.log('[Server] Process terminated');
      process.exit(0);
    });
  });
}

// Start the server
startServer().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});

export default app;
