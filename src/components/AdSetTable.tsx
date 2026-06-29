import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import PerformanceCharts from '@/components/PerformanceCharts';
import { MetricInfo } from '@/components/MetricInfo';
import type { ApiCampaignRow } from '@/lib/api';
import type { AuditRowData } from '@/components/AuditTable';

interface AdSetRow {
  key: string;
  campaignName: string;
  adsetName: string;
  platform?: string;
  cost: number;
  clicks: number;
  impressions: number;
  reach: number;
  cpc: number;
  cpm: number;
  ctr: number;
  shareOfSpend: number;
  rawRows: ApiCampaignRow[];
}

interface InsightData {
  insight: string;
  riskLevel: 'critical' | 'moderate' | 'none';
}

interface Props {
  auditRows: AuditRowData[];
  apiData: ApiCampaignRow[];
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

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold font-mono text-foreground">{value}</p>
    </div>
  );
}

function ShareBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  return (
    <div className="w-full flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
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

function ExpandedAdSetDetails({
  row,
  campaignBudget,
  insight,
  loadingInsight,
  onGenerateInsight,
}: {
  row: AdSetRow;
  campaignBudget: number;
  insight: InsightData | null;
  loadingInsight: boolean;
  onGenerateInsight: () => void;
}) {
  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Performance Charts */}
      <PerformanceCharts apiRows={row.rawRows} level="adset" />
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 p-3 rounded-md bg-muted/50 border border-border">
        <MetricMini label="Clicks" value={fmtNum(row.clicks)} />
        <MetricMini label="Impressions" value={fmtNum(row.impressions)} />
        <MetricMini label="Reach" value={fmtNum(row.reach)} />
        <MetricMini label="CTR" value={`${row.ctr.toFixed(2)}%`} />
        <MetricMini label="CPC" value={fmt(row.cpc)} />
        <MetricMini label="CPM" value={fmt(row.cpm)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 rounded-md bg-muted/50 border border-border">
        <MetricMini label="Ad Set Spend" value={fmt(row.cost)} />
        <MetricMini label="Campaign Budget" value={fmt(campaignBudget)} />
        <MetricMini label="% of Spend" value={`${row.shareOfSpend.toFixed(1)}%`} />
      </div>

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
    </div>
  );
}

