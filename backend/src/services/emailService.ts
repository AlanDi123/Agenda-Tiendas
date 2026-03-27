/**
 * Email Service — Gmail SMTP via Nodemailer
 * Versión simplificada: envío directo sin cola ni circuit breaker.
 */

import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import db from '../db';
import { emailVerifications, users } from '../db/schema';

// ─── Transporter Gmail ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const getSender = () => `"Agenda Dommuss" <${process.env.GMAIL_USER}>`;

/** Verifica que la conexión SMTP funcione (usado por /health/deep) */
export async function verifySmtpConnection(): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return false;
  try {
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}

// ─── Función 1: Verificación de Email ────────────────────────────────────────
export async function sendVerificationEmail(email: string, code: string) {
  console.log(`[EmailService] Enviando verificación a: ${email}`);
  try {
    const info = await transporter.sendMail({
      from: getSender(),
      to: email,
      subject: 'Tu código de verificación - Agenda',
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 400px; margin: 0 auto;">
          <h2 style="color: #333;">¡Bienvenido a la Agenda!</h2>
          <p style="color: #666;">Tu código de verificación es:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #FF6B35; font-size: 36px; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p style="color: #999; font-size: 12px;">Ingresa este código en la aplicación para activar tu cuenta.</p>
        </div>
      `,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Error crítico enviando verificación:', error);
    throw new Error('No se pudo enviar el correo de verificación.');
  }
}

// ─── Función 2: Reseteo de Contraseña ────────────────────────────────────────
export async function sendPasswordResetEmail(email: string, resetToken: string) {
  console.log(`[EmailService] Enviando token de recuperación a: ${email}`);
  try {
    await transporter.sendMail({
      from: getSender(),
      to: email,
      subject: 'Recuperación de contraseña - Agenda',
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 400px; margin: 0 auto;">
          <h2 style="color: #333;">Recuperación de cuenta</h2>
          <p style="color: #666;">Has solicitado restablecer tu contraseña. Usa este código de seguridad temporal:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #FF6B35; font-size: 32px; letter-spacing: 5px; margin: 0;">${resetToken}</h1>
          </div>
          <p style="color: #999; font-size: 12px;">Si no solicitaste esto, ignora este mensaje por tu seguridad.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Error enviando token de reseteo:', error);
    throw new Error('No se pudo enviar el correo de recuperación.');
  }
}

// ─── Función 3: Invitación a la Familia ──────────────────────────────────────
export async function sendFamilyCodeEmail(email: string, familyName: string, familyCode: string) {
  console.log(`[EmailService] Enviando código de familia a: ${email}`);
  try {
    await transporter.sendMail({
      from: getSender(),
      to: email,
      subject: `Código de invitación para ${familyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 400px; margin: 0 auto;">
          <h2 style="color: #333;">¡Tu espacio "${familyName}" ha sido creado!</h2>
          <p style="color: #666;">Comparte este código con los miembros de tu equipo o familia para que puedan unirse:</p>
          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #4CAF50; font-size: 36px; letter-spacing: 5px; margin: 0;">${familyCode}</h1>
          </div>
          <p style="color: #999; font-size: 12px;">Solo deben descargar la app, seleccionar "Unirme a una familia existente" e ingresar este código.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Error enviando código de familia:', error);
    throw new Error('No se pudo enviar el correo de la familia.');
  }
}

// ─── Legacy: sendFamilyCode (alias para compatibilidad con appVersion.ts) ────
export async function sendFamilyCode(
  email: string,
  familyName: string,
  familyCode: string
): Promise<void> {
  await sendFamilyCodeEmail(email, familyName, familyCode);
}

// ─── OTP: Generación y verificación de código de email ───────────────────────
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

    // Invalidar códigos anteriores
    await db.update(emailVerifications)
      .set({ verified: true, verifiedAt: new Date() })
      .where(and(
        eq(emailVerifications.userId, userId),
        eq(emailVerifications.verified, false)
      ));

    // Guardar nuevo código hasheado
    await db.insert(emailVerifications).values({
      id: uuidv4(),
      userId,
      code: codeHash,
      expiresAt,
      verified: false,
    });

    // Enviar por Gmail
    await sendVerificationEmail(email, code);

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

// ─── Notificación de eventos familiares ──────────────────────────────────────
export async function sendFamilyEventNotification(
  emails: string[],
  actorName: string,
  action: string,
  eventTitle?: string,
  startDate?: Date
): Promise<void> {
  const detailsText = [
    eventTitle ? `Evento: <strong>${eventTitle}</strong>` : '',
    startDate ? `Fecha: ${startDate.toLocaleDateString('es-AR')}` : '',
  ].filter(Boolean).join('<br/>');
  for (const email of emails) {
    try {
      await transporter.sendMail({
        from: getSender(),
        to: email,
        subject: `Actividad familiar - ${action}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto;">
            <h2 style="color: #333;">Actividad en tu familia</h2>
            <p><strong>${actorName}</strong> realizó la acción: <strong>${action}</strong></p>
            ${detailsText ? `<p style="color:#555;">${detailsText}</p>` : ''}
          </div>
        `,
      });
    } catch (err) {
      console.warn('[EmailService] sendFamilyEventNotification error:', err);
    }
  }
}

export default {
  sendVerificationCode,
  verifyCode,
  invalidateUserTokens,
  sendFamilyCode,
  sendPasswordResetEmail,
  sendFamilyCodeEmail,
  sendVerificationEmail,
};
