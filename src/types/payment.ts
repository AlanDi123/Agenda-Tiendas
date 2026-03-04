// Payment & Subscription Types

export type PlanStatus = 'FREE' | 'PREMIUM';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string;
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface PaymentSession {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'active' | 'completed' | 'expired' | 'cancelled';
  expiresAt: Date;
  createdAt: Date;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly' | 'lifetime';
  features: string[];
}

// Premium features flags
export interface PremiumFeatures {
  recurringEvents: boolean;
  alarms: boolean;
  dragAndDrop: boolean;
  editScope: boolean;
  export: boolean;
  unlimitedEvents: boolean;
}

export const FREE_FEATURES: PremiumFeatures = {
  recurringEvents: false,
  alarms: false,
  dragAndDrop: false,
  editScope: false,
  export: false,
  unlimitedEvents: false,
};

export const PREMIUM_FEATURES: PremiumFeatures = {
  recurringEvents: true,
  alarms: true,
  dragAndDrop: true,
  editScope: true,
  export: true,
  unlimitedEvents: true,
};
