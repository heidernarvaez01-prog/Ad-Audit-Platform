import { supabase } from "@/integrations/supabase/client";

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
    ctr: number;
    frequency: number;
    thruplay_actions: number;
  };
}

let cache: { data: ApiCampaignRow[]; ts: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export function clearCampaignDataCache() {
  cache = null;
}

export async function fetchCampaignData(): Promise<ApiCampaignRow[]> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.data;

  const all: ApiCampaignRow[] = [];
  const PAGE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("meta_datos")
      .select(
        "account_id,account_name,campaign_name,adset_name,plataforma,fecha,total_cost,clicks,impressions,reach,cpc,cpm,ctr_all,frequency,thruplay_actions"
      )
      .order("fecha", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("fetchCampaignData error:", error);
      break;
    }
    if (!data || data.length === 0) break;

    for (const r of data) {
      all.push({
        account_id: String(r.account_id ?? ""),
        account_name: String(r.account_name ?? ""),
        campaign_name: String(r.campaign_name ?? ""),
        adset_name: String(r.adset_name ?? ""),
        platform: String(r.plataforma ?? "META"),
        date: String(r.fecha ?? "").slice(0, 10),
        metrics: {
          cost: Number(r.total_cost ?? 0),
          clicks: Number(r.clicks ?? 0),
          impressions: Number(r.impressions ?? 0),
          reach: Number(r.reach ?? 0),
          cpc: Number(r.cpc ?? 0),
          cpm: Number(r.cpm ?? 0),
          ctr: Number(r.ctr_all ?? 0),
          frequency: Number(r.frequency ?? 0),
          thruplay_actions: Number(r.thruplay_actions ?? 0),
        },
      });
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  cache = { data: all, ts: Date.now() };
  return all;
}

export function getUniqueCampaignNames(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map((r) => r.campaign_name).filter(Boolean))].sort();
}

export function getUniqueAccountIds(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map((r) => r.account_id).filter(Boolean))].sort();
}

export function getUniquePlatforms(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map((r) => r.platform).filter(Boolean))].sort();
}

export function getUniqueAccountNames(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map((r) => r.account_name).filter(Boolean))].sort();
}

export function getCampaignCost(
  data: ApiCampaignRow[],
  campaignName: string,
  startDate: string,
  endDate: string
): number {
  return data
    .filter(
      (r) =>
        r.campaign_name === campaignName &&
        r.date >= startDate &&
        r.date <= endDate
    )
    .reduce((sum, r) => sum + (isNaN(r.metrics.cost) ? 0 : r.metrics.cost), 0);
}
