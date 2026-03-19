/**
 * Dommuss Agenda Backend
 * Vercel Serverless compatible — exports app directly, no app.listen()
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
import { notificationRoutes } from './routes/notifications';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

dotenv.config();

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://agenda-tienda.vercel.app';
const API_VERSION = 'v1';

// ============================================
// SECURITY MIDDLEWARE
// ============================================

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS — acepta solo tus dominios legítimos
const allowedOrigins = [
  'https://agenda-tienda.vercel.app',
  'https://agenda-tiendas.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

console.log('[Server] CORS allowed origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps Capacitor, Postman)
    if (!origin) return callback(null, true);
    
    // Validación estricta: Solo dominios en la lista (eliminamos el origin.endsWith inseguro)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn('[CORS] Blocked origin:', origin);
    callback(new Error(`CORS: origin ${origin} no permitido`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 'Authorization',
    'X-Webhook-Signature', 'X-Device',
    'X-App-Version', 'x-deploy-secret',
  ],
  credentials: true,
  exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],
}));

// ============================================
// BODY PARSING — DEBE IR ANTES DE RATE LIMIT Y ROUTES
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// RATE LIMITING
// ============================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.ip || 'unknown',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.ip || 'unknown',
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
});

// ============================================
// LOGGING
// ============================================

app.use(requestLogger);

// ============================================
// ROUTES
// ============================================

// Root endpoint — información del backend
app.get('/', (req, res) => {
  res.json({
    name: 'Dommuss Agenda Backend',
    version: '1.0.0',
    apiVersion: API_VERSION,
    endpoints: {
      health: '/api/health',
      auth: `/api/${API_VERSION}/auth`,
      subscriptions: `/api/${API_VERSION}/subscriptions`,
      agenda: `/api/${API_VERSION}/agenda`,
      discounts: `/api/${API_VERSION}/discounts`,
      app: `/api/${API_VERSION}/app`,
      webhooks: '/api/webhooks',
    },
  });
});

app.use('/api/health', healthRoutes);
app.use(`/api/${API_VERSION}/auth`, authLimiter, authRoutes);
app.use(`/api/${API_VERSION}/subscriptions`, apiLimiter, subscriptionRoutes);
app.use(`/api/${API_VERSION}/agenda`, apiLimiter, agendaRoutes);
app.use(`/api/${API_VERSION}/discounts`, authLimiter, discountRoutes);
app.use(`/api/${API_VERSION}/notifications`, apiLimiter, notificationRoutes);
app.use(`/api/${API_VERSION}/app`, apiLimiter, appVersionRoutes);
app.use('/api/webhooks', webhookLimiter, webhookRoutes);

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
// EXPORT — Vercel Serverless usa esto directamente
// NO llamar app.listen() — Vercel lo maneja
// ============================================

export default app;

// Solo escuchar en local (cuando no está en Vercel)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}
