import { Request, Response, NextFunction } from 'express';

// URLs permitidas - desde variable de entorno o default
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [
  'https://agenda-tienda.vercel.app',   // frontend Vercel (sin "s")
  'https://agenda-tiendas.vercel.app',  // backend Vercel (con "s")
  'capacitor://localhost',              // WebView Android/iOS
  'ionic://localhost',                  // fallback Ionic
  'http://localhost',                   // Capacitor local sin puerto
  'http://localhost:5173',              // Vite dev
  'http://localhost:3000',
  'http://localhost:4173',              // Vite preview
];

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  // Sin origin = Postman / curl / server-to-server → siempre permitir
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    const allowOrigin = origin || '*';
    res.header('Access-Control-Allow-Origin', allowOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Webhook-Signature, X-Device, X-App-Version, x-deploy-secret');
    res.header('Access-Control-Max-Age', '86400');
  }

  // Preflight OPTIONS → siempre 200, cortar aquí
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
}
