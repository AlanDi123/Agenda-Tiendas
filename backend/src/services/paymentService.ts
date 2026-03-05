/**
 * Payment Service
 * Handles Mercado Pago checkout and subscription management
 */

import MercadoPagoConfig, { Preference, Payment } from 'mercadopago';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { convertUsdToArs } from './currencyService';

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

export interface WebhookPaymentData {
  paymentId: string;
  status: string;
  amount: number;
  currency: string;
  externalReference?: string;
}

// ============================================
// PLAN PRICING
// ============================================

const PLAN_PRICES: Record<string, { usd: number; interval: 'monthly' | 'yearly' | 'lifetime' }> = {
  PREMIUM_MONTHLY: { usd: 9.99, interval: 'monthly' },
  PREMIUM_YEARLY: { usd: 99.99, interval: 'yearly' },
  PREMIUM_LIFETIME: { usd: 199.99, interval: 'lifetime' },
};

// ============================================
// FUNCTIONS
// ============================================

/**
 * Get plan pricing with ARS conversion
 */
export async function getPlanPricing(planType: string): Promise<PlanPricing | null> {
  const plan = PLAN_PRICES[planType];
  if (!plan) return null;
  
  const priceArs = await convertUsdToArs(plan.usd);
  
  return {
    planType,
    priceUsd: plan.usd,
    priceArs,
    interval: plan.interval,
    description: getPlanDescription(planType),
  };
}

/**
 * Get human-readable plan description
 */
