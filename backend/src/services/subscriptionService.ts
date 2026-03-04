/**
 * Subscription Service
 * Core business logic for subscription management
 */

import prisma from '../lib/prisma';
import { PlanType, PlanStatus } from '@prisma/client';
import { createError } from '../middleware/errorHandler';

const GRACE_PERIOD_HOURS = parseInt(process.env.GRACE_PERIOD_HOURS || '72', 10);

// ============================================
// FEATURE FLAGS BY PLAN
// ============================================

export const PLAN_FEATURES: Record<PlanType, Record<string, boolean>> = {
  FREE: {
    recurringEvents: false,
    alarms: false,
    dragAndDrop: false,
    editScope: false,
    export: false,
    unlimitedEvents: false,
    prioritySupport: false,
    advancedAnalytics: false,
  },
  PREMIUM_MONTHLY: {
    recurringEvents: true,
    alarms: true,
    dragAndDrop: true,
    editScope: true,
    export: true,
    unlimitedEvents: true,
    prioritySupport: false,
    advancedAnalytics: false,
  },
  PREMIUM_YEARLY: {
    recurringEvents: true,
    alarms: true,
    dragAndDrop: true,
    editScope: true,
    export: true,
    unlimitedEvents: true,
    prioritySupport: true,
    advancedAnalytics: true,
  },
  PREMIUM_LIFETIME: {
    recurringEvents: true,
    alarms: true,
    dragAndDrop: true,
    editScope: true,
    export: true,
    unlimitedEvents: true,
    prioritySupport: true,
    advancedAnalytics: true,
  },
};

// ============================================
// SUBSCRIPTION VERIFICATION
// ============================================

/**
 * Verify user's subscription status
 * This is the SINGLE SOURCE OF TRUTH for frontend
 */
export async function verifySubscription(userId: string): Promise<{
  planType: PlanType;
  planStatus: PlanStatus;
  expiresAt: Date | null;
  isLifetime: boolean;
  features: Record<string, boolean>;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        where: { status: 'active' },
        orderBy: { startDate: 'desc' },
        take: 1,
      },
    },
  });

  if (!user) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Check for lifetime subscription first (bypasses all date checks)
  const lifetimeSub = await prisma.subscription.findFirst({
    where: {
      userId,
      isLifetime: true,
      status: 'active',
    },
  });

  if (lifetimeSub) {
    return {
      planType: 'PREMIUM_LIFETIME',
      planStatus: 'active',
      expiresAt: null,
      isLifetime: true,
      features: PLAN_FEATURES['PREMIUM_LIFETIME'],
    };
  }

  // Check current subscription
  const activeSubscription = user.subscriptions[0];

  if (!activeSubscription || !user.currentPeriodEnd) {
    // No active subscription - return FREE
    return {
      planType: 'FREE',
      planStatus: 'active',
      expiresAt: null,
      isLifetime: false,
      features: PLAN_FEATURES['FREE'],
    };
  }

  const now = new Date();
  const periodEnd = user.currentPeriodEnd;
  const gracePeriodEnd = new Date(periodEnd.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);

  // Determine status based on dates
  let planStatus: PlanStatus = user.planStatus;

  if (now > gracePeriodEnd) {
    planStatus = 'expired';
    // Update user status
    await prisma.user.update({
      where: { id: userId },
      data: {
        planStatus: 'expired',
        planType: 'FREE',
      },
    });
  } else if (now > periodEnd) {
    planStatus = 'grace_period';
  }

  return {
    planType: user.planType,
    planStatus,
    expiresAt: periodEnd,
    isLifetime: false,
    features: PLAN_FEATURES[user.planType] || PLAN_FEATURES['FREE'],
  };
}

// ============================================
// SUBSCRIPTION ACTIVATION
// ============================================

/**
 * Activate subscription after successful payment
 */
