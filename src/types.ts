// types.ts — GenDevibe Model Provider Abstraction Layer (MPAL)

export type Role = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: Role;
  content: string;
  // for tool-result messages
  toolCallId?: string;
  name?: string;
}

export interface ToolDef {
  name: string;
  description: string;
  // JSON schema for parameters
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  model: string;
  provider: string;
  // raw usage if the provider reports it
  usage?: { inputTokens?: number; outputTokens?: number };
  stopReason?: "stop" | "tool_use" | "length" | "error";
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  model?: string; // override the provider's default model
  stream?: boolean;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
  toolCall?: ToolCall;
}

/**
 * Every provider (Ollama, Anthropic, OpenAI/Copilot, Google, DeepSeek,
 * MiniMax, OpenCode, OpenRouter) implements this single contract.
 * The rest of GenDevibe (Planner agent, Executor agent, Hermes) never
 * talks to a vendor SDK directly — only to this interface.
 */
export interface ModelProvider {
  readonly id: string; // "anthropic", "ollama", "openrouter", ...
  readonly displayName: string;
  readonly supportsTools: boolean;
  readonly supportsStreaming: boolean;
  readonly isLocal: boolean;

  listModels(): Promise<string[]>;

  chat(req: ChatRequest): Promise<ChatResponse>;

  streamChat?(
    req: ChatRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<ChatResponse>;

  // Lightweight reachability/credential check, used by the settings UI
  // and by health checks before a task is routed to this provider.
  healthCheck(): Promise<{ ok: boolean; message?: string }>;
}

export interface ProviderCredentials {
  apiKey?: string;
  baseUrl?: string; // override (e.g. local Ollama at 127.0.0.1:11434)
  orgId?: string;
}
