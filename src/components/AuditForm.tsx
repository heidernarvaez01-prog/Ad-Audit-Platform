import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ChevronsUpDown, Check, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ApiCampaignRow } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  apiData: ApiCampaignRow[];
  clientId: string;
  editRecord?: {
    id: string;
    account_id: string;
    campaign_name: string;
    presupuesto_total: number;
    fecha_inicio: string;
    fecha_fin: string;
    tipo_calendario: string;
    platform?: string;
  } | null;
}

export default function AuditForm({ open, onClose, onSaved, apiData, clientId, editRecord }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  const [platform, setPlatform] = useState(editRecord?.platform || '');
  const [accountName, setAccountName] = useState(editRecord?.account_id || '');
  const [campaignName, setCampaignName] = useState(editRecord?.campaign_name || '');
  const [presupuesto, setPresupuesto] = useState(editRecord?.presupuesto_total?.toString() || '');
  const [fechaInicio, setFechaInicio] = useState(editRecord?.fecha_inicio || '');
  const [fechaFin, setFechaFin] = useState(editRecord?.fecha_fin || '');
  const [tipoCalendario, setTipoCalendario] = useState(editRecord?.tipo_calendario || 'corridos');
  const [comboOpen, setComboOpen] = useState(false);

  // Bulk mode
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState('');

  useEffect(() => {
    if (editRecord) {
      setMode('single');
      setPlatform(editRecord.platform || '');
      setAccountName(editRecord.account_id);
      setCampaignName(editRecord.campaign_name);
      setPresupuesto(editRecord.presupuesto_total.toString());
      setFechaInicio(editRecord.fecha_inicio);
      setFechaFin(editRecord.fecha_fin);
      setTipoCalendario(editRecord.tipo_calendario);
    }
  }, [editRecord]);

  const platforms = useMemo(() =>
    [...new Set(apiData.map(r => r.platform).filter(Boolean))].sort(), [apiData]);

  const accountNames = useMemo(() => {
    const filtered = platform ? apiData.filter(r => r.platform === platform) : apiData;
    return [...new Set(filtered.map(r => r.account_name).filter(Boolean))].sort();
  }, [apiData, platform]);

  const filteredCampaigns = useMemo(() => {
    if (!accountName) return [];
    let filtered = apiData.filter(r => r.account_name === accountName);
    if (platform) filtered = filtered.filter(r => r.platform === platform);
    return [...new Set(filtered.map(r => r.campaign_name).filter(Boolean))].sort();
  }, [apiData, platform, accountName]);

  // Date range available for a campaign (from synced data)
  const campaignDates = (name: string): { start: string; end: string } | null => {
    const rows = apiData.filter(r => r.campaign_name === name && (!platform || r.platform === platform));
    const dates = rows.map(r => r.date).filter(Boolean).sort();
    if (!dates.length) return null;
    return { start: dates[0].slice(0, 10), end: dates[dates.length - 1].slice(0, 10) };
  };

  const handleCampaignSelect = (name: string) => {
    setCampaignName(name);
    setComboOpen(false);
    const d = campaignDates(name);
    if (d && !editRecord) { setFechaInicio(d.start); setFechaFin(d.end); }
    const rows = apiData.filter(r => r.campaign_name === name && (!platform || r.platform === platform));
    if (!platform) {
      const plats = [...new Set(rows.map(r => r.platform).filter(Boolean))];
      if (plats.length === 1) setPlatform(plats[0]);
    }
  };

  const resetAccount = (v: string) => { setAccountName(v); setCampaignName(''); setSelected(new Set()); };

  const bulkVisible = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase();
    return q ? filteredCampaigns.filter(c => c.toLowerCase().includes(q)) : filteredCampaigns;
  }, [filteredCampaigns, bulkSearch]);

  const toggleCampaign = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };
  const allSelected = bulkVisible.length > 0 && bulkVisible.every(c => selected.has(c));
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) bulkVisible.forEach(c => next.delete(c));
      else bulkVisible.forEach(c => next.add(c));
      return next;
    });
  };

  const handleSaveSingle = async () => {
    if (!user || !campaignName || !presupuesto || !fechaInicio || !fechaFin) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    const record = {
      user_id: user.id,
      client_id: clientId,
      account_id: accountName,
      campaign_name: campaignName,
      presupuesto_total: parseFloat(presupuesto),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      tipo_calendario: tipoCalendario,
      platform: platform || null,
    };
    let error;
    if (editRecord) ({ error } = await supabase.from('audit_records').update(record).eq('id', editRecord.id));
    else ({ error } = await supabase.from('audit_records').insert(record));
    if (error) toast.error('Error saving record');
    else { toast.success(editRecord ? 'Record updated' : 'Record created'); onSaved(); }
    setLoading(false);
  };

  const handleSaveBulk = async () => {
    if (!user || !accountName) { toast.error('Select an account'); return; }
    if (selected.size === 0) { toast.error('Select at least one campaign'); return; }
    if (!presupuesto || !fechaInicio || !fechaFin) { toast.error('Fill budget and dates'); return; }
    setLoading(true);
    const records = [...selected].map(name => ({
      user_id: user.id,
      client_id: clientId,
      account_id: accountName,
      campaign_name: name,
      presupuesto_total: parseFloat(presupuesto),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      tipo_calendario: tipoCalendario,
      platform: platform || null,
    }));
    const { error } = await supabase.from('audit_records').insert(records);
    if (error) toast.error('Error creating campaigns');
    else { toast.success(`${records.length} campaign${records.length === 1 ? '' : 's'} added`); onSaved(); }
    setLoading(false);
  };

  const SharedValues = (
    <>
      <div>
        <Label className="text-xs text-muted-foreground">
          {mode === 'bulk' ? 'Approved Budget (applied to each campaign)' : 'Total Approved Budget'}
        </Label>
        <Input type="number" value={presupuesto} onChange={e => setPresupuesto(e.target.value)} placeholder="0.00" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Start Date</Label>
          <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">End Date</Label>
          <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Schedule Type</Label>
        <Select value={tipoCalendario} onValueChange={setTipoCalendario}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="corridos">Every day</SelectItem>
            <SelectItem value="lun_vie">Monday to Friday</SelectItem>
            <SelectItem value="lun_sab">Monday to Saturday</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {editRecord ? 'Edit Audit Record' : 'Add Campaigns'}
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle (only when creating) */}
        {!editRecord && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'bulk')}>
            <TabsList className="w-full">
              <TabsTrigger value="single" className="flex-1 text-xs">Single</TabsTrigger>
              <TabsTrigger value="bulk" className="flex-1 text-xs">Bulk (multiple)</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="space-y-4 mt-2">
          {/* Platform */}
          <div>
            <Label className="text-xs text-muted-foreground">Platform</Label>
            <Select value={platform} onValueChange={(v) => { setPlatform(v); resetAccount(''); }}>
              <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
              <SelectContent>
                {platforms.map(p => (
                  <SelectItem key={p} value={p}><span className="capitalize">{p}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Account */}
          <div>
            <Label className="text-xs text-muted-foreground">Account</Label>
            <Select value={accountName} onValueChange={resetAccount}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accountNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {mode === 'single' ? (
            <>
              {/* Single campaign combobox */}
              <div>
                <Label className="text-xs text-muted-foreground">Campaign</Label>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={comboOpen} disabled={!accountName}
                      className="w-full justify-between font-normal text-sm h-9">
                      <span className="truncate">
                        {campaignName || (accountName ? 'Search campaign...' : 'Select an account first')}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search campaign..." />
                      <CommandList>
                        <CommandEmpty>No campaigns found.</CommandEmpty>
                        <CommandGroup className="max-h-60 overflow-auto">
                          {filteredCampaigns.map(c => (
                            <CommandItem key={c} value={c} onSelect={() => handleCampaignSelect(c)}>
                              <Check className={cn("mr-2 h-4 w-4", campaignName === c ? "opacity-100" : "opacity-0")} />
                              <span className="truncate text-xs">{c}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {SharedValues}
              <Button onClick={handleSaveSingle} disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editRecord ? 'Save Changes' : 'Create Record'}
              </Button>
            </>
          ) : (
            <>
              {/* Bulk: multi-select campaign list */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Campaigns {selected.size > 0 && <span className="text-primary font-medium">· {selected.size} selected</span>}
                  </Label>
                  {filteredCampaigns.length > 0 && (
                    <button type="button" onClick={toggleAll} className="text-[11px] text-primary hover:underline">
                      {allSelected ? 'Clear all' : 'Select all'}
                    </button>
                  )}
                </div>
                {!accountName ? (
                  <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
                    Select an account to list its campaigns.
                  </p>
                ) : filteredCampaigns.length === 0 ? (
                  <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
                    No campaigns found for this account.
                  </p>
                ) : (
                  <div className="border border-border rounded-md">
                    <div className="relative p-2 border-b border-border">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input value={bulkSearch} onChange={e => setBulkSearch(e.target.value)}
                        placeholder="Filter campaigns..." className="pl-8 h-8 text-xs" />
                    </div>
                    <div className="max-h-52 overflow-y-auto p-1">
                      {bulkVisible.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleCampaign(c)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-muted/60 transition-colors"
                        >
                          <span className={cn(
                            'h-4 w-4 shrink-0 rounded border flex items-center justify-center',
                            selected.has(c) ? 'bg-primary border-primary text-primary-foreground' : 'border-input',
                          )}>
                            {selected.has(c) && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate text-xs text-foreground">{c}</span>
                        </button>
                      ))}
                      {bulkVisible.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">No matches.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground -mt-1">
                These values apply to every selected campaign. You can fine-tune dates/budget per campaign later in the table.
              </p>
              {SharedValues}

              <Button onClick={handleSaveBulk} disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add {selected.size > 0 ? selected.size : ''} campaign{selected.size === 1 ? '' : 's'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
