// Subscription & Payment Types - Production Ready

export type PlanType = 'FREE' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY' | 'PREMIUM_LIFETIME';

export type PlanStatus = 'active' | 'expired' | 'cancelled' | 'past_due';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export type PaymentMethodType = 'mercadopago' | 'paypal' | 'ebanx' | 'mobbex' | 'payway';

// Subscription with recurring billing support
export interface Subscription {
  id: string;
  userId: string;
  planType: PlanType;
  status: PlanStatus;
  currentPeriodStart: Date;
  currentPeriodEnd?: Date; // Undefined for lifetime
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialEnd?: Date;
  discountCode?: string;
  discountAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Payment transaction
export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  amount: number;
  originalAmount: number;
  discountAmount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethodType;
  transactionId?: string;
  gatewayResponse?: Record<string, any>;
  failureReason?: string;
  createdAt: Date;
  completedAt?: Date;
  refundedAt?: Date;
}

// Discount code
export interface DiscountCode {
  code: string; // Stored uppercase for case-insensitive comparison
  description: string;
  type: 'percentage' | 'fixed';
  value: number; // Percentage (0-100) or fixed amount
  currency?: string; // For fixed discounts
  minAmount?: number; // Minimum purchase amount
  maxUses?: number; // Total usage limit
  usedCount: number;
  perUserLimit?: number; // Uses per user
  expiresAt?: Date;
  applicablePlans: PlanType[]; // Empty = all plans
  active: boolean;
  createdAt: Date;
}

// User discount code usage tracking
export interface UserDiscountUsage {
  userId: string;
  discountCode: string;
  usedAt: Date;
  paymentId: string;
}

// Subscription plan definitions
export interface SubscriptionPlan {
  id: PlanType;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly' | 'lifetime';
  intervalCount: number; // 1 = every month/year, 12 = every 12 months
  trialDays?: number;
  features: string[];
  popular?: boolean;
}

// Payment gateway configuration
export interface PaymentGatewayConfig {
  method: PaymentMethodType;
  name: string;
  logo: string;
  enabled: boolean;
  config: Record<string, string>;
  webhookUrl: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
}

// Payment session for checkout
export interface PaymentSession {
  id: string;
  userId: string;
  planType: PlanType;
  amount: number;
  originalAmount: number;
  discountAmount: number;
  discountCode?: string;
  currency: string;
  paymentMethod?: PaymentMethodType;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired' | 'cancelled';
  gatewayPaymentId?: string;
  gatewayUrl?: string;
  expiresAt: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

// Webhook event from payment gateway
export interface WebhookEvent {
  gateway: PaymentMethodType;
  eventType: string;
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  transactionId: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  rawEvent: any;
}

// Premium features flags
export interface PremiumFeatures {
  recurringEvents: boolean;
  alarms: boolean;
  dragAndDrop: boolean;
  editScope: boolean;
  export: boolean;
  unlimitedEvents: boolean;
  prioritySupport: boolean;
  advancedAnalytics: boolean;
}

// Plan definitions
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'FREE',
    name: 'Gratis',
    description: 'Funcionalidades básicas de agenda',
    price: 0,
    currency: 'USD',
    interval: 'monthly',
    intervalCount: 1,
    features: [
      'Hasta 50 eventos',
      'Vista de calendario',
      'Eventos básicos',
      'Sincronización local',
    ],
  },
  {
    id: 'PREMIUM_MONTHLY',
    name: 'Premium Mensual',
    description: 'Todas las funcionalidades premium',
    price: 9.99,
    currency: 'USD',
    interval: 'monthly',
    intervalCount: 1,
    trialDays: 7,
    features: [
      'Eventos ilimitados',
      'Eventos recurrentes',
      'Alarmas y recordatorios',
      'Drag & Drop',
      'Edición de eventos futuros/todos',
      'Exportar agenda',
      'Soporte por email',
    ],
    popular: true,
  },
  {
    id: 'PREMIUM_YEARLY',
    name: 'Premium Anual',
    description: 'Ahorra 2 meses con plan anual',
    price: 99.99,
    currency: 'USD',
    interval: 'yearly',
    intervalCount: 1,
    trialDays: 14,
    features: [
      'Todo lo del plan mensual',
      '2 meses gratis (ahorro 20%)',
      'Soporte prioritario',
      'Actualizaciones anticipadas',
    ],
  },
  {
    id: 'PREMIUM_LIFETIME',
    name: 'Premium Vitalicio',
    description: 'Acceso de por vida - Pago único',
    price: 199.99,
    currency: 'USD',
    interval: 'lifetime',
    intervalCount: 0,
    features: [
      'Acceso permanente',
      'Todas las features premium',
      'Actualizaciones futuras incluidas',
      'Soporte VIP',
      'Sin renovaciones',
      'Transferible una vez',
    ],
  },
];

