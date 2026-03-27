/**
 * Drizzle ORM Schema for Dommuss Agenda
 * Compatible with Neon PostgreSQL serverless
 */

import { pgTable, text, timestamp, boolean, integer, decimal, uuid, index, uniqueIndex, pgEnum, jsonb, smallint } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// ENUMS
// ============================================

export const userRoleEnum = pgEnum('user_role', ['USER', 'OWNER', 'STAFF', 'ADMIN']);
export const planTypeEnum = pgEnum('plan_type', ['FREE', 'PREMIUM_MONTHLY', 'PREMIUM_YEARLY', 'PREMIUM_LIFETIME']);
export const planStatusEnum = pgEnum('plan_status', ['active', 'expired', 'grace_period', 'cancelled']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['pending', 'active', 'failed', 'refunded', 'cancelled']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'approved', 'rejected', 'refunded', 'cancelled', 'in_process']);
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed']);
export const emailStatusEnum = pgEnum('email_status', ['pending', 'sent', 'bounced', 'failed', 'suppressed']);
export const emailOutboxStatusEnum = pgEnum('email_outbox_status', ['pending', 'processing', 'sent', 'failed', 'dead']);
export const devicePlatformEnum = pgEnum('device_platform', ['android', 'ios', 'web']);
export const notificationTypeEnum = pgEnum('notification_type', ['event_created', 'event_updated', 'event_deleted', 'family_join', 'role_changed', 'payment_failed', 'payment_success', 'expiry_warning', 'new_login', 'weekly_summary']);

// ============================================
// USERS TABLE
// ============================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  emailVerifiedAt: timestamp('email_verified_at'),
  verificationToken: text('verification_token').unique(),
  verificationTokenExpires: timestamp('verification_token_expires'),
  resetToken: text('reset_token').unique(),
  resetTokenExpires: timestamp('reset_token_expires'),
  role: userRoleEnum('role').notNull().default('USER'),
  planType: planTypeEnum('plan_type').notNull().default('FREE'),
  planStatus: planStatusEnum('plan_status').notNull().default('active'),
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: text('last_login_ip'),
  emailStatus: emailStatusEnum('email_status').notNull().default('pending'),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  planTypeIdx: index('users_plan_type_idx').on(table.planType, table.planStatus),
  roleIdx: index('users_role_idx').on(table.role),
}));

// ============================================
// EMAIL VERIFICATIONS TABLE
// ============================================

export const emailVerifications = pgTable('email_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  verified: boolean('verified').notNull().default(false),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('email_verifications_user_id_idx').on(table.userId),
  expiresAtIdx: index('email_verifications_expires_at_idx').on(table.expiresAt),
}));

// ============================================
// PLANS TABLE
// ============================================

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  type: planTypeEnum('type').notNull(),
  priceUsd: decimal('price_usd', { precision: 10, scale: 2 }).notNull(),
  priceArs: decimal('price_ar', { precision: 15, scale: 2 }),
  features: jsonb('features_json').notNull(), // JSON array of features
  interval: text('interval').notNull(), // 'monthly', 'yearly', 'lifetime'
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  typeIdx: uniqueIndex('plans_type_idx').on(table.type),
  nameIdx: uniqueIndex('plans_name_idx').on(table.name),
}));

// ============================================
// SUBSCRIPTIONS TABLE
// ============================================

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  planType: planTypeEnum('plan_type'),
  status: subscriptionStatusEnum('status').notNull().default('pending'),
  startDate: timestamp('start_date').notNull().defaultNow(),
  endDate: timestamp('end_date'),
  isLifetime: boolean('is_lifetime').notNull().default(false),
  externalPaymentId: text('external_payment_id').unique(),
  paymentGateway: text('payment_gateway').notNull().default('mercadopago'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('subscriptions_user_id_idx').on(table.userId),
  statusIdx: index('subscriptions_status_idx').on(table.status),
  externalPaymentIdIdx: index('subscriptions_external_payment_id_idx').on(table.externalPaymentId),
  isLifetimeIdx: index('subscriptions_is_lifetime_idx').on(table.isLifetime),
}));

