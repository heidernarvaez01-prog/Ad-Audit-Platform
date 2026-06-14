import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Save, Check, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

type Brief = Record<string, any>;

const SECTIONS: { title: string; fields: { key: string; label: string; hint?: string; type?: 'input' | 'textarea' | 'number' | 'url'; rows?: number }[] }[] = [
  {
    title: 'Identification',
    fields: [
      { key: 'marca', label: 'Brand' },
      { key: 'sitio_web', label: 'Website', type: 'url' },
      { key: 'mercado_objetivo', label: 'Target country or market', hint: 'Geographic areas only' },
      { key: 'presupuesto_campana', label: 'Campaign budget', type: 'number' },
    ],
  },
  {
    title: 'Strategy',
    fields: [
      { key: 'necesidad_principal', label: 'Main need', hint: 'The problem to face and solve with marketing', type: 'textarea', rows: 3 },
      { key: 'descripcion_proyecto', label: 'Project overview', hint: 'What the company offers, benefits, audience and differentiators', type: 'textarea', rows: 5 },
      { key: 'publico_objetivo', label: 'Target audience and buyer persona', hint: 'Types of people and situational descriptions', type: 'textarea', rows: 5 },
      { key: 'fundamentos_marca', label: 'Brand fundamentals', hint: 'Products, services and brand mandatories', type: 'textarea', rows: 4 },
    ],
  },
  {
    title: 'Verbal identity',
    fields: [
      { key: 'palabras_marca', label: '30 words that represent the brand', hint: 'Comma-separated', type: 'textarea', rows: 3 },
      { key: 'frases_marca', label: '10 phrases that describe the brand', hint: 'One per line', type: 'textarea', rows: 5 },
      { key: 'valores_marca', label: 'Brand values', hint: 'With an explanation for each', type: 'textarea', rows: 4 },
      { key: 'promesa_marca', label: 'Brand promise', hint: 'Achievable rational and emotional promises', type: 'textarea', rows: 3 },
      { key: 'reasons_why', label: 'Reasons Why / Reasons to believe', hint: 'Concrete reasons to believe the promise', type: 'textarea', rows: 3 },
    ],
  },
  {
    title: 'Personality',
    fields: [
      { key: 'personalidad_marca', label: 'Brand personality', hint: 'Archetype if applicable', type: 'textarea', rows: 3 },
      { key: 'estilo_tono', label: 'Style and tone', hint: 'How the brand speaks by customer and channel', type: 'textarea', rows: 3 },
      { key: 'diferenciador', label: 'Main differentiator', hint: 'What no one else has in the local market', type: 'textarea', rows: 3 },
    ],
  },
  {
    title: 'Creative and references',
    fields: [
      { key: 'insights', label: 'Useful findings or insights', hint: 'Concepts, campaigns, slogans and previous learnings', type: 'textarea', rows: 4 },
      { key: 'elementos_marca', label: 'Brand elements', hint: 'Colors, typography, graphic guidelines and manuals', type: 'textarea', rows: 4 },
      { key: 'benchmark', label: 'Benchmark / References', hint: 'Relevant competitors to analyze', type: 'textarea', rows: 4 },
    ],
  },
];

export default function BriefPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [brief, setBrief] = useState<Brief>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Load the client and its brief — one brief per client, linked to the same
  // client as the real-time audit and the projection clusters
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const { data: c, error } = await supabase.from('audit_clients').select('id, name').eq('id', clientId).maybeSingle();
      if (error || !c) {
        toast.error('Client not found');
        navigate('/brief', { replace: true });
        return;
      }
      setClient(c);
      const { data } = await supabase.from('brand_briefs').select('*').eq('client_id', clientId).maybeSingle();
      setBrief(data || { client_id: clientId });
      setSavedAt(null);
    })();
  }, [clientId, navigate]);

  const persist = useCallback(async (next: Brief) => {
    if (!clientId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must sign in to save');
      return;
    }
    setSaving(true);
    const payload = { ...next, client_id: clientId, user_id: user.id };
    const { error } = await supabase.from('brand_briefs').upsert(payload, { onConflict: 'client_id' });
    setSaving(false);
    if (error) {
      toast.error('Error saving brief');
    } else {
      setSavedAt(Date.now());
    }
  }, [clientId]);

  const update = (key: string, value: any) => {
    const next = { ...brief, [key]: value, client_id: clientId };
    setBrief(next);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => persist(next), 1200);
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="shrink-0 -ml-2" onClick={() => navigate('/brief')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Clients
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">
              {client ? `${client.name} — Brand Brief` : 'Brand Brief'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tell us about this brand. The more complete, the sharper the AI strategies will be.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Save className="h-3 w-3 animate-pulse" /> Saving...
            </span>
          ) : savedAt ? (
            <span className="text-xs text-success flex items-center gap-1.5">
              <Check className="h-3 w-3" /> Saved
            </span>
          ) : null}
        </div>
      </div>

      {SECTIONS.map((section, idx) => (
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
    </div>
  );
}
