import type { AuditMetrics } from './audit-calculations';
import type { ApiCampaignRow } from './api';

export type AlertSeverity = 'info' | 'warning' | 'danger';

// Six high-signal alerts only — no noise, no generic blocks.
export type AlertType =
  | 'OVERSPEND_50'            // 50%+ above expected spend to date
  | 'NOT_SPENDING'            // active campaign with zero recent spend
  | 'ENDING_SOON'             // campaign within 10% of finishing
  | 'COST_SPIKE'              // CPC/CPM up more than 65% vs previous period
  | 'BUDGET_EARLY_DEPLETION'  // budget projected to run out before end date
  | 'CREATIVE_FATIGUE';       // high frequency + falling CTR

export interface AuditAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  icon: string;
}

// Sum a metric over rows within [from, to] (date strings YYYY-MM-DD inclusive)
function sumWindow(
  rows: ApiCampaignRow[],
  from: string,
  to: string,
  pick: (m: ApiCampaignRow['metrics']) => number,
): number {
  return rows
    .filter(r => r.date >= from && r.date <= to)
    .reduce((s, r) => s + (isNaN(pick(r.metrics)) ? 0 : pick(r.metrics)), 0);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function generateAlerts(
  metrics: AuditMetrics,
  campaignApiData: ApiCampaignRow[],
  _allApiData?: ApiCampaignRow[],
): AuditAlert[] {
  const alerts: AuditAlert[] = [];
  const inFlight = metrics.diasRestantes > 0 && metrics.diasTranscurridos > 0;

  // Consolidated data excludes today and yesterday
  const lastConsolidated = isoDaysAgo(2);

  // ── 1. 50%+ above expected spend to date ──────────────────────────────
  if (metrics.gastoEsperado > 0 && metrics.gastoActual >= metrics.gastoEsperado * 1.5) {
    const pctAbove = ((metrics.gastoActual - metrics.gastoEsperado) / metrics.gastoEsperado * 100).toFixed(0);
    alerts.push({
      type: 'OVERSPEND_50',
      severity: 'danger',
      message: `Spending ${pctAbove}% above expected to date ($${metrics.gastoActual.toFixed(2)} vs $${metrics.gastoEsperado.toFixed(2)} expected). Cap daily spend at $${metrics.presupuestoDiarioIdeal.toFixed(2)} to recover pacing.`,
      icon: '🔴',
    });
  }

  // ── 2. Campaign is not spending ───────────────────────────────────────
  if (inFlight && metrics.diasTranscurridos >= 3) {
    const recentSpend = sumWindow(campaignApiData, isoDaysAgo(4), lastConsolidated, m => m.cost);
    if (recentSpend === 0) {
      alerts.push({
        type: 'NOT_SPENDING',
        severity: 'danger',
        message: `No spend registered in the last 3 consolidated days. The campaign may be paused, rejected, or budget-capped — check delivery now.`,
        icon: '⛔',
      });
    }
  }

  // ── 3. Campaign within 10% of finishing ───────────────────────────────
  if (metrics.porcentajeTiempo >= 90 && metrics.diasRestantes > 0) {
    alerts.push({
      type: 'ENDING_SOON',
      severity: 'info',
      message: `Campaign is ${metrics.porcentajeTiempo.toFixed(0)}% through its schedule (${metrics.diasRestantes} day${metrics.diasRestantes === 1 ? '' : 's'} left). Remaining balance: $${metrics.presupuestoRestante.toFixed(2)} — plan renewal or closing actions.`,
      icon: '🏁',
    });
  }

  // ── 4. Costs spiked above 65% ─────────────────────────────────────────
  if (inFlight) {
    const recentFrom = isoDaysAgo(4);
    const prevFrom = isoDaysAgo(11);
    const prevTo = isoDaysAgo(5);

    const rCost = sumWindow(campaignApiData, recentFrom, lastConsolidated, m => m.cost);
    const rClicks = sumWindow(campaignApiData, recentFrom, lastConsolidated, m => m.clicks);
    const rImpr = sumWindow(campaignApiData, recentFrom, lastConsolidated, m => m.impressions);
    const pCost = sumWindow(campaignApiData, prevFrom, prevTo, m => m.cost);
    const pClicks = sumWindow(campaignApiData, prevFrom, prevTo, m => m.clicks);
    const pImpr = sumWindow(campaignApiData, prevFrom, prevTo, m => m.impressions);

    const rCpc = rClicks > 0 ? rCost / rClicks : 0;
    const pCpc = pClicks > 0 ? pCost / pClicks : 0;
    const rCpm = rImpr > 0 ? (rCost / rImpr) * 1000 : 0;
    const pCpm = pImpr > 0 ? (pCost / pImpr) * 1000 : 0;

    if (pCpc > 0 && rCpc > pCpc * 1.65) {
      const pct = ((rCpc - pCpc) / pCpc * 100).toFixed(0);
      alerts.push({
        type: 'COST_SPIKE',
        severity: 'danger',
        message: `CPC jumped ${pct}% vs the previous week ($${rCpc.toFixed(2)} vs $${pCpc.toFixed(2)}). Review targeting, creatives, or auction changes.`,
        icon: '📈',
      });
    } else if (pCpm > 0 && rCpm > pCpm * 1.65) {
      const pct = ((rCpm - pCpm) / pCpm * 100).toFixed(0);
      alerts.push({
        type: 'COST_SPIKE',
        severity: 'danger',
        message: `CPM jumped ${pct}% vs the previous week ($${rCpm.toFixed(2)} vs $${pCpm.toFixed(2)}). Review targeting, creatives, or auction changes.`,
        icon: '📈',
      });
    }
  }

  // ── 5. Budget projected to run out early ──────────────────────────────
  if (inFlight && metrics.gastoDiarioActual > 0 && metrics.presupuestoRestante > 0) {
    const daysUntilDepletion = metrics.presupuestoRestante / metrics.gastoDiarioActual;
    const daysEarly = metrics.diasRestantes - daysUntilDepletion;
    if (daysEarly >= 2) {
      alerts.push({
        type: 'BUDGET_EARLY_DEPLETION',
        severity: 'warning',
        message: `At the current pace ($${metrics.gastoDiarioActual.toFixed(2)}/day), the budget runs out ~${Math.round(daysEarly)} days before the end date. Reduce daily spend to $${metrics.presupuestoDiarioIdeal.toFixed(2)} to last the full period.`,
        icon: '⏳',
      });
    }
  }

  // ── 6. Creative fatigue ───────────────────────────────────────────────
  if (inFlight) {
    const recentRows = campaignApiData.filter(r => r.date >= isoDaysAgo(8) && r.date <= lastConsolidated);
    const prevRows = campaignApiData.filter(r => r.date >= isoDaysAgo(15) && r.date <= isoDaysAgo(9));
    const avgFreq = recentRows.length
      ? recentRows.reduce((s, r) => s + (r.metrics.frequency || 0), 0) / recentRows.length
      : 0;
    const rClicks = recentRows.reduce((s, r) => s + r.metrics.clicks, 0);
    const rImpr = recentRows.reduce((s, r) => s + r.metrics.impressions, 0);
    const pClicks = prevRows.reduce((s, r) => s + r.metrics.clicks, 0);
    const pImpr = prevRows.reduce((s, r) => s + r.metrics.impressions, 0);
    const rCtr = rImpr > 0 ? (rClicks / rImpr) * 100 : 0;
    const pCtr = pImpr > 0 ? (pClicks / pImpr) * 100 : 0;

    if (avgFreq > 4 && pCtr > 0 && rCtr < pCtr * 0.8) {
      alerts.push({
        type: 'CREATIVE_FATIGUE',
        severity: 'warning',
        message: `Creative fatigue: frequency at ${avgFreq.toFixed(1)} and CTR down ${(100 - (rCtr / pCtr) * 100).toFixed(0)}% vs last week (${rCtr.toFixed(2)}% vs ${pCtr.toFixed(2)}%). Time to rotate creatives or refresh audiences.`,
        icon: '🎨',
      });
    }
  }

  return alerts;
}

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  OVERSPEND_50: '50%+ over expected spend',
  NOT_SPENDING: 'Campaign not spending',
  ENDING_SOON: 'Campaign about to end',
  COST_SPIKE: 'Cost spike >65%',
  BUDGET_EARLY_DEPLETION: 'Budget running out early',
  CREATIVE_FATIGUE: 'Creative fatigue',
};
