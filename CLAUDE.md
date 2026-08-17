# Apache Studio — Ad Audit Platform

> Documento de contexto técnico para Claude (u otro agente de IA) que vaya a trabajar sobre este
> repositorio. Explica qué es la plataforma, cómo está construida, cómo funciona a nivel técnico,
> cómo se usa y qué hay que mejorar — con foco en **autenticación** e **ingesta automática de datos
> de las plataformas publicitarias de los clientes**.
>
> Última revisión: 2026-08-10. Si el código cambia, este archivo debe actualizarse.

---

## 1. Contexto y propósito

Apache Studio Ad Audit es una **herramienta operativa de auditoría de presupuesto y pacing
publicitario**, no un dashboard de reporting. Su pregunta central es:

> "¿Esta campaña está gastando el dinero al ritmo correcto para llegar al final del periodo con el
> presupuesto aprobado consumido, ni más ni menos?"

- **Usuarios**: equipo interno de Apache Studio (media buyers, account managers, dirección) y, de
  forma restringida, clientes con cuentas asignadas.
- **Dominio**: campañas de Meta Ads (activo hoy) y, por diseño, Google Ads, TikTok y LinkedIn.
- **Principios de producto** (recogidos en la memoria del proyecto):
  - Es una herramienta de auditoría, **no** un dashboard: números claros y alertas directas.
  - Tipografías Inter (UI) y JetBrains Mono (números). Colores por plataforma. Se evita el
    tema oscuro como default.
  - Los datos se cargan automáticamente al montar si hay sesión.
  - El match entre `audit_records.campaign_name` y el nombre de campaña de la API es **exacto**.

**URLs**
| Entorno | URL |
|---|---|
| Producción (dominio propio) | https://audit.apachestudio.mx |
| Publicado Lovable | https://ad-insight-hub-85.lovable.app |
| Preview | id-preview--544d7303…lovable.app |

---

## 2. Stack y arquitectura

```text
┌───────────────────────────────────────── Navegador ─────────────────────────────────────────┐
│  React 18 + Vite 5 + TypeScript + Tailwind v3 + shadcn/ui + framer-motion + Recharts         │
│  react-router-dom (BrowserRouter)   @tanstack/react-query   sonner/toaster                    │
│  supabase-js  ──►  sesión en localStorage, autoRefreshToken                                   │
└───────────────┬──────────────────────────────────────────────────────────────────────────────┘
                │ PostgREST (RLS por auth.uid())            │ functions.invoke()
                ▼                                            ▼
┌──────────────────────────── Lovable Cloud (Supabase) ────────────────────────────────────────┐
│  Postgres + RLS      Auth (email/password, invite, recovery)     Storage (sin buckets)        │
│  12 Edge Functions (Deno)     pg_cron + pg_net     pgmq (cola de correo)     Vault            │
└───────────────┬──────────────────────────────┬───────────────────────────┬───────────────────┘
                │                              │                           │
                ▼                              ▼                           ▼
        Windsor.ai (Meta Ads)            OpenAI (gpt-4o /              Resend
        connectors.windsor.ai             gpt-4o-mini)             (apachestudio.mx)
                                                                    ClickUp API
```

- **Sin backend propio**: toda la lógica de servidor vive en Edge Functions Deno bajo
  `supabase/functions/`.
- **Sin ORM**: acceso directo vía `supabase-js` tipado con `src/integrations/supabase/types.ts`
  (auto-generado, **no editar**).
- **Cliente Supabase**: `src/integrations/supabase/client.ts` (auto-generado, **no editar**).
  Importar siempre con `import { supabase } from "@/integrations/supabase/client"`.

### Estructura de carpetas

```text
src/
  App.tsx                 Router + AppShell + RequireAuth
  pages/                  Una página por ruta (14 archivos)
  components/             UI de dominio (AuditTable, AuditForm, PacingBar, MetricCard, …)
    ui/                   shadcn/ui, sin lógica de negocio
    backgrounds/ hero/ icons/   Elementos visuales
  lib/                    Lógica pura y sin React (ver §5)
  hooks/                  useAuth, useTheme, use-mobile, use-toast
  integrations/supabase/  client.ts + types.ts (AUTO-GENERADOS)
  index.css               Tokens semánticos de color HSL + animaciones
supabase/
  functions/              12 Edge Functions Deno
    _shared/              email.ts (Resend), plantillas transaccionales
  config.toml             verify_jwt por función (AUTO-GENERADO, no tocar project-level)
```

---

## 3. Mapa de la aplicación (rutas)

Todas las rutas salvo las marcadas como públicas están envueltas en `RequireAuth` + `AppShell`
(sidebar colapsable en desktop, drawer en móvil).

**Auditoría de contenido (2026-08-10)**: se eliminaron `/reporting` (Looker Studio embed — pura
fricción externa, duplicaba el resumen IA de Weekly Report), `/my-tasks` (ClickUp, no relacionado con
auditoría de ads), `/hero-demo` y `/floating-icons-demo` (playgrounds públicos sin auth). `/metrics-ai`
y el widget flotante `AIChatWidget` se fusionaron en `/ask` (`AskAIPage`) — antes eran dos UIs para la
misma función (`metrics-ai-analysis`), y `/metrics-ai` ni siquiera estaba en el menú.