// ============================================
// PAYMENTS TABLE
// ============================================

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  amountArs: decimal('amount_ars', { precision: 15, scale: 2 }).notNull(),
  amountUsd: decimal('amount_usd', { precision: 10, scale: 2 }),
  currency: text('currency').notNull().default('ARS'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  gateway: text('gateway').notNull().default('mercadopago'),
  externalPaymentId: text('external_payment_id').unique(),
  preferenceId: text('preference_id'),
  discountCode: text('discount_code'),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0'),
  metadata: text('metadata'), // JSON string
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('payments_user_id_idx').on(table.userId),
  externalPaymentIdIdx: index('payments_external_payment_id_idx').on(table.externalPaymentId),
  statusIdx: index('payments_status_idx').on(table.status),
  gatewayIdx: index('payments_gateway_idx').on(table.gateway),
  createdAtIdx: index('payments_created_at_idx').on(table.createdAt),
}));

// ============================================
// DISCOUNT CODES TABLE
// ============================================

export const discountCodes = pgTable('discount_codes', {
  code: text('code').primaryKey(),
  type: discountTypeEnum('type').notNull().default('percentage'),
  value: decimal('value', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency'),
  maxUses: integer('max_uses'),
  perUserLimit: integer('per_user_limit'),
  applicablePlans: text('applicable_plans').notNull(), // JSON array
  expiresAt: timestamp('expires_at'),
  totalUsed: integer('total_used').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  activeIdx: index('discount_codes_active_idx').on(table.active, table.expiresAt),
}));

// ============================================
// DISCOUNT USAGES TABLE
// ============================================

export const discountUsages = pgTable('discount_usages', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  discountCode: text('discount_code').notNull().references(() => discountCodes.code, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('discount_usages_user_id_idx').on(table.userId),
  discountCodeIdx: index('discount_usages_discount_code_idx').on(table.discountCode),
  userCodeUnique: uniqueIndex('discount_usages_user_code_unique').on(table.userId, table.discountCode),
}));

// ============================================
// PAYMENT LOGS TABLE (Audit)
// ============================================

export const paymentLogs = pgTable('payment_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gateway: text('gateway').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull(),
  rawPayload: text('raw_payload').notNull(), // JSON string
  signature: text('signature'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('payment_logs_user_id_idx').on(table.userId),
  gatewayIdx: index('payment_logs_gateway_idx').on(table.gateway),
  statusIdx: index('payment_logs_status_idx').on(table.status),
  createdAtIdx: index('payment_logs_created_at_idx').on(table.createdAt),
}));

// ============================================
// WEBHOOK EVENTS TABLE (Audit)
// ============================================

export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  gateway: text('gateway').notNull(),
  eventType: text('event_type').notNull(),
  paymentId: text('payment_id').notNull(),
  status: text('status').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  signature: text('signature').notNull(),
  rawPayload: text('raw_payload').notNull(), // JSON string
  processed: boolean('processed').notNull().default(false),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  gatewayPaymentIdx: index('webhook_events_gateway_payment_idx').on(table.gateway, table.paymentId),
  processedIdx: index('webhook_events_processed_idx').on(table.processed),
  createdAtIdx: index('webhook_events_created_at_idx').on(table.createdAt),
}));

// ============================================
// REFRESH TOKENS TABLE
// ============================================

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  deviceId: text('device_id'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
  tokenIdx: index('refresh_tokens_token_idx').on(table.token),
  expiresAtIdx: index('refresh_tokens_expires_at_idx').on(table.expiresAt),
}));

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  emailVerifications: many(emailVerifications),
  subscriptions: many(subscriptions),
  payments: many(payments),
  discountUsages: many(discountUsages),
  paymentLogs: many(paymentLogs),
  refreshTokens: many(refreshTokens),
}));

export const emailVerificationsRelations = relations(emailVerifications, ({ one }) => ({
  user: one(users, {
    fields: [emailVerifications.userId],
    references: [users.id],
  }),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
  payments: many(payments),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  plan: one(plans, {
    fields: [payments.planId],
    references: [plans.id],
  }),
}));

export const discountCodesRelations = relations(discountCodes, ({ many }) => ({
  usages: many(discountUsages),
}));

