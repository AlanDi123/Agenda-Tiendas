/**
 * Authentication Service
 * Handles user registration, login, verification, and password recovery
 *
 * SECURITY HARDENED:
 * - bcrypt for password hashing (12 rounds)
 * - JWT for access tokens (stateless)
 * - Hashed refresh tokens in database
 * - Constant-time comparison
 * 
 * Uses Drizzle ORM with Neon PostgreSQL
 */

import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { users, refreshTokens, emailVerifications } from '../db/schema';
import { createError } from '../middleware/errorHandler';

// ============================================
// CONFIGURATION
// ============================================

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';

// JWT secret - MUST be set in environment
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_ISSUER = 'dommuss-agenda';

// Token version for invalidation
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tokenVersion: number;
}

// ============================================
// PASSWORD UTILITIES (bcrypt)
// ============================================

/**
 * Hash password using bcrypt with adaptive cost
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password using constant-time comparison
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate secure random token (for email verification)
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash token for database storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================
// JWT UTILITIES
// ============================================

/**
 * Generate JWT access token
 */
export function generateAccessToken(user: {
  id: string;
  email: string;
  role: string;
  tokenVersion?: number;
}): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion || 1,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: JWT_ISSUER,
    subject: user.id,
  });
}

/**
 * Verify and decode JWT access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw createError('Token expired', 401, 'TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw createError('Invalid token', 401, 'INVALID_TOKEN');
    }
    throw createError('Token verification failed', 401, 'TOKEN_ERROR');
  }
}

/**
 * Generate refresh token and store hashed version in database
 */
export async function generateRefreshToken(userId: string, deviceId?: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = generateToken(64);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Store hashed token in database
  await db.insert(refreshTokens).values({
    id: uuidv4(),
    userId,
    token: tokenHash,
    deviceId: deviceId || null,
    expiresAt,
  });

  return {
    token,
    expiresAt,
  };
}

/**
 * Verify refresh token against database
 */
export async function verifyRefreshToken(token: string): Promise<{
  userId: string;
  tokenId: string;
}> {
  const tokenHash = hashToken(token);

  // Find token in database
  const tokens = await db.select({
    id: refreshTokens.id,
    userId: refreshTokens.userId,
    expiresAt: refreshTokens.expiresAt,
  })
    .from(refreshTokens)
    .where(eq(refreshTokens.token, tokenHash))
    .limit(1);

  if (tokens.length === 0) {
    throw createError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  const dbToken = tokens[0];

  // Check expiration
  if (dbToken.expiresAt < new Date()) {
    // Clean up expired token
    await db.delete(refreshTokens).where(eq(refreshTokens.id, dbToken.id));
    throw createError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
  }

  return {
    userId: dbToken.userId,
    tokenId: dbToken.id,
  };
}

/**
 * Invalidate refresh token (logout)
 */
export async function invalidateRefreshToken(tokenId: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenId));
}

/**
 * Invalidate all refresh tokens for a user (logout all devices)
 */
export async function invalidateAllUserTokens(userId: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}

// ============================================
// USER OPERATIONS
// ============================================

/**
 * Register new user
 */
export async function registerUser(data: {
  email: string;
  password: string;
  role?: string;
}): Promise<{
  user: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
  verificationToken: string;
}> {
  const { email, password, role = 'USER' } = data;

  // Validar email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createError('Email format is invalid', 400, 'INVALID_EMAIL');
  }

  // Validar password length
  if (password.length < 8) {
    throw createError('Password must be at least 8 characters', 400, 'PASSWORD_TOO_SHORT');
  }

  // Check if user already exists
  const existingUsers = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existingUsers.length > 0) {
    throw createError('Email already registered', 409, 'EMAIL_EXISTS');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const userId = uuidv4();
  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    role: role as any,
    emailVerified: false,
  });

  // Generate verification token
  const verificationToken = generateToken(32);
  const verificationTokenHash = hashToken(verificationToken);
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(emailVerifications).values({
    id: uuidv4(),
    userId,
    code: verificationTokenHash,
    expiresAt: verificationTokenExpires,
    verified: false,
  });

  const user = await db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    emailVerified: users.emailVerified,
  })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) {
    throw createError('Failed to create user', 500, 'CREATE_USER_FAILED');
  }

  return {
    user,
    verificationToken,
  };
}

/**
 * Login user
 */
