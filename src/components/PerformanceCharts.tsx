import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ApiCampaignRow } from '@/lib/api';

function formatDateLabel(raw: string): string {
  // Try parsing different date formats
  let d: Date;
  // Handle DD/MM/YYYY or MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
    const parts = raw.split('/');
    // Assume DD/MM/YYYY (common in Latin America)
    d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  } else {
    // ISO or other formats
    d = new Date(raw.includes('T') ? raw : raw + 'T00:00:00');
  }
  if (isNaN(d.getTime())) return raw; // fallback to raw string
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

interface ChartDataPoint {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

interface Props {
  apiRows: ApiCampaignRow[];
  budget?: number;
  level?: 'campaign' | 'adset';
}

function buildChartData(rows: ApiCampaignRow[]): ChartDataPoint[] {
  const byDate = new Map<string, ApiCampaignRow[]>();
  for (const r of rows) {
    if (!r.date) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date)!.push(r);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRows]) => {
      const spend = dayRows.reduce((s, r) => s + (r.metrics.cost || 0), 0);
      const clicks = dayRows.reduce((s, r) => s + (r.metrics.clicks || 0), 0);
      const impressions = dayRows.reduce((s, r) => s + (r.metrics.impressions || 0), 0);
      const reach = dayRows.reduce((s, r) => s + (r.metrics.reach || 0), 0);
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      return {
        date: formatDateLabel(date),
        spend: +spend.toFixed(2),
        clicks,
        impressions,
        reach,
        ctr: +ctr.toFixed(2),
        cpc: +cpc.toFixed(2),
        cpm: +cpm.toFixed(2),
      };
    });
}

const CHART_HEIGHT = 200;

const tooltipStyle = {
  contentStyle: {
    fontSize: 11,
    borderRadius: 8,
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
    boxShadow: '0 4px 12px rgba(0,0,0,.08)',
  },
  labelStyle: { fontWeight: 600, fontSize: 11 },
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 transition-all duration-200 hover:shadow-md hover:border-border/80 animate-fade-in">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="h-[200px] w-full">{children}</div>
    </div>
  );
}

export default function PerformanceCharts({ apiRows, budget, level = 'campaign' }: Props) {
  const data = useMemo(() => buildChartData(apiRows), [apiRows]);

  const cumulativeData = useMemo(() => {
    let acc = 0;
    return data.map(d => {
      acc += d.spend;
      return { ...d, cumulativeSpend: +acc.toFixed(2) };
    });
  }, [data]);

  if (data.length < 2) {
    return (
      <div className="rounded-lg border border-border p-6 text-center text-muted-foreground text-xs">
        Se necesitan al menos 2 días de datos para mostrar los gráficos.
      </div>
    );
  }

  const primary = level === 'campaign' ? 'hsl(217, 91%, 60%)' : 'hsl(271, 91%, 65%)';
  const secondary = level === 'campaign' ? 'hsl(199, 89%, 48%)' : 'hsl(292, 84%, 61%)';
  const tertiary = level === 'campaign' ? 'hsl(142, 71%, 45%)' : 'hsl(330, 81%, 60%)';
  const quaternary = 'hsl(38, 92%, 50%)';

  const commonXAxis = { dataKey: 'date' as const, tick: { fontSize: 10 }, stroke: 'hsl(var(--muted-foreground))' };
  const commonYAxis = { tick: { fontSize: 10 }, stroke: 'hsl(var(--muted-foreground))', width: 50 };
  const commonGrid = { strokeDasharray: '3 3', stroke: 'hsl(var(--border))' };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <ChartCard title="Gasto acumulado">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={cumulativeData}>
            <CartesianGrid {...commonGrid} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <Tooltip {...tooltipStyle} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="cumulativeSpend" name="Gasto" stroke={primary} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
            {budget && (
              <Line type="monotone" dataKey={() => budget} name="Presupuesto" stroke="hsl(var(--destructive))" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Rendimiento (Clics · Impresiones · Alcance)">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={data}>
            <CartesianGrid {...commonGrid} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <Tooltip {...tooltipStyle} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="clicks" name="Clics" stroke={primary} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="impressions" name="Impresiones" stroke={secondary} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="reach" name="Alcance" stroke={tertiary} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Eficiencia (CTR · CPC · CPM)">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={data}>
            <CartesianGrid {...commonGrid} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <Tooltip {...tooltipStyle} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="ctr" name="CTR %" stroke={primary} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="cpc" name="CPC" stroke={quaternary} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="cpm" name="CPM" stroke={tertiary} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Gasto diario">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={data}>
            <CartesianGrid {...commonGrid} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="spend" name="Gasto/día" stroke={secondary} strokeWidth={2} dot={{ r: 2, fill: secondary }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
