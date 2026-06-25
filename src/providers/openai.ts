// providers/openai.ts — OpenAI and Copilot (OpenAI-compatible endpoint)
import type { ModelProvider, ChatRequest, ChatResponse, ProviderCredentials } from "../types";

export class OpenAiProvider implements ModelProvider {
  readonly id: string;
  readonly displayName: string;
  readonly supportsTools = true;
  readonly supportsStreaming = true;
  readonly isLocal = false;

  private apiKey: string;
  private baseUrl: string;

  // Pass baseUrl override + id="copilot" to reuse this adapter for
  // GitHub Copilot's OpenAI-compatible endpoint.
  constructor(creds: ProviderCredentials, opts?: { id?: string; displayName?: string }) {
    if (!creds.apiKey) throw new Error("OpenAI/Copilot: hiányzó API kulcs");
    this.apiKey = creds.apiKey;
    this.baseUrl = creds.baseUrl ?? "https://api.openai.com/v1";
    this.id = opts?.id ?? "openai";
    this.displayName = opts?.displayName ?? "OpenAI";
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) throw new Error(`${this.id} listModels failed: ${res.status}`);
    const data = await res.json();
    return (data.data ?? []).map((m: { id: string }) => m.id);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? "gpt-4.1";
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
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
    if (!res.ok) throw new Error(`${this.id} chat failed: ${res.status} ${await res.text()}`);
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
      usage: { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
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
