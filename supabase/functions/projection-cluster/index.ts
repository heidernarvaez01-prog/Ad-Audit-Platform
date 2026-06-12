import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// La Fórmula V2 — instructions for the AI (the briefing itself comes from the
// client's Brand Brief stored in the app, campaign data is secondary support)
const FORMULA_INSTRUCTIONS = `Actúa como un Estratega Senior de Marca 2026, Creatividad y Paid Media especializado en el mercado específico que aclare la estrategia. Tu trabajo es construir una estrategia de marca completa, ejecutable y derivada de una base conceptual sólida, usando exclusivamente la información que el cliente ha entregado (su briefing), potenciada con su data de campañas en tiempo real como foco secundario.

PROCESO DE ANÁLISIS (lineal y secuencial):
1. Analiza toda la información del cliente a profundidad. Únicamente usando la información puntual dada por el cliente, construye las bases de la estructura llamada "La Fórmula": una arquitectura estratégica lineal que genera inputs, puntos clave y hallazgos para estrategias conscientes, ideas y tácticas de real utilidad.
2. El flujo empieza desde un pilar estratégico: el insight que responde al brief. Plantéate los 10 insights más relevantes, útiles y reales, NO cliché; unos situacionales, otros del mercado y otros de la audiencia. Presenta los diez como evidencia y selecciona el mejor, el más aprovechable y ejecutable — de ese se deriva toda la estructura.
3. Con el insight, genera un concepto estratégico que funcione como punto de partida racional y ejecutivo. No es algo comercial: es la estrategia central (volvernos famosos de tal manera, crecer en ventas de tal manera), derivada también del problema del cliente.
4. Desde el insight y el concepto estratégico, genera un objetivo general SMART y 3 específicos SMART, respondiendo las problemáticas del cliente y conectando con audiencias y necesidades.
5. Construye los públicos objetivos: descripción detallada + buyer persona directo, con perfil de consumo y comportamiento según el funnel de ventas y mapa de empatía.
6. Genera la estructura de marca: reasons why y reasons to believe, propuestas de valor, valores, pains & gains y diferenciales clave de la categoría y de la audiencia.
7. Crea un concepto creativo impactante, llamativo, humano, diferente y relevante, memorable desde la emoción que elijas, con un par de copys centrales y slogan de campaña.
8. Crea un plan táctico 360° priorizando digital: qué conviene según el presupuesto del cliente (Meta Ads, Google Ads, mix, TikTok, radio/TV, activaciones, email marketing, venta directa, etc.) con presupuesto estimado por canal.
9. Crea una parrilla de contenido con 20 creativos finalizados: 8 videos, 7 estáticas y 5 carruseles. De estas piezas: 7 de promoción para pauta (estacional, always-on o lo que recomiendes), 9 de social media para captar y cerrar, y 4 de campañas específicas. Incluye además la descripción detallada de una imagen central de campaña (mockup creativo e ilustrado usando el concepto y taglines) como referencia visual escrita para el equipo de diseño.
10. Plan SEO para Google Ads y web: cluster final de keywords en 4 categorías de intención (transaccional, navegacional, emocional, informacional), 15 headlines de 25-30 caracteres y 15 descripciones de 75-90 caracteres para Google Ads, más slogans de marca usables off y online.
11. Benchmark comparativo en tres partes: 10 competidores directos y 10 adyacentes con explicación y URL; benchmark SEM con aproximados del año pasado para PPC de keywords relevantes (volumen y competición); y benchmark de mercado con costos generales CPC y de adquisición.
12. Big Ideas: 5 ideas locas pero increíblemente viralizables (unas sin tanto presupuesto, otras con algo), todas potenciando las campañas actuales y los conceptos desarrollados. Elige una y muestra cómo se verían sus titulares de periódico para evaluar su potencial de fama.
13. Resumen ejecutivo: los puntos principales a ejecutar cuanto antes, entendible para clientes, no para marketers.
14. Cierra con una frase inspiracional, inteligente y hermosa.

NOTAS CRÍTICAS:
- Usa la data en tiempo real de las campañas actuales de paid media SOLO como foco secundario: para potenciar y aterrizar la información del briefing, nunca como centro del análisis.
- Idioma del resultado: Español.
- Cada sección debe responderse A FONDO, sin relleno ni clichés. Calidad de agencia premium.`;

