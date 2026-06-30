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

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'Apache Studio <alertas@apachestudio.mx>';

async function sendInviteEmail(email: string, link: string) {
  if (!RESEND_API_KEY) return { sent: false, reason: 'no_resend_key' };
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#ffffff;color:#0f172a">
      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;border-radius:14px;color:#fff;margin-bottom:24px">
        <h1 style="margin:0;font-size:22px">You've been invited to Apache Studio</h1>
        <p style="margin:8px 0 0;opacity:.9;font-size:14px">Audit & campaign monitoring workspace</p>
      </div>
      <p style="font-size:15px;line-height:1.55">An administrator has invited you to join the workspace. Click the button below to set your password and access your assigned ad accounts.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;display:inline-block">Accept invitation</a>
      </p>
      <p style="font-size:12px;color:#64748b;word-break:break-all">Or open this link in your browser:<br/>${link}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="font-size:11px;color:#94a3b8">If you weren't expecting this invitation, you can ignore this email.</p>
    </div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: 'You have been invited to Apache Studio', html }),
  });
  if (!res.ok) {
    const txt = await res.text();
    return { sent: false, reason: `resend_${res.status}`, detail: txt };
  }
  return { sent: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = (body?.action as string) || 'list';

    if (action === 'invite') {
      const email = String(body?.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email' }, 400);
      const redirectTo = body?.redirectTo ? String(body.redirectTo) : undefined;

      // Generate the invite link explicitly so we always have a URL to embed in the email
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: redirectTo ? { redirectTo } : undefined,
      });

      if (linkErr) {
        if (String(linkErr.message).toLowerCase().includes('already')) {
          return json({ ok: true, alreadyMember: true });
        }
        return json({ error: linkErr.message }, 400);
      }

      const actionLink = linkData?.properties?.action_link;
      let emailResult: any = { sent: false, reason: 'no_link' };
      if (actionLink) emailResult = await sendInviteEmail(email, actionLink);

      return json({
        ok: true,
        userId: linkData?.user?.id,
        actionLink,
        email: emailResult,
      });
    }

    if (action === 'reset_password') {
      const email = String(body?.email ?? '').trim().toLowerCase();
      if (!email) return json({ error: 'email required' }, 400);
      const redirectTo = body?.redirectTo ? String(body.redirectTo) : undefined;
      const { data: linkData, error } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) return json({ error: error.message }, 400);
      const actionLink = linkData?.properties?.action_link;
      let emailResult: any = { sent: false };
      if (actionLink && RESEND_API_KEY) {
        const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px"><h2>Reset your password</h2><p>Click the button below to set a new password for your Apache Studio account.</p><p style="text-align:center;margin:24px 0"><a href="${actionLink}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Reset password</a></p><p style="font-size:12px;color:#64748b;word-break:break-all">${actionLink}</p></div>`;
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: 'Reset your Apache Studio password', html }),
        });
        emailResult = { sent: res.ok };
      }
      return json({ ok: true, actionLink, email: emailResult });
    }

    // Default action: list users
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;

    const users = data.users
      .filter((u) => !!u.email)
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
