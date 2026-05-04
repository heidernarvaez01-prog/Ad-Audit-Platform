## Objetivo

Crear una nueva tabla en Lovable Cloud que se llene automáticamente cada hora con los datos del Google Apps Script (Sheet). La UI seguirá leyendo en vivo del Sheet como ahora; la tabla queda como respaldo / histórico consultable.

## 1. Nueva tabla `sheet_sync_data`

Refleja la estructura de `ApiCampaignRow` (de `src/lib/api.ts`):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `account_id` | text | |
| `account_name` | text | |
| `campaign_name` | text | |
| `adset_name` | text | |
| `platform` | text | |
| `date` | date | normalizada YYYY-MM-DD |
| `cost` | numeric | |
| `clicks` | integer | |
| `impressions` | integer | |
| `reach` | integer | |
| `cpc` | numeric | |
| `cpm` | numeric | |
| `synced_at` | timestamptz | default `now()` |

Tabla pública (sin `user_id`): los datos vienen del Sheet compartido, no son por usuario.

**RLS:** habilitada. Política SELECT para `public` (lectura libre). Sin políticas de INSERT/UPDATE/DELETE — solo el edge function (con service role) puede escribir.

Tabla auxiliar `sheet_sync_log`: registra `synced_at`, `rows_inserted`, `status`, `error` para auditar las corridas.

## 2. Edge function `sync-sheet-data`

`supabase/functions/sync-sheet-data/index.ts`:

1. Hace `fetch` al `API_URL` del GAS (mismo URL que ya usa `src/lib/api.ts`).
2. Normaliza filas con la misma lógica de `normalizeDate` y mapeo de campos.
3. Usa el cliente de Supabase con **service role key** para:
   - `DELETE FROM sheet_sync_data` (truncate vía delete)
   - `INSERT` el snapshot completo en lotes de 1000.
4. Inserta una fila en `sheet_sync_log` con el resultado.
5. Devuelve `{ ok, rows, duration_ms }`.

Configurada con `verify_jwt = false` para que el cron pueda llamarla sin token de usuario.

## 3. Cron job (cada hora)

Habilitar extensiones `pg_cron` y `pg_net`, luego programar:

```sql
select cron.schedule(
  'sync-sheet-hourly',
  '0 * * * *',
  $$ select net.http_post(
       url:='https://<project>.supabase.co/functions/v1/sync-sheet-data',
       headers:='{"Content-Type":"application/json"}'::jsonb,
       body:='{}'::jsonb
     ); $$
);
```

(Se inserta con el tool de insert, no migración, porque incluye URL específica del proyecto.)

## 4. UI

Cambio mínimo: agregar en `AuditPage` un indicador discreto "Última sincronización: hace X min" leyendo la fila más reciente de `sheet_sync_log`. La carga de datos sigue usando `fetchCampaignData()` del GAS — sin cambios funcionales.

## Resultado

- Cada hora, en punto, la tabla `sheet_sync_data` queda con un snapshot fresco del Sheet.
- Puedes consultarla con SQL o conectarla a otras herramientas.
- La app sigue funcionando exactamente igual que ahora; la tabla es respaldo paralelo.
