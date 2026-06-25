// providers/google.ts — Google AI (Gemini)
import type { ModelProvider, ChatRequest, ChatResponse, ProviderCredentials } from "../types";

export class GoogleProvider implements ModelProvider {
  readonly id = "google";
  readonly displayName = "Gemini (Google AI)";
  readonly supportsTools = true;
  readonly supportsStreaming = false; // simplest path uses generateContent (non-stream)
  readonly isLocal = false;

  private apiKey: string;
  private baseUrl: string;

  constructor(creds: ProviderCredentials) {
    if (!creds.apiKey) throw new Error("Google AI: hiányzó API kulcs");
    this.apiKey = creds.apiKey;
    this.baseUrl = creds.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
    if (!res.ok) throw new Error(`Google listModels failed: ${res.status}`);
    const data = await res.json();
    return (data.models ?? []).map((m: { name: string }) => m.name.replace("models/", ""));
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? "gemini-2.5-pro";
    const system = req.messages.find((m) => m.role === "system")?.content;
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const res = await fetch(`${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: {
          temperature: req.temperature ?? 0.3,
          maxOutputTokens: req.maxTokens ?? 4096,
        },
      }),
    });
    if (!res.ok) throw new Error(`Google chat failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join("") ?? "";

    return {
      content: text,
      model,
      provider: this.id,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
      },
      stopReason: "stop",
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
