import { Capacitor } from '@capacitor/core';

/**
 * URL pública del despliegue unificado (Vercel).
 * Capacitor/WebView debe usar esta base absoluta para llamar a /api/v1/...
 */
const PRODUCTION_APP_URL = 'https://agenda-tienda.vercel.app';

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
  /** Serializa a JSON y fija Content-Type */
  json?: unknown;
  /** Añade Authorization: Bearer desde localStorage */
  auth?: boolean;
};

const refreshAccessToken = async (): Promise<string | null> => {
  const base = getApiBaseUrl();
  if (typeof localStorage === 'undefined') return null;
  const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
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
    const remember = localStorage.getItem('rememberSession') !== 'false';
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('authToken', newToken);
    (remember ? sessionStorage : localStorage).removeItem('authToken');
    return newToken;
  } catch {
    return null;
  }
};

/**
 * fetch al API con:
 * - URL base resuelta (Capacitor / web)
 * - Token refresh automático en 401
 * - AbortController heredado del caller (cancelación de requests)
 * - Retry interceptor: si la red está caída, espera y reintenta 1 vez
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { json, auth, headers: initHeaders, signal, ...rest } = options;
  const base = getApiBaseUrl();
  const pathPart = path.startsWith('/') ? path : `/${path}`;
  const url = path.startsWith('http') ? path : `${base}${pathPart}`;

  const headers = new Headers(initHeaders as HeadersInit);
  if (json !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    let token = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('authToken') || sessionStorage.getItem('authToken'))
      : null;
    if (!token) token = await refreshAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const body = json !== undefined ? JSON.stringify(json) : rest.body;

  const doRequest = () => fetch(url, { ...rest, headers, body, signal });

  let response: Response;
  try {
    response = await doRequest();
  } catch (err) {
    // Retry interceptor: si la red falla (TypeError), esperar 1s y reintentar
    if ((err as Error)?.name !== 'AbortError') {
      await new Promise((r) => setTimeout(r, 1000));
      response = await doRequest();
    } else {
      throw err;
    }
  }

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
