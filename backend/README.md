# Dommuss Agenda Backend

Production-safe subscription validation backend for Dommuss Agenda SaaS.

## 🔒 Security Principles

1. **Frontend NEVER decides subscription validity** - Only backend responses are trusted
2. **All webhooks require signature verification** - HMAC verification for all payment gateways
3. **Atomic transactions** - All state changes use database transactions
4. **Audit logging** - All payments and webhooks are logged

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

# Optional (for specific gateways)
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

## 📡 API Endpoints

### Subscription Verification

```bash
POST /api/subscriptions/verify
Content-Type: application/json

{
  "userId": "user-uuid"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "planType": "PREMIUM_LIFETIME",
    "planStatus": "active",
    "expiresAt": null,
    "isLifetime": true,
    "features": {
      "recurringEvents": true,
      "alarms": true,
      "dragAndDrop": true,
      ...
    }
  }
}
```

### Discount Code Application

```bash
POST /api/discounts/apply
Content-Type: application/json

{
  "userId": "user-uuid",
  "code": "MAJESTADALAN",
  "planType": "PREMIUM_LIFETIME",
  "amount": 199.99
}
```

Response (MAJESTADALAN):
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

### Webhooks

All webhooks require signature verification:

```bash
POST /api/webhooks/mercadopago
POST /api/webhooks/paypal
POST /api/webhooks/ebanx
POST /api/webhooks/mobbex
POST /api/webhooks/payway
```

Headers:
```
X-Webhook-Signature: sha256=abc123...
```

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

## 📊 Database Schema

### User
- `id` - UUID
- `email` - Unique
- `planType` - FREE | PREMIUM_MONTHLY | PREMIUM_YEARLY | PREMIUM_LIFETIME
- `planStatus` - active | expired | grace_period | cancelled
- `currentPeriodEnd` - DateTime (null for lifetime)

### Subscription
- `id` - UUID
- `userId` - Foreign Key
- `planType` - Plan type
- `paymentGateway` - Gateway name
- `externalPaymentId` - Gateway's payment ID
- `status` - pending | active | failed | refunded | cancelled
- `isLifetime` - Boolean

### DiscountCode
- `code` - Primary Key
- `type` - percentage | fixed
- `value` - Discount value
- `maxUses` - null for unlimited
- `perUserLimit` - null for unlimited per user
- `expiresAt` - null for never

## ⏰ Grace Period Logic

When a subscription expires:
1. `planStatus` changes to `grace_period`
2. User retains access for 72 hours (configurable via `GRACE_PERIOD_HOURS`)
3. After grace period, `planStatus` becomes `expired` and `planType` becomes `FREE`

Run periodically:
```bash
# Would be called by cron job
node dist/scripts/processGracePeriods.js
```

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `GRACE_PERIOD_HOURS` | 72 | Hours before expired |
| `FREE_TRIAL_DAYS` | 7 | Trial period for new users |
| `NODE_ENV` | development | Environment |

## 📝 Testing

### Test Subscription Verification

```bash
curl -X POST http://localhost:3001/api/subscriptions/verify \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-id"}'
```

### Test Discount Code

```bash
curl -X POST http://localhost:3001/api/discounts/apply \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "code": "MAJESTADALAN",
    "planType": "PREMIUM_LIFETIME",
    "amount": 199.99
  }'
```

### Test Webhook (with signature)

```bash
# Generate signature
SIGNATURE=$(echo -n '{"id":"pay_123","status":"approved"}' | openssl dgst -sha256 -hmac "your-secret" | cut -d' ' -f2)

# Send webhook
curl -X POST http://localhost:3001/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "X-Request-Signature: sha256=$SIGNATURE" \
  -d '{"id":"pay_123","status":"approved","metadata":{"userId":"user-uuid"}}'
```

## 🚨 Error Handling

All errors return consistent format:

```json
{
  "error": "Error Name",
  "message": "Human-readable message",
  "code": "ERROR_CODE"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid signature)
- `404` - Not Found (user not found)
- `409` - Conflict (code already exists)
- `500` - Internal Server Error

## 📦 Deployment

### Environment Variables (Production)

Ensure these are set in your production environment:
- `DATABASE_URL` - Production database
- `WEBHOOK_SECRET` - Strong random secret (32+ chars)
- `NODE_ENV=production`
- All gateway-specific webhook secrets

### Health Checks

Configure your load balancer to check:
- `/api/health/live` - Liveness probe
- `/api/health/ready` - Readiness probe

### Database Migrations

Run before deploying:
```bash
npm run db:generate
npm run db:migrate
```

## 📄 License

Proprietary - Dommuss Agenda
