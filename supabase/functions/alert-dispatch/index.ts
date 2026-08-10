// Single source of truth for sending pacing alerts, replacing the old
// send-alert-email endpoint. Two entry points:
//
// 1. Manual ("Send now" in AlertsPage): POST with a valid user JWT and no
//    `cronSecret` — computes and sends alerts for that one user only,
//    ignoring the alert_events cooldown (an explicit user action).
// 2. Scheduled (pg_cron, daily): POST with header `x-cron-secret` matching
//    the CRON_SECRET function secret — loops every user with
//    alert_settings.enabled = true whose notify_frequency is due today,
//    dedupes against alert_events (24h cooldown for daily, 7d for weekly),
//    and updates alert_settings.last_sent_at.
//
// Both paths funnel through the same alert-engine + notify.ts dispatcher,
// so there is exactly one implementation of "what counts as an alert" and
// "how it gets delivered".
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import {
  generateAlerts,
  DEFAULT_ALERT_THRESHOLDS,
  ALERT_THRESHOLD_FIELDS,
  ALERT_TYPE_LABELS,
  type AlertThresholds,
  type AlertType,
  type AlertCampaignRow,
} from '../_shared/alert-engine.ts';
import { calculateAuditMetrics } from '../_shared/audit-calculations.ts';
import { dispatchAlerts, type NotifyAlert } from '../_shared/notify.ts';
import { chatCompletion } from '../_shared/openai.ts';

// Short narrative summary on top of the raw alert table — reuses the same
// OpenAI helper as audit-insight/weekly-report/metrics-ai-analysis. Best
// effort: any failure (missing key, rate limit) just omits the summary,
// the alert table itself is still sent.
async function generateInsightSummary(alerts: NotifyAlert[]): Promise<string | undefined> {
  if (alerts.length === 0) return undefined;
  const byType = new Map<string, number>();
  for (const a of alerts) byType.set(a.alertType, (byType.get(a.alertType) ?? 0) + 1);
  const breakdown = Array.from(byType.entries()).map(([type, n]) => `${n}× ${ALERT_TYPE_LABELS[type as AlertType] ?? type}`).join(', ');
  const criticalCampaigns = alerts.filter(a => a.level === 'critical').map(a => a.campaign).slice(0, 5);

  const result = await chatCompletion({
    model: 'gpt-4o-mini',
    maxTokens: 200,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content: 'You are a paid-media account lead writing a 2-3 sentence priority summary for a pacing alert digest. ' +
          'Be direct and specific: say what needs attention first and why, in plain language a client-facing manager can act on immediately. No fluff, no markdown.',
      },
      {
        role: 'user',
        content: `Alert breakdown: ${breakdown}.\nCampaigns with critical alerts: ${criticalCampaigns.join(', ') || 'none'}.\nWrite the priority summary.`,
      },
    ],
  });
  return result.ok ? result.content.trim() : undefined;
}

const ALL_ALERT_TYPES = Object.keys(ALERT_THRESHOLD_FIELDS) as AlertType[];
const COOLDOWN_MS = { daily: 24 * 60 * 60 * 1000, weekly: 7 * 24 * 60 * 60 * 1000 } as const;

