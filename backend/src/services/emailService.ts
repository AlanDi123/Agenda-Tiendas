/**
 * Email Service — usando Resend SDK oficial v4
 * Documentación: https://resend.com/docs/send-with-nodejs
 */

import { Resend } from 'resend';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import db from '../db';
import { emailVerifications, users } from '../db/schema';

// ─── Configuración ───────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_ADDRESS   = process.env.SMTP_FROM || 'Dommuss Agenda <onboarding@resend.dev>';

function resolveEmailAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  const v = process.env.VERCEL_URL;
  if (v) return `https://${v.replace(/^https?:\/\//, '')}`;
  return 'https://agenda-tienda.vercel.app';
}

const APP_BASE_URL = resolveEmailAppBaseUrl();
const CODE_EXPIRY_MIN = parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || '15');

// Inicializar el cliente de Resend
const resend = new Resend(RESEND_API_KEY);

if (!RESEND_API_KEY) {
  console.warn('[EmailService] ⚠️  RESEND_API_KEY no configurada. Los mails NO se enviarán.');
} else {
  console.log('[EmailService] ✅ Resend SDK inicializado correctamente.');
}

// ─── Helper de envío ─────────────────────────────────────────────────────────
async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[EmailService] Mail no enviado (sin API key):', opts.to, opts.subject);
    return;
  }

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (error) {
    console.error('[EmailService] Error de Resend:', JSON.stringify(error));
    const extra = 'name' in error && error.name ? ` (${error.name})` : '';
    throw new Error(`Resend error: ${error.message}${extra}`);
  }

  console.log('[EmailService] ✉️  Mail enviado, id:', data?.id, '→', opts.to);
}

// ─── Verificación de email (código 6 dígitos) ─────────────────────────────────
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

    const html = `
      <!DOCTYPE html><html><head><style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:20px}
        .box{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08)}
        .hdr{background:#1565C0;padding:28px 24px;text-align:center}
        .hdr h1{color:#fff;margin:0;font-size:22px}
        .hdr p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px}
        .body{padding:28px 24px}
        .code-box{background:#f8f9fa;border:2px dashed #1565C0;border-radius:10px;padding:20px;text-align:center;margin:20px 0}
        .code{font-size:42px;font-weight:800;color:#1565C0;letter-spacing:10px;font-family:monospace}
        .warn{background:#fff3cd;border-left:4px solid #FFC107;padding:12px 16px;border-radius:0 8px 8px 0;font-size:13px;margin:16px 0}
        .ftr{text-align:center;padding:16px;color:#999;font-size:12px;border-top:1px solid #f0f0f0}
      </style></head><body>
        <div class="box">
          <div class="hdr"><h1>🏠 Dommuss Agenda</h1><p>Verificá tu dirección de email</p></div>
          <div class="body">
            <p>Usá el siguiente código para verificar tu cuenta:</p>
            <div class="code-box"><div class="code">${code}</div>
              <p style="margin:8px 0 0;color:#666;font-size:13px">Código válido por ${CODE_EXPIRY_MIN} minutos</p></div>
            <div class="warn">⚠️ No compartas este código. Expira en ${CODE_EXPIRY_MIN} minutos.</div>
          </div>
          <div class="ftr">© ${new Date().getFullYear()} Dommuss Agenda</div>
        </div>
      </body></html>`;

    await sendEmail({
      to: email,
      subject: `${code} — Código de verificación Dommuss`,
      html,
      text: `Tu código de verificación es: ${code}\n\nExpira en ${CODE_EXPIRY_MIN} minutos.`,
    });

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

// ─── Verificar código ─────────────────────────────────────────────────────────
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

    const user = await db.select({ email: users.email })
      .from(users).where(eq(users.id, userId)).limit(1);

    return { success: true, message: 'Email verificado', email: user[0]?.email };
  } catch (err) {
    console.error('[EmailService] verifyCode error:', err);
    return { success: false, message: 'Error al verificar código' };
  }
}

// ─── Mail de verificación inicial (link + token) ──────────────────────────────
export async function sendVerificationEmail(
  email: string,
  verificationToken: string
): Promise<void> {
  const verifyUrl = `${APP_BASE_URL}/verify?token=${verificationToken}`;

  const html = `
    <!DOCTYPE html><html><head><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:20px}
      .box{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08)}
      .hdr{background:#1565C0;padding:28px 24px;text-align:center}
      .hdr h1{color:#fff;margin:0;font-size:22px}.hdr p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px}
      .body{padding:28px 24px}
      .btn{display:block;background:#FFC107;color:#333;text-align:center;padding:16px 24px;border-radius:10px;font-weight:700;font-size:16px;text-decoration:none;margin:24px 0}
      .token{background:#f5f5f5;border:1px dashed #ddd;border-radius:8px;padding:12px;text-align:center;font-family:monospace;font-size:12px;word-break:break-all;color:#555;margin:12px 0}
      .warn{background:#fff3cd;border-left:4px solid #FFC107;padding:12px 16px;border-radius:0 8px 8px 0;font-size:13px}
      .ftr{text-align:center;padding:16px;color:#999;font-size:12px;border-top:1px solid #f0f0f0}
    </style></head><body>
      <div class="box">
        <div class="hdr"><h1>🏠 Dommuss Agenda</h1><p>Activá tu cuenta</p></div>
        <div class="body">
          <p>¡Gracias por registrarte! Hacé clic abajo para verificar tu email:</p>
          <a href="${verifyUrl}" class="btn">✅ Verificar mi email</a>
          <p style="font-size:13px;color:#666">O copiá este token manualmente:</p>
          <div class="token">${verificationToken}</div>
          <div class="warn">⚠️ Este enlace expira en 24 horas.</div>
        </div>
        <div class="ftr">© ${new Date().getFullYear()} Dommuss Agenda</div>
      </div>
    </body></html>`;

  await sendEmail({
    to: email,
    subject: 'Verificá tu email — Dommuss Agenda',
    html,
    text: `Verificá tu cuenta en: ${verifyUrl}\n\nToken: ${verificationToken}\n\nExpira en 24 horas.`,
  });
}

