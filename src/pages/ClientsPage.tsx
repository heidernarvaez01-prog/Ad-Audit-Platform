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
import { Plus, Pencil, Trash2, Loader2, FolderOpen, Briefcase, ArrowRight } from 'lucide-react';
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-foreground">Clients</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            One audit workspace per client or brand — audits never mix between clients
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Client
        </Button>
      </div>

      {/* Global summary across all clients */}
      {clients.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <GlobalCard label="Clients" value={clients.length.toString()} />
          <GlobalCard label="Campaigns" value={totals.campaigns.toString()} />
          <GlobalCard label="Total Budget" value={fmt(totals.budget)} />
          <GlobalCard label="Total Spend" value={fmt(totals.spent)} />
          <GlobalCard
            label="At Risk"
            value={(totals.over + totals.under).toString()}
            color={totals.over + totals.under > 0 ? 'text-warning' : 'text-success'}
            hint="Campaigns overspending or underspending across all clients."
          />
        </div>
      )}

      {/* Client cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : clients.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground space-y-2">
          <FolderOpen className="h-8 w-8 mx-auto" />
          <p className="text-sm">No clients yet.</p>
          <p className="text-xs">Create your first client to start auditing its campaigns.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Client
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {clients.map(c => {
            const s = summaries.get(c.id) || { campaigns: 0, budget: 0, spent: 0, ok: 0, under: 0, over: 0 };
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/client/${c.id}`)}
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
                  <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
                  <Mini label="Campaigns" value={s.campaigns.toString()} />
                  <Mini label="Budget" value={fmt(s.budget)} />
                  <Mini label="Spend" value={fmt(s.spent)} />
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-[10px]">
                    <StatusDot count={s.ok} color="bg-success" label="on track" />
                    <StatusDot count={s.under} color="bg-warning" label="under" />
                    <StatusDot count={s.over} color="bg-destructive" label="over" />
                  </div>
                  <span className="text-[11px] text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

function GlobalCard({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
  const card = (
    <div className="border border-border rounded-lg bg-card p-3 relative overflow-hidden transition-all duration-200 hover:shadow-md animate-fade-in">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold font-mono leading-tight mt-1 ${color || 'text-foreground'}`}>{value}</p>
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
