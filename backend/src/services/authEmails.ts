/**
 * Auth Emails — verificación, contraseña, bienvenida, nuevo login, eliminación de cuenta
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
const headerStyles = `background:#1565C0;padding:28px 24px;text-align:center`;
const boxStyles = `max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08)`;
const bodyFont = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:20px`;
const btnBlue = `display:block;background:#1565C0;color:#fff;text-align:center;padding:16px 24px;border-radius:10px;font-weight:700;font-size:16px;text-decoration:none;margin:24px 0`;
const warnBox = `background:#fff3cd;border-left:4px solid #FFC107;padding:12px 16px;border-radius:0 8px 8px 0;font-size:13px;margin:16px 0`;
const ftr = `text-align:center;padding:16px;color:#999;font-size:12px;border-top:1px solid #f0f0f0`;

export async function sendVerificationCodeEmail(
  email: string,
  code: string,
  expiryMin: number
): Promise<void> {
  const safeName = sanitizeHtmlInput(email);
  const html = `<!DOCTYPE html><html><head><style>
    body{${bodyFont}}
    .box{${boxStyles}}
    .hdr{${headerStyles}}
    .hdr h1{color:#fff;margin:0;font-size:22px}
    .hdr p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px}
    .body{padding:28px 24px}
    .code-box{background:#f8f9fa;border:2px dashed #1565C0;border-radius:10px;padding:20px;text-align:center;margin:20px 0}
    .code{font-size:42px;font-weight:800;color:#1565C0;letter-spacing:10px;font-family:monospace}
    .warn{${warnBox}}
    .ftr{${ftr}}
  </style></head><body>
    <div class="box">
      <div class="hdr"><h1>🏠 Dommuss Agenda</h1><p>Verificá tu dirección de email</p></div>
      <div class="body">
        <p>Hola <strong>${safeName}</strong>, usá el siguiente código para verificar tu cuenta:</p>
        <div class="code-box">
          <div class="code">${code}</div>
          <p style="margin:8px 0 0;color:#666;font-size:13px">Válido por ${expiryMin} minutos</p>
        </div>
        <div class="warn">⚠️ No compartas este código con nadie. Expira en ${expiryMin} minutos.</div>
      </div>
      <div class="ftr">© ${YEAR} Dommuss Agenda</div>
    </div>
  </body></html>`;

  await enqueueEmail({
    to: email,
    subject: `${code} — Código de verificación Dommuss`,
    html,
    text: `Tu código de verificación es: ${code}\n\nExpira en ${expiryMin} minutos. No lo compartas.`,
  });
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const resetUrl = `${APP_BASE_URL}/reset-password?token=${resetToken}`;
  const openUrl = mobileFirstUrl(resetUrl);

  const html = `<!DOCTYPE html><html><head><style>
    body{${bodyFont}}
    .box{${boxStyles}}
    .hdr{${headerStyles}}
    .hdr h1{color:#fff;margin:0;font-size:20px}
    .body{padding:24px}
    .btn{${btnBlue}}
    .warn{${warnBox}}
    .ftr{${ftr}}
  </style></head><body>
    <div class="box">
      <div class="hdr"><h1>🔑 Recuperar contraseña</h1></div>
      <div class="body">
        <p>Recibimos una solicitud para restablecer tu contraseña en Dommuss Agenda.</p>
        <a href="${openUrl}" class="btn">Restablecer contraseña</a>
        <div class="warn">⚠️ Este enlace expira en 1 hora. Si no solicitaste este cambio, ignorá este correo.</div>
      </div>
      <div class="ftr">© ${YEAR} Dommuss Agenda</div>
    </div>
  </body></html>`;

  await enqueueEmail({
    to: email,
    subject: 'Recuperar contraseña — Dommuss Agenda',
    html,
    text: `Restablecé tu contraseña: ${openUrl}\n\nExpira en 1 hora.`,
  });
}

export async function sendWelcomeEmail(email: string, name?: string): Promise<void> {
  const safeName = sanitizeHtmlInput(name || email.split('@')[0]);
  const loginUrl = mobileFirstUrl(`${APP_BASE_URL}/login`);

  const html = `<!DOCTYPE html><html><head><style>
    body{${bodyFont}}
    .box{${boxStyles}}
    .hdr{background:#1565C0;padding:36px 24px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:26px}
    .hdr p{color:rgba(255,255,255,.85);margin:8px 0 0;font-size:15px}
    .body{padding:32px 24px}
    .btn{${btnBlue}}
    .step{display:flex;align-items:flex-start;gap:12px;margin:16px 0;padding:16px;background:#f8f9fa;border-radius:10px}
    .step-icon{font-size:24px;min-width:32px}
    .step-text{font-size:14px;color:#444}
    .step-text strong{display:block;color:#1565C0;margin-bottom:4px}
    .ftr{${ftr}}
  </style></head><body>
    <div class="box">
      <div class="hdr">
        <h1>¡Bienvenido/a, ${safeName}! 🎉</h1>
        <p>Tu cuenta en Dommuss Agenda está lista</p>
      </div>
      <div class="body">
        <p>Nos alegra tenerte. Aquí te contamos cómo empezar en 3 pasos:</p>
        <div class="step">
          <span class="step-icon">📅</span>
          <div class="step-text"><strong>Creá tu primer evento</strong>Abrí la app, tocá el botón "+" y completá los datos del turno o actividad.</div>
        </div>
        <div class="step">
          <span class="step-icon">👨‍👩‍👧</span>
          <div class="step-text"><strong>Invitá a tu familia o equipo</strong>Generá un código de acceso en Configuración → Familia y compartilo por WhatsApp.</div>
        </div>
        <div class="step">
          <span class="step-icon">🔔</span>
          <div class="step-text"><strong>Activá las notificaciones</strong>Para que nadie se pierda ningún turno, activá los recordatorios cuando la app te lo pida.</div>
        </div>
        <a href="${loginUrl}" class="btn">Abrir Dommuss Agenda</a>
      </div>
      <div class="ftr">© ${YEAR} Dommuss Agenda · <a href="${APP_BASE_URL}" style="color:#999">Ver online</a></div>
    </div>
  </body></html>`;

  await enqueueEmail({
    to: email,
    subject: `¡Bienvenido/a a Dommuss Agenda, ${safeName}! 🎉`,
    html,
    text: `¡Hola ${safeName}!\n\nTu cuenta está lista. Empezá creando tu primer evento en la app.\n\nAbrir: ${loginUrl}`,
  });
}

export async function sendNewLoginAlert(
  email: string,
  ipAddress: string,
  userAgent?: string
): Promise<void> {
  const safeIp = sanitizeHtmlInput(ipAddress);
  const safeAgent = sanitizeHtmlInput(userAgent?.slice(0, 80) || 'desconocido');
  const now = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const html = `<!DOCTYPE html><html><head><style>
    body{${bodyFont}}
    .box{${boxStyles}}
    .hdr{background:#c62828;padding:24px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:20px}
    .body{padding:24px}
    .info-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
    .warn{${warnBox}}
    .btn{display:block;background:#c62828;color:#fff;text-align:center;padding:14px;border-radius:8px;font-weight:700;text-decoration:none;margin:20px 0}
    .ftr{${ftr}}
  </style></head><body>
    <div class="box">
      <div class="hdr"><h1>🚨 Nuevo inicio de sesión detectado</h1></div>
      <div class="body">
        <p>Se detectó un ingreso a tu cuenta desde una IP diferente.</p>
        <div class="info-row"><span>Fecha y hora</span><strong>${now} (Argentina)</strong></div>
        <div class="info-row"><span>Dirección IP</span><strong>${safeIp}</strong></div>
        <div class="info-row"><span>Dispositivo</span><strong>${safeAgent}</strong></div>
        <div class="warn">⚠️ Si no fuiste vos, cambiá tu contraseña de inmediato.</div>
        <a href="${mobileFirstUrl(`${APP_BASE_URL}/reset-password`)}" class="btn">Cambiar contraseña ahora</a>
      </div>
      <div class="ftr">© ${YEAR} Dommuss Agenda</div>
    </div>
  </body></html>`;

  await enqueueEmail({
    to: email,
    subject: '🚨 Nuevo inicio de sesión en tu cuenta — Dommuss Agenda',
    html,
    text: `Nuevo login detectado.\nFecha: ${now}\nIP: ${safeIp}\nDispositivo: ${safeAgent}\n\nSi no fuiste vos, cambiá tu contraseña: ${APP_BASE_URL}/reset-password`,
  });
}

export async function sendAccountDeletionConfirmation(email: string, name?: string): Promise<void> {
  const safeName = sanitizeHtmlInput(name || email.split('@')[0]);
  const now = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const html = `<!DOCTYPE html><html><head><style>
    body{${bodyFont}}
    .box{${boxStyles}}
    .hdr{background:#37474f;padding:28px 24px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:20px}
    .body{padding:28px 24px}
    .info{background:#f5f5f5;border-radius:8px;padding:16px;font-size:14px;margin:16px 0}
    .ftr{${ftr}}
  </style></head><body>
    <div class="box">
      <div class="hdr"><h1>Tu cuenta fue eliminada</h1></div>
      <div class="body">
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>Confirmamos que tu cuenta en Dommuss Agenda fue eliminada exitosamente.</p>
        <div class="info">
          <strong>Detalles de la eliminación:</strong><br/>
          Fecha: ${now}<br/>
          Email: ${sanitizeHtmlInput(email)}<br/><br/>
          Tus datos personales fueron eliminados de nuestros servidores de acuerdo con la Ley de Protección de Datos Personales (Ley 25.326) y el GDPR.
        </div>
        <p style="font-size:13px;color:#666">Si esto fue un error o querés crear una nueva cuenta, visitá <a href="${APP_BASE_URL}">${APP_BASE_URL}</a></p>
      </div>
      <div class="ftr">© ${YEAR} Dommuss Agenda · Este correo fue enviado como confirmación de eliminación requerida por ley.</div>
    </div>
  </body></html>`;

  await enqueueEmail({
    to: email,
    subject: 'Tu cuenta de Dommuss Agenda fue eliminada',
    html,
    text: `Hola ${safeName},\n\nConfirmamos que tu cuenta fue eliminada el ${now}.\nTus datos fueron eliminados conforme a la Ley 25.326/GDPR.`,
  });
}
