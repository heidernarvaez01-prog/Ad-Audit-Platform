import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchCampaignData, getCampaignCost, clearCampaignDataCache } from '@/lib/api';
import { calculateAuditMetrics } from '@/lib/audit-calculations';
import { generateAlerts } from '@/lib/audit-alerts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, LayoutGrid, Layers } from 'lucide-react';
import AuditForm from '@/components/AuditForm';
import AuditTable, { type AuditRowData } from '@/components/AuditTable';
import AdSetTable from '@/components/AdSetTable';
import { Sparkline } from '@/components/Sparkline';
import type { ApiCampaignRow } from '@/lib/api';
import { toast } from 'sonner';

export default function AuditPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [apiData, setApiData] = useState<ApiCampaignRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [viewMode, setViewMode] = useState<'campaigns' | 'adsets'>('campaigns');
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadRecords = useCallback(async () => {
    const { data } = await supabase.from('audit_records').select('*').order('created_at', { ascending: false });
    setRecords(data || []);
  }, []);

  const loadApiData = useCallback(async () => {
    try {
      const data = await fetchCampaignData();
      setApiData(data);
    } catch {
      toast.error('Error conectando con la API de campañas');
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    loadRecords();
    (async () => {
      try {
        await loadApiData();
        setHasLoaded(true);
      } catch {
        /* handled in loadApiData */
      }
    })();
  }, [loadRecords, loadApiData]);

  // Optimistic inline update for editable cells (dates, calendar, budget)
  const handleUpdateRecord = useCallback(
    async (id: string, patch: Partial<{ fecha_inicio: string; fecha_fin: string; tipo_calendario: string; presupuesto_total: number }>) => {
      setRecords(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
      const { error } = await supabase.from('audit_records').update(patch).eq('id', id);
      if (error) {
        toast.error('Error guardando cambios');
        loadRecords();
      }
    },
    [loadRecords],
  );
  const handleDelete = async (id: string) => {
    await supabase.from('audit_records').delete().eq('id', id);
    loadRecords();
    toast.success('Registro eliminado');
  };

  // Build audit rows with metrics + alerts
  const auditRows: AuditRowData[] = useMemo(() => {
    // Cap end: exclude today and yesterday (partial/in-flight data not yet consolidated)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoffDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
    const yyyy = cutoffDate.getFullYear();
    const mm = String(cutoffDate.getMonth() + 1).padStart(2, '0');
    const dd = String(cutoffDate.getDate()).padStart(2, '0');
    const cutoff = `${yyyy}-${mm}-${dd}`;

    return records.map(rec => {
      const effectiveEnd = rec.fecha_fin < cutoff ? rec.fecha_fin : cutoff;
      const campaignApiData = apiData.filter(r =>
        r.campaign_name === rec.campaign_name &&
        r.date >= rec.fecha_inicio &&
        r.date <= effectiveEnd
      );
      const cost = campaignApiData.reduce((s, r) => s + (isNaN(r.metrics.cost) ? 0 : r.metrics.cost), 0);
      const metrics = calculateAuditMetrics(
        Number(rec.presupuesto_total),
        rec.fecha_inicio,
        rec.fecha_fin,
        rec.tipo_calendario,
        cost,
      );
      const alerts = generateAlerts(metrics, campaignApiData, apiData);
      return {
        ...rec,
        presupuesto_total: Number(rec.presupuesto_total),
        platform: rec.platform || undefined,
        metrics,
        alerts,
        campaignApiData,
      };
    });
  }, [records, apiData]);

  // Dynamic platform tabs from user's audit records
  const platformTabs = useMemo(() => {
    const platforms = [...new Set(auditRows.map(r => r.platform).filter(Boolean))] as string[];
    return platforms.sort();
  }, [auditRows]);

  // Filter rows by tab
  const filteredRows = useMemo(() => {
    if (activeTab === 'general') return auditRows;
    return auditRows.filter(r => r.platform === activeTab);
  }, [auditRows, activeTab]);

  // Summary + sparkline series
  const summary = useMemo(() => {
    const total = auditRows.reduce((s, r) => s + r.presupuesto_total, 0);
    const spent = auditRows.reduce((s, r) => s + r.metrics.gastoActual, 0);
    const over = auditRows.filter(r => r.metrics.pacingStatus === 'SOBREGASTANDO').length;
    const under = auditRows.filter(r => r.metrics.pacingStatus === 'SUBGASTANDO').length;
    const ok = auditRows.filter(r => r.metrics.pacingStatus === 'OK').length;

    // Daily aggregated spend across all audited campaigns (sorted ASC, cumulative)
    const dailyMap = new Map<string, number>();
    for (const row of auditRows) {
      for (const api of row.campaignApiData) {
        const cost = isNaN(api.metrics.cost) ? 0 : api.metrics.cost;
        dailyMap.set(api.date, (dailyMap.get(api.date) || 0) + cost);
      }
    }
    const dailyKeys = [...dailyMap.keys()].sort();
    const dailySpend = dailyKeys.map(k => dailyMap.get(k) || 0);
    let cum = 0;
    const cumulativeSpend = dailySpend.map(v => (cum += v));

    return { total, spent, over, under, ok, dailySpend, cumulativeSpend };
  }, [auditRows]);

  // No full-page loader — show empty state instead when not loaded

  return (
    <div className="space-y-5 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-foreground">Matriz de Auditoría</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pacing de gasto vs presupuesto aprobado por campaña
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { setEditRecord(null); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nueva Auditoría
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {auditRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="Presupuesto Total" value={`$${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} hint="Suma del presupuesto aprobado de todas las campañas auditadas." />
          <SummaryCard
            label="Gasto Total"
            value={`$${summary.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            hint="Suma del gasto real consolidado (excluye hoy y ayer). El sparkline muestra el gasto acumulado día a día."
            sparkline={summary.cumulativeSpend}
            sparklineColor="text-primary"
          />
          <SummaryCard label="En Ruta" value={summary.ok.toString()} color="text-success" hint="Campañas dentro del ±10% del pacing ideal." pulse={summary.ok > 0} pulseColor="bg-success" />
          <SummaryCard label="Subgastando" value={summary.under.toString()} color="text-warning" hint="Campañas gastando menos del 90% del ideal — riesgo de no agotar presupuesto." />
          <SummaryCard label="Sobregastando" value={summary.over.toString()} color="text-destructive" hint="Campañas gastando más del 110% del ideal — riesgo de agotar antes." />
        </div>
      )}

      {/* Audit table is always visible — even when API data hasn't loaded yet */}
      {(
        /* Top-level view mode tabs */
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'campaigns' | 'adsets')}>
          <TabsList className="w-full sm:w-auto flex">
            <TabsTrigger value="campaigns" className="text-xs gap-1.5 flex-1 sm:flex-none">
              <LayoutGrid className="h-3.5 w-3.5" />
              Campañas
            </TabsTrigger>
            <TabsTrigger value="adsets" className="text-xs gap-1.5 flex-1 sm:flex-none">
              <Layers className="h-3.5 w-3.5" />
              Conjuntos de Anuncios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-3">
            {/* Platform filter tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="overflow-x-auto">
                <TabsList>
                  <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
                  {platformTabs.map(p => (
                    <TabsTrigger key={p} value={p} className="text-xs capitalize">{p}</TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <TabsContent value={activeTab} className="mt-3">
                <AuditTable
                  rows={filteredRows}
                  onEdit={(row) => { setEditRecord(row); setShowForm(true); }}
                  onDelete={handleDelete}
                  onUpdateRecord={handleUpdateRecord}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="adsets" className="mt-3">
            <AdSetTable auditRows={auditRows} apiData={apiData} />
          </TabsContent>
        </Tabs>
      )}

      {showForm && (
        <AuditForm
          open={showForm}
          onClose={() => { setShowForm(false); setEditRecord(null); }}
          onSaved={() => { setShowForm(false); setEditRecord(null); loadRecords(); }}
          editRecord={editRecord}
          apiData={apiData}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  hint,
  sparkline,
  sparklineColor,
  pulse,
  pulseColor,
}: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
  sparkline?: number[];
  sparklineColor?: string;
  pulse?: boolean;
  pulseColor?: string;
}) {
  const card = (
    <div className="border border-border rounded-lg bg-card p-3 cursor-help relative overflow-hidden">
      <div className="flex items-center gap-1.5">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${pulseColor || 'bg-success'}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${pulseColor || 'bg-success'}`} />
          </span>
        )}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-2 mt-1">
        <p className={`text-lg font-bold font-mono leading-tight ${color || 'text-foreground'}`}>{value}</p>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} width={70} height={24} className={sparklineColor || 'text-primary'} />
        )}
      </div>
    </div>
  );
  if (!hint) return card;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}
