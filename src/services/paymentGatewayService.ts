/**
 * Payment Gateway Service
 * Handles communication with backend payment APIs
 */

import type { PaymentSession, PaymentMethodType } from '../types/payment';
import { apiFetch } from '../config/api';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  console.info('[PaymentGateway] API base (VITE_API_URL o default producción)');
}

function getSessionToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

/**
 * Create checkout preference and redirect to Mercado Pago
 */
export async function redirectToCheckout(
  planType: string,
  discountCode?: string
): Promise<void> {
  const token = getSessionToken();

  if (!token) {
    throw new Error('Usuario no autenticado. Por favor inicia sesión.');
  }

  try {
    const response = await apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      auth: true,
      json: {
        planType,
        discountCode,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
      }
      if (response.status >= 500) {
        throw new Error('Error del servidor. Intente más tarde.');
      }
      const error = await response.json().catch(() => ({} as Record<string, unknown>));
      const details = (error as { details?: string | string[] }).details;
      const detailStr = Array.isArray(details)
        ? details.join(', ')
        : typeof details === 'string'
          ? details
          : '';
      throw new Error(
        (error as { message?: string }).message ||
          detailStr ||
          'Error al crear preferencia de pago'
      );
    }

    const result = await response.json();

    if (result.success && result.data?.initPoint) {
      window.location.href = result.data.initPoint;
      return;
    }

    if (result.success && result.data?.isLifetime) {
      window.location.replace(`${window.location.origin}/payment/success`);
      return;
    }

    throw new Error('Error al obtener URL de pago');
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Sin conexión. Verifique su internet.');
    }
    if (import.meta.env.DEV) console.error('[PaymentGateway] Error redirecting to checkout:', error);
    throw error;
  }
}

/**
 * Get user's subscription status
 */
export async function getSubscriptionStatus(): Promise<{
  isActive: boolean;
  planType: string;
  expiresAt?: string;
  isLifetime: boolean;
}> {
  const token = getSessionToken();

  if (!token) {
    return {
      isActive: false,
      planType: 'FREE',
      isLifetime: false,
    };
  }

  try {
    const response = await apiFetch('/api/v1/subscriptions/status', {
      method: 'GET',
      auth: true,
    });

    if (!response.ok) {
      return {
        isActive: false,
        planType: 'FREE',
        isLifetime: false,
      };
    }

    const result = await response.json();

    if (result.success) {
      return {
        isActive: result.data.isActive,
        planType: result.data.planType,
        expiresAt: result.data.expiresAt,
        isLifetime: result.data.isLifetime,
      };
    }

    return {
      isActive: false,
      planType: 'FREE',
      isLifetime: false,
    };
  } catch {
    // Network error - return offline state
    return {
      isActive: false,
      planType: 'FREE',
      isLifetime: false,
    };
  }
}

/**
 * Verify a discount code
 */
export async function validateDiscountCode(code: string): Promise<{
  isValid: boolean;
  discount?: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
  };
  message?: string;
}> {
  try {
    const response = await apiFetch('/api/v1/discounts/validate', {
      method: 'POST',
      auth: true,
      json: { code },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        isValid: false,
        message: result.message || (response.status === 401 ? 'Iniciá sesión para validar el código' : 'Error al validar código'),
      };
    }

    return {
      isValid: result.isValid || false,
      discount: result.discount,
      message: result.message,
    };
  } catch (error) {
    if (import.meta.env.DEV) console.error('[PaymentGateway] Error validating discount code:', error);
    return {
      isValid: false,
      message: 'Error al validar código',
    };
  }
}

/**
 * Check payment status after redirect from Mercado Pago
 */
export async function checkPaymentStatus(paymentId?: string): Promise<{
  status: string;
  message: string;
}> {
  const token = getSessionToken();

  if (!token) {
    return {
      status: 'error',
      message: 'Usuario no autenticado',
    };
  }

  try {
    const path = paymentId
      ? `/api/v1/payments/status/${paymentId}`
      : '/api/v1/payments/status';

    const response = await apiFetch(path, {
      method: 'GET',
      auth: true,
    });

    const result = await response.json();

    return {
      status: result.status || 'unknown',
      message: result.message || 'Estado desconocido',
    };
  } catch (error) {
    if (import.meta.env.DEV) console.error('[PaymentGateway] Error checking payment status:', error);
    return {
      status: 'error',
      message: 'Error al verificar estado del pago',
    };
  }
}

/**
 * Create gateway payment preference
 */
export async function createGatewayPayment(
  session: PaymentSession,
  _method: PaymentMethodType
): Promise<{
  success: boolean;
  gatewayUrl?: string;
  gatewayPaymentId?: string;
  error?: string;
}> {
  const token = getSessionToken();
  if (!token) {
    return { success: false, error: 'Usuario no autenticado. Por favor inicia sesión.' };
  }
  try {
    const response = await apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      auth: true,
      json: {
        sessionId: session.id,
        planType: session.planType,
        discountCode: session.discountCode,
      },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, error: err.message || 'Error al crear preferencia de pago' };
    }
    const result = await response.json();
    if (result.success && result.data?.initPoint) {
      return {
        success: true,
        gatewayUrl: result.data.initPoint,
        gatewayPaymentId: result.data.paymentId,
      };
    }
    return { success: false, error: 'Error al obtener URL de pago' };
  } catch (error) {
    if (import.meta.env.DEV) console.error('[PaymentGateway] createGatewayPayment error:', error);
    return { success: false, error: 'Error de red al procesar el pago' };
  }
}

export default {
  redirectToCheckout,
  getSubscriptionStatus,
  validateDiscountCode,
  checkPaymentStatus,
  createGatewayPayment,
};
