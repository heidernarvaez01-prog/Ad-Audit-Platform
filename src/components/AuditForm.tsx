import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ApiCampaignRow } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  apiData: ApiCampaignRow[];
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

export default function AuditForm({ open, onClose, onSaved, apiData, editRecord }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [platform, setPlatform] = useState(editRecord?.platform || '');
  const [accountName, setAccountName] = useState(editRecord?.account_id || '');
  const [campaignName, setCampaignName] = useState(editRecord?.campaign_name || '');
  const [presupuesto, setPresupuesto] = useState(editRecord?.presupuesto_total?.toString() || '');
  const [fechaInicio, setFechaInicio] = useState(editRecord?.fecha_inicio || '');
  const [fechaFin, setFechaFin] = useState(editRecord?.fecha_fin || '');
  const [tipoCalendario, setTipoCalendario] = useState(editRecord?.tipo_calendario || 'corridos');
  const [comboOpen, setComboOpen] = useState(false);

  useEffect(() => {
    if (editRecord) {
      setPlatform(editRecord.platform || '');
      setAccountName(editRecord.account_id);
      setCampaignName(editRecord.campaign_name);
      setPresupuesto(editRecord.presupuesto_total.toString());
      setFechaInicio(editRecord.fecha_inicio);
      setFechaFin(editRecord.fecha_fin);
      setTipoCalendario(editRecord.tipo_calendario);
    }
  }, [editRecord]);

  // Available platforms from API data
  const platforms = useMemo(() => {
    return [...new Set(apiData.map(r => r.platform).filter(Boolean))].sort();
  }, [apiData]);

  // Campaigns filtered by selected platform AND account_name
  const filteredCampaigns = useMemo(() => {
    let filtered = apiData;
    if (platform) filtered = filtered.filter(r => r.platform === platform);
    if (accountName) filtered = filtered.filter(r => r.account_name === accountName);
    return [...new Set(filtered.map(r => r.campaign_name).filter(Boolean))].sort();
  }, [apiData, platform, accountName]);

  // Unique account names filtered by platform
  const accountNames = useMemo(() => {
    const filtered = platform
      ? apiData.filter(r => r.platform === platform)
      : apiData;
    return [...new Set(filtered.map(r => r.account_name).filter(Boolean))].sort();
  }, [apiData, platform]);

  // When a campaign is selected, prefill dates from API data
  const handleCampaignSelect = (name: string) => {
    setCampaignName(name);
    setComboOpen(false);

    const campaignRows = apiData.filter(r => r.campaign_name === name && (!platform || r.platform === platform));
    if (campaignRows.length > 0) {
      const dates = campaignRows.map(r => r.date).filter(Boolean).sort();
      if (dates.length > 0 && !editRecord) {
        setFechaInicio(dates[0].slice(0, 10));
        setFechaFin(dates[dates.length - 1].slice(0, 10));
      }
      // Prefill account_name if consistent
      const accts = [...new Set(campaignRows.map(r => r.account_name).filter(Boolean))];
      if (accts.length === 1 && !editRecord) {
        setAccountName(accts[0]);
      }
      // Prefill platform if not set
      if (!platform) {
        const plats = [...new Set(campaignRows.map(r => r.platform).filter(Boolean))];
        if (plats.length === 1) setPlatform(plats[0]);
      }
    }
  };

  const handleSave = async () => {
    if (!user || !campaignName || !presupuesto || !fechaInicio || !fechaFin) {
      toast.error('Completa todos los campos');
      return;
    }
    setLoading(true);
    const record = {
      user_id: user.id,
      account_id: accountName,
      campaign_name: campaignName,
      presupuesto_total: parseFloat(presupuesto),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      tipo_calendario: tipoCalendario,
      platform: platform || null,
    };

    let error;
    if (editRecord) {
      ({ error } = await supabase.from('audit_records').update(record).eq('id', editRecord.id));
    } else {
      ({ error } = await supabase.from('audit_records').insert(record));
    }

    if (error) {
      toast.error('Error guardando registro');
    } else {
      toast.success(editRecord ? 'Registro actualizado' : 'Registro creado');
      onSaved();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {editRecord ? 'Editar Registro de Auditoría' : 'Nueva Campaña Auditada'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Platform selector */}
          <div>
            <Label className="text-xs text-muted-foreground">Plataforma</Label>
            <Select value={platform} onValueChange={(v) => { setPlatform(v); setAccountName(''); setCampaignName(''); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar plataforma" /></SelectTrigger>
              <SelectContent>
                {platforms.map(p => (
                  <SelectItem key={p} value={p}>
                    <span className="capitalize">{p}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cuenta (Account Name) — depends on platform */}
          <div>
            <Label className="text-xs text-muted-foreground">Cuenta</Label>
            <Select value={accountName} onValueChange={(v) => { setAccountName(v); setCampaignName(''); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
              <SelectContent>
                {accountNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campaign combobox — depends on platform + account */}
          <div>
            <Label className="text-xs text-muted-foreground">Campaña</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="w-full justify-between font-normal text-sm h-9"
                >
                  <span className="truncate">
                    {campaignName || 'Buscar campaña...'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar campaña..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron campañas.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-auto">
                      {filteredCampaigns.map(c => (
                        <CommandItem
                          key={c}
                          value={c}
                          onSelect={() => handleCampaignSelect(c)}
                        >
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

          <div>
            <Label className="text-xs text-muted-foreground">Presupuesto Total Aprobado</Label>
            <Input
              type="number"
              value={presupuesto}
              onChange={e => setPresupuesto(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Fecha Inicio</Label>
              <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Fecha Fin</Label>
              <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Tipo de Calendario</Label>
            <Select value={tipoCalendario} onValueChange={setTipoCalendario}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corridos">Días corridos</SelectItem>
                <SelectItem value="lun_vie">Lunes a Viernes</SelectItem>
                <SelectItem value="lun_sab">Lunes a Sábado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editRecord ? 'Guardar Cambios' : 'Crear Registro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
