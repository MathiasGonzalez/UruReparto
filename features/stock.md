# Feature: Gestión de stock

## Objetivo
Gestionar inventario por tenant, incluyendo alta, consulta, edición y movimientos de stock.

## Actores
- Admin
- Operador backoffice

## Flujos principales
1. Listar productos con paginación y filtros (categoría/búsqueda).
2. Ver detalle de producto.
3. Crear producto.
4. Editar datos del producto.
5. Registrar movimiento (`inbound`, `outbound`, `adjustment`).
6. Consultar historial de movimientos.

## Endpoints involucrados
- `GET /stock`
- `GET /stock/:id`
- `POST /stock`
- `PATCH /stock/:id`
- `POST /stock/:id/movements`
- `GET /stock/:id/movements`

## Reglas de negocio clave
- Todo acceso está aislado por `tenant_id`.
- No se permite stock negativo.
- `adjustment` recalcula cantidad a valor objetivo.
- Se registra usuario que genera el movimiento.

## Implementación relacionada
- API: `apps/api/src/routes/stock.ts`
- Backoffice listado: `apps/backoffice/src/pages/stock/index.astro`
