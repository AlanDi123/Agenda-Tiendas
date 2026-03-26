// Authentication Service
// Unified with backend JWT — all auth goes through the API
// Local IndexedDB is only used for environment/profile storage (offline-first calendar data)

import type { User } from '../types/auth';
import { apiFetch } from '../config/api';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  console.info('[AuthService] API base:', import.meta.env.VITE_API_URL || '(default producción)');
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
  try {
    const response = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      json: { email: email.toLowerCase(), password },
    });

    const errorData = !response.ok ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      const backendCode = errorData?.code;
      const backendMessage = errorData?.message;

      if (response.status === 409 || backendCode === 'EMAIL_EXISTS') {
        throw new Error('El email ya está registrado');
      }
      if (response.status === 400 && backendMessage) {
        throw new Error(backendMessage);
      }
      if (response.status >= 500) {
        throw new Error('Error del servidor. Intente más tarde.');
      }
      throw new Error(backendMessage || 'Error al registrarse');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Error al registrarse');
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
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Sin conexión. Verifique su internet.');
    }
    throw error;
  }
}

// ============================================
// LOGIN
// ============================================

export async function loginUser(email: string, password: string, rememberSession = true): Promise<User | null> {
  try {
    const response = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      json: { email: email.toLowerCase(), password },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Email o contraseña incorrectos');
      }
      if (response.status >= 500) {
        throw new Error('Error del servidor. Intente más tarde.');
      }
      throw new Error('Error al iniciar sesión');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Email o contraseña incorrectos');
    }

    // Save JWT tokens
    saveAuthToken(data.data.accessToken);
    if (data.data.refreshToken) {
      localStorage.setItem('refreshToken', data.data.refreshToken);
    }
    localStorage.setItem('rememberSession', rememberSession ? 'true' : 'false');

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
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Network error / offline
      throw new Error('Sin conexión. Verifique su internet.');
    }
    throw error;
  }
}

// ============================================
// CURRENT USER
// ============================================

const MAX_RETRIES = 1;
let retryCount = 0;

export async function getCurrentUser(): Promise<User | null> {
  const remember = localStorage.getItem('rememberSession');
  if (remember === 'false') return null;
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await apiFetch('/api/v1/auth/me', { auth: true });

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
        retryCount = 0;
        return user;
      }
    }

    if (response.status === 401 && retryCount < MAX_RETRIES) {
      retryCount++;
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        clearAuthToken();
        retryCount = 0;
        return null;
      }

      const newToken = getAuthToken();
      if (!newToken) {
        clearAuthToken();
        retryCount = 0;
        return null;
      }

      try {
        const retryRes = await apiFetch('/api/v1/auth/me', { auth: true });

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
            retryCount = 0;
            return user;
          }
        } else {
          retryCount = 0;
          clearAuthToken();
          return null;
        }
      } catch {
        retryCount = 0;
      }
    }

    if (response.status === 401) {
      clearAuthToken();
      retryCount = 0;
      return null;
    }
  } catch {
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
      await apiFetch('/api/v1/auth/logout', {
        method: 'POST',
        auth: true,
        json: { refreshToken },
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

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await apiFetch('/api/v1/auth/refresh', {
        method: 'POST',
        json: { refreshToken },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.accessToken) {
          saveAuthToken(data.data.accessToken);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ============================================
// EMAIL VERIFICATION
// ============================================

export async function verifyEmail(token: string): Promise<boolean> {
  try {
    const response = await apiFetch('/api/v1/auth/verify-email', {
      method: 'POST',
      json: { token },
    });

    if (!response.ok) {
      if (response.status >= 500) {
        throw new Error('Error del servidor. Intente más tarde.');
      }
      throw new Error('Token inválido o expirado');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Token inválido o expirado');
    }

    const cached = loadCurrentUser();
    if (cached) {
      cached.emailVerified = true;
      saveCurrentUser(cached);
    }

    return true;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Sin conexión. Verifique su internet.');
    }
    throw error;
  }
}

export async function resendVerificationEmail(email: string): Promise<boolean> {
  try {
    const response = await apiFetch('/api/v1/auth/resend-verification', {
      method: 'POST',
      json: { email: email.toLowerCase() },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      if (response.status >= 500) {
        throw new Error('Error del servidor. Intente más tarde.');
      }
      throw new Error(data?.message || 'Error al reenviar verificación');
    }

    return true;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Sin conexión. Verifique su internet.');
    }
    throw error;
  }
}

// ============================================
// PASSWORD RECOVERY
// ============================================

export async function requestPasswordReset(email: string): Promise<boolean> {
  try {
    await apiFetch('/api/v1/auth/password-reset/request', {
      method: 'POST',
      json: { email: email.toLowerCase() },
    });
  } catch {
    // Fail silently to not reveal if email exists
  }
  return true;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    const response = await apiFetch('/api/v1/auth/password-reset/confirm', {
      method: 'POST',
      json: { token, newPassword },
    });

    if (!response.ok) {
      if (response.status >= 500) {
        throw new Error('Error del servidor. Intente más tarde.');
      }
      throw new Error('Token inválido o expirado');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Token inválido o expirado');
    }

    return true;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Sin conexión. Verifique su internet.');
    }
    throw error;
  }
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