function getConsolidationCutoff(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function loadUserThresholds(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase.from('alert_rules').select('*').eq('user_id', userId);
  const byType = new Map((data || []).map((r: any) => [r.rule_type as AlertType, r]));
  const thresholds: AlertThresholds = { ...DEFAULT_ALERT_THRESHOLDS };
  const enabledTypes = new Set<AlertType>();
  for (const type of ALL_ALERT_TYPES) {
    const row = byType.get(type);
    const fields = ALERT_THRESHOLD_FIELDS[type];
    (thresholds as any)[fields.primary] = row?.threshold != null ? Number(row.threshold) : DEFAULT_ALERT_THRESHOLDS[fields.primary];
    if (fields.secondary) {
      (thresholds as any)[fields.secondary] = row?.secondary_threshold != null
        ? Number(row.secondary_threshold)
        : DEFAULT_ALERT_THRESHOLDS[fields.secondary];
    }
    if (row?.enabled ?? true) enabledTypes.add(type);
  }
  return { thresholds, enabledTypes };
}

// Computes NotifyAlert[] for one user from their audit_records + meta_datos.
async function computeUserAlerts(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ alerts: NotifyAlert[]; criticalCount: number; warningCount: number; onlyCritical: boolean }> {
  const [{ data: clients }, { data: records }, { data: metaRows }, { thresholds, enabledTypes }] = await Promise.all([
    supabase.from('audit_clients').select('id, name').eq('user_id', userId),
    supabase.from('audit_records').select('*').eq('user_id', userId),
    supabase.from('meta_datos').select('*'),
    loadUserThresholds(supabase, userId),
  ]);

  const clientName = new Map((clients || []).map((c: any) => [c.id, c.name]));
  const cutoff = getConsolidationCutoff();
  const notifyAlerts: NotifyAlert[] = [];

  for (const rec of records || []) {
    const effectiveEnd = rec.fecha_fin < cutoff ? rec.fecha_fin : cutoff;
    const campaignRows = (metaRows || []).filter((r: any) =>
      r.campaign_name === rec.campaign_name && r.fecha >= rec.fecha_inicio && r.fecha <= effectiveEnd);
    const campaignApiData: AlertCampaignRow[] = campaignRows.map((r: any) => ({
      date: r.fecha,
      metrics: { cost: Number(r.total_cost) || 0, clicks: Number(r.clicks) || 0, impressions: Number(r.impressions) || 0, frequency: r.frequency },
    }));
    const cost = campaignApiData.reduce((s, r) => s + (isNaN(r.metrics.cost) ? 0 : r.metrics.cost), 0);
    const metrics = calculateAuditMetrics(Number(rec.presupuesto_total), rec.fecha_inicio, rec.fecha_fin, rec.tipo_calendario, cost);
    const alerts = generateAlerts(metrics, campaignApiData, thresholds, enabledTypes);
    if (alerts.length === 0) continue;

    const first = campaignRows[0];
    for (const alert of alerts) {
      notifyAlerts.push({
        campaign: rec.campaign_name,
        account: `${clientName.get(rec.client_id) || '—'} · ${first?.account_name || rec.account_id || ''}`,
        platform: first?.plataforma ?? rec.platform ?? null,
        level: alert.severity === 'danger' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'ok',
        spend: metrics.gastoActual,
        budget: Number(rec.presupuesto_total),
        spendPct: +metrics.porcentajeGastado.toFixed(1),
        timePct: +metrics.porcentajeTiempo.toFixed(1),
        deviation: +(metrics.porcentajeGastado - metrics.porcentajeTiempo).toFixed(1),
        message: `${ALERT_TYPE_LABELS[alert.type]}: ${alert.message}`,
        alertType: alert.type,
      });
    }
  }

  const { data: settings } = await supabase.from('alert_settings').select('only_critical').eq('user_id', userId).maybeSingle();
  const onlyCritical = settings?.only_critical ?? false;

  return {
    alerts: notifyAlerts,
    criticalCount: notifyAlerts.filter(a => a.level === 'critical').length,
    warningCount: notifyAlerts.filter(a => a.level === 'warning').length,
    onlyCritical,
  };
}

async function filterByCooldown(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  alerts: NotifyAlert[],
  frequency: 'daily' | 'weekly' | 'manual',
  bypassCooldown: boolean,
): Promise<NotifyAlert[]> {
  if (bypassCooldown || alerts.length === 0) return alerts;
  const cooldownMs = COOLDOWN_MS[frequency === 'weekly' ? 'weekly' : 'daily'];
  const now = Date.now();

  const { data: events } = await supabase
    .from('alert_events')
    .select('campaign_name, alert_type, last_triggered_at')
    .eq('user_id', userId);
  const lastTriggered = new Map((events || []).map((e: any) => [`${e.campaign_name}::${e.alert_type}`, new Date(e.last_triggered_at).getTime()]));

  const due = alerts.filter(a => {
    const last = lastTriggered.get(`${a.campaign}::${a.alertType}`);
    return !last || now - last >= cooldownMs;
  });

  if (due.length > 0) {
    const upserts = due.map(a => ({ user_id: userId, campaign_name: a.campaign, alert_type: a.alertType, last_triggered_at: new Date().toISOString() }));
    await supabase.from('alert_events').upsert(upserts, { onConflict: 'user_id,campaign_name,alert_type' });
  }
  return due;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
    // Same CRON_SECRET / x-cron-secret convention already used by
    // weekly-report — one secret authenticates every cron-triggered
    // Edge Function call in this project.
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const cronSecretHeader = req.headers.get('x-cron-secret');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const isCronRun = bearer === serviceRoleKey || (!!cronSecret && cronSecretHeader === cronSecret);

    let targetUserId: string | null = null;
    let manual = false;

    if (!isCronRun) {
      // Manual run — require a real logged-in user, scope to them only.
      if (!bearer) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
      const { data: userData, error: userErr } = await authClient.auth.getUser(bearer);
      if (userErr || !userData.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      targetUserId = userData.user.id;
      manual = true;
    }

    const results: Record<string, unknown> = {};
    const today = new Date();
    const isMonday = today.getUTCDay() === 1;

    let userIds: string[];
    if (manual && targetUserId) {
      userIds = [targetUserId];
    } else {
      const { data: allSettings } = await serviceClient.from('alert_settings').select('user_id, enabled, notify_frequency');
      userIds = (allSettings || [])
        .filter((s: any) => s.enabled && (s.notify_frequency === 'daily' || (s.notify_frequency === 'weekly' && isMonday)))
        .map((s: any) => s.user_id);
    }

    for (const userId of userIds) {
      const { alerts, criticalCount, warningCount, onlyCritical } = await computeUserAlerts(serviceClient, userId);
      const pool = onlyCritical ? alerts.filter(a => a.level === 'critical') : alerts.filter(a => a.level !== 'ok');

      let toSend = pool;
      if (!manual) {
        const { data: settingsRow } = await serviceClient.from('alert_settings').select('notify_frequency').eq('user_id', userId).maybeSingle();
        const frequency = (settingsRow?.notify_frequency ?? 'daily') as 'daily' | 'weekly' | 'manual';
        toSend = await filterByCooldown(serviceClient, userId, pool, frequency, false);
      }

      if (toSend.length === 0) { results[userId] = { sent: 0 }; continue; }

      const summary = await generateInsightSummary(toSend).catch(() => undefined);
      const dispatchResults = await dispatchAlerts({
        supabaseUrl: Deno.env.get('SUPABASE_URL')!,
        serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        userId,
        alerts: toSend,
        summary,
      });
      await serviceClient.from('alert_settings').update({ last_sent_at: new Date().toISOString() }).eq('user_id', userId);
      results[userId] = { sent: toSend.length, criticalCount, warningCount, channels: dispatchResults };
    }

    return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('alert-dispatch error:', e);
    return new Response(JSON.stringify({ error: 'internal', message: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
