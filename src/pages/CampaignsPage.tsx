import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PLATFORM_CONFIG } from '@/lib/platforms';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Campaign = Database['public']['Tables']['campaign_tracking']['Row'];

export default function CampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('campaign_tracking').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setCampaigns(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleDelete = async (id: string) => {
    await supabase.from('campaign_tracking').delete().eq('id', id);
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Gestión de Campañas</h2>
      <div className="overflow-x-auto rounded border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Plataforma</th>
              <th className="text-left px-3 py-2 font-semibold">Campaña</th>
              <th className="text-left px-3 py-2 font-semibold">Cuenta</th>
              <th className="text-left px-3 py-2 font-semibold">Fechas</th>
              <th className="text-left px-3 py-2 font-semibold">Lab Days</th>
              <th className="text-right px-3 py-2 font-semibold">Aprobado</th>
              <th className="text-right px-3 py-2 font-semibold">Programado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No hay campañas registradas.</td></tr>
            ) : campaigns.map(c => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-3 py-2">
                  <span className={`font-semibold ${PLATFORM_CONFIG[c.platform].color}`}>{PLATFORM_CONFIG[c.platform].label}</span>
                </td>
                <td className="px-3 py-2 font-medium text-foreground">{c.campaign_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.account_name || '—'}</td>
                <td className="px-3 py-2 font-mono-data text-muted-foreground">{c.start_date} → {c.end_date}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.lab_days === 'mon_fri' ? 'L-V' : c.lab_days === 'mon_sat' ? 'L-S' : 'Todos'}</td>
                <td className="px-3 py-2 text-right font-mono-data">${Number(c.budget_approved).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono-data">${Number(c.programmed_budget).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
