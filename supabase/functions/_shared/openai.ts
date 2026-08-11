// Centralizes the raw fetch to OpenAI's chat completions endpoint —
// previously duplicated in audit-insight, weekly-report and
// metrics-ai-analysis (three near-identical copies of the same fetch +
// error handling). Same spirit as _shared/email.ts for Resend.
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Forces a valid-JSON response body (OpenAI's `response_format: json_object`).
   *  The prompt must itself instruct the model to return JSON — this only
   *  enforces it, it doesn't add the instruction. */
  jsonMode?: boolean;
}

export interface ChatCompletionResult {
  ok: boolean;
  content: string;
  status?: number;
  error?: string;
  rateLimited?: boolean;
}

export async function chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { ok: false, content: '', error: 'OPENAI_API_KEY is not configured' };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 800,
        ...(params.temperature != null ? { temperature: params.temperature } : {}),
        ...(params.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: params.messages,
      }),
    });

    if (res.status === 429) {
      return { ok: false, content: '', status: 429, rateLimited: true, error: 'Rate limit exceeded' };
    }
    if (!res.ok) {
      const text = await res.text();
      console.error('OpenAI API error:', res.status, text);
      return { ok: false, content: '', status: res.status, error: `OpenAI API error (${res.status})` };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return { ok: true, content };
  } catch (e) {
    return { ok: false, content: '', error: (e as Error).message };
  }
}
