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
  /** 'campaign' uses primary blues, 'adset' uses purple tones */
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
        date: date.slice(5), // MM-DD
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
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="h-[200px] w-full">
        {children}
      </div>
    </div>
  );
}

export default function PerformanceCharts({ apiRows, budget, level = 'campaign' }: Props) {
  const data = useMemo(() => buildChartData(apiRows), [apiRows]);

  // Cumulative spend for budget line
  const cumulativeData = useMemo(() => {
    let acc = 0;
    return data.map(d => {
      acc += d.spend;
      return { ...d, cumulativeSpend: +acc.toFixed(2) };
    });
  }, [data]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* 1. Spend vs Budget */}
      <ChartCard title="Gasto Acumulado">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={cumulativeData}>
            <CartesianGrid {...commonGrid} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <Tooltip {...tooltipStyle} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="cumulativeSpend"
              name="Gasto"
              stroke={primary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
            {budget && (
              <Line
                type="monotone"
                dataKey={() => budget}
                name="Presupuesto"
                stroke="hsl(var(--destructive))"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. Performance */}
      <ChartCard title="Rendimiento (Clicks · Impressions · Reach)">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={data}>
            <CartesianGrid {...commonGrid} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <Tooltip {...tooltipStyle} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="clicks" name="Clicks" stroke={primary} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="impressions" name="Impressions" stroke={secondary} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="reach" name="Reach" stroke={tertiary} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3. Efficiency */}
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

      {/* 4. Daily Spend */}
      <ChartCard title="Gasto Diario">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={data}>
            <CartesianGrid {...commonGrid} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <Tooltip {...tooltipStyle} />
            <Line
              type="monotone"
              dataKey="spend"
              name="Gasto/día"
              stroke={secondary}
              strokeWidth={2}
              dot={{ r: 2, fill: secondary }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
