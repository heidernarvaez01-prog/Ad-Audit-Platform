## Objetivo

Fusionar el **Planificador** dentro de **Auditoría** para tener una sola vista donde el usuario:
1. Registra campañas vía el formulario actual de Auditoría (con selección desde la base `sheet_sync_data`).
2. Puede editar **fechas, tipo de calendario y presupuesto** directamente en la fila de la tabla.
3. Los cálculos (gasto, % gasto, % esperado, ideal/día, días restantes) se recalculan automáticamente al cambiar cualquier campo, leyendo de `sheet_sync_data`.
4. **No se pierde nada** de lo que ya existe: badges de plataforma, pacing bar, alertas, fila expandible con métricas, gráficos de Recharts e Insight IA.

## Cambios propuestos

### 1. `src/components/AuditTable.tsx` — celdas editables inline
Reemplazar las celdas estáticas por inputs/selects editables, con guardado debounced a Supabase:

- **Fecha inicio / Fecha fin**: `Input type="date"` compactos.
- **Tipo de calendario**: `Select` con las 3 opciones (Lun–Vie / Lun–Sáb / Corrido).
- **Presupuesto**: `Input type="number"`.
- Al hacer `onChange`:
  - Actualiza el estado local inmediatamente (recalculo instantáneo en UI).
  - Lanza `supabase.from('audit_records').update(...)` con un debounce de ~600ms (toast discreto).
- Las nuevas columnas se ubican antes de "Pacing" para que el flujo lectura-edición sea natural.
- Se conservan: badge de plataforma, columna campaña, cuenta, **pacing bar, estado, gasto/aprobado, ideal/día, IA, acciones, fila expandible con charts y métricas**.

### 2. `src/pages/AuditPage.tsx` — recálculo dinámico + carga automática
- Ya existe `auditRows` con `useMemo` sobre `records + apiData`. Solo hay que **propagar al hijo un `onUpdateRecord(id, patch)`** que actualice `records` localmente y persista en Supabase, manteniendo el recálculo memoizado.
- **Carga automática** de `apiData` al entrar (hoy es bajo demanda). Mantener "Actualizar" manual como override.
- Agregar pequeña ayuda visual: tooltip "Editable" en los headers de Fecha/Presupuesto/Calendario.

### 3. Eliminar la página Planificador
- Quitar la ruta `/planner` de `src/App.tsx`.
- Quitar el ítem "Planificador" del `src/components/AppSidebar.tsx`.
- Borrar `src/pages/PlannerPage.tsx` (ya no se necesita; su valor queda integrado en Auditoría).

### 4. Cálculo de "$ Gasto" coherente
En `audit-calculations.ts` el `gastoActual` se sigue pasando desde `AuditPage` sumando `apiData` por campaña entre `fecha_inicio` y `fecha_fin`. Al editar fechas en línea, el `useMemo` re-corre y el valor se ajusta automáticamente. No se modifica la lógica matemática existente.

## Lo que NO se toca
- Esquema de la base de datos.
- `AuditForm` (sigue siendo el punto de alta de campañas).
- `AdSetTable`, `PerformanceCharts`, `audit-alerts.ts`, `audit-calculations.ts`, `business-days.ts`.
- Edge function `sync-sheet-data` ni botón "Sincronizar ahora".

## Resultado
Una sola pestaña **Auditoría** que contiene:
- Formulario para crear campañas eligiendo de la base sincronizada.
- Tabla con todas las métricas actuales **+ celdas editables** (fechas, calendario, presupuesto) que recalculan en vivo.
- Toda la riqueza visual que ya tienes (pacing, alertas, charts, IA) intacta.
- El Planificador desaparece como pestaña separada.