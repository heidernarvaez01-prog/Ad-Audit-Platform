import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, PieChart, Loader2, Save, ExternalLink, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Per-client Looker Studio embed with an approval flow:
 * edit freely in Looker → paste the embed URL here → flip "Approved"
 * and only then the final report is visible inside Apache.
 */
export default function ReportingPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [url, setUrl] = useState('');
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    if (!clientId) return;
    const { data: c, error } = await supabase
      .from('audit_clients')
      .select('id, name, looker_report_url, looker_approved')
      .eq('id', clientId)
      .maybeSingle();
    if (error || !c) {
      toast.error('Client not found');
      navigate('/reporting', { replace: true });
      return;
    }
    setClient({ id: c.id, name: c.name });
    setUrl((c as any).looker_report_url || '');
    setApproved(!!(c as any).looker_approved);
    setLoaded(true);
  }, [clientId, navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Normalize a Looker Studio link into its embeddable form
  const toEmbedUrl = (raw: string): string => {
    const t = raw.trim();
    if (!t) return '';
    if (t.includes('/embed/')) return t;
    return t.replace('lookerstudio.google.com/reporting/', 'lookerstudio.google.com/embed/reporting/')
            .replace('lookerstudio.google.com/u/0/reporting/', 'lookerstudio.google.com/embed/reporting/');
  };

  const save = async () => {
    if (!clientId) return;
    const trimmed = url.trim();
    if (trimmed && !/^https:\/\/(lookerstudio\.google\.com|datastudio\.google\.com)\//.test(trimmed)) {
      toast.error('Paste a valid Looker Studio URL (lookerstudio.google.com)');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('audit_clients')
      .update({ looker_report_url: trimmed || null, looker_approved: trimmed ? approved : false })
      .eq('id', clientId);
    setSaving(false);
    if (error) { toast.error('Error saving'); return; }
    toast.success('Reporting settings saved');
  };

  const embedUrl = toEmbedUrl(url);

  return (
    <div className="space-y-5 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="shrink-0 -ml-2" onClick={() => navigate('/reporting')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Clients
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">
              {client ? `${client.name} — Reporting` : 'Reporting'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              This client's full visual report. Edit it in Looker, approve it here, and it goes live.
            </p>
          </div>
        </div>
        {approved && url && <Badge className="bg-success text-success-foreground shrink-0">Approved</Badge>}
      </div>

      {/* Settings */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Report source</h2>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Looker Studio URL</Label>
          <p className="text-[11px] text-muted-foreground">
            In Looker Studio: File → Embed report → copy the link. Regular report links also work.
          </p>
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://lookerstudio.google.com/reporting/..."
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>Approved for viewing</Label>
            <p className="text-xs text-muted-foreground">
              Keep this OFF while you edit in Looker. Turn it ON to publish the final version here.
            </p>
          </div>
          <Switch checked={approved} onCheckedChange={setApproved} disabled={!url.trim()} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save
          </Button>
        </div>
      </Card>

      {/* Embed */}
      {loaded && (
        approved && embedUrl ? (
          <Card className="overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Approved report</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Open in Looker <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            </div>
            <iframe
              title={`Looker report — ${client?.name}`}
              src={embedUrl}
              className="w-full border-0 bg-white"
              style={{ height: 'calc(100vh - 320px)', minHeight: 480 }}
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </Card>
        ) : (
          <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground space-y-2">
            <EyeOff className="h-8 w-8 mx-auto" />
            <p className="text-sm font-medium text-foreground">
              {url ? 'Report pending approval' : 'No report connected yet'}
            </p>
            <p className="text-xs">
              {url
                ? 'The report is connected but not approved. Approve it above when the final version is ready.'
                : 'Paste the Looker Studio URL above to connect this client\'s report.'}
            </p>
          </div>
        )
      )}
    </div>
  );
}
