/**
 * Dommuss Agenda Backend - Main Server
 * Production-safe subscription validation and agenda service
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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const API_VERSION = 'v1';

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
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
  max: 20, // 20 requests per window for auth operations
  message: { error: 'Too many authentication attempts' },
});

// Very strict rate limit for webhooks (should only come from gateways)
const webhookLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 webhook events per hour
  message: { error: 'Too many webhook events' },
});

// ============================================
// BODY PARSING
// ============================================

// JSON parsing with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Store raw body for webhook signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '10mb' }));

// ============================================
// LOGGING
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
╚═══════════════════════════════════════════════════════════╝

  Available Endpoints:
  ─────────────────────
  GET  /api/health/*           - Health checks
  POST /api/${API_VERSION}/auth/*       - Authentication
  GET  /api/${API_VERSION}/agenda/*     - Agenda/Appointments
  POST /api/${API_VERSION}/agenda/*     - Create/Reschedule
  GET  /api/${API_VERSION}/subscriptions/verify - Verify subscription
  POST /api/${API_VERSION}/discounts/apply    - Apply discount code
  POST /api/webhooks/*          - Payment webhooks
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
