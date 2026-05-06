import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchCampaignData, getCampaignCost, clearCampaignDataCache } from '@/lib/api';
import { calculateAuditMetrics } from '@/lib/audit-calculations';
import { generateAlerts } from '@/lib/audit-alerts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutGrid, Layers } from 'lucide-react';
import AuditForm from '@/components/AuditForm';
import AuditTable, { type AuditRowData } from '@/components/AuditTable';
import AdSetTable from '@/components/AdSetTable';
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

  // Auto-load on mount: records + sync log + sheet data so inline edits recompute live
  useEffect(() => {
    if (!user) return;
    loadRecords();
    (async () => {
      try {
        await loadApiData();
        setHasLoaded(true);
      } catch {
        /* handled in loadApiData */
      }
    })();
  }, [user, loadRecords, loadApiData]);

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
    return records.map(rec => {
      const campaignApiData = apiData.filter(r =>
        r.campaign_name === rec.campaign_name &&
        r.date >= rec.fecha_inicio &&
        r.date <= rec.fecha_fin
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

  // Summary
  const summary = useMemo(() => {
    const total = auditRows.reduce((s, r) => s + r.presupuesto_total, 0);
    const spent = auditRows.reduce((s, r) => s + r.metrics.gastoActual, 0);
    const over = auditRows.filter(r => r.metrics.pacingStatus === 'SOBREGASTANDO').length;
    const under = auditRows.filter(r => r.metrics.pacingStatus === 'SUBGASTANDO').length;
    const ok = auditRows.filter(r => r.metrics.pacingStatus === 'OK').length;
    return { total, spent, over, under, ok };
  }, [auditRows]);

  // No full-page loader — show empty state instead when not loaded

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Matriz de Auditoría</h1>
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
          <SummaryCard label="Presupuesto Total" value={`$${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
          <SummaryCard label="Gasto Total" value={`$${summary.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
          <SummaryCard label="En Ruta" value={summary.ok.toString()} color="text-success" />
          <SummaryCard label="Subgastando" value={summary.under.toString()} color="text-warning" />
          <SummaryCard label="Sobregastando" value={summary.over.toString()} color="text-destructive" />
        </div>
      )}

      {/* Audit table is always visible — even when API data hasn't loaded yet */}
      {(
        /* Top-level view mode tabs */
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'campaigns' | 'adsets')}>
          <TabsList>
            <TabsTrigger value="campaigns" className="text-xs gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" />
              Campañas
            </TabsTrigger>
            <TabsTrigger value="adsets" className="text-xs gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Conjuntos de Anuncios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-3">
            {/* Platform filter tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
                {platformTabs.map(p => (
                  <TabsTrigger key={p} value={p} className="text-xs capitalize">{p}</TabsTrigger>
                ))}
              </TabsList>
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

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-border rounded-lg bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold font-mono ${color || 'text-foreground'}`}>{value}</p>
    </div>
  );
}