// Payment methods configuration
export const PAYMENT_METHODS: PaymentGatewayConfig[] = [
  {
    method: 'mercadopago',
    name: 'Mercado Pago',
    logo: '/payment-icons/mercadopago.svg',
    enabled: true,
    config: {
      publicKey: '', // Configure in environment
      accessToken: '', // Configure in environment
    },
    webhookUrl: '/api/webhooks/mercadopago',
    successUrl: '/payment/success',
    failureUrl: '/payment/failure',
    pendingUrl: '/payment/pending',
  },
  {
    method: 'paypal',
    name: 'PayPal',
    logo: '/payment-icons/paypal.svg',
    enabled: true,
    config: {
      clientId: '', // Configure in environment
      clientSecret: '', // Configure in environment
      sandbox: 'true',
    },
    webhookUrl: '/api/webhooks/paypal',
    successUrl: '/payment/success',
    failureUrl: '/payment/failure',
    pendingUrl: '/payment/pending',
  },
  {
    method: 'ebanx',
    name: 'EBANX',
    logo: '/payment-icons/ebanx.svg',
    enabled: true,
    config: {
      publicKey: '', // Configure in environment
      privateKey: '', // Configure in environment
      sandbox: 'true',
    },
    webhookUrl: '/api/webhooks/ebanx',
    successUrl: '/payment/success',
    failureUrl: '/payment/failure',
    pendingUrl: '/payment/pending',
  },
  {
    method: 'mobbex',
    name: 'Mobbex',
    logo: '/payment-icons/mobbex.svg',
    enabled: true,
    config: {
      apiKey: '', // Configure in environment
      accessToken: '', // Configure in environment
    },
    webhookUrl: '/api/webhooks/mobbex',
    successUrl: '/payment/success',
    failureUrl: '/payment/failure',
    pendingUrl: '/payment/pending',
  },
  {
    method: 'payway',
    name: 'Payway',
    logo: '/payment-icons/payway.svg',
    enabled: true,
    config: {
      publicKey: '', // Configure in environment
      privateKey: '', // Configure in environment
      merchantId: '', // Configure in environment
    },
    webhookUrl: '/api/webhooks/payway',
    successUrl: '/payment/success',
    failureUrl: '/payment/failure',
    pendingUrl: '/payment/pending',
  },
];

// Default discount codes (stored in database in production)
export const DEFAULT_DISCOUNT_CODES: Omit<DiscountCode, 'usedCount' | 'createdAt'>[] = [
  {
    code: 'MAJESTADALAN',
    description: 'Acceso Premium Vitalicio Gratuito',
    type: 'percentage',
    value: 100,
    applicablePlans: ['PREMIUM_LIFETIME'],
    active: true,
    maxUses: 0, // Unlimited
    perUserLimit: 0, // Unlimited per user
    expiresAt: undefined, // Never expires
  },
  {
    code: 'BIENVENIDA10',
    description: '10% de descuento primer pago',
    type: 'percentage',
    value: 10,
    applicablePlans: ['PREMIUM_MONTHLY', 'PREMIUM_YEARLY'],
    active: true,
    maxUses: 1000,
    perUserLimit: 1,
    expiresAt: undefined,
  },
];

// Feature access by plan
export const PLAN_FEATURES: Record<PlanType, PremiumFeatures> = {
  FREE: {
    recurringEvents: false,
    alarms: false,
    dragAndDrop: false,
    editScope: false,
    export: false,
    unlimitedEvents: false,
    prioritySupport: false,
    advancedAnalytics: false,
  },
  PREMIUM_MONTHLY: {
    recurringEvents: true,
    alarms: true,
    dragAndDrop: true,
    editScope: true,
    export: true,
    unlimitedEvents: true,
    prioritySupport: false,
    advancedAnalytics: false,
  },
  PREMIUM_YEARLY: {
    recurringEvents: true,
    alarms: true,
    dragAndDrop: true,
    editScope: true,
    export: true,
    unlimitedEvents: true,
    prioritySupport: true,
    advancedAnalytics: true,
  },
  PREMIUM_LIFETIME: {
    recurringEvents: true,
    alarms: true,
    dragAndDrop: true,
    editScope: true,
    export: true,
    unlimitedEvents: true,
    prioritySupport: true,
    advancedAnalytics: true,
  },
};
