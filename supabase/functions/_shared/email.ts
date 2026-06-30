// Direct Resend send — no Lovable gateway dependency.
// from address comes from RESEND_FROM; we default to the team's VERIFIED domain
// (apachestudio.mx) so messages land in the inbox instead of spam. Override
// RESEND_FROM only with another verified sender. A reply-to defaults to support.

export async function sendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ ok: boolean; id?: string; status?: number; error?: unknown }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };
  const from = Deno.env.get("RESEND_FROM") || "Apache Studio <alertas@apachestudio.mx>";
  const replyTo = opts.replyTo || Deno.env.get("RESEND_REPLY_TO") || "soporte@apachestudio.mx";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      reply_to: replyTo,
      headers: {
        "List-Unsubscribe": `<mailto:${replyTo}?subject=unsubscribe>`,
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend send failed", res.status, JSON.stringify(data));
    return { ok: false, status: res.status, error: data };
  }
  return { ok: true, id: (data as { id?: string }).id };
}
