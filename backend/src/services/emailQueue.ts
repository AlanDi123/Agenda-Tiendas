/**
 * Email Queue — Cola asíncrona con CircuitBreaker + Exponential Backoff
 * Transporte: Nodemailer vía Gmail SMTP (OAuth App Password)
 *
 * Arquitectura:
 * 1. `enqueueEmail` escribe en `email_outbox` (Postgres) y dispara un intento
 *    asíncrono sin bloquear la request HTTP.
 * 2. `processOutbox` (llamado por cron) reintenta los correos fallidos.
 * 3. CircuitBreaker: si Gmail falla 10 veces seguidas → OPEN → detiene envíos
 *    y loguea alerta.
 */

import nodemailer from 'nodemailer';
import { eq, and, lte, lt } from 'drizzle-orm';
import db from '../db';
import { emailOutbox, users } from '../db/schema';
import { logger } from '../middleware/requestLogger';

// ─── Configuración SMTP (Gmail) ───────────────────────────────────────────
const GMAIL_USER     = process.env.GMAIL_USER     || '';
const GMAIL_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const FROM_ADDRESS   = GMAIL_USER
  ? `"Dommuss Agenda" <${GMAIL_USER}>`
  : '"Dommuss Agenda" <noreply@dommuss.com>';

if (!GMAIL_USER || !GMAIL_PASSWORD) {
  console.warn(
    '[EmailQueue] ⚠️  GMAIL_USER o GMAIL_APP_PASSWORD no configurados. Los mails NO se enviarán.'
  );
}

/** Crea un transporter reutilizable (pooled) para Gmail SMTP */
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASSWORD,
    },
    pool: true,
    maxConnections: 5,
    rateDelta: 1000,
    rateLimit: 5,
  });
}

// Singleton del transporter
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) _transporter = createTransporter();
  return _transporter;
}

