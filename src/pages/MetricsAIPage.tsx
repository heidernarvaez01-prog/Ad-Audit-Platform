import { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

const SUGGESTIONS = [
  '¿Qué campañas tienen el peor CTR y por qué?',
  'Detecta campañas con gasto alto y bajo rendimiento',
  'Resume el desempeño general de mis cuentas esta semana',
  'Dame 3 recomendaciones accionables para optimizar mi presupuesto',
];

interface Msg { role: 'user' | 'assistant'; content: string }

export default function MetricsAIPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async (q: string) => {
    if (!q.trim() || loading) return;
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setQuestion('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('metrics-ai-analysis', {
        body: { question: q },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }]);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'No se pudo analizar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <header className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Análisis de Métricas con IA</h1>
          <p className="text-sm text-muted-foreground">
            Pregunta sobre el rendimiento de tus campañas. Analizo los datos sincronizados de tus cuentas.
          </p>
        </div>
      </header>

      {messages.length === 0 && (
        <div className="grid sm:grid-cols-2 gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="text-left p-3 rounded-lg border border-border hover:bg-accent text-sm transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {messages.map((m, i) => (
          <Card key={i} className={`p-4 ${m.role === 'user' ? 'bg-muted' : ''}`}>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {m.role === 'user' ? 'Tú' : 'Análisis IA'}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </Card>
        ))}
        {loading && (
          <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analizando tus datos...
          </Card>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(question); }}
        className="sticky bottom-0 bg-background pt-2 flex gap-2"
      >
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pregunta sobre tus campañas..."
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(question); }
          }}
        />
        <Button type="submit" disabled={loading || !question.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
