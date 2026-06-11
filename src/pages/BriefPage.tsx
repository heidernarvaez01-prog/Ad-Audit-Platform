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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must sign in to save');
      return;
    }
    setSaving(true);
    const payload = { ...next, account_id: next.account_id, user_id: user.id };
    const { error } = await supabase.from('brand_briefs').upsert(payload, { onConflict: 'account_id' });
    setSaving(false);
    if (error) {
      toast.error('Error saving brief');
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
          <h1 className="text-xl font-bold text-foreground">Brand Brief</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Strategic context per account — feeds the AI analysis along with Windsor.ai metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="border border-border rounded-lg bg-card p-4 space-y-2">
        <Label className="text-xs">Ad account</Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an account" />
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
            Editing brief for <span className="font-mono">{selectedName}</span>
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
          No accounts registered. Create an audit first to add its brief.
        </div>
      )}
    </div>
  );
}
