import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PacingBar from '@/components/PacingBar';
import { MetricInfo } from '@/components/MetricInfo';
import { supabase } from '@/integrations/supabase/client';
import PerformanceCharts from '@/components/PerformanceCharts';
import { toast } from 'sonner';
import type { AuditMetrics } from '@/lib/audit-calculations';
import type { AuditAlert } from '@/lib/audit-alerts';
import type { ApiCampaignRow } from '@/lib/api';

type RecordPatch = Partial<{
  fecha_inicio: string;
  fecha_fin: string;
  tipo_calendario: string;
  presupuesto_total: number;
}>;

export interface AuditRowData {
  id: string;
  account_id: string;
  campaign_name: string;
  presupuesto_total: number;
  fecha_inicio: string;
  fecha_fin: string;
  tipo_calendario: string;
  platform?: string;
  metrics: AuditMetrics;
  alerts: AuditAlert[];
  campaignApiData: ApiCampaignRow[];
}

interface Props {
  rows: AuditRowData[];
  onEdit: (row: AuditRowData) => void;
  onDelete: (id: string) => void;
  onUpdateRecord?: (id: string, patch: RecordPatch) => void;
}

interface InsightData {
  insight: string;
  riskLevel: 'critical' | 'moderate' | 'none';
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}

const PLATFORM_COLORS: Record<string, string> = {
  meta: 'bg-platform-meta text-white',
  google: 'bg-platform-google text-white',
  tiktok: 'bg-foreground text-background',
  linkedin: 'bg-platform-linkedin text-white',
};

function PlatformBadge({ platform }: { platform?: string }) {
  if (!platform) return null;
  const colorClass = PLATFORM_COLORS[platform.toLowerCase()] || 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${colorClass}`}>
      {platform}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'SOBREGASTANDO') {
    return <Badge variant="destructive" className="text-[10px] px-1.5">Sobregastando</Badge>;
  }
  if (status === 'SUBGASTANDO') {
    return <Badge className="text-[10px] px-1.5 bg-warning text-warning-foreground hover:bg-warning/90">Subgastando</Badge>;
  }
  return <Badge className="text-[10px] px-1.5 bg-success text-success-foreground hover:bg-success/90">En Ruta</Badge>;
}

function RiskIndicator({ insight }: { insight: InsightData }) {
  if (insight.riskLevel === 'none') return null;
  const isCritical = insight.riskLevel === 'critical';
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`cursor-help text-base ${isCritical ? 'animate-pulse' : ''}`}>
            {isCritical ? '🚨' : '⚠️'}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-xs whitespace-pre-line">
          {insight.insight}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold font-mono text-foreground">{value}</p>
    </div>
  );
}

function InsightPanel({ insight }: { insight: InsightData }) {
  const borderColor = insight.riskLevel === 'critical'
    ? 'border-destructive/40 bg-destructive/5'
    : insight.riskLevel === 'moderate'
      ? 'border-warning/40 bg-warning/5'
      : 'border-success/40 bg-success/5';

  return (
    <div className={`p-3 rounded-md border ${borderColor}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Insight IA</p>
      </div>
      <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{insight.insight}</p>
    </div>
  );
}

