import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, Sparkles, Loader2, ExternalLink, Gauge, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
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

// Period filter for the Performance view (visualize any date range)
export type PerfPeriod = 'all' | 'last_7' | 'last_30' | 'this_month' | 'last_month' | 'custom';
export const PERF_PERIOD_LABELS: Record<PerfPeriod, string> = {
  all: 'Full campaign',
  last_7: 'Last 7 days',
  last_30: 'Last 30 days',
  this_month: 'This month',
  last_month: 'Last month',
  custom: 'Custom range',
};

export function periodWindow(p: PerfPeriod, cf?: string, ct?: string): { from: string; to: string } | null {
  if (p === 'all') return null;
  if (p === 'custom') {
    if (!cf && !ct) return null;
    return { from: cf || '0000-01-01', to: ct || '9999-12-31' };
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === 'last_7') { const f = new Date(today); f.setDate(f.getDate() - 7); return { from: iso(f), to: iso(today) }; }
  if (p === 'last_30') { const f = new Date(today); f.setDate(f.getDate() - 30); return { from: iso(f), to: iso(today) }; }
  if (p === 'this_month') { return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) }; }
  // last_month
  return {
    from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    to: iso(new Date(today.getFullYear(), today.getMonth(), 0)),
  };
}

export function filterByPeriod(rows: ApiCampaignRow[], p: PerfPeriod, cf?: string, ct?: string): ApiCampaignRow[] {
  const w = periodWindow(p, cf, ct);
  if (!w) return rows;
  return rows.filter(r => r.date >= w.from && r.date <= w.to);
}

// Aggregated real-time performance for one audited campaign
interface RowPerf {
  impressions: number;
  reach: number;
  conversions: number;
  clicks: number;
  linkClicks: number;
  interactions: number;
  ctr: number;
  thruplay: number;
  cpm: number;
  cpc: number;
  engagementRate: number;
}

function computePerf(api: ApiCampaignRow[]): RowPerf {
  const sum = (f: (m: ApiCampaignRow['metrics']) => number) =>
    api.reduce((s, r) => s + (isNaN(f(r.metrics)) ? 0 : f(r.metrics)), 0);
  const impressions = sum(m => m.impressions);
  const clicks = sum(m => m.clicks);
  const cost = sum(m => m.cost);
  const interactions = sum(m => m.interactions);
  return {
    impressions,
    reach: sum(m => m.reach),
    conversions: sum(m => m.conversions),
    clicks,
    linkClicks: sum(m => m.link_clicks),
    interactions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    thruplay: sum(m => m.thruplay_actions),
    cpm: impressions > 0 ? (cost / impressions) * 1000 : 0,
    cpc: clicks > 0 ? cost / clicks : 0,
    engagementRate: impressions > 0 ? (interactions / impressions) * 100 : 0,
  };
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
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
    return <Badge variant="destructive" className="text-[10px] px-1.5">Overspending</Badge>;
  }
  if (status === 'SUBGASTANDO') {
    return <Badge className="text-[10px] px-1.5 bg-warning text-warning-foreground hover:bg-warning/90">Underspending</Badge>;
  }
  return (
    <Badge className="text-[10px] px-1.5 bg-success text-success-foreground hover:bg-success/90 gap-1">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-foreground/80 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-foreground" />
      </span>
      On Track
    </Badge>
  );
}

