import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbziTsKYIb6Gg_Purc8e5QfcPb8oGkhjpgHJ1In3WQQTpF38AXCngc22W8E8soMJnU24/exec";

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

    const res = await fetch(SCRIPT_URL);
    if (!res.ok) throw new Error(`Script fetch failed: ${res.status}`);
    const json = await res.json();
    const rows: any[] = json?.data ?? [];

    const mapped = rows.map((r) => ({
      account_id: toStr(r["Account id"]),
      account_name: toStr(r["Account name"]),
      campaign_name: toStr(r["Campaign name"]),
      objective: toStr(r["Objective"]),
      adset_name: toStr(r["AdSet name"]),
      plataforma: toStr(r["Plataforma"]),
      fecha: toDate(r["Date"]),
      campaign_start_date: toDate(r["Campaign start date"]),
      campaign_end_date: toDate(r["Campaign end date"]),
      adset_start_date: toDate(r["AdSet start date"]),
      adset_end_date: toDate(r["AdSet end date"]),
      campaign_lifetime_budget: toNum(r["Campaign Lifetime budget"]),
      daily_budget: toNum(r["Daily budget"]),
      budget_remaining: toNum(r["Budget remaining"]),
      adset_lifetime_budget: toNum(r["AdSet Lifetime budget"]),
      adset_daily_budget: toNum(r["AdSet Daily budget"]),
      total_cost: toNum(r["Total Cost"]),
      cpc: toNum(r["CPC"]),
      cpm: toNum(r["CPM"]),
      frequency: toNum(r["Frequency"]),
      ctr_all: toNum(r["CTR (all)"]),
      clicks: toInt(r["Clicks"]),
      reach: toInt(r["Reach"]),
      impressions: toInt(r["Impressions"]),
      thruplay_actions: toInt(r["ThruPlay actions"]),
    }));

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
      JSON.stringify({ success: true, inserted, total: mapped.length }),
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
