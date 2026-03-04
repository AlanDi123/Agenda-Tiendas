/**
 * Webhook Signature Verification Middleware
 * Verifies HMAC signatures from payment gateways
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createError } from './errorHandler';

export interface SignatureConfig {
  headerName: string;
  secret: string;
  algorithm?: string;
  encoding?: 'hex' | 'base64';
  prefix?: string; // e.g., "sha256="
}

/**
 * Verify HMAC signature
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: string = 'sha256'
): boolean {
  const hmac = crypto.createHmac(algorithm, secret);
  const expectedSignature = hmac.update(payload).digest('hex');
  
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Middleware factory for signature verification
 */
export function signatureVerification(config: SignatureConfig) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const signature = req.headers[config.headerName.toLowerCase()] as string;
    
    if (!signature) {
      throw createError('Missing signature header', 401, 'MISSING_SIGNATURE');
    }

    // Remove prefix if present (e.g., "sha256=")
    let cleanSignature = signature;
    if (config.prefix && signature.startsWith(config.prefix)) {
      cleanSignature = signature.slice(config.prefix.length);
    }

    // Get raw body (need to use raw body parser for this endpoint)
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    
    const isValid = verifySignature(
      rawBody,
      cleanSignature,
      config.secret,
      config.algorithm || 'sha256'
    );

    if (!isValid) {
      throw createError('Invalid signature', 401, 'INVALID_SIGNATURE');
    }

    // Attach verification result to request for logging
    (req as any).signatureVerified = true;
    next();
  };
}

/**
 * Gateway-specific signature configurations
 */
export const gatewayConfigs: Record<string, SignatureConfig> = {
  mercadopago: {
    headerName: 'X-Request-Signature',
    secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '',
    algorithm: 'sha256',
    encoding: 'hex',
  },
  paypal: {
    headerName: 'paypal-transmission-id', // PayPal uses multiple headers
    secret: process.env.PAYPAL_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '',
    algorithm: 'sha256',
    encoding: 'hex',
  },
  ebanx: {
    headerName: 'X-Ebanx-Signature',
    secret: process.env.EBANX_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '',
    algorithm: 'sha256',
    encoding: 'hex',
  },
  mobbex: {
    headerName: 'X-Mobbex-Signature',
    secret: process.env.MOBBEX_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '',
    algorithm: 'sha256',
    encoding: 'hex',
  },
  payway: {
    headerName: 'X-Payway-Signature',
    secret: process.env.PAYWAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '',
    algorithm: 'sha256',
    encoding: 'hex',
  },
};

/**
 * Get signature config for gateway
 */
export function getGatewayConfig(gateway: string): SignatureConfig | null {
  return gatewayConfigs[gateway.toLowerCase()] || null;
}