// % Actual colored against % Expected: the heart of pacing clarity
function ActualPctCell({ actual, expected }: { actual: number; expected: number }) {
  const diff = actual - expected;
  const color = Math.abs(diff) <= 10
    ? 'text-success'
    : diff < 0
      ? 'text-warning'
      : 'text-destructive';
  return (
    <span className={`font-mono text-xs font-bold ${color}`}>
      {fmtPct(actual)}
    </span>
  );
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

function CampaignSummary({ row }: { row: AuditRowData }) {
  const m = row.metrics;
  const p = computePerf(row.campaignApiData);
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Campaign</p>
        <p className="text-sm font-semibold text-foreground line-clamp-2">{row.campaign_name}</p>
        {row.platform && <PlatformBadge platform={row.platform} />}
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-border">
        <MetricMini label="Spend" value={fmt(m.gastoActual)} />
        <MetricMini label="Budget" value={fmt(row.presupuesto_total)} />
        <MetricMini label="% Expected" value={fmtPct(m.porcentajeTiempo)} />
        <MetricMini label="% Actual" value={fmtPct(m.porcentajeGastado)} />
        <MetricMini label="Ideal daily" value={fmt(m.presupuestoDiarioIdeal)} />
        <MetricMini label="Remaining" value={fmt(m.presupuestoRestante)} />
        <MetricMini label="CTR" value={fmtPct(p.ctr)} />
        <MetricMini label="CPC" value={fmt(p.cpc)} />
      </div>
      {row.alerts.length > 0 && (
        <div className="pt-1.5 border-t border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Alerts</p>
          <p className="text-[11px] text-foreground">{row.alerts[0].icon} {row.alerts[0].message}</p>
        </div>
      )}
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
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Insight</p>
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
  period = 'all',
  customFrom,
  customTo,
}: {
  row: AuditRowData;
  insight: InsightData | null;
  loadingInsight: boolean;
  onGenerateInsight: () => void;
  period?: PerfPeriod;
  customFrom?: string;
  customTo?: string;
}) {
  const m = row.metrics;
  const periodRows = filterByPeriod(row.campaignApiData, period, customFrom, customTo);
  const p = computePerf(periodRows);

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Pacing bar — visual summary of expected vs actual */}
      <div className="pt-3">
        <PacingBar
          porcentajeTiempo={m.porcentajeTiempo}
          porcentajeGasto={m.porcentajeGastado}
          status={m.pacingStatus}
        />
      </div>

      {/* Performance Charts */}
      <PerformanceCharts
        apiRows={periodRows}
        budget={row.presupuesto_total}
        level="campaign"
      />

      {period !== 'all' && (
        <p className="text-[11px] text-muted-foreground -mt-1">
          Showing performance for <span className="font-medium text-foreground">{PERF_PERIOD_LABELS[period]}</span>.
        </p>
      )}

      {/* Full performance metrics */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 p-3 rounded-md bg-muted/50 border border-border">
        <MetricMini label="Impressions" value={fmtNum(p.impressions)} />
        <MetricMini label="Reach" value={fmtNum(p.reach)} />
        <MetricMini label="Conversions" value={fmtNum(p.conversions)} />
        <MetricMini label="Clicks" value={fmtNum(p.clicks)} />
        <MetricMini label="Link Clicks" value={fmtNum(p.linkClicks)} />
        <MetricMini label="Interactions" value={fmtNum(p.interactions)} />
        <MetricMini label="CTR" value={fmtPct(p.ctr)} />
        <MetricMini label="Thruplay" value={fmtNum(p.thruplay)} />
        <MetricMini label="CPM" value={fmt(p.cpm)} />
        <MetricMini label="CPC" value={fmt(p.cpc)} />
        <MetricMini label="Engagement" value={fmtPct(p.engagementRate)} />
        <MetricMini label="Daily Spend Avg" value={fmt(m.gastoDiarioActual)} />
      </div>

      {/* Pacing detail */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-md bg-muted/50 border border-border">
        <MetricMini label="Total Days" value={m.diasTotales.toString()} />
        <MetricMini label="Days Elapsed" value={m.diasTranscurridos.toString()} />
        <MetricMini label="Days Left" value={m.diasRestantes.toString()} />
        <MetricMini label="Expected Spend" value={fmt(m.gastoEsperado)} />
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
          {loadingInsight ? 'Analyzing...' : 'Generate AI Insight'}
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
  const [view, setView] = useState<'pacing' | 'performance'>('pacing');
  const [perfPeriod, setPerfPeriod] = useState<PerfPeriod>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState<number | undefined>(undefined);
  // Cap the table height to whatever space is left below it, so the horizontal
  // scrollbar (bottom of this box) is always on screen — even with expanded rows.
  const [maxH, setMaxH] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const update = () => {
      setViewportWidth(el.clientWidth);
      const top = el.getBoundingClientRect().top;
      setMaxH(Math.max(360, Math.round(window.innerHeight - top - 24)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    const t = window.setTimeout(update, 350); // after summary cards/layout settle
    return () => { ro.disconnect(); window.removeEventListener('resize', update); window.clearTimeout(t); };
  }, [rows.length, view]);

  const perfByRow = useMemo(() => {
    const map = new Map<string, RowPerf>();
    for (const row of rows) map.set(row.id, computePerf(filterByPeriod(row.campaignApiData, perfPeriod, customFrom, customTo)));
    return map;
  }, [rows, perfPeriod, customFrom, customTo]);

  // Spend within the selected period (for the Budget Pacing "Actual Spend" column)
  const periodSpendByRow = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const sum = filterByPeriod(row.campaignApiData, perfPeriod, customFrom, customTo)
        .reduce((s, r) => s + (isNaN(r.metrics.cost) ? 0 : r.metrics.cost), 0);
      map.set(row.id, sum);
    }
    return map;
  }, [rows, perfPeriod, customFrom, customTo]);

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
    const p = computePerf(row.campaignApiData);

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
            ctr: p.ctr.toFixed(2),
            cpc: p.cpc.toFixed(2),
            impressions: p.impressions,
            clicks: p.clicks,
            reach: p.reach,
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
      toast.error('Error generating AI insight');
      console.error(e);
    } finally {
      setLoadingInsights(prev => ({ ...prev, [row.id]: false }));
    }
  };

  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
        <p className="text-sm">No audited campaigns yet.</p>
        <p className="text-xs mt-1">Create a new record to start auditing.</p>
      </div>
    );
  }

  return (
    <>
      {/* View toggle: budget pacing vs performance results */}
      <div className="hidden md:flex items-center justify-between mb-2">
        <Tabs value={view} onValueChange={(v) => setView(v as 'pacing' | 'performance')}>
          <TabsList className="h-8">
            <TabsTrigger value="pacing" className="text-xs gap-1.5 h-6">
              <Gauge className="h-3.5 w-3.5" /> Budget Pacing
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-xs gap-1.5 h-6">
              <BarChart3 className="h-3.5 w-3.5" /> Performance
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Select value={perfPeriod} onValueChange={(v) => setPerfPeriod(v as PerfPeriod)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PERF_PERIOD_LABELS) as PerfPeriod[]).map(k => (
                <SelectItem key={k} value={k} className="text-xs">{PERF_PERIOD_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {perfPeriod === 'custom' && (
            <div className="flex items-center gap-1">
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 w-[140px] text-xs" />
            </div>
          )}
        </div>
      </div>
      {perfPeriod !== 'all' && (
        <p className="hidden md:block text-[11px] text-muted-foreground mb-2 -mt-1">
          {view === 'pacing'
            ? `Actual Spend shows spend for ${PERF_PERIOD_LABELS[perfPeriod]}. Pacing % stay vs the full schedule.`
            : `Performance metrics for ${PERF_PERIOD_LABELS[perfPeriod]}.`}
        </p>
      )}

      {/* Mobile: cards/accordions */}
      <div className="md:hidden space-y-3">
        {rows.map(row => {
          const m = row.metrics;
          const isExpanded = expandedIds.has(row.id);
          const insight = insights[row.id] || null;
          return (
            <Collapsible
              key={row.id}
              open={isExpanded}
              onOpenChange={() => toggleExpand(row.id)}
            >
              <div className={`border border-border rounded-lg bg-card overflow-hidden transition-all duration-200 ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}`}>
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left p-3 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <PlatformBadge platform={row.platform} />
                        <span className="text-sm font-semibold text-foreground truncate">{row.campaign_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {insight && <RiskIndicator insight={insight} />}
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={m.pacingStatus} />
                      <span className="text-[10px] text-muted-foreground truncate">
                        {row.campaignApiData[0]?.account_name || row.account_id}
                      </span>
                    </div>
                    <PacingBar
                      porcentajeTiempo={m.porcentajeTiempo}
                      porcentajeGasto={m.porcentajeGastado}
                      status={m.pacingStatus}
                    />
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <MetricMini label="Spend" value={fmt(m.gastoActual)} />
                      <MetricMini label="Budget" value={fmt(row.presupuesto_total)} />
                      <MetricMini label="% Expected" value={fmtPct(m.porcentajeTiempo)} />
                      <MetricMini label="% Actual" value={fmtPct(m.porcentajeGastado)} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border p-3 space-y-3 bg-muted/20 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2" onClick={e => e.stopPropagation()}>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Start date</p>
                        <Input type="date" value={row.fecha_inicio}
                          onChange={e => onUpdateRecord?.(row.id, { fecha_inicio: e.target.value })}
                          className="h-8 text-xs" />
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">End date</p>
                        <Input type="date" value={row.fecha_fin}
                          onChange={e => onUpdateRecord?.(row.id, { fecha_fin: e.target.value })}
                          className="h-8 text-xs" />
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Schedule</p>
                        <Select value={row.tipo_calendario}
                          onValueChange={v => onUpdateRecord?.(row.id, { tipo_calendario: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="corridos" className="text-xs">Every day</SelectItem>
                            <SelectItem value="lun_vie" className="text-xs">Mon–Fri</SelectItem>
                            <SelectItem value="lun_sab" className="text-xs">Mon–Sat</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Budget</p>
                        <Input type="number" value={row.presupuesto_total}
                          onChange={e => onUpdateRecord?.(row.id, { presupuesto_total: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs text-right font-mono" />
                      </div>
                    </div>
                    <ExpandedDetails
                      row={row}
                      insight={insight}
                      loadingInsight={loadingInsights[row.id] || false}
                      onGenerateInsight={() => generateInsight(row)}
                      period={perfPeriod}
                      customFrom={customFrom}
                      customTo={customTo}
                    />
                    <div className="flex items-center gap-1 justify-end pt-1 border-t border-border" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link to={`/audit/${row.id}`} title="View details">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>

      {/* Desktop: full table */}
      <div
        ref={wrapperRef}
        className="hidden md:block border border-border rounded-lg overflow-auto scrollbar-visible relative"
        style={{ maxHeight: maxH ? `${maxH}px` : 'calc(100vh - 340px)' }}
      >
        <table className={`w-full caption-bottom text-sm ${view === 'pacing' ? 'min-w-[1450px]' : 'min-w-[1350px]'}`}>
        <TableHeader className="sticky top-0 z-20 bg-card [&_tr]:bg-card">
          {view === 'pacing' ? (
            <TableRow className="bg-muted/50">
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-xs">Platform</TableHead>
              <TableHead className="text-xs">Campaign</TableHead>
              <TableHead className="text-xs">Account</TableHead>
              <TableHead className="text-xs w-[132px]">Start date</TableHead>
              <TableHead className="text-xs w-[132px]">End date</TableHead>
              <TableHead className="text-xs w-[110px]">Schedule</TableHead>
              <TableHead className="text-xs w-[110px] text-right">
                Programmed Budget
                <MetricInfo label="Programmed budget">
                  Total budget approved for the campaign during the audited period.
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                Actual Spend
                <MetricInfo label="Actual spend">
                  Real spend reported by the platform so far (excludes today and yesterday while data consolidates).
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                % Expected
                <MetricInfo label="% Expected spend to date">
                  How much of the budget SHOULD be spent by today if pacing were perfect. Based on days elapsed vs total days of the schedule.
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                % Actual
                <MetricInfo label="% Actual spend to date">
                  How much of the budget has ACTUALLY been spent. Green = within ±10% of expected. Amber = behind (underspending). Red = ahead (overspending).
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                Ideal Daily
                <MetricInfo label="Ideal daily budget">
                  Remaining balance divided by the days left. Spend this per day to land exactly on budget.
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                Remaining
                <MetricInfo label="Remaining balance">
                  Programmed budget minus actual spend.
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs w-20"></TableHead>
            </TableRow>
          ) : (
            <TableRow className="bg-muted/50">
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-xs">Platform</TableHead>
              <TableHead className="text-xs">Campaign</TableHead>
              <TableHead className="text-xs text-right">Impressions</TableHead>
              <TableHead className="text-xs text-right">Reach</TableHead>
              <TableHead className="text-xs text-right">Conversions</TableHead>
              <TableHead className="text-xs text-right">Clicks</TableHead>
              <TableHead className="text-xs text-right">Link Clicks</TableHead>
              <TableHead className="text-xs text-right">Interactions</TableHead>
              <TableHead className="text-xs text-right">
                CTR
                <MetricInfo label="Click-through rate">Clicks / impressions × 100.</MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">Thruplay</TableHead>
              <TableHead className="text-xs text-right">
                CPM
                <MetricInfo label="Cost per mille">Cost per 1,000 impressions.</MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                CPC
                <MetricInfo label="Cost per click">Total spend / clicks.</MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                Engagement
                <MetricInfo label="Engagement rate">Interactions / impressions × 100.</MetricInfo>
              </TableHead>
              <TableHead className="text-xs w-20"></TableHead>
            </TableRow>
          )}
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const m = row.metrics;
            const p = perfByRow.get(row.id)!;
            const isExpanded = expandedIds.has(row.id);
            const insight = insights[row.id] || null;
            const colCount = 15;
            return (
              <Collapsible key={row.id} open={isExpanded} onOpenChange={() => toggleExpand(row.id)} asChild>
                <>
                  <CollapsibleTrigger asChild>
                    <TableRow className={`cursor-pointer transition-colors duration-200 ${isExpanded ? 'bg-muted/40' : 'hover:bg-muted/30'}`}>
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
                        <HoverCard openDelay={200} closeDelay={80}>
                          <HoverCardTrigger asChild>
                            <span className="text-sm font-medium text-foreground truncate max-w-[180px] block cursor-help">
                              {row.campaign_name}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent side="right" align="start" className="w-72 p-3">
                            <CampaignSummary row={row} />
                          </HoverCardContent>
                        </HoverCard>
                      </TableCell>

                      {view === 'pacing' ? (
                        <>
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
                                <SelectItem value="corridos" className="text-xs">Every day</SelectItem>
                                <SelectItem value="lun_vie" className="text-xs">Mon–Fri</SelectItem>
                                <SelectItem value="lun_sab" className="text-xs">Mon–Sat</SelectItem>
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
                          <TableCell className="text-right font-mono text-xs">
                            <span className={m.pacingStatus === 'SOBREGASTANDO' && perfPeriod === 'all' ? 'text-destructive font-bold' : 'text-foreground'}>
                              {perfPeriod === 'all' ? fmt(m.gastoActual) : fmt(periodSpendByRow.get(row.id) ?? 0)}
                            </span>
                            {perfPeriod !== 'all' && (
                              <span className="block text-[9px] text-muted-foreground uppercase tracking-wide">period</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {fmtPct(m.porcentajeTiempo)}
                          </TableCell>
                          <TableCell className="text-right">
                            <ActualPctCell actual={m.porcentajeGastado} expected={m.porcentajeTiempo} />
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-foreground">
                            {fmt(m.presupuestoDiarioIdeal)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-foreground">
                            {fmt(m.presupuestoRestante)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={m.pacingStatus} />
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.impressions)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.reach)}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold">{fmtNum(p.conversions)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.clicks)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.linkClicks)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.interactions)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtPct(p.ctr)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.thruplay)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmt(p.cpm)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmt(p.cpc)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtPct(p.engagementRate)}</TableCell>
                        </>
                      )}

                      <TableCell className="text-right">
                        <div className="flex items-center gap-0.5 justify-end" onClick={e => e.stopPropagation()}>
                          {insight && <RiskIndicator insight={insight} />}
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <Link to={`/audit/${row.id}`} title="View details">
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
                  <CollapsibleContent asChild forceMount>
                    <tr className={isExpanded ? '' : 'hidden'}>
                      <td colSpan={colCount} className="p-0 bg-muted/20 border-t border-border">
                        <div
                          className="sticky left-0 animate-fade-in"
                          style={{ width: viewportWidth ? `${viewportWidth}px` : '100%' }}
                        >
                          <ExpandedDetails
                            row={row}
                            insight={insight}
                            loadingInsight={loadingInsights[row.id] || false}
                            onGenerateInsight={() => generateInsight(row)}
                            period={perfPeriod}
                            customFrom={customFrom}
                            customTo={customTo}
                          />
                        </div>
                      </td>
                    </tr>
                  </CollapsibleContent>
                </>
              </Collapsible>
            );
          })}
        </TableBody>
        </table>
      </div>
    </>
  );
}
