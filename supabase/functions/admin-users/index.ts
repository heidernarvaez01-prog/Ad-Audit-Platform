import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail } from '../_shared/email.ts';

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

// Branded action email (invite / password reset). The CTA points at the
// Supabase action_link we generate server-side, so it's always clickable and
// goes out through our own Resend sender (not Supabase's spam-prone SMTP).
function actionEmailHtml(opts: { heading: string; intro: string; cta: string; link: string }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="padding:28px 32px 8px;">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Apache Studio</div>
          <h1 style="margin:8px 0 0;font-size:22px;color:#111827;">${opts.heading}</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 4px;font-size:14px;line-height:1.6;color:#374151;">${opts.intro}</td></tr>
        <tr><td style="padding:20px 32px 8px;">
          <a href="${opts.link}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">${opts.cta}</a>
        </td></tr>
        <tr><td style="padding:8px 32px 28px;font-size:12px;color:#6b7280;line-height:1.6;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${opts.link}" style="color:#2563eb;word-break:break-all;">${opts.link}</a>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">Apache Studio · Ad Audit Platform</p>
    </td></tr>
  </table>
</body></html>`;
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

        // Does this person already have an account?
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list?.users?.find((u) => (u.email ?? '').toLowerCase() === email);

        // Generate the action link ourselves so we can deliver it via Resend
        // (reliable + branded) instead of Supabase's built-in SMTP. New people
        // get an "invite" link; existing accounts get a "recovery" link so they
        // can (re)set their password and regain access.
        const linkType = existing ? 'recovery' : 'invite';
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: linkType as 'invite' | 'recovery',
          email,
          options: redirectTo ? { redirectTo } : undefined,
        });
        if (linkErr) return json({ error: linkErr.message }, 400);

        const actionLink = linkData?.properties?.action_link;
        if (!actionLink) return json({ error: 'Could not generate invite link' }, 500);

        const html = actionEmailHtml({
          heading: existing ? 'Access your Apache Studio account' : "You've been invited to Apache Studio",
          intro: existing
            ? 'An administrator has updated your access. Use the button below to set a new password and sign in.'
            : "An administrator has invited you to join their team on Apache Studio. Click below to set your password and get started.",
          cta: existing ? 'Set password' : 'Accept invitation',
          link: actionLink,
        });

        const sent = await sendEmail({
          to: [email],
          subject: existing ? 'Access your Apache Studio account' : "You've been invited to Apache Studio",
          html,
        });
        if (!sent.ok) return json({ error: 'email_failed', details: sent.error }, 502);

        return json({ ok: true, userId: existing?.id ?? linkData?.user?.id, alreadyMember: !!existing });
      }

      if (action === 'reset_password') {
        const email = String(body?.email ?? '').trim().toLowerCase();
        if (!email) return json({ error: 'email required' }, 400);
        const redirectTo = body?.redirectTo ? String(body.redirectTo) : undefined;

        // Generate a recovery link and deliver it via Resend (branded, reliable).
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: redirectTo ? { redirectTo } : undefined,
        });
        if (linkErr) return json({ error: linkErr.message }, 400);

        const actionLink = linkData?.properties?.action_link;
        if (!actionLink) return json({ error: 'Could not generate reset link' }, 500);

        const html = actionEmailHtml({
          heading: 'Reset your password',
          intro: 'We received a request to reset the password for your Apache Studio account. Click below to choose a new one. If you didn\'t request this, you can ignore this email.',
          cta: 'Set new password',
          link: actionLink,
        });

        const sent = await sendEmail({
          to: [email],
          subject: 'Reset your Apache Studio password',
          html,
        });
        if (!sent.ok) return json({ error: 'email_failed', details: sent.error }, 502);

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