export const discountUsagesRelations = relations(discountUsages, ({ one }) => ({
  user: one(users, {
    fields: [discountUsages.userId],
    references: [users.id],
  }),
  discountCode: one(discountCodes, {
    fields: [discountUsages.discountCode],
    references: [discountCodes.code],
  }),
  payment: one(payments, {
    fields: [discountUsages.paymentId],
    references: [payments.id],
  }),
}));

export const paymentLogsRelations = relations(paymentLogs, ({ one }) => ({
  user: one(users, {
    fields: [paymentLogs.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

// ============================================
// ENVIRONMENTS / NEGOCIOS (Reemplaza "Familias")
// ============================================
export const environments = pgTable('environments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  familyCode: text('family_code').unique(), // Para unirse con código
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // Borrado lógico para offline-first
}, (table) => ({
  ownerIdIdx: index('environments_owner_id_idx').on(table.ownerId),
  familyCodeIdx: index('environments_family_code_idx').on(table.familyCode),
}));

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id), // Null si es un perfil sin cuenta
  name: text('name').notNull(),
  email: text('email'),
  avatarColor: text('avatar_color'),
  permissions: text('permissions').notNull().default('readonly'), // 'admin' | 'readonly'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  environmentIdIdx: index('profiles_environment_id_idx').on(table.environmentId),
  userIdIdx: index('profiles_user_id_idx').on(table.userId),
}));

// ============================================
// AGENDA (Turnos y Eventos)
// ============================================
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  isAllDay: boolean('is_all_day').default(false),
  isRecurring: boolean('is_recurring').default(false),
  rrule: text('rrule'), // Regla de recurrencia
  baseEventId: uuid('base_event_id'), // Para excepciones de eventos recurrentes
  location: text('location'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  environmentIdIdx: index('events_environment_id_idx').on(table.environmentId),
  startDateIdx: index('events_start_date_idx').on(table.startDate),
  // Índices compuestos para consultas de calendario (rangos por ambiente)
  envStartDateIdx: index('events_env_start_date_idx').on(table.environmentId, table.startDate),
  envStartEndDateIdx: index('events_env_start_end_date_idx').on(table.environmentId, table.startDate, table.endDate),
  baseEventIdIdx: index('events_base_event_id_idx').on(table.baseEventId),
}));

// Relación de a quiénes está asignado el turno
export const eventAssignments = pgTable('event_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
}, (table) => ({
  eventIdIdx: index('event_assignments_event_id_idx').on(table.eventId),
  profileIdIdx: index('event_assignments_profile_id_idx').on(table.profileId),
}));

// ============================================
// LISTAS DE COMPRAS / TAREAS
// ============================================
export const shoppingLists = pgTable('shopping_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  environmentIdIdx: index('shopping_lists_environment_id_idx').on(table.environmentId),
}));

export const shoppingItems = pgTable('shopping_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  listId: uuid('list_id').notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  assignedProfileId: uuid('assigned_profile_id').references(() => profiles.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  listIdIdx: index('shopping_items_list_id_idx').on(table.listId),
  assignedProfileIdIdx: index('shopping_items_assigned_profile_id_idx').on(table.assignedProfileId),
}));

// ============================================
// CONTACTOS (Proveedores, Clientes, etc.)
// ============================================
export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  environmentIdIdx: index('contacts_environment_id_idx').on(table.environmentId),
}));

// ============================================
// MENÚ SEMANAL (Organización interna del local)
// ============================================
export const menus = pgTable('menus', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
  date: timestamp('date').notNull(),
  mealType: text('meal_type').notNull(), // 'Almuerzo', 'Cena', etc.
  description: text('description').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  environmentIdIdx: index('menus_environment_id_idx').on(table.environmentId),
  dateIdx: index('menus_date_idx').on(table.date),
}));

// ============================================
// RELATIONS
// ============================================
export const environmentsRelations = relations(environments, ({ many }) => ({
  profiles: many(profiles),
  events: many(events),
  shoppingLists: many(shoppingLists),
  contacts: many(contacts),
  menus: many(menus),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  environment: one(environments, {
    fields: [profiles.environmentId],
    references: [environments.id],
  }),
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  eventAssignments: many(eventAssignments),
  shoppingItems: many(shoppingItems),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  environment: one(environments, {
    fields: [events.environmentId],
    references: [environments.id],
  }),
  eventAssignments: many(eventAssignments),
}));

