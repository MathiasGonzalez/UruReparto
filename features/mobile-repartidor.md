# Feature: App mobile de repartidor

## Objetivo
Permitir al repartidor operar entregas en campo: autenticarse, ver pendientes, consultar detalle y actualizar estado.

## Actores
- Driver

## Flujos principales
1. Login por tenant.
2. Ver resumen de estados del día.
3. Listar envíos propios con filtros por estado.
4. Ver detalle de envío.
5. Avanzar estado de entrega (`assigned` → `in_transit` → `delivered`).
6. Marcar envío como `failed`.
7. Cerrar sesión.

## Integraciones y capacidades
- Geolocalización opcional al actualizar estado.
- Consumo de API autenticada con JWT.

## Pantallas involucradas
- `/home/runner/work/UruReparto/UruReparto/apps/mobile/app/login.tsx`
- `/home/runner/work/UruReparto/UruReparto/apps/mobile/app/(tabs)/index.tsx`
- `/home/runner/work/UruReparto/UruReparto/apps/mobile/app/(tabs)/deliveries.tsx`
- `/home/runner/work/UruReparto/UruReparto/apps/mobile/app/delivery/[id].tsx`
- `/home/runner/work/UruReparto/UruReparto/apps/mobile/app/(tabs)/profile.tsx`

## Reglas de negocio clave
- La app opera sobre envíos asignados al driver autenticado.
- La transición de estados se guía por flujo operativo de entrega.
- Si hay permiso de ubicación, se adjuntan coordenadas en cambios de estado.
