/**
 * Payment Service
 * Handles Mercado Pago checkout and subscription management
 * Uses Drizzle ORM with Neon PostgreSQL
 */

import MercadoPagoConfig, { Preference, Payment } from 'mercadopago';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import db from '../db';
import { payments, subscriptions, users, plans, discountCodes, webhookEvents, paymentLogs } from '../db/schema';
import { getUsdToArsRate } from './currencyService';

// ============================================
// CONFIGURATION
// ============================================

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:3001';

// Initialize Mercado Pago client
const client = new MercadoPagoConfig({
  accessToken: MP_ACCESS_TOKEN,
});

// ============================================
// TYPES
// ============================================

export interface PlanPricing {
  planType: string;
  priceUsd: number;
  priceArs: number;
  interval: 'monthly' | 'yearly' | 'lifetime';
  description: string;
}

export interface CheckoutResult {
  success: boolean;
  preferenceId?: string;
  initPoint?: string;
  paymentId?: string;
  message?: string;
}

// ============================================
// PLAN PRICING
// ============================================

const PLAN_PRICES: Record<string, { ars: number; interval: 'monthly' | 'yearly' | 'lifetime' }> = {
  PREMIUM_MONTHLY: { ars: 35000, interval: 'monthly' },
  PREMIUM_YEARLY:  { ars: 336000, interval: 'yearly' },
};

function getPlanDescription(planType: string): string {
  const descriptions: Record<string, string> = {
    PREMIUM_MONTHLY: 'Suscripción Mensual Premium',
    PREMIUM_YEARLY: 'Suscripción Anual Premium (2 meses gratis)',
    PREMIUM_LIFETIME: 'Acceso de por vida',
  };
  return descriptions[planType] || 'Suscripción Premium';
}

// ============================================
// FUNCTIONS
// ============================================

/**
 * Get plan pricing with ARS conversion
 */
export async function getPlanPricing(planType: string): Promise<PlanPricing | null> {
  const plan = PLAN_PRICES[planType];
  if (!plan) return null;

  return {
    planType,
    priceUsd: 0,      // no se usa, MP cobra en ARS
    priceArs: plan.ars,
    interval: plan.interval,
    description: getPlanDescription(planType),
  };
}

/**
 * Create Mercado Pago preference for checkout
 */
