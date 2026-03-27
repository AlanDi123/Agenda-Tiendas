/**
 * Billing Emails — recibos de pago, expiración de plan, cobro fallido
 */

import { enqueueEmail, sanitizeHtmlInput } from './emailQueue';

const APP_BASE_URL = (() => {
  const explicit = process.env.APP_BASE_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  const v = process.env.VERCEL_URL;
  if (v) return `https://${v.replace(/^https?:\/\//, '')}`;
  return 'https://agenda-tienda.vercel.app';
})();

const APP_SCHEME = process.env.APP_DEEP_LINK_SCHEME || 'dommussagenda';

function mobileFirstUrl(webUrl: string): string {
  const deep = `${APP_SCHEME}://open?target=${encodeURIComponent(webUrl)}`;
  return `${APP_BASE_URL}/open-app.html?deep=${encodeURIComponent(deep)}&web=${encodeURIComponent(webUrl)}`;
}

const YEAR = new Date().getFullYear();
const bodyFont = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:20px`;
const boxStyles = `max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08)`;
const ftr = `text-align:center;padding:16px;color:#999;font-size:12px;border-top:1px solid #f0f0f0`;

const PLAN_LABELS: Record<string, string> = {
  PREMIUM_MONTHLY: 'Premium Mensual',
  PREMIUM_YEARLY: 'Premium Anual',
  PREMIUM_LIFETIME: 'Premium Vitalicio',
  FREE: 'Gratuito',
};

export async function sendPaymentReceiptEmail(opts: {
  email: string;
  name?: string;
  planType: string;
  amountArs: string;
  currency: string;
  externalPaymentId: string;
  currentPeriodEnd?: Date;
}): Promise<void> {
  const safeName = sanitizeHtmlInput(opts.name || opts.email.split('@')[0]);
  const planLabel = PLAN_LABELS[opts.planType] ?? opts.planType;
  const date = new Date().toLocaleDateString('es-AR');
  const expiresText = opts.currentPeriodEnd
    ? opts.currentPeriodEnd.toLocaleDateString('es-AR')
    : 'Vitalicio';

  const html = `<!DOCTYPE html><html><head><style>
    body{${bodyFont}}
    .box{${boxStyles}}
    .hdr{background:#2e7d32;padding:28px 24px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:22px}
    .body{padding:28px 24px}
    .receipt{background:#f9fbe7;border:1px solid #c5e1a5;border-radius:10px;padding:20px;margin:16px 0}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8f5e9;font-size:14px}
    .row:last-child{border-bottom:none;font-weight:700;font-size:16px}
    .badge{display:inline-block;background:#2e7d32;color:#fff;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin:8px 0}
    .ftr{${ftr}}
  </style></head><body>
    <div class="box">
      <div class="hdr"><h1>✅ ¡Pago confirmado!</h1></div>
      <div class="body">
        <p>Hola <strong>${safeName}</strong>, tu suscripción fue activada exitosamente.</p>
        <span class="badge">Plan ${planLabel}</span>
        <div class="receipt">
          <div class="row"><span>Fecha</span><span>${date}</span></div>
          <div class="row"><span>Plan</span><span>${planLabel}</span></div>
          <div class="row"><span>N° de Transacción</span><span>${sanitizeHtmlInput(opts.externalPaymentId)}</span></div>
          <div class="row"><span>Válido hasta</span><span>${expiresText}</span></div>
          <div class="row"><span>Total cobrado</span><span>${opts.currency} ${opts.amountArs}</span></div>
        </div>
        <p style="font-size:13px;color:#666">Guardá este correo como comprobante de pago. Podés ver el estado de tu suscripción en la app.</p>
      </div>
      <div class="ftr">© ${YEAR} Dommuss Agenda</div>
    </div>
  </body></html>`;

  await enqueueEmail({
    to: opts.email,
    subject: `✅ Recibo de pago — Plan ${planLabel} Dommuss Agenda`,
    html,
    text: `¡Pago confirmado! Plan: ${planLabel}\nFecha: ${date}\nTransacción: ${opts.externalPaymentId}\nImporte: ${opts.currency} ${opts.amountArs}\nVálido hasta: ${expiresText}`,
  });
}

