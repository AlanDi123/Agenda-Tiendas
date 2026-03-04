// Payment Gateway Service
// Handles payment processing for premium upgrades

import { generateId } from '../utils/helpers';
import type { Payment, PaymentSession, SubscriptionPlan } from '../types/payment';

const SESSION_EXPIRY_MINUTES = 30;

// Mock payment plans
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'premium-monthly',
    name: 'Premium Mensual',
    price: 9.99,
    currency: 'USD',
    interval: 'monthly',
    features: [
      'Eventos recurrentes',
      'Alarmas y recordatorios',
      'Drag & Drop para reprogramar',
      'Edición de eventos futuros/todos',
      'Exportar agenda',
      'Eventos ilimitados',
    ],
  },
  {
    id: 'premium-yearly',
    name: 'Premium Anual',
    price: 99.99,
    currency: 'USD',
    interval: 'yearly',
    features: [
      'Todo lo del plan mensual',
      '2 meses gratis',
      'Soporte prioritario',
    ],
  },
  {
    id: 'premium-lifetime',
    name: 'Premium Vitalicio',
    price: 199.99,
    currency: 'USD',
    interval: 'lifetime',
    features: [
      'Acceso de por vida',
      'Todas las features premium',
      'Actualizaciones futuras incluidas',
    ],
  },
];

// Create payment session
export async function createPaymentSession(
  userId: string,
  planId: string = 'premium-monthly'
): Promise<PaymentSession> {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
  if (!plan) {
    throw new Error('Plan no encontrado');
  }

  const session: PaymentSession = {
    id: generateId(),
    userId,
    amount: plan.price,
    currency: plan.currency,
    status: 'active',
    expiresAt: new Date(Date.now() + SESSION_EXPIRY_MINUTES * 60 * 1000),
    createdAt: new Date(),
  };

  // Store session in database
  const { getDB } = await import('./database');
  const db = await getDB();
  await db.put('paymentSessions', session);

  return session;
}

// Simulate payment (for development/testing)
// In production, this would integrate with Stripe/PayPal/etc.
export async function simulatePayment(
  sessionId: string,
  paymentMethod: string = 'card'
): Promise<Payment> {
  const { getDB } = await import('./database');
  const db = await getDB();
  
  const session = await db.get('paymentSessions', sessionId);
  if (!session) {
    throw new Error('Sesión de pago no encontrada');
  }

  if (session.status !== 'active') {
    throw new Error('Sesión de pago no está activa');
  }

  if (new Date(session.expiresAt) < new Date()) {
    session.status = 'expired';
    await db.put('paymentSessions', session);
    throw new Error('Sesión de pago expirada');
  }

  // Simulate payment processing
  const payment: Payment = {
    id: generateId(),
    userId: session.userId,
    amount: session.amount,
    currency: session.currency,
    status: 'completed',
    paymentMethod,
    transactionId: `TXN_${generateId()}`,
    createdAt: new Date(),
    completedAt: new Date(),
  };

  // Store payment
  await db.put('payments', payment);

  // Update session
  session.status = 'completed';
  await db.put('paymentSessions', session);

  return payment;
}

// Confirm payment and activate premium
export async function confirmPayment(paymentId: string): Promise<boolean> {
  const { getDB } = await import('./database');
  const db = await getDB();
  
  const payment = await db.get('payments', paymentId);
  if (!payment) {
    throw new Error('Pago no encontrado');
  }

  if (payment.status !== 'completed') {
    throw new Error('Pago no completado');
  }

  // Get user and upgrade to premium
  const { upgradeToPremium } = await import('./authService');
  
  // Get user email from session or database
  const sessions = await db.getAll('sessions');
  const userSession = sessions.find(s => s.userId === payment.userId);
  
  if (!userSession) {
    throw new Error('Usuario no encontrado');
  }

  // Calculate premium until date based on plan
  let premiumUntil: Date;
  const session = await db.get('paymentSessions', payment.id);
  
  if (session) {
    // This is simplified - in production, get plan details
    premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  } else {
    premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  await upgradeToPremium(userSession.email, premiumUntil);

  return true;
}

// Get payment history for user
export async function getUserPayments(userId: string): Promise<Payment[]> {
  const { getDB } = await import('./database');
  const db = await getDB();
  
  const allPayments = await db.getAll('payments');
  return allPayments.filter(p => p.userId === userId);
}

// Get active payment session
export async function getActivePaymentSession(userId: string): Promise<PaymentSession | null> {
  const { getDB } = await import('./database');
  const db = await getDB();
  
  const sessions = await db.getAll('paymentSessions');
  const activeSession = sessions.find(
    s => s.userId === userId && s.status === 'active' && new Date(s.expiresAt) > new Date()
  );

  return activeSession || null;
}

// Cancel payment session
export async function cancelPaymentSession(sessionId: string): Promise<void> {
  const { getDB } = await import('./database');
  const db = await getDB();
  
  const session = await db.get('paymentSessions', sessionId);
  if (session) {
    session.status = 'cancelled';
    await db.put('paymentSessions', session);
  }
}

// Mock payment gateway URL (for production integration)
export function getPaymentGatewayUrl(sessionId: string): string {
  // In production, this would return a Stripe/PayPal checkout URL
  return `https://payment.gateway.example.com/checkout/${sessionId}`;
}
