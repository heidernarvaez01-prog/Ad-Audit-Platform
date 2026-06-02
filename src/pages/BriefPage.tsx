import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Save, Check } from 'lucide-react';
import { toast } from 'sonner';

type Brief = Record<string, any>;

type AccountOpt = { account_id: string; account_name: string };

const SECTIONS: { title: string; fields: { key: string; label: string; hint?: string; type?: 'input' | 'textarea' | 'number' | 'url'; rows?: number }[] }[] = [
  {
    title: 'Identificación',
    fields: [
      { key: 'marca', label: 'Marca' },
      { key: 'sitio_web', label: 'Sitio Web', type: 'url' },
      { key: 'mercado_objetivo', label: 'País o mercado objetivo', hint: 'Solo zonas geográficas' },
      { key: 'presupuesto_campana', label: 'Presupuesto de campaña', type: 'number' },
    ],
  },
  {
    title: 'Estrategia',
    fields: [
      { key: 'necesidad_principal', label: 'Necesidad principal', hint: 'El problema a enfrentar y resolver con marketing', type: 'textarea', rows: 3 },
      { key: 'descripcion_proyecto', label: 'Descripción general del proyecto', hint: 'Lo que ofrece la empresa, beneficios, público y diferenciadores', type: 'textarea', rows: 5 },
      { key: 'publico_objetivo', label: 'Público objetivo y buyer persona', hint: 'Tipos de personas y descripciones situacionales', type: 'textarea', rows: 5 },
      { key: 'fundamentos_marca', label: 'Fundamentos de la marca', hint: 'Productos, servicios y mandatorios de marca', type: 'textarea', rows: 4 },
    ],
  },
  {
    title: 'Identidad verbal',
    fields: [
      { key: 'palabras_marca', label: '30 palabras que representan a la marca', hint: 'Separadas por comas', type: 'textarea', rows: 3 },
      { key: 'frases_marca', label: '10 frases que describen a la marca', hint: 'Una por línea', type: 'textarea', rows: 5 },
      { key: 'valores_marca', label: 'Valores de la marca', hint: 'Con una explicación de cada uno', type: 'textarea', rows: 4 },
      { key: 'promesa_marca', label: 'Promesa de marca', hint: 'Promesas racionales y emocionales cumplibles', type: 'textarea', rows: 3 },
      { key: 'reasons_why', label: 'Reasons Why / Razones para creer', hint: 'Razones concretas para creer en la promesa', type: 'textarea', rows: 3 },
    ],
  },
  {
    title: 'Personalidad',
    fields: [
      { key: 'personalidad_marca', label: 'Personalidad de marca', hint: 'Arquetipo si aplica', type: 'textarea', rows: 3 },
      { key: 'estilo_tono', label: 'Estilo y tono', hint: 'Cómo habla la marca según cliente y canal', type: 'textarea', rows: 3 },
      { key: 'diferenciador', label: 'Diferenciador principal', hint: 'Lo que ningún otro tiene en el mercado local', type: 'textarea', rows: 3 },
    ],
  },
  {
    title: 'Creatividad y referencias',
    fields: [
      { key: 'insights', label: 'Hallazgos útiles o insights', hint: 'Conceptos, campañas, eslóganes y aprendizajes previos', type: 'textarea', rows: 4 },
      { key: 'elementos_marca', label: 'Elementos de la marca', hint: 'Colores, tipografías, guía gráfica y manuales', type: 'textarea', rows: 4 },
      { key: 'benchmark', label: 'Benchmark / Referentes', hint: 'Competidores relevantes a analizar', type: 'textarea', rows: 4 },
    ],
  },
];

