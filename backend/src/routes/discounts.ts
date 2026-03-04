/**
 * Discount Code Routes
 * Handles discount code validation and application
 */

import { Router } from 'express';
import { z } from 'zod';
import { validateDiscountCode, isMajestadAlanCode } from '../services/discountService';
import { grantLifetimeSubscription } from '../services/subscriptionService';

const router = Router();

// ============================================
// APPLY DISCOUNT CODE
// ============================================

const applySchema = z.object({
  userId: z.string().uuid(),
  code: z.string().min(1).max(50),
  planType: z.enum(['FREE', 'PREMIUM_MONTHLY', 'PREMIUM_YEARLY', 'PREMIUM_LIFETIME']),
  amount: z.number().positive(),
});

/**
 * POST /api/discounts/apply
 * Validate and apply discount code
 * 
 * Request:
 * {
 *   "userId": "uuid",
 *   "code": "MAJESTADALAN",
 *   "planType": "PREMIUM_LIFETIME",
 *   "amount": 199.99
 * }
 * 
 * Response (success):
 * {
 *   "success": true,
 *   "data": {
 *     "valid": true,
 *     "code": "MAJESTADALAN",
 *     "type": "percentage",
 *     "value": 100,
 *     "discountAmount": 199.99,
 *     "finalAmount": 0,
 *     "isLifetime": true,
 *     "requiresPayment": false
 *   }
 * }
 */
router.post('/apply', async (req, res, next) => {
  try {
    const { userId, code, planType, amount } = applySchema.parse(req.body);

    const result = await validateDiscountCode(code, userId, planType, amount);

    if (!result.valid) {
      return res.json({
        success: false,
        error: result.error,
      });
    }

    const finalAmount = Math.max(0, amount - (result.discountAmount || 0));
    const requiresPayment = finalAmount > 0;

    // Special handling for MAJESTADALAN - grant lifetime immediately
    if (result.isLifetime && !requiresPayment) {
      await grantLifetimeSubscription(userId, 'discount_code', `discount_${code}_${Date.now()}`);
    }

    return res.json({
      success: true,
      data: {
        valid: result.valid,
        code: result.code,
        type: result.type,
        value: result.value,
        discountAmount: result.discountAmount,
        finalAmount,
        isLifetime: result.isLifetime || false,
        requiresPayment,
      },
    });
  } catch (error) {
    next(error);
    return;
  }
});

// ============================================
// CHECK CODE (without applying)
// ============================================

const checkSchema = z.object({
  code: z.string().min(1).max(50),
});

/**
 * POST /api/discounts/check
 * Check if a code exists and is valid (without user context)
 */
router.post('/check', async (req, res, next) => {
  try {
    const { code } = checkSchema.parse(req.body);
    const normalizedCode = code.toUpperCase().trim();

    // Special case: MAJESTADALAN
    if (isMajestadAlanCode(normalizedCode)) {
      return res.json({
        success: true,
        data: {
          exists: true,
          code: 'MAJESTADALAN',
          description: 'Acceso Premium Vitalicio Gratuito',
          type: 'percentage',
          value: 100,
          applicablePlans: ['PREMIUM_LIFETIME'],
          unlimited: true,
        },
      });
    }

    // For regular codes, just check existence (admin would check full details)
    return res.json({
      success: true,
      data: {
        exists: true, // Would need DB check in production
        message: 'Code exists, apply to see details',
      },
    });
  } catch (error) {
    next(error);
    return;
  }
});

export { router as discountRoutes };
