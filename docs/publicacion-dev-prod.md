# Publicación y secretos (dev/prod)

Esta guía define cómo publicar en **dev** y **prod** usando ramas:

- `dev` → ambiente **dev**
- `main` → ambiente **prod**

## 1) Flujo de despliegue por rama

### API (`.github/workflows/deploy-api.yml`)
- Push a `dev`: deploy a Cloudflare Workers con `wrangler deploy --env dev`
- Push a `main`: deploy a Cloudflare Workers (producción)

### Backoffice (`.github/workflows/deploy-backoffice.yml`)
- Push a `dev`: build y deploy a Cloudflare Pages con branch `dev`
- Push a `main`: build y deploy a Cloudflare Pages (producción)
- Pull Request a `main`: preview deploy

## 2) Secrets necesarios en GitHub

Configurar los mismos nombres de secret en ambos environments de GitHub: **dev** y **production**.

### Secrets para API y Backoffice

| Secret | Para qué se usa |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token para ejecutar deploys con Wrangler |
| `CLOUDFLARE_ACCOUNT_ID` | Cuenta de Cloudflare donde viven Workers/Pages |

### Secret para Mobile (`.github/workflows/mobile-build.yml`)

| Secret | Para qué se usa |
|---|---|
| `EXPO_TOKEN` | Token de Expo EAS Build |
| `API_URL` | URL pública de la API usada por el build mobile |

> Recomendación: separar `API_URL` por environment usando secrets de environment (dev/production), en lugar de un único secret global.

## 3) Cómo cargar secrets en GitHub

### Opción A: desde la UI
1. Ir al repo en GitHub → **Settings** → **Environments**
2. Crear environments: `dev` y `production` (si no existen)
3. Entrar a cada environment → **Environment secrets** → **Add secret**
4. Cargar los secrets con los nombres exactos:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - (opcional para mobile) `EXPO_TOKEN`, `API_URL`

### Opción B: con GitHub CLI (`gh`)

```bash
# DEV
gh secret set CLOUDFLARE_API_TOKEN --env dev
gh secret set CLOUDFLARE_ACCOUNT_ID --env dev
gh secret set EXPO_TOKEN --env dev
gh secret set API_URL --env dev

# PRODUCTION
gh secret set CLOUDFLARE_API_TOKEN --env production
gh secret set CLOUDFLARE_ACCOUNT_ID --env production
gh secret set EXPO_TOKEN --env production
gh secret set API_URL --env production
```

## 4) Secrets de Cloudflare Worker (runtime)

El secret `JWT_SECRET` no se define en GitHub Actions. Se define en Cloudflare Worker (por ambiente):

```bash
# Producción
cd apps/api
wrangler secret put JWT_SECRET

# Dev
cd apps/api
wrangler secret put JWT_SECRET --env dev
```

## 5) Variables y recursos por ambiente (Wrangler)

En `apps/api/wrangler.toml`:
- Producción: configuración base
- Dev: bloque `[env.dev]` con su D1/KV propios

En `apps/backoffice/wrangler.toml`:
- Producción: `API_URL` de producción
- Dev: `[env.dev.vars]` con `API_URL` apuntando a la API dev

## 6) Checklist rápida

- [ ] Existe rama `dev`
- [ ] Existen environments `dev` y `production` en GitHub
- [ ] Secrets cargados en ambos environments
- [ ] `JWT_SECRET` configurado en Cloudflare para prod y dev
- [ ] Push a `dev` despliega dev
- [ ] Push a `main` despliega producción
