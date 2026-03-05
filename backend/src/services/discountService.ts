/**
 * Discount Service
 * Handles discount code validation and usage tracking
 * Special handling for MAJESTADALAN code with audit logging
 */

import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';

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

export interface DiscountUsageLog {
  userId: string;
  code: string;
  paymentId: string;
  isMajestadAlan: boolean;
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
    // Normalize code
    const normalizedCode = code.trim().toUpperCase();
    
    // Special handling for MAJESTADALAN
    if (normalizedCode === MAJESTADALAN_CODE) {
      return {
        isValid: true,
        discount: {
          code: MAJESTADALAN_CODE,
          type: 'percentage',
          value: 100, // 100% discount
        },
      };
    }
    
    // Check database for other discount codes
    const discount = await prisma.discountCode.findUnique({
      where: { code: normalizedCode },
    });
    
    if (!discount) {
      return {
        isValid: false,
        message: 'Código inválido',
      };
    }
    
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
      const userUsage = await prisma.discountUsage.count({
        where: {
          userId,
          discountCode: normalizedCode,
        },
      });
      
      if (userUsage >= discount.perUserLimit) {
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
        type: discount.type,
        value: discount.value,
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
 * Special audit logging for MAJESTADALAN
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
    
    // For MAJESTADALAN, create the discount code if it doesn't exist
    if (isMajestadAlan) {
      await ensureMajestadAlanCodeExists();
    }
    
    // Log the usage
    await prisma.discountUsage.create({
      data: {
        id: uuidv4(),
        userId,
        discountCode: normalizedCode,
        paymentId,
      },
    });
    
    // Increment total usage for non-MAJESTADALAN codes
    if (!isMajestadAlan) {
      await prisma.discountCode.update({
        where: { code: normalizedCode },
        data: {
          totalUsed: { increment: 1 },
        },
      });
    }
    
    // Create audit log for MAJESTADALAN
    if (isMajestadAlan) {
      await prisma.paymentLog.create({
        data: {
          id: uuidv4(),
          userId,
          gateway: 'bypass',
          amount: 0,
          currency: 'USD',
          status: 'approved',
          rawPayload: JSON.stringify({
            type: 'majestadalan_usage',
            code: MAJESTADALAN_CODE,
            paymentId,
            timestamp: new Date().toISOString(),
          }),
          signature: 'majestadalan',
        },
      });
      
      console.log(`[DiscountService] MAJESTADALAN used by user ${userId} for payment ${paymentId}`);
    }
    
    // Calculate discount amount (placeholder - actual calculation happens in payment service)
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
 * Ensure MAJESTADALAN code exists in database
 */
async function ensureMajestadAlanCodeExists(): Promise<void> {
  try {
    await prisma.discountCode.upsert({
      where: { code: MAJESTADALAN_CODE },
      create: {
        code: MAJESTADALAN_CODE,
        type: 'percentage',
        value: 100,
        applicablePlans: JSON.stringify(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY', 'PREMIUM_LIFETIME']),
        active: true,
        maxUses: null, // Unlimited
        perUserLimit: 1, // One per user
      },
      update: {},
    });
  } catch (error) {
    console.error('[DiscountService] Error ensuring MAJESTADALAN code exists:', error);
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
    const totalUses = await prisma.discountUsage.count({
      where: { discountCode: MAJESTADALAN_CODE },
    });
    
    const recentUses = await prisma.discountUsage.findMany({
      where: { discountCode: MAJESTADALAN_CODE },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        userId: true,
        createdAt: true,
        paymentId: true,
      },
    });
    
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
    const usages = await prisma.discountUsage.findMany({
      where: { userId },
      select: {
        discountCode: { select: { code: true } },
        createdAt: true,
        paymentId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return usages.map(u => ({
      code: u.discountCode.code,
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
