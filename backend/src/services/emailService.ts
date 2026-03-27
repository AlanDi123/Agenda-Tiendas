/**
 * Email Service — Gmail SMTP via Nodemailer
 * Archivo maestro unificado: todas las funciones de correo del proyecto.
 */

import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import db from '../db';
import { emailVerifications, users } from '../db/schema';

// ─── Transporter ──────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const getSender = () => `"Agenda Dommuss" <${process.env.GMAIL_USER}>`;

const APP_BASE_URL = (() => {
  const explicit = process.env.APP_BASE_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  const v = process.env.VERCEL_URL;
  if (v) return `https://${v.replace(/^https?:\/\//, '')}`;
  return 'https://agenda-tienda.vercel.app';
})();
const APP_SCHEME = process.env.APP_DEEP_LINK_SCHEME || 'dommussagenda';
const YEAR = new Date().getFullYear();

function mobileFirstUrl(webUrl: string): string {
  const deep = `${APP_SCHEME}://open?target=${encodeURIComponent(webUrl)}`;
  return `${APP_BASE_URL}/open-app.html?deep=${encodeURIComponent(deep)}&web=${encodeURIComponent(webUrl)}`;
}

export function sanitizeHtmlInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Plantilla base con diseño profesional de marca Dommuss */
const baseHtml = (title: string, content: string) => `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f9;margin:0;padding:20px;color:#333}
  .wrap{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
  .hdr{background:#FF6B35;padding:28px 24px;text-align:center}
  .hdr h1{color:#fff;margin:0;font-size:22px;font-weight:700}
  .hdr p{color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px}
  .body{padding:28px 24px;line-height:1.6}
  .code-box{background:#fff7f4;border:2px dashed #FF6B35;border-radius:12px;padding:20px;text-align:center;margin:20px 0}
  .code{font-size:42px;font-weight:900;color:#FF6B35;letter-spacing:10px;font-family:monospace}
  .btn{display:block;background:#FF6B35;color:#fff;text-align:center;padding:16px 24px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;margin:24px 0}
  .btn-green{background:#4CAF50}
  .btn-red{background:#b71c1c}
  .info-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .info-row:last-child{border-bottom:none;font-weight:700}
  .receipt{background:#f9fbe7;border:1px solid #c5e1a5;border-radius:10px;padding:20px;margin:16px 0}
  .alert{background:#ffebee;border-left:4px solid #b71c1c;padding:12px 16px;border-radius:0 8px 8px 0;font-size:14px;margin:16px 0}
  .warn{background:#fff3cd;border-left:4px solid #FFC107;padding:12px 16px;border-radius:0 8px 8px 0;font-size:13px;margin:16px 0}
  .step{display:flex;align-items:flex-start;gap:12px;margin:16px 0;padding:16px;background:#f8f9fa;border-radius:10px}
  .step-icon{font-size:24px;min-width:32px}
  .step-text{font-size:14px;color:#444}
  .step-text strong{display:block;color:#FF6B35;margin-bottom:4px}
  table{width:100%;border-collapse:collapse}
  th{background:#fff7f4;color:#FF6B35;padding:10px 12px;text-align:left;font-size:13px;font-weight:700}
  td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px}
  .empty{text-align:center;padding:32px;color:#aaa;font-size:14px}
  .ftr{text-align:center;padding:16px;color:#aaa;font-size:11px;border-top:1px solid #f0f0f0}
</style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>${title}</h1></div>
    <div class="body">${content}</div>
    <div class="ftr">© ${YEAR} Agenda Dommuss &middot; Todos los derechos reservados.</div>
  </div>
</body></html>`;

// ─── SMTP Health ──────────────────────────────────────────────────────────────
export async function verifySmtpConnection(): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return false;
  try { await transporter.verify(); return true; } catch { return false; }
}