export async function activateSubscription(
  userId: string,
  planType: PlanType,
  paymentGateway: string,
  externalPaymentId: string,
  startDate?: Date,
  endDate?: Date
): Promise<void> {
  const now = startDate || new Date();

  // Calculate end date based on plan type
  let calculatedEndDate: Date | null = null;
  let isLifetime = false;

  if (planType === 'PREMIUM_LIFETIME') {
    isLifetime = true;
    calculatedEndDate = null; // Lifetime has no expiration
  } else if (endDate) {
    calculatedEndDate = endDate;
  } else {
    // Default periods
    calculatedEndDate = new Date(now);
    if (planType === 'PREMIUM_MONTHLY') {
      calculatedEndDate.setMonth(calculatedEndDate.getMonth() + 1);
    } else if (planType === 'PREMIUM_YEARLY') {
      calculatedEndDate.setFullYear(calculatedEndDate.getFullYear() + 1);
    }
  }

  // Use transaction for atomic update
  await prisma.$transaction(async (tx: any) => {
    // Create or update subscription
    await tx.subscription.upsert({
      where: { externalPaymentId },
      update: {
        status: 'active',
        endDate: calculatedEndDate,
        updatedAt: now,
      },
      create: {
        userId,
        planType,
        paymentGateway,
        externalPaymentId,
        status: 'active',
        startDate: now,
        endDate: calculatedEndDate,
        isLifetime,
      },
    });

    // Update user
    await tx.user.update({
      where: { id: userId },
      data: {
        planType,
        planStatus: 'active',
        currentPeriodEnd: calculatedEndDate,
      },
    });
  });

  console.log(`Subscription activated: userId=${userId}, planType=${planType}`);
}

// ============================================
// SUBSCRIPTION CANCELLATION
// ============================================

/**
 * Cancel subscription (at period end, not immediate)
 */
export async function cancelSubscription(
  userId: string,
  reason?: string
): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    // Update active subscriptions
    await tx.subscription.updateMany({
      where: {
        userId,
        status: 'active',
        isLifetime: false, // Can't cancel lifetime
      },
      data: {
        status: 'cancelled',
      },
    });

    // Update user to grace period
    await tx.user.update({
      where: { id: userId },
      data: {
        planStatus: 'grace_period',
      },
    });
  });

  console.log(`Subscription cancelled: userId=${userId}, reason=${reason || 'user_request'}`);
}

// ============================================
// GRACE PERIOD CHECK
// ============================================

/**
 * Check and update grace period statuses
 * Should be run periodically (e.g., every hour)
 */
export async function processGracePeriods(): Promise<number> {
  const now = new Date();
  const graceThreshold = new Date(now.getTime() - GRACE_PERIOD_HOURS * 60 * 60 * 1000);

  // Find users in grace period whose grace has expired
  const expiredUsers = await prisma.user.findMany({
    where: {
      planStatus: 'grace_period',
      currentPeriodEnd: {
        lt: graceThreshold,
      },
    },
  });

  if (expiredUsers.length === 0) {
    return 0;
  }

  // Update to expired status
  await prisma.user.updateMany({
    where: {
      id: { in: expiredUsers.map((u: any) => u.id) },
    },
    data: {
      planStatus: 'expired',
      planType: 'FREE',
      currentPeriodEnd: null,
    },
  });

  console.log(`Processed ${expiredUsers.length} expired subscriptions`);
  return expiredUsers.length;
}

// ============================================
// LIFETIME SUBSCRIPTION
// ============================================

/**
 * Grant lifetime subscription (for special codes like MAJESTADALAN)
 */
export async function grantLifetimeSubscription(
  userId: string,
  paymentGateway: string = 'discount_code',
  externalPaymentId?: string
): Promise<void> {
  const now = new Date();
  const paymentId = externalPaymentId || `lifetime_${userId}_${Date.now()}`;

  await prisma.$transaction(async (tx: any) => {
    // Check if already has lifetime
    const existingLifetime = await tx.subscription.findFirst({
      where: {
        userId,
        isLifetime: true,
        status: 'active',
      },
    });

    if (existingLifetime) {
      // Already has lifetime, just ensure user is updated
      await tx.user.update({
        where: { id: userId },
        data: {
          planType: 'PREMIUM_LIFETIME',
          planStatus: 'active',
          currentPeriodEnd: null,
        },
      });
      return;
    }

    // Create lifetime subscription
    await tx.subscription.create({
      data: {
        userId,
        planType: 'PREMIUM_LIFETIME',
        paymentGateway,
        externalPaymentId: paymentId,
        status: 'active',
        startDate: now,
        endDate: null,
        isLifetime: true,
      },
    });

    // Update user
    await tx.user.update({
      where: { id: userId },
      data: {
        planType: 'PREMIUM_LIFETIME',
        planStatus: 'active',
        currentPeriodEnd: null,
      },
    });
  });

  console.log(`Lifetime subscription granted: userId=${userId}`);
}
