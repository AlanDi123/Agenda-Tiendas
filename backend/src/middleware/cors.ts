import { Request, Response, NextFunction } from 'express';

const allowedOrigins = [
  'https://agenda-tienda.vercel.app',    // Frontend SIN "s"
  'https://agenda-tiendas.vercel.app',   // Backend CON "s" (si accede a sí mismo)
  'http://localhost:5173',                 // Dev local
  'http://localhost:3000',
];

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin || '')) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Webhook-Signature, X-Device, X-App-Version, x-deploy-secret');
    res.header('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
}
