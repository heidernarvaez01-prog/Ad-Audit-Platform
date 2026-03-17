import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchCsv, CsvRow } from '@/lib/csv';
import { PLATFORM_CONFIG, PLATFORMS } from '@/lib/platforms';
import { countBusinessDays, countRemainingBusinessDays, countElapsedBusinessDays } from '@/lib/business-days';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Plus, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import LinkCampaignModal from '@/components/LinkCampaignModal';
import type { Database } from '@/integrations/supabase/types';

type Campaign = Database['public']['Tables']['campaign_tracking']['Row'];
type Platform = Database['public']['Enums']['ad_platform'];

interface AuditRow extends Campaign {
  cost: number;
  pctSpent: number;
  balance: number;
  pctExpected: number;
  scheduledDays: number;
  remainingDays: number;
  alertLevel: 'ok' | 'critical' | 'pending';
  alertMessage: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [csvData, setCsvData] = useState<Record<Platform, CsvRow[]>>({} as any);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'critical' | 'pending'>('all');

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    
    // Load campaigns
    const { data: camps } = await supabase.from('campaign_tracking').select('*').eq('user_id', user.id);
    setCampaigns(camps || []);

    // Load data sources and fetch CSVs
    const { data: sources } = await supabase.from('data_sources').select('*').eq('user_id', user.id).eq('is_valid', true);
    const csvMap: Record<string, CsvRow[]> = {};
    if (sources) {
      await Promise.all(sources.map(async (src) => {
        try {
          csvMap[src.platform] = await fetchCsv(src.csv_url);
        } catch {
          csvMap[src.platform] = [];
        }
      }));
    }
    setCsvData(csvMap as any);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const today = new Date();

  const auditRows: AuditRow[] = useMemo(() => {
    return campaigns.map(camp => {
      const platformRows = csvData[camp.platform] || [];
      
      // Filter CSV rows by campaign name and date range
      const matchedRows = platformRows.filter(row => {
        const name = row['Campaign name'] || row['campaign_name'] || row['Campaign'] || row['Nombre de la campaña'] || '';
        if (name.toLowerCase() !== camp.campaign_name.toLowerCase()) return false;
        
        const dateStr = row['Day'] || row['Date'] || row['Fecha'] || '';
        if (!dateStr) return true;
        
        const rowDate = dateStr;
        const inCampaignRange = rowDate >= camp.start_date && rowDate <= camp.end_date;
        const inFilterRange = (!dateFrom || rowDate >= dateFrom) && (!dateTo || rowDate <= dateTo);
        return inCampaignRange && inFilterRange;
      });

      // Sum cost
      const cost = matchedRows.reduce((sum, row) => {
        const val = parseFloat(row['Amount spent'] || row['Cost'] || row['Costo'] || row['Spend'] || '0');
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      const scheduledDays = countBusinessDays(camp.start_date, camp.end_date, camp.lab_days);
      const remainingDays = countRemainingBusinessDays(today, camp.end_date, camp.lab_days);
      const elapsedDays = countElapsedBusinessDays(camp.start_date, today, camp.lab_days);
      
      const pctSpent = camp.budget_approved > 0 ? (cost / camp.budget_approved) * 100 : 0;
      const balance = camp.budget_approved - cost;
      const pctExpected = scheduledDays > 0 ? (elapsedDays / scheduledDays) * 100 : 0;

      let alertLevel: 'ok' | 'critical' | 'pending' = 'ok';
      let alertMessage = 'OK';

      if (pctSpent > pctExpected + 10) {
        alertLevel = 'critical';
        alertMessage = `Gasto (${pctSpent.toFixed(1)}%) excede lo esperado (${pctExpected.toFixed(1)}%) por +10%`;
      }
      if (camp.budget_approved !== camp.programmed_budget) {
        alertLevel = alertLevel === 'critical' ? 'critical' : 'pending';
        alertMessage += alertLevel === 'critical' ? ' | ' : '';
        alertMessage += `Presupuesto aprobado (${camp.budget_approved}) ≠ programado (${camp.programmed_budget})`;
      }

      return { ...camp, cost, pctSpent, balance, pctExpected, scheduledDays, remainingDays, alertLevel, alertMessage };
    });
  }, [campaigns, csvData, dateFrom, dateTo]);

  const filteredRows = useMemo(() => {
    return auditRows.filter(row => {
      if (accountFilter && row.account_name?.toLowerCase().indexOf(accountFilter.toLowerCase()) === -1) return false;
      if (statusFilter !== 'all' && row.alertLevel !== statusFilter) return false;
      return true;
    });
  }, [auditRows, accountFilter, statusFilter]);

  const accounts = useMemo(() => {
    const set = new Set(campaigns.map(c => c.account_name).filter(Boolean));
    return Array.from(set) as string[];
  }, [campaigns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Dashboard de Auditoría</h2>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-1" /> Vincular Campaña
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-xs" />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8 text-xs" />
        </div>
        <Select value={accountFilter || 'all'} onValueChange={v => setAccountFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Todas las cuentas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuentas</SelectItem>
            {accounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-foreground">Plataforma</th>
              <th className="text-left px-3 py-2 font-semibold text-foreground">Campaña</th>
              <th className="text-left px-3 py-2 font-semibold text-foreground">Cuenta</th>
              <th className="text-left px-3 py-2 font-semibold text-foreground">Inicio</th>
              <th className="text-left px-3 py-2 font-semibold text-foreground">Fin</th>
              <th className="text-center px-3 py-2 font-semibold text-foreground">Lab Days</th>
              <th className="text-right px-3 py-2 font-semibold text-foreground">Sched.</th>
              <th className="text-right px-3 py-2 font-semibold text-foreground">Rem.</th>
              <th className="text-right px-3 py-2 font-semibold text-foreground">Costo</th>
              <th className="text-right px-3 py-2 font-semibold text-foreground">% Spent</th>
              <th className="text-right px-3 py-2 font-semibold text-foreground">Balance</th>
              <th className="text-right px-3 py-2 font-semibold text-foreground">% Expected</th>
              <th className="text-center px-3 py-2 font-semibold text-foreground">Alerta</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-8 text-muted-foreground">
                  No hay campañas vinculadas. Haz clic en "+ Vincular Campaña" para comenzar.
                </td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                  <td className="px-3 py-2">
                    <span className={`font-semibold ${PLATFORM_CONFIG[row.platform].color}`}>
                      {PLATFORM_CONFIG[row.platform].label}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground max-w-[200px] truncate">{row.campaign_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.account_name || '—'}</td>
                  <td className="px-3 py-2 font-mono-data text-muted-foreground">{row.start_date}</td>
                  <td className="px-3 py-2 font-mono-data text-muted-foreground">{row.end_date}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {row.lab_days === 'mon_fri' ? 'L-V' : row.lab_days === 'mon_sat' ? 'L-S' : 'Todos'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono-data">{row.scheduledDays}</td>
                  <td className="px-3 py-2 text-right font-mono-data">{row.remainingDays}</td>
                  <td className="px-3 py-2 text-right font-mono-data font-medium">${row.cost.toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right font-mono-data">{row.pctSpent.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono-data">${row.balance.toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right font-mono-data">{row.pctExpected.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-center">
                    {row.alertLevel === 'ok' ? (
                      <span className="text-success font-semibold">OK</span>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertCircle className={`h-4 w-4 inline ${row.alertLevel === 'critical' ? 'text-destructive' : 'text-warning'}`} />
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs text-xs">
                          {row.alertMessage}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <LinkCampaignModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadData(); }}
        />
      )}
    </div>
  );
}
