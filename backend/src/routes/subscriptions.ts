/**
 * Subscription Routes
 * Handles subscription verification and management
 * Uses Drizzle ORM
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireSubscription } from '../middleware/requireSubscription';
import { getSubscriptionStatus, getAvailablePlans, cancelSubscription } from '../services/subscriptionService';
import { createCheckoutPreference } from '../services/paymentService';
import { validateDiscountCode, MAJESTADALAN_CODE } from '../services/discountService';
import { createError } from '../middleware/errorHandler';
import type { AuthRequest } from '../middleware/auth';

const router = Router();

// ============================================
// SUBSCRIPTION STATUS
// ============================================

/**
 * GET /api/v1/subscriptions/status
 * Get current user's subscription status
 */
router.get('/status', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;

    if (!userId) {
      throw createError('Usuario no autenticado', 401, 'UNAUTHORIZED');
    }

    const status = await getSubscriptionStatus(userId);

    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/subscriptions/plans
 * Get available subscription plans
 */
router.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await getAvailablePlans();

    res.json({
      success: true,
      data: { plans },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CHECKOUT
// ============================================

/**
 * POST /api/v1/subscriptions/checkout
 * Create checkout session for subscription
 */
router.post('/checkout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { planType, discountCode } = req.body;

    if (!userId) {
      throw createError('Usuario no autenticado', 401, 'UNAUTHORIZED');
    }

    if (!planType) {
      throw createError('Plan type required', 400, 'VALIDATION_ERROR');
    }

    // Special handling for MAJESTADALAN
    if (discountCode?.toUpperCase() === MAJESTADALAN_CODE) {
      // For MAJESTADALAN, we'll handle it via webhook after payment
      // This is a simplified approach - in production you'd want more validation
      const { logMajestadAlanPayment } = await import('../services/paymentService');
      const { v4: uuidv4 } = await import('uuid');
      const paymentId = uuidv4();

      await logMajestadAlanPayment(userId, paymentId);

      return res.json({
        success: true,
        data: {
          message: 'Código MAJESTADALAN validado. Procediendo con activación.',
          paymentId,
          isLifetime: true,
        },
      });
    }

    const result = await createCheckoutPreference(userId, planType, discountCode);

    if (!result.success) {
      throw createError(result.message || 'Error creating checkout', 400, 'CHECKOUT_ERROR');
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DISCOUNT VALIDATION
// ============================================

/**
 * POST /api/v1/subscriptions/discounts/validate
 * Validate discount code
 */
router.post('/discounts/validate', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { code } = req.body;

    if (!userId || !code) {
      throw createError('Code required', 400, 'VALIDATION_ERROR');
    }

    const result = await validateDiscountCode(code, userId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CANCEL SUBSCRIPTION
// ============================================

/**
 * POST /api/v1/subscriptions/cancel
 * Cancel current subscription
 */
router.post('/cancel', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cancelSubscription((req as AuthRequest).userId!);

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PREMIUM FEATURE GATE
// ============================================

/**
 * GET /api/v1/subscriptions/verify
 * Verify subscription for specific feature
 */
router.get('/verify', authMiddleware, requireSubscription, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscription = (req as any).subscription;

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
});

export { router as subscriptionRoutes };
