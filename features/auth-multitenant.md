# Feature: Autenticación multitenant

## Objetivo
Permitir inicio de sesión por tenant y alta inicial de tenant con usuario administrador.
Soporta dos métodos de autenticación controlados por feature flags: contraseña y OTP por email.

## Actores
- Admin
- Driver

## Flujos principales

### 1. Login con contraseña (FEATURE_PASSWORD_LOGIN)
1. Cliente envía `email`, `password` y `tenantSlug` a `POST /auth/login`.
2. Validación de tenant activo.
3. Validación de usuario activo dentro del tenant.
4. Verificación de contraseña con PBKDF2.
5. Emisión de JWT con `tenantId`, `role` y `sub`.

### 2. Login con código OTP por email (FEATURE_OTP_LOGIN)
1. Cliente envía `email` y `tenantSlug` a `POST /auth/otp/request`.
2. El servidor genera un código de 6 dígitos, lo almacena en KV (TTL 10 min) y lo envía al email usando Cloudflare Email Workers (binding `send_email`).
3. La respuesta siempre es exitosa para evitar enumeración de emails.
4. Cliente envía `email`, `tenantSlug` y `code` a `POST /auth/otp/verify`.
5. El servidor valida el código (máx. 5 intentos), lo elimina de KV y emite el JWT.

### 3. Registro de tenant
- `POST /auth/register-tenant` crea el tenant y el usuario admin inicial.
- Requiere contraseña para el admin, independiente de los feature flags de login.

## Feature flags

Los feature flags se configuran como variables de entorno en `wrangler.toml`:

| Variable | Valores | Por defecto | Descripción |
|---|---|---|---|
| `FEATURE_OTP_LOGIN` | `"true"` / `"false"` | `"true"` | Habilita los endpoints `POST /auth/otp/request` y `POST /auth/otp/verify`. |
| `FEATURE_PASSWORD_LOGIN` | `"true"` / `"false"` | `"true"` | Habilita `POST /auth/login` con contraseña. Al deshabilitar, el endpoint retorna HTTP 403. |

Ambos flags pueden estar activos al mismo tiempo, permitiendo que los usuarios elijan el método de login.

## Endpoints involucrados
- `POST /auth/login` — login con contraseña (controlado por `FEATURE_PASSWORD_LOGIN`)
- `POST /auth/otp/request` — solicitar código OTP (controlado por `FEATURE_OTP_LOGIN`)
- `POST /auth/otp/verify` — verificar código OTP y obtener JWT (controlado por `FEATURE_OTP_LOGIN`)
- `POST /auth/register-tenant` — registro inicial de tenant + admin

## Reglas de negocio clave
- El login es contextual al `tenantSlug`.
- Solo tenant y usuarios con estado `active` pueden autenticarse.
- Contraseñas con hash PBKDF2.
- OTPs: 6 dígitos, TTL 10 minutos, máximo 5 intentos.
- JWT firmado con `JWT_SECRET`.
- Las respuestas de `/otp/request` no revelan si el email existe (anti-enumeración).

## Configuración de Cloudflare Email Workers
- Se requiere un binding `send_email` llamado `SEND_EMAIL` en `wrangler.toml`.
- La dirección `SEND_EMAIL_FROM` debe estar verificada en Cloudflare Email Routing.
- Los OTPs se almacenan en el KV binding `SESSIONS` existente con clave `otp:{tenantSlug}:{email}`.

## Implementación relacionada
- API auth routes: `apps/api/src/routes/auth.ts`
- Email helper: `apps/api/src/email.ts`
- Middleware auth: `apps/api/src/middleware/auth.ts`
- Tipos de entorno: `apps/api/src/db/types.ts`
- Login mobile: `apps/mobile/app/login.tsx`
- Servicio API mobile: `apps/mobile/services/api.ts`
- Tipos compartidos: `packages/shared/src/index.ts`

