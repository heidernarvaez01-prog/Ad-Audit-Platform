## Objetivo

Cambiar la fuente de datos de la UI: en vez de leer en vivo del Google Apps Script, leer de la tabla `sheet_sync_data` de Lovable Cloud (que ya se sincroniza cada hora). Las tablas (Matriz, Ad Sets) y los formularios (selectores de plataforma/cuenta/campaña) seguirán funcionando igual, solo cambia el origen.

## Cambios

### 1. `src/lib/api.ts` — leer de Supabase

Reescribir `fetchCampaignData()` para que consulte `sheet_sync_data` en vez del GAS:

- Usar el cliente de Supabase ya disponible (`@/integrations/supabase/client`).
- **Paginación obligatoria**: Supabase limita a 1000 filas por query y la tabla tiene ~42,000 filas. Iterar con `.range(from, to)` en bloques de 1000 hasta agotar.
- Mapear cada fila plana de la tabla al shape `ApiCampaignRow` (anidando `metrics: { cost, clicks, impressions, reach, cpc, cpm }`) para no tocar nada río abajo.
- Mantener el caché en memoria de 1 minuto (igual que hoy).
- `normalizeDate` ya no hace falta porque la fecha viene como `date` desde Postgres (formato YYYY-MM-DD garantizado), pero la dejamos por compatibilidad si el campo viene null.
- Las funciones `getUniqueCampaignNames`, `getUniqueAccountIds`, `getUniquePlatforms`, `getUniqueAccountNames`, `getCampaignCost` no cambian.

Resultado: `AuditPage`, `AuditForm`, `AuditTable`, `AdSetTable` siguen recibiendo el mismo `ApiCampaignRow[]` sin modificaciones.

### 2. `AuditPage.tsx` — indicador de última sync + botón sync manual

Agregar arriba de la matriz:

- Texto pequeño "Última sincronización: hace X min" leyendo la fila más reciente de `sheet_sync_log` (`order by synced_at desc limit 1`).
- Botón secundario "Sincronizar ahora" que llama a `supabase.functions.invoke('sync-sheet-data')`. Al terminar, recarga `apiData` y el log.
- El botón "Actualizar" existente sigue funcionando (refresca tanto registros como `apiData`).

### 3. Limpieza menor

- Quitar el `API_URL` del GAS de `src/lib/api.ts` (ya no se usa en cliente; solo lo usa el edge function).
- No tocar el edge function `sync-sheet-data` ni el cron (siguen igual).
- No tocar `AuditForm.tsx`, `AuditTable.tsx`, `AdSetTable.tsx` ni `audit-calculations.ts` — todos consumen `ApiCampaignRow[]` y seguirán funcionando.

## Detalles técnicos

```ts
// src/lib/api.ts (extracto)
export async function fetchCampaignData(): Promise<ApiCampaignRow[]> {
  const now = Date.now();
  if (cachedData && now - cacheTime < CACHE_TTL) return cachedData;

  const PAGE = 1000;
  const all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('sheet_sync_data')
      .select('account_id, account_name, campaign_name, adset_name, platform, date, cost, clicks, impressions, reach, cpc, cpm')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  cachedData = all.map(r => ({
    account_id: r.account_id ?? '',
    account_name: r.account_name ?? '',
    campaign_name: r.campaign_name ?? '',
    adset_name: r.adset_name ?? '',
    platform: r.platform ?? '',
    date: r.date ?? '',
    metrics: {
      cost: Number(r.cost) || 0,
      clicks: Number(r.clicks) || 0,
      impressions: Number(r.impressions) || 0,
      reach: Number(r.reach) || 0,
      cpc: Number(r.cpc) || 0,
      cpm: Number(r.cpm) || 0,
    },
  }));
  cacheTime = now;
  return cachedData!;
}
```

## Resultado

- La UI deja de depender del GAS en cada carga (más rápido y sin riesgo de timeouts del Sheet).
- Los datos se actualizan cada hora vía cron + manualmente con el botón "Sincronizar ahora".
- Indicador visible de la última sync para que sepas cuán fresco está lo que ves.
