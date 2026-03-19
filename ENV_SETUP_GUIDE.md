# 🔐 Guía de Configuración - Environment Variables

## 📋 Resumen rápido

| Variable | Dónde configurar | Valor |
|----------|------------------|-------|
| `DATABASE_URL` | Vercel + GitHub | ✅ Provisto |
| `RESEND_API_KEY` | Vercel + GitHub | ✅ Provisto |
| `MERCADO_PAGO_*` | Vercel + GitHub | ✅ Provisto |
| `DEPLOY_SECRET` | Vercel + GitHub | ⚠️ Generar |
| `VITE_API_URL` | GitHub | 🔄 Cambiar en prod |

---

## 🚀 Configuración en Vercel (Backend)

1. Ir a **Vercel Dashboard** → Tu proyecto → **Settings** → **Environment Variables**

2. Agregar las siguientes variables (Production):

```bash
# Base de datos
DATABASE_URL=postgresql://neondb_owner:npg_Z6re5lpbGAJz@ep-solitary-dream-aixgqa0e-pooler.c-4.us-east-1.aws.neon.tech/Agenda_Dommuss?sslmode=require&channel_binding=require

# JWT Secret (generar uno nuevo)
JWT_SECRET=openssl rand -hex 32

# Email
RESEND_API_KEY=re_F3n147op_MTLu7n6nH6yMH1yGYLUNAY17

# Mercado Pago
MERCADO_PAGO_PUBLIC_KEY=APP_USR-06af6966-c2f4-489d-b0c4-d42dda5e1ce4
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-3072054647152143-030513-77e02ed22e8bc3fadd2a115119b2092f-245365099

# Deploy Secret (generar uno nuevo)
DEPLOY_SECRET=openssl rand -hex 32

# Contacto
CONTACT_EMAIL=contacto@tu-dominio.com

# App Version
APP_LATEST_VERSION=1.0.0
APP_VERSION_CODE=10000
APP_BUNDLE_URL=https://github.com/AlanDi123/Agenda-Tiendas/releases/latest/download/bundle.zip
```

3. **Redeploy** para aplicar los cambios

---

## 🔧 Configuración en GitHub Actions

1. Ir a **GitHub Repo** → **Settings** → **Secrets and variables** → **Actions**

2. Agregar **Repository secrets**:

```bash
# Backend API
VITE_API_URL=https://tu-backend-en-vercel.app

# Deploy Secret (el MISMO que en Vercel)
BACKEND_API_KEY=<el valor que generaste con openssl>

# Android Keystore (opcional, para signing)
ANDROID_KEYSTORE_BASE64=<base64 del keystore>
ANDROID_KEYSTORE_PASSWORD=<password>
ANDROID_KEY_PASSWORD=<password>
ANDROID_KEY_ALIAS=<alias>
```

---

## 🛠️ Desarrollo Local

1. Copiar `.env.example` a `.env`:
```bash
cp .env.example .env
```

2. El archivo `.env` ya está configurado con los valores provistos para desarrollo local.

3. **Importante**: El archivo `.env` está en `.gitignore` - NUNCA se debe commitear.

---

## 🔑 Generar secrets nuevos

### JWT Secret
```bash
openssl rand -hex 32
```

### Deploy Secret
```bash
openssl rand -hex 32
```

### Android Keystore Base64 (macOS)
```bash
base64 -w 0 android/app/keystore.jks | pbcopy
```

### Android Keystore Base64 (Windows)
```powershell
certutil -encode android/app/keystore.jks keystore.b64
```

---

## 📁 Archivos creados

| Archivo | Propósito | ¿Commitear? |
|---------|-----------|-------------|
| `.env` | Variables locales (desarrollo) | ❌ NO |
| `.env.example` | Template con nombres de variables | ✅ SÍ |
| `.gitignore` | Excluye `.env` del repo | ✅ SÍ |

---

## ⚠️ Seguridad

1. **Nunca** commitear `.env` con valores reales
2. **Rotar** las credenciales de Mercado Pago si se exponen
3. **Usar** secrets diferentes para desarrollo y producción
4. **Regenerar** JWT_SECRET y DEPLOY_SECRET para producción

---

## 🔍 Verificación

Después de configurar en Vercel:

```bash
# Testear conexión a la base de datos
curl https://tu-backend.vercel.app/api/v1/health

# Verificar variables de entorno
curl https://tu-backend.vercel.app/api/v1/health/env
```

---

## 📞 Soporte

Si tenés problemas con las variables:

1. Verificar logs en Vercel: **Dashboard** → **Project** → **Deployments** → **Logs**
2. Chequear que todas las variables estén en **Production**
3. Redeployar después de agregar variables
