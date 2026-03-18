import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchCampaignData, getCampaignCost, getUniqueAccountIds } from '@/lib/api';
import { calculateAuditMetrics } from '@/lib/audit-calculations';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import AuditForm from '@/components/AuditForm';
import AuditTable, { type AuditRowData } from '@/components/AuditTable';
import CampaignSummaryTable from '@/components/CampaignSummaryTable';
import type { ApiCampaignRow } from '@/lib/api';
import { toast } from 'sonner';

export default function AuditPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [apiData, setApiData] = useState<ApiCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [accountFilter, setAccountFilter] = useState<string>('all');

  const loadRecords = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('audit_records').select('*').eq('user_id', user.id);
    setRecords(data || []);
  }, [user]);

  const loadApiData = useCallback(async () => {
    try {
      const data = await fetchCampaignData();
      setApiData(data);
    } catch {
      toast.error('Error conectando con la API de campañas');
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await loadRecords();
    setLoading(false);
  }, [loadRecords]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadApiData();
    setRefreshing(false);
    toast.success('Datos actualizados');
  };

  const handleDelete = async (id: string) => {
    await supabase.from('audit_records').delete().eq('id', id);
    loadRecords();
    toast.success('Registro eliminado');
  };

  const accountIds = useMemo(() => getUniqueAccountIds(apiData), [apiData]);

  const auditRows: AuditRowData[] = useMemo(() => {
    return records
      .filter(r => accountFilter === 'all' || r.account_id === accountFilter)
      .map(rec => {
        const cost = getCampaignCost(apiData, rec.campaign_name, rec.fecha_inicio, rec.fecha_fin);
        const metrics = calculateAuditMetrics(
          Number(rec.presupuesto_total),
          rec.fecha_inicio,
          rec.fecha_fin,
          rec.tipo_calendario,
          cost,
        );
        return { ...rec, presupuesto_total: Number(rec.presupuesto_total), metrics };
      });
  }, [records, apiData, accountFilter]);

  // Summary stats
  const summary = useMemo(() => {
    const total = auditRows.reduce((s, r) => s + r.presupuesto_total, 0);
    const spent = auditRows.reduce((s, r) => s + r.metrics.gastoActual, 0);
    const over = auditRows.filter(r => r.metrics.pacingStatus === 'SOBREGASTANDO').length;
    const under = auditRows.filter(r => r.metrics.pacingStatus === 'SUBGASTANDO').length;
    const ok = auditRows.filter(r => r.metrics.pacingStatus === 'OK').length;
    return { total, spent, over, under, ok };
  }, [auditRows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Auditoría de Presupuesto</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evalúa el pacing de gasto vs presupuesto de tus campañas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => { setEditRecord(null); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nuevo Registro
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {auditRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="Presupuesto Total" value={`$${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
          <SummaryCard label="Gasto Total" value={`$${summary.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
          <SummaryCard label="OK" value={summary.ok.toString()} color="text-success" />
          <SummaryCard label="Subgastando" value={summary.under.toString()} color="text-warning" />
          <SummaryCard label="Sobregastando" value={summary.over.toString()} color="text-destructive" />
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="Filtrar por cuenta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuentas</SelectItem>
            {accountIds.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{auditRows.length} registros</span>
      </div>

      {/* Audit table/cards */}
      <AuditTable
        rows={auditRows}
        onEdit={(row) => { setEditRecord(row); setShowForm(true); }}
        onDelete={handleDelete}
      />

      {showForm && (
        <AuditForm
          open={showForm}
          onClose={() => { setShowForm(false); setEditRecord(null); }}
          onSaved={() => { setShowForm(false); setEditRecord(null); loadRecords(); }}
          editRecord={editRecord}
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
