/**
 * Base URL del backend API (Vite / Capacitor).
 * Siempre termina sin barra final.
 */
const PRODUCTION_API = 'https://agenda-tiendas.vercel.app';

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  const trimmed = raw?.trim();
  if (trimmed) return trimmed.replace(/\/$/, '');
  return PRODUCTION_API;
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
  if (auth) {
    const token =
      typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const body = json !== undefined ? JSON.stringify(json) : rest.body;

  return fetch(url, {
    ...rest,
    headers,
    body,
  });
}
