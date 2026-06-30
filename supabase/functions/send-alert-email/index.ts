import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

const AlertSchema = z.object({
  campaign: z.string(),
  account: z.string().optional().default(''),
  platform: z.string().nullable().optional(),
  level: z.enum(['critical', 'warning', 'ok']),
  spend: z.number(),
  budget: z.number(),
  spendPct: z.number(),
  timePct: z.number(),
  deviation: z.number(),
  message: z.string(),
});

const BodySchema = z.object({
  to: z.array(z.string().email()).min(1).max(20),
  subject: z.string().min(1).max(200).optional(),
  alerts: z.array(AlertSchema).max(200),
  criticalCount: z.number().int().nonnegative().optional(),
  warningCount: z.number().int().nonnegative().optional(),
});

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function renderHtml(alerts: z.infer<typeof AlertSchema>[], criticalCount: number, warningCount: number) {
  const rows = alerts
    .map((a) => {
      const color = a.level === 'critical' ? '#dc2626' : a.level === 'warning' ? '#d97706' : '#059669';
      const tag = a.level === 'critical' ? 'CRÍTICA' : a.level === 'warning' ? 'ADVERTENCIA' : 'EN LÍNEA';
      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-weight:600;color:#111827;font-size:14px;">${escapeHtml(a.campaign)}</div>
            <div style="color:#6b7280;font-size:12px;margin-top:2px;">${escapeHtml(a.account)}${a.platform ? ' · ' + escapeHtml(a.platform) : ''}</div>
            <div style="margin-top:6px;font-size:12px;color:#374151;">${escapeHtml(a.message)}</div>
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;font-size:12px;color:#374151;white-space:nowrap;">
            <span style="display:inline-block;background:${color};color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;letter-spacing:0.3px;">${tag}</span>
            <div style="margin-top:6px;font-family:'JetBrains Mono',monospace;">${fmtMoney(a.spend)} / ${fmtMoney(a.budget)}</div>
            <div style="margin-top:2px;color:#6b7280;">${a.spendPct}% gasto · ${a.timePct}% tiempo</div>
          </td>
        </tr>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Alertas de pacing</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Apache Studio · Ad Audit</div>
          <h1 style="margin:6px 0 0;font-size:20px;color:#111827;">Alertas de pacing activas</h1>
        </td></tr>
        <tr><td style="padding:18px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:12px;background:#fef2f2;border-radius:8px;text-align:center;">
                <div style="font-size:24px;font-weight:700;color:#dc2626;">${criticalCount}</div>
                <div style="font-size:11px;color:#7f1d1d;text-transform:uppercase;letter-spacing:0.5px;">Críticas</div>
              </td>
              <td style="width:12px;"></td>
              <td style="padding:12px;background:#fffbeb;border-radius:8px;text-align:center;">
                <div style="font-size:24px;font-weight:700;color:#d97706;">${warningCount}</div>
                <div style="font-size:11px;color:#78350f;text-transform:uppercase;letter-spacing:0.5px;">Advertencias</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            ${rows || '<tr><td style="padding:24px;text-align:center;color:#6b7280;font-size:13px;">No hay alertas para mostrar.</td></tr>'}
          </table>
          <p style="margin-top:18px;font-size:12px;color:#6b7280;">Este reporte se generó automáticamente desde tu panel de auditoría.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { to, subject, alerts } = parsed.data;
    const criticalCount = parsed.data.criticalCount ?? alerts.filter((a) => a.level === 'critical').length;
    const warningCount = parsed.data.warningCount ?? alerts.filter((a) => a.level === 'warning').length;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Resend not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = renderHtml(alerts, criticalCount, warningCount);
    const finalSubject = subject ?? `Alertas de pacing: ${criticalCount} críticas · ${warningCount} advertencias`;

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'Apache Studio Ad Audit <alertas@apachestudio.mx>',
        to,
        subject: finalSubject,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'resend_failed', status: res.status, details: data }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id ?? null }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'internal', message: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
