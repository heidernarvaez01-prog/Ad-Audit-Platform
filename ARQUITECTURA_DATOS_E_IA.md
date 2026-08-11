# Arquitectura de Datos e IA — Roadmap sobre Lovable Cloud

> Documento de decisión técnica: motor de alertas de presupuesto (aprobado vs. programado), capa
> de IA con selección dinámica de métricas (function calling) y memoria de aprendizaje de
> campañas. El proyecto se queda en Lovable Cloud — no se contempla desacoplarlo ni migrar de
> cuenta/hosting.
>
> Fecha: 2026-08-10, ajustado 2026-08-11. Complementa a `CLAUDE.md` (seguir sus convenciones de
> esquema y carpetas).

---

## 1. Punto de partida

**Lovable Cloud es un proyecto de Supabase que Lovable provisiona y administra.** Todo lo que
corre en `supabase/functions/`, las tablas de Postgres, RLS, Auth, pg_cron, pgmq — es Supabase
puro; Lovable es la capa de edición y el hosting del frontend (`*.lovable.app`), no un runtime
distinto. Todo lo que sigue en este documento se construye **sobre esa misma base**, sin cambiar
de cuenta ni de proveedor.

Ya resuelto (ver `CLAUDE.md` §10 y el commit `Alertas configurables, insights de IA...`):
- API key de Windsor y token de cron fuera del código, en Vault/Secrets.
- Cron jobs duplicado/huérfano eliminados.
- Motor de alertas con umbrales editables (`alert_rules`), envío automático con dedup/cooldown
  (`alert-dispatch`), canales múltiples (`notification_channels`: email, Slack, webhook, in-app).
- Query de Windsor ampliada con IDs de campaña/adset/ad, presupuestos reales (`daily_budget`,
  `lifetime_budget`, `budget_remaining` a nivel campaña y adset), ROAS, desglose de conversiones
  por tipo y rankings de calidad de Meta — ver `supabase/functions/sync-meta-datos/index.ts`.
  Fuente: `Facebook Metricas y dimensiones.pdf` (export de
  `windsor.ai/data-field/facebook/`, 561 métricas / 151 dimensiones confirmadas).

Lo que queda pendiente y cubre este documento: la alerta de `BUDGET_MISMATCH` (§2), el copiloto
de IA con function calling (§3) y la memoria de campañas con pgvector (§4).

---

## 2. Motor de alertas: presupuesto aprobado vs. presupuesto programado

`daily_budget`, `campaign_lifetime_budget` y `budget_remaining` en `meta_datos` ya no llegan
`null` — se piden a Windsor y se guardan (ver §1). Falta la regla que los use.

**Nueva regla en `_shared/alert-engine.ts`** (junto a las 6 existentes):

| Alerta | Disparo |
|---|---|
| `BUDGET_MISMATCH` | `ABS(daily_budget_de_meta_datos − presupuesto_diario_aprobado) / presupuesto_diario_aprobado > umbral` (sugerido 10%, configurable vía `alert_rules`, igual que el resto). `presupuesto_diario_aprobado` sale de `audit_records.presupuesto_total` / días totales — **no** de `campaign_tracking.programmed_budget`, esa tabla se eliminó por estar sin uso (era del flujo Google Sheets legacy). |

Reutiliza la infraestructura que ya existe — `alert_rules`, `alert_events`, `notification_channels`
y `alert-dispatch` — sin crear infraestructura nueva de notificación. Le da a la herramienta la
señal que hoy le falta: "lo que Meta tiene programado gastar no coincide con lo que el cliente
aprobó", antes de que se traduzca en sobregasto o subgasto real.

---

## 3. IA con selección dinámica de métricas

Hoy `audit-insight` y `metrics-ai-analysis` tienen un prompt fijo por función. Que la IA decida
qué variables consultar según la necesidad del usuario en el frontend es **function calling**: en
vez de mandarle al modelo un bloque de texto ya armado, se le da un menú de herramientas
(funciones SQL seguras) y el modelo decide cuáles llamar según la pregunta.

**Diseño propuesto** (evolucionar `metrics-ai-analysis`, que ya alimenta la pantalla `/ask`):

