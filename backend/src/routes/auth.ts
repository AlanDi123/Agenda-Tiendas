/**
 * Authentication Routes (v1)
 * Handles registration, login, verification, password reset
 * Uses Drizzle ORM with Neon PostgreSQL
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';
import { sendVerificationCode, verifyCode, sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';
import { createError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

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
  deviceId: z.string().optional(),
});

const verifyEmailSchema = z.object({
  token: z.string(),
});

const verifyCodeSchema = z.object({
  code: z.string().length(6),
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

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.registerUser(data);

    // Enviar el mail de verificación por Resend
    try {
      await sendVerificationEmail(result.user.email, result.verificationToken);
    } catch (emailError) {
      console.error('[Auth] Error enviando mail de verificación:', emailError);
      // No fallar el registro si el mail falla — el usuario puede reenviar
    }

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        message: 'Registro exitoso. Verificá tu email.',
        // Solo devolver el token en desarrollo para testing
        verificationToken: process.env.NODE_ENV !== 'production' ? result.verificationToken : undefined,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid registration data', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// ============================================
// EMAIL VERIFICATION (TOKEN)
// ============================================

router.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);
    const result = await authService.verifyEmail(token);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/resend-verification', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = resendVerificationSchema.parse(req.body);
    const result = await authService.resendVerificationEmail(email);

    // Enviar el nuevo token por Resend
    if (result.verificationToken) {
      try {
        await sendVerificationEmail(email, result.verificationToken);
      } catch (emailError) {
        console.error('[Auth] Error reenviando mail:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Código de verificación enviado',
      // NO exponer el token en producción
      verificationToken: process.env.NODE_ENV !== 'production' ? result.verificationToken : undefined,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// EMAIL VERIFICATION (CODE)
// ============================================

router.post('/send-verification', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const userEmail = (req as AuthRequest).user?.email;

    if (!userId || !userEmail) {
      throw createError('Usuario no autenticado', 401, 'UNAUTHORIZED');
    }

    const result = await sendVerificationCode(userId, userEmail);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-code', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { code } = verifyCodeSchema.parse(req.body);

    if (!userId) {
      throw createError('Usuario no autenticado', 401, 'UNAUTHORIZED');
    }

    const result = await verifyCode(userId, code);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Código inválido', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// ============================================
// LOGIN / LOGOUT
// ============================================

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, deviceId } = loginSchema.parse(req.body);

    const result = await authService.loginUser(
      email,
      password,
      req.ip,
      req.headers['user-agent'],
      deviceId
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
    next(error);
  }
});

router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const { tokenId } = await authService.verifyRefreshToken(refreshToken);
      await authService.invalidateRefreshToken(tokenId);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout-all', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;

    if (!userId) {
      throw createError('Usuario no autenticado', 401, 'UNAUTHORIZED');
    }

    await authService.invalidateAllUserTokens(userId);

    res.json({
      success: true,
      message: 'Logged out from all devices',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PASSWORD RESET
// ============================================

router.post('/password-reset/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = passwordResetRequestSchema.parse(req.body);
    const result = await authService.requestPasswordReset(email);

    // Enviar mail de recuperación
    if (result.resetToken) {
      try {
        await sendPasswordResetEmail(email, result.resetToken);
      } catch (emailError) {
        console.error('[Auth] Error enviando mail de reset:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Si el email existe, recibirás instrucciones en tu correo.',
      // Solo en desarrollo:
      resetToken: process.env.NODE_ENV !== 'production' ? result.resetToken : undefined,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/password-reset/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = passwordResetSchema.parse(req.body);
    const result = await authService.resetPassword(token, newPassword);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TOKEN REFRESH
// ============================================

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);

    const { userId } = await authService.verifyRefreshToken(refreshToken);
    const user = await authService.getUserById(userId);

    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    const accessToken = authService.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// USER INFO
// ============================================

router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRoutes };
