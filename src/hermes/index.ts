// hermes/index.ts — Hermes-képességek átemelve GenDevibe-be
//
// A korábbi Hermes MCP szerver (Raindrop.io + Jan.ai + Agentverse) három
// hasznos mintáját emeljük át, amik GenDevibe-ben is releváns funkciók:
//
// 1. Research/bookmark memory  → "referencia gyűjtő" a tervezési fázishoz
//    (mentett UI mintát, oldal-referenciát, Figma linket egy gyűjtőbe rakni,
//     amit a Planner agent kontextusként használhat).
// 2. Jan.ai local API adapter   → még egy lokális, OpenAI-kompatibilis
//    endpoint provider — hasznos ha valaki nem Ollamát, hanem Jant futtat.
// 3. Disk/cleanup diagnosztika  → a Mac mini lemezhely-monitorozás mintája,
//    GenDevibe build cache (node_modules, .next, dist) automatikus
//    karbantartására hasznosítva.

import { randomUUID } from "node:crypto";
import type { ModelProvider, ChatRequest, ChatResponse, ProviderCredentials } from "../types";

// --- 1. Research/bookmark memory --------------------------------------

export interface ReferenceItem {
  id: string;
  url: string;
  title: string;
  tags: string[];
  note?: string;
  capturedAt: string; // ISO date
  // optional: a screenshot or Figma node snapshot for visual reference
  thumbnailPath?: string;
}

export class ReferenceCollector {
  private items = new Map<string, ReferenceItem>();

  add(item: Omit<ReferenceItem, "id" | "capturedAt">): ReferenceItem {
    const id = randomUUID();
    const full: ReferenceItem = { ...item, id, capturedAt: new Date().toISOString() };
    this.items.set(id, full);
    return full;
  }

  byTag(tag: string): ReferenceItem[] {
    return [...this.items.values()].filter((i) => i.tags.includes(tag));
  }

  // Feeds straight into the Planner agent's context window as a compact
  // bullet list, so visual references stay cheap on tokens.
  toPlannerContext(tag?: string): string {
    const list = tag ? this.byTag(tag) : [...this.items.values()];
    return list
      .map((i) => `- [${i.title}](${i.url})${i.note ? ` — ${i.note}` : ""}`)
      .join("\n");
  }

  all(): ReferenceItem[] {
    return [...this.items.values()];
  }
}

// --- 2. Jan.ai local provider adapter ----------------------------------
// Jan.ai exposes an OpenAI-compatible local API (default 127.0.0.1:1337/v1).
// Useful as an alternative to Ollama for people already running Jan.

export class JanAiProvider implements ModelProvider {
  readonly id = "jan";
  readonly displayName = "Jan.ai (lokális)";
  readonly supportsTools = false; // Jan's local API has inconsistent tool support across models
  readonly supportsStreaming = true;
  readonly isLocal = true;

  private baseUrl: string;

  constructor(creds: ProviderCredentials = {}) {
    this.baseUrl = creds.baseUrl ?? "http://127.0.0.1:1337/v1";
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models`);
    if (!res.ok) throw new Error(`Jan listModels failed: ${res.status}`);
    const data = await res.json();
    return (data.data ?? []).map((m: { id: string }) => m.id);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? "llama3:8b";
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: req.messages,
        temperature: req.temperature ?? 0.3,
      }),
    });
    if (!res.ok) throw new Error(`Jan chat failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content ?? "",
      model,
      provider: this.id,
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

// --- 3. Disk/build-cache diagnostics ------------------------------------
// Ported from the Mac mini disk-space diagnostics work: scan known heavy
// directories in a GenDevibe workspace and report what's safe to clean.

export interface CacheTarget {
  path: string;
  label: string;
  // a conservative guess; real size should be computed with `du` at call time
  safeToDelete: boolean;
}

export const KNOWN_BUILD_CACHES: CacheTarget[] = [
  { path: "node_modules", label: "npm/pnpm dependencies", safeToDelete: true },
  { path: ".next", label: "Next.js build cache", safeToDelete: true },
  { path: "dist", label: "build output", safeToDelete: true },
  { path: ".turbo", label: "Turborepo cache", safeToDelete: true },
  { path: ".electron-gyp", label: "Electron native build cache", safeToDelete: true },
];
