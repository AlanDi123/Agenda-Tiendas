/**
 * Structured Request Logger — Pino HTTP
 * Reemplaza console.log con logs JSON estructurados compatibles con Vercel/Datadog
 */

import pino from 'pino';
import pinoHttp from 'pino-http';
import { Request, Response, NextFunction } from 'express';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});

const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${(req as Request).path} — ${res.statusCode}`,
  customErrorMessage: (_req, _res, err) => `Request error — ${err.message}`,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  serializers: {
    req: (req) => ({
      method: req.method,
      path: req.url,
      ip: req.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  httpLogger(req, res, next);
}
