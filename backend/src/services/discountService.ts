/**
 * Discount Service
 * Handles discount code validation and usage tracking
 * Special handling for MAJESTADALAN code with audit logging
 * Uses Drizzle ORM with Neon PostgreSQL
 */

import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { discountCodes, discountUsages, paymentLogs } from '../db/schema';

// ============================================
// CONSTANTS
// ============================================

export const MAJESTADALAN_CODE = 'MAJESTADALAN';

// ============================================
// TYPES
// ============================================

export interface DiscountValidationResult {
  isValid: boolean;
  discount?: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    currency?: string;
  };
  message?: string;
}

// ============================================
// FUNCTIONS
// ============================================

/**
 * Validate a discount code
 */
export async function validateDiscountCode(
  code: string,
  userId: string
): Promise<DiscountValidationResult> {
  try {
    const normalizedCode = code.trim().toUpperCase();

    // Special handling for MAJESTADALAN
    if (normalizedCode === MAJESTADALAN_CODE) {
      return {
        isValid: true,
        discount: {
          code: MAJESTADALAN_CODE,
          type: 'percentage',
          value: 100,
        },
      };
    }

    // Check database for other discount codes
    const foundCodes = await db.select({
      code: discountCodes.code,
      type: discountCodes.type,
      value: discountCodes.value,
      currency: discountCodes.currency,
      maxUses: discountCodes.maxUses,
      perUserLimit: discountCodes.perUserLimit,
      totalUsed: discountCodes.totalUsed,
      active: discountCodes.active,
      expiresAt: discountCodes.expiresAt,
      applicablePlans: discountCodes.applicablePlans,
    })
      .from(discountCodes)
      .where(eq(discountCodes.code, normalizedCode))
      .limit(1);

    if (foundCodes.length === 0) {
      return {
        isValid: false,
        message: 'Código inválido',
      };
    }

    const discount = foundCodes[0];

    // Check if active
    if (!discount.active) {
      return {
        isValid: false,
        message: 'Código desactivado',
      };
    }

    // Check expiration
    if (discount.expiresAt && discount.expiresAt < new Date()) {
      return {
        isValid: false,
        message: 'Código expirado',
      };
    }

    // Check max uses
    if (discount.maxUses !== null && discount.totalUsed >= discount.maxUses) {
      return {
        isValid: false,
        message: 'Código agotado',
      };
    }

    // Check per-user limit
    if (discount.perUserLimit !== null) {
      const userUsage = await db.select({ id: discountUsages.id })
        .from(discountUsages)
        .where(
          and(
            eq(discountUsages.userId, userId),
            eq(discountUsages.discountCode, normalizedCode)
          )
        )
        .limit(1);

      if (userUsage.length > 0) {
        return {
          isValid: false,
          message: 'Ya has usado este código',
        };
      }
    }

    return {
      isValid: true,
      discount: {
        code: discount.code,
        type: discount.type as 'percentage' | 'fixed',
        value: parseFloat(discount.value),
        currency: discount.currency || undefined,
      },
    };
  } catch (error) {
    console.error('[DiscountService] Error validating code:', error);
    return {
      isValid: false,
      message: 'Error al validar código',
    };
  }
}

/**
 * Apply discount and log usage
 */
export async function applyDiscount(
  userId: string,
  code: string,
  paymentId: string
): Promise<{
  success: boolean;
  message: string;
  discountAmount?: number;
}> {
  try {
    const normalizedCode = code.trim().toUpperCase();
    const isMajestadAlan = normalizedCode === MAJESTADALAN_CODE;

    // Validate the code first
    const validation = await validateDiscountCode(normalizedCode, userId);

    if (!validation.isValid || !validation.discount) {
      return {
        success: false,
        message: validation.message || 'Código inválido',
      };
    }

    // Log the usage
    await db.insert(discountUsages).values({
      id: uuidv4(),
      userId,
      discountCode: normalizedCode,
      paymentId,
    });

    // Increment total usage for non-MAJESTADALAN codes
    if (!isMajestadAlan) {
      await db.update(discountCodes)
        .set({
          totalUsed: sql`${discountCodes.totalUsed} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(discountCodes.code, normalizedCode));
    }

    // Create audit log for MAJESTADALAN
    if (isMajestadAlan) {
      await db.insert(paymentLogs).values({
        id: uuidv4(),
        userId,
        gateway: 'bypass',
        amount: '0',
        currency: 'USD',
        status: 'approved',
        rawPayload: JSON.stringify({
          type: 'majestadalan_usage',
          code: MAJESTADALAN_CODE,
          paymentId,
          timestamp: new Date().toISOString(),
        }),
        signature: 'majestadalan',
      });

      console.log(`[DiscountService] MAJESTADALAN used by user ${userId} for payment ${paymentId}`);
    }

    const discountAmount = validation.discount.type === 'percentage'
      ? validation.discount.value
      : validation.discount.value;

    return {
      success: true,
      message: 'Código aplicado exitosamente',
      discountAmount,
    };
  } catch (error) {
    console.error('[DiscountService] Error applying discount:', error);
    return {
      success: false,
      message: 'Error al aplicar código',
    };
  }
}

/**
 * Get usage statistics for MAJESTADALAN
 */
export async function getMajestadAlanStats(): Promise<{
  totalUses: number;
  recentUses: Array<{
    userId: string;
    createdAt: Date;
    paymentId: string;
  }>;
}> {
  try {
    const totalUsesResult = await db.select({ count: sql<number>`count(*)` })
      .from(discountUsages)
      .where(eq(discountUsages.discountCode, MAJESTADALAN_CODE));

    const totalUses = totalUsesResult[0]?.count || 0;

    const recentUses = await db.select({
      userId: discountUsages.userId,
      createdAt: discountUsages.createdAt,
      paymentId: discountUsages.paymentId,
    })
      .from(discountUsages)
      .where(eq(discountUsages.discountCode, MAJESTADALAN_CODE))
      .orderBy(sql`${discountUsages.createdAt} DESC`)
      .limit(10);

    return {
      totalUses,
      recentUses,
    };
  } catch (error) {
    console.error('[DiscountService] Error getting MAJESTADALAN stats:', error);
    return {
      totalUses: 0,
      recentUses: [],
    };
  }
}

/**
 * Get all discount usages for a user
 */
export async function getUserDiscountUsages(userId: string): Promise<Array<{
  code: string;
  createdAt: Date;
  paymentId: string;
}>> {
  try {
    const usages = await db.select({
      code: discountCodes.code,
      createdAt: discountUsages.createdAt,
      paymentId: discountUsages.paymentId,
    })
      .from(discountUsages)
      .innerJoin(discountCodes, eq(discountUsages.discountCode, discountCodes.code))
      .where(eq(discountUsages.userId, userId))
      .orderBy(sql`${discountUsages.createdAt} DESC`);

    return usages.map((u) => ({
      code: u.code,
      createdAt: u.createdAt,
      paymentId: u.paymentId,
    }));
  } catch (error) {
    console.error('[DiscountService] Error getting user discount usages:', error);
    return [];
  }
}

export default {
  validateDiscountCode,
  applyDiscount,
  getMajestadAlanStats,
  getUserDiscountUsages,
  MAJESTADALAN_CODE,
};
