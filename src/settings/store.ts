// settings/store.ts — API kulcsok és nyelv beállítás betöltése .env-ből
//
// Egyszerű, függőségmentes .env betöltés (nincs szükség a `dotenv` pacakage-re
// telepítéskor — process.env-ből olvasunk, amit a host alkalmazás vagy egy
// `.env` fájl már betöltött a futás előtt).

import type { BootstrapCredentials } from "../registry";
import type { Locale } from "../i18n/index";

export function loadCredentialsFromEnv(): BootstrapCredentials {
  return {
    anthropic: process.env.ANTHROPIC_API_KEY
      ? { apiKey: process.env.ANTHROPIC_API_KEY }
      : undefined,
    openrouter: process.env.OPENROUTER_API_KEY
      ? { apiKey: process.env.OPENROUTER_API_KEY }
      : undefined,
    ollama: { baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434" },
  };
}

export function loadExtraCredentialsFromEnv() {
  return {
    openai: process.env.OPENAI_API_KEY ? { apiKey: process.env.OPENAI_API_KEY } : undefined,
    google: process.env.GOOGLE_AI_API_KEY ? { apiKey: process.env.GOOGLE_AI_API_KEY } : undefined,
    deepseek: process.env.DEEPSEEK_API_KEY ? { apiKey: process.env.DEEPSEEK_API_KEY } : undefined,
    minimax: process.env.MINIMAX_API_KEY ? { apiKey: process.env.MINIMAX_API_KEY } : undefined,
    copilot: process.env.COPILOT_API_KEY ? { apiKey: process.env.COPILOT_API_KEY } : undefined,
    jan: { baseUrl: process.env.JAN_BASE_URL ?? "http://127.0.0.1:1337/v1" },
    figma: process.env.FIGMA_TOKEN ? { personalAccessToken: process.env.FIGMA_TOKEN } : undefined,
  };
}

export function loadLocaleFromEnv(): Locale {
  return process.env.GENDEVIBE_LOCALE === "en" ? "en" : "hu";
}
