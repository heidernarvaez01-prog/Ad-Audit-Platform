import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTROPHIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!ANTHROPIC_API_KEY) throw new Error("ANTROPHIC_API_KEY missing");

    // Validate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { question, accountId } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "question is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Aggregate user's campaigns from audit_records to scope by account_id
    const { data: audits } = await supabase
      .from("audit_records")
      .select("account_id, campaign_name, platform, presupuesto_total, fecha_inicio, fecha_fin")
      .eq("user_id", userId);

    const accountIds = Array.from(new Set((audits ?? []).map((a) => a.account_id).filter(Boolean)));
    const targetAccounts = accountId ? [accountId] : accountIds;

    // Pull recent metrics for those accounts
    let metrics: any[] = [];
    if (targetAccounts.length) {
      const { data } = await supabase
        .from("meta_datos")
        .select("account_id, account_name, campaign_name, adset_name, plataforma, fecha, total_cost, impressions, clicks, reach, frequency, ctr_all, cpc, cpm, thruplay_actions, objective")
        .in("account_id", targetAccounts)
        .order("fecha", { ascending: false })
        .limit(800);
      metrics = data ?? [];
    }

    // Aggregate by campaign
    const byCampaign = new Map<string, any>();
    for (const m of metrics) {
      const k = `${m.account_name ?? m.account_id}||${m.campaign_name}`;
      const cur = byCampaign.get(k) ?? {
        account: m.account_name ?? m.account_id,
        campaign: m.campaign_name,
        platform: m.plataforma,
        cost: 0, impressions: 0, clicks: 0, reach: 0, thruplay: 0, days: 0,
      };
      cur.cost += Number(m.total_cost ?? 0);
      cur.impressions += Number(m.impressions ?? 0);
      cur.clicks += Number(m.clicks ?? 0);
      cur.reach += Number(m.reach ?? 0);
      cur.thruplay += Number(m.thruplay_actions ?? 0);
      cur.days += 1;
      byCampaign.set(k, cur);
    }
    const campaignSummary = Array.from(byCampaign.values()).map((c) => ({
      ...c,
      ctr: c.impressions ? +(100 * c.clicks / c.impressions).toFixed(2) : 0,
      cpc: c.clicks ? +(c.cost / c.clicks).toFixed(2) : 0,
      cpm: c.impressions ? +(1000 * c.cost / c.impressions).toFixed(2) : 0,
    }));

    const context = {
      audits: audits ?? [],
      campaigns: campaignSummary.slice(0, 50),
      totalRows: metrics.length,
    };

    const systemPrompt = `Eres un analista senior de performance marketing. Analiza los datos de campañas del usuario y responde a su pregunta en español. 
Reglas:
- Usa SOLO los datos del contexto JSON proporcionado. Si faltan datos, dilo.
- Sé concreto: cita números (CTR, CPC, CPM, gasto) y nombres de campañas.
- Estructura tu respuesta con markdown: hallazgos clave, diagnóstico y recomendaciones accionables.
- Sé breve y directo (máx 350 palabras).`;

    const userPrompt = `Contexto (JSON):\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n\nPregunta del usuario:\n${question}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Límite de uso alcanzado. Intenta de nuevo en unos segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Anthropic error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiRes.json();
    const answer = data?.content?.[0]?.text ?? "Sin respuesta.";

    return new Response(
      JSON.stringify({ answer, stats: { campaignsAnalyzed: campaignSummary.length, rows: metrics.length } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
