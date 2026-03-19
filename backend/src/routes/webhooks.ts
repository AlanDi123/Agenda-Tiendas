import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import MercadoPagoConfig, { Payment } from 'mercadopago';
import db from '../db';
import { webhookEvents, payments, users, subscriptions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';

const mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
const paymentClient = new Payment(mpClient);

// ============================================
// Verificación de firma MP (formato real: ts=TIMESTAMP,v1=HASH)
// Docs: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
// ============================================
function verifyMPSignature(req: Request): boolean {
  if (!MP_WEBHOOK_SECRET) return true; // Sin secret configurado, aceptar

  const xSignature = req.headers['x-signature'] as string;
  const xRequestId = req.headers['x-request-id'] as string;

  if (!xSignature) return false;

  // Parsear: "ts=1234567890,v1=abc123..."
  const parts: Record<string, string> = {};
  xSignature.split(',').forEach(part => {
    const [key, val] = part.split('=');
    if (key && val) parts[key.trim()] = val.trim();
  });

  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  // El data.id viene del body
  const dataId = req.body?.data?.id?.toString() || '';

  // Template: "id:<dataId>;request-id:<xRequestId>;ts:<ts>;"
  const template = `id:${dataId};request-id:${xRequestId || ''};ts:${ts};`;
  const expected = crypto.createHmac('sha256', MP_WEBHOOK_SECRET).update(template).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ============================================
// POST /api/webhooks/mercadopago
// MP requiere respuesta 200 en máximo 22 segundos
// ============================================
router.post('/mercadopago', async (req: Request, res: Response) => {
  // Responder 200 INMEDIATAMENTE — MP reintenta si no recibe respuesta rápida
  res.status(200).json({ success: true });

  try {
    const { action, data, type } = req.body;

    // Verificar firma
    if (MP_WEBHOOK_SECRET && !verifyMPSignature(req)) {
      console.error('[Webhook] Firma inválida — descartando');
      return;
    }

    console.log('[Webhook] MP notification:', { type, action, dataId: data?.id });

    // Solo procesar eventos de pago
    if (type !== 'payment' && !action?.startsWith('payment')) return;

    const mpPaymentId = data?.id?.toString();
    if (!mpPaymentId) return;

    // Consultar a MP la información real del pago
    const mpPayment = await paymentClient.get({ id: mpPaymentId });

    const status = mpPayment.status; // 'approved', 'rejected', 'pending', etc.
    const externalRef = mpPayment.external_reference; // userId que pusimos al crear la preferencia
    const amount = mpPayment.transaction_amount || 0;
    const metadata = mpPayment.metadata as any || {};
    const planType = metadata?.planType || 'PREMIUM_MONTHLY';

    console.log(`[Webhook] Payment ${mpPaymentId} status: ${status}, userId: ${externalRef}`);

    // Registrar en webhookEvents
    await db.insert(webhookEvents).values({
      id: uuidv4(),
      gateway: 'mercadopago',
      eventType: action || type || 'payment',
      paymentId: mpPaymentId,
      status: status || 'unknown',
      amount: amount.toString(),
      currency: mpPayment.currency_id || 'ARS',
      signature: req.headers['x-signature'] as string || '',
      rawPayload: JSON.stringify(req.body),
      processed: status === 'approved',
      error: null,
    }).onConflictDoNothing();

    if (status !== 'approved' || !externalRef) return;

    // Actualizar o crear registro de pago
    await db.insert(payments).values({
      id: uuidv4(),
      userId: externalRef,
      amountArs: amount.toString(),
      amountUsd: '0',
      currency: mpPayment.currency_id || 'ARS',
      status: 'approved',
      gateway: 'mercadopago',
      preferenceId: mpPayment.order?.id?.toString() || '',
      planId: null,
      discountCode: null,
      discountAmount: '0',
      metadata: JSON.stringify(mpPayment),
      externalPaymentId: mpPaymentId,
    }).onConflictDoNothing();

    // Calcular fecha de expiración según el plan
    const now = new Date();
    let expiresAt: Date | null = null;
    if (planType === 'PREMIUM_MONTHLY') {
      expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (planType === 'PREMIUM_YEARLY') {
      expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Actualizar suscripción — upsert
    const existing = await db.select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.userId, externalRef))
      .limit(1);

    if (existing.length > 0) {
      await db.update(subscriptions)
        .set({ status: 'active', planType: planType as any, endDate: expiresAt, updatedAt: now })
        .where(eq(subscriptions.userId, externalRef));
    } else {
      await db.insert(subscriptions).values({
        id: uuidv4(),
        userId: externalRef,
        planType: planType as any,
        status: 'active',
        startDate: now,
        endDate: expiresAt,
        isLifetime: false,
        externalPaymentId: mpPaymentId,
        paymentGateway: 'mercadopago',
      });
    }

    // Actualizar planType en la tabla users
    await db.update(users)
      .set({ planType: planType as any, currentPeriodEnd: expiresAt, updatedAt: now })
      .where(eq(users.id, externalRef));

    console.log(`[Webhook] ✅ Suscripción activada: userId=${externalRef}, plan=${planType}, expira=${expiresAt}`);

  } catch (error) {
    console.error('[Webhook] Error procesando pago:', error);
  }
});

// GET para verificación del endpoint en el panel de MP
router.get('/mercadopago', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Webhook endpoint activo', timestamp: new Date().toISOString() });
});

export { router as webhookRoutes };
