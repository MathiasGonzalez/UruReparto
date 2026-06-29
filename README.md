# UruReparto

Aplicacion fullstack multitenant para control, manejo de stock y envios, con app mobile para repartidor, backoffice en Astro, stack Cloudflare y CI/CD con GitHub Actions.

## Arquitectura

```
urureparto/
├── apps/
│   ├── api/          # Cloudflare Workers + Hono.js + D1 (REST API)
│   ├── backoffice/   # Astro + Cloudflare Pages (panel de gestión)
│   └── mobile/       # Expo (React Native) — app para repartidores
├── packages/
│   └── shared/       # Tipos TypeScript compartidos
└── .github/workflows/ # CI/CD con GitHub Actions
```

## Stack

| Capa | Tecnología |
|---|---|
| **API** | Cloudflare Workers + Hono.js |
| **Base de datos** | Cloudflare D1 (SQLite) |
| **Sesiones / caché** | Cloudflare KV |
| **Backoffice** | Astro + Cloudflare Pages + Tailwind CSS |
| **App mobile** | Expo (React Native) |
| **CI/CD** | GitHub Actions + Cloudflare Wrangler + EAS |
| **Monorepo** | pnpm workspaces + Turborepo |

## Por qué Expo para la app mobile

- **Cross-platform**: iOS y Android desde un solo código TypeScript
- **Ecosistema React**: consistente con el resto del stack JS
- **EAS Build**: builds y OTA updates para repartidores sin app stores
- **Expo Router**: file-based routing familiar (similar a Next.js/Astro)
- **Offline-friendly**: soporte nativo de AsyncStorage y SecureStore
- **expo-location**: acceso a GPS para registrar coordenadas en entregas

## Requisitos previos

- Node.js >= 20
- pnpm >= 9
- Cuenta Cloudflare con Workers y D1 habilitado
- Cuenta Expo (para EAS Build)

## Setup local

```bash
# Instalar dependencias
pnpm install

# API: iniciar worker en local
cd apps/api
pnpm dev

# Backoffice: iniciar en local
cd apps/backoffice
pnpm dev

# Mobile: iniciar Expo
cd apps/mobile
pnpm start
```

## Variables de entorno / Secrets

### Cloudflare Workers (apps/api)

Configurar como secretos Wrangler o en `wrangler.toml`:

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | Clave secreta para firmar JWT |

### GitHub Actions Secrets

| Secret | Descripción |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token de API de Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | ID de cuenta Cloudflare |
| `EXPO_TOKEN` | Token de cuenta Expo (EAS) |
| `API_URL` | URL pública del Worker |

## Base de datos

Crear y migrar D1:

```bash
# Crear base de datos
wrangler d1 create urureparto-db

# Migrar (local)
cd apps/api && pnpm db:migrate:local

# Migrar (producción)
cd apps/api && pnpm db:migrate
```

## Multitenancy

Cada tenant tiene su propio `slug` único. Usuarios, stock y envíos están siempre aislados por `tenant_id`. La autenticación incluye el `tenantSlug` en el login para resolver el contexto correcto.

## CI/CD

| Workflow | Trigger | Acción |
|---|---|---|
| `deploy-api.yml` | Push a `main`/`dev` en `apps/api` | Deploya Cloudflare Worker |
| `deploy-backoffice.yml` | Push a `main`/`dev` en `apps/backoffice` | Deploya Cloudflare Pages |
| `mobile-build.yml` | Push a `main` en `apps/mobile` | EAS Build (preview) |

Guía de publicación y secretos para `dev`/`prod`: `docs/publicacion-dev-prod.md`.
