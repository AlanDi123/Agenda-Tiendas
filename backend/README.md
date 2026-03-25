# Dommuss Agenda Backend

Production-safe backend for Dommuss Agenda SaaS with complete agenda module, authentication, and subscription management.

## 🔒 Security Principles

1. **Frontend NEVER decides subscription validity** - Only backend responses are trusted
2. **All webhooks require signature verification** - HMAC verification for all payment gateways
3. **Atomic transactions** - All state changes use database transactions
4. **Audit logging** - All payments, webhooks, and errors are logged
5. **Role-based access control** - USER, OWNER, STAFF, ADMIN roles

## 📋 Prerequisites

- Node.js >= 18.0.0
- PostgreSQL (or SQLite for development)
- npm or yarn

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/dommuss_agenda"
WEBHOOK_SECRET="your-master-webhook-secret-min-32-chars"
PASSWORD_SALT="your-unique-salt-min-32-chars"

# API Configuration
PORT=3001
CORS_ORIGINS=https://agenda-tienda.vercel.app,https://agenda-tiendas.vercel.app
NODE_ENV=production

# Payment Gateway Webhook Secrets
MERCADO_PAGO_WEBHOOK_SECRET="..."
PAYPAL_WEBHOOK_SECRET="..."
```

### 3. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database (creates MAJESTADALAN code)
npm run db:seed
```

### 4. Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Server will start on `http://localhost:3001`

## 📡 API Endpoints (v1)

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/register` | Register new user | No |
| POST | `/api/v1/auth/login` | Login user | No |
| POST | `/api/v1/auth/logout` | Logout user | Yes |
| POST | `/api/v1/auth/logout-all` | Logout all sessions | Yes |
| POST | `/api/v1/auth/refresh` | Refresh access token | No |
| POST | `/api/v1/auth/verify-email` | Verify email with token | No |
| POST | `/api/v1/auth/resend-verification` | Resend verification email | No |
| POST | `/api/v1/auth/request-password-reset` | Request password reset | No |
| POST | `/api/v1/auth/reset-password` | Reset password with token | No |
| GET | `/api/v1/auth/me` | Get current user profile | Yes |

### Agenda / Appointments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/agenda/appointments` | Create appointment | Yes |
| GET | `/api/v1/agenda/appointments` | Get appointments by range | Yes |
| GET | `/api/v1/agenda/appointments/:id` | Get appointment by ID | Yes |
| POST | `/api/v1/agenda/appointments/:id/reschedule` | Reschedule appointment | Yes |
| POST | `/api/v1/agenda/appointments/:id/cancel` | Cancel appointment | Yes |
| PUT | `/api/v1/agenda/appointments/:id/status` | Update appointment status | Yes |
| GET | `/api/v1/agenda/availability` | Get available time slots | Yes |
| GET | `/api/v1/agenda/staff/:id/statistics` | Get staff statistics | Yes |

### Subscriptions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/subscriptions/verify` | Verify subscription status | Yes |
| GET | `/api/v1/subscriptions/features` | Get features by plan | No |

### Discount Codes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/discounts/apply` | Apply discount code | Yes |
| POST | `/api/v1/discounts/check` | Check code validity | No |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/mercadopago` | Mercado Pago webhook |
| POST | `/api/webhooks/paypal` | PayPal webhook |
| POST | `/api/webhooks/ebanx` | EBANX webhook |
| POST | `/api/webhooks/mobbex` | Mobbex webhook |
| POST | `/api/webhooks/payway` | Payway webhook |

### Health Checks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Basic health check |
| GET | `/api/health/ready` | Readiness check (includes DB) |
| GET | `/api/health/live` | Liveness check |

## 🎫 Special Discount Code: MAJESTADALAN

| Property | Value |
|----------|-------|
| Code | `MAJESTADALAN` |
| Discount | 100% |
| Plan | PREMIUM_LIFETIME |
| Max Uses | Unlimited |
| Per User Limit | Unlimited |
| Expiration | Never |
| Payment Required | No |

This code grants immediate lifetime access with no payment required.

**Usage:**
```bash
POST /api/v1/discounts/apply
{
  "userId": "user-uuid",
  "code": "MAJESTADALAN",
  "planType": "PREMIUM_LIFETIME",
  "amount": 199.99
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "code": "MAJESTADALAN",
    "type": "percentage",
    "value": 100,
    "discountAmount": 199.99,
    "finalAmount": 0,
    "isLifetime": true,
    "requiresPayment": false
  }
}
```

## 📊 Database Schema

### Core Models

**User:**
- Authentication (email, passwordHash, emailVerified)
- Subscription (planType, planStatus, currentPeriodEnd)
- Roles (USER, OWNER, STAFF, ADMIN)
- Sessions (refreshTokens)

**Location:**
- Multi-location support
- Business hours (businessStart, businessEnd)
- Slot duration configuration
- Timezone support

**StaffAssignment:**
- User to location assignment
- Role per location
- Availability schedules

**Appointment:**
- Scheduling (startTime, endTime, duration)
- Status (pending, confirmed, cancelled, no_show, completed)
- Reschedule tracking (rescheduleCount, previousStartTime)
- Color coding

**Subscription:**
- Plan tracking (planType, isLifetime)
- Payment gateway integration
- Status management

### Indexes

All models have appropriate indexes for:
- User lookups (email, userId)
- Date range queries (startTime, endTime)
- Status filtering
- Foreign key relationships

## 🛡️ Signature Verification

### Generating Signatures (Gateway Side)

```javascript
const crypto = require('crypto');

