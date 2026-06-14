import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from('user_roles').select('role')
      .eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) return json({ error: 'Forbidden: admin only' }, 403);

    // ── Actions (POST) ──
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const action = body?.action as string;

      if (action === 'invite') {
        const email = String(body?.email ?? '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email' }, 400);
        const redirectTo = body?.redirectTo ? String(body.redirectTo) : undefined;
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, redirectTo ? { redirectTo } : undefined);
        if (error) {
          // Already registered → treat as success (idempotent invite)
          if (String(error.message).toLowerCase().includes('already')) {
            return json({ ok: true, alreadyMember: true });
          }
          return json({ error: error.message }, 400);
        }
        return json({ ok: true, userId: data.user?.id });
      }

      if (action === 'reset_password') {
        const email = String(body?.email ?? '').trim().toLowerCase();
        if (!email) return json({ error: 'email required' }, 400);
        const redirectTo = body?.redirectTo ? String(body.redirectTo) : undefined;
        // Generate a recovery link and email it via Supabase's built-in mailer
        const { error } = await admin.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      return json({ error: 'Unknown action' }, 400);
    }

    // ── List users (GET) — only real, confirmed accounts with an email ──
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;

    const users = data.users
      .filter((u) => !!u.email) // drop anonymous/empty rows that cluttered the list
      .map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        confirmed: !!u.email_confirmed_at || !!u.confirmed_at,
      }));

    return json({ users });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
