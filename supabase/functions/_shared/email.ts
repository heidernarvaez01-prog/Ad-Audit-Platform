// Direct Resend send — no Lovable gateway dependency.
// from address is taken from RESEND_FROM (use a VERIFIED domain to land in the
// inbox; an unverified sender always goes to spam). Falls back to the Resend
// sandbox sender, which works for delivery testing but is flagged as spam.

export async function sendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ ok: boolean; id?: string; status?: number; error?: unknown }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };
  const from = Deno.env.get("RESEND_FROM") || "Apache Studio <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend send failed", res.status, JSON.stringify(data));
    return { ok: false, status: res.status, error: data };
  }
  return { ok: true, id: (data as { id?: string }).id };
}
