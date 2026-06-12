import { useEffect, useMemo, useState } from 'react';
import { Bell, Mail, Plus, X, Save, AlertTriangle, AlertCircle, Info, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchCampaignData } from '@/lib/api';
import { buildAuditRows } from '@/lib/audit-helpers';
import { ALERT_TYPE_LABELS, type AuditAlert } from '@/lib/audit-alerts';
import { toast } from '@/hooks/use-toast';

interface AlertSettings {
  enabled: boolean;
  email_recipients: string[];
  pacing_threshold_pct: number;
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
  email_recipients: [],
  pacing_threshold_pct: 10,
  only_critical: false,
  notify_frequency: 'daily',
};

export default function AlertsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS);
  const [emailInput, setEmailInput] = useState('');
  const [alerts, setAlerts] = useState<CampaignAlert[]>([]);
  const [healthyCount, setHealthyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      // Load settings
      const { data: cfg } = await supabase.from('alert_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (cfg) {
        setSettings({
          enabled: cfg.enabled,
          email_recipients: cfg.email_recipients ?? [],
          pacing_threshold_pct: Number(cfg.pacing_threshold_pct),
          only_critical: cfg.only_critical,
          notify_frequency: cfg.notify_frequency as AlertSettings['notify_frequency'],
        });
      }

      // Compute alerts with the same engine as the audit matrix — per client
      const [{ data: clients }, { data: records }, apiData] = await Promise.all([
        supabase.from('audit_clients').select('id, name'),
        supabase.from('audit_records').select('*'),
        fetchCampaignData().catch(() => []),
      ]);
      const clientName = new Map((clients || []).map(c => [c.id, c.name]));
      const rows = buildAuditRows(records || [], apiData);

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
  }, [user]);

  const stats = useMemo(() => ({
    danger: alerts.filter(a => a.alert.severity === 'danger').length,
    warning: alerts.filter(a => a.alert.severity === 'warning').length,
    info: alerts.filter(a => a.alert.severity === 'info').length,
  }), [alerts]);

  const addEmail = () => {
    const e = emailInput.trim();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast({ title: 'Invalid email', variant: 'destructive' });
      return;
    }
    if (settings.email_recipients.includes(e)) return;
    setSettings({ ...settings, email_recipients: [...settings.email_recipients, e] });
    setEmailInput('');
  };

  const removeEmail = (e: string) =>
    setSettings({ ...settings, email_recipients: settings.email_recipients.filter((x) => x !== e) });

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
    if (settings.email_recipients.length === 0) {
      toast({ title: 'Add at least one recipient', variant: 'destructive' });
      return;
    }
    const pool = settings.only_critical
      ? alerts.filter(a => a.alert.severity === 'danger')
      : alerts.filter(a => a.alert.severity !== 'info');
    if (pool.length === 0) {
      toast({ title: 'Nothing to send — no active critical or warning alerts' });
      return;
    }
    // Map to the email function schema
    const payload = pool.map(a => ({
      campaign: a.campaign,
      account: `${a.clientName} · ${a.account}`,
      platform: a.platform,
      level: a.alert.severity === 'danger' ? 'critical' as const : 'warning' as const,
      spend: a.spend,
      budget: a.budget,
      spendPct: a.spendPct,
      timePct: a.timePct,
      deviation: +(a.spendPct - a.timePct).toFixed(1),
      message: `${ALERT_TYPE_LABELS[a.alert.type]}: ${a.alert.message}`,
    }));
    const criticalCount = payload.filter(a => a.level === 'critical').length;
    const warningCount = payload.filter(a => a.level === 'warning').length;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-alert-email', {
        body: { to: settings.email_recipients, alerts: payload, criticalCount, warningCount },
      });
      if (error || (data && (data as any).error)) {
        const msg = error?.message || (data as any)?.error || 'Unknown error';
        toast({ title: 'Error sending', description: String(msg), variant: 'destructive' });
      } else {
        toast({ title: `Alerts sent to ${settings.email_recipients.length} recipient(s)` });
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
      <header className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Six high-signal rules only — each campaign is checked for overspend, zero delivery,
            ending soon, cost spikes, early budget depletion and creative fatigue.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div>
            <div className="text-2xl font-bold">{stats.danger}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <div>
            <div className="text-2xl font-bold">{stats.warning}</div>
            <div className="text-xs text-muted-foreground">Warnings</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <Info className="h-5 w-5 text-primary" />
          <div>
            <div className="text-2xl font-bold">{stats.info}</div>
            <div className="text-xs text-muted-foreground">Heads-up</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div>
            <div className="text-2xl font-bold">{healthyCount}</div>
            <div className="text-xs text-muted-foreground">Healthy campaigns</div>
          </div>
        </Card>
      </div>

      <Card className="p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Email settings</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Alerts enabled</Label>
            <p className="text-xs text-muted-foreground">Enable/disable notification sending.</p>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings({ ...settings, enabled: v })} />
        </div>

        <div className="space-y-2">
          <Label>Recipients</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="someone@company.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
            />
            <Button type="button" variant="secondary" onClick={addEmail}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {settings.email_recipients.map((e) => (
              <Badge key={e} variant="secondary" className="gap-1.5 pr-1">
                {e}
                <button onClick={() => removeEmail(e)} className="hover:bg-background rounded p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {settings.email_recipients.length === 0 && (
              <p className="text-xs text-muted-foreground">Add at least one email to receive alerts.</p>
            )}
          </div>
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
              <p className="text-xs text-muted-foreground">Ignore warnings in emails.</p>
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
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Active alerts ({alerts.length})</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculating...
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-6 space-y-1">
            <CheckCircle2 className="h-7 w-7 text-success mx-auto" />
            <p className="text-sm text-foreground font-medium">All campaigns are healthy</p>
            <p className="text-xs text-muted-foreground">No alert rule is currently triggered. That is the goal.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {alerts.map((a, i) => (
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
      </Card>
    </div>
  );
}
