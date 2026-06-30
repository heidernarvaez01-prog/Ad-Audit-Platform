import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchCampaignData } from '@/lib/api';
import { buildAuditRows } from '@/lib/audit-helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, FolderOpen, Briefcase, ArrowRight, Search, Users, Megaphone, Wallet, TrendingUp, AlertTriangle } from 'lucide-react';
import PageHero from '@/components/PageHero';
import type { ApiCampaignRow } from '@/lib/api';
import type { AuditRowData } from '@/components/AuditTable';
import { toast } from 'sonner';

interface ClientRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface ClientSummary {
  campaigns: number;
  budget: number;
  spent: number;
  ok: number;
  under: number;
  over: number;
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ClientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [apiData, setApiData] = useState<ApiCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);

  // Create/edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientRow | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
  }, [clients, search]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [clientsRes, recordsRes] = await Promise.all([
      supabase.from('audit_clients').select('*').order('created_at', { ascending: true }),
      supabase.from('audit_records').select('*'),
    ]);
    if (clientsRes.error) {
      // Table not created yet — the SQL migration hasn't been applied
      setMigrationPending(true);
      setLoading(false);
      return;
    }
    setMigrationPending(false);
    setClients((clientsRes.data || []) as ClientRow[]);
    setRecords(recordsRes.data || []);
    setLoading(false);
    try {
      const data = await fetchCampaignData();
      setApiData(data);
    } catch {
      toast.error('Error connecting to the campaigns API');
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Per-client summary, computed with the same pacing logic as the audit matrix
  const summaries = useMemo(() => {
    const rows: AuditRowData[] = buildAuditRows(records, apiData);
    const map = new Map<string, ClientSummary>();
    for (const c of clients) {
      map.set(c.id, { campaigns: 0, budget: 0, spent: 0, ok: 0, under: 0, over: 0 });
    }
    for (const row of rows) {
      const s = map.get((row as any).client_id);
      if (!s) continue;
      s.campaigns += 1;
      s.budget += row.presupuesto_total;
      s.spent += row.metrics.gastoActual;
      if (row.metrics.pacingStatus === 'OK') s.ok += 1;
      else if (row.metrics.pacingStatus === 'SUBGASTANDO') s.under += 1;
      else s.over += 1;
    }
    return map;
  }, [clients, records, apiData]);

  const totals = useMemo(() => {
    let budget = 0, spent = 0, campaigns = 0, over = 0, under = 0, ok = 0;
    for (const s of summaries.values()) {
      budget += s.budget; spent += s.spent; campaigns += s.campaigns;
      over += s.over; under += s.under; ok += s.ok;
    }
    return { budget, spent, campaigns, over, under, ok };
  }, [summaries]);

  const openCreate = () => { setEditClient(null); setName(''); setDescription(''); setDialogOpen(true); };
  const openEdit = (c: ClientRow) => { setEditClient(c); setName(c.name); setDescription(c.description || ''); setDialogOpen(true); };

  const handleSave = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Client name is required'); return; }
    setSaving(true);
    if (editClient) {
      const { error } = await supabase.from('audit_clients')
        .update({ name: trimmed, description: description.trim() || null })
        .eq('id', editClient.id);
      setSaving(false);
      if (error) { toast.error('Error saving client'); return; }
      toast.success('Client updated');
      setDialogOpen(false);
      loadAll();
    } else {
      const { data, error } = await supabase.from('audit_clients')
        .insert({ user_id: user.id, name: trimmed, description: description.trim() || null })
        .select().single();
      setSaving(false);
      if (error || !data) { toast.error('Error creating client'); return; }
      toast.success('Client created');
      setDialogOpen(false);
      navigate(`/client/${data.id}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('audit_clients').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast.error('Error deleting client'); return; }
    toast.success('Client deleted');
    loadAll();
  };

  if (migrationPending) {
    return (
      <div className="max-w-2xl mx-auto mt-16 border border-dashed border-border rounded-lg p-8 text-center space-y-3">
        <Briefcase className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="font-semibold text-foreground">Database update required</h2>
        <p className="text-sm text-muted-foreground">
          The clients table does not exist yet. Run the SQL migration
          <span className="font-mono text-xs"> supabase/migrations/20260611000000_audit_clients.sql </span>
          in the Supabase SQL Editor, then reload this page.
        </p>
        <Button variant="outline" size="sm" onClick={loadAll}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full min-w-0">
      <PageHero
        icon={Users}
        title="Clients"
        subtitle="Each client has its own space. Open one to track its campaigns, budgets and results in real time."
        gradient="from-indigo-600 via-violet-600 to-fuchsia-600"
        actions={
          <Button
            size="sm"
            className="bg-white text-indigo-700 hover:bg-white/90 shadow-md"
            onClick={openCreate}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Client
          </Button>
        }
      />

      {/* Global summary across all clients */}
      {clients.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <GradientStat icon={Users} label="Clients" value={clients.length.toString()} gradient="from-indigo-500 to-indigo-700" />
          <GradientStat icon={Megaphone} label="Campaigns" value={totals.campaigns.toString()} gradient="from-sky-500 to-blue-700" />
          <GradientStat icon={Wallet} label="Total Budget" value={fmt(totals.budget)} gradient="from-violet-500 to-purple-700" />
          <GradientStat icon={TrendingUp} label="Total Spend" value={fmt(totals.spent)} gradient="from-emerald-500 to-teal-700" />
          <GradientStat
            icon={AlertTriangle}
            label="At Risk"
            value={(totals.over + totals.under).toString()}
            gradient={totals.over + totals.under > 0 ? 'from-amber-500 to-rose-600' : 'from-emerald-500 to-emerald-700'}
            pulse={totals.over + totals.under > 0}
            hint="Campaigns overspending or underspending across all clients."
          />
        </div>
      )}

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

      {/* Client cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : clients.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground space-y-2 bg-muted/20">
          <FolderOpen className="h-8 w-8 mx-auto" />
          <p className="text-sm">No clients yet.</p>
          <p className="text-xs">Create your first client to start auditing its campaigns.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Client
          </Button>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center text-muted-foreground bg-muted/20">
          <p className="text-sm">No clients match "{search}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((c, idx) => {
            const s = summaries.get(c.id) || { campaigns: 0, budget: 0, spent: 0, ok: 0, under: 0, over: 0 };
            // Rotate accent palette across cards
            const palettes = [
              'from-indigo-500 to-violet-600',
              'from-sky-500 to-blue-700',
              'from-emerald-500 to-teal-700',
              'from-fuchsia-500 to-purple-700',
              'from-amber-500 to-orange-600',
              'from-rose-500 to-red-700',
            ];
            const accent = palettes[idx % palettes.length];
            const initials = c.name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '·';
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/client/${c.id}`)}
                className="relative overflow-hidden rounded-xl border border-border bg-card p-5 cursor-pointer group
                  transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-transparent"
              >
                {/* Top gradient accent bar */}
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
                {/* Decorative blob */}
                <div aria-hidden className={`pointer-events-none absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-gradient-to-br ${accent} opacity-[0.08] group-hover:opacity-[0.18] transition-opacity blur-xl`} />

                <div className="relative flex items-start gap-3">
                  <div className={`shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center font-bold text-sm shadow-sm`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-foreground truncate">{c.name}</h3>
                    {c.description ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.description}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic mt-0.5">No description</p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="relative grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border">
                  <Mini label="Campaigns" value={s.campaigns.toString()} />
                  <Mini label="Budget" value={fmt(s.budget)} />
                  <Mini label="Spend" value={fmt(s.spent)} />
                </div>

                <div className="relative flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-[10px]">
                    <StatusDot count={s.ok} color="bg-emerald-500" label="on track" />
                    <StatusDot count={s.under} color="bg-amber-500" label="under" />
                    <StatusDot count={s.over} color="bg-rose-500" label="over" />
                  </div>
                  <span className="text-[11px] font-medium text-foreground flex items-center gap-1 group-hover:gap-2 transition-all">
                    Open audit <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editClient ? 'Edit Client' : 'New Client'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Client / brand name</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
                maxLength={120}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description (optional)</Label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. E-commerce — Meta + Google"
                maxLength={200}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editClient ? 'Save Changes' : 'Create Client'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the client and all of its audited campaigns. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold font-mono text-foreground truncate">{value}</p>
    </div>
  );
}

function StatusDot({ count, color, label }: { count: number; color: string; label: string }) {
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {count} {label}
    </span>
  );
}

function GradientStat({
  icon: Icon, label, value, gradient, hint, pulse,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  gradient: string;
  hint?: string;
  pulse?: boolean;
}) {
  const card = (
    <div
      className={`relative overflow-hidden rounded-xl p-4 text-white shadow-md cursor-help
        bg-gradient-to-br ${gradient} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg animate-fade-in`}
    >
      <div aria-hidden className="absolute -right-3 -bottom-3 opacity-20">
        <Icon className="h-16 w-16" />
      </div>
      <div className="relative flex items-center gap-1.5">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-white/80" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
        )}
        <p className="text-[10px] uppercase tracking-wider text-white/85">{label}</p>
      </div>
      <p className="relative mt-1 text-2xl font-bold font-mono leading-none">{value}</p>
    </div>
  );
  if (!hint) return card;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

