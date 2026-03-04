// Authentication & Authorization Types

export type PlanStatus = 'FREE' | 'PREMIUM';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  verificationToken?: string;
  tokenExpiresAt?: Date;
  resetToken?: string;
  resetTokenExpiresAt?: Date;
  planStatus: PlanStatus;
  premiumUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordResetToken {
  email: string;
  token: string;
  expiresAt: Date;
}

export interface EmailVerificationToken {
  email: string;
  token: string;
  expiresAt: Date;
}

export interface AuthSession {
  userId: string;
  email: string;
  expiresAt: Date;
}
