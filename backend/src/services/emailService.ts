/**
 * Email Service
 * Handles sending verification codes and other transactional emails
 * Uses Resend API for email delivery
 */

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import db from '../db';
import { emailVerifications, users } from '../db/schema';

// ============================================
// CONFIGURATION
// ============================================

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Dommuss Agenda <onboarding@resend.dev>';
const CODE_EXPIRY_MINUTES = parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || '15');

// Use Resend API if configured, otherwise fallback to SMTP
const USE_RESEND = !!RESEND_API_KEY;

// ============================================
// TRANSPORTER
// ============================================

// Resend API transport
async function sendViaResend(to: string, subject: string, html: string, text: string): Promise<void> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: SMTP_FROM,
        to,
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send email via Resend');
    }

    console.log('[EmailService] Email sent via Resend');
  } catch (error) {
    console.error('[EmailService] Resend error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// Verify configuration on startup
if (USE_RESEND) {
  console.log('[EmailService] Using Resend API for email delivery');
} else {
  console.warn('[EmailService] RESEND_API_KEY not configured. Email sending disabled in production.');
}

// ============================================
// TYPES
// ============================================

export interface VerificationCodeResult {
  success: boolean;
  code?: string;
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
 */
export async function sendVerificationCode(userId: string, email: string): Promise<VerificationCodeResult> {
  try {
    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate existing unused codes
    await db.update(emailVerifications)
      .set({
        verified: true,
        verifiedAt: new Date(),
      })
      .where(
        and(
          eq(emailVerifications.userId, userId),
          eq(emailVerifications.verified, false)
        )
      );

    // Store new verification code
    await db.insert(emailVerifications).values({
      id: uuidv4(),
      userId,
      code: codeHash,
      expiresAt,
      verified: false,
    });

    // Prepare email content
    const mailOptions = {
      subject: 'Código de Verificación - Dommuss Agenda',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
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

    // Send email via Resend
    if (USE_RESEND) {
      await sendViaResend(email, mailOptions.subject, mailOptions.html, mailOptions.text);
    } else {
      console.log('[EmailService] Development mode - showing code in console:', code);
    }

    console.log(`[EmailService] Verification code sent to ${email}`);

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
    // Find the most recent unused code for this user
    const verifications = await db.select({
      id: emailVerifications.id,
      code: emailVerifications.code,
      expiresAt: emailVerifications.expiresAt,
    })
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.userId, userId),
          eq(emailVerifications.verified, false)
        )
      )
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1);

    if (verifications.length === 0) {
      return {
        success: false,
        message: 'No hay códigos de verificación pendientes',
      };
    }

    const verification = verifications[0];

    // Check expiration
    if (verification.expiresAt < new Date()) {
      return {
        success: false,
        message: 'El código ha expirado. Solicita uno nuevo.',
      };
    }

    // Verify the code
    const isValid = await bcrypt.compare(code, verification.code);

    if (!isValid) {
      return {
        success: false,
        message: 'Código inválido',
      };
    }

    // Mark as verified
    await db.update(emailVerifications)
      .set({
        verified: true,
        verifiedAt: new Date(),
      })
      .where(eq(emailVerifications.id, verification.id));

    // Get user email
    const foundUsers = await db.select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return {
      success: true,
      message: 'Email verificado exitosamente',
      email: foundUsers[0]?.email,
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
    await db.update(emailVerifications)
      .set({ verified: true, verifiedAt: new Date() })
      .where(eq(emailVerifications.userId, userId));
  } catch (error) {
    console.error('[EmailService] Error invalidating tokens:', error);
  }
}

export default {
  sendVerificationCode,
  verifyCode,
  invalidateUserTokens,
};
