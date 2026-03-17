import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchCsv } from '@/lib/csv';
import { PLATFORM_CONFIG, PLATFORMS } from '@/lib/platforms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Platform = Database['public']['Enums']['ad_platform'];

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function LinkCampaignModal({ onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState<Platform | ''>('');
  const [campaignNames, setCampaignNames] = useState<string[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [accountName, setAccountName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [labDays, setLabDays] = useState<'mon_fri' | 'mon_sat' | 'all'>('mon_fri');
  const [budgetApproved, setBudgetApproved] = useState('');
  const [programmedBudget, setProgrammedBudget] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!platform || !user) return;
    setLoadingNames(true);
    
    supabase.from('data_sources').select('csv_url').eq('user_id', user.id).eq('platform', platform).single()
      .then(async ({ data }) => {
        if (!data?.csv_url) {
          setCampaignNames([]);
          setLoadingNames(false);
          return;
        }
        try {
          const rows = await fetchCsv(data.csv_url);
          const names = new Set<string>();
          rows.forEach(row => {
            const name = row['Campaign name'] || row['campaign_name'] || row['Campaign'] || row['Nombre de la campaña'] || '';
            if (name) names.add(name);
          });
          setCampaignNames(Array.from(names).sort());
        } catch {
          setCampaignNames([]);
        }
        setLoadingNames(false);
      });
  }, [platform, user]);

  const handleSave = async () => {
    if (!user || !platform || !selectedCampaign) return;
    setSaving(true);
    await supabase.from('campaign_tracking').insert({
      user_id: user.id,
      platform: platform as Platform,
      campaign_name: selectedCampaign,
      account_name: accountName || null,
      start_date: startDate,
      end_date: endDate,
      lab_days: labDays,
      budget_approved: parseFloat(budgetApproved) || 0,
      programmed_budget: parseFloat(programmedBudget) || 0,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Vincular Campaña</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Plataforma</label>
            <Select value={platform} onValueChange={v => { setPlatform(v as Platform); }}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plataforma" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map(p => (
                  <SelectItem key={p} value={p}>{PLATFORM_CONFIG[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!platform} onClick={() => setStep(2)} className="w-full">Siguiente</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Buscar campaña en CSV</label>
            {loadingNames ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <Command className="border rounded">
                <CommandInput placeholder="Buscar campaña..." />
                <CommandList className="max-h-48">
                  <CommandEmpty>No se encontraron campañas. Valide la fuente de datos.</CommandEmpty>
                  <CommandGroup>
                    {campaignNames.map(name => (
                      <CommandItem
                        key={name}
                        value={name}
                        onSelect={() => setSelectedCampaign(name)}
                        className={selectedCampaign === name ? 'bg-primary/10' : ''}
                      >
                        {name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
            <Button disabled={!selectedCampaign} onClick={() => setStep(3)} className="w-full">Siguiente</Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className={`font-semibold ${PLATFORM_CONFIG[platform as Platform].color}`}>{PLATFORM_CONFIG[platform as Platform].label}</span> → {selectedCampaign}
            </p>
            <div>
              <label className="text-xs text-muted-foreground">Cuenta / Cliente</label>
              <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Nombre del cliente" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Fecha inicio</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Fecha fin</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Días laborales</label>
              <Select value={labDays} onValueChange={v => setLabDays(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mon_fri">Lun-Vie</SelectItem>
                  <SelectItem value="mon_sat">Lun-Sáb</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Presupuesto aprobado</label>
                <Input type="number" value={budgetApproved} onChange={e => setBudgetApproved(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Presupuesto programado</label>
                <Input type="number" value={programmedBudget} onChange={e => setProgrammedBudget(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !startDate || !endDate}
              className="w-full"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Guardar Campaña
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
