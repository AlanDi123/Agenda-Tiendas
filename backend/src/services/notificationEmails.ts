/**
 * Notification Emails — invitación familiar, eventos de agenda, resumen semanal
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

export async function sendFamilyInvitationEmail(opts: {
  email: string;
  familyName: string;
  familyCode: string;
  inviterName?: string;
}): Promise<void> {
  const safeFamilyName = sanitizeHtmlInput(opts.familyName);
  const safeCode = sanitizeHtmlInput(opts.familyCode);
  const safeInviter = sanitizeHtmlInput(opts.inviterName || 'Un miembro');

  const deepLink = `${APP_SCHEME}://join?code=${safeCode}`;
  const joinUrl = mobileFirstUrl(`${APP_BASE_URL}/join?code=${safeCode}`);

  const html = `<!DOCTYPE html><html><head><style>
    body{${bodyFont}}
    .box{${boxStyles}}
    .hdr{background:#1565C0;padding:32px 24px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:24px}
    .hdr p{color:rgba(255,255,255,.85);margin:8px 0 0;font-size:15px}
    .body{padding:28px 24px}
    .code-box{background:#e3f2fd;border:2px solid #1565C0;border-radius:12px;padding:20px;text-align:center;margin:20px 0}
    .code{font-size:36px;font-weight:900;color:#1565C0;letter-spacing:.5em;font-family:monospace}
    .btn{display:block;background:#FFC107;color:#333;text-align:center;padding:16px 24px;border-radius:12px;font-weight:800;font-size:17px;text-decoration:none;margin:24px 0;letter-spacing:.3px}
    .deeplink{background:#f5f5f5;border-radius:8px;padding:10px;font-family:monospace;font-size:12px;word-break:break-all;color:#555;text-align:center;margin:12px 0}
    .warn{background:#fff3cd;border-left:4px solid #FFC107;padding:12px 16px;border-radius:0 8px 8px 0;font-size:13px}
    .ftr{${ftr}}
  </style></head><body>
    <div class="box">
      <div class="hdr">
        <h1>👨‍👩‍👧 ¡Te invitaron a unirte!</h1>
        <p><strong>${safeInviter}</strong> te invita a la familia <strong>${safeFamilyName}</strong></p>
      </div>
      <div class="body">
        <p>Con Dommuss Agenda podés compartir eventos, turnos y listas con toda tu familia o equipo en tiempo real.</p>
        <div class="code-box">
          <p style="margin:0 0 8px;font-size:14px;color:#1565C0;font-weight:600">Tu código de acceso:</p>
          <div class="code">${safeCode}</div>
        </div>
        <a href="${joinUrl}" class="btn">🚀 Unirme ahora</a>
        <p style="font-size:13px;color:#666;text-align:center">O abrí la app y usá el código anterior en "Unirse a familia"</p>
        <p style="font-size:12px;color:#aaa;text-align:center">Deep link directo: <code>${deepLink}</code></p>
        <div class="warn">⚠️ Este código es personal. No lo compartas públicamente.</div>
      </div>
      <div class="ftr">© ${YEAR} Dommuss Agenda</div>
    </div>
  </body></html>`;

  await enqueueEmail({
    to: opts.email,
    subject: `${safeInviter} te invitó a "${safeFamilyName}" en Dommuss Agenda`,
    html,
    text: `${safeInviter} te invitó a unirte a "${safeFamilyName}" en Dommuss Agenda.\n\nCódigo de acceso: ${safeCode}\n\nUnirme ahora: ${joinUrl}`,
  });
}

export async function sendFamilyEventNotification(
  emails: string[],
  actorName: string,
  action: 'create' | 'update' | 'delete',
  eventTitle: string,
  startDate?: Date
): Promise<void> {
  const safeActor = sanitizeHtmlInput(actorName);
  const safeTitle = sanitizeHtmlInput(eventTitle);
  const when = startDate ? startDate.toLocaleString('es-AR') : '';
  const actionLabel = action === 'create' ? 'Nuevo evento' : action === 'update' ? 'Evento actualizado' : 'Evento eliminado';
  const icon = action === 'create' ? '📅' : action === 'update' ? '✏️' : '🗑️';
  const color = action === 'delete' ? '#c62828' : '#1565C0';
  const text = `${actionLabel}: "${safeTitle}"${when ? ` (${when})` : ''}\n— ${safeActor} (Dommuss Agenda)`;

  const html = `<!DOCTYPE html><html><head><style>
    body{${bodyFont}}
    .box{${boxStyles}}
    .hdr{background:${color};padding:20px 24px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:18px}
    .body{padding:24px}
    .ftr{${ftr}}
  </style></head><body>
    <div class="box">
      <div class="hdr"><h1>${icon} ${actionLabel}</h1></div>
      <div class="body">
        <p><strong>${safeActor}</strong> ${action === 'create' ? 'creó' : action === 'update' ? 'modificó' : 'eliminó'} el evento <strong>"${safeTitle}"</strong>${when ? ` para el ${when}` : ''}.</p>
      </div>
      <div class="ftr">© ${YEAR} Dommuss Agenda</div>
    </div>
  </body></html>`;

  await Promise.allSettled(
    emails.map((to) =>
      enqueueEmail({ to, subject: `${icon} ${actionLabel}: ${safeTitle} — Dommuss`, html, text })
    )
  );
}

export interface WeeklyEvent {
  title: string;
  startDate: Date;
  assignedTo?: string;
}

export async function sendWeeklySummaryEmail(opts: {
  email: string;
  name?: string;
  events: WeeklyEvent[];
  weekStart: Date;
  weekEnd: Date;
}): Promise<void> {
  const safeName = sanitizeHtmlInput(opts.name || opts.email.split('@')[0]);
  const weekLabel = `${opts.weekStart.toLocaleDateString('es-AR')} – ${opts.weekEnd.toLocaleDateString('es-AR')}`;

  const eventRows = opts.events
    .map((e) => {
      const safeTitle = sanitizeHtmlInput(e.title);
      const date = e.startDate.toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const assignee = e.assignedTo ? ` · ${sanitizeHtmlInput(e.assignedTo)}` : '';
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px">${safeTitle}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;white-space:nowrap">${date}${assignee}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html><html><head><style>
    body{${bodyFont}}
    .box{${boxStyles}}
    .hdr{background:#1565C0;padding:28px 24px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:22px}
    .hdr p{color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px}
    .body{padding:28px 24px}
    table{width:100%;border-collapse:collapse}
    th{background:#e3f2fd;color:#1565C0;padding:10px 12px;text-align:left;font-size:13px;font-weight:700}
    .empty{text-align:center;padding:32px;color:#aaa;font-size:14px}
    .btn{display:block;background:#1565C0;color:#fff;text-align:center;padding:14px;border-radius:8px;font-weight:700;text-decoration:none;margin:20px 0}
    .ftr{${ftr}}
  </style></head><body>
    <div class="box">
      <div class="hdr">
        <h1>📅 Tus eventos de la próxima semana</h1>
        <p>${weekLabel}</p>
      </div>
      <div class="body">
        <p>Hola <strong>${safeName}</strong>, aquí está el resumen de tu agenda para la semana:</p>
        ${opts.events.length > 0
    ? `<table><thead><tr><th>Evento</th><th>Fecha y hora</th></tr></thead><tbody>${eventRows}</tbody></table>`
    : '<div class="empty">🎉 ¡No tenés eventos esta semana!</div>'
  }
        <a href="${mobileFirstUrl(APP_BASE_URL)}" class="btn">Ver agenda completa</a>
      </div>
      <div class="ftr">© ${YEAR} Dommuss Agenda · Recibís este resumen cada domingo.</div>
    </div>
  </body></html>`;

  await enqueueEmail({
    to: opts.email,
    subject: `📅 Tu agenda del ${weekLabel} — Dommuss`,
    html,
    text: `Hola ${safeName},\n\nTus eventos de la semana ${weekLabel}:\n\n${opts.events.map((e) => `• ${e.title} — ${e.startDate.toLocaleString('es-AR')}`).join('\n') || 'Sin eventos esta semana.'}\n\nVer agenda: ${APP_BASE_URL}`,
  });
}