| Ruta | Página | Qué hace |
|---|---|---|
| `/auth` | `AuthPage` | **Pública.** Login/signup y pantalla de "elige tu contraseña" para invitaciones y recuperación. |
| `/unsubscribe` | `UnsubscribePage` | **Pública.** Baja de correos por token. |
| `/` | `ClientsPage` | Home. Grid de clientes con KPIs globales, `PageHero` con gradiente. |
| `/client/:clientId` | `AuditPage` | **Núcleo.** "Auditoría Meta": tabla de auditorías con pacing, métricas recalculadas, alertas y formulario de alta/edición. |
| `/audit/:id` | `AuditDetailPage` | Detalle de una auditoría: barras de pacing, métricas, gráficos y diagnóstico IA. |
| `/brief` → `/brief/:clientId` | `ClientPicker` → `BriefPage` | Brand brief editable (insumo para la IA). |
| `/clusters` → `/clusters/:clientId` | `ClientPicker` → `ClusterPage` | Estrategias de marketing generadas por IA a partir del brief + resultados reales. |
| `/weekly-report` → `/weekly-report/:clientId` | `ClientPicker` → `WeeklyReportPage` | Reporte semanal HTML, previsualizable y enviable por correo. |
| `/ask` | `AskAIPage` | Chat de análisis de métricas con IA, con scope opcional de cliente/campaña. |
| `/alerts` | `AlertsPage` | Alertas activas + umbrales editables por regla + canales de entrega. |
| `/admin` | `AdminPage` | Invitar usuarios, roles, asignación de cuentas, revocar/eliminar. |
| `/how-it-works` | `HowItWorksPage` | Documentación in-app. |
| `*` | `NotFound` | 404 (ojo: se renderiza **dentro** del AppShell sin `RequireAuth`). |

---

## 4. Modelo de datos

Todas las tablas viven en el esquema `public`, con RLS habilitado. El patrón dominante es
**propiedad por usuario**: `auth.uid() = user_id` para SELECT/INSERT/UPDATE/DELETE.

### Núcleo de negocio

| Tabla | Propósito | Campos clave |
|---|---|---|
| `audit_clients` | Cliente/marca. Raíz de la jerarquía. | `name`, `looker_report_url`, `looker_approved`, `report_recipients[]` |
| `audit_records` | Una auditoría = una campaña con presupuesto y ventana temporal. | `account_id`, `campaign_name`, `presupuesto_total`, `fecha_inicio`, `fecha_fin`, `tipo_calendario`, `platform`, `client_id` |
| `brand_briefs` | Brief de marca (20+ campos cualitativos) usado como contexto de IA. | `marca`, `publico_objetivo`, `promesa_marca`, `diferenciador`, `presupuesto_campana`, `client_id` |
| `campaign_tracking` | Seguimiento de presupuesto aprobado vs programado. | `platform` (enum), `lab_days` (enum), `budget_approved`, `programmed_budget` |
| `data_sources` | URLs CSV por plataforma (legado del flujo Google Sheets). | `platform`, `csv_url`, `is_valid` |

### Datos de plataformas

| Tabla | Propósito |
|---|---|
| `meta_datos` | **Única fuente de métricas.** Una fila por campaña/adset/día. Sólo lectura para la app (`SELECT`; INSERT/UPDATE/DELETE denegados a clientes — sólo la Edge Function con service_role escribe). |

Columnas relevantes: `account_id`, `account_name`, `campaign_name`, `adset_name`, `objective`,
`plataforma`, `fecha`, `total_cost`, `clicks`, `impressions`, `reach`, `cpc`, `cpm`, `ctr_all`,
`frequency`, `link_clicks`, `interactions`, `thruplay_actions`, `conversions`, además de campos de
presupuesto de campaña/adset hoy **siempre null** (Windsor no los envía en el request actual).

### Acceso y roles

| Tabla | Propósito |
|---|---|
| `user_roles` | Roles en tabla separada (`app_role`: `admin` \| `user`). Nunca en perfil. Leída por `has_role()` (SECURITY DEFINER) para evitar recursión en RLS. |
| `account_assignments` | Qué `account_id` puede ver cada usuario, con `account_name` y `platform`. |

### IA y reporting

| Tabla | Propósito |
|---|---|
| `cluster_runs` | Ejecuciones de estrategia IA: `cluster_key`, `status`, `output_html`, `model`. |
| `weekly_reports` | Reporte semanal generado: `week_start/end`, `html`, `sent_to[]`, `sent_at`. |

### Alertas

