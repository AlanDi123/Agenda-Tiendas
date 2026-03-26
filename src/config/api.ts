import { Capacitor } from '@capacitor/core';

/**
 * URL pública del despliegue unificado (Vercel: un solo proyecto web + API en /api).
 * Capacitor/WebView debe usar esta base absoluta para llamar a /api/v1/...
 */
const PRODUCTION_APP_URL = 'https://agenda-tienda.vercel.app';

/**
 * Base URL del backend API.
 * - Web/PWA: vacío → fetch a `/api/...` mismo origen (Vercel rewrites + proxy Vite en dev).
 * - Capacitor: `VITE_API_URL` o PRODUCTION_APP_URL.
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '');

  if (Capacitor.isNativePlatform()) {
    if (envUrl) return envUrl;
    return PRODUCTION_APP_URL;
  }

  if (import.meta.env.VITE_API_DIRECT === 'true' && envUrl) {
    return envUrl;
  }

  return '';
}

export type ApiFetchOptions = RequestInit & {
  /** Serializa a JSON y fija Content-Type si no viene definido */
  json?: unknown;
  /** Añade Authorization: Bearer desde localStorage */
  auth?: boolean;
};

/**
 * fetch al API con URL base resuelta y opciones comunes.
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { json, auth, headers: initHeaders, ...rest } = options;
  const base = getApiBaseUrl();
  const pathPart = path.startsWith('/') ? path : `/${path}`;
  const url = path.startsWith('http') ? path : `${base}${pathPart}`;

  const headers = new Headers(initHeaders);
  if (json !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const refreshAccessToken = async (): Promise<string | null> => {
    if (typeof localStorage === 'undefined') return null;
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;
    try {
      const refreshRes = await fetch(`${base}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!refreshRes.ok) return null;
      const payload = await refreshRes.json().catch(() => null);
      const newToken = payload?.data?.accessToken;
      if (!newToken) return null;
      localStorage.setItem('authToken', newToken);
      return newToken;
    } catch {
      return null;
    }
  };

  if (auth) {
    let token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) {
      token = await refreshAccessToken();
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const body = json !== undefined ? JSON.stringify(json) : rest.body;

  const doRequest = () =>
    fetch(url, {
      ...rest,
      headers,
      body,
    });

  let response = await doRequest();

  // Reintento 1 vez si expira token
  if (auth && response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await doRequest();
    }
  }

  return response;
}