// The 15 deliverable sections, in exact order
const SECTION_SPECS = [
  '1. Contexto & Problemas a Resolver — problemas principales del brief y territorio de trabajo de la estrategia.',
  '2. Insights & Pilares Estratégicos — los 10 insights numerados por categoría (audiencia/situacionales/mercado) y el seleccionado destacado con la clase .iw.',
  '3. Objetivos SMART — objetivo general + 3 específicos con métricas, tiempos y conexión con los problemas. Usa .kpi-row para métricas clave.',
  '4. Audiencias & Buyer Personas — usa .persona con .persona-header, .persona-avatar (iniciales), .empathy con .emp-box para el mapa de empatía, y comportamiento según funnel.',
  '5. Estructura de Marca — pains & gains, reasons why/to believe, propuestas de valor. Usa .g2/.g3 con .card.',
  '6. Benchmark Competitivo — tablas .tbl: 10 competidores directos + 10 adyacentes con URL y explicación, benchmark SEM (keywords, volumen, competición, CPC aprox) y costos de mercado.',
  '7. Concepto Estratégico — el concepto racional central con .callout para la declaración principal.',
  '8. Concepto Creativo — nombre del concepto, universo visual, ejecución clave, frase central y copys principales. Usa .callout y .card.',
  '9. Plan Táctico 360° — mix de medios con presupuesto por canal usando .budget-row/.budget-bar/.budget-fill (el width:% refleja la proporción) y total recomendado.',
  '10. Slogans & Taglines — tagline principal + 10 slogans situacionales con .sl/.sl-num/.sl-text/.sl-ctx.',
  '11. Parrilla de Contenido — 20 piezas con .cg/.cg-item: .cg-type (VIDEO/ESTÁTICA/CARRUSEL), .cg-name, .cg-desc y .tag (tag-pauta=7 pauta, tag-organic=9 social, tag-camp=4 campañas). Cierra con la descripción detallada de la imagen central de campaña (mockup escrito) en un .callout.',
  '12. SEO + Google Ads — cluster de keywords en 4 tablas .tbl por intención, 15 headlines con .hl-item/.hl-num/.hl-text/.hl-chars (mostrar conteo de caracteres) y 15 descripciones igual.',
  '13. Big Ideas — 5 ideas con .bi/.bi-name/.bi-desc, la ganadora con .bi-winner, y sus titulares de periódico simulados.',
  '14. Resumen Ejecutivo — pasos accionables con .step/.step-num/.step-content, lenguaje para clientes.',
  '15. Cierre — usa .cierre con .cierre-quote (la frase inspiracional) y .cierre-firma.',
];

