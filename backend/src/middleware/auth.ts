/**
 * Authentication Middleware
 * Verifies JWT access tokens and enforces role-based access
 * 
 * SECURITY HARDENED:
 * - Stateless JWT verification (no DB lookup)
 * - Signature verification
 * - Expiry checking
 * - Role enforcement
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/authService';
import { createError } from './errorHandler';
import { UserRole } from '@prisma/client';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

/**
 * Verify JWT access token from header
 * STATELESS - no database lookup required
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError('Missing or invalid authorization header', 401, 'MISSING_AUTH');
  }

  const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Verify JWT signature and expiry (stateless)
    const payload = verifyAccessToken(accessToken);

    // Attach user to request
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require authentication (wrapper for clarity)
 */
export const requireAuth = authMiddleware;

/**
 * Require specific role
 */
export function requireRole(...roles: UserRole[]) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    if (!_req.user) {
      throw createError('Authentication required', 401, 'MISSING_AUTH');
    }

    if (!roles.includes(_req.user.role)) {
      throw createError(
        `Access denied. Required roles: ${roles.join(', ')}`,
        403,
        'INSUFFICIENT_ROLE'
      );
    }

    next();
  };
}

/**
 * Require owner role
 */
export const requireOwner = requireRole(UserRole.OWNER, UserRole.ADMIN);

/**
 * Require admin role
 */
export const requireAdmin = requireRole(UserRole.ADMIN);

/**
 * Check if user owns the resource
 */
export function requireOwnership(resourceUserIdField: string = 'userId') {
  return (_req: Request, _res: Response, next: NextFunction) => {
    if (!_req.user) {
      throw createError('Authentication required', 401, 'MISSING_AUTH');
    }

    const resourceUserId = _req.params[resourceUserIdField] || _req.body[resourceUserIdField];

    if (!resourceUserId) {
      throw createError('Resource user ID not found', 400, 'INVALID_REQUEST');
    }

    // Allow if user is owner/admin or owns the resource
    if (
      _req.user.role === UserRole.ADMIN ||
      _req.user.role === UserRole.OWNER ||
      _req.user.id === resourceUserId
    ) {
      next();
      return;
    }

    throw createError('Access denied', 403, 'INSUFFICIENT_ROLE');
  };
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await authMiddleware(req, res, next);
  } catch (error) {
    // Ignore auth errors, continue without user
    next();
  }
}
