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
      message: `Sobregasto crítico: ${metrics.pacingPct.toFixed(1)}% por encima del ritmo esperado. Reduce el gasto diario a $${metrics.presupuestoDiarioIdeal.toFixed(2)} para cumplir el objetivo.`,
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
        message: `⚠️ Riesgo de subejecución crítico. Necesitas gastar $${neededDaily.toFixed(2)}/día pero tu promedio actual es $${metrics.gastoDiarioActual.toFixed(2)}/día.`,
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
        message: `El CPC de esta campaña ($${campaignCpc.toFixed(2)}) está ${pctAbove}% por encima del promedio de la cuenta ($${avgCpc.toFixed(2)}). Revisa la segmentación.`,
        icon: '📈',
      });
    }
  }

  // Pacing OK encouragement
  if (alerts.length === 0 && metrics.pacingStatus === 'OK') {
    alerts.push({
      type: 'PACING_OK',
      severity: 'info',
      message: 'El ritmo de gasto está dentro del rango esperado. Todo en orden.',
      icon: '✅',
    });
  }

  return alerts;
}
