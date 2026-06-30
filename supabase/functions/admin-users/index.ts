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
const REPLY_TO = 'soporte@apachestudio.mx';

async function sendInviteEmail(email: string, link: string, inviterEmail?: string) {
  if (!RESEND_API_KEY) return { sent: false, reason: 'no_resend_key' };
  const inviter = inviterEmail ? ` by ${inviterEmail}` : '';
  // Plain-text version helps a lot with spam scoring
  const text = `Hi,

You have been added${inviter} to the Apache Studio workspace.

Set your password and access the workspace here:
${link}

This link expires in 24 hours. If you did not expect this email, you can safely ignore it.

— Apache Studio`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <p style="font-size:15px;line-height:1.55">Hi,</p>
      <p style="font-size:15px;line-height:1.55">You have been added${inviter ? ` by <strong>${inviterEmail}</strong>` : ''} to the Apache Studio workspace. Use the link below to set your password and sign in.</p>
      <p style="margin:28px 0">
        <a href="${link}" style="background:#1e40af;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;display:inline-block">Set your password</a>
      </p>
      <p style="font-size:13px;color:#475569;word-break:break-all">If the button does not work, copy this URL into your browser:<br/>${link}</p>
      <p style="font-size:12px;color:#64748b;margin-top:24px">This link expires in 24 hours. If you did not expect this email, you can safely ignore it.</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:20px">Apache Studio · ${REPLY_TO}</p>
    </div></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      reply_to: REPLY_TO,
      subject: 'Your Apache Studio account is ready',
      text,
      html,
      headers: {
        'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      tags: [{ name: 'category', value: 'invite' }],
    }),
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
      if (actionLink) emailResult = await sendInviteEmail(email, actionLink, user.email ?? undefined);

      return json({
        ok: true,
        userId: linkData?.user?.id,
        actionLink,
        email: emailResult,
      });
    }

    if (action === 'delete_user') {
      const targetId = String(body?.userId ?? '').trim();
      if (!targetId) return json({ error: 'userId required' }, 400);
      if (targetId === user.id) return json({ error: "You can't delete your own account" }, 400);
      // Clean up app-level rows first; foreign keys may not cascade.
      await admin.from('account_assignments').delete().eq('user_id', targetId);
      await admin.from('user_roles').delete().eq('user_id', targetId);
      const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ ok: true });
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
        const text = `Hi,\n\nA password reset was requested for your Apache Studio account. Open this link to set a new password (expires in 1 hour):\n\n${actionLink}\n\nIf you did not request this, you can ignore this email.\n\n— Apache Studio`;
        const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a"><div style="max-width:560px;margin:0 auto;padding:24px"><p style="font-size:15px;line-height:1.55">Hi,</p><p style="font-size:15px;line-height:1.55">A password reset was requested for your Apache Studio account.</p><p style="margin:24px 0"><a href="${actionLink}" style="background:#1e40af;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;display:inline-block">Reset password</a></p><p style="font-size:13px;color:#475569;word-break:break-all">${actionLink}</p><p style="font-size:12px;color:#64748b;margin-top:20px">This link expires in 1 hour. If you didn't request it, ignore this email.</p></div></body></html>`;
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL, to: [email], reply_to: REPLY_TO,
            subject: 'Reset your Apache Studio password',
            text, html,
            headers: { 'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=unsubscribe>` },
            tags: [{ name: 'category', value: 'password_reset' }],
          }),
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
