// Authentication Service
// Unified with backend JWT — all auth goes through the API
// Local IndexedDB is only used for environment/profile storage (offline-first calendar data)

import type { User } from '../types/auth';

// API URL configuration - fallback para nativo/PWA
const API_URL = import.meta.env.VITE_API_URL || 'https://agenda-tiendas.vercel.app';

if (!API_URL) {
  console.error('[AuthService] VITE_API_URL no está configurada. Usando URL por defecto.');
}

// Lock global para evitar múltiples llamadas simultáneas de refresh
let refreshPromise: Promise<boolean> | null = null;

// ============================================
// TOKEN MANAGEMENT
// ============================================

export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

function saveAuthToken(token: string): void {
  localStorage.setItem('authToken', token);
}

function clearAuthToken(): void {
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('currentUser');
}

function saveCurrentUser(user: User): void {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function loadCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ============================================
// REGISTRATION
// ============================================

export async function createUser(
  email: string,
  password: string
): Promise<User & { verificationToken: string }> {
  const response = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase(), password }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const msg = data.message || data.error || 'Error al registrarse';
    if (response.status === 409) throw new Error('El email ya está registrado');
    throw new Error(msg);
  }

  const user: User = {
    id: data.data.user.id,
    email: data.data.user.email,
    passwordHash: '',
    emailVerified: data.data.user.emailVerified ?? false,
    planStatus: 'FREE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  saveCurrentUser(user);

  return {
    ...user,
    verificationToken: data.data.verificationToken || '',
  };
}

// ============================================
// LOGIN
// ============================================

export async function loginUser(email: string, password: string): Promise<User | null> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase(), password }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error('Email o contraseña incorrectos');
  }

  // Save JWT tokens
  saveAuthToken(data.data.accessToken);
  if (data.data.refreshToken) {
    localStorage.setItem('refreshToken', data.data.refreshToken);
  }

  const user: User = {
    id: data.data.user.id,
    email: data.data.user.email,
    passwordHash: '',
    emailVerified: data.data.user.emailVerified ?? false,
    planStatus: data.data.user.planType === 'FREE' ? 'FREE' : 'PREMIUM',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  saveCurrentUser(user);
  return user;
}

// ============================================
// CURRENT USER
// ============================================

export async function getCurrentUser(): Promise<User | null> {
  const token = getAuthToken();
  if (!token) return null;

  // Try to get fresh data from backend
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        const user: User = {
          id: data.data.id,
          email: data.data.email,
          passwordHash: '',
          emailVerified: data.data.emailVerified ?? false,
          planStatus: data.data.planType === 'FREE' ? 'FREE' : 'PREMIUM',
          createdAt: new Date(data.data.createdAt || Date.now()),
          updatedAt: new Date(data.data.updatedAt || Date.now()),
        };
        saveCurrentUser(user);
        return user;
      }
    }

    // Token expirado — intentar refresh UNA sola vez sin recursión
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        clearAuthToken();
        return null;
      }
      
      // Reintentar con el nuevo token directamente
      const newToken = getAuthToken();
      if (!newToken) {
        clearAuthToken();
        return null;
      }
      
      try {
        const retryRes = await fetch(`${API_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${newToken}` },
        });
        
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          if (retryData.success && retryData.data) {
            const user: User = {
              id: retryData.data.id,
              email: retryData.data.email,
              passwordHash: '',
              emailVerified: retryData.data.emailVerified ?? false,
              planStatus: retryData.data.planType === 'FREE' ? 'FREE' : 'PREMIUM',
              createdAt: new Date(retryData.data.createdAt || Date.now()),
              updatedAt: new Date(retryData.data.updatedAt || Date.now()),
            };
            saveCurrentUser(user);
            return user;
          }
        } else if (retryRes.status === 401) {
          // Token sigue siendo inválido
          clearAuthToken();
          return null;
        }
      } catch (error) {
        console.error('[AuthService] Error en retry:', error);
      }
      
      clearAuthToken();
      return null;
    }
  } catch {
    // Network offline — fall back to cached user
    return loadCurrentUser();
  }

  return loadCurrentUser();
}

// ============================================
// LOGOUT
// ============================================

export async function logoutUser(): Promise<void> {
  const token = getAuthToken();

  if (token) {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore network errors on logout
    }
  }

  clearAuthToken();
}

// ============================================
// TOKEN REFRESH
// ============================================

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  // Si ya hay una petición de refresh en curso, esperamos a que termine
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.accessToken) {
          saveAuthToken(data.data.accessToken);
          return true;
        }
      }
    } catch {
      // Error de red
    } finally {
      refreshPromise = null; // Liberamos el cerrojo
    }
    return false;
  })();

  return refreshPromise;
}

// ============================================
// EMAIL VERIFICATION
// ============================================

export async function verifyEmail(token: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/v1/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Token inválido o expirado');
  }

  // Update cached user
  const cached = loadCurrentUser();
  if (cached) {
    cached.emailVerified = true;
    saveCurrentUser(cached);
  }

  return true;
}

export async function resendVerificationEmail(email: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/v1/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase() }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Error al reenviar verificación');
  }

  return true;
}

// ============================================
// PASSWORD RECOVERY
// ============================================

export async function requestPasswordReset(email: string): Promise<boolean> {
  await fetch(`${API_URL}/api/v1/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase() }),
  });

  // Always return true (don't reveal if email exists)
  return true;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/v1/auth/password-reset/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Token inválido o expirado');
  }

  return true;
}

// ============================================
// PREMIUM (delegated to backend via payment)
// ============================================

export async function upgradeToPremium(_email: string, _untilDate?: Date): Promise<void> {
  // Premium status is managed by the backend via webhooks from Mercado Pago.
  // This function exists for compatibility but the real upgrade happens
  // automatically when the payment webhook is processed.
  const cached = loadCurrentUser();
  if (cached) {
    cached.planStatus = 'PREMIUM';
    saveCurrentUser(cached);
  }
}

export async function downgradeToFree(_email: string): Promise<void> {
  const cached = loadCurrentUser();
  if (cached) {
    cached.planStatus = 'FREE';
    saveCurrentUser(cached);
  }
}
