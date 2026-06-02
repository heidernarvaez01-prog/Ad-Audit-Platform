import { useEffect, useMemo, useState } from 'react';
import { Bell, Mail, Plus, X, Save, AlertTriangle, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface AlertSettings {
  enabled: boolean;
  email_recipients: string[];
  pacing_threshold_pct: number;
  only_critical: boolean;
  notify_frequency: 'daily' | 'weekly' | 'manual';
}

interface ComputedAlert {
  campaign: string;
  account: string;
  platform: string | null;
  level: 'critical' | 'warning' | 'ok';
  spend: number;
  budget: number;
  spendPct: number;
  timePct: number;
  deviation: number;
  message: string;
}

const DEFAULT_SETTINGS: AlertSettings = {
  enabled: true,
  email_recipients: [],
  pacing_threshold_pct: 10,
  only_critical: false,
  notify_frequency: 'daily',
};

function workdaysBetween(start: Date, end: Date) {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(count, 1);
}

export default function AlertsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS);
  const [emailInput, setEmailInput] = useState('');
  const [alerts, setAlerts] = useState<ComputedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

      // Compute alerts
      const { data: audits } = await supabase
        .from('audit_records')
        .select('account_id, campaign_name, platform, presupuesto_total, fecha_inicio, fecha_fin')
        .eq('user_id', user.id);

      const accountIds = Array.from(new Set((audits ?? []).map((a) => a.account_id)));
      let metrics: any[] = [];
      if (accountIds.length) {
        const { data: m } = await supabase
          .from('meta_datos')
          .select('account_id, account_name, campaign_name, total_cost, fecha')
          .in('account_id', accountIds);
        metrics = m ?? [];
      }

      const today = new Date();
      const computed: ComputedAlert[] = [];
      for (const a of audits ?? []) {
        const start = new Date(a.fecha_inicio);
        const end = new Date(a.fecha_fin);
        const totalDays = workdaysBetween(start, end);
        const elapsedDays = workdaysBetween(start, today < end ? today : end);
        const timePct = Math.min(100, (elapsedDays / totalDays) * 100);
        const spend = metrics
          .filter((m) => m.account_id === a.account_id && m.campaign_name === a.campaign_name)
          .reduce((s, m) => s + Number(m.total_cost ?? 0), 0);
        const budget = Number(a.presupuesto_total ?? 0);
        const spendPct = budget > 0 ? (spend / budget) * 100 : 0;
        const deviation = +(spendPct - timePct).toFixed(1);
        const abs = Math.abs(deviation);
        let level: ComputedAlert['level'] = 'ok';
        if (abs > 20) level = 'critical';
        else if (abs > 10) level = 'warning';

        const accountName = metrics.find((m) => m.account_id === a.account_id)?.account_name ?? a.account_id;
        let message = `Pacing en línea (${deviation > 0 ? '+' : ''}${deviation}%)`;
        if (level !== 'ok') {
          message = deviation > 0
            ? `Sobre-ejecución del ${deviation}% (gasto ${spendPct.toFixed(1)}% vs tiempo ${timePct.toFixed(1)}%)`
            : `Sub-ejecución del ${deviation}% (gasto ${spendPct.toFixed(1)}% vs tiempo ${timePct.toFixed(1)}%)`;
        }

        computed.push({
          campaign: a.campaign_name,
          account: accountName,
          platform: a.platform,
          level,
          spend,
          budget,
          spendPct: +spendPct.toFixed(1),
          timePct: +timePct.toFixed(1),
          deviation,
          message,
        });
      }
      computed.sort((x, y) => {
        const order = { critical: 0, warning: 1, ok: 2 };
        return order[x.level] - order[y.level];
      });
      setAlerts(computed);
      setLoading(false);
    })();
  }, [user]);

  const stats = useMemo(() => ({
    critical: alerts.filter((a) => a.level === 'critical').length,
    warning: alerts.filter((a) => a.level === 'warning').length,
    ok: alerts.filter((a) => a.level === 'ok').length,
  }), [alerts]);

  const addEmail = () => {
    const e = emailInput.trim();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast({ title: 'Email inválido', variant: 'destructive' });
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
    if (error) toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
    else toast({ title: 'Configuración guardada' });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Alertas</h1>
          <p className="text-sm text-muted-foreground">
            Monitorea desviaciones de pacing y configura notificaciones por correo.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div>
            <div className="text-2xl font-bold">{stats.critical}</div>
            <div className="text-xs text-muted-foreground">Críticas (&gt;20%)</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <div>
            <div className="text-2xl font-bold">{stats.warning}</div>
            <div className="text-xs text-muted-foreground">Advertencias (&gt;10%)</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <div>
            <div className="text-2xl font-bold">{stats.ok}</div>
            <div className="text-xs text-muted-foreground">En línea</div>
          </div>
        </Card>
      </div>

      <Card className="p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Configuración de correos</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Alertas activas</Label>
            <p className="text-xs text-muted-foreground">Habilitar/deshabilitar el envío de notificaciones.</p>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings({ ...settings, enabled: v })} />
        </div>

        <div className="space-y-2">
          <Label>Destinatarios</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="alguien@empresa.com"
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
              <p className="text-xs text-muted-foreground">Agrega al menos un correo para recibir alertas.</p>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Umbral de desviación (%)</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={settings.pacing_threshold_pct}
              onChange={(e) => setSettings({ ...settings, pacing_threshold_pct: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Frecuencia</Label>
            <Select
              value={settings.notify_frequency}
              onValueChange={(v: AlertSettings['notify_frequency']) => setSettings({ ...settings, notify_frequency: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diaria</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="manual">Solo manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <Label>Solo críticas</Label>
              <p className="text-xs text-muted-foreground">Ignorar advertencias.</p>
            </div>
            <Switch checked={settings.only_critical} onCheckedChange={(v) => setSettings({ ...settings, only_critical: v })} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar configuración
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Alertas activas</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando...
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay campañas auditadas todavía.</p>
        ) : (
          <div className="divide-y divide-border">
            {alerts.map((a, i) => (
              <div key={i} className="py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {a.level === 'critical' ? <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                   : a.level === 'warning' ? <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                   : <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{a.campaign}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.account} · {a.platform ?? '—'}</div>
                    <div className="text-xs mt-1">{a.message}</div>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <div>${a.spend.toLocaleString()} / ${a.budget.toLocaleString()}</div>
                  <div>{a.spendPct}% gasto · {a.timePct}% tiempo</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
