/**
 * Request Logger Middleware
 * Logs all incoming requests for audit trail
 */

import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  const logData = {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  };

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      ...logData,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    }));
  });

  next();
}
