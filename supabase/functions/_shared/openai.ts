// Shared OpenAI helper for all generative-AI edge functions.
// The key is read from the OPENAI_API_KEY project secret — never hardcoded.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export function getOpenAIKey(): string {
  const k = Deno.env.get("OPENAI_API_KEY");
  if (!k) throw new Error("OPENAI_API_KEY is not configured");
  return k;
}

export interface ChatOpts {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/** Non-streaming chat completion. Returns { text } or { error, status }. */
export async function openaiChat(opts: ChatOpts): Promise<{ text: string; status: number; error?: string }> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${getOpenAIKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      max_tokens: opts.maxTokens ?? 1200,
      temperature: opts.temperature ?? 0.5,
    }),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "OpenAI error");
    console.error("OpenAI error", res.status, error);
    return { text: "", status: res.status, error };
  }
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content ?? "", status: 200 };
}

/** Streaming chat completion. Returns the raw fetch Response (SSE) to pipe through. */
export async function openaiStream(opts: ChatOpts): Promise<Response> {
  return await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${getOpenAIKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      max_tokens: opts.maxTokens ?? 16000,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    }),
  });
}