export default function AdSetTable({ auditRows, apiData }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [insights, setInsights] = useState<Record<string, InsightData>>({});
  const [loadingInsights, setLoadingInsights] = useState<Record<string, boolean>>({});

  // Group adsets by campaign
  const campaignGroups = useMemo(() => {
    const groups: {
      campaign: AuditRowData;
      totalCost: number;
      adsets: (AdSetRow & { campaignBudget: number })[];
    }[] = [];

    for (const audit of auditRows) {
      const campaignApiData = audit.campaignApiData;
      const campaignTotalCost = campaignApiData.reduce((s, r) => s + r.metrics.cost, 0);

      const adsetMap = new Map<string, ApiCampaignRow[]>();
      for (const row of campaignApiData) {
        const name = row.adset_name || '(Unnamed)';
        if (!adsetMap.has(name)) adsetMap.set(name, []);
        adsetMap.get(name)!.push(row);
      }

      const adsets: (AdSetRow & { campaignBudget: number })[] = [];
      for (const [adsetName, rows] of adsetMap) {
        const cost = rows.reduce((s, r) => s + r.metrics.cost, 0);
        const clicks = rows.reduce((s, r) => s + r.metrics.clicks, 0);
        const impressions = rows.reduce((s, r) => s + r.metrics.impressions, 0);
        const reach = rows.reduce((s, r) => s + r.metrics.reach, 0);
        const cpc = clicks > 0 ? cost / clicks : 0;
        const cpm = impressions > 0 ? (cost / impressions) * 1000 : 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const shareOfSpend = campaignTotalCost > 0 ? (cost / campaignTotalCost) * 100 : 0;

        adsets.push({
          key: `${audit.id}__${adsetName}`,
          campaignName: audit.campaign_name,
          adsetName,
          platform: audit.platform,
          cost,
          clicks,
          impressions,
          reach,
          cpc,
          cpm,
          ctr,
          shareOfSpend,
          rawRows: rows,
          campaignBudget: audit.presupuesto_total,
        });
      }

      adsets.sort((a, b) => b.cost - a.cost);
      groups.push({ campaign: audit, totalCost: campaignTotalCost, adsets });
    }

    return groups;
  }, [auditRows]);

  const toggleExpand = (key: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateInsight = async (row: AdSetRow & { campaignBudget: number }) => {
    setLoadingInsights(prev => ({ ...prev, [row.key]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('audit-insight', {
        body: {
          campaignData: {
            campaignName: `${row.campaignName} › ${row.adsetName}`,
            platform: row.platform,
            presupuestoTotal: row.campaignBudget.toFixed(2),
            gastoActual: row.cost.toFixed(2),
            presupuestoRestante: (row.campaignBudget - row.cost).toFixed(2),
            diasTranscurridos: '-',
            diasRestantes: '-',
            pacingStatus: 'N/A (Ad Set)',
            pacingPct: row.shareOfSpend.toFixed(1),
            gastoDiarioActual: '-',
            presupuestoDiarioIdeal: '-',
            ctr: row.ctr.toFixed(2),
            cpc: row.cpc.toFixed(2),
            impressions: row.impressions,
            clicks: row.clicks,
            reach: row.reach,
          },
        },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setInsights(prev => ({ ...prev, [row.key]: data as InsightData }));
    } catch {
      toast.error('Error generating AI insight');
    } finally {
      setLoadingInsights(prev => ({ ...prev, [row.key]: false }));
    }
  };

  if (campaignGroups.length === 0 || campaignGroups.every(g => g.adsets.length === 0)) {
    return (
      <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
        <p className="text-sm">No ad sets available.</p>
        <p className="text-xs mt-1">Add campaigns in the Campaigns tab to see their ad sets.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: nested accordion */}
      <div className="md:hidden space-y-3">
        {campaignGroups.map(group => {
          const isCampaignOpen = expandedCampaigns.has(group.campaign.id);
          const m = group.campaign.metrics;
          const statusClass = m.pacingStatus === 'SOBREGASTANDO'
            ? 'text-destructive'
            : m.pacingStatus === 'SUBGASTANDO'
              ? 'text-warning'
              : 'text-success';
          return (
            <Collapsible
              key={group.campaign.id}
              open={isCampaignOpen}
              onOpenChange={() => toggleCampaign(group.campaign.id)}
            >
              <div className={`border border-border rounded-lg bg-card overflow-hidden transition-all duration-200 ${isCampaignOpen ? 'shadow-md' : 'hover:shadow-sm'}`}>
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <PlatformBadge platform={group.campaign.platform} />
                        <span className="text-sm font-bold text-foreground truncate">{group.campaign.campaign_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className={`font-semibold ${statusClass}`}>
                          {m.pacingStatus === 'OK' ? '● On Track' : m.pacingStatus === 'SOBREGASTANDO' ? '● Overspending' : '● Underspending'}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{group.adsets.length} ad sets</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-mono text-foreground">{fmt(group.totalCost)}</span>
                      </div>
                    </div>
                    {isCampaignOpen
                      ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border divide-y divide-border bg-muted/10 animate-fade-in">
                    {group.adsets.map(row => {
                      const isExpanded = expandedIds.has(row.key);
                      const insight = insights[row.key] || null;
                      return (
                        <Collapsible
                          key={row.key}
                          open={isExpanded}
                          onOpenChange={() => toggleExpand(row.key)}
                        >
                          <CollapsibleTrigger asChild>
                            <button className="w-full text-left p-3 hover:bg-accent/30 transition-colors space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-foreground truncate">
                                  <span className="text-muted-foreground mr-1">↳</span>
                                  {row.adsetName}
                                </span>
                                {isExpanded
                                  ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                              </div>
                              <ShareBar pct={row.shareOfSpend} />
                              <div className="grid grid-cols-3 gap-2">
                                <MetricMini label="Spend" value={fmt(row.cost)} />
                                <MetricMini label="CPC" value={fmt(row.cpc)} />
                                <MetricMini label="CTR" value={`${row.ctr.toFixed(2)}%`} />
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="bg-accent/10 animate-fade-in">
                              <ExpandedAdSetDetails
                                row={row}
                                campaignBudget={row.campaignBudget}
                                insight={insight}
                                loadingInsight={loadingInsights[row.key] || false}
                                onGenerateInsight={() => generateInsight(row)}
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>

      {/* Desktop: full table */}
      <div
        className="hidden md:block border border-border rounded-lg overflow-auto scrollbar-visible"
        style={{ maxHeight: 'calc(100vh - 230px)' }}
      >
        <table className="w-full caption-bottom text-sm min-w-[800px]">
        <TableHeader className="sticky top-0 z-20 bg-card [&_tr]:bg-card">

          <TableRow className="bg-muted/50">
            <TableHead className="w-8"></TableHead>
            <TableHead className="text-xs">Platform</TableHead>
            <TableHead className="text-xs">Name</TableHead>
            <TableHead className="text-xs w-36">
              % of Spend
              <MetricInfo label="Share of spend">
                Percentage of the campaign's total spend consumed by this ad set. Useful for spotting budget concentration.
              </MetricInfo>
            </TableHead>
            <TableHead className="text-xs text-right">
              Spend
              <MetricInfo label="Ad set spend">
                Sum of platform-reported spend for this ad set during the audited period.
              </MetricInfo>
            </TableHead>
            <TableHead className="text-xs text-right">
              CPC
              <MetricInfo label="Cost per click">
                Total spend / clicks. Measures efficiency: the lower the CPC, the more clicks for the same budget.
              </MetricInfo>
            </TableHead>
            <TableHead className="text-xs text-right">
              CTR
              <MetricInfo label="Click-through rate">
                Clicks / impressions × 100. Measures how engaging the creative is. Benchmarks vary by platform and industry.
              </MetricInfo>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaignGroups.map(group => {
            const isCampaignOpen = expandedCampaigns.has(group.campaign.id);
            const m = group.campaign.metrics;
            const statusClass = m.pacingStatus === 'SOBREGASTANDO'
              ? 'text-destructive'
              : m.pacingStatus === 'SUBGASTANDO'
                ? 'text-warning'
                : 'text-success';

            return (
              <>
                {/* Campaign row (Level 1) */}
                <TableRow
                  key={`camp-${group.campaign.id}`}
                  className="cursor-pointer bg-muted/40 hover:bg-muted/60 transition-colors border-t-2 border-border"
                  onClick={() => toggleCampaign(group.campaign.id)}
                >
                  <TableCell className="px-2">
                    {isCampaignOpen
                      ? <ChevronDown className="h-4 w-4 text-foreground" />
                      : <ChevronRight className="h-4 w-4 text-foreground" />
                    }
                  </TableCell>
                  <TableCell>
                    <PlatformBadge platform={group.campaign.platform} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-bold text-foreground">
                      {group.campaign.campaign_name}
                    </span>
                    <span className={`ml-2 text-[10px] font-semibold ${statusClass}`}>
                      {m.pacingStatus === 'OK' ? '● On Track' : m.pacingStatus === 'SOBREGASTANDO' ? '● Overspending' : '● Underspending'}
                    </span>
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                    {fmt(group.totalCost)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[10px] text-muted-foreground">
                    Budget: {fmt(group.campaign.presupuesto_total)}
                  </TableCell>
                  <TableCell className="text-right text-[10px] text-muted-foreground">
                    {group.adsets.length} adsets
                  </TableCell>
                </TableRow>

                {/* AdSet rows (Level 2) */}
                {isCampaignOpen && group.adsets.map(row => {
                  const isExpanded = expandedIds.has(row.key);
                  const insight = insights[row.key] || null;
                  return (
                    <Collapsible key={row.key} open={isExpanded} onOpenChange={() => toggleExpand(row.key)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-accent/30 transition-colors">
                            <TableCell className="px-2 pl-6">
                              {isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              }
                            </TableCell>
                            <TableCell>
                              <span className="text-[10px] text-muted-foreground">↳</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-foreground/80 truncate max-w-[220px] block pl-2">
                                {row.adsetName}
                              </span>
                            </TableCell>
                            <TableCell>
                              <ShareBar pct={row.shareOfSpend} />
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-foreground/80">
                              {fmt(row.cost)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-foreground/80">
                              {fmt(row.cpc)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-foreground/80">
                              {row.ctr.toFixed(2)}%
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={7} className="p-0 bg-accent/10">
                              <div className="pl-8">
                                <ExpandedAdSetDetails
                                  row={row}
                                  campaignBudget={row.campaignBudget}
                                  insight={insight}
                                  loadingInsight={loadingInsights[row.key] || false}
                                  onGenerateInsight={() => generateInsight(row)}
                                />
                              </div>
                            </td>
                          </tr>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
              </>
            );
          })}
        </TableBody>
        </table>
      </div>
    </>
  );
}
