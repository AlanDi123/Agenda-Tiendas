// Subscription Service
// Handles subscription management, plan enforcement, and discount codes

import { getDB } from './database';
import { generateId } from '../utils/helpers';
import { AppLogger } from './logger';
import type {
  Subscription,
  Payment,
  DiscountCode,
  UserDiscountUsage,
  PlanType,
  PaymentSession,
  WebhookEvent,
} from '../types/payment';
import { SUBSCRIPTION_PLANS, DEFAULT_DISCOUNT_CODES, PLAN_FEATURES } from '../types/payment';

// ============ SUBSCRIPTION MANAGEMENT ============

/**
 * Get or create user subscription
 */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const db = await getDB();
  const subscriptions = await db.getAll('subscriptions');
  
  const userSubs = subscriptions.filter(s => s.userId === userId);
  
  if (userSubs.length === 0) {
    return null;
  }

  // Return the most recent active subscription
  const activeSub = userSubs.find(s => s.status === 'active');
  if (activeSub) {
    return activeSub;
  }

  // Return the most recent subscription
  return userSubs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

/**
 * Check if user has premium access
 */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return false;
  }

  // Lifetime never expires
  if (subscription.planType === 'PREMIUM_LIFETIME') {
    return subscription.status === 'active';
  }

  // Check if subscription is still valid
  if (subscription.currentPeriodEnd) {
    return subscription.status === 'active' && 
           new Date(subscription.currentPeriodEnd) > new Date();
  }

  return false;
}

/**
 * Check if user has access to a specific premium feature
 */
export async function hasFeatureAccess(userId: string, feature: keyof typeof PLAN_FEATURES['FREE']): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription || subscription.status !== 'active') {
    return false;
  }

  const features = PLAN_FEATURES[subscription.planType];
  return features[feature];
}

/**
 * Get user's plan type
 */
export async function getUserPlan(userId: string): Promise<PlanType> {
  const hasPremium = await hasPremiumAccess(userId);
  
  if (!hasPremium) {
    return 'FREE';
  }

  const subscription = await getUserSubscription(userId);
  return subscription?.planType || 'FREE';
}

/**
 * Create new subscription
 */
export async function createSubscription(
  userId: string,
  planType: PlanType,
  discountCode?: string,
  discountAmount?: number
): Promise<Subscription> {
  const db = await getDB();
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planType);
  
  if (!plan) {
    throw new Error('Plan not found');
  }

  const now = new Date();
  let currentPeriodEnd: Date | undefined;

  // Calculate period end based on plan type
  if (planType === 'PREMIUM_LIFETIME') {
    currentPeriodEnd = undefined; // Lifetime has no expiration
  } else if (plan.interval === 'monthly') {
    currentPeriodEnd = new Date(now);
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + plan.intervalCount);
  } else if (plan.interval === 'yearly') {
    currentPeriodEnd = new Date(now);
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + plan.intervalCount);
  }

  const subscription: Subscription = {
    id: generateId(),
    userId,
    planType,
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
    discountCode,
    discountAmount,
    createdAt: now,
    updatedAt: now,
  };

  await db.put('subscriptions', subscription);

  AppLogger.logUserAction('subscription_created', {
    subscriptionId: subscription.id,
    planType,
    discountCode,
  });

  return subscription;
}

/**
 * Update subscription status
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: Subscription['status']
): Promise<void> {
  const db = await getDB();
  const subscription = await db.get('subscriptions', subscriptionId);
  
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  subscription.status = status;
  subscription.updatedAt = new Date();

  await db.put('subscriptions', subscription);

  AppLogger.info(`Subscription status updated: ${status}`, { subscriptionId }, 'Subscription');
}

/**
 * Cancel subscription (at period end)
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const db = await getDB();
  const subscription = await db.get('subscriptions', subscriptionId);
  
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Lifetime subscriptions cannot be cancelled
  if (subscription.planType === 'PREMIUM_LIFETIME') {
    throw new Error('Lifetime subscriptions cannot be cancelled');
  }

  subscription.cancelAtPeriodEnd = true;
  subscription.canceledAt = new Date();
  subscription.updatedAt = new Date();

  await db.put('subscriptions', subscription);

  AppLogger.logUserAction('subscription_cancelled', {
    subscriptionId,
    planType: subscription.planType,
  });
}

/**
 * Reactivate cancelled subscription
 */
