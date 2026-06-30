import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchCampaignData, getCampaignCost, clearCampaignDataCache } from '@/lib/api';
import { buildAuditRows } from '@/lib/audit-helpers';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, LayoutGrid, Layers, ArrowLeft } from 'lucide-react';
import AuditForm from '@/components/AuditForm';
import AuditTable, { type AuditRowData } from '@/components/AuditTable';
import AdSetTable from '@/components/AdSetTable';
import { Sparkline } from '@/components/Sparkline';
import type { ApiCampaignRow } from '@/lib/api';
import { toast } from 'sonner';

export default function AuditPage() {
  const { user } = useAuth();
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [apiData, setApiData] = useState<ApiCampaignRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [viewMode, setViewMode] = useState<'campaigns' | 'adsets'>('campaigns');
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load the client this audit belongs to — audits are isolated per client
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const { data, error } = await supabase.from('audit_clients').select('id, name, description').eq('id', clientId).maybeSingle();
      if (error || !data) {
        toast.error('Client not found');
        navigate('/', { replace: true });
        return;
      }
      setClient(data);
    })();
  }, [clientId, navigate]);

  const loadRecords = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from('audit_records')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setRecords(data || []);
  }, [clientId]);

  const loadApiData = useCallback(async () => {
    try {
      const data = await fetchCampaignData();
      setApiData(data);
    } catch {
      toast.error('Error connecting to the campaigns API');
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
        toast.error('Error saving changes');
        loadRecords();
      }
    },
    [loadRecords],
  );
  const handleDelete = async (id: string) => {
    await supabase.from('audit_records').delete().eq('id', id);
    loadRecords();
    toast.success('Record deleted');
  };

  // Build audit rows with metrics + alerts
  const auditRows: AuditRowData[] = useMemo(
    () => buildAuditRows(records, apiData),
    [records, apiData],
  );

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
        <div className="min-w-0 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="shrink-0 -ml-2" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Clients
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
              {client ? client.name : 'Audit Matrix'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {client?.description || 'Track in real time whether each campaign is spending right and performing well.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { setEditRecord(null); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Audit
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {auditRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard
            label="Total Budget"
            value={`$${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            hint="Sum of the approved budget across all audited campaigns."
            gradient="from-indigo-500 to-indigo-700"
          />
          <SummaryCard
            label="Total Spend"
            value={`$${summary.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            hint="Sum of consolidated actual spend (excludes today and yesterday). The sparkline shows cumulative spend day by day."
            sparkline={summary.cumulativeSpend}
            gradient="from-sky-500 to-sky-700"
          />
          <SummaryCard
            label="On Track"
            value={summary.ok.toString()}
            hint="Campaigns within ±10% of ideal pacing."
            pulse={summary.ok > 0}
            gradient="from-emerald-500 to-emerald-700"
          />
          <SummaryCard
            label="Underspending"
            value={summary.under.toString()}
            hint="Campaigns spending under 90% of ideal — risk of not using the full budget."
            gradient="from-amber-500 to-orange-600"
          />
          <SummaryCard
            label="Overspending"
            value={summary.over.toString()}
            hint="Campaigns spending over 110% of ideal — risk of running out early."
            gradient="from-rose-500 to-red-700"
          />
        </div>
      )}

      {/* Audit table is always visible — even when API data hasn't loaded yet */}
      {(
        /* Top-level view mode tabs */
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'campaigns' | 'adsets')}>
          <TabsList className="w-full sm:w-auto flex">
            <TabsTrigger value="campaigns" className="text-xs gap-1.5 flex-1 sm:flex-none">
              <LayoutGrid className="h-3.5 w-3.5" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="adsets" className="text-xs gap-1.5 flex-1 sm:flex-none">
              <Layers className="h-3.5 w-3.5" />
              Ad Sets
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
              <TabsContent value={activeTab} className="mt-3 space-y-3">
                <AuditTable
                  rows={filteredRows}
                  onEdit={(row) => { setEditRecord(row); setShowForm(true); }}
                  onDelete={handleDelete}
                  onUpdateRecord={handleUpdateRecord}
                />
                <Button
                  variant="outline"
                  className="w-full border-dashed text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setEditRecord(null); setShowForm(true); }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add campaign
                </Button>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="adsets" className="mt-3">
            <AdSetTable auditRows={auditRows} apiData={apiData} />
          </TabsContent>
        </Tabs>
      )}

      {showForm && clientId && (
        <AuditForm
          open={showForm}
          onClose={() => { setShowForm(false); setEditRecord(null); }}
          onSaved={() => { setShowForm(false); setEditRecord(null); loadRecords(); }}
          editRecord={editRecord}
          apiData={apiData}
          clientId={clientId}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  sparkline,
  pulse,
  gradient,
}: {
  label: string;
  value: string;
  hint?: string;
  sparkline?: number[];
  pulse?: boolean;
  gradient?: string;
}) {
  const isGradient = !!gradient;
  const card = (
    <div
      className={`rounded-xl p-4 cursor-help relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 animate-fade-in
        ${isGradient
          ? `bg-gradient-to-br ${gradient} text-white shadow-md`
          : 'border border-border bg-card text-foreground'}`}
    >
      <div className="flex items-center gap-1.5 relative z-10">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-white/80" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
        )}
        <p className={`text-[10px] uppercase tracking-wider ${isGradient ? 'text-white/85' : 'text-muted-foreground'}`}>{label}</p>
      </div>
      <p className={`text-2xl font-bold font-mono leading-tight mt-1 relative z-10 ${isGradient ? 'text-white' : ''}`}>{value}</p>
      {sparkline && sparkline.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 h-10 opacity-80 pointer-events-none">
          <Sparkline data={sparkline} width={300} height={40} className={isGradient ? 'text-white/70' : 'text-primary'} />
        </div>
      )}
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