export async function createCheckoutPreference(
  userId: string,
  planType: string,
  discountCode?: string
): Promise<CheckoutResult> {
  try {
    // Get user info
    const foundUsers = await db.select({
      id: users.id,
      email: users.email,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (foundUsers.length === 0) {
      return {
        success: false,
        message: 'Usuario no encontrado',
      };
    }

    const user = foundUsers[0];

    // Get plan pricing
    const pricing = await getPlanPricing(planType);
    if (!pricing) {
      return {
        success: false,
        message: 'Plan no válido',
      };
    }

    // Apply discount if provided
    let finalPriceArs = pricing.priceArs;
    let discountAmount = 0;

    if (discountCode) {
      const foundCodes = await db.select({
        code: discountCodes.code,
        type: discountCodes.type,
        value: discountCodes.value,
        active: discountCodes.active,
        expiresAt: discountCodes.expiresAt,
        applicablePlans: discountCodes.applicablePlans,
      })
        .from(discountCodes)
        .where(eq(discountCodes.code, discountCode.toUpperCase()))
        .limit(1);

      if (foundCodes.length > 0) {
        const discount = foundCodes[0];
        const applicablePlans = JSON.parse(discount.applicablePlans) as string[];

        if (discount.active &&
          (!discount.expiresAt || discount.expiresAt > new Date()) &&
          applicablePlans.includes(planType)) {

          if (discount.type === 'percentage') {
            discountAmount = Math.ceil(finalPriceArs * (parseFloat(discount.value) / 100));
          } else if (discount.type === 'fixed') {
            discountAmount = parseFloat(discount.value);
          }
          finalPriceArs = Math.max(0, finalPriceArs - discountAmount);
        }
      }
    }

    // Create preference
    const preference = new Preference(client);

    const preferenceData = {
      items: [
        {
          id: planType,
          title: pricing.description,
          description: 'Suscripción Dommuss Agenda',
          picture_url: `${APP_BASE_URL}/pwa-512x512.svg`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: finalPriceArs,
        },
      ],
      payer: {
        email: user.email,
        name: user.email.split('@')[0],
      },
      back_urls: {
        success: `${APP_BASE_URL}/payment/success`,
        failure: `${APP_BASE_URL}/payment/failure`,
        pending: `${APP_BASE_URL}/payment/pending`,
      },
      auto_return: 'approved' as const,
      external_reference: userId,
      metadata: {
        userId,
        planType,
        discountCode: discountCode || null,
        originalPriceArs: pricing.priceArs,
        finalPriceArs,
        discountAmount,
      },
      notification_url: `${BACKEND_BASE_URL}/api/webhooks/mercadopago?source_news=webhooks`,
    };

    const result = await preference.create({ body: preferenceData });

    // Store payment record
    await db.insert(payments).values({
      id: uuidv4(),
      userId,
      amountArs: finalPriceArs.toString(),
      amountUsd: '0',
      currency: 'ARS',
      status: 'pending',
      gateway: 'mercadopago',
      preferenceId: result.id,
      planId: null,
      discountCode: discountCode || null,
      discountAmount: discountAmount.toString(),
      metadata: JSON.stringify(preferenceData.metadata),
    });

    console.log(`[PaymentService] Created preference ${result.id} for user ${userId}`);

    return {
      success: true,
      preferenceId: result.id,
      initPoint: result.init_point || result.sandbox_init_point,
    };
  } catch (error) {
    console.error('[PaymentService] Error creating preference:', error);
    return {
      success: false,
      message: 'Error al crear preferencia de pago',
    };
  }
}

/**
 * Process webhook payment notification from Mercado Pago
 */
export async function processWebhookPayment(paymentId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const payment = new Payment(client);
    const paymentData = await payment.get({ id: paymentId });

    if (!paymentData) {
      return {
        success: false,
        message: 'Payment not found',
      };
    }

    const status = paymentData.status || 'unknown';
    const externalReference = paymentData.external_reference;
    const amount = paymentData.transaction_amount || 0;
    const currency = paymentData.currency_id || 'ARS';

    // Find payment record by preference_id
    const foundPayments = await db.select({
      id: payments.id,
      userId: payments.userId,
      planId: payments.planId,
    })
      .from(payments)
      .where(eq(payments.preferenceId, paymentId))
      .limit(1);

    let paymentRecord = foundPayments[0];

    // If not found by preference_id, try external_payment_id
    if (!paymentRecord) {
      const foundByExternal = await db.select({
        id: payments.id,
        userId: payments.userId,
        planId: payments.planId,
      })
        .from(payments)
        .where(eq(payments.externalPaymentId, paymentId))
        .limit(1);
      paymentRecord = foundByExternal[0];
    }

    if (!paymentRecord) {
      // Create new payment record
      const newPaymentId = uuidv4();
      await db.insert(payments).values({
        id: newPaymentId,
        userId: externalReference || '',
        amountArs: amount.toString(),
        currency,
        status: status as any,
        gateway: 'mercadopago',
        externalPaymentId: paymentId,
      });
      paymentRecord = { id: newPaymentId, userId: externalReference || '', planId: null };
    }

    // Update payment status
    await db.update(payments)
      .set({
        status: status as any,
        externalPaymentId: paymentId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentRecord.id));

    // If payment is approved, activate subscription
    if (status === 'approved' && paymentRecord.userId) {
      // Get payment details to find plan type
      const paymentDetails = await db.select({
        metadata: payments.metadata,
      })
        .from(payments)
        .where(eq(payments.id, paymentRecord.id))
        .limit(1);

      if (paymentDetails[0]?.metadata) {
        const metadata = JSON.parse(paymentDetails[0].metadata);
        const planType = metadata.planType;

        if (planType) {
          await activateSubscription(
            paymentRecord.userId,
            planType,
            planType === 'PREMIUM_LIFETIME',
            paymentId
          );
        }
      }
    }

    // Log webhook event
    await db.insert(webhookEvents).values({
      id: uuidv4(),
      gateway: 'mercadopago',
      eventType: 'payment.updated',
      paymentId,
      status,
      amount: amount.toString(),
      currency,
      signature: 'verified',
      rawPayload: JSON.stringify(paymentData),
      processed: true,
    });

    console.log(`[PaymentService] Processed webhook for payment ${paymentId}, status: ${status}`);

    return {
      success: true,
      message: `Payment ${status}`,
    };
  } catch (error) {
    console.error('[PaymentService] Error processing webhook:', error);

    // Log error event
    try {
      await db.insert(webhookEvents).values({
        id: uuidv4(),
        gateway: 'mercadopago',
        eventType: 'payment.error',
        paymentId,
        status: 'error',
        amount: '0',
        currency: 'ARS',
        signature: 'error',
        rawPayload: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (logError) {
      console.error('[PaymentService] Error logging webhook error:', logError);
    }

    return {
      success: false,
      message: 'Error processing webhook',
    };
  }
}

/**
 * Activate subscription after successful payment
 */
async function activateSubscription(
  userId: string,
  planType: string,
  isLifetime: boolean,
  externalPaymentId: string
): Promise<void> {
  try {
    // Get plan
    const foundPlans = await db.select({ id: plans.id })
      .from(plans)
      .where(eq(plans.type, planType as any))
      .limit(1);

    const planId = foundPlans[0]?.id || null;

    // Calculate end date
    let endDate: Date | undefined;
    const now = new Date();

    if (!isLifetime) {
      if (planType === 'PREMIUM_MONTHLY') {
        endDate = new Date(now.setMonth(now.getMonth() + 1));
      } else if (planType === 'PREMIUM_YEARLY') {
        endDate = new Date(now.setFullYear(now.getFullYear() + 1));
      }
    }

    // Deactivate existing subscriptions
    await db.update(subscriptions)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active')
        )
      );

    // Create new subscription
    await db.insert(subscriptions).values({
      id: uuidv4(),
      userId,
      planId,
      paymentGateway: 'mercadopago',
      externalPaymentId,
      status: 'active',
      startDate: new Date(),
      endDate,
      isLifetime,
    });

    // Update user's plan
    await db.update(users)
      .set({
        planType: planType as any,
        planStatus: 'active',
        currentPeriodEnd: endDate,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    console.log(`[PaymentService] Activated subscription for user ${userId}, plan: ${planType}`);
  } catch (error) {
    console.error('[PaymentService] Error activating subscription:', error);
    throw error;
  }
}

/**
 * Verify subscription status for a user
 */
export async function verifySubscription(userId: string): Promise<{
  isActive: boolean;
  planType: string;
  expiresAt?: Date;
  isLifetime: boolean;
}> {
  try {
    // Find active subscription
    const foundSubscriptions = await db.select({
      id: subscriptions.id,
      planType: subscriptions.planType,
      endDate: subscriptions.endDate,
      isLifetime: subscriptions.isLifetime,
    })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active')
        )
      )
      .orderBy(desc(subscriptions.endDate))
      .limit(1);

    if (foundSubscriptions.length === 0) {
      // Check user's direct plan
      const foundUsers = await db.select({
        planType: users.planType,
        planStatus: users.planStatus,
        currentPeriodEnd: users.currentPeriodEnd,
      })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const user = foundUsers[0];
      if (user && user.planType !== 'FREE' && user.planStatus === 'active') {
        return {
          isActive: true,
          planType: user.planType,
          expiresAt: user.currentPeriodEnd || undefined,
          isLifetime: user.planType === 'PREMIUM_LIFETIME',
        };
      }

      return {
        isActive: false,
        planType: 'FREE',
        isLifetime: false,
      };
    }

    const subscription = foundSubscriptions[0];

    // Check if expired
    if (subscription.endDate && subscription.endDate < new Date() && !subscription.isLifetime) {
      await db.update(subscriptions)
        .set({ status: 'cancelled' })
        .where(eq(subscriptions.id, subscription.id));

      return {
        isActive: false,
        planType: 'FREE',
        isLifetime: false,
      };
    }

    return {
      isActive: true,
      planType: subscription.planType || 'FREE',
      expiresAt: subscription.endDate || undefined,
      isLifetime: subscription.isLifetime,
    };
  } catch (error) {
    console.error('[PaymentService] Error verifying subscription:', error);
    return {
      isActive: false,
      planType: 'FREE',
      isLifetime: false,
    };
  }
}

/**
 * Log payment for MAJESTADALAN bypass
 */
export async function logMajestadAlanPayment(userId: string, paymentId: string): Promise<void> {
  try {
    await db.insert(paymentLogs).values({
      id: uuidv4(),
      userId,
      gateway: 'bypass',
      amount: '0',
      currency: 'USD',
      status: 'approved',
      rawPayload: JSON.stringify({
        type: 'majestadalan_usage',
        paymentId,
        timestamp: new Date().toISOString(),
      }),
      signature: 'majestadalan',
    });

    console.log(`[PaymentService] MAJESTADALAN payment logged for user ${userId}`);
  } catch (error) {
    console.error('[PaymentService] Error logging MAJESTADALAN payment:', error);
  }
}

export default {
  getPlanPricing,
  createCheckoutPreference,
  processWebhookPayment,
  verifySubscription,
  logMajestadAlanPayment,
};