function ExpandedDetails({
  row,
  insight,
  loadingInsight,
  onGenerateInsight,
}: {
  row: AuditRowData;
  insight: InsightData | null;
  loadingInsight: boolean;
  onGenerateInsight: () => void;
}) {
  const apiData = row.campaignApiData;
  const totalClicks = apiData.reduce((s, r) => s + r.metrics.clicks, 0);
  const totalImpressions = apiData.reduce((s, r) => s + r.metrics.impressions, 0);
  const totalCost = apiData.reduce((s, r) => s + r.metrics.cost, 0);
  const totalReach = apiData.reduce((s, r) => s + r.metrics.reach, 0);
  const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;
  const cpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Performance Charts */}
      <PerformanceCharts
        apiRows={apiData}
        budget={row.presupuesto_total}
        level="campaign"
      />
      {/* API Metrics */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 p-3 rounded-md bg-muted/50 border border-border">
        <MetricMini label="Clicks" value={fmtNum(totalClicks)} />
        <MetricMini label="Impressions" value={fmtNum(totalImpressions)} />
        <MetricMini label="Reach" value={fmtNum(totalReach)} />
        <MetricMini label="CTR" value={`${ctr.toFixed(2)}%`} />
        <MetricMini label="CPC" value={fmt(cpc)} />
        <MetricMini label="CPM" value={fmt(cpm)} />
      </div>

      {/* Pacing detail */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-md bg-muted/50 border border-border">
        <MetricMini label="Días Totales" value={row.metrics.diasTotales.toString()} />
        <MetricMini label="Días Transcurridos" value={row.metrics.diasTranscurridos.toString()} />
        <MetricMini label="Días Restantes" value={row.metrics.diasRestantes.toString()} />
        <MetricMini label="Gasto Diario Actual" value={fmt(row.metrics.gastoDiarioActual)} />
      </div>

      {/* AI Insight */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerateInsight}
          disabled={loadingInsight}
          className="text-xs"
        >
          {loadingInsight ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          )}
          {loadingInsight ? 'Analizando...' : 'Generar Insight IA'}
        </Button>
      </div>

      {insight && <InsightPanel insight={insight} />}

      {/* Alerts */}
      {row.alerts.length > 0 && (
        <div className="space-y-1.5">
          {row.alerts.map((alert, i) => (
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
    </div>
  );
}

export default function AuditTable({ rows, onEdit, onDelete, onUpdateRecord }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [insights, setInsights] = useState<Record<string, InsightData>>({});
  const [loadingInsights, setLoadingInsights] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateInsight = async (row: AuditRowData) => {
    setLoadingInsights(prev => ({ ...prev, [row.id]: true }));

    const apiData = row.campaignApiData;
    const totalClicks = apiData.reduce((s, r) => s + r.metrics.clicks, 0);
    const totalImpressions = apiData.reduce((s, r) => s + r.metrics.impressions, 0);
    const totalCost = apiData.reduce((s, r) => s + r.metrics.cost, 0);
    const totalReach = apiData.reduce((s, r) => s + r.metrics.reach, 0);
    const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    try {
      const { data, error } = await supabase.functions.invoke('audit-insight', {
        body: {
          campaignData: {
            campaignName: row.campaign_name,
            platform: row.platform,
            presupuestoTotal: row.presupuesto_total.toFixed(2),
            gastoActual: row.metrics.gastoActual.toFixed(2),
            presupuestoRestante: row.metrics.presupuestoRestante.toFixed(2),
            diasTranscurridos: row.metrics.diasTranscurridos,
            diasRestantes: row.metrics.diasRestantes,
            pacingStatus: row.metrics.pacingStatus,
            pacingPct: row.metrics.pacingPct.toFixed(1),
            gastoDiarioActual: row.metrics.gastoDiarioActual.toFixed(2),
            presupuestoDiarioIdeal: row.metrics.presupuestoDiarioIdeal.toFixed(2),
            ctr: ctr.toFixed(2),
            cpc: cpc.toFixed(2),
            impressions: totalImpressions,
            clicks: totalClicks,
            reach: totalReach,
          },
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setInsights(prev => ({ ...prev, [row.id]: data as InsightData }));
    } catch (e) {
      toast.error('Error generando insight IA');
      console.error(e);
    } finally {
      setLoadingInsights(prev => ({ ...prev, [row.id]: false }));
    }
  };

  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
        <p className="text-sm">No hay campañas auditadas.</p>
        <p className="text-xs mt-1">Crea un nuevo registro para comenzar a auditar.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <Table className="min-w-[1200px]">
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-8"></TableHead>
            <TableHead className="text-xs">Plataforma</TableHead>
            <TableHead className="text-xs">Campaña</TableHead>
            <TableHead className="text-xs">Cuenta</TableHead>
            <TableHead className="text-xs w-[140px]">Fecha inicio</TableHead>
            <TableHead className="text-xs w-[140px]">Fecha fin</TableHead>
            <TableHead className="text-xs w-[140px]">Calendario</TableHead>
            <TableHead className="text-xs w-[120px] text-right">Presupuesto</TableHead>
            <TableHead className="text-xs w-40">Pacing</TableHead>
            <TableHead className="text-xs">Estado</TableHead>
            <TableHead className="text-xs text-right">Gasto / Aprobado</TableHead>
            <TableHead className="text-xs text-right">Diario Ideal</TableHead>
            <TableHead className="text-xs w-10 text-center">IA</TableHead>
            <TableHead className="text-xs w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const m = row.metrics;
            const isExpanded = expandedIds.has(row.id);
            const insight = insights[row.id] || null;
            return (
              <Collapsible key={row.id} open={isExpanded} onOpenChange={() => toggleExpand(row.id)} asChild>
                <>
                  <CollapsibleTrigger asChild>
                    <TableRow className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <TableCell className="px-2">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </TableCell>
                      <TableCell>
                        <PlatformBadge platform={row.platform} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground truncate max-w-[200px] block">
                          {row.campaign_name}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const apiRow = row.campaignApiData[0];
                          const name = apiRow?.account_name || row.account_id;
                          return <span className="text-xs text-muted-foreground">{name}</span>;
                        })()}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Input
                          type="date"
                          value={row.fecha_inicio}
                          onChange={e => onUpdateRecord?.(row.id, { fecha_inicio: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Input
                          type="date"
                          value={row.fecha_fin}
                          onChange={e => onUpdateRecord?.(row.id, { fecha_fin: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Select
                          value={row.tipo_calendario}
                          onValueChange={v => onUpdateRecord?.(row.id, { tipo_calendario: v })}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="corridos" className="text-xs">De corrido</SelectItem>
                            <SelectItem value="lun_vie" className="text-xs">Lun a Vie</SelectItem>
                            <SelectItem value="lun_sab" className="text-xs">Lun a Sáb</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Input
                          type="number"
                          value={row.presupuesto_total}
                          onChange={e => onUpdateRecord?.(row.id, { presupuesto_total: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs text-right font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <PacingBar
                          porcentajeTiempo={m.porcentajeTiempo}
                          porcentajeGasto={m.porcentajeGastado}
                          status={m.pacingStatus}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={m.pacingStatus} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <span className={m.pacingStatus === 'SOBREGASTANDO' ? 'text-destructive font-bold' : 'text-foreground'}>
                          {fmt(m.gastoActual)}
                        </span>
                        <span className="text-muted-foreground"> / {fmt(row.presupuesto_total)}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground">
                        {fmt(m.presupuestoDiarioIdeal)}
                      </TableCell>
                      <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                        {insight && <RiskIndicator insight={insight} />}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-0.5 justify-end" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <Link to={`/audit/${row.id}`} title="Ver detalle">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(row)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(row.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleTrigger>
                  <CollapsibleContent asChild>
                    <tr>
                      <td colSpan={14} className="p-0 bg-muted/20">
                        <ExpandedDetails
                          row={row}
                          insight={insight}
                          loadingInsight={loadingInsights[row.id] || false}
                          onGenerateInsight={() => generateInsight(row)}
                        />
                      </td>
                    </tr>
                  </CollapsibleContent>
                </>
              </Collapsible>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
