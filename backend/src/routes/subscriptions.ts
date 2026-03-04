/**
 * Subscription Routes
 * Handles subscription verification requests
 */

import { Router } from 'express';
import { z } from 'zod';
import { verifySubscription, PLAN_FEATURES } from '../services/subscriptionService';

const router = Router();

// ============================================
// VERIFY SUBSCRIPTION
// ============================================

const verifySchema = z.object({
  userId: z.string().uuid(),
});

/**
 * POST /api/subscriptions/verify
 * Verify user's subscription status
 * 
 * Request:
 * {
 *   "userId": "uuid"
 * }
 * 
 * Response:
 * {
 *   "planType": "PREMIUM_MONTHLY",
 *   "planStatus": "active",
 *   "expiresAt": "2024-12-31T23:59:59Z",
 *   "isLifetime": false,
 *   "features": { ... }
 * }
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { userId } = verifySchema.parse(req.body);

    const result = await verifySubscription(userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET FEATURES BY PLAN
// ============================================

/**
 * GET /api/subscriptions/features
 * Get available features for each plan type
 */
router.get('/features', async (_req, res) => {
  res.json({
    success: true,
    data: {
      plans: {
        FREE: {
          name: 'Gratis',
          price: 0,
          features: PLAN_FEATURES['FREE'],
        },
        PREMIUM_MONTHLY: {
          name: 'Premium Mensual',
          price: 9.99,
          features: PLAN_FEATURES['PREMIUM_MONTHLY'],
        },
        PREMIUM_YEARLY: {
          name: 'Premium Anual',
          price: 99.99,
          features: PLAN_FEATURES['PREMIUM_YEARLY'],
        },
        PREMIUM_LIFETIME: {
          name: 'Premium Vitalicio',
          price: 199.99,
          features: PLAN_FEATURES['PREMIUM_LIFETIME'],
        },
      },
    },
  });
});

export { router as subscriptionRoutes };