| Tabla | Propósito |
|---|---|
| `alert_settings` | Por usuario: `enabled`, `only_critical`, `notify_frequency`, `last_sent_at`. (`email_recipients`/`pacing_threshold_pct` quedan como columnas legacy sin uso — superadas por `notification_channels`/`alert_rules`.) |
| `alert_rules` | Umbral editable + enable/disable por regla y por usuario (`rule_type`, `enabled`, `threshold`, `secondary_threshold`). Reemplaza los umbrales hardcodeados que antes vivían en `src/lib/audit-alerts.ts`. |
| `alert_events` | Deduplicación/cooldown: `campaign_name` + `alert_type` + `last_triggered_at`, usado por `alert-dispatch` (antes existía pero no se leía/escribía). |
| `notification_channels` | Canales de entrega por usuario: `channel_type` (`email` \| `slack_webhook` \| `generic_webhook` \| `in_app`; `whatsapp` planeado), `config` jsonb, `enabled`. |
| `campaign_ai_insights` | Hallazgos del AI deep-scan diario (ver más abajo): `severity`, `finding`, `recommendation`, `metrics_snapshot` jsonb por campaña. Se muestran en `/alerts` y también se entregan como alerta más (`alertType: 'AI_INSIGHT'`) por los mismos canales. |
| `notifications` | Feed del centro de notificaciones in-app (campana en `AppShell`): `severity`, `campaign_name`, `alert_type`, `message`, `read_at`. |

### Infraestructura de correo

| Tabla | Propósito |
|---|---|
| `email_send_log` | Registro de envíos (`message_id`, `template_name`, `status`). Sin DELETE. |
| `email_send_state` | Fila única: rate limiting, `retry_after_until`, `batch_size`, TTLs. |
| `email_unsubscribe_tokens` | Tokens de baja de un solo uso. |
| `suppressed_emails` | Lista de supresión (bounces, quejas). Sólo INSERT/SELECT. |

### Enums

```sql
ad_platform    := meta | google | tiktok | linkedin | extra1 | extra2
app_role       := admin | user
lab_days_type  := mon_fri | mon_sat | all
```

`audit_records.tipo_calendario` es **texto libre** con los valores `corridos | lun_vie | lun_sab`
(no un enum — inconsistencia conocida, ver §10).

### Funciones de base de datos

`has_role`, `update_updated_at_column` (trigger de `updated_at` en 6 tablas), y el conjunto de la
cola de correo: `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`,
`email_queue_wake` (trigger que despierta el cron al encolar), `email_queue_dispatch`.

---

## 5. Lógica de negocio clave (`src/lib/`)

Todo el cálculo es **puro y del lado del cliente**, sin React. Esto lo hace fácil de testear pero
significa que servidor y cliente pueden divergir (ver §10).

### `business-days.ts`
Cuenta días según el calendario de la campaña: `mon_fri`, `mon_sat`, `all`. Tres funciones:
`countBusinessDays(inicio, fin)`, `countElapsedBusinessDays(inicio, hoy)`,
`countRemainingBusinessDays(hoy, fin)`. Usa `date-fns`.

### `audit-calculations.ts` — el corazón
`calculateAuditMetrics(presupuestoTotal, fechaInicio, fechaFin, tipoCalendario, gastoActual)`:

```text
diasTotales           = días hábiles entre inicio y fin
diasTranscurridos     = días hábiles entre inicio y hoy
diasRestantes         = días hábiles entre hoy y fin
presupuestoRestante   = presupuestoTotal − gastoActual
presupuestoDiarioIdeal= presupuestoRestante / diasRestantes
gastoEsperado         = (diasTranscurridos / diasTotales) × presupuestoTotal
pacingPct             = (gastoActual − gastoEsperado) / gastoEsperado × 100

pacingStatus = SOBREGASTANDO  si pacingPct >  +10
               SUBGASTANDO    si pacingPct <  −10
               OK             en otro caso
```

El umbral **±10 %** es la regla de negocio central de la plataforma.

### `audit-helpers.ts` — corte de consolidación y armado de filas
- `getConsolidationCutoff()`: excluye **hoy y ayer**, porque las plataformas aún consolidan gasto.
- `buildAuditRows(records, apiData)`: por cada `audit_record`, filtra las filas de `meta_datos`
  cuyo `campaign_name` **coincide exactamente** y cuya `fecha` cae en
  `[fecha_inicio, min(fecha_fin, cutoff)]`, suma el gasto y recalcula métricas y alertas.
  Por eso, al editar el rango de fechas en la UI, **todas** las métricas (gasto, clicks,
  impressions, reach, CTR, CPC) se recalculan sobre el nuevo corte.

### `audit-alerts.ts` — motor de alertas (6 tipos, sin ruido)
| Tipo | Disparo |
|---|---|
| `OVERSPEND_50` | Gasto ≥ 150 % del esperado a la fecha. |
| `NOT_SPENDING` | Campaña activa con gasto reciente cero. |
| `ENDING_SOON` | Campaña dentro del 10 % final de su ventana. |
| `COST_SPIKE` | CPC/CPM +65 % vs periodo anterior. |
| `BUDGET_EARLY_DEPLETION` | Proyección de agotar presupuesto antes de `fecha_fin`. |
| `CREATIVE_FATIGUE` | Frecuencia alta + CTR en caída. |

Severidades: `info` / `warning` / `danger`.

