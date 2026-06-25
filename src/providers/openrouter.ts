// providers/openrouter.ts
// One adapter, many vendors: OpenRouter exposes a single OpenAI-compatible
// endpoint that proxies to DeepSeek, MiniMax, Gemini, GPT, etc. Use this as
// the catch-all / fallback provider so you don't need a bespoke adapter for
// every single vendor on day one.
import type {
  ModelProvider,
  ChatRequest,
  ChatResponse,
  ProviderCredentials,
} from "../types";

export class OpenRouterProvider implements ModelProvider {
  readonly id = "openrouter";
  readonly displayName = "OpenRouter (aggregátor)";
  readonly supportsTools = true;
  readonly supportsStreaming = true;
  readonly isLocal = false;

  private apiKey: string;
  private baseUrl: string;

  constructor(creds: ProviderCredentials) {
    if (!creds.apiKey) throw new Error("OpenRouter: hiányzó API kulcs");
    this.apiKey = creds.apiKey;
    this.baseUrl = creds.baseUrl ?? "https://openrouter.ai/api/v1";
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) throw new Error(`OpenRouter listModels failed: ${res.status}`);
    const data = await res.json();
    return (data.data ?? []).map((m: { id: string }) => m.id);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    // model string examples routed through OpenRouter:
    //   "google/gemini-2.5-pro", "deepseek/deepseek-chat",
    //   "minimax/minimax-01", "openai/gpt-4.1"
    const model = req.model ?? "deepseek/deepseek-chat";
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://myjarvis.cc",
        "X-Title": "GenDevibe",
      },
      body: JSON.stringify({
        model,
        messages: req.messages,
        temperature: req.temperature ?? 0.3,
        max_tokens: req.maxTokens ?? 4096,
        tools: req.tools?.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter chat failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const toolCalls = (msg?.tool_calls ?? []).map(
      (tc: { id: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || "{}"),
      })
    );

    return {
      content: msg?.content ?? "",
      toolCalls: toolCalls.length ? toolCalls : undefined,
      model,
      provider: this.id,
      usage: {
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
      },
      stopReason: toolCalls.length ? "tool_use" : "stop",
    };
  }

  async healthCheck() {
    try {
      await this.listModels();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }
}
