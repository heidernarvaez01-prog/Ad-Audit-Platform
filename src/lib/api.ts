const API_URL = 'https://script.googleusercontent.com/a/macros/apachestudio.mx/echo?user_content_key=AWDtjMUeI_PaXfeETgAgk5airY4QxBiPU0-YO6QlNj2tocYs-0-KCOlKHvJgkVZvrvLfRF0QCVTwCMMHKuoWpiJ15VSaSkWiFVcJsWmVJRtzI2uF-eYCkwFenAN6MvYcidee7iT_Pfxyn7BymO5y9CC7lNWb2fqm1ZKvUW6raXowDHhpcMdQXXNUokLf53wVpznUv0TfgmvqcHzD_eLoXWAEpspWKcWG5pxgD6WygwmqWnMM2ySC_0A7pQXTjKiDxHrxRXLUtWoxwatPWZaPwPq1DUMUNs0YrJVB0VOKN4NCLySZgHkueYd3ph5zrSqkTAxf3i5vEyjh_SHtFiIHz93gq8GzN5PqPw&lib=Mkla_1qOnI1LwbK8wb2ccIbjB8koU5FJZ';

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

function normalizeDate(raw: string): string {
  if (!raw) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // MM/DD/YYYY fallback
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(raw)) {
    const [d, m, y] = raw.split('/');
    return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try Date parse
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return raw;
}

let cachedData: ApiCampaignRow[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function fetchCampaignData(): Promise<ApiCampaignRow[]> {
  const now = Date.now();
  if (cachedData && now - cacheTime < CACHE_TTL) return cachedData;

  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const raw = await res.json();

  // Handle different possible response shapes
  let data: any[] = [];
  if (Array.isArray(raw)) {
    data = raw;
  } else if (raw.data && Array.isArray(raw.data)) {
    data = raw.data;
  } else if (raw.results && Array.isArray(raw.results)) {
    data = raw.results;
  }

  // Normalize rows
  cachedData = data.map((row: any) => ({
    account_id: row.account_id || row.accountId || '',
    account_name: row.account_name || row.accountName || '',
    campaign_name: row.campaign_name || row.campaignName || '',
    adset_name: row.adset_name || row.adsetName || row.ad_set_name || '',
    platform: row.platform || '',
    date: normalizeDate(row.date || row.Date || ''),
    metrics: {
      cost: parseFloat(row.metrics?.cost ?? row.cost ?? 0),
      clicks: parseInt(row.metrics?.clicks ?? row.clicks ?? 0, 10) || 0,
      impressions: parseInt(row.metrics?.impressions ?? row.impressions ?? 0, 10) || 0,
      reach: parseInt(row.metrics?.reach ?? row.reach ?? 0, 10) || 0,
      cpc: parseFloat(row.metrics?.cpc ?? row.cpc ?? 0) || 0,
      cpm: parseFloat(row.metrics?.cpm ?? row.cpm ?? 0) || 0,
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
