import { useEffect, useMemo, useState } from 'react';
import { Shield, UserPlus, Trash2, Loader2, Users, Link2, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface UserRow { id: string; email: string | null; last_sign_in_at: string | null; }
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
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: roleRow } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      const admin = !!roleRow;
      setIsAdmin(admin);
      if (!admin) { setLoading(false); return; }

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
      setLoading(false);
    })();
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
    setSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setAssignments([data as Assignment, ...assignments]);
    setSelAccount('');
    toast({ title: 'Account assigned' });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('account_assignments').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setAssignments(assignments.filter((a) => a.id !== id));
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
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">Link accounts to users and manage permissions.</p>
        </div>
      </header>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">New assignment</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>User (email)</Label>
            <Select value={selUser} onValueChange={setSelUser}>
              <SelectTrigger><SelectValue placeholder="Select email" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.email ?? u.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Account</Label>
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
          <div className="flex items-end">
            <Button onClick={assign} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Assign
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Assignments ({assignments.length})</h2>
          </div>
          <Input
            placeholder="Search by email, account or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {filteredAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No assignments.</p>
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

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Administrators</h2>
        </div>
        <div className="divide-y divide-border">
          {users.map((u) => {
            const isA = adminIds.has(u.id);
            return (
              <div key={u.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-sm truncate">{u.email ?? u.id}</span>
                  {isA && <Badge variant="secondary" className="text-xs">admin</Badge>}
                </div>
                <Button
                  variant={isA ? 'outline' : 'secondary'}
                  size="sm"
                  onClick={() => toggleAdmin(u.id)}
                  disabled={u.id === user!.id}
                  title={u.id === user!.id ? "You can't remove your own role" : ''}
                >
                  {isA ? <><ShieldOff className="h-3.5 w-3.5 mr-1.5" />Remove admin</> : <><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Make admin</>}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
