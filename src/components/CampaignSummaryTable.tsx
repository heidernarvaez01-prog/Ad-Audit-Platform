import { useMemo } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import type { ApiCampaignRow } from '@/lib/api';

interface Props {
  data: ApiCampaignRow[];
}

interface CampaignSummary {
  campaign_name: string;
  account_name: string;
  platform: string;
  startDate: string;
  endDate: string;
  totalCost: number;
  totalClicks: number;
  totalImpressions: number;
  avgCpc: number;
  avgCpm: number;
  days: number;
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}

export default function CampaignSummaryTable({ data }: Props) {
  const summaries = useMemo<CampaignSummary[]>(() => {
    const map = new Map<string, {
      account_name: string;
      platform: string;
      dates: string[];
      cost: number;
      clicks: number;
      impressions: number;
    }>();

    for (const row of data) {
      const key = row.campaign_name;
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.dates.push(row.date);
        existing.cost += isNaN(row.metrics.cost) ? 0 : row.metrics.cost;
        existing.clicks += isNaN(row.metrics.clicks) ? 0 : row.metrics.clicks;
        existing.impressions += isNaN(row.metrics.impressions) ? 0 : row.metrics.impressions;
      } else {
        map.set(key, {
          account_name: (row as any).account_name || row.account_id,
          platform: (row as any).platform || '',
          dates: [row.date],
          cost: isNaN(row.metrics.cost) ? 0 : row.metrics.cost,
          clicks: isNaN(row.metrics.clicks) ? 0 : row.metrics.clicks,
          impressions: isNaN(row.metrics.impressions) ? 0 : row.metrics.impressions,
        });
      }
    }

    return Array.from(map.entries()).map(([name, v]) => {
      const sorted = v.dates.sort();
      const days = new Set(sorted).size;
      return {
        campaign_name: name,
        account_name: v.account_name,
        platform: v.platform,
        startDate: sorted[0]?.slice(0, 10) || '',
        endDate: sorted[sorted.length - 1]?.slice(0, 10) || '',
        totalCost: v.cost,
        totalClicks: v.clicks,
        totalImpressions: v.impressions,
        avgCpc: v.clicks > 0 ? v.cost / v.clicks : 0,
        avgCpm: v.impressions > 0 ? (v.cost / v.impressions) * 1000 : 0,
        days,
      };
    }).sort((a, b) => a.campaign_name.localeCompare(b.campaign_name));
  }, [data]);

  if (summaries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        Presiona "Actualizar" para cargar datos de la API.
      </p>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-[10px] uppercase tracking-wider font-semibold h-8 px-2">Campaña</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-semibold h-8 px-2">Cuenta</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-semibold h-8 px-2">Plataforma</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-semibold h-8 px-2">Inicio</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-semibold h-8 px-2">Fin</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-semibold h-8 px-2 text-right">Costo Total</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-semibold h-8 px-2 text-right">Clicks</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-semibold h-8 px-2 text-right">Impresiones</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-semibold h-8 px-2 text-right">CPC</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-semibold h-8 px-2 text-right">CPM</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-semibold h-8 px-2 text-right">Días</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summaries.map((s) => (
            <TableRow key={s.campaign_name} className="hover:bg-muted/30">
              <TableCell className="px-2 py-1.5 text-xs font-medium text-foreground max-w-[200px] truncate">{s.campaign_name}</TableCell>
              <TableCell className="px-2 py-1.5 text-xs text-muted-foreground">{s.account_name}</TableCell>
              <TableCell className="px-2 py-1.5">
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">{s.platform}</span>
              </TableCell>
              <TableCell className="px-2 py-1.5 text-xs text-muted-foreground font-mono">{s.startDate}</TableCell>
              <TableCell className="px-2 py-1.5 text-xs text-muted-foreground font-mono">{s.endDate}</TableCell>
              <TableCell className="px-2 py-1.5 text-xs font-semibold font-mono text-right">{fmt(s.totalCost)}</TableCell>
              <TableCell className="px-2 py-1.5 text-xs font-mono text-right">{fmtNum(s.totalClicks)}</TableCell>
              <TableCell className="px-2 py-1.5 text-xs font-mono text-right">{fmtNum(s.totalImpressions)}</TableCell>
              <TableCell className="px-2 py-1.5 text-xs font-mono text-right">{fmt(s.avgCpc)}</TableCell>
              <TableCell className="px-2 py-1.5 text-xs font-mono text-right">{fmt(s.avgCpm)}</TableCell>
              <TableCell className="px-2 py-1.5 text-xs font-mono text-right">{s.days}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
