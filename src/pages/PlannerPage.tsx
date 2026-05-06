import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Plus, Trash2, RefreshCw, ChevronsUpDown, Check, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  countBusinessDays,
  countRemainingBusinessDays,
  countElapsedBusinessDays,
} from '@/lib/business-days';

type LabDays = 'mon_fri' | 'mon_sat' | 'all';

interface SheetRow {
  platform: string | null;
  campaign_name: string | null;
  date: string | null;
  cost: number | null;
  clicks: number | null;
  impressions: number | null;
  reach: number | null;
}

interface PlannerRow {
  id: string;
  platform: string;
  campaign_name: string;
  lab_days: LabDays;
  start_date: string;
  end_date: string;
  budget: string; // input as string
}

const STORAGE_KEY = 'planner_rows_v1';

function newRow(): PlannerRow {
  return {
    id: crypto.randomUUID(),
    platform: '',
    campaign_name: '',
    lab_days: 'mon_fri',
    start_date: '',
    end_date: '',
    budget: '',
  };
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number) {
  if (!isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}
function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}

export default function PlannerPage() {
  const [sheetData, setSheetData] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [rows, setRows] = useState<PlannerRow[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return [newRow()];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      /* ignore */
    }
  }, [rows]);

  const loadSheet = useCallback(async () => {
    setLoading(true);
    try {
      const PAGE = 1000;
      const all: SheetRow[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('sheet_sync_data')
          .select('platform, campaign_name, date, cost, clicks, impressions, reach')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as SheetRow[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setSheetData(all);
      setHasLoaded(true);
      toast.success(`${all.length} filas cargadas`);
    } catch {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  const platforms = useMemo(
    () => [...new Set(sheetData.map(r => r.platform).filter(Boolean) as string[])].sort(),
    [sheetData]
  );

  const campaignsByPlatform = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of sheetData) {
      if (!r.platform || !r.campaign_name) continue;
      if (!map.has(r.platform)) map.set(r.platform, []);
      map.get(r.platform)!.push(r.campaign_name);
    }
    const out = new Map<string, string[]>();
    for (const [k, v] of map) out.set(k, [...new Set(v)].sort());
    return out;
  }, [sheetData]);

  // Aggregate metrics per campaign for the selected date range
  const computeMetrics = useCallback(
    (campaign: string, start: string, end: string) => {
      if (!campaign) return { cost: 0, clicks: 0, impressions: 0, reach: 0 };
      let cost = 0, clicks = 0, impressions = 0, reach = 0;
      for (const r of sheetData) {
        if (r.campaign_name !== campaign) continue;
        if (!r.date) continue;
        if (start && r.date < start) continue;
        if (end && r.date > end) continue;
        cost += Number(r.cost) || 0;
        clicks += Number(r.clicks) || 0;
        impressions += Number(r.impressions) || 0;
        reach += Number(r.reach) || 0;
      }
      return { cost, clicks, impressions, reach };
    },
    [sheetData]
  );

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const updateRow = (id: string, patch: Partial<PlannerRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows(prev => (prev.length === 1 ? [newRow()] : prev.filter(r => r.id !== id)));
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Planificador de Pauta</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configura cada campaña y revisa pacing, gasto y métricas en una sola tabla.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMetrics(s => !s)}
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            {showMetrics ? 'Ocultar métricas' : 'Ver métricas'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadSheet} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Cargar datos
          </Button>
          <Button size="sm" onClick={() => setRows(p => [...p, newRow()])}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Agregar fila
          </Button>
        </div>
      </div>

      {!hasLoaded && (
        <div className="border border-border rounded-lg p-6 text-center text-muted-foreground">
          <p className="text-sm">Haz clic en "Cargar datos" para traer las campañas activas.</p>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-xs whitespace-nowrap">Medio</TableHead>
              <TableHead className="text-xs whitespace-nowrap min-w-[220px]">Campaña</TableHead>
              <TableHead className="text-xs whitespace-nowrap">Días laborales</TableHead>
              <TableHead className="text-xs whitespace-nowrap">Fecha inicio</TableHead>
              <TableHead className="text-xs whitespace-nowrap">Fecha fin</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">Días pauta</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">Días restantes</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">Presupuesto</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">$ Gasto</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">% Gasto</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">% Esperado</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">Ideal/día</TableHead>
              {showMetrics && (
                <>
                  <TableHead className="text-xs text-right whitespace-nowrap bg-muted/30">Clicks</TableHead>
                  <TableHead className="text-xs text-right whitespace-nowrap bg-muted/30">Impresiones</TableHead>
                  <TableHead className="text-xs text-right whitespace-nowrap bg-muted/30">Alcance</TableHead>
                  <TableHead className="text-xs text-right whitespace-nowrap bg-muted/30">CTR</TableHead>
                  <TableHead className="text-xs text-right whitespace-nowrap bg-muted/30">CPC</TableHead>
                  <TableHead className="text-xs text-right whitespace-nowrap bg-muted/30">CPM</TableHead>
                </>
              )}
              <TableHead className="text-xs w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => {
              const budget = parseFloat(row.budget) || 0;
              const m = computeMetrics(row.campaign_name, row.start_date, row.end_date);
              const totalDays =
                row.start_date && row.end_date
                  ? countBusinessDays(row.start_date, row.end_date, row.lab_days)
                  : 0;
              const remaining =
                row.end_date
                  ? countRemainingBusinessDays(today, row.end_date, row.lab_days)
                  : 0;
              const elapsed =
                row.start_date
                  ? countElapsedBusinessDays(row.start_date, today, row.lab_days)
                  : 0;
              const cappedElapsed = Math.min(elapsed, totalDays);
              const pctSpent = budget > 0 ? m.cost / budget : 0;
              const pctExpected = totalDays > 0 ? cappedElapsed / totalDays : 0;
              const idealDaily = totalDays > 0 ? budget / totalDays : 0;
              const ctr = m.impressions > 0 ? m.clicks / m.impressions : 0;
              const cpc = m.clicks > 0 ? m.cost / m.clicks : 0;
              const cpm = m.impressions > 0 ? (m.cost / m.impressions) * 1000 : 0;

              const pacingDelta = pctSpent - pctExpected;
              const pacingClass =
                Math.abs(pacingDelta) < 0.1
                  ? 'text-success'
                  : pacingDelta > 0
                  ? 'text-destructive'
                  : 'text-warning';

              const campaignOptions = row.platform
                ? campaignsByPlatform.get(row.platform) || []
                : [...new Set(sheetData.map(r => r.campaign_name).filter(Boolean) as string[])].sort();

              return (
                <TableRow key={row.id} className="text-xs">
                  <TableCell className="p-2">
                    <Select
                      value={row.platform}
                      onValueChange={v => updateRow(row.id, { platform: v, campaign_name: '' })}
                    >
                      <SelectTrigger className="h-8 text-xs w-[120px]">
                        <SelectValue placeholder="Medio" />
                      </SelectTrigger>
                      <SelectContent>
                        {platforms.map(p => (
                          <SelectItem key={p} value={p} className="text-xs capitalize">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="p-2">
                    <CampaignCombo
                      value={row.campaign_name}
                      options={campaignOptions}
                      onChange={v => updateRow(row.id, { campaign_name: v })}
                    />
                  </TableCell>

                  <TableCell className="p-2">
                    <Select
                      value={row.lab_days}
                      onValueChange={v => updateRow(row.id, { lab_days: v as LabDays })}
                    >
                      <SelectTrigger className="h-8 text-xs w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mon_fri" className="text-xs">Lunes a Viernes</SelectItem>
                        <SelectItem value="mon_sat" className="text-xs">Lunes a Sábado</SelectItem>
                        <SelectItem value="all" className="text-xs">De corrido</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="p-2">
                    <Input
                      type="date"
                      value={row.start_date}
                      onChange={e => updateRow(row.id, { start_date: e.target.value })}
                      className="h-8 text-xs w-[140px]"
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      type="date"
                      value={row.end_date}
                      onChange={e => updateRow(row.id, { end_date: e.target.value })}
                      className="h-8 text-xs w-[140px]"
                    />
                  </TableCell>

                  <TableCell className="p-2 text-right font-mono">{totalDays || '—'}</TableCell>
                  <TableCell className="p-2 text-right font-mono">{remaining || '—'}</TableCell>

                  <TableCell className="p-2">
                    <Input
                      type="number"
                      value={row.budget}
                      onChange={e => updateRow(row.id, { budget: e.target.value })}
                      placeholder="0.00"
                      className="h-8 text-xs w-[110px] text-right font-mono"
                    />
                  </TableCell>

                  <TableCell className="p-2 text-right font-mono">{fmtMoney(m.cost)}</TableCell>
                  <TableCell className={cn('p-2 text-right font-mono font-semibold', pacingClass)}>
                    {fmtPct(pctSpent)}
                  </TableCell>
                  <TableCell className="p-2 text-right font-mono text-muted-foreground">
                    {fmtPct(pctExpected)}
                  </TableCell>
                  <TableCell className="p-2 text-right font-mono">{fmtMoney(idealDaily)}</TableCell>

                  {showMetrics && (
                    <>
                      <TableCell className="p-2 text-right font-mono bg-muted/10">{fmtNum(m.clicks)}</TableCell>
                      <TableCell className="p-2 text-right font-mono bg-muted/10">{fmtNum(m.impressions)}</TableCell>
                      <TableCell className="p-2 text-right font-mono bg-muted/10">{fmtNum(m.reach)}</TableCell>
                      <TableCell className="p-2 text-right font-mono bg-muted/10">{fmtPct(ctr)}</TableCell>
                      <TableCell className="p-2 text-right font-mono bg-muted/10">{fmtMoney(cpc)}</TableCell>
                      <TableCell className="p-2 text-right font-mono bg-muted/10">{fmtMoney(cpm)}</TableCell>
                    </>
                  )}

                  <TableCell className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(row.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CampaignCombo({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-8 w-full justify-between text-xs font-normal min-w-[220px]"
        >
          <span className="truncate">{value || 'Seleccionar campaña...'}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar campaña..." className="text-xs" />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-auto">
              {options.map(c => (
                <CommandItem
                  key={c}
                  value={c}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-3.5 w-3.5', value === c ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate text-xs">{c}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
