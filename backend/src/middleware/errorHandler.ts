/**
 * Global Error Handler Middleware
 * Catches all errors and returns safe responses
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error for debugging (never expose to client)
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Known API errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      code: err.code,
    });
  }

  // Unknown errors - return generic message
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && {
      details: err.message,
    }),
  });
}

/**
 * Create a typed API error
 */
export function createError(
  message: string,
  statusCode: number = 500,
  code?: string
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
