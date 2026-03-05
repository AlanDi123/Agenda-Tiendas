/**
 * Require Subscription Middleware
 * Protects routes that require an active subscription
 * Uses Drizzle ORM
 */

import { Response, NextFunction } from 'express';
import { verifySubscription } from '../services/subscriptionService';
import { createError } from './errorHandler';
import type { AuthRequest } from './auth';

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Middleware to require an active subscription
 */
export async function requireSubscription(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      throw createError('Usuario no autenticado', 401, 'UNAUTHORIZED');
    }

    // Verify subscription
    const subscription = await verifySubscription(userId);

    if (!subscription.isActive) {
      throw createError(
        'Se requiere una suscripción activa para acceder a esta funcionalidad',
        403,
        'SUBSCRIPTION_REQUIRED'
      );
    }

    // Attach subscription info to request
    (req as any).subscription = subscription;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require specific plan type
 */
export function requirePlan(...allowedPlans: string[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const subscription = (req as any).subscription;

      if (!subscription) {
        throw createError('Información de suscripción no disponible', 500, 'INTERNAL_ERROR');
      }

      if (!allowedPlans.includes(subscription.planType)) {
        throw createError(
          `Esta funcionalidad requiere uno de los siguientes planes: ${allowedPlans.join(', ')}`,
          403,
          'PLAN_UPGRADE_REQUIRED'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Combined middleware: require both email verification and subscription
 */
export async function requireVerifiedSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (!req.user.emailVerified) {
      throw createError('Email verification required', 403, 'EMAIL_NOT_VERIFIED');
    }

    await requireSubscription(req, res, next);
  } catch (error) {
    next(error);
  }
}

export default {
  requireSubscription,
  requirePlan,
  requireVerifiedSubscription,
};