export const eventAssignmentsRelations = relations(eventAssignments, ({ one }) => ({
  event: one(events, {
    fields: [eventAssignments.eventId],
    references: [events.id],
  }),
  profile: one(profiles, {
    fields: [eventAssignments.profileId],
    references: [profiles.id],
  }),
}));

export const shoppingListsRelations = relations(shoppingLists, ({ one, many }) => ({
  environment: one(environments, {
    fields: [shoppingLists.environmentId],
    references: [environments.id],
  }),
  items: many(shoppingItems),
}));

export const shoppingItemsRelations = relations(shoppingItems, ({ one }) => ({
  list: one(shoppingLists, {
    fields: [shoppingItems.listId],
    references: [shoppingLists.id],
  }),
  assignedProfile: one(profiles, {
    fields: [shoppingItems.assignedProfileId],
    references: [profiles.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  environment: one(environments, {
    fields: [contacts.environmentId],
    references: [environments.id],
  }),
}));

export const menusRelations = relations(menus, ({ one }) => ({
  environment: one(environments, {
    fields: [menus.environmentId],
    references: [environments.id],
  }),
}));

// ============================================
// EMAIL OUTBOX (Cola de envío con reintentos)
// ============================================
export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text').notNull(),
  status: emailOutboxStatusEnum('status').notNull().default('pending'),
  attempts: smallint('attempts').notNull().default(0),
  maxAttempts: smallint('max_attempts').notNull().default(5),
  nextRetryAt: timestamp('next_retry_at').notNull().defaultNow(),
  lastError: text('last_error'),
  sentAt: timestamp('sent_at'),
  resendMessageId: text('resend_message_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('email_outbox_status_idx').on(table.status, table.nextRetryAt),
  toIdx: index('email_outbox_to_idx').on(table.to),
}));

// ============================================
// DEVICE TOKENS (FCM / APNs push)
// ============================================
export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  platform: devicePlatformEnum('platform').notNull().default('android'),
  deviceId: text('device_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('device_tokens_user_id_idx').on(table.userId),
  tokenIdx: index('device_tokens_token_idx').on(table.token),
  activeIdx: index('device_tokens_active_idx').on(table.userId, table.isActive),
}));

// ============================================
// NOTIFICATION LOGS (Centro de notificaciones)
// ============================================
export const notificationLogs = pgTable('notification_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: jsonb('data'),
  read: boolean('read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('notification_logs_user_id_idx').on(table.userId),
  unreadIdx: index('notification_logs_unread_idx').on(table.userId, table.read),
  createdAtIdx: index('notification_logs_created_at_idx').on(table.createdAt),
}));

// ============================================
// USER PREFERENCES (Modo no molestar, etc.)
// ============================================
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  pushEnabled: boolean('push_enabled').notNull().default(true),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  weeklySummaryEnabled: boolean('weekly_summary_enabled').notNull().default(true),
  dndStart: text('dnd_start'),
  dndEnd: text('dnd_end'),
  timezone: text('timezone').notNull().default('America/Argentina/Buenos_Aires'),
  preferredView: text('preferred_view').notNull().default('month'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('user_preferences_user_id_idx').on(table.userId),
}));

// ============================================
// RELATIONS (nuevas tablas)
// ============================================
export const emailOutboxRelations = relations(emailOutbox, (_) => ({}));

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(users, {
    fields: [deviceTokens.userId],
    references: [users.id],
  }),
}));

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  user: one(users, {
    fields: [notificationLogs.userId],
    references: [users.id],
  }),
  environment: one(environments, {
    fields: [notificationLogs.environmentId],
    references: [environments.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  users,
  emailVerifications,
  plans,
  subscriptions,
  payments,
  discountCodes,
  discountUsages,
  paymentLogs,
  webhookEvents,
  refreshTokens,
  environments,
  profiles,
  events,
  eventAssignments,
  shoppingLists,
  shoppingItems,
  contacts,
  menus,
  emailOutbox,
  deviceTokens,
  notificationLogs,
  userPreferences,
};