export async function reactivateSubscription(subscriptionId: string): Promise<void> {
  const db = await getDB();
  const subscription = await db.get('subscriptions', subscriptionId);
  
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  subscription.cancelAtPeriodEnd = false;
  subscription.canceledAt = undefined;
  subscription.updatedAt = new Date();

  await db.put('subscriptions', subscription);

  AppLogger.logUserAction('subscription_reactivated', { subscriptionId });
}

// ============ DISCOUNT CODES ============

/**
 * Validate and apply discount code
 */
export async function applyDiscountCode(
  code: string,
  planType: PlanType,
  userId: string,
  amount: number
): Promise<{ valid: boolean; discountAmount: number; error?: string }> {
  const db = await getDB();
  const normalizedCode = code.toUpperCase().trim();

  // Special handling for MAJESTADALAN
  if (normalizedCode === 'MAJESTADALAN') {
    if (planType !== 'PREMIUM_LIFETIME') {
      return {
        valid: false,
        discountAmount: 0,
        error: 'Este código solo es válido para Premium Vitalicio',
      };
    }
    return {
      valid: true,
      discountAmount: amount, // 100% discount
    };
  }

  // Get discount code from database
  const discountCode = await db.get('discountCodes', normalizedCode);
  
  if (!discountCode) {
    return {
      valid: false,
      discountAmount: 0,
      error: 'Código inválido',
    };
  }

  // Check if code is active
  if (!discountCode.active) {
    return {
      valid: false,
      discountAmount: 0,
      error: 'Código desactivado',
    };
  }

  // Check expiration
  if (discountCode.expiresAt && new Date(discountCode.expiresAt) < new Date()) {
    return {
      valid: false,
      discountAmount: 0,
      error: 'Código expirado',
    };
  }

  // Check usage limit
  if (discountCode.maxUses && discountCode.maxUses > 0 && discountCode.usedCount >= discountCode.maxUses) {
    return {
      valid: false,
      discountAmount: 0,
      error: 'Código agotado',
    };
  }

  // Check applicable plans
  if (discountCode.applicablePlans.length > 0 && 
      !discountCode.applicablePlans.includes(planType)) {
    return {
      valid: false,
      discountAmount: 0,
      error: 'Código no válido para este plan',
    };
  }

  // Check minimum amount
  if (discountCode.minAmount && amount < discountCode.minAmount) {
    return {
      valid: false,
      discountAmount: 0,
      error: `Mínimo de $${discountCode.minAmount} requerido`,
    };
  }

  // Check per-user limit
  if (discountCode.perUserLimit && discountCode.perUserLimit > 0) {
    const userUsage = await db.getAllFromIndex('userDiscountUsage', 'by-user', userId);
    const codeUsage = userUsage.filter(u => u.discountCode === normalizedCode);

    if (codeUsage.length >= discountCode.perUserLimit) {
      return {
        valid: false,
        discountAmount: 0,
        error: 'Ya usaste este código',
      };
    }
  }

  // Calculate discount amount
  let discountAmount: number;
  if (discountCode.type === 'percentage') {
    discountAmount = (amount * discountCode.value) / 100;
  } else {
    discountAmount = Math.min(discountCode.value, amount);
  }

  return {
    valid: true,
    discountAmount,
  };
}

/**
 * Record discount code usage
 */
export async function recordDiscountUsage(
  userId: string,
  discountCode: string,
  paymentId: string
): Promise<void> {
  const db = await getDB();
  const normalizedCode = discountCode.toUpperCase().trim();

  // Record user usage
  const usage: UserDiscountUsage = {
    userId,
    discountCode: normalizedCode,
    usedAt: new Date(),
    paymentId,
  };

  await db.put('userDiscountUsage', usage);

  // Increment code usage count
  const code = await db.get('discountCodes', normalizedCode);
  if (code && code.maxUses && code.maxUses > 0) {
    code.usedCount++;
    await db.put('discountCodes', code);
  }

  AppLogger.info('Discount code used', { userId, discountCode, paymentId }, 'Discount');
}

/**
 * Initialize default discount codes (run once on app start)
 */
export async function initializeDiscountCodes(): Promise<void> {
  const db = await getDB();
  
  for (const codeData of DEFAULT_DISCOUNT_CODES) {
    const existing = await db.get('discountCodes', codeData.code);
    
    if (!existing) {
      const code: DiscountCode = {
        ...codeData,
        usedCount: 0,
        createdAt: new Date(),
      };
      await db.put('discountCodes', code);
    }
  }
}

