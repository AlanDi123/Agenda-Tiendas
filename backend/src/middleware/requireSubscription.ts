/**
 * Require Subscription Middleware
 * Protects routes that require an active subscription
 */

import { Request, Response, NextFunction } from 'express';
import { verifySubscription } from '../services/paymentService';
import { createError } from './errorHandler';

// ============================================
// TYPES
// ============================================

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Middleware to require an active subscription
 * Optionally checks for specific features based on plan type
 */
export async function requireSubscription(
  req: AuthRequest,
  res: Response,
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
    
    // Attach subscription info to request for downstream handlers
    (req as any).subscription = subscription;
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require specific plan type
 * @param allowedPlans Array of allowed plan types
 */
export function requirePlan(...allowedPlans: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
 * Middleware to require email verification
 */
export async function requireEmailVerification(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;
    
    if (!userId) {
      throw createError('Usuario no autenticado', 401, 'UNAUTHORIZED');
    }
    
    // Check user's email verification status
    const user = await req['prisma']?.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, email: true },
    });
    
    if (!user) {
      throw createError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }
    
    if (!user.emailVerified) {
      throw createError(
        'Debes verificar tu email para acceder a esta funcionalidad',
        403,
        'EMAIL_NOT_VERIFIED'
      );
    }
    
    next();
  } catch (error) {
    next(error);
  }
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
    // First check email verification
    await requireEmailVerification(req, res, (err) => {
      if (err) return next(err);
      
      // Then check subscription
      requireSubscription(req, res, next);
    });
  } catch (error) {
    next(error);
  }
}

export default {
  requireSubscription,
  requirePlan,
  requireEmailVerification,
  requireVerifiedSubscription,
};
