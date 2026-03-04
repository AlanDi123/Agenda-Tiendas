/**
 * Discount Code Service
 * Handles discount code validation and application
 */

import prisma from '../lib/prisma';
import { PlanType } from '@prisma/client';
import { createError } from '../middleware/errorHandler';

// ============================================
// SPECIAL CODE: MAJESTADALAN
// ============================================

const MAJESTADALAN_CODE = 'MAJESTADALAN';

/**
 * Check if code is the special MAJESTADALAN code
 * This code grants PREMIUM_LIFETIME with 100% discount
 */
export function isMajestadAlanCode(code: string): boolean {
  return code.toUpperCase().trim() === MAJESTADALAN_CODE;
}

/**
 * Get MAJESTADALAN code details
 * Always valid, unlimited uses, never expires
 */
export function getMajestadAlanDetails() {
  return {
    code: MAJESTADALAN_CODE,
    type: 'percentage' as const,
    value: 100,
    applicablePlans: ['PREMIUM_LIFETIME'] as PlanType[],
    maxUses: null, // Unlimited
    perUserLimit: null, // Unlimited per user
    expiresAt: null, // Never expires
    description: 'Acceso Premium Vitalicio Gratuito',
  };
}

// ============================================
// DISCOUNT CODE VALIDATION
// ============================================

export interface DiscountValidationResult {
  valid: boolean;
  code?: string;
  type?: 'percentage' | 'fixed';
  value?: number;
  discountAmount?: number;
  error?: string;
  isLifetime?: boolean;
}

/**
 * Validate and apply discount code
 */
export async function validateDiscountCode(
  code: string,
  userId: string,
  planType: PlanType,
  amount: number
): Promise<DiscountValidationResult> {
  const normalizedCode = code.toUpperCase().trim();

  // Special case: MAJESTADALAN
  if (isMajestadAlanCode(normalizedCode)) {
    if (planType !== 'PREMIUM_LIFETIME') {
      return {
        valid: false,
        error: 'Este código solo es válido para Premium Vitalicio',
      };
    }
    return {
      valid: true,
      code: MAJESTADALAN_CODE,
      type: 'percentage',
      value: 100,
      discountAmount: amount, // 100% discount
      isLifetime: true,
    };
  }

  // Regular discount codes
  const discountCode = await prisma.discountCode.findUnique({
    where: { code: normalizedCode },
  });

  if (!discountCode) {
    return {
      valid: false,
      error: 'Código inválido',
    };
  }

  // Check if active
  if (!discountCode.active) {
    return {
      valid: false,
      error: 'Código desactivado',
    };
  }

  // Check expiration
  if (discountCode.expiresAt && new Date(discountCode.expiresAt) < new Date()) {
    return {
      valid: false,
      error: 'Código expirado',
    };
  }

  // Check usage limit
  if (discountCode.maxUses !== null && discountCode.totalUsed >= discountCode.maxUses) {
    return {
      valid: false,
      error: 'Código agotado',
    };
  }

  // Check applicable plans
  const applicablePlans = JSON.parse(discountCode.applicablePlans) as PlanType[];
  if (applicablePlans.length > 0 && !applicablePlans.includes(planType)) {
    return {
      valid: false,
      error: 'Código no válido para este plan',
    };
  }

  // Check per-user limit
  if (discountCode.perUserLimit !== null) {
    const userUsage = await prisma.discountUsage.count({
      where: {
        userId,
        discountCode: normalizedCode,
      },
    });

    if (userUsage >= discountCode.perUserLimit) {
      return {
        valid: false,
        error: 'Ya usaste este código',
      };
    }
  }

  // Calculate discount amount
  let discountAmount: number;
  if (discountCode.type === 'percentage') {
    discountAmount = (amount * discountCode.value) / 100;
  } else {
    // Fixed discount
    discountAmount = Math.min(discountCode.value, amount);
  }

  return {
    valid: true,
    code: normalizedCode,
    type: discountCode.type as 'percentage' | 'fixed',
    value: discountCode.value,
    discountAmount,
  };
}

// ============================================
// DISCOUNT CODE USAGE
// ============================================

/**
 * Record discount code usage
 */
export async function recordDiscountUsage(
  userId: string,
  code: string,
  paymentId: string
): Promise<void> {
  const normalizedCode = code.toUpperCase().trim();

  // Skip MAJESTADALAN (unlimited, no tracking needed)
  if (isMajestadAlanCode(normalizedCode)) {
    console.log(`MAJESTADALAN used by userId=${userId}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Record usage
    await tx.discountUsage.create({
      data: {
        userId,
        discountCode: normalizedCode,
        paymentId,
      },
    });

    // Increment total used count
    await tx.discountCode.update({
      where: { code: normalizedCode },
      data: {
        totalUsed: { increment: 1 },
      },
    });
  });
}

// ============================================
// DISCOUNT CODE MANAGEMENT
// ============================================

/**
 * Create a new discount code
 */
export async function createDiscountCode(data: {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  currency?: string;
  maxUses?: number;
  perUserLimit?: number;
  applicablePlans: PlanType[];
  expiresAt?: Date;
}): Promise<void> {
  const normalizedCode = data.code.toUpperCase().trim();

  // Check if code already exists
  const existing = await prisma.discountCode.findUnique({
    where: { code: normalizedCode },
  });

  if (existing) {
    throw createError('Code already exists', 409, 'CODE_EXISTS');
  }

  await prisma.discountCode.create({
    data: {
      code: normalizedCode,
      type: data.type,
      value: data.value,
      currency: data.currency,
      maxUses: data.maxUses,
      perUserLimit: data.perUserLimit,
      applicablePlans: JSON.stringify(data.applicablePlans),
      expiresAt: data.expiresAt,
      totalUsed: 0,
      active: true,
    },
  });
}

/**
 * Deactivate a discount code
 */
export async function deactivateDiscountCode(code: string): Promise<void> {
  const normalizedCode = code.toUpperCase().trim();

  await prisma.discountCode.update({
    where: { code: normalizedCode },
    data: { active: false },
  });
}

/**
 * Get all active discount codes (admin function)
 */
export async function getActiveDiscountCodes(): Promise<Array<{
  code: string;
  type: string;
  value: number;
  totalUsed: number;
  maxUses: number | null;
  expiresAt: Date | null;
}>> {
  const codes = await prisma.discountCode.findMany({
    where: { active: true },
    select: {
      code: true,
      type: true,
      value: true,
      totalUsed: true,
      maxUses: true,
      expiresAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return codes;
}