export async function sendExpiryWarningEmail(opts: {
  email: string;
  name?: string;
  planType: string;
  currentPeriodEnd: Date;
  daysLeft: number;
}): Promise<void> {
  const safeName = sanitizeHtmlInput(opts.name || opts.email.split('@')[0]);
  const planLabel = PLAN_LABELS[opts.planType] ?? opts.planType;
  const expiresText = opts.currentPeriodEnd.toLocaleDateString('es-AR');
  const renewUrl = mobileFirstUrl(`${APP_BASE_URL}/subscription`);

  const html = `<!DOCTYPE html><html><head><style>
    body{${bodyFont}}
    .box{${boxStyles}}
    .hdr{background:#e65100;padding:28px 24px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:22px}
    .body{padding:28px 24px}
    .countdown{background:#fff3e0;border:2px solid #ff9800;border-radius:12px;padding:20px;text-align:center;margin:16px 0}
    .days{font-size:52px;font-weight:900;color:#e65100;line-height:1}
    .btn{display:block;background:#e65100;color:#fff;text-align:center;padding:16px;border-radius:10px;font-weight:700;font-size:16px;text-decoration:none;margin:20px 0}
    .ftr{${ftr}}
  </style></head><body>
    <div class="box">
      <div class="hdr"><h1>⏰ Tu plan expira pronto</h1></div>
      <div class="body">
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>Tu suscripción <strong>${planLabel}</strong> de Dommuss Agenda expira el <strong>${expiresText}</strong>.</p>
        <div class="countdown">
          <div class="days">${opts.daysLeft}</div>
          <div style="font-size:16px;color:#e65100;font-weight:600">días restantes</div>
        </div>
        <p>Renovando ahora mantenés acceso ininterrumpido a todos los eventos de tu familia.</p>
        <a href="${renewUrl}" class="btn">Renovar ahora</a>
        <p style="font-size:13px;color:#888">Si no renovás, pasarás automáticamente al plan gratuito sin perder tus datos.</p>
      </div>
      <div class="ftr">© ${YEAR} Dommuss Agenda</div>
    </div>
  </body></html>`;

  await enqueueEmail({
    to: opts.email,
    subject: `⏰ Tu plan Dommuss expira en ${opts.daysLeft} días`,
    html,
    text: `Hola ${safeName},\n\nTu plan ${planLabel} expira el ${expiresText} (en ${opts.daysLeft} días).\n\nRenovar: ${renewUrl}`,
  });
}

export async function sendPaymentFailedEmail(opts: {
  email: string;
  name?: string;
  planType: string;
  reason?: string;
}): Promise<void> {
  const safeName = sanitizeHtmlInput(opts.name || opts.email.split('@')[0]);
  const planLabel = PLAN_LABELS[opts.planType] ?? opts.planType;
  const retryUrl = mobileFirstUrl(`${APP_BASE_URL}/subscription`);

  const html = `<!DOCTYPE html><html><head><style>
    body{${bodyFont}}
    .box{${boxStyles}}
    .hdr{background:#b71c1c;padding:24px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:20px}
    .body{padding:24px}
    .alert{background:#ffebee;border-left:4px solid #b71c1c;padding:12px 16px;border-radius:0 8px 8px 0;font-size:14px;margin:16px 0}
    .btn{display:block;background:#b71c1c;color:#fff;text-align:center;padding:14px;border-radius:8px;font-weight:700;text-decoration:none;margin:20px 0}
    .ftr{${ftr}}
  </style></head><body>
    <div class="box">
      <div class="hdr"><h1>❌ Pago rechazado</h1></div>
      <div class="body">
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>No pudimos procesar el pago de tu plan <strong>${planLabel}</strong>.</p>
        ${opts.reason ? `<div class="alert">Motivo: ${sanitizeHtmlInput(opts.reason)}</div>` : ''}
        <p>Podés reintentar el pago desde la app con otro método.</p>
        <a href="${retryUrl}" class="btn">Reintentar pago</a>
      </div>
      <div class="ftr">© ${YEAR} Dommuss Agenda</div>
    </div>
  </body></html>`;

  await enqueueEmail({
    to: opts.email,
    subject: `❌ Pago rechazado — Plan ${planLabel} Dommuss Agenda`,
    html,
    text: `Hola ${safeName},\n\nNo pudimos procesar tu pago del plan ${planLabel}.\n${opts.reason ? `Motivo: ${opts.reason}\n` : ''}\nReintentar: ${retryUrl}`,
  });
}
