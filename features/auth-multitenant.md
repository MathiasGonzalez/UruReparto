# Feature: Autenticación multitenant

## Objetivo
Permitir inicio de sesión por tenant y alta inicial de tenant con usuario administrador.

## Actores
- Admin
- Driver

## Flujos principales
1. Login con `email`, `password` y `tenantSlug`.
2. Validación de tenant activo.
3. Validación de usuario activo dentro del tenant.
4. Emisión de JWT con `tenantId`, `role` y `sub`.
5. Registro de tenant nuevo con usuario admin inicial.

## Endpoints involucrados
- `POST /auth/login`
- `POST /auth/register-tenant`

## Reglas de negocio clave
- El login es contextual al `tenantSlug`.
- Solo tenant y usuarios con estado `active` pueden autenticarse.
- Contraseñas con hash PBKDF2.
- JWT firmado con `JWT_SECRET`.

## Implementación relacionada
- API: `/home/runner/work/UruReparto/UruReparto/apps/api/src/routes/auth.ts`
- Middleware auth: `/home/runner/work/UruReparto/UruReparto/apps/api/src/middleware/auth.ts`
- Login mobile: `/home/runner/work/UruReparto/UruReparto/apps/mobile/app/login.tsx`
