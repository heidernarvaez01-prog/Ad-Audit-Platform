import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchCampaignData, getUniqueCampaignNames, getUniqueAccountIds } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editRecord?: {
    id: string;
    account_id: string;
    campaign_name: string;
    presupuesto_total: number;
    fecha_inicio: string;
    fecha_fin: string;
    tipo_calendario: string;
  } | null;
}

export default function AuditForm({ open, onClose, onSaved, editRecord }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [campaignNames, setCampaignNames] = useState<string[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [loadingApi, setLoadingApi] = useState(true);

  const [accountId, setAccountId] = useState(editRecord?.account_id || '');
  const [campaignName, setCampaignName] = useState(editRecord?.campaign_name || '');
  const [presupuesto, setPresupuesto] = useState(editRecord?.presupuesto_total?.toString() || '');
  const [fechaInicio, setFechaInicio] = useState(editRecord?.fecha_inicio || '');
  const [fechaFin, setFechaFin] = useState(editRecord?.fecha_fin || '');
  const [tipoCalendario, setTipoCalendario] = useState(editRecord?.tipo_calendario || 'corridos');

  useEffect(() => {
    fetchCampaignData()
      .then(data => {
        setCampaignNames(getUniqueCampaignNames(data));
        setAccountIds(getUniqueAccountIds(data));
      })
      .catch(() => toast.error('Error cargando datos de la API'))
      .finally(() => setLoadingApi(false));
  }, []);

  useEffect(() => {
    if (editRecord) {
      setAccountId(editRecord.account_id);
      setCampaignName(editRecord.campaign_name);
      setPresupuesto(editRecord.presupuesto_total.toString());
      setFechaInicio(editRecord.fecha_inicio);
      setFechaFin(editRecord.fecha_fin);
      setTipoCalendario(editRecord.tipo_calendario);
    }
  }, [editRecord]);

  const handleSave = async () => {
    if (!user || !campaignName || !presupuesto || !fechaInicio || !fechaFin) {
      toast.error('Completa todos los campos');
      return;
    }
    setLoading(true);
    const record = {
      user_id: user.id,
      account_id: accountId,
      campaign_name: campaignName,
      presupuesto_total: parseFloat(presupuesto),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      tipo_calendario: tipoCalendario,
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
            {editRecord ? 'Editar Registro de Auditoría' : 'Nuevo Registro de Auditoría'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Account ID</Label>
            {loadingApi ? (
              <div className="flex items-center gap-2 h-9"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : (
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                <SelectContent>
                  {accountIds.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Campaña</Label>
            {loadingApi ? (
              <div className="flex items-center gap-2 h-9"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : (
              <Select value={campaignName} onValueChange={setCampaignName}>
                <SelectTrigger><SelectValue placeholder="Seleccionar campaña" /></SelectTrigger>
                <SelectContent>
                  {campaignNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
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
