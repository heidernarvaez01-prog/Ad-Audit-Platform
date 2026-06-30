import { useEffect, useMemo, useState } from 'react';
import { Shield, UserPlus, Trash2, Loader2, Users, Link2, ShieldCheck, ShieldOff, Mail, KeyRound, Send, Ban, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import PageHero from '@/components/PageHero';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface UserRow { id: string; email: string | null; last_sign_in_at: string | null; confirmed?: boolean; }
interface Assignment { id: string; user_id: string; account_id: string; account_name: string | null; platform: string | null; }
interface AccountOpt { account_id: string; account_name: string | null; platform: string | null; }
interface RoleRow { user_id: string; role: 'admin' | 'user'; }

export default function AdminPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selUser, setSelUser] = useState<string>('');
  const [selAccount, setSelAccount] = useState<string>('');
  const [selRole, setSelRole] = useState<'user' | 'admin'>('user');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Invite member
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const loadData = async () => {
    const [usersRes, accountsRes, assignmentsRes, rolesRes] = await Promise.all([
      supabase.functions.invoke('admin-users'),
      supabase.from('meta_datos').select('account_id, account_name, plataforma').not('account_id', 'is', null),
      supabase.from('account_assignments').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    if (usersRes.data?.users) setUsers(usersRes.data.users);
    if (assignmentsRes.data) setAssignments(assignmentsRes.data as Assignment[]);
    if (rolesRes.data) setRoles(rolesRes.data as RoleRow[]);

    const seen = new Set<string>();
    const opts: AccountOpt[] = [];
    for (const r of accountsRes.data ?? []) {
      const key = `${r.account_id}|${r.plataforma ?? ''}`;
      if (seen.has(key) || !r.account_id) continue;
      seen.add(key);
      opts.push({ account_id: r.account_id, account_name: r.account_name, platform: r.plataforma });
    }
    opts.sort((a, b) => (a.account_name ?? '').localeCompare(b.account_name ?? ''));
    setAccounts(opts);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: roleRow } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      const admin = !!roleRow;
      setIsAdmin(admin);
      if (admin) await loadData();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const adminIds = useMemo(() => new Set(roles.filter((r) => r.role === 'admin').map((r) => r.user_id)), [roles]);

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => {
      const email = userById[a.user_id]?.email ?? '';
      return email.toLowerCase().includes(q) || (a.account_name ?? '').toLowerCase().includes(q) || a.account_id.includes(q);
    });
  }, [assignments, search, userById]);

  const invite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Invalid email', variant: 'destructive' });
      return;
    }
    setInviting(true);
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'invite', email, redirectTo: `${window.location.origin}/auth` },
    });
    setInviting(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Could not send invite', description: error?.message || (data as any)?.error, variant: 'destructive' });
      return;
    }
    toast({ title: (data as any)?.alreadyMember ? 'That email is already a member' : `Invitation sent to ${email}` });
    setInviteEmail('');
    setTimeout(loadData, 1500);
  };

  const sendReset = async (email: string) => {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'reset_password', email, redirectTo: `${window.location.origin}/auth` },
    });
    if (error || (data as any)?.error) {
      toast({ title: 'Could not send reset link', description: error?.message || (data as any)?.error, variant: 'destructive' });
      return;
    }
    toast({ title: `Password reset link sent to ${email}` });
  };

  const assign = async () => {
    if (!selUser || !selAccount) {
      toast({ title: 'Select a user and an account', variant: 'destructive' });
      return;
    }
    const acc = accounts.find((a) => `${a.account_id}|${a.platform ?? ''}` === selAccount);
    if (!acc) return;
    setSaving(true);
    const { data, error } = await supabase.from('account_assignments').insert({
      user_id: selUser, account_id: acc.account_id, account_name: acc.account_name, platform: acc.platform, created_by: user!.id,
    }).select().single();
    if (error) { setSaving(false); toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

    // Persist role (default 'user'; admin upserts if selected)
    if (selRole === 'admin' && !adminIds.has(selUser)) {
      const { error: rErr } = await supabase.from('user_roles').insert({ user_id: selUser, role: 'admin' });
      if (!rErr) setRoles([...roles, { user_id: selUser, role: 'admin' }]);
    } else if (selRole === 'user') {
      // Ensure a baseline 'user' role row exists
      await supabase.from('user_roles').upsert({ user_id: selUser, role: 'user' }, { onConflict: 'user_id,role' });
      if (!roles.some(r => r.user_id === selUser && r.role === 'user')) {
        setRoles([...roles, { user_id: selUser, role: 'user' }]);
      }
    }

    setAssignments([data as Assignment, ...assignments]);
    setSelAccount('');
    setSaving(false);
    toast({ title: 'Account assigned', description: `Role: ${selRole}` });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('account_assignments').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setAssignments(assignments.filter((a) => a.id !== id));
  };

  // Owner revoke: strip every account assignment + admin role from a member.
  // Their login still exists but they can no longer see any account.
  const revokeAccess = async (uid: string, email: string | null) => {
    const [a, r] = await Promise.all([
      supabase.from('account_assignments').delete().eq('user_id', uid),
      supabase.from('user_roles').delete().eq('user_id', uid),
    ]);
    if (a.error || r.error) {
      toast({ title: 'Error revoking access', description: a.error?.message || r.error?.message, variant: 'destructive' });
      return;
    }
    setAssignments(prev => prev.filter(x => x.user_id !== uid));
    setRoles(prev => prev.filter(x => x.user_id !== uid));
    toast({ title: `Access revoked for ${email ?? 'member'}` });
  };

  const toggleAdmin = async (uid: string) => {
    const isAdminUser = adminIds.has(uid);
    if (isAdminUser) {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', uid).eq('role', 'admin');
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      setRoles(roles.filter((r) => !(r.user_id === uid && r.role === 'admin')));
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: uid, role: 'admin' });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      setRoles([...roles, { user_id: uid, role: 'admin' }]);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>;
  }
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="p-6 text-center space-y-2">
          <Shield className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="font-semibold">Restricted access</h2>
          <p className="text-sm text-muted-foreground">Only administrators can access this module.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHero
        icon={Shield}
        title="Admin"
        subtitle="Invite your team, give each member access to specific accounts, and manage permissions."
        gradient="from-slate-800 via-indigo-700 to-blue-600"
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AdminStat icon={Users} label="Members" value={users.length} gradient="from-indigo-500 to-indigo-700" />
        <AdminStat icon={ShieldCheck} label="Admins" value={adminIds.size} gradient="from-violet-500 to-purple-700" />
        <AdminStat icon={Link2} label="Assignments" value={assignments.length} gradient="from-sky-500 to-blue-700" />
        <AdminStat icon={Building2} label="Accounts" value={accounts.length} gradient="from-emerald-500 to-teal-700" />
      </div>


      {/* STEP 1 — Invite member */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">1 · Invite a team member</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          They receive an email to set their password and join. Then you can assign them accounts below.
        </p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="teammate@agency.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') invite(); }}
          />
          <Button onClick={invite} disabled={inviting}>
            {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send invite
          </Button>
        </div>
      </Card>

      {/* STEP 2 — Assign account access */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">2 · Give access to an account</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Each member only sees the ad accounts you assign here. Admins and the owner see everything.
        </p>
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label>Member</Label>
            <Select value={selUser} onValueChange={setSelUser}>
              <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.email ?? u.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ad account</Label>
            <Select value={selAccount} onValueChange={setSelAccount}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => {
                  const key = `${a.account_id}|${a.platform ?? ''}`;
                  return (
                    <SelectItem key={key} value={key}>
                      {a.account_name ?? a.account_id} · {a.platform ?? '—'} ({a.account_id})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={selRole} onValueChange={(v) => setSelRole(v as 'user' | 'admin')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Member (view assigned accounts)</SelectItem>
                <SelectItem value="admin">Admin (full access)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end sm:col-span-4">
            <Button onClick={assign} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Assign access
            </Button>
          </div>
        </div>
      </Card>

      {/* Assignments list */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Access assignments ({assignments.length})</h2>
          </div>
          <Input
            placeholder="Search by email, account or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {filteredAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No assignments yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {filteredAssignments.map((a) => (
              <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{userById[a.user_id]?.email ?? a.user_id}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.account_name ?? a.account_id} · {a.platform ?? '—'} <span className="font-mono-data">({a.account_id})</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(a.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Team members + roles + password reset */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Team members ({users.length})</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2 mb-3">
          Admins have full control over every account. Send a reset link so members can set or change their own password.
        </p>
        <div className="divide-y divide-border">
          {users.map((u) => {
            const isA = adminIds.has(u.id);
            const isSelf = u.id === user!.id;
            return (
              <div key={u.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-sm truncate">{u.email}</span>
                  {isA && <Badge variant="secondary" className="text-xs">admin</Badge>}
                  {u.confirmed === false && <Badge variant="outline" className="text-[10px] text-warning">invited</Badge>}
                  {isSelf && <Badge variant="outline" className="text-[10px]">you</Badge>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={() => u.email && sendReset(u.email)} title="Send password reset link">
                    <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Reset password
                  </Button>
                  <Button
                    variant={isA ? 'outline' : 'secondary'}
                    size="sm"
                    onClick={() => toggleAdmin(u.id)}
                    disabled={isSelf}
                    title={isSelf ? "You can't change your own role" : ''}
                  >
                    {isA ? <><ShieldOff className="h-3.5 w-3.5 mr-1.5" />Remove admin</> : <><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Make admin</>}
                  </Button>
                  {!isSelf && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => revokeAccess(u.id, u.email)}
                      title="Remove all account access and admin role"
                    >
                      <Ban className="h-3.5 w-3.5 mr-1.5" /> Revoke access
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function AdminStat({
  icon: Icon, label, value, gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  gradient: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl p-4 text-white shadow-md
        bg-gradient-to-br ${gradient} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg animate-fade-in`}
    >
      <div aria-hidden className="absolute -right-3 -bottom-3 opacity-20">
        <Icon className="h-16 w-16" />
      </div>
      <p className="relative text-[10px] uppercase tracking-wider text-white/85">{label}</p>
      <p className="relative mt-1 text-3xl font-bold font-mono leading-none">{value}</p>
    </div>
  );
}
