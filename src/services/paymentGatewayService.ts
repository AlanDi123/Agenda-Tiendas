/**
 * Payment Gateway Service
 * Handles communication with backend payment APIs
 */

import type { PaymentSession, PaymentMethodType } from '../types/payment';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Get authentication token from storage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

/**
 * Create checkout preference and redirect to Mercado Pago
 */
export async function redirectToCheckout(
  planType: string,
  discountCode?: string
): Promise<void> {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Usuario no autenticado. Por favor inicia sesión.');
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/payments/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        planType,
        discountCode,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al crear preferencia de pago');
    }
    
    const result = await response.json();
    
    if (result.success && result.data?.initPoint) {
      // Redirect to Mercado Pago checkout
      window.location.href = result.data.initPoint;
    } else {
      throw new Error('Error al obtener URL de pago');
    }
  } catch (error) {
    console.error('[PaymentGateway] Error redirecting to checkout:', error);
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
  const token = getAuthToken();
  
  if (!token) {
    return {
      isActive: false,
      planType: 'FREE',
      isLifetime: false,
    };
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/subscriptions/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
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
  } catch (error) {
    console.error('[PaymentGateway] Error getting subscription status:', error);
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
  const token = getAuthToken();
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/discounts/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify({ code }),
    });
    
    const result = await response.json();
    
    return {
      isValid: result.isValid || false,
      discount: result.discount,
      message: result.message,
    };
  } catch (error) {
    console.error('[PaymentGateway] Error validating discount code:', error);
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
  const token = getAuthToken();

  if (!token) {
    return {
      status: 'error',
      message: 'Usuario no autenticado',
    };
  }

  try {
    const url = paymentId
      ? `${API_BASE_URL}/api/v1/payments/status/${paymentId}`
      : `${API_BASE_URL}/api/v1/payments/status`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const result = await response.json();

    return {
      status: result.status || 'unknown',
      message: result.message || 'Estado desconocido',
    };
  } catch (error) {
    console.error('[PaymentGateway] Error checking payment status:', error);
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
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'Usuario no autenticado. Por favor inicia sesión.' };
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/payments/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId: session.id,
        planType: session.planType,
        discountCode: session.discountCode,
      }),
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
    console.error('[PaymentGateway] createGatewayPayment error:', error);
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
