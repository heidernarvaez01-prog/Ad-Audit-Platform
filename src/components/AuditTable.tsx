import { AlertCircle, CheckCircle2, TrendingDown, TrendingUp, Pencil, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import type { AuditMetrics } from '@/lib/audit-calculations';
import { getTipoCalendarioLabel } from '@/lib/audit-calculations';

export interface AuditRowData {
  id: string;
  account_id: string;
  campaign_name: string;
  presupuesto_total: number;
  fecha_inicio: string;
  fecha_fin: string;
  tipo_calendario: string;
  metrics: AuditMetrics;
}

interface Props {
  rows: AuditRowData[];
  onEdit: (row: AuditRowData) => void;
  onDelete: (id: string) => void;
}

function formatCurrency(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PacingBadge({ status, pct }: { status: string; pct: number }) {
  if (status === 'SOBREGASTANDO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-destructive/15 text-destructive">
        <TrendingUp className="h-3 w-3" /> SOBREGASTANDO
      </span>
    );
  }
  if (status === 'SUBGASTANDO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-warning/15 text-warning">
        <TrendingDown className="h-3 w-3" /> SUBGASTANDO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-success/15 text-success">
      <CheckCircle2 className="h-3 w-3" /> OK
    </span>
  );
}

export default function AuditTable({ rows, onEdit, onDelete }: Props) {
  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No hay registros de auditoría.</p>
        <p className="text-xs mt-1">Crea un nuevo registro para comenzar a auditar tus campañas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(row => {
        const m = row.metrics;
        const alertColor = m.pacingStatus === 'SOBREGASTANDO'
          ? 'border-destructive/40'
          : m.pacingStatus === 'SUBGASTANDO'
            ? 'border-warning/40'
            : 'border-border';

        return (
          <div key={row.id} className={`border ${alertColor} rounded-lg bg-card p-4 transition-colors`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-foreground text-sm">{row.campaign_name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {row.account_id} · {getTipoCalendarioLabel(row.tipo_calendario as any)} · {row.fecha_inicio} → {row.fecha_fin}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <PacingBadge status={m.pacingStatus} pct={m.pacingPct} />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(row)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(row.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <MetricCell label="Presupuesto" value={formatCurrency(row.presupuesto_total)} />
              <MetricCell label="Gasto Actual" value={formatCurrency(m.gastoActual)} highlight={m.pacingStatus === 'SOBREGASTANDO'} />
              <MetricCell label="% Gastado" value={`${m.porcentajeGastado.toFixed(1)}%`} />
              <MetricCell label="Presupuesto Restante" value={formatCurrency(m.presupuestoRestante)} />
              <MetricCell label="Días Restantes" value={m.diasRestantes.toString()} />
              <MetricCell label="Diario Ideal" value={formatCurrency(m.presupuestoDiarioIdeal)} />
            </div>

            {/* Insight alert */}
            {m.pacingStatus !== 'OK' && (
              <div className={`mt-3 px-3 py-2 rounded text-xs font-medium ${
                m.pacingStatus === 'SOBREGASTANDO'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-warning/10 text-warning'
              }`}>
                {m.pacingStatus === 'SOBREGASTANDO'
                  ? `⚠️ Estás gastando ${m.pacingPct.toFixed(1)}% más de lo esperado. Reduce el gasto diario a ${formatCurrency(m.presupuestoDiarioIdeal)} para cumplir el objetivo.`
                  : `📉 Estás gastando ${Math.abs(m.pacingPct).toFixed(1)}% menos de lo esperado. Debes gastar ${formatCurrency(m.presupuestoDiarioIdeal)} diarios para consumir el presupuesto.`
                }
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MetricCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm font-semibold font-mono ${highlight ? 'text-destructive' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}
