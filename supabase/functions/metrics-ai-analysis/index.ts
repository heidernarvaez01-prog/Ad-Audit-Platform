import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chatCompletion } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { question, accountId, clientId, campaignName } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "question is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Aggregate user's campaigns from audit_records — optionally scoped to a
    // single client and/or campaign (floating AI chat flow)
    let auditQuery = supabase
      .from("audit_records")
      .select("account_id, campaign_name, platform, presupuesto_total, fecha_inicio, fecha_fin, client_id")
      .eq("user_id", userId);
    if (clientId && typeof clientId === "string") auditQuery = auditQuery.eq("client_id", clientId);
    if (campaignName && typeof campaignName === "string") auditQuery = auditQuery.eq("campaign_name", campaignName);
    const { data: audits } = await auditQuery;

    const accountIds = Array.from(new Set((audits ?? []).map((a) => a.account_id).filter(Boolean)));
    const targetAccounts = accountId ? [accountId] : accountIds;
    const targetCampaigns = Array.from(new Set((audits ?? []).map((a) => a.campaign_name).filter(Boolean)));

    // Pull recent metrics for those accounts (and campaign scope if given)
    let metrics: any[] = [];
    if (targetAccounts.length || targetCampaigns.length) {
      let q = supabase
        .from("meta_datos")
        .select("account_id, account_name, campaign_name, adset_name, plataforma, fecha, total_cost, impressions, clicks, reach, frequency, ctr_all, cpc, cpm, thruplay_actions, objective, link_clicks, interactions, conversions")
        .order("fecha", { ascending: false })
        .limit(800);
      if (campaignName && typeof campaignName === "string") {
        q = q.eq("campaign_name", campaignName);
      } else if (clientId && targetCampaigns.length) {
        q = q.in("campaign_name", targetCampaigns);
      } else if (targetAccounts.length) {
        q = q.in("account_id", targetAccounts);
      }
      const { data } = await q;
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

    const systemPrompt = `You are a senior performance marketing analyst. Analyze the user's campaign data and answer their question in the same language they ask in.
Rules:
- Use ONLY the data in the provided JSON context. If data is missing, say so.
- Be concrete: cite numbers (CTR, CPC, CPM, spend, conversions) and campaign names.
- Structure your answer with markdown: key findings, diagnosis, and actionable recommendations.
- Be brief and direct (max 350 words).`;

    const userPrompt = `Contexto (JSON):\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n\nPregunta del usuario:\n${question}`;

    const result = await chatCompletion({
      model: "gpt-4o-mini",
      maxTokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    if (!result.ok) {
      if (result.rateLimited) {
        return new Response(JSON.stringify({ error: "Límite de uso alcanzado. Intenta de nuevo en unos segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("OpenAI error", result.error);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const answer = result.content || "Sin respuesta.";

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
