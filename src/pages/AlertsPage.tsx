import { useEffect, useMemo, useState } from 'react';
import { Bell, Mail, Plus, X, Save, AlertTriangle, AlertCircle, Info, Loader2, Send, CheckCircle2, ChevronDown, SlidersHorizontal, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHero from '@/components/PageHero';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAlertThresholds, type UserAlertRule } from '@/hooks/useAlertThresholds';
import { useNotificationChannels } from '@/hooks/useNotificationChannels';
import { fetchCampaignData } from '@/lib/api';
import { buildAuditRows } from '@/lib/audit-helpers';
import { ALERT_TYPE_LABELS, type AuditAlert, type AlertType } from '@/lib/audit-alerts';
import { toast } from '@/hooks/use-toast';

// What each rule does, for the toggle list
const ALERT_TYPE_DESC: Record<AlertType, string> = {
  OVERSPEND_50: 'Spending N%+ above what was expected by today.',
  NOT_SPENDING: 'An active campaign stopped delivering (no spend in N consolidated days).',
  ENDING_SOON: 'Campaign is N%+ through its schedule — plan renewal/closing.',
  COST_SPIKE: 'CPC or CPM jumped more than N% vs the previous week.',
  BUDGET_EARLY_DEPLETION: 'At the current pace the budget runs out N+ days before the end date.',
  CREATIVE_FATIGUE: 'Frequency above N + CTR falling more than M% — time to rotate creatives.',
};
// Threshold input(s) shown per rule: label + unit for the primary number,
// and an optional secondary number (only CREATIVE_FATIGUE has one today).
const ALERT_TYPE_THRESHOLD_UI: Record<AlertType, { label: string; unit: string; secondaryLabel?: string; secondaryUnit?: string }> = {
  OVERSPEND_50: { label: 'Overspend threshold', unit: '% above expected' },
  NOT_SPENDING: { label: 'No-spend window', unit: 'consolidated days' },
  ENDING_SOON: { label: 'Ending-soon threshold', unit: '% through schedule' },
  COST_SPIKE: { label: 'Cost spike threshold', unit: '% CPC/CPM increase' },
  BUDGET_EARLY_DEPLETION: { label: 'Early-depletion threshold', unit: 'days early' },
  CREATIVE_FATIGUE: { label: 'Min. frequency', unit: 'freq.', secondaryLabel: 'CTR drop threshold', secondaryUnit: '% CTR drop' },
};
const ALL_ALERT_TYPES = Object.keys(ALERT_TYPE_LABELS) as AlertType[];

interface AlertSettings {
  enabled: boolean;
  only_critical: boolean;
  notify_frequency: 'daily' | 'weekly' | 'manual';
}

interface CampaignAlert {
  clientName: string;
  campaign: string;
  account: string;
  platform: string | null;
  alert: AuditAlert;
  spend: number;
  budget: number;
  spendPct: number;
  timePct: number;
}

const DEFAULT_SETTINGS: AlertSettings = {
  enabled: true,
  only_critical: false,
  notify_frequency: 'daily',
};

