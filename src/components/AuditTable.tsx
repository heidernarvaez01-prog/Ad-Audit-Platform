import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import PacingBar from '@/components/PacingBar';
import type { AuditMetrics } from '@/lib/audit-calculations';
import type { AuditAlert } from '@/lib/audit-alerts';
import type { ApiCampaignRow } from '@/lib/api';

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

function ExpandedDetails({ row }: { row: AuditRowData }) {
  const apiData = row.campaignApiData;
  const totalClicks = apiData.reduce((s, r) => s + r.metrics.clicks, 0);
  const totalImpressions = apiData.reduce((s, r) => s + r.metrics.impressions, 0);
  const totalCost = apiData.reduce((s, r) => s + r.metrics.cost, 0);
  const totalReach = apiData.reduce((s, r) => s + r.metrics.reach, 0);
  const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;
  const cpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return (
    <div className="px-4 pb-4 space-y-3">
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

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold font-mono text-foreground">{value}</p>
    </div>
  );
}

export default function AuditTable({ rows, onEdit, onDelete }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-8"></TableHead>
            <TableHead className="text-xs">Campaña</TableHead>
            <TableHead className="text-xs w-40">Pacing</TableHead>
            <TableHead className="text-xs">Estado</TableHead>
            <TableHead className="text-xs text-right">Gasto / Aprobado</TableHead>
            <TableHead className="text-xs text-right">Diario Ideal</TableHead>
            <TableHead className="text-xs w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const m = row.metrics;
            const isExpanded = expandedIds.has(row.id);
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
                        <div className="flex items-center gap-2">
                          <PlatformBadge platform={row.platform} />
                          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                            {row.campaign_name}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {row.account_id} · {row.fecha_inicio} → {row.fecha_fin}
                        </p>
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
                      <TableCell className="text-right">
                        <div className="flex items-center gap-0.5 justify-end" onClick={e => e.stopPropagation()}>
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
                      <td colSpan={7} className="p-0 bg-muted/20">
                        <ExpandedDetails row={row} />
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