// ─── Mail de recuperación de contraseña ───────────────────────────────────────
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<void> {
  const resetUrl = `${APP_BASE_URL}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html><html><head><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:20px}
      .box{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden}
      .hdr{background:#1565C0;padding:24px;text-align:center}
      .hdr h1{color:#fff;margin:0;font-size:20px}
      .body{padding:24px}
      .btn{display:block;background:#1565C0;color:#fff;text-align:center;padding:14px;border-radius:8px;font-weight:700;text-decoration:none;margin:20px 0}
      .warn{background:#fff3cd;border-left:4px solid #FFC107;padding:12px;border-radius:0 6px 6px 0;font-size:13px}
      .ftr{text-align:center;padding:14px;color:#999;font-size:12px}
    </style></head><body>
      <div class="box">
        <div class="hdr"><h1>🔑 Recuperar contraseña</h1></div>
        <div class="body">
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <a href="${resetUrl}" class="btn">Restablecer contraseña</a>
          <div class="warn">⚠️ Este enlace expira en 1 hora. Si no solicitaste el cambio, ignorá este mail.</div>
        </div>
        <div class="ftr">© ${new Date().getFullYear()} Dommuss Agenda</div>
      </div>
    </body></html>`;

  await sendEmail({
    to: email,
    subject: 'Recuperar contraseña — Dommuss Agenda',
    html,
    text: `Restablecé tu contraseña: ${resetUrl}\n\nExpira en 1 hora.`,
  });
}

// ─── Mail de código de familia ────────────────────────────────────────────────
/** Notificación de cambio de evento a otros miembros (best-effort, no bloquea la app). */
export async function sendFamilyEventNotification(
  emails: string[],
  actorName: string,
  action: string,
  eventTitle: string,
  startDate?: Date
): Promise<void> {
  const when = startDate ? startDate.toLocaleString('es-AR') : '';
  const actionLabel =
    action === 'create' ? 'Nuevo evento' : action === 'update' ? 'Evento actualizado' : 'Evento eliminado';
  const text = `${actionLabel}: "${eventTitle}"${when ? ` (${when})` : ''}\n— ${actorName} (Dommuss Agenda)`;
  await Promise.all(
    emails.map((to) =>
      sendEmail({
        to,
        subject: `${actionLabel}: ${eventTitle} — Dommuss`,
        html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
        text,
      }).catch(() => {})
    )
  );
}

export async function sendFamilyCode(
  email: string,
  familyName: string,
  familyCode: string
): Promise<void> {
  const html = `
    <!DOCTYPE html><html><head><style>
      body{font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px}
      .box{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden}
      .hdr{background:#1565C0;padding:24px;text-align:center;color:#fff}
      .body{padding:24px}
      .code{background:#f5f5f5;border:3px dashed #1565C0;border-radius:12px;padding:20px;text-align:center;font-size:36px;font-weight:800;letter-spacing:.4em;font-family:monospace;color:#1565C0;margin:20px 0}
      .warn{background:#fff3cd;border-left:4px solid #FFC107;padding:12px;border-radius:0 6px 6px 0;font-size:13px}
    </style></head><body>
      <div class="box">
        <div class="hdr"><h2 style="margin:0">🏠 ¡Tu familia está lista!</h2></div>
        <div class="body">
          <p>La familia <strong>${familyName}</strong> fue creada exitosamente.</p>
          <p>Tu código de acceso familiar es:</p>
          <div class="code">${familyCode}</div>
          <div class="warn">⚠️ Guardá este código. Cada miembro que quiera unirse necesitará ingresarlo.</div>
        </div>
      </div>
    </body></html>`;

  await sendEmail({
    to: email,
    subject: `🏠 Código de tu familia "${familyName}" — Dommuss`,
    html,
    text: `Familia: ${familyName}\nCódigo de acceso: ${familyCode}\n\nGuardá este código para compartirlo con tu familia.`,
  });
}

// ─── Invalidar tokens ─────────────────────────────────────────────────────────
export async function invalidateUserTokens(userId: string): Promise<void> {
  await db.update(emailVerifications)
    .set({ verified: true, verifiedAt: new Date() })
    .where(eq(emailVerifications.userId, userId))
    .catch((err: unknown) => console.error('[EmailService] invalidateUserTokens error:', err));
}

export default {
  sendVerificationCode,
  verifyCode,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendFamilyCode,
  sendFamilyEventNotification,
  invalidateUserTokens,
};
