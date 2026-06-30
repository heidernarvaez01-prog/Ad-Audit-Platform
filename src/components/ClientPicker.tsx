import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2, FolderOpen, ArrowRight, Briefcase, Search, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

interface ClientRow {
  id: string;
  name: string;
  description: string | null;
}

interface Props {
  title: string;
  subtitle: string;
  basePath: string;          // e.g. '/brief' or '/clusters'
  icon: LucideIcon;
  mode: 'brief' | 'clusters' | 'weekly' | 'reporting'; // which per-client badge to show
}

/**
 * Shared "pick a client" landing used by Brand Brief and Projection Clusters.
 * Same clients as Monitoring Audit (audit_clients) so brief + audit + clusters
 * of each client stay linked together.
 */
export default function ClientPicker({ title, subtitle, basePath, icon: Icon, mode }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [badges, setBadges] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
  }, [clients, search]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('audit_clients').select('id, name, description').order('created_at', { ascending: true });
    if (error) { setMigrationPending(true); setLoading(false); return; }
    setMigrationPending(false);
    setClients((data || []) as ClientRow[]);

    // Per-client badge depending on the section
    const map: Record<string, string> = {};
    if (mode === 'brief') {
      const briefKeys = ['marca','sitio_web','mercado_objetivo','presupuesto_campana','necesidad_principal','descripcion_proyecto','publico_objetivo','fundamentos_marca','palabras_marca','frases_marca','valores_marca','promesa_marca','reasons_why','personalidad_marca','estilo_tono','diferenciador','insights','elementos_marca','benchmark'];
      const { data: briefs } = await supabase.from('brand_briefs').select('*').not('client_id', 'is', null);
      for (const b of briefs || []) {
        if (!b.client_id) continue;
        const filled = briefKeys.filter(k => b[k] !== null && b[k] !== undefined && String(b[k]).trim() !== '').length;
        const pct = Math.round((filled / briefKeys.length) * 100);
        map[b.client_id] = pct >= 80 ? 'Complete' : `${pct}% filled`;
      }
    } else if (mode === 'clusters') {
      const { data: runs } = await supabase.from('cluster_runs').select('client_id');
      for (const r of runs || []) {
        const n = (map[r.client_id] ? parseInt(map[r.client_id]) : 0) + 1;
        map[r.client_id] = `${n}`;
      }
      for (const k of Object.keys(map)) map[k] = `${map[k]} run${map[k] === '1' ? '' : 's'}`;
    } else if (mode === 'weekly') {
      const { data: reports } = await supabase
        .from('weekly_reports').select('client_id, week_end')
        .order('week_end', { ascending: false });
      for (const r of reports || []) {
        if (!map[r.client_id]) map[r.client_id] = `Last: ${r.week_end}`;
      }
    } else if (mode === 'reporting') {
      const { data: cs } = await supabase.from('audit_clients').select('id, looker_report_url, looker_approved');
      for (const c of cs || []) {
        if (c.looker_approved && c.looker_report_url) map[c.id] = 'Approved';
        else if (c.looker_report_url) map[c.id] = 'Pending approval';
      }
    }
    setBadges(map);
    setLoading(false);
  }, [mode]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleCreate = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Client name is required'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('audit_clients')
      .insert({ user_id: user.id, name: trimmed, description: description.trim() || null })
      .select().single();
    setSaving(false);
    if (error || !data) { toast.error('Error creating client'); return; }
    toast.success('Client created');
    setDialogOpen(false);
    navigate(`${basePath}/${data.id}`);
  };

  if (migrationPending) {
    return (
      <div className="max-w-2xl mx-auto mt-16 border border-dashed border-border rounded-lg p-8 text-center space-y-3">
        <Briefcase className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="font-semibold text-foreground">Database update required</h2>
        <p className="text-sm text-muted-foreground">
          Run the pending SQL migrations in the Supabase SQL Editor, then reload this page.
        </p>
        <Button variant="outline" size="sm" onClick={loadAll}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">{title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setName(''); setDescription(''); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Client
        </Button>
      </div>

      {/* Search */}
      {clients.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="pl-9 h-9"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : clients.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground space-y-2">
          <FolderOpen className="h-8 w-8 mx-auto" />
          <p className="text-sm">No clients yet.</p>
          <p className="text-xs">Clients are shared with Monitoring Audit — create one to get started.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => { setName(''); setDescription(''); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Client
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center text-muted-foreground">
          <p className="text-sm">No clients match "{search}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => navigate(`${basePath}/${c.id}`)}
              className="border border-border rounded-lg bg-card p-4 cursor-pointer group
                transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground truncate">{c.name}</h3>
                  {c.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.description}</p>
                  )}
                </div>
                {badges[c.id] && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">{badges[c.id]}</Badge>
                )}
              </div>
              <div className="flex items-center justify-end mt-3 pt-3 border-t border-border">
                <span className="text-[11px] text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Client / brand name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp" maxLength={120}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} autoFocus />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description (optional)</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. E-commerce — Meta + Google" maxLength={200}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
            </div>
            <Button onClick={handleCreate} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Client
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
