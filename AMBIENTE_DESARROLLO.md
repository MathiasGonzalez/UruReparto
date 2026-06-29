# Ambiente de desarrollo local

## Requisitos

- Node.js 20 o superior
- pnpm 9 o superior
- Wrangler (`pnpm` lo instala dentro del workspace)
- Expo Go o emulador si vas a levantar la app mobile

## Instalación rápida

```bash
pnpm install
```

## Levantar cada app

### API

```bash
pnpm --filter @urureparto/api dev
```

La API corre con Wrangler y por defecto queda disponible en `http://localhost:8787`.

### Backoffice

```bash
pnpm --filter @urureparto/backoffice dev
```

### Mobile

```bash
pnpm --filter @urureparto/mobile start
```

## Base de datos local

Aplicar el schema de D1 en local:

```bash
pnpm --filter @urureparto/api db:migrate:local
```

## Variables y servicios necesarios

- `JWT_SECRET` para la API
- Cloudflare D1/KV configurados en `apps/api/wrangler.toml`
- `API_URL` para el backoffice si querés apuntar a una API distinta de `http://localhost:8787`

## Flujo recomendado

1. `pnpm install`
2. `pnpm --filter @urureparto/api db:migrate:local`
3. `pnpm --filter @urureparto/api dev`
4. En otra terminal, levantar `backoffice` o `mobile` según lo que estés desarrollando
