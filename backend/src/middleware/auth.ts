/**
 * Authentication Middleware
 * Verifies JWT/access tokens and enforces role-based access
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
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
 * Verify access token from header
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError('Missing or invalid authorization header', 401, 'MISSING_AUTH');
  }

  const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  // For now, we'll look up the token in refresh tokens
  // In production, use JWT verification
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token: accessToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          emailVerified: true,
        },
      },
    },
  });

  if (!refreshToken) {
    throw createError('Invalid access token', 401, 'INVALID_TOKEN');
  }

  if (refreshToken.expiresAt < new Date()) {
    // Token expired
    await prisma.refreshToken.delete({
      where: { id: refreshToken.id },
    });
    throw createError('Access token expired', 401, 'TOKEN_EXPIRED');
  }

  // Attach user to request
  req.user = {
    id: refreshToken.user.id,
    email: refreshToken.user.email,
    role: refreshToken.user.role,
  };

  next();
}

/**
 * Require authentication (wrapper for clarity)
 */
export const requireAuth = authMiddleware;

/**
 * Require specific role
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'MISSING_AUTH');
    }

    if (!roles.includes(req.user.role)) {
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
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'MISSING_AUTH');
    }

    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];

    if (!resourceUserId) {
      throw createError('Resource user ID not found', 400, 'INVALID_REQUEST');
    }

    // Allow if user is owner/admin or owns the resource
    if (
      req.user.role === UserRole.ADMIN ||
      req.user.role === UserRole.OWNER ||
      req.user.id === resourceUserId
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
