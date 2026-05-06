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

export function clearCampaignDataCache() {
  /* no-op: source tables removed */
}

export async function fetchCampaignData(): Promise<ApiCampaignRow[]> {
  return [];
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
    .filter(r => r.campaign_name === campaignName && r.date >= startDate && r.date <= endDate)
    .reduce((sum, r) => sum + (isNaN(r.metrics.cost) ? 0 : r.metrics.cost), 0);
}
