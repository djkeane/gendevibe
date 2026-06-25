// registry.ts — central registry + task-aware router
import type { ModelProvider, ProviderCredentials, ChatRequest, ChatResponse } from "./types";
import { OllamaProvider } from "./providers/ollama";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenRouterProvider } from "./providers/openrouter";
import { OpenAiProvider } from "./providers/openai";
import { GoogleProvider } from "./providers/google";
import {
  createDeepSeekProvider,
  createMiniMaxProvider,
  createCopilotProvider,
} from "./providers/deepseek-minimax";
import { JanAiProvider } from "./hermes/index";
// OpenCode nem külön API-szolgáltató, hanem egy lokálisan futó coding-agent
// CLI — más eszközök (Ollama/OpenRouter) modelljeit hívja meghajtóként, ezért
// itt nincs hozzá dedikált ModelProvider; a futtatáshoz lásd a README
// "OpenCode" szakaszát.

export type TaskKind = "plan" | "execute" | "chat" | "vision" | "embed";

export interface RoutingRule {
  task: TaskKind;
  providerId: string;
  model: string;
}

export class ProviderRegistry {
  private providers = new Map<string, ModelProvider>();
  private routes: RoutingRule[] = [];

  register(provider: ModelProvider) {
    this.providers.set(provider.id, provider);
  }

  get(id: string): ModelProvider {
    const p = this.providers.get(id);
    if (!p) throw new Error(`Provider nincs regisztrálva: ${id}`);
    return p;
  }

  list(): ModelProvider[] {
    return [...this.providers.values()];
  }

  async healthCheckAll() {
    const results: Record<string, { ok: boolean; message?: string }> = {};
    for (const p of this.providers.values()) {
      results[p.id] = await p.healthCheck();
    }
    return results;
  }

  // Per-task default routing, overridable per-project/per-component from the
  // settings UI. Default policy: lokális Ollama a gyors/olcsó executor
  // munkára, erős cloud modell a tervezéshez.
  setRoute(rule: RoutingRule) {
    this.routes = this.routes.filter((r) => r.task !== rule.task);
    this.routes.push(rule);
  }

  private routeFor(task: TaskKind): RoutingRule {
    const found = this.routes.find((r) => r.task === task);
    if (found) return found;
    // sane defaults if nothing configured yet
    if (task === "plan") return { task, providerId: "anthropic", model: "claude-sonnet-4-6" };
    return { task, providerId: "ollama", model: "qwen2.5-coder:7b" };
  }

  async run(task: TaskKind, req: ChatRequest, override?: { providerId?: string; model?: string }): Promise<ChatResponse> {
    const route = this.routeFor(task);
    const providerId = override?.providerId ?? route.providerId;
    const model = override?.model ?? route.model;
    const provider = this.get(providerId);
    return provider.chat({ ...req, model });
  }
}

// --- bootstrap helper -------------------------------------------------

export interface BootstrapCredentials {
  anthropic?: ProviderCredentials;
  openrouter?: ProviderCredentials;
  ollama?: ProviderCredentials;
  openai?: ProviderCredentials;
  google?: ProviderCredentials;
  deepseek?: ProviderCredentials;
  minimax?: ProviderCredentials;
  copilot?: ProviderCredentials;
  jan?: ProviderCredentials;
}

export function createDefaultRegistry(creds: BootstrapCredentials): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new OllamaProvider(creds.ollama ?? {}));
  registry.register(new JanAiProvider(creds.jan ?? {}));
  if (creds.anthropic?.apiKey) registry.register(new AnthropicProvider(creds.anthropic));
  if (creds.openrouter?.apiKey) registry.register(new OpenRouterProvider(creds.openrouter));
  if (creds.openai?.apiKey) registry.register(new OpenAiProvider(creds.openai));
  if (creds.google?.apiKey) registry.register(new GoogleProvider(creds.google));
  if (creds.deepseek?.apiKey) registry.register(createDeepSeekProvider(creds.deepseek));
  if (creds.minimax?.apiKey) registry.register(createMiniMaxProvider(creds.minimax));
  if (creds.copilot?.apiKey) registry.register(createCopilotProvider(creds.copilot));

  registry.setRoute({ task: "plan", providerId: "anthropic", model: "claude-sonnet-4-6" });
  registry.setRoute({ task: "execute", providerId: "ollama", model: "qwen2.5-coder:7b" });
  registry.setRoute({ task: "chat", providerId: "ollama", model: "jarvis-hu-coder-pi" });

  return registry;
}