const OUTPUT_FORMAT = `FORMATO DE SALIDA (OBLIGATORIO, sin desviaciones):
Tu respuesta se inyecta en una plantilla HTML premium ya existente. NO generes <html>, <head>, <style> ni <script>. Genera ÚNICAMENTE:

1) Primero la línea ===HERO=== seguida de un JSON en una sola línea:
{"eye":"La Fórmula™ · Estrategia de Marca 2026","title":"<nombre de la marca>","sub":"Estrategia completa · <mercado>","meta":[{"strong":"<dato>","label":"<etiqueta>"} x5]}
(los 5 meta: producto estrella, mercado principal, presupuesto mensual, segmento objetivo, y "15 Puntos" / "La Fórmula completa")

2) Luego las 15 secciones, cada una precedida EXACTAMENTE por su delimitador en línea propia: ===SECTION 1=== hasta ===SECTION 15===.

Cada sección empieza con:
<div class="sh"><div class="sh-num">Punto NN</div><h2 class="sh-title">TÍTULO</h2></div>
<div class="body"> ...contenido... </div>

CLASES CSS DISPONIBLES (únicas permitidas, no inventes estilos inline salvo width:% en .budget-fill):
- Texto: h3, h4, p, ul, ol, li, strong, em dentro de .body
- .callout > .callout-lbl + p (destacado oscuro)
- .iw > p (insight seleccionado, premium)
- .g2 / .g3 > .card > .card-t + .card-b (grids de tarjetas)
- .tbl > thead th / tbody td (tablas)
- .sl > .sl-num + div(.sl-text + .sl-ctx) (lista de slogans)
- .cg > .cg-item > .cg-type + .cg-name + .cg-desc + .tag.tag-pauta|.tag-organic|.tag-camp (parrilla)
- .bi > .bi-name + .bi-desc, ganadora añade .bi-winner (big ideas)
- .hl-item > .hl-num + div(.hl-text + .hl-chars) (headlines/descripciones ads)
- .kpi-row > .kpi > .kpi-val + .kpi-lbl (métricas)
- .persona > .persona-header(.persona-avatar + div(.persona-name + .persona-sub)) + contenido + .empathy > .emp-box > .emp-lbl + .emp-txt
- .budget-row > .budget-label + .budget-bar > .budget-fill(style="width:N%") + .budget-val
- .step > .step-num + .step-content(h4 + p) (resumen)
- .cierre > .cierre-quote + .cierre-firma (solo sección 15)

CONTENIDO DE CADA SECCIÓN:
${SECTION_SPECS.join("\n")}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTROPHIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!ANTHROPIC_API_KEY) throw new Error("ANTROPHIC_API_KEY missing");

    // Validate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Unauthorized", 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) return jsonError("Unauthorized", 401);
    const userId = userData.user.id;

    const { clientId } = await req.json();
    if (!clientId || typeof clientId !== "string") return jsonError("clientId is required", 400);

    // Client must belong to the user — audits/briefs/clusters never mix
    const { data: client } = await supabase
      .from("audit_clients")
      .select("id, name, description, user_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client || client.user_id !== userId) return jsonError("Client not found", 404);

    // Brand brief is the PRIMARY input of the cluster
    const { data: brief } = await supabase
      .from("brand_briefs")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    const briefFields = brief
      ? Object.fromEntries(
          Object.entries(brief).filter(([k, v]) =>
            !["id", "user_id", "client_id", "account_id", "created_at", "updated_at"].includes(k) &&
            v !== null && v !== "",
          ),
        )
      : {};
    if (Object.keys(briefFields).length < 3) {
      return jsonError(
        "The Brand Brief for this client is empty or too short. Complete it first — the cluster is built from the briefing.",
        400,
      );
    }

    // Real-time campaign activity for THIS client only (secondary input)
    const { data: audits } = await supabase
      .from("audit_records")
      .select("account_id, campaign_name, platform, presupuesto_total, fecha_inicio, fecha_fin")
      .eq("client_id", clientId);

    const campaignNames = Array.from(new Set((audits ?? []).map((a) => a.campaign_name).filter(Boolean)));
    let metrics: any[] = [];
    if (campaignNames.length) {
      const { data } = await supabase
        .from("meta_datos")
        .select("campaign_name, adset_name, plataforma, fecha, total_cost, impressions, clicks, reach, ctr_all, cpc, cpm, objective")
        .in("campaign_name", campaignNames)
        .order("fecha", { ascending: false })
        .limit(600);
      metrics = data ?? [];
    }

    const byCampaign = new Map<string, any>();
    for (const m of metrics) {
      const k = m.campaign_name;
      const cur = byCampaign.get(k) ?? { campaign: k, platform: m.plataforma, cost: 0, impressions: 0, clicks: 0, reach: 0, days: 0 };
      cur.cost += Number(m.total_cost ?? 0);
      cur.impressions += Number(m.impressions ?? 0);
      cur.clicks += Number(m.clicks ?? 0);
      cur.reach += Number(m.reach ?? 0);
      cur.days += 1;
      byCampaign.set(k, cur);
    }
    const campaignSummary = Array.from(byCampaign.values()).map((c) => ({
      ...c,
      ctr: c.impressions ? +(100 * c.clicks / c.impressions).toFixed(2) : 0,
      cpc: c.clicks ? +(c.cost / c.clicks).toFixed(2) : 0,
      cpm: c.impressions ? +(1000 * c.cost / c.impressions).toFixed(2) : 0,
    }));

    const userPrompt = `CLIENTE: ${client.name}${client.description ? ` — ${client.description}` : ""}

BRIEFING DEL CLIENTE (fuente principal y centro de toda la estrategia):
\`\`\`json
${JSON.stringify(briefFields, null, 2)}
\`\`\`

ACTIVIDAD DE PAID MEDIA EN TIEMPO REAL (foco secundario, solo para potenciar y aterrizar):
\`\`\`json
${JSON.stringify({ auditedCampaigns: audits ?? [], performance: campaignSummary }, null, 2)}
\`\`\`

Construye La Fórmula completa para este cliente siguiendo el proceso y el formato de salida al pie de la letra.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 32000,
        stream: true,
        system: `${FORMULA_INSTRUCTIONS}\n\n${OUTPUT_FORMAT}`,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (aiRes.status === 429) return jsonError("AI rate limit reached. Try again in a few seconds.", 429);
    if (!aiRes.ok || !aiRes.body) {
      const t = await aiRes.text();
      console.error("Anthropic error", aiRes.status, t);
      return jsonError("AI service error", 500);
    }

    // Pass the Anthropic SSE stream straight through to the browser
    return new Response(aiRes.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