// ============ PAYMENT SESSIONS ============

/**
 * Create payment session for checkout
 */
export async function createPaymentSession(
  userId: string,
  planType: PlanType,
  discountCode?: string
): Promise<PaymentSession> {
  const db = await getDB();
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planType);
  
  if (!plan) {
    throw new Error('Plan no encontrado');
  }

  const originalAmount = plan.price;
  let discountAmount = 0;

  // Apply discount code if provided
  if (discountCode) {
    const result = await applyDiscountCode(discountCode, planType, userId, originalAmount);
    if (result.valid) {
      discountAmount = result.discountAmount;
    }
  }

  const session: PaymentSession = {
    id: generateId(),
    userId,
    planType,
    amount: originalAmount - discountAmount,
    originalAmount,
    discountAmount,
    discountCode,
    currency: plan.currency,
    status: 'pending',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    createdAt: new Date(),
  };

  await db.put('paymentSessions', session);

  AppLogger.info('Payment session created', {
    sessionId: session.id,
    userId,
    planType,
    amount: session.amount,
  }, 'Payment');

  return session;
}

/**
 * Get payment session
 */
export async function getPaymentSession(sessionId: string): Promise<PaymentSession | null> {
  const db = await getDB();
  const session = await db.get('paymentSessions', sessionId);
  return session || null;
}

/**
 * Update payment session status
 */
export async function updatePaymentSessionStatus(
  sessionId: string,
  status: PaymentSession['status'],
  gatewayPaymentId?: string
): Promise<void> {
  const db = await getDB();
  const session = await db.get('paymentSessions', sessionId);
  
  if (!session) {
    throw new Error('Payment session not found');
  }

  session.status = status;
  if (gatewayPaymentId) {
    session.gatewayPaymentId = gatewayPaymentId;
  }

  await db.put('paymentSessions', session);
}

/**
 * Expire old payment sessions
 */
export async function expireOldSessions(): Promise<void> {
  const db = await getDB();
  const sessions = await db.getAll('paymentSessions');
  const now = new Date();

  for (const session of sessions) {
    if (session.status === 'pending' && new Date(session.expiresAt) < now) {
      session.status = 'expired';
      await db.put('paymentSessions', session);
    }
  }
}

// ============ PAYMENT RECORDING ============

/**
 * Record a payment
 */
export async function recordPayment(payment: Payment): Promise<void> {
  const db = await getDB();
  await db.put('payments', payment);

  AppLogger.info('Payment recorded', {
    paymentId: payment.id,
    userId: payment.userId,
    amount: payment.amount,
    status: payment.status,
    method: payment.paymentMethod,
  }, 'Payment');
}

/**
 * Get user payment history
 */
export async function getUserPayments(userId: string): Promise<Payment[]> {
  const db = await getDB();
  const payments = await db.getAll('payments');
  return payments.filter(p => p.userId === userId);
}

/**
 * Get payment by transaction ID
 */
export async function getPaymentByTransactionId(transactionId: string): Promise<Payment | null> {
  const db = await getDB();
  const payments = await db.getAll('payments');
  return payments.find(p => p.transactionId === transactionId) || null;
}

// ============ WEBHOOK HANDLING ============

function gatewayResponseFromRaw(raw: unknown): Record<string, unknown> | undefined {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return undefined;
}

/**
 * Process webhook event from payment gateway
 */
