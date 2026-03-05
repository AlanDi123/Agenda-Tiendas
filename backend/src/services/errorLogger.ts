/**
 * Error Logging Service
 * Centralized error logging for the entire backend
 * Simplified version without database dependency
 */

// ============================================
// TYPES
// ============================================

export interface LogErrorData {
  userId?: string;
  userEmail?: string;
  endpoint: string;
  method: string;
  errorCode: string;
  errorMessage: string;
  errorStack?: string;
  device?: string;
  appVersion?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  severity?: 'debug' | 'info' | 'warning' | 'error' | 'critical';
}

// ============================================
// ERROR LOGGING
// ============================================

/**
 * Log error to console and optionally to database
 */
export async function logError(errorData: LogErrorData): Promise<void> {
  const {
    userId,
    userEmail,
    endpoint,
    method,
    errorCode,
    errorMessage,
    errorStack,
    device,
    appVersion,
    ipAddress,
    metadata,
    severity = 'error',
  } = errorData;

  const logEntry = {
    timestamp: new Date().toISOString(),
    severity,
    errorCode,
    errorMessage,
    endpoint: `${method} ${endpoint}`,
    userId,
    userEmail,
    device,
    appVersion,
    ipAddress,
    metadata,
    stack: errorStack,
  };

  // Log to console
  console.error(`[${severity.toUpperCase()}] ${errorCode}: ${errorMessage}`, logEntry);

  // In a full implementation, this would also log to database
  // For now, console logging is sufficient
}

/**
 * Log authentication failure
 */
export async function logAuthFailure(
  endpoint: string,
  method: string,
  reason: string,
  context?: Record<string, any>
): Promise<void> {
  await logError({
    endpoint,
    method,
    errorCode: 'AUTH_FAILURE',
    errorMessage: reason,
    severity: 'warning',
    metadata: context,
  });
}

/**
 * Log API error
 */
export async function logApiError(
  endpoint: string,
  method: string,
  errorCode: string,
  errorMessage: string,
  context?: Record<string, any>
): Promise<void> {
  await logError({
    endpoint,
    method,
    errorCode,
    errorMessage,
    severity: 'error',
    metadata: context,
  });
}

/**
 * Log payment error
 */
export async function logPaymentError(
  userId: string,
  gateway: string,
  errorCode: string,
  errorMessage: string,
  context?: Record<string, any>
): Promise<void> {
  await logError({
    endpoint: '/api/webhooks/payment',
    method: 'POST',
    errorCode,
    errorMessage,
    userId,
    severity: 'critical',
    metadata: { gateway, ...context },
  });
}

/**
 * Log subscription error
 */
export async function logSubscriptionError(
  userId: string,
  errorCode: string,
  errorMessage: string,
  context?: Record<string, any>
): Promise<void> {
  await logError({
    endpoint: '/api/subscriptions',
    method: 'POST',
    errorCode,
    errorMessage,
    userId,
    severity: 'error',
    metadata: context,
  });
}

export default {
  logError,
  logAuthFailure,
  logApiError,
  logPaymentError,
  logSubscriptionError,
};
