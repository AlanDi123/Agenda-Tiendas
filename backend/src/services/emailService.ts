/**
 * Email Service — re-exports y funciones legacy mantenidas para compatibilidad
 *
 * Las nuevas implementaciones viven en:
 *  - authEmails.ts      → verificación, passwords, bienvenida, login-alert, eliminación
 *  - billingEmails.ts   → recibos, expiración, pago fallido
 *  - notificationEmails.ts → familia, eventos, resumen semanal
 *  - emailQueue.ts      → cola asíncrona + circuit breaker + retry
 */

export { sanitizeHtmlInput, enqueueEmail, processOutbox } from './emailQueue';
export {
  sendVerificationCodeEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendNewLoginAlert,
  sendAccountDeletionConfirmation,
} from './authEmails';
export {
  sendPaymentReceiptEmail,
  sendExpiryWarningEmail,
  sendPaymentFailedEmail,
} from './billingEmails';
export {
  sendFamilyInvitationEmail,
  sendFamilyEventNotification,
  sendWeeklySummaryEmail,
} from './notificationEmails';

// ─── Legacy: verificación de código OTP (mantiene lógica de DB) ───────────────
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import db from '../db';
import { emailVerifications, users } from '../db/schema';
import { sendVerificationCodeEmail } from './authEmails';

const CODE_EXPIRY_MIN = parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || '5');

function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export interface VerificationCodeResult {
  success: boolean;
  code?: string;
  message: string;
}

export async function sendVerificationCode(
  userId: string,
  email: string
): Promise<VerificationCodeResult> {
  try {
    const code = generate6DigitCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MIN * 60 * 1000);

    await db.update(emailVerifications)
      .set({ verified: true, verifiedAt: new Date() })
      .where(and(
        eq(emailVerifications.userId, userId),
        eq(emailVerifications.verified, false)
      ));

    await db.insert(emailVerifications).values({
      id: uuidv4(),
      userId,
      code: codeHash,
      expiresAt,
      verified: false,
    });

    await sendVerificationCodeEmail(email, code, CODE_EXPIRY_MIN);

    return {
      success: true,
      code: process.env.NODE_ENV !== 'production' ? code : undefined,
      message: 'Código enviado',
    };
  } catch (err) {
    console.error('[EmailService] sendVerificationCode error:', err);
    return { success: false, message: 'Error al enviar código' };
  }
}

export async function verifyCode(
  userId: string,
  code: string
): Promise<{ success: boolean; message: string; email?: string }> {
  try {
    const rows = await db.select({
      id: emailVerifications.id,
      code: emailVerifications.code,
      expiresAt: emailVerifications.expiresAt,
    })
      .from(emailVerifications)
      .where(and(
        eq(emailVerifications.userId, userId),
        eq(emailVerifications.verified, false)
      ))
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1);

    if (!rows.length) {
      return { success: false, message: 'No hay código pendiente. Solicitá uno nuevo.' };
    }

    const row = rows[0];

    if (row.expiresAt < new Date()) {
      return { success: false, message: 'El código expiró. Solicitá uno nuevo.' };
    }

    const valid = await bcrypt.compare(code, row.code);
    if (!valid) {
      return { success: false, message: 'Código incorrecto. Verificá e intentá de nuevo.' };
    }

    await db.update(emailVerifications)
      .set({ verified: true, verifiedAt: new Date() })
      .where(eq(emailVerifications.id, row.id));

    await db.update(users)
      .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));

    const user = await db.select({ email: users.email })
      .from(users).where(eq(users.id, userId)).limit(1);

    return { success: true, message: 'Email verificado', email: user[0]?.email };
  } catch (err) {
    console.error('[EmailService] verifyCode error:', err);
    return { success: false, message: 'Error al verificar código' };
  }
}

export async function invalidateUserTokens(userId: string): Promise<void> {
  await db.update(emailVerifications)
    .set({ verified: true, verifiedAt: new Date() })
    .where(eq(emailVerifications.userId, userId))
    .catch((err: unknown) => console.error('[EmailService] invalidateUserTokens error:', err));
}

/** @deprecated Usar sendFamilyInvitationEmail de notificationEmails.ts */
export async function sendFamilyCode(
  email: string,
  familyName: string,
  familyCode: string
): Promise<void> {
  const { sendFamilyInvitationEmail } = await import('./notificationEmails');
  await sendFamilyInvitationEmail({ email, familyName, familyCode });
}

export default {
  sendVerificationCode,
  verifyCode,
  invalidateUserTokens,
  sendFamilyCode,
};