| Tool expuesta al modelo | Qué consulta | RLS |
|---|---|---|
| `get_pacing_summary(client_id, date_range)` | Estado de pacing por campaña (usa `audit-calculations.ts`) | Filtra por `account_assignments` del usuario |
| `get_campaign_metrics(campaign_name, metrics[], date_range)` | Métricas puntuales de `meta_datos` (spend, ROAS, CTR, CPC, frequency, quality_ranking, etc. — el modelo elige cuáles) | Igual |
| `get_budget_variance(client_id)` | Resultado de la regla `BUDGET_MISMATCH` (§2) | Igual |
| `get_alert_history(client_id, severity?)` | Alertas disparadas recientes desde `alert_events`/`notifications` | Igual |
| `search_campaign_insights(query_text)` | Búsqueda semántica en la memoria de campañas (§4) | Igual |

Cada tool es una función RPC de Postgres (`SECURITY DEFINER`) que ya aplica el filtro de cuenta —
así el modelo nunca puede leer datos fuera de lo que el usuario tiene asignado. Flujo: el frontend
manda la pregunta en lenguaje natural → la Edge Function llama a OpenAI con las tools declaradas →
el modelo decide cuáles ejecutar (puede encadenar varias) → se le devuelven los resultados → genera
la respuesta final. Reemplaza los prompts fijos actuales por una IA que arma su propia consulta
según lo que el usuario realmente pregunta.

---

## 4. Memoria y aprendizaje de campañas

Para que la IA "aprenda" de campañas pasadas sin montar un pipeline de ML completo, la pieza
correcta es una tabla de insights con embeddings — pgvector viene incluido gratis en Supabase
(y por tanto en Lovable Cloud también, es el mismo proyecto):

```sql
create extension if not exists vector;

create table public.campaign_insights (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.audit_clients(id) on delete cascade,
  audit_record_id uuid references public.audit_records(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  summary text not null,          -- narrativa generada por IA al cierre de la campaña
  metrics_snapshot jsonb not null, -- gasto final, pacing, CTR/CPC, ROAS, alertas disparadas, resultado
  embedding vector(1536),          -- text-embedding-3-small sobre `summary`
  created_at timestamptz not null default now()
);

create index campaign_insights_embedding_idx
  on public.campaign_insights using ivfflat (embedding vector_cosine_ops);
```

**Flujo de generación** (Edge Function programada, ej. junto al cron semanal de `weekly-report`):
cuando una `audit_record` cruza su `fecha_fin`, se genera un resumen con IA ("esta campaña
sobregastó 22% en la primera semana por frequency cap alto, luego se corrigió...") y su embedding,
y se guarda.

**Flujo de uso** (la tool `search_campaign_insights` de §3): ante una pregunta como "¿por qué esta
campaña está subgastando?", el copiloto busca por similitud semántica campañas pasadas con
patrones parecidos y las usa como contexto — las recomendaciones se vuelven más finas con cada
campaña cerrada, sin reentrenar ningún modelo.

RLS igual que el resto: `client_id` cruzado contra `account_assignments`, con bypass para admin.

---

## 5. Costo incremental estimado (sobre lo que ya se paga hoy en Lovable Cloud)

| Partida | Costo mensual estimado |
|---|---|
| OpenAI (gpt-4o-mini para copiloto function-calling + insights, uso moderado) | ~$20–60 |
| pgvector / `campaign_insights` | $0 (incluido en el plan de Supabase que ya usa Lovable Cloud) |
| Windsor.ai — sin cambios de plan si se mantiene solo Meta; sumar Google/TikTok/LinkedIn requeriría el plan Standard | según plan actual |

No hay costo de migración, hosting nuevo ni cuenta nueva — todo se construye sobre la
infraestructura que ya existe.

---

## 6. Roadmap de implementación

| Fase | Qué incluye | Depende de | Estado |
|---|---|---|---|
| 1 | Query de Windsor ampliada (IDs, presupuestos, ROAS, conversiones, quality rankings) | §1 | **Hecho** |
| 2 | Alerta `BUDGET_MISMATCH` sobre `alert-engine.ts` existente | §2 | Pendiente |
| 3 | Copiloto de IA con function-calling, evolucionando `metrics-ai-analysis` | §3 | Pendiente |
| 4 | Memoria de campañas (`campaign_insights` + pgvector) integrada como tool del copiloto | §4, requiere Fase 3 | Pendiente |

Cada fase es desplegable de forma independiente.

---

## 7. Próximo paso

Si quieres, tomo cualquiera de las fases pendientes (§2, §3 o §4) y la implemento directamente:
migraciones SQL + Edge Functions, para que las revises antes de aplicarlas.