### `api.ts` — capa de acceso a métricas
`fetchCampaignData()` pagina `meta_datos` de 1000 en 1000, normaliza a `ApiCampaignRow` y cachea
en memoria **5 minutos** (`clearCampaignDataCache()` para invalidar). Incluye un fallback de
columnas (`42703`) para tolerar migraciones pendientes.

### Otros
`platforms.ts` (etiquetas/colores por plataforma + URLs CSV legado), `csv.ts`, `formula-template.ts`
(plantilla de fórmulas para Sheets), `utils.ts` (`cn`).

---

## 6. Edge Functions

| Función | `verify_jwt` | Qué hace | Depende de |
|---|---|---|---|
| `sync-meta-datos` | false | Trae Meta Ads desde Windsor.ai y **reemplaza por completo** `meta_datos`. | Windsor, service_role |
| `admin-users` | (default) | Invitar, listar, eliminar usuarios y reset de contraseña. Valida rol `admin`. | service_role, Resend |
| `audit-insight` | (default) | Diagnóstico de riesgo de presupuesto por campaña (`gpt-4o-mini`). | OpenAI |
| `metrics-ai-analysis` | (default) | Chat de análisis de métricas (`gpt-4o-mini`). | OpenAI |
| `projection-cluster` | true | Genera la estrategia de marketing completa (`gpt-4o`). | OpenAI |
| `weekly-report` | false | Arma y envía el reporte semanal HTML (`gpt-4o` para el resumen). | OpenAI, Resend |
| `alert-dispatch` | false (auth manual) | Calcula y envía las alertas activas — manual ("Send now") o vía cron diario. Dedup/cooldown con `alert_events`, entrega multi-canal vía `notify.ts`, resumen narrativo con IA. Además corre el **AI deep-scan** (`_shared/ai-insights.ts`): compara cada campaña activa contra su propia línea base (ROAS, CTR, CPM, frequency, quality/engagement/conversion rankings de Meta) y le pide a gpt-4o-mini que decida qué desviación vale la pena reportar — cubre lo que las 6 reglas fijas no anticipan, sin mandarle a la IA el dataset crudo completo. Los hallazgos se guardan en `campaign_ai_insights` y se entregan por los mismos canales. Reemplaza a `send-alert-email`. | `_shared/alert-engine.ts`, `_shared/ai-insights.ts`, `_shared/notify.ts`, `_shared/openai.ts` |
| `send-transactional-email` | true | Encola un correo transaccional. | pgmq |
| `process-email-queue` | true | Consume la cola pgmq y envía por Resend, con reintentos y DLQ. | Resend |
| `preview-transactional-email` | false | Previsualiza plantillas React Email. | — |
| `handle-email-unsubscribe` | false | Baja por token. | — |
| `handle-email-suppression` | false | Webhook de bounces/quejas de Resend. | — |

`supabase/functions/_shared/email.ts` centraliza el envío: lee `RESEND_FROM` y `RESEND_REPLY_TO`
de los secretos, añade `List-Unsubscribe` y soporta `text`, `tags` y `headers`. **Ninguna función
debe hardcodear el remitente ni llamar a Resend directamente.**

`supabase/functions/_shared/openai.ts` centraliza el fetch a la API de Chat Completions de OpenAI
(usado por `audit-insight`, `metrics-ai-analysis`, `weekly-report` y `alert-dispatch`;
`projection-cluster` sigue con su propio fetch porque usa `stream: true`, un caso distinto).

`supabase/functions/_shared/alert-engine.ts` es la única implementación de las 6 reglas de alerta
(antes vivían por separado en `src/lib/audit-alerts.ts` y estaban reimplementadas en `weekly-report`).
El frontend importa este mismo archivo (`src/lib/audit-alerts.ts` es un re-export); `_shared/audit-calculations.ts`
y `_shared/business-days.ts` son copias Deno de `src/lib/audit-calculations.ts`/`business-days.ts`
(no se pudieron unificar en un solo archivo porque Deno requiere el prefijo `npm:` para `date-fns`,
incompatible con el import de Vite — mantener ambas en sync si cambia la fórmula de pacing).

### Cron jobs activos

| Job | Schedule (UTC) | Estado |
|---|---|---|
| `sync-windsor-meta-daily-3am` | `0 3 * * *` | Activo — ingesta de Windsor. Token leído desde Vault (`project_anon_key`), ya no hardcodeado en la migración. |
| `weekly-report-monday-7am` | `0 7 * * 1` | Activo. Ahora versionado en migración (antes solo existía en el Dashboard). |
| `alert-dispatch-daily` | `0 8 * * *` | Activo — dispara `alert-dispatch`; cada usuario decide internamente si hoy le toca envío según `notify_frequency`. |
| `process-email-queue` | cada 5 s | Se auto-programa al encolar y se auto-desprograma al vaciarse. |

Los jobs `sync-meta-datos-daily` (duplicado) y `sync-sheet-hourly` (huérfano) fueron eliminados en
`20260810120000_security_cleanup.sql`.

