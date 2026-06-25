// providers/deepseek-minimax.ts — DeepSeek és MiniMax közvetlen adapterek.
// Mindkettő OpenAI-kompatibilis chat/completions végpontot biztosít, így
// az OpenAiProvider osztályt használjuk más baseUrl + id-vel, ahelyett hogy
// duplikálnánk a logikát.
import { OpenAiProvider } from "./openai";
import type { ProviderCredentials } from "../types";

export function createDeepSeekProvider(creds: ProviderCredentials) {
  return new OpenAiProvider(
    { ...creds, baseUrl: creds.baseUrl ?? "https://api.deepseek.com/v1" },
    { id: "deepseek", displayName: "DeepSeek" }
  );
}

export function createMiniMaxProvider(creds: ProviderCredentials) {
  return new OpenAiProvider(
    { ...creds, baseUrl: creds.baseUrl ?? "https://api.minimax.chat/v1" },
    { id: "minimax", displayName: "MiniMax" }
  );
}

// Copilot's OpenAI-compatible endpoint, same pattern.
export function createCopilotProvider(creds: ProviderCredentials) {
  return new OpenAiProvider(
    { ...creds, baseUrl: creds.baseUrl ?? "https://api.githubcopilot.com" },
    { id: "copilot", displayName: "GitHub Copilot" }
  );
}
