/**
 * Dommuss Agenda Backend - Main Server
 * Production-safe subscription validation service
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
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

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
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Signature'],
  credentials: true,
}));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 requests per window for auth operations
  message: { error: 'Too many authentication attempts' },
});

// ============================================
// BODY PARSING
// ============================================

// JSON parsing with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// LOGGING
// ============================================

app.use(requestLogger);

// ============================================
// ROUTES
// ============================================

// Health check (no rate limiting)
app.use('/api/health', healthRoutes);

// Subscription verification (rate limited)
app.use('/api/subscriptions', apiLimiter, subscriptionRoutes);

// Webhooks (separate rate limiting, signature verified in route)
app.use('/api/webhooks', webhookRoutes);

// Discount codes (auth limited)
app.use('/api/discounts', authLimiter, discountRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
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
║  CORS Origin: ${CORS_ORIGIN}${' '.repeat(35)}║
╚═══════════════════════════════════════════════════════════╝
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
