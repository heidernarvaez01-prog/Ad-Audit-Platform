import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { campaignData } = await req.json();

    const systemPrompt = `Eres un analista experto en publicidad digital y pacing presupuestario. 
Genera un diagnóstico de EXACTAMENTE 3 líneas enfocado en riesgo presupuestario.
- Línea 1: Nivel de riesgo (Crítico/Moderado/Bajo) y razón principal.
- Línea 2: Insight sobre la distribución del gasto o rendimiento (CTR, CPC).
- Línea 3: Recomendación accionable concreta.
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

Genera el diagnóstico de 3 líneas + etiqueta de riesgo.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intenta de nuevo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Agrega fondos en Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract risk level from tag
    let riskLevel: "critical" | "moderate" | "none" = "none";
    if (content.includes("[RIESGO_CRITICO]")) riskLevel = "critical";
    else if (content.includes("[RIESGO_MODERADO]")) riskLevel = "moderate";

    // Clean the insight text (remove the tag line)
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
