/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user info to request
 * Uses Drizzle ORM
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../services/authService';
import { eq } from 'drizzle-orm';
import db from '../db';
import { users } from '../db/schema';
import { createError } from './errorHandler';

// ============================================
// TYPES
// ============================================

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
    planType: string;
  };
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Extract and verify JWT token from Authorization header
 */
export async function authMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError('Authorization header required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload: JWTPayload = verifyAccessToken(token);

    // Get user from database
    const foundUsers = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      emailVerified: users.emailVerified,
      planType: users.planType,
    })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (foundUsers.length === 0) {
      throw createError('User not found', 401, 'USER_NOT_FOUND');
    }

    const user = foundUsers[0];

    // Attach user info to request
    req.userId = user.id;
    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require admin role
 */
export async function requireAdmin(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (req.user.role !== 'ADMIN') {
      throw createError('Admin access required', 403, 'FORBIDDEN');
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require email verification
 */
export async function requireEmailVerified(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (!req.user.emailVerified) {
      throw createError('Email verification required', 403, 'EMAIL_NOT_VERIFIED');
    }

    next();
  } catch (error) {
    next(error);
  }
}

export default {
  authMiddleware,
  requireAdmin,
  requireEmailVerified,
};
