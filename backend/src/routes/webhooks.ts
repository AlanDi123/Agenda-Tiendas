/**
 * Webhook Routes
 * Handles payment gateway webhooks with signature verification
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { activateSubscription, grantLifetimeSubscription } from '../services/subscriptionService';
import { isMajestadAlanCode } from '../services/discountService';
import { verifySignature, getGatewayConfig } from '../middleware/signatureVerification';
import { createError } from '../middleware/errorHandler';

const router = Router();

// ============================================
// WEBHOOK HANDLER UTILITIES
// ============================================

/**
 * Log webhook event for audit
 */
async function logWebhookEvent(
  gateway: string,
  eventType: string,
  paymentId: string,
  status: string,
  amount: number,
  currency: string,
  signature: string,
  rawPayload: string,
  error?: string
) {
  await prisma.webhookEvent.create({
    data: {
      gateway,
      eventType,
      paymentId,
      status,
      amount,
      currency,
      signature,
      rawPayload,
      processed: !error,
      error,
    },
  });
}

/**
 * Log payment for audit
 */
async function logPayment(
  userId: string,
  gateway: string,
  amount: number,
  currency: string,
  status: string,
  rawPayload: string,
  signature?: string
) {
  await prisma.paymentLog.create({
    data: {
      userId,
      gateway,
      amount,
      currency,
      status,
      rawPayload,
      signature,
    },
  });
}

/**
 * Process successful payment
 */
async function processSuccessfulPayment(
  gateway: string,
  paymentId: string,
  userId: string,
  amount: number,
  _currency: string,
  metadata?: Record<string, any>
) {
  // Extract plan type from metadata or determine from amount
  let planType = metadata?.planType;
  
  if (!planType) {
    // Determine from amount (approximate)
    if (amount >= 199) {
      planType = 'PREMIUM_LIFETIME';
    } else if (amount >= 99) {
      planType = 'PREMIUM_YEARLY';
    } else if (amount >= 9) {
      planType = 'PREMIUM_MONTHLY';
    } else {
      planType = 'FREE';
    }
  }

  // Check for MAJESTADALAN discount code
  const discountCode = metadata?.discountCode;
  if (discountCode && isMajestadAlanCode(discountCode)) {
    // Grant lifetime subscription
    await grantLifetimeSubscription(userId, gateway, paymentId);
    console.log(`MAJESTADALAN applied: userId=${userId}, gateway=${gateway}`);
    return;
  }

  // Activate subscription
  await activateSubscription(userId, planType, gateway, paymentId);
}

// ============================================
// GENERIC WEBHOOK HANDLER
// ============================================

async function handleWebhook(
  req: Request,
  res: Response,
  gateway: string
) {
  const signature = req.headers['x-webhook-signature'] as string || 
                    req.headers['x-request-signature'] as string ||
                    '';

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  
  try {
    // Get gateway config
    const config = getGatewayConfig(gateway);
    
    if (!config || !config.secret) {
      throw createError(`Webhook secret not configured for ${gateway}`, 500);
    }

    // Verify signature
    if (signature && config.secret) {
      const isValid = verifySignature(rawBody, signature, config.secret);
      if (!isValid) {
        await logWebhookEvent(
          gateway,
          'unknown',
          'unknown',
          'failed',
          0,
          'USD',
          signature,
          rawBody,
          'Invalid signature'
        );
        throw createError('Invalid signature', 401);
      }
    }

    // Parse payload (gateway-specific parsing would go here)
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // Extract common fields (gateway-specific extraction would go here)
    const paymentId = payload.id || payload.payment_id || payload.transaction_id;
    const status = payload.status || payload.payment_status;
    const amount = payload.amount || payload.transaction_amount || 0;
    const currency = payload.currency_id || payload.currency || 'USD';
    const userId = payload.metadata?.userId || payload.user_id;
    
    if (!paymentId) {
      throw createError('Missing payment ID in webhook', 400);
    }

    // Log the webhook event
    await logWebhookEvent(
      gateway,
      payload.action || payload.event_type || 'payment.updated',
      paymentId,
      status,
      amount,
      currency,
      signature,
      rawBody
    );

    // Process based on status
    if (status === 'approved' || status === 'completed' || status === 'paid') {
      if (!userId) {
        throw createError('Missing userId in webhook metadata', 400);
      }

      await processSuccessfulPayment(
        gateway,
        paymentId,
        userId,
        amount,
        currency,
        payload.metadata
      );

      await logPayment(userId, gateway, amount, currency, status, rawBody, signature);
    }

    // Acknowledge webhook
    res.status(200).json({ received: true });

  } catch (error) {
    console.error(`Webhook error (${gateway}):`, error);
    
    // Still acknowledge to prevent retries for client errors
    if (error instanceof Error && (error as any).statusCode === 400) {
      res.status(200).json({ received: true, error: 'Bad request' });
    } else {
      res.status(500).json({ received: true, error: 'Processing error' });
    }
  }
}

// ============================================
// GATEWAY-SPECIFIC WEBHOOK ROUTES
// ============================================

/**
 * POST /api/webhooks/mercadopago
 * Mercado Pago webhook
 */
router.post('/mercadopago', (req, res, next) => {
  handleWebhook(req, res, 'mercadopago').catch(next);
});

/**
 * POST /api/webhooks/paypal
 * PayPal webhook
 */
router.post('/paypal', (req, res, next) => {
  handleWebhook(req, res, 'paypal').catch(next);
});

/**
 * POST /api/webhooks/ebanx
 * EBANX webhook
 */
router.post('/ebanx', (req, res, next) => {
  handleWebhook(req, res, 'ebanx').catch(next);
});

/**
 * POST /api/webhooks/mobbex
 * Mobbex webhook
 */
router.post('/mobbex', (req, res, next) => {
  handleWebhook(req, res, 'mobbex').catch(next);
});

/**
 * POST /api/webhooks/payway
 * Payway webhook
 */
router.post('/payway', (req, res, next) => {
  handleWebhook(req, res, 'payway').catch(next);
});

export { router as webhookRoutes };