export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string,
  _userAgent?: string,
  deviceId?: string
): Promise<{
  user: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
    planType: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  // Find user by email
  const foundUsers = await db.select({
    id: users.id,
    email: users.email,
    passwordHash: users.passwordHash,
    role: users.role,
    emailVerified: users.emailVerified,
    planType: users.planType,
  })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (foundUsers.length === 0) {
    throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const user = foundUsers[0];

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash);

  if (!isValidPassword) {
    throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // Update last login
  await db.update(users)
    .set({
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Generate tokens
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const { token: refreshToken, expiresAt } = await generateRefreshToken(user.id, deviceId);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      planType: user.planType,
    },
    accessToken,
    refreshToken,
    expiresAt,
  };
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string): Promise<{
  success: boolean;
  message: string;
}> {
  const tokenHash = hashToken(token);

  // Find verification token
  const verifications = await db.select({
    id: emailVerifications.id,
    userId: emailVerifications.userId,
    expiresAt: emailVerifications.expiresAt,
  })
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.code, tokenHash),
        eq(emailVerifications.verified, false)
      )
    )
    .limit(1);

  if (verifications.length === 0) {
    throw createError('Invalid verification token', 400, 'INVALID_TOKEN');
  }

  const verification = verifications[0];

  // Check expiration
  if (verification.expiresAt < new Date()) {
    throw createError('Verification token expired', 400, 'TOKEN_EXPIRED');
  }

  // Update user emailVerified status
  await db.update(users)
    .set({
      emailVerified: true,
      emailVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, verification.userId));

  // Mark verification as used
  await db.update(emailVerifications)
    .set({
      verified: true,
      verifiedAt: new Date(),
    })
    .where(eq(emailVerifications.id, verification.id));

  return {
    success: true,
    message: 'Email verified successfully',
  };
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<{
  success: boolean;
  message: string;
  verificationToken?: string;
}> {
  // Find user
  const foundUsers = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (foundUsers.length === 0) {
    // Don't reveal if email exists
    return {
      success: true,
      message: 'If the email exists, a verification token has been sent',
    };
  }

  const user = foundUsers[0];

  // Check if already verified
  const userWithStatus = await db.select({ emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)
    .then(rows => rows[0]);

  if (userWithStatus?.emailVerified) {
    return {
      success: true,
      message: 'Email already verified',
    };
  }

  // Invalidate old verification tokens
  await db.update(emailVerifications)
    .set({ verified: true })
    .where(
      and(
        eq(emailVerifications.userId, user.id),
        eq(emailVerifications.verified, false)
      )
    );

  // Generate new verification token
  const verificationToken = generateToken(32);
  const verificationTokenHash = hashToken(verificationToken);
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(emailVerifications).values({
    id: uuidv4(),
    userId: user.id,
    code: verificationTokenHash,
    expiresAt: verificationTokenExpires,
    verified: false,
  });

  return {
    success: true,
    message: 'Verification token sent',
    verificationToken, // Remove in production
  };
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  message: string;
  resetToken?: string;
}> {
  // Find user
  const foundUsers = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (foundUsers.length === 0) {
    // Don't reveal if email exists
    return {
      success: true,
      message: 'If the email exists, a reset token has been sent',
    };
  }

  const user = foundUsers[0];

  // Generate reset token
  const resetToken = generateToken(32);
  const resetTokenHash = hashToken(resetToken);
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.update(users)
    .set({
      resetToken: resetTokenHash,
      resetTokenExpires,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return {
    success: true,
    message: 'Password reset token sent',
    resetToken, // Remove in production
  };
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<{
  success: boolean;
  message: string;
}> {
  const tokenHash = hashToken(token);

  // Find user with valid reset token
  const foundUsers = await db.select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.resetToken!, tokenHash),
        sql`${users.resetTokenExpires} > NOW()`
      )
    )
    .limit(1);

  if (foundUsers.length === 0) {
    throw createError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
  }

  const user = foundUsers[0];

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password and clear reset token
  await db.update(users)
    .set({
      passwordHash,
      resetToken: null,
      resetTokenExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Invalidate all refresh tokens
  await invalidateAllUserTokens(user.id);

  return {
    success: true,
    message: 'Password reset successfully',
  };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<{
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  planType: string;
  planStatus: string;
} | null> {
  const foundUsers = await db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    emailVerified: users.emailVerified,
    planType: users.planType,
    planStatus: users.planStatus,
  })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return foundUsers.length > 0 ? foundUsers[0] : null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<{
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
} | null> {
  const foundUsers = await db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    emailVerified: users.emailVerified,
  })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  return foundUsers.length > 0 ? foundUsers[0] : null;
}

export default {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  invalidateRefreshToken,
  invalidateAllUserTokens,
  registerUser,
  loginUser,
  verifyEmail,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  getUserById,
  getUserByEmail,
};
