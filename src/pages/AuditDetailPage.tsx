import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchCampaignData, type ApiCampaignRow } from '@/lib/api';
import { calculateAuditMetrics, getTipoCalendarioLabel } from '@/lib/audit-calculations';
import { generateAlerts } from '@/lib/audit-alerts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PacingBar from '@/components/PacingBar';
import PerformanceCharts from '@/components/PerformanceCharts';
import { toast } from 'sonner';

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}

interface InsightData {
  insight: string;
  riskLevel: 'critical' | 'moderate' | 'none';
}

export default function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<any>(null);
  const [apiData, setApiData] = useState<ApiCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: rec, error }, api] = await Promise.all([
          supabase.from('audit_records').select('*').eq('id', id).maybeSingle(),
          fetchCampaignData(),
        ]);
        if (error) throw error;
        if (!rec) {
          toast.error('Auditoría no encontrada');
          navigate('/');
          return;
        }
        setRecord(rec);
        setApiData(api);
      } catch (e) {
        console.error(e);
        toast.error('Error cargando la auditoría');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const { metrics, alerts, campaignApiData, perf } = useMemo(() => {
    if (!record) return { metrics: null, alerts: [], campaignApiData: [], perf: null };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoffDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
    const yyyy = cutoffDate.getFullYear();
    const mm = String(cutoffDate.getMonth() + 1).padStart(2, '0');
    const dd = String(cutoffDate.getDate()).padStart(2, '0');
    const cutoff = `${yyyy}-${mm}-${dd}`;
    const effectiveEnd = record.fecha_fin < cutoff ? record.fecha_fin : cutoff;
    const campaignApiData = apiData.filter(
      r =>
        r.campaign_name === record.campaign_name &&
        r.date >= record.fecha_inicio &&
        r.date <= effectiveEnd,
    );
    const cost = campaignApiData.reduce((s, r) => s + (isNaN(r.metrics.cost) ? 0 : r.metrics.cost), 0);
    const metrics = calculateAuditMetrics(
      Number(record.presupuesto_total),
      record.fecha_inicio,
      record.fecha_fin,
      record.tipo_calendario,
      cost,
    );
    const alerts = generateAlerts(metrics, campaignApiData, apiData);

    const clicks = campaignApiData.reduce((s, r) => s + r.metrics.clicks, 0);
    const impressions = campaignApiData.reduce((s, r) => s + r.metrics.impressions, 0);
    const reach = campaignApiData.reduce((s, r) => s + r.metrics.reach, 0);
    const totalCost = campaignApiData.reduce((s, r) => s + r.metrics.cost, 0);
    const cpc = clicks > 0 ? totalCost / clicks : 0;
    const cpm = impressions > 0 ? (totalCost / impressions) * 1000 : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    return { metrics, alerts, campaignApiData, perf: { clicks, impressions, reach, cpc, cpm, ctr } };
  }, [record, apiData]);

  const generateInsight = async () => {
    if (!record || !metrics || !perf) return;
    setLoadingInsight(true);
    try {
      const { data, error } = await supabase.functions.invoke('audit-insight', {
        body: {
          campaignData: {
            campaignName: record.campaign_name,
            platform: record.platform,
            presupuestoTotal: record.presupuesto_total.toFixed(2),
            gastoActual: metrics.gastoActual.toFixed(2),
            presupuestoRestante: metrics.presupuestoRestante.toFixed(2),
            diasTranscurridos: metrics.diasTranscurridos,
            diasRestantes: metrics.diasRestantes,
            pacingStatus: metrics.pacingStatus,
            pacingPct: metrics.pacingPct.toFixed(1),
            gastoDiarioActual: metrics.gastoDiarioActual.toFixed(2),
            presupuestoDiarioIdeal: metrics.presupuestoDiarioIdeal.toFixed(2),
            ctr: perf.ctr.toFixed(2),
            cpc: perf.cpc.toFixed(2),
            impressions: perf.impressions,
            clicks: perf.clicks,
            reach: perf.reach,
          },
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setInsight(data as InsightData);
    } catch (e) {
      console.error(e);
      toast.error('Error generando insight IA');
    } finally {
      setLoadingInsight(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (!record || !metrics || !perf) return null;

  const statusVariant =
    metrics.pacingStatus === 'SOBREGASTANDO'
      ? 'destructive'
      : metrics.pacingStatus === 'SUBGASTANDO'
        ? 'default'
        : 'default';
  const statusLabel =
    metrics.pacingStatus === 'SOBREGASTANDO'
      ? 'Sobregastando'
      : metrics.pacingStatus === 'SUBGASTANDO'
        ? 'Subgastando'
        : 'En Ruta';

  const accountName = campaignApiData[0]?.account_name || record.account_id;

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Volver
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{record.campaign_name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {accountName} · {record.platform?.toUpperCase()} · {getTipoCalendarioLabel(record.tipo_calendario)}
            </p>
          </div>
        </div>
        <Badge variant={statusVariant} className="text-xs">{statusLabel}</Badge>
      </div>

      {/* Pacing card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Pacing de Gasto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PacingBar
            porcentajeTiempo={metrics.porcentajeTiempo}
            porcentajeGasto={metrics.porcentajeGastado}
            status={metrics.pacingStatus}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Presupuesto" value={fmt(record.presupuesto_total)} />
            <Stat
              label="Gasto Actual"
              value={fmt(metrics.gastoActual)}
              color={metrics.pacingStatus === 'SOBREGASTANDO' ? 'text-destructive' : undefined}
            />
            <Stat label="Restante" value={fmt(metrics.presupuestoRestante)} />
            <Stat label="Pacing" value={`${metrics.pacingPct >= 0 ? '+' : ''}${metrics.pacingPct.toFixed(1)}%`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Días Totales" value={String(metrics.diasTotales)} />
            <Stat label="Días Transcurridos" value={String(metrics.diasTranscurridos)} />
            <Stat label="Días Restantes" value={String(metrics.diasRestantes)} />
            <Stat label="Diario Ideal" value={fmt(metrics.presupuestoDiarioIdeal)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Gasto Diario Actual" value={fmt(metrics.gastoDiarioActual)} />
            <Stat label="Gasto Esperado" value={fmt(metrics.gastoEsperado)} />
            <Stat label="Fecha Inicio" value={record.fecha_inicio} />
            <Stat label="Fecha Fin" value={record.fecha_fin} />
          </div>
        </CardContent>
      </Card>

      {/* API metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Métricas de Rendimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <Stat label="Clicks" value={fmtNum(perf.clicks)} />
            <Stat label="Impressions" value={fmtNum(perf.impressions)} />
            <Stat label="Reach" value={fmtNum(perf.reach)} />
            <Stat label="CTR" value={`${perf.ctr.toFixed(2)}%`} />
            <Stat label="CPC" value={fmt(perf.cpc)} />
            <Stat label="CPM" value={fmt(perf.cpm)} />
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Evolución</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceCharts
            apiRows={campaignApiData}
            budget={Number(record.presupuesto_total)}
            level="campaign"
          />
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin alertas activas.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 rounded text-xs font-medium ${
                    alert.severity === 'danger'
                      ? 'bg-destructive/10 text-destructive'
                      : alert.severity === 'warning'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-success/10 text-success'
                  }`}
                >
                  {alert.icon} {alert.message}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insight */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Diagnóstico IA</CardTitle>
          <Button variant="outline" size="sm" onClick={generateInsight} disabled={loadingInsight}>
            {loadingInsight ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            {loadingInsight ? 'Analizando...' : 'Generar Insight'}
          </Button>
        </CardHeader>
        <CardContent>
          {insight ? (
            <div
              className={`p-3 rounded-md border ${
                insight.riskLevel === 'critical'
                  ? 'border-destructive/40 bg-destructive/5'
                  : insight.riskLevel === 'moderate'
                    ? 'border-warning/40 bg-warning/5'
                    : 'border-success/40 bg-success/5'
              }`}
            >
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{insight.insight}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Genera un diagnóstico IA basado en el estado actual de esta auditoría.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold font-mono ${color || 'text-foreground'}`}>{value}</p>
    </div>
  );
}