function getPlanDescription(planType: string): string {
  const descriptions: Record<string, string> = {
    PREMIUM_MONTHLY: 'Suscripción Mensual Premium',
    PREMIUM_YEARLY: 'Suscripción Anual Premium (2 meses gratis)',
    PREMIUM_LIFETIME: 'Acceso de por vida',
  };
  return descriptions[planType] || 'Suscripción Premium';
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      return {
        success: false,
        message: 'Usuario no encontrado',
      };
    }
    
    // Get plan pricing
    const pricing = await getPlanPricing(planType);
    if (!pricing) {
      return {
        success: false,
        message: 'Plan no válido',
      };
    }
    
    // Apply discount if provided
    let finalPriceUsd = pricing.priceUsd;
    let discountAmount = 0;
    
    if (discountCode) {
      const discount = await prisma.discountCode.findUnique({
        where: { code: discountCode },
      });
      
      if (discount && discount.active && (!discount.expiresAt || discount.expiresAt > new Date())) {
        if (discount.type === 'percentage') {
          discountAmount = finalPriceUsd * (discount.value / 100);
        } else if (discount.type === 'fixed') {
          discountAmount = discount.value;
        }
        finalPriceUsd = Math.max(0, finalPriceUsd - discountAmount);
      }
    }
    
    // Convert to ARS for Mercado Pago (Argentina)
    const finalPriceArs = await convertUsdToArs(finalPriceUsd);
    
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
        originalPriceUsd: pricing.priceUsd,
        finalPriceUsd,
        discountAmount,
      },
      notification_url: `${BACKEND_BASE_URL}/api/webhooks/mercadopago`,
    };
    
    const result = await preference.create({ body: preferenceData });
    
    // Store payment record
    await prisma.payment.create({
      data: {
        id: uuidv4(),
        userId,
        amount: finalPriceUsd,
        currency: 'USD',
        amountARS: finalPriceArs,
        status: 'pending',
        gateway: 'mercadopago',
        preferenceId: result.id,
        planType: planType as any,
        isLifetime: planType === 'PREMIUM_LIFETIME',
        discountCode: discountCode || null,
        discountAmount,
        metadata: JSON.stringify(preferenceData.metadata),
      },
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
    
    // Find the payment record by preference_id
    const paymentRecord = await prisma.payment.findFirst({
      where: {
        preferenceId: paymentId,
      },
    });
    
    if (!paymentRecord) {
      // Create new payment record if not found
      console.log('[PaymentService] Payment record not found, creating new one');
    }
    
    // Update or create payment record
    const updatedPayment = await prisma.payment.upsert({
      where: {
        id: paymentRecord?.id || uuidv4(),
      },
      create: {
        id: uuidv4(),
        userId: externalReference || '',
        amount: currency === 'USD' ? amount : amount / 1000, // Approximate conversion
        currency: currency === 'USD' ? 'USD' : 'ARS',
        amountARS: currency === 'ARS' ? amount : undefined,
        status: status as any,
        gateway: 'mercadopago',
        externalPaymentId: paymentId,
        planType: paymentRecord?.planType,
        isLifetime: paymentRecord?.isLifetime || false,
      },
      update: {
        status: status as any,
        externalPaymentId: paymentId,
        updatedAt: new Date(),
      },
    });
    
    // If payment is approved, activate subscription
    if (status === 'approved' && updatedPayment.userId && updatedPayment.planType) {
      await activateSubscription(
        updatedPayment.userId,
        updatedPayment.planType as any,
        updatedPayment.isLifetime,
        paymentId
      );
    }
    
    // Log webhook event
    await prisma.webhookEvent.create({
      data: {
        id: uuidv4(),
        gateway: 'mercadopago',
        eventType: 'payment.updated',
        paymentId,
        status,
        amount,
        currency,
        signature: 'verified',
        rawPayload: JSON.stringify(paymentData),
        processed: true,
      },
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
      await prisma.webhookEvent.create({
        data: {
          id: uuidv4(),
          gateway: 'mercadopago',
          eventType: 'payment.error',
          paymentId,
          status: 'error',
          amount: 0,
          currency: 'ARS',
          signature: 'error',
          rawPayload: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
          processed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
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
    // Calculate end date based on plan type
    let endDate: Date | undefined;
    const now = new Date();
    
    if (!isLifetime) {
      if (planType === 'PREMIUM_MONTHLY') {
        endDate = new Date(now.setMonth(now.getMonth() + 1));
      } else if (planType === 'PREMIUM_YEARLY') {
        endDate = new Date(now.setFullYear(now.getFullYear() + 1));
      }
    }
    
    // Create or update subscription
    await prisma.subscription.upsert({
      where: {
        externalPaymentId,
      },
      create: {
        id: uuidv4(),
        userId,
        planType: planType as any,
        paymentGateway: 'mercadopago',
        externalPaymentId,
        status: 'active',
        startDate: new Date(),
        endDate,
        isLifetime,
      },
      update: {
        status: 'active',
        endDate,
        updatedAt: new Date(),
      },
    });
    
    // Update user's plan type
    await prisma.user.update({
      where: { id: userId },
      data: {
        planType: planType as any,
        planStatus: 'active',
        currentPeriodEnd: endDate,
      },
    });
    
    console.log(`[PaymentService] Activated subscription for user ${userId}, plan: ${planType}`);
  } catch (error) {
    console.error('[PaymentService] Error activating subscription:', error);
    throw error;
  }
}

/**
 * Verify subscription status for a user
 */
export async function verifySubscription(userId: string, feature?: string): Promise<{
  isActive: boolean;
  planType: string;
  expiresAt?: Date;
  isLifetime: boolean;
}> {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
      },
      orderBy: {
        endDate: 'desc',
      },
    });
    
    if (!subscription) {
      // Check if user has planType set directly (legacy)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { planType: true, planStatus: true, currentPeriodEnd: true },
      });
      
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
    
    // Check if subscription is expired
    if (subscription.endDate && subscription.endDate < new Date() && !subscription.isLifetime) {
      // Update subscription status
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'expired' },
      });
      
      return {
        isActive: false,
        planType: 'FREE',
        isLifetime: false,
      };
    }
    
    return {
      isActive: true,
      planType: subscription.planType,
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

export default {
  getPlanPricing,
  createCheckoutPreference,
  processWebhookPayment,
  verifySubscription,
};
