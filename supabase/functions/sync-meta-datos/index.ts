import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WINDSOR_URL =
  "https://connectors.windsor.ai/facebook?api_key=3b97127322bd6bc821bf2cbe12046b84c3a1&date_preset=last_30d&fields=account_id,date,account_name,campaign,adset_name,campaign_objective,spend,clicks,impressions,reach,ctr,link_clicks,frequency,cpm,actions_post_engagement,video_thruplay_watched_actions_video_view,conversions&select_accounts=204109401";

function toDate(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n === null ? null : Math.trunc(n);
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const res = await fetch(WINDSOR_URL);
    if (!res.ok) throw new Error(`Windsor fetch failed: ${res.status}`);
    const json = await res.json();
    const rows: any[] = json?.data ?? [];

    const mapped = rows.map((r) => {
      const spend = toNum(r["spend"]);
      const clicks = toInt(r["clicks"]);
      const cpc = spend !== null && clicks && clicks > 0 ? spend / clicks : null;
      return {
        account_id: toStr(r["account_id"]),
        account_name: toStr(r["account_name"]),
        campaign_name: toStr(r["campaign"]),
        objective: toStr(r["campaign_objective"]),
        adset_name: toStr(r["adset_name"]),
        plataforma: "META",
        fecha: toDate(r["date"]),
        campaign_start_date: null,
        campaign_end_date: null,
        adset_start_date: null,
        adset_end_date: null,
        campaign_lifetime_budget: null,
        daily_budget: null,
        budget_remaining: null,
        adset_lifetime_budget: null,
        adset_daily_budget: null,
        total_cost: spend,
        cpc,
        cpm: toNum(r["cpm"]),
        frequency: toNum(r["frequency"]),
        ctr_all: toNum(r["ctr"]),
        clicks,
        reach: toInt(r["reach"]),
        impressions: toInt(r["impressions"]),
        thruplay_actions: toInt(r["video_thruplay_watched_actions_video_view"]),
        link_clicks: toInt(r["link_clicks"]),
        interactions: toInt(r["actions_post_engagement"]),
        conversions: toNum(r["conversions"]),
      };
    });

    // Reemplazo total
    const { error: delErr } = await supabase
      .from("meta_datos")
      .delete()
      .gte("id", 0);
    if (delErr) throw delErr;

    // Inserción por lotes
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < mapped.length; i += BATCH) {
      const chunk = mapped.slice(i, i + BATCH);
      const { error } = await supabase.from("meta_datos").insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
    }

    return new Response(
      JSON.stringify({ success: true, inserted, total: mapped.length, source: "windsor" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("sync-meta-datos error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
