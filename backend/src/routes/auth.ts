/**
 * Authentication Routes (v1)
 * Handles registration, login, verification, password reset, and token refresh
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';
import { logAuthFailure, logApiError } from '../services/errorLogger';
import { createError } from '../middleware/errorHandler';
import { authMiddleware, requireAuth } from '../middleware/auth';

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['USER', 'OWNER']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string(),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const passwordResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// ============================================
// REGISTRATION
// ============================================

/**
 * POST /api/v1/auth/register
 * Register new user
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    const result = await authService.registerUser(data);

    // In production: Send verification email with token
    // For now, return token for testing
    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        message: 'Registration successful. Please verify your email.',
        // verificationToken: result.verificationToken, // Remove in production
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid registration data', 400, 'VALIDATION_ERROR'));
    }

    await logApiError(
      '/api/v1/auth/register',
      'POST',
      (error as any).code || 'REGISTRATION_ERROR',
      (error as any).message,
      {
        email: req.body.email,
        device: req.headers['user-agent'],
        ipAddress: req.ip,
      }
    );

    next(error);
  }
});

// ============================================
// EMAIL VERIFICATION
// ============================================

/**
 * POST /api/v1/auth/verify-email
 * Verify email with token
 */
router.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);

    const result = await authService.verifyEmail(token);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    await logAuthFailure(
      '/api/v1/auth/verify-email',
      'POST',
      'Email verification failed',
      {
        device: req.headers['user-agent'],
        ipAddress: req.ip,
      }
    );
    next(error);
  }
});

/**
 * POST /api/v1/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = resendVerificationSchema.parse(req.body);

    const result = await authService.resendVerificationEmail(email);

    res.json({
      success: true,
      message: result.message,
      // verificationToken: result.verificationToken, // Remove in production
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LOGIN / LOGOUT
// ============================================

/**
 * POST /api/v1/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await authService.loginUser(
      email,
      password,
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    await logAuthFailure(
      '/api/v1/auth/login',
      'POST',
      (error as any).code === 'INVALID_CREDENTIALS' ? 'Invalid credentials' : 'Login failed',
      {
        email: req.body.email,
        device: req.headers['user-agent'],
        ipAddress: req.ip,
      }
    );
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout user (invalidate refresh token)
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.logoutUser(refreshToken);
    } else {
      // Logout all sessions
      await authService.logoutAllSessions(req.user!.id);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TOKEN REFRESH
// ============================================

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);

    const result = await authService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.newRefreshToken,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    await logAuthFailure(
      '/api/v1/auth/refresh',
      'POST',
      'Token refresh failed',
      {
        device: req.headers['user-agent'],
        ipAddress: req.ip,
      }
    );
    next(error);
  }
});

// ============================================
// PASSWORD RESET
// ============================================

/**
 * POST /api/v1/auth/request-password-reset
 * Request password reset
 */
router.post('/request-password-reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = passwordResetRequestSchema.parse(req.body);

    const result = await authService.requestPasswordReset(email);

    res.json({
      success: true,
      message: result.message,
      // resetToken: result.resetToken, // Remove in production
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = passwordResetSchema.parse(req.body);

    const result = await authService.resetPassword(token, newPassword);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    await logAuthFailure(
      '/api/v1/auth/reset-password',
      'POST',
      'Password reset failed',
      {
        device: req.headers['user-agent'],
        ipAddress: req.ip,
      }
    );
    next(error);
  }
});

// ============================================
// USER PROFILE
// ============================================

/**
 * GET /api/v1/auth/me
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getUserProfile(req.user!.id);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout-all
 * Logout all sessions
 */
router.post('/logout-all', authMiddleware, async (req: Request, res: Response) => {
  await authService.logoutAllSessions(req.user!.id);

  res.json({
    success: true,
    message: 'All sessions logged out',
  });
});

export { router as authRoutes };