### Secretos configurados
`OPENAI_API_KEY`, `RESEND_API_KEY` (gestionado por conector), `RESEND_FROM`, `RESEND_REPLY_TO`,
`CLICKUP_API_TOKEN`, `LOVABLE_API_KEY`, `WINDSOR_API_KEY`, `CRON_SECRET`, y los `SUPABASE_*` del entorno.
`WINDSOR_API_KEY` y el token usado por pg_cron ya no están hardcodeados en el código/migraciones — ver
`20260810120000_security_cleanup.sql` y `20260810124500_alert_dispatch_cron.sql`.

---

## 7. Ingesta de datos de las plataformas de clientes

### Flujo actual

```text
pg_cron 03:00 UTC
      │
      ▼
sync-meta-datos (Edge Function)
      │  GET connectors.windsor.ai/facebook
      │     ?api_key=<desde secretos, ver §5>
      │     &date_preset=last_30d
      │     &select_accounts=204109401     ← UNA sola cuenta, fija en el código
      │     &fields=<42 campos, ver WINDSOR_FIELDS en index.ts — identidad
      │             (IDs de campaign/adset/ad), delivery, presupuesto,
      │             fechas de programación, profundidad de conversión
      │             (purchases/add_to_cart/checkout/ROAS), diagnósticos
      │             de calidad de Meta (quality/engagement/conversion
      │             ranking) y funnel (landing_page_view)>
      ▼
mapeo campo a campo  (campaign→campaign_name, spend→total_cost, ctr→ctr_all,
                      cpc calculado = spend/clicks, plataforma="META")
      ▼
UPSERT por lotes de 500, onConflict = llave natural
(plataforma, account_id, campaign_id, adset_id, ad_id, fecha)     ← resuelto 2026-08-17,
                                                                     ver P0 #2 abajo
      ▼
meta_datos  ──► src/lib/api.ts (paginado + caché 5 min) ──► buildAuditRows() ──► UI
```

### Restricción descubierta de la API de Windsor: breakdown vs. omni/ranking

El connector `facebook` de Windsor **rechaza con HTTP 400** cualquier request que combine un
campo de tipo *breakdown* (ej. `publisher_platform`, que desglosa cada fila por placement) con
campos `actions_omni_*`/`action_values_omni_*` ("omni", atribución agregada) o con los rankings
de calidad (`quality_ranking`, `engagement_rate_ranking`, `conversion_rate_ranking`). El mensaje
de error de Windsor nombra explícitamente los campos en conflicto. Confirmado con pruebas directas
contra la API el 2026-08-11.

**Por eso `WINDSOR_FIELDS` en `sync-meta-datos/index.ts` NO pide `publisher_platform`** — se
priorizaron los campos de conversión/calidad porque alimentan alertas y el AI deep-scan, sobre el
desglose por placement (que hoy es solo una tarjeta informativa en `AuditDetailPage.tsx`, oculta
mientras no haya datos reales). Si en el futuro se quiere desglose por placement, la única forma
es un **segundo sync independiente** (su propio request a Windsor sin campos omni/ranking,
escribiendo a otra tabla) — no se puede combinar en un solo request ni en `meta_datos`.

Este bug (campo incompatible agregado sin probarlo contra la API real) hizo que **todo sync desde
que se añadió `publisher_platform` fallara silenciosamente** (capturado por el try/catch de la
función, sin romper `meta_datos` porque el `throw` ocurre antes del insert, pero
tampoco actualizando nada) — los 18+ campos nuevos (IDs, presupuestos, ROAS, rankings, funnel)
quedaron en `NULL` para todas las filas hasta el fix. **Lección: probar cualquier campo nuevo de
Windsor con un curl directo antes de agregarlo a `WINDSOR_FIELDS`**, sobre todo si es un campo de
tipo breakdown/dimensión en vez de una métrica.

### Limitaciones críticas del flujo actual

1. **Una sola cuenta**: `select_accounts=204109401` está fijo en el código. Añadir un cliente
   exige editar y redesplegar la función.
2. **Sólo Meta**: no hay ingesta de Google Ads, TikTok ni LinkedIn, pese a que el enum
   `ad_platform` y `PLATFORM_CONFIG` los contemplan.
3. **Ventana de 30 días**: `date_preset=last_30d`. Cualquier auditoría con `fecha_inicio` anterior
   pierde histórico en cada sincronización, porque…
4. ~~**Delete-then-insert**~~ **Resuelto** (2026-08-17) — `sync-meta-datos` ahora hace `upsert`
   por lotes sobre la llave natural `(plataforma, account_id, campaign_id, adset_id, ad_id, fecha)`
   (constraint `meta_datos_natural_key`, migración
   `20260817160100_meta_datos_multiplatform_upsert.sql`). Si el fetch a Windsor falla a mitad del
   upsert, las filas ya escritas se conservan (no hay ventana de tabla vacía) y, al ser upsert en
   vez de insert, una corrida parcial se completa sola en la siguiente. La llave incluye
   `plataforma`, así que un futuro `sync-google-datos` no puede pisar ni borrar filas de Meta.
   La tabla también gana `platform_specific jsonb` como escape hatch para métricas propias de una
   plataforma futura sin `ALTER TABLE` por cada una.
