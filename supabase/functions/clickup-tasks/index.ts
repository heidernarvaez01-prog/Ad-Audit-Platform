import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CU = "https://api.clickup.com/api/v2";

// ClickUp personal token auth header (no "Bearer")
function cuHeaders(token: string) {
  return { Authorization: token, "Content-Type": "application/json" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TOKEN = Deno.env.get("CLICKUP_API_TOKEN");
    const TEAM_ID_ENV = Deno.env.get("CLICKUP_TEAM_ID");

    // Auth — only signed-in app users
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const email = (userData.user.email ?? "").toLowerCase();

    // Not connected yet — the app shows a friendly "connect ClickUp" state
    if (!TOKEN) return json({ connected: false });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = (body?.action as string) ?? "list";

    // Resolve team + the ClickUp member matching the signed-in email
    const resolveTeam = async () => {
      const res = await fetch(`${CU}/team`, { headers: cuHeaders(TOKEN) });
      if (!res.ok) throw new Error(`ClickUp team fetch failed (${res.status})`);
      const data = await res.json();
      const teams = data.teams ?? [];
      const team = TEAM_ID_ENV ? teams.find((t: any) => t.id === TEAM_ID_ENV) ?? teams[0] : teams[0];
      if (!team) throw new Error("No ClickUp workspace found for this token");
      const member = (team.members ?? []).find((m: any) =>
        (m.user?.email ?? "").toLowerCase() === email);
      return { teamId: team.id as string, memberId: member?.user?.id as number | undefined };
    };

    // ── list: my open tasks ──
    if (action === "list") {
      const { teamId, memberId } = await resolveTeam();
      if (!memberId) {
        return json({ connected: true, matched: false, email, tasks: [] });
      }
      const url = new URL(`${CU}/team/${teamId}/task`);
      url.searchParams.set("assignees[]", String(memberId));
      url.searchParams.set("subtasks", "true");
      url.searchParams.set("include_closed", String(!!body.includeClosed));
      url.searchParams.set("order_by", "due_date");
      const res = await fetch(url.toString(), { headers: cuHeaders(TOKEN) });
      if (!res.ok) throw new Error(`ClickUp tasks fetch failed (${res.status})`);
      const data = await res.json();
      const tasks = (data.tasks ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        status: t.status?.status ?? null,
        statusColor: t.status?.color ?? null,
        dueDate: t.due_date ? Number(t.due_date) : null,
        priority: t.priority?.priority ?? null,
        listName: t.list?.name ?? null,
        spaceName: t.space?.name ?? null,
        url: t.url,
      }));
      return json({ connected: true, matched: true, tasks });
    }

    // ── task: detail + comments + available statuses ──
    if (action === "task") {
      const taskId = String(body.taskId ?? "");
      if (!taskId) return json({ error: "taskId required" }, 400);
      const [tRes, cRes] = await Promise.all([
        fetch(`${CU}/task/${taskId}`, { headers: cuHeaders(TOKEN) }),
        fetch(`${CU}/task/${taskId}/comment`, { headers: cuHeaders(TOKEN) }),
      ]);
      if (!tRes.ok) throw new Error(`ClickUp task fetch failed (${tRes.status})`);
      const t = await tRes.json();
      const c = cRes.ok ? await cRes.json() : { comments: [] };

      // Available statuses come from the task's list
      let statuses: { status: string; color: string }[] = [];
      const listId = t.list?.id;
      if (listId) {
        const lRes = await fetch(`${CU}/list/${listId}`, { headers: cuHeaders(TOKEN) });
        if (lRes.ok) {
          const l = await lRes.json();
          statuses = (l.statuses ?? []).map((s: any) => ({ status: s.status, color: s.color }));
        }
      }

      return json({
        connected: true,
        task: {
          id: t.id,
          name: t.name,
          description: t.description ?? t.text_content ?? "",
          status: t.status?.status ?? null,
          statusColor: t.status?.color ?? null,
          dueDate: t.due_date ? Number(t.due_date) : null,
          priority: t.priority?.priority ?? null,
          listName: t.list?.name ?? null,
          assignees: (t.assignees ?? []).map((a: any) => a.username ?? a.email),
          url: t.url,
        },
        comments: (c.comments ?? []).map((cm: any) => ({
          id: cm.id,
          text: cm.comment_text ?? "",
          user: cm.user?.username ?? cm.user?.email ?? "—",
          date: cm.date ? Number(cm.date) : null,
        })),
        statuses,
      });
    }

    // ── comment: reply on a task ──
    if (action === "comment") {
      const taskId = String(body.taskId ?? "");
      const text = String(body.text ?? "").trim();
      if (!taskId || !text) return json({ error: "taskId and text required" }, 400);
      const res = await fetch(`${CU}/task/${taskId}/comment`, {
        method: "POST",
        headers: cuHeaders(TOKEN),
        body: JSON.stringify({ comment_text: text, notify_all: true }),
      });
      if (!res.ok) throw new Error(`ClickUp comment failed (${res.status})`);
      return json({ ok: true });
    }

    // ── set_status: move task (e.g., mark complete) ──
    if (action === "set_status") {
      const taskId = String(body.taskId ?? "");
      const status = String(body.status ?? "").trim();
      if (!taskId || !status) return json({ error: "taskId and status required" }, 400);
      const res = await fetch(`${CU}/task/${taskId}`, {
        method: "PUT",
        headers: cuHeaders(TOKEN),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`ClickUp status update failed (${res.status})`);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
