// providers/anthropic.ts
import type {
  ModelProvider,
  ChatRequest,
  ChatResponse,
  ProviderCredentials,
} from "../types";

export class AnthropicProvider implements ModelProvider {
  readonly id = "anthropic";
  readonly displayName = "Claude (Anthropic)";
  readonly supportsTools = true;
  readonly supportsStreaming = true;
  readonly isLocal = false;

  private apiKey: string;
  private baseUrl: string;

  constructor(creds: ProviderCredentials) {
    if (!creds.apiKey) throw new Error("Anthropic: hiányzó API kulcs");
    this.apiKey = creds.apiKey;
    this.baseUrl = creds.baseUrl ?? "https://api.anthropic.com/v1";
  }

  async listModels(): Promise<string[]> {
    // Anthropic has no public list endpoint in all SDK versions; keep a
    // maintained static fallback plus an optional live fetch attempt.
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      });
      if (res.ok) {
        const data = await res.json();
        return (data.data ?? []).map((m: { id: string }) => m.id);
      }
    } catch {
      /* fall through to static list */
    }
    return ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"];
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? "claude-sonnet-4-6";
    const system = req.messages.find((m) => m.role === "system")?.content;
    const messages = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        system,
        messages,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.3,
        tools: req.tools?.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        })),
      }),
    });
    if (!res.ok) throw new Error(`Anthropic chat failed: ${res.status} ${await res.text()}`);
    const data = await res.json();

    const textBlocks = (data.content ?? []).filter((b: { type: string }) => b.type === "text");
    const toolBlocks = (data.content ?? []).filter((b: { type: string }) => b.type === "tool_use");

    return {
      content: textBlocks.map((b: { text: string }) => b.text).join("\n"),
      toolCalls: toolBlocks.length
        ? toolBlocks.map((b: { id: string; name: string; input: Record<string, unknown> }) => ({
            id: b.id,
            name: b.name,
            arguments: b.input,
          }))
        : undefined,
      model,
      provider: this.id,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      },
      stopReason: data.stop_reason === "tool_use" ? "tool_use" : "stop",
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