export default function AlertsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS);
  const [alerts, setAlerts] = useState<CampaignAlert[]>([]);
  const [healthyCount, setHealthyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Per-rule enable + editable threshold, synced to Supabase (alert_rules) —
  // replaces the old localStorage-only on/off toggle.
  const { rules, thresholds, enabledTypes, loading: rulesLoading, saveRule } = useAlertThresholds();
  const [savingRule, setSavingRule] = useState<AlertType | null>(null);

  const updateRuleField = async (rule: UserAlertRule, patch: Partial<UserAlertRule>) => {
    setSavingRule(rule.type);
    const { error } = await saveRule({ ...rule, ...patch });
    setSavingRule(null);
    if (error) toast({ title: 'Error saving rule', description: error.message, variant: 'destructive' });
  };

  // Delivery channels — email, Slack, generic webhook (in-app is always on,
  // it just writes to the notification bell). WhatsApp will join this list
  // once a provider is chosen; the schema already supports it.
  const { getChannel, saveChannel } = useNotificationChannels();
  const [emailInput, setEmailInput] = useState('');
  const [slackUrlInput, setSlackUrlInput] = useState('');
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [savingChannel, setSavingChannel] = useState<string | null>(null);
  const emailChannel = getChannel('email');
  const emailRecipients = (emailChannel.config.recipients as string[]) ?? [];
  const slackChannel = getChannel('slack_webhook');
  const webhookChannel = getChannel('generic_webhook');

  const persistChannel = async (
    type: 'email' | 'slack_webhook' | 'generic_webhook' | 'in_app',
    config: Record<string, unknown>,
    enabled: boolean,
  ) => {
    setSavingChannel(type);
    const current = getChannel(type);
    const { error } = await saveChannel({ ...current, channel_type: type, config, enabled });
    setSavingChannel(null);
    if (error) toast({ title: 'Error saving channel', description: error.message, variant: 'destructive' });
  };

  const addEmailRecipient = () => {
    const e = emailInput.trim();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast({ title: 'Invalid email', variant: 'destructive' }); return; }
    if (emailRecipients.includes(e)) return;
    persistChannel('email', { recipients: [...emailRecipients, e] }, true);
    setEmailInput('');
  };
  const removeEmailRecipient = (e: string) =>
    persistChannel('email', { recipients: emailRecipients.filter(x => x !== e) }, emailChannel.enabled);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      // Load settings
      const { data: cfg } = await supabase.from('alert_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (cfg) {
        setSettings({
          enabled: cfg.enabled,
          only_critical: cfg.only_critical,
          notify_frequency: cfg.notify_frequency as AlertSettings['notify_frequency'],
        });
      }

      // Compute alerts with the same engine as the audit matrix — per client,
      // using this user's configured thresholds (all 6 rule types are always
      // computed here; disabled rules are filtered out below so the
      // "Healthy" count still reflects the campaign's true state).
      const [{ data: clients }, { data: records }, apiData] = await Promise.all([
        supabase.from('audit_clients').select('id, name'),
        supabase.from('audit_records').select('*'),
        fetchCampaignData().catch(() => []),
      ]);
      const clientName = new Map((clients || []).map(c => [c.id, c.name]));
      const rows = buildAuditRows(records || [], apiData, thresholds);

      const computed: CampaignAlert[] = [];
      let healthy = 0;
      for (const row of rows) {
        if (row.alerts.length === 0) { healthy += 1; continue; }
        for (const alert of row.alerts) {
          computed.push({
            clientName: clientName.get((row as any).client_id) || '—',
            campaign: row.campaign_name,
            account: row.campaignApiData[0]?.account_name || row.account_id,
            platform: row.platform ?? null,
            alert,
            spend: row.metrics.gastoActual,
            budget: row.presupuesto_total,
            spendPct: +row.metrics.porcentajeGastado.toFixed(1),
            timePct: +row.metrics.porcentajeTiempo.toFixed(1),
          });
        }
      }
      const order = { danger: 0, warning: 1, info: 2 } as const;
      computed.sort((a, b) => order[a.alert.severity] - order[b.alert.severity]);
      setAlerts(computed);
      setHealthyCount(healthy);
      setLoading(false);
    })();
  }, [user, thresholds]);

  const [alertSearch, setAlertSearch] = useState('');

  // Only alerts whose rule is currently enabled
  const visibleAlerts = useMemo(
    () => alerts.filter(a => enabledTypes.has(a.alert.type)),
    [alerts, enabledTypes],
  );

  // ...further filtered by the client/campaign search box
  const searchedAlerts = useMemo(() => {
    const q = alertSearch.trim().toLowerCase();
    if (!q) return visibleAlerts;
    return visibleAlerts.filter(a =>
      a.clientName.toLowerCase().includes(q) ||
      a.campaign.toLowerCase().includes(q) ||
      a.account.toLowerCase().includes(q));
  }, [visibleAlerts, alertSearch]);

  const stats = useMemo(() => ({
    danger: visibleAlerts.filter(a => a.alert.severity === 'danger').length,
    warning: visibleAlerts.filter(a => a.alert.severity === 'warning').length,
    info: visibleAlerts.filter(a => a.alert.severity === 'info').length,
  }), [visibleAlerts]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('alert_settings').upsert(
      { user_id: user.id, ...settings },
      { onConflict: 'user_id' },
    );
    setSaving(false);
    if (error) toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    else toast({ title: 'Settings saved' });
  };

  const sendNow = async () => {
    if (!user) return;
    const pool = settings.only_critical
      ? visibleAlerts.filter(a => a.alert.severity === 'danger')
      : visibleAlerts.filter(a => a.alert.severity !== 'info');
    if (pool.length === 0) {
      toast({ title: 'Nothing to send — no active critical or warning alerts' });
      return;
    }
    // alert-dispatch recomputes the same alerts server-side and delivers
    // them through every enabled channel — no payload needed, just that
    // this is a manual run for the calling user (JWT attached by invoke()).
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('alert-dispatch', { body: {} });
      const userResult = data?.results ? (Object.values(data.results)[0] as any) : null;
      if (error || (data && (data as any).error)) {
        const msg = error?.message || (data as any)?.error || 'Unknown error';
        toast({ title: 'Error sending', description: String(msg), variant: 'destructive' });
      } else if (!userResult?.sent) {
        toast({ title: 'Nothing sent — check that at least one channel is enabled below' });
      } else {
        const channelList = (userResult.channels || []).map((c: any) => c.channel).join(', ');
        toast({ title: `Sent ${userResult.sent} alert(s) via ${channelList || 'no channels'}` });
      }
    } catch (e: any) {
      toast({ title: 'Error sending', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const severityIcon = (s: AuditAlert['severity']) =>
    s === 'danger' ? <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
    : s === 'warning' ? <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
    : <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHero
        icon={Bell}
        title="Alerts"
        subtitle="Only the alerts that matter: we flag a campaign when it overspends, stops delivering, is about to end, gets more expensive, or its creatives wear out. No noise."
        gradient="from-rose-600 via-orange-500 to-amber-500"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          icon={AlertCircle}
          label="Critical"
          value={stats.danger}
          gradient="from-rose-500 to-red-700"
          pulse={stats.danger > 0}
        />
        <StatTile
          icon={AlertTriangle}
          label="Warnings"
          value={stats.warning}
          gradient="from-amber-500 to-orange-600"
        />
        <StatTile
          icon={Info}
          label="Heads-up"
          value={stats.info}
          gradient="from-sky-500 to-blue-700"
        />
        <StatTile
          icon={CheckCircle2}
          label="Healthy"
          value={healthyCount}
          gradient="from-emerald-500 to-emerald-700"
        />
      </div>


      {/* Alert rules — enable/disable + editable thresholds, synced per user */}
      <Collapsible>
        <Card className="overflow-hidden">
          <CollapsibleTrigger className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
            <div className="flex items-center gap-2 min-w-0">
              <SlidersHorizontal className="h-4 w-4 text-primary shrink-0" />
              <div className="text-left">
                <h2 className="font-semibold text-sm">Alert rules</h2>
                <p className="text-xs text-muted-foreground">
                  {enabledTypes.size} of {ALL_ALERT_TYPES.length} active · thresholds sync to your account
                </p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-4 pt-1 divide-y divide-border">
              {rulesLoading ? (
                <div className="py-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading rules...
                </div>
              ) : rules.map((rule) => {
                const ui = ALERT_TYPE_THRESHOLD_UI[rule.type];
                return (
                  <div key={rule.type} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">{ALERT_TYPE_LABELS[rule.type]}</div>
                      <div className="text-xs text-muted-foreground">{ALERT_TYPE_DESC[rule.type]}</div>
                      {rule.enabled && (
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <div className="flex items-center gap-1.5">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">{ui.label}</Label>
                            <Input
                              type="number"
                              className="h-7 w-20 text-xs"
                              value={rule.threshold}
                              onChange={(e) => updateRuleField(rule, { threshold: Number(e.target.value) })}
                              disabled={savingRule === rule.type}
                            />
                            <span className="text-xs text-muted-foreground">{ui.unit}</span>
                          </div>
                          {ui.secondaryLabel && (
                            <div className="flex items-center gap-1.5">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">{ui.secondaryLabel}</Label>
                              <Input
                                type="number"
                                className="h-7 w-20 text-xs"
                                value={rule.secondaryThreshold ?? ''}
                                onChange={(e) => updateRuleField(rule, { secondaryThreshold: Number(e.target.value) })}
                                disabled={savingRule === rule.type}
                              />
                              <span className="text-xs text-muted-foreground">{ui.secondaryUnit}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) => updateRuleField(rule, { enabled: v })}
                      disabled={savingRule === rule.type}
                    />
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Delivery &amp; channels</h2>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
        <div className="px-5 pb-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label>Alerts enabled</Label>
            <p className="text-xs text-muted-foreground">Master switch — turns off every channel below.</p>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings({ ...settings, enabled: v })} />
        </div>

        {/* Email channel */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
            <Switch
              checked={emailChannel.enabled}
              onCheckedChange={(v) => persistChannel('email', emailChannel.config, v)}
              disabled={savingChannel === 'email'}
            />
          </div>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="someone@company.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmailRecipient(); } }}
            />
            <Button type="button" variant="secondary" onClick={addEmailRecipient}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {emailRecipients.map((e) => (
              <Badge key={e} variant="secondary" className="gap-1.5 pr-1">
                {e}
                <button onClick={() => removeEmailRecipient(e)} className="hover:bg-background rounded p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {emailRecipients.length === 0 && (
              <p className="text-xs text-muted-foreground">Add at least one email to receive alerts.</p>
            )}
          </div>
        </div>

        {/* Slack channel */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <Label>Slack (incoming webhook)</Label>
            <Switch
              checked={slackChannel.enabled}
              onCheckedChange={(v) => persistChannel('slack_webhook', slackChannel.config, v)}
              disabled={savingChannel === 'slack_webhook'}
            />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="https://hooks.slack.com/services/..."
              defaultValue={(slackChannel.config.webhook_url as string) ?? ''}
              onChange={(e) => setSlackUrlInput(e.target.value)}
              onBlur={() => slackUrlInput && persistChannel('slack_webhook', { webhook_url: slackUrlInput }, true)}
            />
          </div>
        </div>

        {/* Generic webhook channel */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <Label>Generic webhook</Label>
            <Switch
              checked={webhookChannel.enabled}
              onCheckedChange={(v) => persistChannel('generic_webhook', webhookChannel.config, v)}
              disabled={savingChannel === 'generic_webhook'}
            />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="https://your-endpoint.example.com/alerts"
              defaultValue={(webhookChannel.config.webhook_url as string) ?? ''}
              onChange={(e) => setWebhookUrlInput(e.target.value)}
              onBlur={() => webhookUrlInput && persistChannel('generic_webhook', { webhook_url: webhookUrlInput }, true)}
            />
          </div>
          <p className="text-xs text-muted-foreground">POSTs a JSON payload with the active alerts — build your own integration (WhatsApp, SMS, etc.) on top of this.</p>
        </div>

        {/* In-app is always available via the bell icon — no config needed */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> In-app notifications</Label>
            <p className="text-xs text-muted-foreground">Shown in the bell icon — no setup required.</p>
          </div>
          <Switch
            checked={getChannel('in_app').enabled}
            onCheckedChange={(v) => persistChannel('in_app', {}, v)}
            disabled={savingChannel === 'in_app'}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={settings.notify_frequency}
              onValueChange={(v: AlertSettings['notify_frequency']) => setSettings({ ...settings, notify_frequency: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="manual">Manual only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <Label>Critical only</Label>
              <p className="text-xs text-muted-foreground">Ignore warnings on every channel.</p>
            </div>
            <Switch checked={settings.only_critical} onCheckedChange={(v) => setSettings({ ...settings, only_critical: v })} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={sendNow} disabled={sending || loading || !settings.enabled}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send alerts now
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save settings
          </Button>
        </div>
        </div>
        </CollapsibleContent>
      </Card>
      </Collapsible>

      <Collapsible defaultOpen>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Active alerts ({searchedAlerts.length})</h2>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
        <div className="px-5 pb-5">
        {/* Client search */}
        {visibleAlerts.length > 0 && (
          <div className="relative max-w-sm mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input value={alertSearch} onChange={e => setAlertSearch(e.target.value)} placeholder="Search by client or campaign..." className="pl-9 h-9" />
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculating...
          </div>
        ) : searchedAlerts.length === 0 ? (
          <div className="text-center py-6 space-y-1">
            <CheckCircle2 className="h-7 w-7 text-success mx-auto" />
            <p className="text-sm text-foreground font-medium">
              {alertSearch ? `No alerts match "${alertSearch}"` : alerts.length > 0 ? 'No active alerts from enabled rules' : 'All campaigns are healthy'}
            </p>
            <p className="text-xs text-muted-foreground">
              {alertSearch ? 'Try another client or campaign.' : alerts.length > 0 ? 'Some alerts are hidden by disabled rules above.' : 'No alert rule is currently triggered. That is the goal.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {searchedAlerts.map((a, i) => (
              <div key={i} className="py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {severityIcon(a.alert.severity)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{a.campaign}</span>
                      <Badge variant="outline" className="text-[10px]">{ALERT_TYPE_LABELS[a.alert.type]}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {a.clientName} · {a.account}{a.platform ? ` · ${a.platform.toUpperCase()}` : ''}
                    </div>
                    <div className="text-xs mt-1">{a.alert.icon} {a.alert.message}</div>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <div>${a.spend.toLocaleString()} / ${a.budget.toLocaleString()}</div>
                  <div>{a.spendPct}% spend · {a.timePct}% time</div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
        </CollapsibleContent>
      </Card>
      </Collapsible>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  gradient,
  pulse,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  gradient: string;
  pulse?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl p-4 text-white shadow-md
        bg-gradient-to-br ${gradient} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg animate-fade-in`}
    >
      <div aria-hidden className="absolute -right-4 -bottom-4 opacity-20">
        <Icon className="h-20 w-20" />
      </div>
      <div className="relative flex items-center gap-2">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-white/80" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
        )}
        <p className="text-[10px] uppercase tracking-wider text-white/85">{label}</p>
      </div>
      <p className="relative mt-1 text-3xl font-bold font-mono leading-none">{value}</p>
    </div>
  );
}
