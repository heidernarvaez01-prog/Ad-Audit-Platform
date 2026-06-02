
# Brief de Marca por Cuenta

Nueva sección que permite registrar y editar un brief estratégico por cada cuenta publicitaria. Estos datos se asocian al `account_id` (el mismo que ya usan `audit_records` y `meta_datos`) y se envían como contexto al análisis de IA junto con las métricas de Windsor.ai.

## 1. Base de datos

Nueva tabla `public.brand_briefs` con un registro por `account_id` (único). Todos los campos largos como `text` nullable para permitir guardar parcial.

Campos:
- `account_id` (text, UNIQUE) — enlace con cuentas existentes
- `account_name` (text)
- `marca` (text)
- `sitio_web` (text)
- `necesidad_principal` (text)
- `descripcion_proyecto` (text)
- `mercado_objetivo` (text)
- `publico_objetivo` (text)
- `fundamentos_marca` (text)
- `palabras_marca` (text) — 30 palabras separadas por comas
- `frases_marca` (text) — 10 frases, una por línea
- `valores_marca` (text)
- `promesa_marca` (text)
- `reasons_why` (text)
- `personalidad_marca` (text) — arquetipo
- `estilo_tono` (text)
- `diferenciador` (text)
- `insights` (text)
- `elementos_marca` (text) — colores, tipografías, guía
- `benchmark` (text)
- `presupuesto_campana` (numeric)
- `user_id` (uuid), `created_at`, `updated_at`

RLS abierta (consistente con `audit_records` actual) + trigger `update_updated_at_column`.

## 2. Frontend — nueva página `/brief`

- Item en `AppSidebar` con icono (FileText) llamado "Brief de Marca".
- Página `src/pages/BriefPage.tsx`:
  - Selector de cuenta arriba: lista derivada de `audit_records` + `meta_datos` (account_id distintos con nombre).
  - Al seleccionar, hace `upsert`-load del brief de esa cuenta.
  - Formulario con todos los campos agrupados en secciones colapsables:
    1. Identificación (marca, sitio web, mercado, presupuesto)
    2. Estrategia (necesidad, descripción, público, fundamentos)
    3. Identidad verbal (30 palabras, 10 frases, valores, promesa, reasons why)
    4. Personalidad (arquetipo, estilo y tono, diferenciador)
    5. Creatividad y referencias (insights, elementos de marca, benchmark)
  - Inputs largos = `Textarea`; cortos = `Input`. Autosave con debounce (1.2s) usando `upsert` por `account_id` + toast discreto.

## 3. Integración con IA

- En `supabase/functions/audit-insight/index.ts`: antes de llamar al modelo, consultar `brand_briefs` por el `account_id` de la campaña analizada y añadir el contenido al prompt como bloque `### Contexto de marca`.
- Si no hay brief, se mantiene el comportamiento actual.
- El frontend (`AuditPage`/`AuditTable` donde se dispare insight) sigue igual; solo pasa `account_id` (ya disponible).

## 4. Detalles técnicos

- Tipos: tras la migración se regenera `src/integrations/supabase/types.ts` automáticamente.
- Reutilizar componentes ui existentes (`Input`, `Textarea`, `Label`, `Card`, `Collapsible`, `Button`, `Select`).
- Validación ligera con `zod` solo para sitio web (url opcional) y presupuesto (≥0); el resto texto libre con `maxLength` razonable (4000).
- Sin cambios a `audit_records` ni a `meta_datos`.

## Entregables
- Migración SQL (`brand_briefs` + RLS + trigger).
- `src/pages/BriefPage.tsx`, ruta en `App.tsx`, entrada en `AppSidebar.tsx`.
- Update de `audit-insight` edge function para incluir el brief en el prompt.