export default function BriefPage() {
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [accountId, setAccountId] = useState<string>('');
  const [brief, setBrief] = useState<Brief>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Load accounts from audit_records + meta_datos
  useEffect(() => {
    (async () => {
      const [{ data: ar }, { data: md }] = await Promise.all([
        supabase.from('audit_records').select('account_id, campaign_name'),
        supabase.from('meta_datos').select('account_id, account_name'),
      ]);
      const map = new Map<string, string>();
      (ar || []).forEach((r: any) => {
        if (r.account_id && !map.has(r.account_id)) map.set(r.account_id, r.account_id);
      });
      (md || []).forEach((r: any) => {
        if (r.account_id) map.set(r.account_id, r.account_name || map.get(r.account_id) || r.account_id);
      });
      const list = Array.from(map.entries()).map(([account_id, account_name]) => ({ account_id, account_name }));
      list.sort((a, b) => a.account_name.localeCompare(b.account_name));
      setAccounts(list);
      if (list.length && !accountId) setAccountId(list[0].account_id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load brief for selected account
  useEffect(() => {
    if (!accountId) return;
    (async () => {
      const { data } = await supabase.from('brand_briefs').select('*').eq('account_id', accountId).maybeSingle();
      const accountName = accounts.find(a => a.account_id === accountId)?.account_name || '';
      setBrief(data || { account_id: accountId, account_name: accountName });
      setSavedAt(null);
    })();
  }, [accountId, accounts]);

  const persist = useCallback(async (next: Brief) => {
    if (!next.account_id) return;
    setSaving(true);
    const payload = { ...next, account_id: next.account_id };
    const { error } = await supabase.from('brand_briefs').upsert(payload, { onConflict: 'account_id' });
    setSaving(false);
    if (error) {
      toast.error('Error guardando brief');
    } else {
      setSavedAt(Date.now());
    }
  }, []);

  const update = (key: string, value: any) => {
    const next = { ...brief, [key]: value, account_id: accountId };
    setBrief(next);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => persist(next), 1200);
  };

  const selectedName = useMemo(
    () => accounts.find(a => a.account_id === accountId)?.account_name || accountId,
    [accounts, accountId],
  );

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Brief de Marca</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contexto estratégico por cuenta — alimenta el análisis de IA junto con métricas de Windsor.ai
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Save className="h-3 w-3 animate-pulse" /> Guardando...
            </span>
          ) : savedAt ? (
            <span className="text-xs text-success flex items-center gap-1.5">
              <Check className="h-3 w-3" /> Guardado
            </span>
          ) : null}
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card p-4 space-y-2">
        <Label className="text-xs">Cuenta publicitaria</Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona una cuenta" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.account_id} value={a.account_id}>
                {a.account_name} <span className="text-muted-foreground ml-2">({a.account_id})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {accountId && (
          <p className="text-[11px] text-muted-foreground">
            Editando brief para <span className="font-mono">{selectedName}</span>
          </p>
        )}
      </div>

      {accountId && SECTIONS.map((section, idx) => (
        <Collapsible key={section.title} defaultOpen={idx === 0}>
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors group">
              <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 pt-1 space-y-4">
                {section.fields.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={f.key} className="text-xs">{f.label}</Label>
                    {f.hint && <p className="text-[11px] text-muted-foreground -mt-0.5">{f.hint}</p>}
                    {f.type === 'textarea' ? (
                      <Textarea
                        id={f.key}
                        value={brief[f.key] ?? ''}
                        onChange={e => update(f.key, e.target.value)}
                        rows={f.rows || 3}
                        maxLength={4000}
                      />
                    ) : f.type === 'number' ? (
                      <Input
                        id={f.key}
                        type="number"
                        min={0}
                        step="0.01"
                        value={brief[f.key] ?? ''}
                        onChange={e => update(f.key, e.target.value === '' ? null : Number(e.target.value))}
                      />
                    ) : (
                      <Input
                        id={f.key}
                        type={f.type === 'url' ? 'url' : 'text'}
                        value={brief[f.key] ?? ''}
                        onChange={e => update(f.key, e.target.value)}
                        maxLength={500}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}

      {!accountId && accounts.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No hay cuentas registradas. Crea una auditoría primero para poder añadir su brief.
        </div>
      )}
    </div>
  );
}
