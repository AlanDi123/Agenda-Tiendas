/**
 * Email Service
 * Handles sending verification codes and other transactional emails
 */

import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';

// ============================================
// CONFIGURATION
// ============================================

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.ethereal.email';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Dommuss Agenda <noreply@dommuss.com>';
const CODE_EXPIRY_MINUTES = parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || '15');

// ============================================
// TRANSPORTER
// ============================================

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('[EmailService] SMTP verification failed:', error.message);
  } else {
    console.log('[EmailService] SMTP connection established successfully');
  }
});

// ============================================
// TYPES
// ============================================

export interface VerificationCodeResult {
  success: boolean;
  code?: string; // Only returned in development
  message: string;
}

// ============================================
// FUNCTIONS
// ============================================

/**
 * Generate a 6-digit verification code
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification code to user's email
 * Creates a code hash, stores in DB, and sends email
 */
export async function sendVerificationCode(userId: string, email: string): Promise<VerificationCodeResult> {
  try {
    // Generate 6-digit code
    const code = generateVerificationCode();
    
    // Hash the code
    const codeHash = await bcrypt.hash(code, 10);
    
    // Set expiration time
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);
    
    // Invalidate any existing unused codes for this user
    await prisma.emailVerificationToken.updateMany({
      where: {
        userId,
        used: false,
      },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });
    
    // Store new verification token
    await prisma.emailVerificationToken.create({
      data: {
        id: uuidv4(),
        userId,
        email,
        codeHash,
        expiresAt,
        used: false,
      },
    });
    
    // Send email
    const mailOptions = {
      from: SMTP_FROM,
      to: email,
      subject: 'Código de Verificación - Dommuss Agenda',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #2D3E50 0%, #4A6FA5 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .code-box { background: white; border: 2px dashed #4A6FA5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
              .code { font-size: 32px; font-weight: bold; color: #2D3E50; letter-spacing: 8px; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Verifica tu Email</h1>
                <p>Dommuss Agenda</p>
              </div>
              <div class="content">
                <p>Hola,</p>
                <p>Has solicitado verificar tu dirección de email en Dommuss Agenda. Usa el siguiente código para completar la verificación:</p>
                
                <div class="code-box">
                  <div class="code">${code}</div>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">Código de 6 dígitos</p>
                </div>
                
                <div class="warning">
                  <strong>⚠️ Importante:</strong>
                  <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    <li>Este código expira en ${CODE_EXPIRY_MINUTES} minutos</li>
                    <li>No compartas este código con nadie</li>
                    <li>Si no solicitaste este código, ignora este email</li>
                  </ul>
                </div>
                
                <p>Una vez verificado, tendrás acceso completo a todas las funcionalidades de Dommuss Agenda.</p>
                
                <div class="footer">
                  <p>© ${new Date().getFullYear()} Dommuss Agenda. Todos los derechos reservados.</p>
                  <p>Este es un email automático, por favor no respondas.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
        Verificación de Email - Dommuss Agenda
        
        Tu código de verificación es: ${code}
        
        Este código expira en ${CODE_EXPIRY_MINUTES} minutos.
        
        Si no solicitaste este código, ignora este email.
        
        ---
        Dommuss Agenda
      `,
    };
    
    await transporter.sendMail(mailOptions);
    
    console.log(`[EmailService] Verification code sent to ${email}`);
    
    // In development, return the code for testing
    const isDevelopment = process.env.NODE_ENV === 'development' || !SMTP_USER;
    
    return {
      success: true,
      code: isDevelopment ? code : undefined,
      message: 'Código de verificación enviado',
    };
  } catch (error) {
    console.error('[EmailService] Error sending verification code:', error);
    return {
      success: false,
      message: 'Error al enviar código de verificación',
    };
  }
}

/**
 * Verify the code provided by user
 */
export async function verifyCode(userId: string, code: string): Promise<{
  success: boolean;
  message: string;
  email?: string;
}> {
  try {
    // Find the most recent unused token for this user
    const tokens = await prisma.emailVerificationToken.findMany({
      where: {
        userId,
        used: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
    });
    
    if (tokens.length === 0) {
      return {
        success: false,
        message: 'No hay códigos de verificación pendientes',
      };
    }
    
    const token = tokens[0];
    
    // Check if expired
    if (token.expiresAt < new Date()) {
      return {
        success: false,
        message: 'El código ha expirado. Solicita uno nuevo.',
      };
    }
    
    // Verify the code
    const isValid = await bcrypt.compare(code, token.codeHash);
    
    if (!isValid) {
      return {
        success: false,
        message: 'Código inválido',
      };
    }
    
    // Mark token as used
    await prisma.emailVerificationToken.update({
      where: { id: token.id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });
    
    return {
      success: true,
      message: 'Email verificado exitosamente',
      email: token.email,
    };
  } catch (error) {
    console.error('[EmailService] Error verifying code:', error);
    return {
      success: false,
      message: 'Error al verificar código',
    };
  }
}

/**
 * Invalidate all verification tokens for a user
 */
export async function invalidateUserTokens(userId: string): Promise<void> {
  try {
    await prisma.emailVerificationToken.updateMany({
      where: { userId },
      data: { used: true, usedAt: new Date() },
    });
  } catch (error) {
    console.error('[EmailService] Error invalidating tokens:', error);
  }
}

export default {
  sendVerificationCode,
  verifyCode,
  invalidateUserTokens,
};
