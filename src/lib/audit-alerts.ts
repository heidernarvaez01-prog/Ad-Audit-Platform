import type { AuditMetrics } from './audit-calculations';
import type { ApiCampaignRow } from './api';

export type AlertSeverity = 'info' | 'warning' | 'danger';
export type AlertType = 'RIESGO_SUBEJECUCION' | 'CPC_ELEVADO' | 'SOBREGASTO_CRITICO' | 'CPC_BAJO' | 'PACING_OK';

export interface AuditAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  icon: string;
}

export function generateAlerts(
  metrics: AuditMetrics,
  campaignApiData: ApiCampaignRow[],
  allApiData: ApiCampaignRow[],
): AuditAlert[] {
  const alerts: AuditAlert[] = [];

  // Critical overspend
  if (metrics.pacingPct > 20) {
    alerts.push({
      type: 'SOBREGASTO_CRITICO',
      severity: 'danger',
      message: `Critical overspend: ${metrics.pacingPct.toFixed(1)}% above the expected pace. Reduce daily spend to $${metrics.presupuestoDiarioIdeal.toFixed(2)} to stay on target.`,
      icon: '🔴',
    });
  }

  // Under-execution risk
  if (metrics.diasRestantes > 0 && metrics.gastoDiarioActual > 0) {
    const neededDaily = metrics.presupuestoRestante / metrics.diasRestantes;
    if (neededDaily > 2 * metrics.gastoDiarioActual) {
      alerts.push({
        type: 'RIESGO_SUBEJECUCION',
        severity: 'warning',
        message: `⚠️ Critical under-delivery risk. You need to spend $${neededDaily.toFixed(2)}/day but your current average is $${metrics.gastoDiarioActual.toFixed(2)}/day.`,
        icon: '⚠️',
      });
    }
  }

  // CPC comparison vs account average
  if (campaignApiData.length > 0 && allApiData.length > 0) {
    const campaignClicks = campaignApiData.reduce((s, r) => s + r.metrics.clicks, 0);
    const campaignCost = campaignApiData.reduce((s, r) => s + r.metrics.cost, 0);
    const campaignCpc = campaignClicks > 0 ? campaignCost / campaignClicks : 0;

    const allClicks = allApiData.reduce((s, r) => s + r.metrics.clicks, 0);
    const allCost = allApiData.reduce((s, r) => s + r.metrics.cost, 0);
    const avgCpc = allClicks > 0 ? allCost / allClicks : 0;

    if (campaignCpc > 0 && avgCpc > 0 && campaignCpc > avgCpc * 1.3) {
      const pctAbove = ((campaignCpc - avgCpc) / avgCpc * 100).toFixed(0);
      alerts.push({
        type: 'CPC_ELEVADO',
        severity: 'warning',
        message: `This campaign's CPC ($${campaignCpc.toFixed(2)}) is ${pctAbove}% above the account average ($${avgCpc.toFixed(2)}). Review your targeting.`,
        icon: '📈',
      });
    }
  }

  // Pacing OK encouragement
  if (alerts.length === 0 && metrics.pacingStatus === 'OK') {
    alerts.push({
      type: 'PACING_OK',
      severity: 'info',
      message: 'Spend pacing is within the expected range. All good.',
      icon: '✅',
    });
  }

  return alerts;
}
