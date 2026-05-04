import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const API_URL = 'https://script.googleusercontent.com/a/macros/apachestudio.mx/echo?user_content_key=AWDtjMUeI_PaXfeETgAgk5airY4QxBiPU0-YO6QlNj2tocYs-0-KCOlKHvJgkVZvrvLfRF0QCVTwCMMHKuoWpiJ15VSaSkWiFVcJsWmVJRtzI2uF-eYCkwFenAN6MvYcidee7iT_Pfxyn7BymO5y9CC7lNWb2fqm1ZKvUW6raXowDHhpcMdQXXNUokLf53wVpznUv0TfgmvqcHzD_eLoXWAEpspWKcWG5pxgD6WygwmqWnMM2ySC_0A7pQXTjKiDxHrxRXLUtWoxwatPWZaPwPq1DUMUNs0YrJVB0VOKN4NCLySZgHkueYd3ph5zrSqkTAxf3i5vEyjh_SHtFiIHz93gq8GzN5PqPw&lib=Mkla_1qOnI1LwbK8wb2ccIbjB8koU5FJZ';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(raw)) {
    const [d, m, y] = raw.split('/');
    return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const start = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const raw = await res.json();

    let data: any[] = [];
    if (Array.isArray(raw)) data = raw;
    else if (raw.data && Array.isArray(raw.data)) data = raw.data;
    else if (raw.results && Array.isArray(raw.results)) data = raw.results;

    const rows = data.map((row: any) => ({
      account_id: row.account_id || row.accountId || '',
      account_name: row.account_name || row.accountName || '',
      campaign_name: row.campaign_name || row.campaignName || '',
      adset_name: row.adset_name || row.adsetName || row.ad_set_name || '',
      platform: row.platform || '',
      date: normalizeDate(row.date || row.Date || ''),
      cost: parseFloat(row.metrics?.cost ?? row.cost ?? 0) || 0,
      clicks: parseInt(row.metrics?.clicks ?? row.clicks ?? 0, 10) || 0,
      impressions: parseInt(row.metrics?.impressions ?? row.impressions ?? 0, 10) || 0,
      reach: parseInt(row.metrics?.reach ?? row.reach ?? 0, 10) || 0,
      cpc: parseFloat(row.metrics?.cpc ?? row.cpc ?? 0) || 0,
      cpm: parseFloat(row.metrics?.cpm ?? row.cpm ?? 0) || 0,
    }));

    // Truncate
    const { error: delErr } = await supabase
      .from('sheet_sync_data')
      .delete()
      .not('id', 'is', null);
    if (delErr) throw delErr;

    // Insert in batches
    const BATCH = 1000;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase.from('sheet_sync_data').insert(batch);
      if (error) throw error;
    }

    const duration = Date.now() - start;
    await supabase.from('sheet_sync_log').insert({
      rows_inserted: rows.length,
      duration_ms: duration,
      status: 'success',
    });

    return new Response(
      JSON.stringify({ ok: true, rows: rows.length, duration_ms: duration }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from('sheet_sync_log').insert({
      rows_inserted: 0,
      duration_ms: Date.now() - start,
      status: 'error',
      error: message,
    });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