5. ~~**API key en el repositorio**~~ **Resuelto** — ver §6, ahora en secretos.
6. **Sin observabilidad**: no existe tabla de estado de sincronización; si el cron falla nadie se
   entera hasta que un usuario ve números raros.
7. ~~**Campos de presupuesto vacíos**~~ **Resuelto** (2026-08-11) — `campaign_daily_budget` y
   afines ahora se piden y se mapean a `daily_budget`, y alimentan la regla `BUDGET_MISMATCH`.
   Desglose por placement (`publisher_platform`) sigue sin datos por la incompatibilidad de la
   API descrita arriba, no por falta de mapeo.
8. **Match por nombre exacto**: si el media buyer renombra la campaña en Meta, la auditoría deja
   de encontrar datos silenciosamente. Mitigado parcialmente por `campaign_id`/`ad_id`, ahora
   disponibles, pero el join principal sigue siendo por nombre.

---

## 8. Autenticación y control de acceso

### Flujo actual

- **`src/hooks/useAuth.ts`**: registra `onAuthStateChange` y luego `getSession()`. Expone
  `{ user, loading, signIn, signUp, signOut }`. **Nunca llama a `getUser()`**, es decir, confía en
  el token cacheado en localStorage sin revalidarlo contra el servidor de Auth.
- **`RequireAuth`** en `App.tsx`: si `loading` muestra spinner; si no hay `user` redirige a
  `/auth`. Es una guarda puramente de UI — la seguridad real la da RLS.
- **`src/pages/AuthPage.tsx`**: maneja los tres formatos de link que puede emitir Supabase:
  1. `?token_hash=…&type=…` → `verifyOtp()`
  2. `?code=…` (PKCE) → `exchangeCodeForSession()`
  3. `#access_token=…&type=…` (legado) → hidratación automática
  Además escucha el evento `PASSWORD_RECOVERY` y muestra la pantalla "elige tu contraseña" para
  invitación y recuperación, con estados de carga, error de link inválido y éxito.
- **`supabase/functions/admin-users/index.ts`**: valida que el llamante sea `admin`
  (`user_roles`), y expone las acciones `invite`, `list`, `delete_user`, `reset_password`.
  El link se genera con `auth.admin.generateLink()` y se envía con plantilla propia vía Resend
  (`admin-users/_templates.ts`), no con el correo por defecto de Supabase.
- **`src/pages/AdminPage.tsx`**: invitar + rol + cuenta (opcional) en un solo flujo; promover o
  degradar admin; revocar acceso; eliminar permanentemente. Si el usuario está en estado
  *invited* (nunca confirmó), "Revoke access" lo elimina por completo.

### Modelo de roles

```text
user_roles (user_id, role: admin|user)     ← tabla separada, nunca en el perfil
        │
        └─► has_role(uid, role)  SECURITY DEFINER, search_path=public
                    │
                    └─► usada en políticas RLS sin recursión

account_assignments (user_id, account_id, account_name, platform)
        └─► define qué cuentas ve cada usuario
```

### Debilidades actuales de auth

- Sólo email + contraseña. **No hay Google sign-in** pese a ser el default recomendado.
- **No existe la ruta `/reset-password`**; la recuperación se resuelve dentro de `/auth`, lo que
  funciona pero acopla dos flujos distintos en un componente de 330 líneas.
- `getSession()` sin `getUser()`: el estado de sesión no se revalida contra el servidor.
- Sin **MFA**, sin protección contra **contraseñas filtradas** (HIBP), sin caducidad ni reenvío de
  invitaciones, sin registro de accesos.
- Las rutas `/hero-demo` y `/floating-icons-demo` son **públicas** sin motivo.
- La ruta `*` (NotFound) renderiza el `AppShell` **fuera** de `RequireAuth`.
- La restricción real por cuenta depende de que **cada** política RLS la aplique; `meta_datos`
  hoy permite `SELECT` a todo usuario autenticado, sin filtrar por `account_assignments`.

---

## 9. Cómo se usa (recorrido completo)

1. **Invitar a un usuario** — `/admin` → *Invitar*: correo + rol (`Miembro` o `Admin`) + cuenta
   (opcional). Se envía un link a su correo; al abrirlo aterriza en `/auth`, elige contraseña y
   entra directamente al panel.
2. **Crear el cliente** — `/` → *Nuevo cliente*: nombre, descripción, destinatarios de reporte y,
   si aplica, la URL del reporte de Looker (visible sólo cuando se marca como aprobada).
3. **Rellenar el brief** — `/brief/:clientId`: marca, sitio, necesidad, público, promesa,
   diferenciador, presupuesto… Es el contexto cualitativo que consume la IA.
4. **Registrar la auditoría** — `/client/:clientId` → formulario: se elige la **cuenta**
   (`account_name` desde `meta_datos`), lo que filtra las **campañas** disponibles de esa cuenta;
   luego presupuesto total, fecha de inicio y fin, y tipo de calendario.