function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const signature = hmac.update(JSON.stringify(payload)).digest('hex');
  return `sha256=${signature}`;
}
```

### Verifying Signatures (Backend)

The backend automatically verifies signatures for all webhook endpoints using the configured secrets.

## ⏰ Grace Period Logic

When a subscription expires:
1. `planStatus` changes to `grace_period`
2. User retains access for 72 hours (configurable via `GRACE_PERIOD_HOURS`)
3. After grace period, `planStatus` becomes `expired` and `planType` becomes `FREE`

## 📝 Error Logging

All errors are logged with:
- userId (if authenticated)
- Endpoint and method
- Error code and message
- Device information
- App version
- IP address
- Request metadata

**Query errors:**
```bash
# Admin endpoint (to be implemented)
GET /api/v1/admin/errors?severity=error&limit=50
```

## 📦 Mobile / APK Readiness

### Headers

Mobile apps should include:
```
Authorization: Bearer <access_token>
X-Device: <device_info>
X-App-Version: <app_version>
```

### Token Refresh Flow

1. Access token expires → 401 response
2. App calls `/api/v1/auth/refresh` with refresh token
3. Backend returns new access token + refresh token
4. App retries original request with new token

### Offline-Safe Operations

- All create/update operations are idempotent
- Appointment conflicts are checked server-side
- Reschedule history is tracked

## 🧪 Testing

### Test Registration

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123"}'
```

### Test Login

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123"}'
```

### Test Appointment Creation

```bash
curl -X POST http://localhost:3001/api/v1/agenda/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "locationId": "location-uuid",
    "staffId": "staff-uuid",
    "startTime": "2024-01-15T10:00:00Z",
    "endTime": "2024-01-15T11:00:00Z",
    "serviceType": "Consultation"
  }'
```

### Test MAJESTADALAN

```bash
curl -X POST http://localhost:3001/api/v1/discounts/apply \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "code": "MAJESTADALAN",
    "planType": "PREMIUM_LIFETIME",
    "amount": 199.99
  }'
```

## Verificar CORS en producción

Tras desplegar, comprobar que el preflight devuelve `Access-Control-Allow-Origin` para el dominio del frontend:

```bash
curl -sS -D - -o /dev/null -X OPTIONS "https://TU-BACKEND.vercel.app/api/v1/auth/login" \
  -H "Origin: https://TU-FRONTEND.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

Deberías ver `access-control-allow-origin: https://TU-FRONTEND.vercel.app` (o el origen reflejado). Si la función devuelve 500, revisá logs en Vercel y variables (`DATABASE_URL`, etc.); sin respuesta correcta el navegador mostrará error CORS aunque el problema sea otro.

En el dashboard de Vercel del **backend**: no dejes `CORS_ORIGINS` vacío; si no necesitás restringir, podés borrar la variable y usar solo la lista por defecto del código.

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `GRACE_PERIOD_HOURS` | 72 | Hours before expired |
| `NODE_ENV` | development | Environment |
| `CORS_ORIGINS` | (see defaults in code) | Extra allowed origins, comma-separated; merged with built-in list (incl. `agenda-tienda` / `agenda-tiendas` on Vercel). Do not set to empty. |
| `CORS_ORIGIN` | — | Optional single origin (same as one entry in `CORS_ORIGINS`; documented for compatibility) |

## 📄 License

Proprietary - Dommuss Agenda
