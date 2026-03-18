// Authentication Service
// Handles user registration, login, email verification, and password recovery

import { getDB } from './database';
import type { User, AuthSession } from '../types/auth';
import { generateId } from '../utils/helpers';

const TOKEN_EXPIRY_HOURS = 24;
const SESSION_EXPIRY_DAYS = 30;

// Simple hash function for demo purposes (use bcrypt in production)
function hashPassword(password: string): string {
  // In production, use bcrypt or similar
  return btoa(unescape(encodeURIComponent(password + '_dommuss_salt')));
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// User operations
export async function createUser(email: string, password: string): Promise<User & { verificationToken: string }> {
  const db = await getDB();
  
  // Check if user already exists
  const existingUser = await db.get('users', email.toLowerCase());
  if (existingUser) {
    throw new Error('El email ya está registrado');
  }

  const verificationToken = generateToken();
  const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  const user: User & { verificationToken: string } = {
    id: generateId(),
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    emailVerified: false,
    verificationToken,
    tokenExpiresAt,
    planStatus: 'FREE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.put('users', user);
  
  // Store verification token separately
  await db.put('emailVerificationTokens', {
    email: email.toLowerCase(),
    token: verificationToken,
    expiresAt: tokenExpiresAt,
  });

  return user;
}

export async function loginUser(email: string, password: string): Promise<User | null> {
  const db = await getDB();
  const user = await db.get('users', email.toLowerCase());
  
  if (!user) {
    // Generic error message for security
    throw new Error('Email o contraseña incorrectos');
  }

  if (!verifyPassword(password, user.passwordHash)) {
    throw new Error('Email o contraseña incorrectos');
  }

  // Create session
  const session: AuthSession = {
    userId: user.id,
    email: user.email,
    expiresAt: new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  };
  
  await db.put('sessions', session);
  await saveSetting('currentUserEmail', user.email);

  // Return user without sensitive data
  const { passwordHash, ...userWithoutHash } = user;
  return userWithoutHash as unknown as User;
}

export async function getCurrentUser(): Promise<User | null> {
  const db = await getDB();
  const email = await getSetting<string>('currentUserEmail');
  
  if (!email) return null;
  
  const user = await db.get('users', email);
  if (!user) return null;

  const { passwordHash, ...userWithoutHash } = user;
  return userWithoutHash as unknown as User;
}

export async function logoutUser(): Promise<void> {
  await saveSetting('currentUserEmail', null);
  const db = await getDB();
  const sessions = await db.getAll('sessions');
  for (const session of sessions) {
    await db.delete('sessions', session.email);
  }
}

// Email verification
export async function verifyEmail(token: string): Promise<boolean> {
  const db = await getDB();
  const tokens = await db.getAll('emailVerificationTokens');
  const validToken = tokens.find(t => t.token === token && new Date(t.expiresAt) > new Date());

  if (!validToken) {
    throw new Error('Token inválido o expirado');
  }

  const user = await db.get('users', validToken.email);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  // Update user
  user.emailVerified = true;
  user.verificationToken = undefined;
  user.tokenExpiresAt = undefined;
  user.updatedAt = new Date();
  
  await db.put('users', user);
  await db.delete('emailVerificationTokens', validToken.email);

  return true;
}

export async function resendVerificationEmail(email: string): Promise<boolean> {
  // Primero intentar contra el backend real
  try {
    const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${API_URL}/api/v1/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase() }),
    });
    if (response.ok) {
      console.log('[AuthService] Verification email sent via backend');
      return true;
    }
    console.warn('[AuthService] Backend resend failed, status:', response.status);
  } catch (networkError) {
    console.warn('[AuthService] Backend unreachable, falling back to local token:', networkError);
  }

  // Fallback local (offline o backend no configurado)
  const db = await getDB();
  const user = await db.get('users', email.toLowerCase());

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (user.emailVerified) {
    throw new Error('El email ya está verificado');
  }

  const verificationToken = generateToken();
  const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  user.verificationToken = verificationToken;
  user.tokenExpiresAt = tokenExpiresAt;
  user.updatedAt = new Date();

  await db.put('users', user);
  await db.put('emailVerificationTokens', {
    email: email.toLowerCase(),
    token: verificationToken,
    expiresAt: tokenExpiresAt,
  });

  return true;
}

// Password recovery
export async function requestPasswordReset(email: string): Promise<boolean> {
  const db = await getDB();
  const user = await db.get('users', email.toLowerCase());

  if (!user) {
    // Don't reveal if email exists
    return true;
  }

  const resetToken = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.put('passwordResetTokens', {
    email: email.toLowerCase(),
    token: resetToken,
    expiresAt,
  });

  // In production, send email with reset link
  // For now, we'll store it and retrieve via console/dev tools
  console.log('Password reset token:', resetToken);

  return true;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const db = await getDB();
  const tokens = await db.getAll('passwordResetTokens');
  const validToken = tokens.find(t => t.token === token && new Date(t.expiresAt) > new Date());

  if (!validToken) {
    throw new Error('Token inválido o expirado');
  }

  const user = await db.get('users', validToken.email);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  // Validate password strength
  if (newPassword.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }

  user.passwordHash = hashPassword(newPassword);
  user.updatedAt = new Date();

  await db.put('users', user);
  await db.delete('passwordResetTokens', validToken.email);

  return true;
}

// Premium upgrade
export async function upgradeToPremium(email: string, untilDate?: Date): Promise<void> {
  const db = await getDB();
  const user = await db.get('users', email.toLowerCase());

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  user.planStatus = 'PREMIUM';
  user.premiumUntil = untilDate;
  user.updatedAt = new Date();

  await db.put('users', user);
  await saveSetting('currentUserEmail', email.toLowerCase());
}

export async function downgradeToFree(email: string): Promise<void> {
  const db = await getDB();
  const user = await db.get('users', email.toLowerCase());

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  user.planStatus = 'FREE';
  user.premiumUntil = undefined;
  user.updatedAt = new Date();

  await db.put('users', user);
}

// Helper functions
async function saveSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}

async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const setting = await db.get('settings', key);
  return setting?.value as T;
}