export async function processWebhookEvent(event: WebhookEvent): Promise<void> {
  const db = await getDB();

  AppLogger.info('Webhook event received', {
    gateway: event.gateway,
    eventType: event.eventType,
    paymentId: event.paymentId,
    status: event.status,
  }, 'Webhook');

  // Find or create payment record
  let payment = await getPaymentByTransactionId(event.transactionId);

  if (!payment && event.userId) {
    const newPayment: Payment = {
      id: generateId(),
      userId: event.userId,
      amount: event.amount,
      originalAmount: event.amount,
      discountAmount: 0,
      currency: event.currency,
      status: event.status,
      paymentMethod: event.gateway,
      transactionId: event.transactionId,
      gatewayResponse: gatewayResponseFromRaw(event.rawEvent),
      createdAt: event.timestamp,
    };

    if (event.status === 'completed') {
      newPayment.completedAt = event.timestamp;
    }

    await recordPayment(newPayment);
    payment = newPayment;
  } else if (payment) {
    // Update existing payment
    payment.status = event.status;
    const rawSlice = gatewayResponseFromRaw(event.rawEvent);
    payment.gatewayResponse = {
      ...(payment.gatewayResponse ?? {}),
      ...(rawSlice ?? {}),
    };

    if (event.status === 'completed' && !payment.completedAt) {
      payment.completedAt = event.timestamp;
    }

    await db.put('payments', payment);
  }

  // Handle payment completion
  if (event.status === 'completed' && payment && event.userId) {
    await activateSubscriptionFromPayment(payment);
  }

  // Handle payment failure
  if (event.status === 'failed' && payment) {
    AppLogger.warn('Payment failed', {
      paymentId: payment.id,
      reason: payment.failureReason,
    }, 'Payment');
  }
}

/**
 * Activate subscription from completed payment
 */
async function activateSubscriptionFromPayment(payment: Payment): Promise<void> {
  const db = await getDB();
  
  // Get payment session to determine plan
  const sessions = await db.getAll('paymentSessions');
  const session = sessions.find(s => 
    s.gatewayPaymentId === payment.transactionId || 
    (payment.subscriptionId && s.id === payment.subscriptionId)
  );

  if (!session) {
    AppLogger.error('No session found for payment', { paymentId: payment.id }, 'Payment');
    return;
  }

  // Check if user already has an active subscription
  const existingSub = await getUserSubscription(payment.userId);
  
  if (existingSub && existingSub.status === 'active') {
    // Extend existing subscription
    if (existingSub.planType !== 'PREMIUM_LIFETIME' && existingSub.currentPeriodEnd) {
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === session.planType);
      const currentEnd = new Date(existingSub.currentPeriodEnd);
      const newEnd = new Date(currentEnd);
      
      if (plan?.interval === 'monthly') {
        newEnd.setMonth(newEnd.getMonth() + plan.intervalCount);
      } else if (plan?.interval === 'yearly') {
        newEnd.setFullYear(newEnd.getFullYear() + plan.intervalCount);
      }
      
      existingSub.currentPeriodEnd = newEnd;
      existingSub.updatedAt = new Date();
      
      await db.put('subscriptions', existingSub);
      
      AppLogger.info('Subscription extended', {
        subscriptionId: existingSub.id,
        newEnd: newEnd,
      }, 'Subscription');
    }
    return;
  }

  // Create new subscription
  await createSubscription(
    payment.userId,
    session.planType,
    session.discountCode,
    session.discountAmount
  );

  AppLogger.info('Subscription activated from payment', {
    userId: payment.userId,
    planType: session.planType,
  }, 'Subscription');
}

// ============ PLAN ENFORCEMENT ============

/**
 * Check and enforce plan restrictions
 * Returns true if access is allowed
 */
export async function checkPlanAccess(
  userId: string,
  feature: 'recurringEvents' | 'alarms' | 'dragAndDrop' | 'editScope' | 'export' | 'unlimitedEvents'
): Promise<{ allowed: boolean; requiredPlan?: PlanType }> {
  const hasAccess = await hasFeatureAccess(userId, feature);
  
  if (hasAccess) {
    return { allowed: true };
  }

  // Determine required plan
  let requiredPlan: PlanType = 'PREMIUM_MONTHLY';
  
  for (const plan of SUBSCRIPTION_PLANS) {
    if (PLAN_FEATURES[plan.id][feature]) {
      requiredPlan = plan.id;
      break;
    }
  }

  return {
    allowed: false,
    requiredPlan,
  };
}

/**
 * Get upgrade prompt message for a feature
 */
export function getUpgradePrompt(feature: string): string {
  const prompts: Record<string, string> = {
    recurringEvents: 'Los eventos recurrentes están disponibles en planes Premium',
    alarms: 'Las alarmas y recordatorios están disponibles en planes Premium',
    dragAndDrop: 'El arrastrar y soltar está disponible en planes Premium',
    editScope: 'La edición de múltiples eventos está disponible en planes Premium',
    export: 'La exportación de agenda está disponible en planes Premium',
  };

  return prompts[feature] || 'Esta función está disponible en planes Premium';
}
