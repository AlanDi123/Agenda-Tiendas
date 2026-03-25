import { Request, Response, NextFunction } from 'express';

const DEFAULT_ORIGINS = [
  'https://agenda-tienda.vercel.app',
  'https://agenda-tiendas.vercel.app',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
] as const;

function parseOriginsFromEnv(raw: string | undefined): string[] {
  if (raw == null || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Unión de orígenes por defecto + CORS_ORIGINS + CORS_ORIGIN (singular, compat README) */
function buildAllowedOrigins(): string[] {
  const fromPlural = parseOriginsFromEnv(process.env.CORS_ORIGINS);
  const fromSingular = parseOriginsFromEnv(process.env.CORS_ORIGIN);
  const merged = new Set<string>([...DEFAULT_ORIGINS, ...fromPlural, ...fromSingular]);
  return Array.from(merged);
}

const ALLOWED_ORIGINS = buildAllowedOrigins();

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin as string | undefined;
  const allowed = isOriginAllowed(origin);

  if (allowed) {
    const allowOrigin = origin ?? '*';
    res.header('Access-Control-Allow-Origin', allowOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-Webhook-Signature, X-Device, X-App-Version, x-deploy-secret'
    );
    res.header('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    if (!allowed && origin) {
      return res.status(403).end();
    }
    return res.status(200).end();
  }

  if (!allowed && origin) {
    return res.status(403).json({ error: 'Forbidden', message: 'Origin not allowed' });
  }

  return next();
}
