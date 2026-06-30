import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { openaiChat } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignData } = await req.json();

    // Fetch brand brief context for the account, if available
    let briefBlock = "";
    try {
      const accountId = campaignData?.accountId;
      if (accountId) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SERVICE_KEY) {
          const r = await fetch(
            `${SUPABASE_URL}/rest/v1/brand_briefs?account_id=eq.${encodeURIComponent(accountId)}&select=*`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
          );
          if (r.ok) {
            const rows = await r.json();
            const b = Array.isArray(rows) ? rows[0] : null;
            if (b) {
              const lines: string[] = [];
              const push = (label: string, v: any) => { if (v != null && String(v).trim() !== "") lines.push(`- ${label}: ${v}`); };
              push("Marca", b.marca);
              push("Sitio web", b.sitio_web);
              push("Mercado objetivo", b.mercado_objetivo);
              push("Necesidad principal", b.necesidad_principal);
              push("Descripción del proyecto", b.descripcion_proyecto);
              push("Público objetivo", b.publico_objetivo);
              push("Fundamentos de marca", b.fundamentos_marca);
              push("Promesa de marca", b.promesa_marca);
              push("Reasons why", b.reasons_why);
              push("Personalidad / arquetipo", b.personalidad_marca);
              push("Estilo y tono", b.estilo_tono);
              push("Diferenciador", b.diferenciador);
              push("Valores", b.valores_marca);
              push("Insights", b.insights);
              push("Benchmark", b.benchmark);
              push("Presupuesto de campaña (brief)", b.presupuesto_campana);
              if (lines.length) briefBlock = `\n\n### Contexto de marca\n${lines.join("\n")}\n`;
            }
          }
        }
      }
    } catch (err) {
      console.error("brief fetch failed", err);
    }

    const systemPrompt = `Eres un analista experto en publicidad digital y pacing presupuestario. 
Genera un diagnóstico de EXACTAMENTE 3 líneas enfocado en riesgo presupuestario.
- Línea 1: Nivel de riesgo (Crítico/Moderado/Bajo) y razón principal.
- Línea 2: Insight sobre la distribución del gasto o rendimiento (CTR, CPC).
- Línea 3: Recomendación accionable concreta.
Cuando exista contexto de marca, incorpóralo (tono, público, diferenciador) en el insight y la recomendación.
Sé directo, usa datos numéricos del contexto. Responde solo en español.
Al final, en una línea separada escribe SOLO una de estas etiquetas: [RIESGO_CRITICO] o [RIESGO_MODERADO] o [SIN_RIESGO]`;

    const userPrompt = `Datos de auditoría de campaña:
- Campaña: ${campaignData.campaignName}
- Plataforma: ${campaignData.platform || 'No especificada'}
- Presupuesto Aprobado: $${campaignData.presupuestoTotal}
- Gasto Actual: $${campaignData.gastoActual}
- Presupuesto Restante: $${campaignData.presupuestoRestante}
- Días Transcurridos: ${campaignData.diasTranscurridos}
- Días Restantes: ${campaignData.diasRestantes}
- Pacing: ${campaignData.pacingStatus} (${campaignData.pacingPct > 0 ? '+' : ''}${campaignData.pacingPct}%)
- Gasto Diario Actual: $${campaignData.gastoDiarioActual}
- Gasto Diario Ideal: $${campaignData.presupuestoDiarioIdeal}
- CTR Promedio: ${campaignData.ctr}%
- CPC Promedio: $${campaignData.cpc}
- Impressiones: ${campaignData.impressions}
- Clicks: ${campaignData.clicks}
- Reach: ${campaignData.reach}
${briefBlock}
Genera el diagnóstico de 3 líneas + etiqueta de riesgo.`;

    const ai = await openaiChat({
      system: systemPrompt,
      user: userPrompt,
      model: "gpt-4o-mini",
      maxTokens: 500,
      temperature: 0.4,
    });
    if (ai.error) {
      if (ai.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intenta de nuevo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI service error");
    }
    const content = ai.text || "";

    let riskLevel: "critical" | "moderate" | "none" = "none";
    if (content.includes("[RIESGO_CRITICO]")) riskLevel = "critical";
    else if (content.includes("[RIESGO_MODERADO]")) riskLevel = "moderate";

    const insight = content
      .replace(/\[RIESGO_CRITICO\]/g, "")
      .replace(/\[RIESGO_MODERADO\]/g, "")
      .replace(/\[SIN_RIESGO\]/g, "")
      .trim();

    return new Response(JSON.stringify({ insight, riskLevel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audit-insight error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
