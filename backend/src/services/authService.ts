/**
 * Authentication Service
 * Handles user registration, login, verification, and password recovery
 */

import prisma from '../lib/prisma';
import crypto from 'crypto';
import { createError } from '../middleware/errorHandler';
import { UserRole } from '@prisma/client';

// ============================================
// CONFIGURATION
// ============================================

const VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

// ============================================
// PASSWORD UTILITIES
// ============================================

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  // In production, use bcrypt: return bcrypt.hash(password, 12);
  // For now, using crypto as placeholder
  const hash = crypto.createHash('sha256');
  hash.update(password + process.env.PASSWORD_SALT || 'default-salt-change-in-production');
  return hash.digest('hex');
}

/**
 * Verify password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // In production, use bcrypt: return bcrypt.compare(password, hash);
  const testHash = crypto.createHash('sha256');
  testHash.update(password + process.env.PASSWORD_SALT || 'default-salt-change-in-production');
  return testHash.digest('hex') === hash;
}

/**
 * Generate secure random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// ============================================
// REGISTRATION
// ============================================

export interface RegisterData {
  email: string;
  password: string;
  role?: UserRole;
}

/**
 * Register new user
 */
export async function registerUser(data: RegisterData): Promise<{
  user: { id: string; email: string; role: UserRole };
  verificationToken: string;
}> {
  const { email, password, role = UserRole.USER } = data;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw createError('Email already registered', 409, 'EMAIL_EXISTS');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Generate verification token
  const verificationToken = generateToken();
  const verificationTokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      role,
      verificationToken,
      verificationTokenExpires,
    },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
    },
  });

  return {
    user,
    verificationToken,
  };
}

// ============================================
// EMAIL VERIFICATION
// ============================================

/**
 * Verify email with token
 */
export async function verifyEmail(token: string): Promise<{
  success: boolean;
  message: string;
}> {
  const user = await prisma.user.findUnique({
    where: { verificationToken: token },
  });

  if (!user) {
    throw createError('Invalid verification token', 400, 'INVALID_TOKEN');
  }

  if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
    throw createError('Verification token expired', 400, 'TOKEN_EXPIRED');
  }

  // Update user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      verificationToken: null,
      verificationTokenExpires: null,
    },
  });

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
  verificationToken?: string; // In production, send via email, don't return
}> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    // Don't reveal if email exists
    return {
      success: true,
      message: 'If the email exists, a verification link has been sent',
    };
  }

  if (user.emailVerified) {
    throw createError('Email already verified', 400, 'ALREADY_VERIFIED');
  }

  // Generate new token
  const verificationToken = generateToken();
  const verificationTokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationToken,
      verificationTokenExpires,
    },
  });

  // In production: Send email with verification link
  // For now, return token for testing
  return {
    success: true,
    message: 'Verification email sent',
    verificationToken,
  };
}

// ============================================
// LOGIN / LOGOUT
// ============================================

export interface LoginResult {
  user: {
    id: string;
    email: string;
    role: UserRole;
    emailVerified: boolean;
    planType: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Login user
 */
export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string,
  device?: string
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    // Generic error to prevent email enumeration
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Verify password
  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Generate tokens
  const accessToken = generateToken(64);
  const refreshToken = generateToken(64);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);

  // Store refresh token
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      device,
      expiresAt,
    },
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  });

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
 * Logout user (invalidate refresh token)
 */
export async function logoutUser(refreshToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });
}

/**
 * Logout all sessions for user
 */
export async function logoutAllSessions(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}

// ============================================
// REFRESH TOKEN
// ============================================

/**
 * Refresh access token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  newRefreshToken?: string;
  expiresAt: Date;
}> {
  const token = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: {
      user: true,
    },
  });

  if (!token) {
    throw createError('Invalid refresh token', 401, 'INVALID_TOKEN');
  }

  if (token.expiresAt < new Date()) {
    // Token expired, delete it
    await prisma.refreshToken.delete({
      where: { id: token.id },
    });
    throw createError('Refresh token expired', 401, 'TOKEN_EXPIRED');
  }

  // Generate new tokens
  const accessToken = generateToken(64);
  const newRefreshToken = generateToken(64);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);

  // Replace refresh token (rotation)
  await prisma.refreshToken.update({
    where: { id: token.id },
    data: {
      token: newRefreshToken,
      expiresAt,
    },
  });

  return {
    accessToken,
    newRefreshToken,
    expiresAt,
  };
}

// ============================================
// PASSWORD RESET
// ============================================

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  message: string;
  resetToken?: string; // In production, send via email
}> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    // Don't reveal if email exists
    return {
      success: true,
      message: 'If the email exists, a reset link has been sent',
    };
  }

  // Generate reset token
  const resetToken = generateToken();
  const resetTokenExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpires,
    },
  });

  // In production: Send email with reset link
  return {
    success: true,
    message: 'Password reset email sent',
    resetToken,
  };
}

/**
 * Reset password with token
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{
  success: boolean;
  message: string;
}> {
  const user = await prisma.user.findUnique({
    where: { resetToken: token },
  });

  if (!user) {
    throw createError('Invalid reset token', 400, 'INVALID_TOKEN');
  }

  if (user.resetTokenExpires && user.resetTokenExpires < new Date()) {
    throw createError('Reset token expired', 400, 'TOKEN_EXPIRED');
  }

  // Validate password strength
  if (newPassword.length < 8) {
    throw createError('Password must be at least 8 characters', 400, 'WEAK_PASSWORD');
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update user and invalidate all sessions
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    }),
    prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  return {
    success: true,
    message: 'Password reset successfully',
  };
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Get user profile
 */
export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      planType: true,
      planStatus: true,
      currentPeriodEnd: true,
      createdAt: true,
      lastLoginAt: true,
      ownedLocations: {
        select: {
          id: true,
          name: true,
          active: true,
        },
      },
      staffAssignments: {
        select: {
          id: true,
          role: true,
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return user;
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole,
  adminUserId: string
): Promise<void> {
  // Verify admin
  const admin = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });

  if (admin?.role !== UserRole.ADMIN) {
    throw createError('Unauthorized', 403, 'UNAUTHORIZED');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });
}
