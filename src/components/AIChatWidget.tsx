import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Loader2, X, ChevronLeft, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface Msg { role: 'user' | 'assistant'; content: string }
interface ClientOpt { id: string; name: string }

const SUGGESTIONS = [
  'How is this campaign performing this week?',
  'Is the budget pacing on track?',
  'Give me 3 actionable optimizations',
  'Any cost or delivery red flags?',
];

/**
 * Premium floating AI chat. Flow: pick client → pick campaign → ask.
 * Context is scoped so answers are about exactly what was selected.
 */
export default function AIChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [client, setClient] = useState<ClientOpt | null>(null);
  const [campaign, setCampaign] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from('audit_clients').select('id, name').order('name')
      .then(({ data }) => setClients((data || []) as ClientOpt[]));
  }, [open, user]);

  useEffect(() => {
    if (!client) { setCampaigns([]); return; }
    supabase.from('audit_records').select('campaign_name').eq('client_id', client.id)
      .then(({ data }) => {
        setCampaigns([...new Set((data || []).map(r => r.campaign_name).filter(Boolean))].sort());
      });
  }, [client]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const reset = useCallback(() => {
    setClient(null);
    setCampaign(null);
    setMessages([]);
    setQuestion('');
  }, []);

  const ask = async (q: string) => {
    if (!q.trim() || loading || !client) return;
    setMessages(m => [...m, { role: 'user', content: q }]);
    setQuestion('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('metrics-ai-analysis', {
        body: {
          question: q,
          clientId: client.id,
          campaignName: campaign === '__all__' ? undefined : campaign,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages(m => [...m, { role: 'assistant', content: data.answer }]);
    } catch (e: any) {
      toast.error(e.message ?? 'Analysis failed');
      setMessages(m => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const step: 'client' | 'campaign' | 'chat' = !client ? 'client' : !campaign ? 'campaign' : 'chat';

  return (
    <>
      {/* Floating bubble */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="bubble"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full
              bg-gradient-to-br from-primary to-primary/70 text-primary-foreground
              shadow-lg shadow-primary/30 flex items-center justify-center"
            aria-label="Open AI Analysis"
          >
            <Sparkles className="h-6 w-6 relative z-10" />
            <motion.span
              animate={{ scale: [1, 1.35, 1], opacity: [0.45, 0, 0.45] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full bg-primary"
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed bottom-5 right-5 z-50 w-[min(400px,calc(100vw-24px))] h-[min(580px,calc(100vh-40px))]
              rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl
              flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between
              bg-gradient-to-r from-primary/10 via-transparent to-transparent shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {step !== 'client' && (
                  <button
                    onClick={() => step === 'chat' ? (setCampaign(null), setMessages([])) : setClient(null)}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Back"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground leading-tight">AI Analysis</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {step === 'client' && 'Select a client to begin'}
                    {step === 'campaign' && client?.name}
                    {step === 'chat' && `${client?.name} · ${campaign === '__all__' ? 'All campaigns' : campaign}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setOpen(false); reset(); }}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
              {step === 'client' && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-muted-foreground px-1 pb-1">
                    Which client do you want to analyze?
                  </p>
                  {clients.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1">No clients yet — create one in Monitoring Audit.</p>
                  ) : clients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setClient(c)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-border bg-background/60
                        hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium text-foreground"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              {step === 'campaign' && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-muted-foreground px-1 pb-1">
                    Which campaign?
                  </p>
                  <button
                    onClick={() => setCampaign('__all__')}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5
                      hover:bg-primary/10 transition-all text-sm font-medium text-foreground"
                  >
                    ✦ All campaigns of {client?.name}
                  </button>
                  {campaigns.map(name => (
                    <button
                      key={name}
                      onClick={() => setCampaign(name)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-border bg-background/60
                        hover:border-primary/40 hover:bg-primary/5 transition-all text-xs text-foreground truncate"
                    >
                      {name}
                    </button>
                  ))}
                  {campaigns.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1">
                      This client has no audited campaigns yet — you can still ask about it in general.
                    </p>
                  )}
                </div>
              )}

              {step === 'chat' && (
                <>
                  {messages.length === 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs text-muted-foreground px-1 pb-1">Ask anything, or start with:</p>
                      {SUGGESTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => ask(s)}
                          className="w-full text-left px-3 py-2 rounded-lg border border-border bg-background/60
                            hover:border-primary/40 hover:bg-primary/5 transition-all text-xs text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'ml-auto bg-primary text-primary-foreground'
                          : 'mr-auto bg-muted text-foreground'
                      }`}
                    >
                      {m.role === 'assistant' ? (
                        <div className="prose prose-xs dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : m.content}
                    </div>
                  ))}
                  {loading && (
                    <div className="mr-auto bg-muted rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing data...
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input */}
            {step === 'chat' && (
              <form
                onSubmit={e => { e.preventDefault(); ask(question); }}
                className="p-3 border-t border-border flex gap-2 shrink-0 bg-background/40"
              >
                <Textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Ask about performance..."
                  rows={1}
                  className="min-h-[38px] max-h-24 text-xs resize-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(question); }
                  }}
                />
                <Button type="submit" size="icon" className="h-[38px] w-[38px] shrink-0" disabled={loading || !question.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
