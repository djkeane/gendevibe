// providers/ollama.ts — local models (jarvis-hu-coder-pi, qwen2.5-coder, etc.)
import type {
  ModelProvider,
  ChatRequest,
  ChatResponse,
  ProviderCredentials,
  StreamChunk,
} from "../types";

export class OllamaProvider implements ModelProvider {
  readonly id = "ollama";
  readonly displayName = "Ollama (lokális)";
  readonly supportsTools = true; // depends on model, checked at call time
  readonly supportsStreaming = true;
  readonly isLocal = true;

  private baseUrl: string;

  constructor(creds: ProviderCredentials = {}) {
    this.baseUrl = creds.baseUrl ?? "http://127.0.0.1:11434";
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) throw new Error(`Ollama listModels failed: ${res.status}`);
    const data = await res.json();
    return (data.models ?? []).map((m: { name: string }) => m.name);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? "qwen2.5-coder:7b";
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        tools: req.tools?.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
        options: { temperature: req.temperature ?? 0.3 },
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`Ollama chat failed: ${res.status} ${await res.text()}`);
    const data = await res.json();

    const toolCalls = (data.message?.tool_calls ?? []).map(
      (tc: { function: { name: string; arguments: Record<string, unknown> } }, i: number) => ({
        id: `ollama-tc-${i}`,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })
    );

    return {
      content: data.message?.content ?? "",
      toolCalls: toolCalls.length ? toolCalls : undefined,
      model,
      provider: this.id,
      stopReason: toolCalls.length ? "tool_use" : "stop",
    };
  }

  async streamChat(
    req: ChatRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<ChatResponse> {
    const model = req.model ?? "qwen2.5-coder:7b";
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Ollama streamChat failed: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value).split("\n").filter(Boolean)) {
        const parsed = JSON.parse(line);
        const delta = parsed.message?.content ?? "";
        full += delta;
        onChunk({ delta, done: !!parsed.done });
      }
    }
    return { content: full, model, provider: this.id, stopReason: "stop" };
  }

  async healthCheck() {
    try {
      const models = await this.listModels();
      return { ok: true, message: `${models.length} lokális modell elérhető` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }
}
