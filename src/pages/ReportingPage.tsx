import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, PieChart, Loader2, Save, ExternalLink, EyeOff, Sparkles, Copy } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

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

  // AI period conclusions
  const [period, setPeriod] = useState<'last_7' | 'last_30' | 'this_month' | 'last_month'>('last_30');
  const [conclusions, setConclusions] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

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

  // Normalize a Looker Studio link (or a pasted <iframe> snippet) into its
  // embeddable form. Handles /u/0/, /edit suffixes, and raw report links.
  const toEmbedUrl = (raw: string): string => {
    let t = raw.trim();
    if (!t) return '';
    // If they pasted the whole "Embed report" iframe HTML, pull out the src
    const srcMatch = t.match(/src=["']([^"']+)["']/i);
    if (srcMatch) t = srcMatch[1];
    t = t.trim();
    if (t.includes('/embed/')) return t;
    // Drop the account segment (/u/0/) and any trailing /edit
    t = t.replace('lookerstudio.google.com/u/0/', 'lookerstudio.google.com/')
         .replace('datastudio.google.com/u/0/', 'datastudio.google.com/')
         .replace(/\/edit(\b|\/|\?|$)/, '$1');
    return t.replace('lookerstudio.google.com/reporting/', 'lookerstudio.google.com/embed/reporting/')
            .replace('datastudio.google.com/reporting/', 'datastudio.google.com/embed/reporting/');
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

  const PERIOD_LABEL: Record<typeof period, string> = {
    last_7: 'the last 7 days',
    last_30: 'the last 30 days',
    this_month: 'the current month',
    last_month: 'the previous month',
  };

  const generateConclusions = async () => {
    if (!clientId) return;
    setAnalyzing(true);
    setConclusions('');
    const question = `Write executive conclusions for ${client?.name ?? 'this client'} covering ${PERIOD_LABEL[period]}, to accompany their Looker Studio report. Focus on: overall performance, what improved or worsened, and 2-3 clear takeaways the account manager can paraphrase to the client. Keep it concise and presentation-ready. Answer in English.`;
    const { data, error } = await supabase.functions.invoke('metrics-ai-analysis', {
      body: { question, clientId },
    });
    setAnalyzing(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || 'Could not generate conclusions');
      return;
    }
    setConclusions((data as any).answer || '');
  };

  const copyConclusions = () => {
    navigator.clipboard.writeText(conclusions);
    toast.success('Conclusions copied');
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
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
              Blank? In Looker Studio open <span className="font-medium">File → Embed report</span> and turn on
              <span className="font-medium"> "Enable embedding"</span>, then make sure link sharing is set so anyone with the link can view.
            </div>
          </Card>
        ) : null
      )}

      {/* AI period conclusions — available once the report is approved */}
      {loaded && approved && url && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">AI conclusions for this period</h2>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            A ready-to-paraphrase read of this client's performance, to send alongside the report.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last_7">Last 7 days</SelectItem>
                <SelectItem value="last_30">Last 30 days</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={generateConclusions} disabled={analyzing}>
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              Generate conclusions
            </Button>
            {conclusions && (
              <Button size="sm" variant="ghost" onClick={copyConclusions}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
              </Button>
            )}
          </div>
          {conclusions && (
            <div className="border border-border rounded-lg bg-muted/30 p-4 prose prose-sm dark:prose-invert max-w-none [&_p]:my-1.5 [&_ul]:my-1.5">
              <ReactMarkdown>{conclusions}</ReactMarkdown>
            </div>
          )}
        </Card>
      )}

      {/* Empty / pending state */}
      {loaded && !(approved && embedUrl) && (
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
      )}
    </div>
  );
}