5. **Revisar el pacing** — la tabla muestra, por campaña: gasto real vs esperado, % de tiempo vs
   % de gasto (barra dual), presupuesto diario ideal, alertas y métricas (clicks, impressions,
   reach, CTR, CPC). Al cambiar las fechas todo se recalcula sobre el nuevo corte.
   Fila expandible → adsets y gráficos de series temporales.
6. **Profundizar** — `/audit/:id`: vista de detalle con diagnóstico IA bajo demanda
   (Crítico / Moderado / Sin Riesgo).
7. **Configurar alertas** — `/alerts`: activar, elegir destinatarios, umbral de pacing, sólo
   críticas, frecuencia. Botón de envío de prueba.
8. **Reporte semanal** — `/weekly-report/:clientId`: previsualizar y enviar; el cron lo dispara
   los lunes 07:00 UTC.
9. **Estrategia IA** — `/clusters/:clientId`: genera estrategias completas a partir del brief +
   resultados reales.

---

## 10. Puntos a mejorar (priorizados)

### P0 — Riesgo real hoy

| # | Problema | Acción | Esfuerzo |
|---|---|---|---|
| 1 | ~~La API key de Windsor está hardcodeada en `sync-meta-datos`.~~ **Resuelto** en `20260810120000_security_cleanup.sql` — ahora lee `WINDSOR_API_KEY` de los secretos. Sigue pendiente **rotar la key real en Windsor.ai**, ya que la anterior quedó expuesta en el historial de git del repo público. | — | — |
| 2 | ~~`DELETE` + `INSERT` sin transacción: un fallo deja `meta_datos` vacía.~~ **Resuelto** (2026-08-17) — `upsert` por lotes con constraint `meta_datos_natural_key` `(plataforma, account_id, campaign_id, adset_id, ad_id, fecha)`. | — | — |
| 3 | ~~Cron `sync-sheet-hourly` huérfano y `sync-meta-datos-daily` duplicado.~~ **Resuelto** en `20260810120000_security_cleanup.sql`. | — | — |
| 4 | `meta_datos` legible por cualquier usuario autenticado, sin filtrar por cuenta asignada. | Política RLS que cruce `account_id` con `account_assignments` (con bypass para `has_role(uid,'admin')`). | M |
| 5 | Sin observabilidad de la ingesta. | Tabla `sync_runs` (fuente, inicio, fin, filas, estado, error) + alerta por correo si falla. | M |

### P1 — Autenticación

| # | Mejora | Detalle |
|---|---|---|
| 6 | **Google sign-in** | Configurar el proveedor y usar `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`. Es el default esperado y elimina fricción de contraseñas. |
| 7 | **Ruta `/reset-password` dedicada** | Pública, con `supabase.auth.updateUser({ password })`. `resetPasswordForEmail` debe apuntar allí. Desacopla el flujo de `/auth`. |
| 8 | **Revalidar sesión** | En `RequireAuth` y en acciones sensibles, usar `getUser()` (revalida contra el servidor) en lugar de confiar sólo en `getSession()`. |
| 9 | **HIBP + MFA** | Activar la protección contra contraseñas filtradas; MFA (TOTP) obligatorio para el rol `admin`. |
| 10 | **Ciclo de vida de invitaciones** | Mostrar fecha de expiración, botón de reenvío y limpieza automática de invitaciones caducadas. |
| 11 | **Cerrar rutas públicas** | Eliminar `/hero-demo` y `/floating-icons-demo`; mover el `*` de NotFound dentro de `RequireAuth`. |
| 12 | **Bitácora de accesos** | Tabla `access_log` alimentada desde `onAuthStateChange` o un trigger, visible en `/admin`. |

### P2 — Ingesta multi-plataforma (el salto de producto)

El objetivo es que **añadir un cliente no requiera tocar código**. Diseño propuesto:

```sql
create table public.platform_sources (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.audit_clients(id) on delete cascade,
  platform ad_platform not null,
  external_account_id text not null,     -- select_accounts de Windsor
  connector text not null default 'windsor',
  lookback_days int not null default 90,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_status text,
  unique (platform, external_account_id)
);
```

Y una función genérica `sync-platform-data` que:
1. Lea todas las `platform_sources` activas.
2. Por cada una, llame al conector Windsor correspondiente
   (`/facebook`, `/google_ads`, `/tiktok`, `/linkedin`) con su `external_account_id` y su
   `lookback_days`.
3. Normalice a un esquema común (renombrar `meta_datos` → `platform_metrics` con columna
   `platform`, o crear la nueva y migrar).
4. Haga **upsert** idempotente y registre el resultado en `sync_runs`.
5. Sincronice en paralelo con concurrencia limitada y reintento exponencial.

Mejoras asociadas:
- **Ventana histórica configurable** por fuente en vez de `last_30d` fijo.
- **Traer los presupuestos reales de la plataforma** (`daily_budget`, `lifetime_budget`,
  `budget_remaining`) y contrastarlos con `presupuesto_total` — hoy esas columnas siempre son null
  y se pierde la señal más valiosa: "lo programado en Meta no coincide con lo aprobado".