// ─── Sanitización de HTML ──────────────────────────────────────────────────
export function sanitizeHtmlInput(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ─── Circuit Breaker (in-process singleton) ────────────────────────────────
const FAILURE_THRESHOLD = 10;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

interface CircuitBreakerState {
  failures: number;
  openedAt: number | null;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const circuit: CircuitBreakerState = {
  failures: 0,
  openedAt: null,
  state: 'CLOSED',
};

function circuitIsOpen(): boolean {
  if (circuit.state === 'CLOSED') return false;
  if (circuit.state === 'OPEN') {
    const cooldownPassed = Date.now() - (circuit.openedAt ?? 0) > COOLDOWN_MS;
    if (cooldownPassed) {
      circuit.state = 'HALF_OPEN';
      logger.warn('[EmailQueue] CircuitBreaker → HALF_OPEN: probando reconexión con Gmail');
      return false;
    }
    return true;
  }
  return false; // HALF_OPEN permite un intento
}

function recordSuccess() {
  if (circuit.state !== 'CLOSED') {
    logger.info('[EmailQueue] CircuitBreaker → CLOSED: Gmail responde correctamente');
  }
  circuit.failures = 0;
  circuit.state = 'CLOSED';
  circuit.openedAt = null;
}

function recordFailure() {
  circuit.failures += 1;
  if (circuit.failures >= FAILURE_THRESHOLD && circuit.state !== 'OPEN') {
    circuit.state = 'OPEN';
    circuit.openedAt = Date.now();
    logger.error(
      `[EmailQueue] ⚠️  CircuitBreaker OPEN — Gmail falló ${circuit.failures} veces consecutivas. ` +
      `Reintentando en ${COOLDOWN_MS / 60000} min.`
    );
    // Resetear el transporter para forzar reconexión
    _transporter = null;
  }
}

/** Verifica conectividad SMTP sin enviar — útil para el health check */
export async function verifySmtpConnection(): Promise<boolean> {
  if (!GMAIL_USER || !GMAIL_PASSWORD) return false;
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
}

// ─── Backoff helper ────────────────────────────────────────────────────────
function nextRetryAt(attempts: number): Date {
  const delayMs = Math.min(1000 * 2 ** attempts, 30 * 60 * 1000); // máx 30 min
  return new Date(Date.now() + delayMs);
}

// ─── Core send (con circuit breaker) ──────────────────────────────────────
async function sendViaGmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<string> {
  if (!GMAIL_USER || !GMAIL_PASSWORD) {
    throw new Error('GMAIL_USER o GMAIL_APP_PASSWORD no configurados');
  }
  if (circuitIsOpen()) {
    throw new Error('CircuitBreaker OPEN — envío suspendido temporalmente');
  }

  try {
    const info = await getTransporter().sendMail({
      from: FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    recordSuccess();
    return info.messageId ?? '';
  } catch (err) {
    recordFailure();

    // Detectar rebote permanente (ej. 550 = usuario no existe) y marcar en DB
    const errMsg = err instanceof Error ? err.message : String(err);
    const isPermanentBounce =
      /550|551|552|553|554|user.*not.*exist|no.*such.*user|mailbox.*unavailable/i.test(errMsg);
    if (isPermanentBounce) {
      void db.update(users)
        .set({ emailStatus: 'bounced', updatedAt: new Date() })
        .where(eq(users.email, opts.to))
        .catch(() => {});
      logger.warn({ to: opts.to, errMsg }, '[EmailQueue] Bounce permanente detectado');
    }

    throw err;
  }
}

// ─── Encolar correo ────────────────────────────────────────────────────────
export async function enqueueEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const [row] = await db.insert(emailOutbox).values({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  }).returning({ id: emailOutbox.id });

  // Disparar intento asíncrono sin bloquear la request HTTP
  setImmediate(() => {
    void attemptSend(row.id);
  });
}

async function attemptSend(id: string): Promise<void> {
  const rows = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id)).limit(1);
  if (!rows.length) return;

  const email = rows[0];
  if (email.status === 'sent' || email.status === 'dead') return;

  await db.update(emailOutbox)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(emailOutbox.id, id));

  try {
    const messageId = await sendViaGmail({
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    await db.update(emailOutbox).set({
      status: 'sent',
      sentAt: new Date(),
      resendMessageId: messageId,
      updatedAt: new Date(),
    }).where(eq(emailOutbox.id, id));

    logger.info({ emailId: id, to: email.to }, '[EmailQueue] ✉️ Enviado vía Gmail');
  } catch (err) {
    const newAttempts = (email.attempts ?? 0) + 1;
    const isDead = newAttempts >= (email.maxAttempts ?? 5);

    await db.update(emailOutbox).set({
      status: isDead ? 'dead' : 'failed',
      attempts: newAttempts,
      nextRetryAt: isDead ? new Date() : nextRetryAt(newAttempts),
      lastError: err instanceof Error ? err.message : String(err),
      updatedAt: new Date(),
    }).where(eq(emailOutbox.id, id));

    logger.error({ emailId: id, attempts: newAttempts, err }, '[EmailQueue] Fallo de envío');
  }
}

// ─── Procesador de cron ────────────────────────────────────────────────────
export async function processOutbox(
  batchSize = 50
): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date();

  type OutboxRow = typeof pending[0];
  const pending = await db.select()
    .from(emailOutbox)
    .where(
      and(
        lte(emailOutbox.nextRetryAt, now),
        lt(emailOutbox.attempts, emailOutbox.maxAttempts),
        eq(emailOutbox.status, 'failed')
      )
    )
    .limit(batchSize);

  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    pending.map(async (email: OutboxRow) => {
      try {
        const messageId = await sendViaGmail({
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
        await db.update(emailOutbox).set({
          status: 'sent',
          sentAt: new Date(),
          resendMessageId: messageId,
          attempts: (email.attempts ?? 0) + 1,
          updatedAt: new Date(),
        }).where(eq(emailOutbox.id, email.id));
        sent++;
      } catch (err) {
        const newAttempts = (email.attempts ?? 0) + 1;
        const isDead = newAttempts >= (email.maxAttempts ?? 5);
        await db.update(emailOutbox).set({
          status: isDead ? 'dead' : 'failed',
          attempts: newAttempts,
          nextRetryAt: isDead ? new Date() : nextRetryAt(newAttempts),
          lastError: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        }).where(eq(emailOutbox.id, email.id));
        failed++;
      }
    })
  );

  return { processed: pending.length, sent, failed };
}
