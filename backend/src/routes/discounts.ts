/**
 * Discount Routes
 * Handles discount code validation and application
 * Uses Drizzle ORM
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateDiscountCode, applyDiscount, getMajestadAlanStats } from '../services/discountService';
import { createError } from '../middleware/errorHandler';
import type { AuthRequest } from '../middleware/auth';

const router = Router();

// ============================================
// VALIDATE DISCOUNT CODE
// ============================================

/**
 * POST /api/v1/discounts/validate
 * Validate a discount code
 */
router.post('/validate', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { code } = req.body;

    if (!userId) {
      throw createError('Usuario no autenticado', 401, 'UNAUTHORIZED');
    }

    if (!code) {
      throw createError('Código requerido', 400, 'VALIDATION_ERROR');
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
// APPLY DISCOUNT
// ============================================

/**
 * POST /api/v1/discounts/apply
 * Apply discount to a payment
 */
router.post('/apply', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { code, paymentId } = req.body;

    if (!userId) {
      throw createError('Usuario no autenticado', 401, 'UNAUTHORIZED');
    }

    if (!code || !paymentId) {
      throw createError('Código y paymentId requeridos', 400, 'VALIDATION_ERROR');
    }

    const result = await applyDiscount(userId, code, paymentId);

    res.json({
      success: result.success,
      message: result.message,
      discountAmount: result.discountAmount,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN: MAJESTADALAN STATS
// ============================================

/**
 * GET /api/v1/discounts/majestadalan/stats
 * Get MAJESTADALAN usage statistics (admin only)
 */
router.get('/majestadalan/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getMajestadAlanStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

export { router as discountRoutes };