- **Match robusto de campañas**: guardar `campaign_id` de la plataforma en `audit_records` y usarlo
  como clave primaria de match, con el nombre sólo como respaldo. Esto elimina la fragilidad ante
  renombrados.
- **Sincronización bajo demanda** por cliente desde la UI, además del cron.

### P3 — Calidad técnica

| # | Punto |
|---|---|
| 13 | `tipo_calendario` es texto libre en `audit_records` mientras existe el enum `lab_days_type`. Unificar. |
| 14 | ~~Todo el cálculo de pacing vive en el cliente...~~ **Resuelto**: las 6 reglas de alerta ahora viven en un único `supabase/functions/_shared/alert-engine.ts` importado tanto por el frontend como por `alert-dispatch`. `audit-calculations.ts`/`business-days.ts` siguen duplicados entre `src/lib/` y `supabase/functions/_shared/` (Deno necesita `npm:date-fns`, incompatible con el import de Vite) — mantener en sync si cambia la fórmula. |
| 15 | Cobertura de tests casi nula (`src/test/example.test.ts`). `business-days.ts`, `audit-calculations.ts` y `alert-engine.ts` (antes `audit-alerts.ts`) son funciones puras: son el mejor punto de partida para vitest — `alert-engine.ts` ahora además acepta `thresholds` por parámetro, lo que lo hace trivial de testear con casos tabulares. |
| 16 | La caché de 5 min de `api.ts` es un singleton de módulo; migrarla a react-query daría invalidación, reintentos y estados de carga gratis. |
| 17 | `AlertsPage` (499 líneas), `weekly-report` (466) y `ClientsPage` (440) piden extracción de componentes/handlers. |
| 18 | ~~`data_sources`, `campaign_tracking`...~~ **Resuelto**: ambas tablas confirmadas sin uso y eliminadas (`20260810130000_drop_legacy_sheets_tables.sql`), junto con `src/lib/platforms.ts` y `src/lib/csv.ts` (huérfanos, cero imports). `formula-template.ts` **sí está en uso** (por `ClusterPage.tsx`, plantilla de "La Fórmula") — se queda. |
| 19 | Mezcla de español e inglés en UI, nombres de columnas y copys. Fijar un idioma por capa (datos en español, UI en español) y ser consistente. |
| 20 | El corte de consolidación (hoy − 2 días) está hardcodeado y es igual para todas las plataformas; debería ser configurable por fuente. |

---

## 11. Convenciones y advertencias para el agente

**Nunca editar** (auto-generados, se sobrescriben):
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env` (`VITE_SUPABASE_*`)
- `supabase/config.toml` a nivel de proyecto (sólo bloques `[functions.*]`)

**Nunca tocar** los esquemas `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.

**Colores**: sólo tokens semánticos definidos en `src/index.css` y variantes de shadcn. Prohibido
`text-white`, `bg-black`, `bg-[#…]` en componentes — rompen el theming y el modo oscuro.

**Toda tabla nueva en `public`** necesita, en la misma migración y en este orden:
`CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`. Sin `GRANT` la app
recibe error de permisos aunque las políticas estén bien.

**Dónde va cada cosa**:
- Cálculo puro sin React → `src/lib/`
- Estado y efectos reutilizables → `src/hooks/`
- UI de dominio → `src/components/`
- Primitivas sin lógica → `src/components/ui/` (no modificar salvo necesidad real)
- Secretos, llamadas a terceros y cualquier cosa con service_role → `supabase/functions/`

**Correo**: siempre a través de `_shared/email.ts`. Nunca hardcodear el remitente ni llamar a la
API de Resend directamente.

**IA**: hoy todo pasa por OpenAI con `OPENAI_API_KEY` (`gpt-4o` para generación larga,
`gpt-4o-mini` para diagnósticos). Si se migra al Lovable AI Gateway, cambia el endpoint y la clave,
no la forma de los prompts.

---

## 12. Glosario

| Término | Significado |
|---|---|
| **Pacing** | Ritmo de gasto respecto al tiempo transcurrido. `OK` dentro de ±10 % del gasto esperado. |
| **Gasto esperado** | `(días hábiles transcurridos / días hábiles totales) × presupuesto total`. |
| **Presupuesto diario ideal** | `presupuesto restante / días hábiles restantes`. Lo que hay que gastar por día para aterrizar exacto. |
| **Lab days / tipo de calendario** | Qué días cuentan: `corridos` (todos), `lun_vie`, `lun_sab`. Cambia todos los cálculos. |
| **Corte de consolidación** | Se ignoran hoy y ayer porque las plataformas aún no consolidan el gasto. |
| **Share of spend** | Porcentaje del gasto de la campaña que se lleva un adset. |
| **Brief** | Contexto cualitativo de la marca; insumo de la IA junto con las métricas. |
| **Cluster** | Estrategia de marketing completa generada por IA a partir del brief + resultados. |
| **Windsor.ai** | Conector de terceros que expone las APIs publicitarias como un endpoint JSON único. |
