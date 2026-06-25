# GenDevibe Provider Registry

Multi-model provider réteg + Hermes-képességek + Figma/Pencil interop +
magyar/angol nyelvválasztó GenDevibe-hez.

## Telepítés (ezt futtasd sorban)

```bash
npm install
cp .env.example .env        # majd töltsd ki a kulcsokat, amiket használni akarsz
npm run build
npm run check
```

A `npm run check` után, ha az Ollama lokálisan fut (`ollama serve`), a
kimenetben `[OK] ollama` jelenik meg. A cloud providerek `.env` nélkül
`[NINCS ELÉRVE]`-t írnak — ez elvárt, nem hiba.

## Gyors futtatás fejlesztés közben (build nélkül)

```bash
npm run dev:check
```

## Mappa-struktúra

```
src/
  types.ts              — közös ModelProvider interfész
  registry.ts            — ProviderRegistry + task-alapú router
  providers/
    ollama.ts            — lokális Ollama
    anthropic.ts          — Claude
    openrouter.ts         — aggregátor (Gemini/DeepSeek/MiniMax/GPT egy kulccsal, fallback)
    openai.ts             — OpenAI + Copilot OpenAI-kompatibilis alaposztály
    google.ts             — Gemini direkt
    deepseek-minimax.ts   — DeepSeek, MiniMax, Copilot direkt (openai.ts-re épül)
  hermes/index.ts         — referencia-gyűjtő, Jan.ai provider, build-cache diagnosztika
  figma/
    adapter.ts            — Figma REST API node import/export
    pencil.ts             — Pencil (.ep/.epgz) dokumentum parser (jszip + fast-xml-parser, valódi implementáció)
  agents/
    planner.ts            — Tervező agent (prompt → JSON terv → jóváhagyás)
    executor.ts           — Kivitelező agent (terv lépésenkénti végrehajtása + build-check minden lépés után)
  i18n/index.ts            — hu/en stringek
  settings/store.ts        — .env betöltés
  check.ts                 — telepítés utáni smoke test
```

## Pencil parser

`src/figma/pencil.ts` valódi `.ep`/`.epgz` (ZIP+XML) beolvasást végez
(`jszip` + `fast-xml-parser`, már a `dependencies`-ben van). Ha a Te Pencil
fájljaid más mezőneveket használnak (verziótól függhet), a `parseShape`
függvényben kell igazítani.

## OpenCode

Az OpenCode egy lokálisan futó coding-agent CLI, nem önálló API-szolgáltató —
a már regisztrált modelleket (Ollama, OpenRouter stb.) hívja meghajtóként.
Külön `ModelProvider` adapter nem szükséges hozzá; a GenDevibe Executor agent
közvetlenül az OpenCode CLI-t indíthatja alfolyamatként, ha azt választod
kivitelezőnek.

## Routing alapértelmezés

| Feladat | Provider | Modell |
|---|---|---|
| plan (tervezés) | anthropic | claude-sonnet-4-6 |
| execute (kódgen) | ollama | qwen2.5-coder:7b |
| chat | ollama | jarvis-hu-coder-pi |

Felülírható projekt- vagy komponens-szinten a `registry.run(task, req, { providerId, model })` hívással.
