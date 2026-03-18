

## Plan: Reestructuración a Matriz de Auditoría Pro

### Resumen

Transformar la app de una vista plana de registros + tablas API separadas a una **Matriz de Auditoría unificada** con registro inteligente, tabla expandible con pacing visual, motor de alertas y pestanas por plataforma.

### Cambios principales

#### 1. Formulario Inteligente (`AuditForm.tsx` - reescribir)
- Agregar selector de **Plataforma** como primer paso (filtra campanas disponibles).
- Reemplazar el select de campaña por un **buscador con autocomplete** (Command/Combobox) que sugiere campañas de la API filtradas por plataforma seleccionada.
- Al seleccionar una campana, **precargar** fechas (inicio/fin de la API) y costo diario promedio como referencia, pero dejar todo editable.
- Mantener campos: presupuesto_total_aprobado, fecha_inicio, fecha_fin, tipo_calendario.

#### 2. Tabla de Auditoría con Vista Expandible (`AuditTable.tsx` - reescribir)
Reemplazar las cards actuales por una **tabla estándar** con filas expandibles (Collapsible):

**Columnas principales:**
- Campaña + Logo/Badge de plataforma
- **Barra de Pacing dual** (Progress): fondo = % tiempo transcurrido, barra = % presupuesto gastado. Colores: verde (OK), amarillo (sub), rojo (sobre).
- Estado (Badge): "En Ruta", "Subgastando", "Sobregastando"
- Gasto Actual / Aprobado (ej: `$915 / $2,000`)
- Diario Ideal
- Acciones (editar, eliminar)

**Fila expandible** (al hacer clic):
- Métricas detalladas de la API para esa campaña: Clicks, Impressions, CPC, CPM, Reach, CTR calculado.
- Panel de **Insights/Alertas** contextuales:
  - Alerta de agotamiento: si `presupuesto_restante / días_restantes > 2x gasto_diario_actual`
  - Comparación CPC vs promedio de la cuenta
  - Recomendación de gasto diario

#### 3. Motor de Alertas (`src/lib/audit-alerts.ts` - nuevo)
Lógica pura que recibe métricas de auditoría + métricas de API y genera alertas tipadas:
- `RIESGO_SUBEJECUCION`: presupuesto restante / días restantes >> gasto diario actual
- `CPC_ELEVADO`: CPC campaña > CPC promedio cuenta
- `SOBREGASTO_CRITICO`: pacing > +20%
- Cada alerta con: tipo, severidad (info/warning/danger), mensaje legible.

#### 4. Barra de Pacing Dual (`src/components/PacingBar.tsx` - nuevo)
Componente visual: barra de progreso con dos capas:
- Capa de fondo: marca el % de tiempo transcurrido (gris)
- Capa frontal: % de presupuesto gastado (color dinámico según estado)
- Tooltip con los números exactos.

#### 5. Pestañas por Plataforma en la página (`AuditPage.tsx` - refactor)
- Reemplazar las tablas separadas de Campaign/AdSet por un layout con **Tabs**: "General" | "Meta" | "Google" | etc. (dinámico según plataformas en los registros del usuario).
- Tab "General": tabla de auditoría completa con todas las campañas auditadas.
- Tabs por plataforma: misma tabla filtrada por plataforma.
- Filtros unificados (cuenta, fecha) se mantienen y aplican a la tab activa.
- Eliminar `CampaignSummaryTable` y `AdSetSummaryTable` como secciones separadas (sus datos se integran en la vista expandible).

#### 6. Actualización de `audit_records` (migración DB)
- Agregar columna `platform` (text, nullable, default null) a `audit_records` para guardar la plataforma asociada al registro.

#### 7. Cálculos adicionales en `audit-calculations.ts`
- Agregar `gastoDiarioActual` (gasto total / días transcurridos) para comparar contra diario ideal.
- Retornar `porcentajeTiempo` (días transcurridos / días totales * 100) para la barra dual.

### Archivos afectados

| Archivo | Acción |
|---|---|
| `supabase/migrations/` | Nueva migración: `ALTER TABLE audit_records ADD COLUMN platform text` |
| `src/lib/audit-alerts.ts` | Crear - motor de alertas |
| `src/components/PacingBar.tsx` | Crear - barra dual de pacing |
| `src/components/AuditTable.tsx` | Reescribir - tabla expandible |
| `src/components/AuditForm.tsx` | Reescribir - formulario inteligente con autocomplete |
| `src/pages/AuditPage.tsx` | Refactor - tabs por plataforma, eliminar tablas separadas |
| `src/lib/audit-calculations.ts` | Agregar gastoDiarioActual y porcentajeTiempo |
| `src/components/CampaignSummaryTable.tsx` | Eliminar |
| `src/components/AdSetSummaryTable.tsx` | Eliminar |

