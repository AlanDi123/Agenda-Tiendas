/**
 * Subscription Service
 * Handles subscription verification and management
 * Uses Drizzle ORM with Neon PostgreSQL
 */

import { eq, and, desc } from 'drizzle-orm';
import db from '../db';
import { subscriptions, users, plans } from '../db/schema';

// ============================================
// TYPES
// ============================================

export interface SubscriptionStatus {
  isActive: boolean;
  planType: string;
  expiresAt?: Date;
  isLifetime: boolean;
}

// ============================================
// FUNCTIONS
// ============================================

/**
 * Get subscription status for a user
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
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
    console.error('[SubscriptionService] Error getting subscription status:', error);
    return {
      isActive: false,
      planType: 'FREE',
      isLifetime: false,
    };
  }
}

/**
 * Check if user has active subscription for a specific feature
 */
export async function verifySubscription(
  userId: string,
  feature?: string
): Promise<{
  isActive: boolean;
  planType: string;
  message?: string;
}> {
  const status = await getSubscriptionStatus(userId);

  if (!status.isActive) {
    return {
      isActive: false,
      planType: 'FREE',
      message: 'Se requiere una suscripción activa',
    };
  }

  // Check feature-specific requirements
  if (feature) {
    const premiumFeatures = ['recurring_events', 'custom_alarms', 'unlimited_profiles'];
    
    if (premiumFeatures.includes(feature) && status.planType === 'FREE') {
      return {
        isActive: false,
        planType: 'FREE',
        message: `La función "${feature}" requiere una suscripción Premium`,
      };
    }
  }

  return {
    isActive: true,
    planType: status.planType,
  };
}

/**
 * Get available plans
 */
export async function getAvailablePlans(): Promise<Array<{
  id: string;
  name: string;
  type: string;
  priceUsd: string;
  priceArs: string | null;
  features: string[];
  interval: string;
}>> {
  try {
    const foundPlans = await db.select({
      id: plans.id,
      name: plans.name,
      type: plans.type,
      priceUsd: plans.priceUsd,
      priceArs: plans.priceArs,
      features: plans.features,
      interval: plans.interval,
    })
      .from(plans)
      .where(eq(plans.active, true))
      .orderBy(plans.priceUsd);

    return foundPlans.map((plan: (typeof foundPlans)[number]) => ({
      ...plan,
      features: JSON.parse(plan.features),
    }));
  } catch (error) {
    console.error('[SubscriptionService] Error getting plans:', error);
    return [];
  }
}

/**
 * Cancel user subscription
 */
export async function cancelSubscription(userId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Find active subscription
    const foundSubscriptions = await db.select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    if (foundSubscriptions.length === 0) {
      return {
        success: false,
        message: 'No hay suscripción activa para cancelar',
      };
    }

    // Update subscription status
    await db.update(subscriptions)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, foundSubscriptions[0].id));

    // Update user plan
    await db.update(users)
      .set({
        planStatus: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return {
      success: true,
      message: 'Suscripción cancelada exitosamente',
    };
  } catch (error) {
    console.error('[SubscriptionService] Error canceling subscription:', error);
    return {
      success: false,
      message: 'Error al cancelar suscripción',
    };
  }
}

export default {
  getSubscriptionStatus,
  verifySubscription,
  getAvailablePlans,
  cancelSubscription,
};