// ─── Helper interno ───────────────────────────────────────────────────────────
async function send(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({ from: getSender(), to, subject, html });
  } catch (err) {
    console.error(`[EmailService] Error enviando a ${to}:`, err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  const safeName = sanitizeHtmlInput(email);
  await send(email, `${code} — Código de verificación Dommuss`,
    baseHtml('Verifica tu cuenta', `
      <p>Hola <strong>${safeName}</strong>, usá el siguiente código para verificar tu cuenta:</p>
      <div class="code-box">
        <div class="code">${code}</div>
        <p style="margin:8px 0 0;color:#666;font-size:13px">Válido por 5 minutos</p>
      </div>
      <div class="warn">⚠️ No compartas este código con nadie.</div>
    `));
}

/** Alias con expiryMin explícito (compatible con authEmails.ts) */
export async function sendVerificationCodeEmail(
  email: string, code: string, expiryMin: number
): Promise<void> {
  const safeName = sanitizeHtmlInput(email);
  await send(email, `${code} — Código de verificación Dommuss`,
    baseHtml('Verifica tu cuenta', `
      <p>Hola <strong>${safeName}</strong>, usá el siguiente código para verificar tu cuenta:</p>
      <div class="code-box">
        <div class="code">${code}</div>
        <p style="margin:8px 0 0;color:#666;font-size:13px">Válido por ${expiryMin} minutos</p>
      </div>
      <div class="warn">⚠️ No compartas este código con nadie. Expira en ${expiryMin} minutos.</div>
    `));
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const resetUrl = `${APP_BASE_URL}/reset-password?token=${resetToken}`;
  const openUrl = mobileFirstUrl(resetUrl);
  await send(email, 'Recuperar contraseña — Dommuss Agenda',
    baseHtml('Recupera tu acceso', `
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p>Usá este código temporal:</p>
      <div class="code-box">
        <div class="code" style="font-size:28px">${resetToken}</div>
      </div>
      <a href="${openUrl}" class="btn">Restablecer contraseña</a>
      <div class="warn">⚠️ Este enlace expira en 1 hora. Si no solicitaste esto, ignorá este correo.</div>
    `));
}

export async function sendWelcomeEmail(email: string, name?: string): Promise<void> {
  const safeName = sanitizeHtmlInput(name || email.split('@')[0]);
  const loginUrl = mobileFirstUrl(`${APP_BASE_URL}/login`);
  await send(email, `¡Bienvenido/a a Dommuss Agenda, ${safeName}! 🎉`,
    baseHtml(`¡Bienvenido/a, ${safeName}! 🎉`, `
      <p>Tu cuenta está lista. Empezá en 3 pasos:</p>
      <div class="step">
        <span class="step-icon">📅</span>
        <div class="step-text"><strong>Creá tu primer evento</strong>Tocá el "+" y completá los datos del turno.</div>
      </div>
      <div class="step">
        <span class="step-icon">👨‍👩‍👧</span>
        <div class="step-text"><strong>Invitá a tu familia</strong>Generá un código en Configuración → Familia.</div>
      </div>
      <div class="step">
        <span class="step-icon">🔔</span>
        <div class="step-text"><strong>Activá notificaciones</strong>Para que nadie se pierda ningún turno.</div>
      </div>
      <a href="${loginUrl}" class="btn">Abrir Dommuss Agenda</a>
    `));
}

export async function sendNewLoginAlert(
  email: string, ipAddress: string, userAgent?: string
): Promise<void> {
  const safeIp = sanitizeHtmlInput(ipAddress);
  const safeAgent = sanitizeHtmlInput(userAgent?.slice(0, 80) || 'desconocido');
  const now = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const resetUrl = mobileFirstUrl(`${APP_BASE_URL}/reset-password`);
  await send(email, '🚨 Nuevo inicio de sesión — Dommuss Agenda',
    baseHtml('🚨 Nuevo inicio de sesión detectado', `
      <p>Se detectó un ingreso a tu cuenta desde una IP diferente.</p>
      <div class="receipt">
        <div class="info-row"><span>Fecha y hora</span><strong>${now} (Argentina)</strong></div>
        <div class="info-row"><span>Dirección IP</span><strong>${safeIp}</strong></div>
        <div class="info-row"><span>Dispositivo</span><strong>${safeAgent}</strong></div>
      </div>
      <div class="alert">⚠️ Si no fuiste vos, cambiá tu contraseña de inmediato.</div>
      <a href="${resetUrl}" class="btn btn-red">Cambiar contraseña ahora</a>
    `));
}

export async function sendAccountDeletionConfirmation(email: string, name?: string): Promise<void> {
  const safeName = sanitizeHtmlInput(name || email.split('@')[0]);
  const now = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  await send(email, 'Tu cuenta de Dommuss Agenda fue eliminada',
    baseHtml('Cuenta eliminada', `
      <p>Hola <strong>${safeName}</strong>,</p>
      <p>Confirmamos que tu cuenta fue eliminada exitosamente el <strong>${now}</strong>.</p>
      <p>Tus datos personales fueron eliminados de acuerdo con la Ley 25.326 y el GDPR.</p>
      <p style="font-size:13px;color:#666">¿Fue un error? Podés crear una nueva cuenta en <a href="${APP_BASE_URL}">${APP_BASE_URL}</a></p>
    `));
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAMILIA / NOTIFICACIONES
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendFamilyCodeEmail(email: string, familyName: string, familyCode: string): Promise<void> {
  const safeFamilyName = sanitizeHtmlInput(familyName);
  const safeCode = sanitizeHtmlInput(familyCode);
  await send(email, `Código de invitación — ${safeFamilyName}`,
    baseHtml(`Invitación a ${safeFamilyName}`, `
      <p>Compartí este código para que otros se unan a <strong>${safeFamilyName}</strong>:</p>
      <div class="code-box">
        <div class="code" style="font-size:36px">${safeCode}</div>
      </div>
      <p style="font-size:13px;color:#666">Solo deben abrir la app, tocar "Unirme a una familia" e ingresar este código.</p>
    `));
}

/** Alias para compatibilidad con appVersion.ts (firma distinta) */
export async function sendFamilyCode(email: string, familyName: string, familyCode: string): Promise<void> {
  await sendFamilyCodeEmail(email, familyName, familyCode);
}

export async function sendFamilyInvitationEmail(opts: {
  email: string; familyName: string; familyCode: string; inviterName?: string;
}): Promise<void> {
  const safeFamilyName = sanitizeHtmlInput(opts.familyName);
  const safeCode = sanitizeHtmlInput(opts.familyCode);
  const safeInviter = sanitizeHtmlInput(opts.inviterName || 'Un miembro');
  const deepLink = `${APP_SCHEME}://join?code=${safeCode}`;
  const joinUrl = mobileFirstUrl(`${APP_BASE_URL}/join?code=${safeCode}`);
  await send(opts.email, `${safeInviter} te invitó a "${safeFamilyName}" en Dommuss Agenda`,
    baseHtml(`👨‍👩‍👧 ¡Te invitaron a unirte!`, `
      <p><strong>${safeInviter}</strong> te invita a la familia <strong>${safeFamilyName}</strong> en Dommuss Agenda.</p>
      <div class="code-box">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600">Tu código de acceso:</p>
        <div class="code">${safeCode}</div>
      </div>
      <a href="${joinUrl}" class="btn btn-green">🚀 Unirme ahora</a>
      <p style="font-size:12px;color:#aaa;text-align:center">Deep link: <code>${deepLink}</code></p>
      <div class="warn">⚠️ Este código es personal. No lo compartas públicamente.</div>
    `));
}

export async function sendFamilyEventNotification(
  emails: string[],
  actorName: string,
  action: 'create' | 'update' | 'delete',
  eventTitle?: string,
  startDate?: Date
): Promise<void> {
  const safeActor = sanitizeHtmlInput(actorName);
  const safeTitle = eventTitle ? sanitizeHtmlInput(eventTitle) : 'un evento';
  const when = startDate ? startDate.toLocaleString('es-AR') : '';
  const actionLabel = action === 'create' ? 'Nuevo evento' : action === 'update' ? 'Evento actualizado' : 'Evento eliminado';
  const icon = action === 'create' ? '📅' : action === 'update' ? '✏️' : '🗑️';
  const subject = `${icon} ${actionLabel}: ${safeTitle} — Dommuss`;
  const html = baseHtml(`${icon} ${actionLabel}`, `
    <p><strong>${safeActor}</strong> ${action === 'create' ? 'creó' : action === 'update' ? 'modificó' : 'eliminó'} el evento <strong>"${safeTitle}"</strong>${when ? ` para el ${when}` : ''}.</p>
  `);
  await Promise.allSettled(emails.map((to) => send(to, subject, html)));
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

const PLAN_LABELS: Record<string, string> = {
  PREMIUM_MONTHLY: 'Premium Mensual',
  PREMIUM_YEARLY: 'Premium Anual',
  PREMIUM_LIFETIME: 'Premium Vitalicio',
  FREE: 'Gratuito',
};

export async function sendPaymentReceipt(email: string, planName: string, amount: string): Promise<void> {
  const safePlan = sanitizeHtmlInput(planName);
  await send(email, `✅ Recibo de pago — Plan ${safePlan} Dommuss Agenda`,
    baseHtml('¡Pago confirmado!', `
      <p>Se procesó exitosamente tu pago por el plan <strong>${safePlan}</strong>.</p>
      <p style="font-size:28px;color:#FF6B35;font-weight:bold;text-align:center">$${sanitizeHtmlInput(amount)}</p>
      <p>Ya podés disfrutar todas las funciones Premium.</p>
    `));
}

export async function sendPaymentReceiptEmail(opts: {
  email: string; name?: string; planType: string; amountArs: string;
  currency: string; externalPaymentId: string; currentPeriodEnd?: Date;
}): Promise<void> {
  const safeName = sanitizeHtmlInput(opts.name || opts.email.split('@')[0]);
  const planLabel = PLAN_LABELS[opts.planType] ?? opts.planType;
  const date = new Date().toLocaleDateString('es-AR');
  const expiresText = opts.currentPeriodEnd ? opts.currentPeriodEnd.toLocaleDateString('es-AR') : 'Vitalicio';
  await send(opts.email, `✅ Recibo de pago — Plan ${planLabel} Dommuss Agenda`,
    baseHtml('✅ ¡Pago confirmado!', `
      <p>Hola <strong>${safeName}</strong>, tu suscripción fue activada exitosamente.</p>
      <div class="receipt">
        <div class="info-row"><span>Fecha</span><span>${date}</span></div>
        <div class="info-row"><span>Plan</span><span>${planLabel}</span></div>
        <div class="info-row"><span>N° Transacción</span><span>${sanitizeHtmlInput(opts.externalPaymentId)}</span></div>
        <div class="info-row"><span>Válido hasta</span><span>${expiresText}</span></div>
        <div class="info-row"><span>Total cobrado</span><span>${opts.currency} ${opts.amountArs}</span></div>
      </div>
    `));
}

export async function sendExpiryWarningEmail(opts: {
  email: string; name?: string; planType: string; currentPeriodEnd: Date; daysLeft: number;
}): Promise<void> {
  const safeName = sanitizeHtmlInput(opts.name || opts.email.split('@')[0]);
  const planLabel = PLAN_LABELS[opts.planType] ?? opts.planType;
  const expiresText = opts.currentPeriodEnd.toLocaleDateString('es-AR');
  const renewUrl = mobileFirstUrl(`${APP_BASE_URL}/subscription`);
  await send(opts.email, `⏰ Tu plan Dommuss expira en ${opts.daysLeft} días`,
    baseHtml('⏰ Tu plan expira pronto', `
      <p>Hola <strong>${safeName}</strong>,</p>
      <p>Tu suscripción <strong>${planLabel}</strong> expira el <strong>${expiresText}</strong>.</p>
      <div style="background:#fff7f4;border:2px solid #FF6B35;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
        <div style="font-size:52px;font-weight:900;color:#FF6B35;line-height:1">${opts.daysLeft}</div>
        <div style="font-size:16px;color:#FF6B35;font-weight:600">días restantes</div>
      </div>
      <a href="${renewUrl}" class="btn">Renovar ahora</a>
    `));
}

export async function sendPaymentFailedEmail(opts: {
  email: string; name?: string; planType: string; reason?: string;
}): Promise<void> {
  const safeName = sanitizeHtmlInput(opts.name || opts.email.split('@')[0]);
  const planLabel = PLAN_LABELS[opts.planType] ?? opts.planType;
  const retryUrl = mobileFirstUrl(`${APP_BASE_URL}/subscription`);
  await send(opts.email, `❌ Pago rechazado — Plan ${planLabel} Dommuss Agenda`,
    baseHtml('❌ Pago rechazado', `
      <p>Hola <strong>${safeName}</strong>,</p>
      <p>No pudimos procesar el pago de tu plan <strong>${planLabel}</strong>.</p>
      ${opts.reason ? `<div class="alert">Motivo: ${sanitizeHtmlInput(opts.reason)}</div>` : ''}
      <a href="${retryUrl}" class="btn btn-red">Reintentar pago</a>
    `));
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESUMEN SEMANAL
// ═══════════════════════════════════════════════════════════════════════════════

export interface WeeklyEvent { title: string; startDate: Date; assignedTo?: string; }

export async function sendWeeklySummaryEmail(opts: {
  email: string; name?: string; events: WeeklyEvent[]; weekStart: Date; weekEnd: Date;
}): Promise<void> {
  const safeName = sanitizeHtmlInput(opts.name || opts.email.split('@')[0]);
  const weekLabel = `${opts.weekStart.toLocaleDateString('es-AR')} – ${opts.weekEnd.toLocaleDateString('es-AR')}`;
  const eventRows = opts.events.map((e) => {
    const date = e.startDate.toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<tr><td>${sanitizeHtmlInput(e.title)}</td><td style="color:#666;white-space:nowrap">${date}${e.assignedTo ? ' · ' + sanitizeHtmlInput(e.assignedTo) : ''}</td></tr>`;
  }).join('');

  await send(opts.email, `📅 Tu agenda del ${weekLabel} — Dommuss`,
    baseHtml('📅 Tu semana en Dommuss', `
      <p>Hola <strong>${safeName}</strong>, aquí está el resumen de la semana <strong>${weekLabel}</strong>:</p>
      ${opts.events.length > 0
        ? `<table><thead><tr><th>Evento</th><th>Fecha y hora</th></tr></thead><tbody>${eventRows}</tbody></table>`
        : '<div class="empty">🎉 ¡No tenés eventos esta semana!</div>'}
      <a href="${mobileFirstUrl(APP_BASE_URL)}" class="btn">Ver agenda completa</a>
    `));
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTP — Generación, Verificación e Invalidación
// ═══════════════════════════════════════════════════════════════════════════════

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
  userId: string, email: string
): Promise<VerificationCodeResult> {
  try {
    const code = generate6DigitCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MIN * 60 * 1000);

    await db.update(emailVerifications)
      .set({ verified: true, verifiedAt: new Date() })
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.verified, false)));

    await db.insert(emailVerifications).values({
      id: uuidv4(), userId, code: codeHash, expiresAt, verified: false,
    });

    await sendVerificationCodeEmail(email, code, CODE_EXPIRY_MIN);
    return { success: true, code: process.env.NODE_ENV !== 'production' ? code : undefined, message: 'Código enviado' };
  } catch (err) {
    console.error('[EmailService] sendVerificationCode error:', err);
    return { success: false, message: 'Error al enviar código' };
  }
}

export async function verifyCode(
  userId: string, code: string
): Promise<{ success: boolean; message: string; email?: string }> {
  try {
    const rows = await db.select({
      id: emailVerifications.id,
      code: emailVerifications.code,
      expiresAt: emailVerifications.expiresAt,
    })
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.verified, false)))
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1);

    if (!rows.length) return { success: false, message: 'No hay código pendiente. Solicitá uno nuevo.' };

    const row = rows[0];
    if (row.expiresAt < new Date()) return { success: false, message: 'El código expiró. Solicitá uno nuevo.' };

    const valid = await bcrypt.compare(code, row.code);
    if (!valid) return { success: false, message: 'Código incorrecto.' };

    await db.update(emailVerifications)
      .set({ verified: true, verifiedAt: new Date() })
      .where(eq(emailVerifications.id, row.id));

    await db.update(users)
      .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));

    const user = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
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

// ─── Test del sistema de correos ──────────────────────────────────────────────
export async function sendTestEmail(email: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: getSender(),
      to: email,
      subject: 'Prueba exitosa del Servidor — Dommuss Agenda',
      html: baseHtml('¡Conexión Exitosa!', `
        <p style="font-size:16px">Este es un correo de prueba enviado desde el servidor SMTP de Gmail de la Agenda.</p>
        <div style="background:#e8f5e9;padding:15px;border-radius:8px;margin:20px 0">
          <h3 style="color:#4CAF50;margin:0">Ya no hay rastros de Resend en el sistema.</h3>
        </div>
        <p>Todo está configurado y funcionando perfectamente.</p>
      `),
    });
  } catch (error) {
    console.error('[EmailService] sendTestEmail error:', error);
    throw error;
  }
}
