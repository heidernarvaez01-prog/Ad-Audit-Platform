import { supabase } from '@/integrations/supabase/client';

export interface ApiCampaignRow {
  account_id: string;
  account_name: string;
  campaign_name: string;
  adset_name: string;
  platform: string;
  date: string;
  metrics: {
    cost: number;
    clicks: number;
    impressions: number;
    reach: number;
    cpc: number;
    cpm: number;
  };
}

let cachedData: ApiCampaignRow[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export function clearCampaignDataCache() {
  cachedData = null;
  cacheTime = 0;
}

export async function fetchCampaignData(): Promise<ApiCampaignRow[]> {
  const now = Date.now();
  if (cachedData && now - cacheTime < CACHE_TTL) return cachedData;

  const PAGE = 1000;
  const all: any[] = [];
  let from = 0;
  // Paginate through sheet_sync_data (Supabase caps at 1000 rows per query)
  while (true) {
    const { data, error } = await supabase
      .from('sheet_sync_data')
      .select('account_id, account_name, campaign_name, adset_name, platform, date, cost, clicks, impressions, reach, cpc, cpm')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  cachedData = all.map((r: any) => ({
    account_id: r.account_id ?? '',
    account_name: r.account_name ?? '',
    campaign_name: r.campaign_name ?? '',
    adset_name: r.adset_name ?? '',
    platform: r.platform ?? '',
    date: r.date ?? '',
    metrics: {
      cost: Number(r.cost) || 0,
      clicks: Number(r.clicks) || 0,
      impressions: Number(r.impressions) || 0,
      reach: Number(r.reach) || 0,
      cpc: Number(r.cpc) || 0,
      cpm: Number(r.cpm) || 0,
    },
  }));
  cacheTime = now;
  return cachedData!;
}

export function getUniqueCampaignNames(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map(r => r.campaign_name).filter(Boolean))].sort();
}

export function getUniqueAccountIds(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map(r => r.account_id).filter(Boolean))].sort();
}

export function getUniquePlatforms(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map(r => r.platform).filter(Boolean))].sort();
}

export function getUniqueAccountNames(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map(r => r.account_name).filter(Boolean))].sort();
}

export function getCampaignCost(
  data: ApiCampaignRow[],
  campaignName: string,
  startDate: string,
  endDate: string
): number {
  return data
    .filter(r => {
      if (r.campaign_name !== campaignName) return false;
      const d = r.date;
      return d >= startDate && d <= endDate;
    })
    .reduce((sum, r) => sum + (isNaN(r.metrics.cost) ? 0 : r.metrics.cost), 0);
}
