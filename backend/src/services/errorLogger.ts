/**
 * Error Logging Service
 * Centralized error logging for the entire backend
 */

import prisma from '../lib/prisma';
import { ErrorSeverity } from '@prisma/client';

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
  severity?: ErrorSeverity;
}

// ============================================
// ERROR LOGGING
// ============================================

/**
 * Log an error to the database
 */
export async function logError(data: LogErrorData): Promise<string> {
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
    severity = ErrorSeverity.error,
  } = data;

  try {
    const errorLog = await prisma.errorLog.create({
      data: {
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
        metadata: metadata ? JSON.stringify(metadata) : null,
        severity,
      },
    });

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${severity.toUpperCase()}] ${errorCode}: ${errorMessage}`);
    }

    return errorLog.id;
  } catch (logError) {
    // If logging fails, log to console
    console.error('Failed to log error to database:', logError);
    console.error('Original error:', data);
    return 'logging-failed';
  }
}

/**
 * Log API error with request context
 */
export async function logApiError(
  endpoint: string,
  method: string,
  errorCode: string,
  errorMessage: string,
  context: {
    userId?: string;
    userEmail?: string;
    device?: string;
    appVersion?: string;
    ipAddress?: string;
    requestBody?: any;
    errorStack?: string;
  }
): Promise<string> {
  return logError({
    userId: context.userId,
    userEmail: context.userEmail,
    endpoint,
    method,
    errorCode,
    errorMessage,
    errorStack: context.errorStack,
    device: context.device,
    appVersion: context.appVersion,
    ipAddress: context.ipAddress,
    metadata: context.requestBody ? { requestBody: context.requestBody } : undefined,
    severity: ErrorSeverity.error,
  });
}

/**
 * Log authentication failure
 */
export async function logAuthFailure(
  endpoint: string,
  method: string,
  reason: string,
  context: {
    email?: string;
    userId?: string;
    device?: string;
    ipAddress?: string;
  }
): Promise<string> {
  return logError({
    userEmail: context.email,
    userId: context.userId,
    endpoint,
    method,
    errorCode: 'AUTH_FAILURE',
    errorMessage: reason,
    device: context.device,
    ipAddress: context.ipAddress,
    severity: ErrorSeverity.warning,
  });
}

/**
 * Log agenda conflict
 */
export async function logAgendaConflict(
  endpoint: string,
  method: string,
  conflictType: string,
  context: {
    userId?: string;
    appointmentId?: string;
    locationId?: string;
    staffId?: string;
    startTime?: Date;
    device?: string;
  }
): Promise<string> {
  return logError({
    userId: context.userId,
    endpoint,
    method,
    errorCode: 'AGENDA_CONFLICT',
    errorMessage: conflictType,
    device: context.device,
    metadata: {
      appointmentId: context.appointmentId,
      locationId: context.locationId,
      staffId: context.staffId,
      startTime: context.startTime?.toISOString(),
    },
    severity: ErrorSeverity.warning,
  });
}

/**
 * Log critical error
 */
export async function logCriticalError(
  errorCode: string,
  errorMessage: string,
  context: {
    userId?: string;
    endpoint?: string;
    errorStack?: string;
    metadata?: Record<string, any>;
  }
): Promise<string> {
  return logError({
    userId: context.userId,
    endpoint: context.endpoint || 'unknown',
    method: 'unknown',
    errorCode,
    errorMessage,
    errorStack: context.errorStack,
    metadata: context.metadata,
    severity: ErrorSeverity.critical,
  });
}

// ============================================
// ERROR LOG QUERIES
// ============================================

/**
 * Get recent errors
 */
export async function getRecentErrors(
  limit: number = 50,
  severity?: ErrorSeverity
) {
  return prisma.errorLog.findMany({
    where: severity ? { severity } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Get errors by endpoint
 */
export async function getErrorsByEndpoint(
  endpoint: string,
  startDate: Date,
  endDate: Date
) {
  return prisma.errorLog.findMany({
    where: {
      endpoint,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get error statistics
 */
export async function getErrorStatistics(
  startDate: Date,
  endDate: Date
) {
  const errors = await prisma.errorLog.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      severity: true,
      errorCode: true,
      endpoint: true,
    },
  });

  const stats = {
    total: errors.length,
    bySeverity: {
      debug: errors.filter(e => e.severity === 'debug').length,
      info: errors.filter(e => e.severity === 'info').length,
      warning: errors.filter(e => e.severity === 'warning').length,
      error: errors.filter(e => e.severity === 'error').length,
      critical: errors.filter(e => e.severity === 'critical').length,
    },
    byErrorCode: {} as Record<string, number>,
    byEndpoint: {} as Record<string, number>,
  };

  // Count by error code
  errors.forEach(error => {
    stats.byErrorCode[error.errorCode] = (stats.byErrorCode[error.errorCode] || 0) + 1;
    stats.byEndpoint[error.endpoint] = (stats.byEndpoint[error.endpoint] || 0) + 1;
  });

  return stats;
}

/**
 * Clear old error logs (maintenance)
 */
export async function clearOldErrors(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.errorLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
      severity: {
        notIn: ['critical'], // Keep critical errors
      },
    },
  });

  return result.count;
}
