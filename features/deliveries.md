# Feature: Gestión de envíos

## Objetivo
Administrar ciclo de vida de entregas desde creación hasta entrega/fallo, con tracking por código.

## Actores
- Admin / Operador backoffice
- Driver
- Cliente final (tracking público)

## Flujos principales
1. Crear envío con datos de cliente, dirección e ítems.
2. Listar envíos con filtros por estado y asignación.
3. Ver detalle de envío.
4. Asignar envío a repartidor.
5. Actualizar estado (`assigned`, `in_transit`, `delivered`, `failed`, etc.).
6. Consultar tracking público por `trackingCode`.

## Endpoints involucrados
- `GET /deliveries`
- `GET /deliveries/:id`
- `POST /deliveries`
- `PATCH /deliveries/:id/status`
- `PATCH /deliveries/:id/assign`
- `GET /deliveries/track/:trackingCode`

## Reglas de negocio clave
- Drivers solo ven y actualizan envíos asignados a sí mismos.
- Actualización de estado registra historial con ubicación opcional.
- Al marcar `delivered` o `failed`, se completa `completed_at`.
- Tracking público no requiere autenticación.

## Implementación relacionada
- API: `apps/api/src/routes/deliveries.ts`
- Backoffice listado: `apps/backoffice/src/pages/deliveries/index.astro`
