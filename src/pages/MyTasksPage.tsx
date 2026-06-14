import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ListChecks, Loader2, Plug, ArrowLeft, MessageSquare, Send, CheckCircle2,
  ExternalLink, Calendar, RefreshCw, Search,
} from 'lucide-react';
import { toast } from 'sonner';

interface Task {
  id: string;
  name: string;
  status: string | null;
  statusColor: string | null;
  dueDate: number | null;
  priority: string | null;
  listName: string | null;
  spaceName: string | null;
  url: string;
}
interface Comment { id: string; text: string; user: string; date: number | null }
interface StatusOpt { status: string; color: string }
interface TaskDetail {
  id: string; name: string; description: string; status: string | null; statusColor: string | null;
  dueDate: number | null; priority: string | null; listName: string | null; assignees: string[]; url: string;
}

function fmtDate(ms: number | null) {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isClosedStatus(s: string | null) {
  if (!s) return false;
  return /done|complete|closed|cerrad|finaliz/i.test(s);
}

export default function MyTasksPage() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [matched, setMatched] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [includeClosed, setIncludeClosed] = useState(false);

  // Detail panel
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [statuses, setStatuses] = useState<StatusOpt[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);
  const [updating, setUpdating] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('clickup-tasks', {
      body: { action: 'list', includeClosed },
    });
    setLoading(false);
    // Function not deployed yet or no token → show the connect gate
    if (error || (data as any)?.connected === false) { setConnected(false); return; }
    setConnected(true);
    setMatched((data as any)?.matched !== false);
    setTasks((data as any)?.tasks ?? []);
  }, [includeClosed]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const openTask = async (id: string) => {
    setOpenId(id);
    setDetail(null);
    setComments([]);
    setStatuses([]);
    setReply('');
    setDetailLoading(true);
    const { data, error } = await supabase.functions.invoke('clickup-tasks', { body: { action: 'task', taskId: id } });
    setDetailLoading(false);
    if (error || (data as any)?.error) { toast.error('Could not load task'); return; }
    setDetail((data as any).task);
    setComments((data as any).comments ?? []);
    setStatuses((data as any).statuses ?? []);
  };

  const postComment = async () => {
    if (!openId || !reply.trim()) return;
    setPosting(true);
    const { data, error } = await supabase.functions.invoke('clickup-tasks', {
      body: { action: 'comment', taskId: openId, text: reply.trim() },
    });
    setPosting(false);
    if (error || (data as any)?.error) { toast.error('Could not post comment'); return; }
    toast.success('Comment posted');
    setReply('');
    openTask(openId);
  };

  const setStatus = async (status: string) => {
    if (!openId) return;
    setUpdating(true);
    const { data, error } = await supabase.functions.invoke('clickup-tasks', {
      body: { action: 'set_status', taskId: openId, status },
    });
    setUpdating(false);
    if (error || (data as any)?.error) { toast.error('Could not update status'); return; }
    toast.success(`Moved to "${status}"`);
    openTask(openId);
    loadTasks();
  };

  const completeStatus = statuses.find(s => isClosedStatus(s.status));

  const filtered = tasks.filter(t => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || (t.listName || '').toLowerCase().includes(q);
  });

  // ── Connection gate ──
  if (connected === false) {
    return (
      <div className="max-w-2xl mx-auto mt-12 space-y-4">
        <header className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">My Tasks</h1>
            <p className="text-sm text-muted-foreground">Your ClickUp tasks, comments and status — inside Apache.</p>
          </div>
        </header>
        <Card className="p-8 text-center space-y-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Plug className="h-6 w-6 text-primary" />
          </div>
          <h2 className="font-semibold text-foreground">Connect ClickUp to get started</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Once the workspace API token is added, every member sees and manages the tasks assigned to
            them — view content, read and reply to comments, and mark them complete — without leaving Apache.
            The messy organization stays in ClickUp; the doing happens here.
          </p>
          <p className="text-xs text-muted-foreground">
            Setup (one-time): add <span className="font-mono">CLICKUP_API_TOKEN</span> to the project secrets.
          </p>
        </Card>
      </div>
    );
  }

  // ── Task detail ──
  if (openId) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => { setOpenId(null); }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> All tasks
        </Button>

        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Card className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg font-bold text-foreground">{detail.name}</h1>
                <Button variant="ghost" size="sm" className="h-7 shrink-0" asChild>
                  <a href={detail.url} target="_blank" rel="noopener noreferrer">
                    ClickUp <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {detail.status && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-white font-medium"
                    style={{ background: detail.statusColor || '#6b7280' }}>
                    {detail.status}
                  </span>
                )}
                {detail.listName && <Badge variant="secondary" className="text-[10px]">{detail.listName}</Badge>}
                {detail.dueDate && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {fmtDate(detail.dueDate)}
                  </span>
                )}
                {detail.assignees.length > 0 && (
                  <span className="text-muted-foreground">· {detail.assignees.join(', ')}</span>
                )}
              </div>
              {detail.description && (
                <p className="text-sm text-foreground/90 whitespace-pre-line border-t border-border pt-3">
                  {detail.description}
                </p>
              )}

              {/* Status actions */}
              <div className="flex items-center gap-2 flex-wrap border-t border-border pt-3">
                {completeStatus && !isClosedStatus(detail.status) && (
                  <Button size="sm" onClick={() => setStatus(completeStatus.status)} disabled={updating}>
                    {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    Mark complete
                  </Button>
                )}
                {statuses.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {statuses.filter(s => s.status !== detail.status).map(s => (
                      <button
                        key={s.status}
                        onClick={() => setStatus(s.status)}
                        disabled={updating}
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                      >
                        Move to {s.status}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Comments */}
            <Card className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Comments ({comments.length})
              </h2>
              <div className="space-y-3 mb-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : comments.map(c => (
                  <div key={c.id} className="border-b border-border pb-3 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-foreground">{c.user}</span>
                      {c.date && <span className="text-[11px] text-muted-foreground">{fmtDate(c.date)}</span>}
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-line">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Write a reply..."
                  rows={2}
                  className="text-sm"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment(); }}
                />
                <Button size="icon" className="h-auto shrink-0" onClick={postComment} disabled={posting || !reply.trim()}>
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    );
  }

  // ── Task list ──
  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <ListChecks className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">My Tasks</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Everything assigned to you in ClickUp — view, reply and complete without leaving Apache.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIncludeClosed(v => !v)}>
            {includeClosed ? 'Hide closed' : 'Show closed'}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={loadTasks} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!matched && (
        <div className="border border-warning/40 bg-warning/5 rounded-lg p-4 text-sm">
          <p className="font-medium text-foreground">No ClickUp member matches your email</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ask an admin to make sure your Apache email matches your ClickUp account email.
          </p>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." className="pl-9 h-9" />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground space-y-2">
          <CheckCircle2 className="h-8 w-8 mx-auto text-success" />
          <p className="text-sm">{tasks.length === 0 ? 'No tasks assigned to you right now.' : `No tasks match "${search}".`}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <button
              key={t.id}
              onClick={() => openTask(t.id)}
              className="w-full text-left border border-border rounded-lg bg-card p-3.5 flex items-center justify-between gap-3
                hover:shadow-sm hover:border-primary/40 transition-all"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                  {t.listName && <span className="truncate">{t.spaceName ? `${t.spaceName} · ` : ''}{t.listName}</span>}
                  {t.dueDate && <span className="flex items-center gap-1 shrink-0"><Calendar className="h-3 w-3" />{fmtDate(t.dueDate)}</span>}
                </div>
              </div>
              {t.status && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-white text-[10px] font-medium shrink-0"
                  style={{ background: t.statusColor || '#6b7280' }}>
                  {t.status}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
