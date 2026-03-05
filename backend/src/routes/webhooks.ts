/**
 * Webhook Routes
 * Handles incoming webhooks from payment gateways (Mercado Pago)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { processWebhookPayment } from '../services/paymentService';
import prisma from '../lib/prisma';

const router = Router();

// ============================================
// CONFIGURATION
// ============================================

const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

// ============================================
// MERCADO PAGO WEBHOOK
// ============================================

/**
 * POST /api/webhooks/mercadopago
 * Handle Mercado Pago payment notifications
 * 
 * Mercado Pago sends notifications for:
 * - payment.created
 * - payment.updated
 */
router.post('/mercadopago', async (req: Request, res: Response) => {
  try {
    const { action, data, topic } = req.body;
    
    console.log('[Webhook] Received Mercado Pago notification:', { action, topic, data });
    
    // Verify webhook signature if secret is configured
    if (MP_WEBHOOK_SECRET) {
      const signature = req.headers['x-signature'] as string;
      
      if (!signature) {
        console.warn('[Webhook] Missing signature header');
        // In production, return 401
        // return res.status(401).json({ error: 'Missing signature' });
      } else {
        const isValid = verifyMercadoPagoSignature(req.body, signature);
        if (!isValid) {
          console.error('[Webhook] Invalid signature');
          // In production, return 401
          // return res.status(401).json({ error: 'Invalid signature' });
        }
      }
    }
    
    // Handle payment notifications
    if (topic === 'payment' || action?.includes('payment')) {
      const paymentId = data?.id?.toString();
      
      if (!paymentId) {
        console.error('[Webhook] Missing payment ID in notification');
        return res.status(400).json({ error: 'Missing payment ID' });
      }
      
      // Process the payment update
      const result = await processWebhookPayment(paymentId);
      
      if (result.success) {
        console.log('[Webhook] Payment processed successfully:', paymentId);
        res.status(200).json({ success: true, message: result.message });
      } else {
        console.error('[Webhook] Payment processing failed:', paymentId);
        res.status(500).json({ success: false, message: result.message });
      }
    } else {
      // Handle other topics (subscription, plan, etc.)
      console.log('[Webhook] Unhandled topic:', topic);
      res.status(200).json({ success: true, message: 'Webhook received' });
    }
  } catch (error) {
    console.error('[Webhook] Error processing Mercado Pago webhook:', error);
    
    // Log error
    try {
      await prisma.webhookEvent.create({
        data: {
          id: crypto.randomUUID(),
          gateway: 'mercadopago',
          eventType: req.body.topic || 'unknown',
          paymentId: req.body.data?.id?.toString() || '',
          status: 'error',
          amount: 0,
          currency: 'ARS',
          signature: 'error',
          rawPayload: JSON.stringify(req.body),
          processed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    } catch (logError) {
      console.error('[Webhook] Error logging webhook error:', logError);
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Verify Mercado Pago webhook signature
 * 
 * Mercado Pago signs webhooks with HMAC-SHA256
 */
function verifyMercadoPagoSignature(payload: any, signature: string): boolean {
  try {
    if (!MP_WEBHOOK_SECRET) {
      console.warn('[Webhook] MP_WEBHOOK_SECRET not configured, skipping signature verification');
      return true;
    }
    
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', MP_WEBHOOK_SECRET)
      .update(payloadString)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Webhook] Error verifying signature:', error);
    return false;
  }
}

/**
 * GET /api/webhooks/mercadopago
 * Test endpoint for Mercado Pago webhook configuration
 */
router.get('/mercadopago', (req: Request, res: Response) => {
  res.status(200).json({ 
    success: true, 
    message: 'Mercado Pago webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// WEBHOOK STATUS
// ============================================

/**
 * GET /api/webhooks/status
 * Get recent webhook events for debugging
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const gateway = req.query.gateway as string;
    
    const where: any = {};
    if (gateway) {
      where.gateway = gateway;
    }
    
    const events = await prisma.webhookEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        gateway: true,
        eventType: true,
        paymentId: true,
        status: true,
        amount: true,
        currency: true,
        processed: true,
        error: true,
        createdAt: true,
      },
    });
    
    res.json({
      success: true,
      data: {
        events,
        total: events.length,
      },
    });
  } catch (error) {
    console.error('[Webhook] Error fetching webhook status:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching webhook status',
    });
  }
});

export { router as webhookRoutes };
