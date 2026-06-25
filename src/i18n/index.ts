// i18n/index.ts — nyelvválasztó: magyar és angol

export type Locale = "hu" | "en";

export const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: "hu", label: "Magyar" },
  { code: "en", label: "English" },
];

export const DEFAULT_LOCALE: Locale = "hu";

export const strings: Record<Locale, Record<string, string>> = {
  hu: {
    "settings.language": "Nyelv",
    "settings.providers": "Modell-szolgáltatók",
    "settings.apiKey": "API kulcs",
    "settings.healthCheck": "Kapcsolat ellenőrzése",
    "planner.title": "Tervező",
    "planner.approve": "Terv jóváhagyása",
    "planner.reject": "Terv elvetése",
    "executor.title": "Kivitelező",
    "executor.running": "Generálás folyamatban…",
    "executor.buildCheck": "Build ellenőrzés",
    "references.title": "Referenciák",
    "references.add": "Referencia hozzáadása",
    "figma.import": "Figma fájl importálása",
    "figma.export": "Csomópontok exportálása Figmába",
    "pencil.open": "Pencil dokumentum megnyitása",
  },
  en: {
    "settings.language": "Language",
    "settings.providers": "Model Providers",
    "settings.apiKey": "API Key",
    "settings.healthCheck": "Check connection",
    "planner.title": "Planner",
    "planner.approve": "Approve plan",
    "planner.reject": "Reject plan",
    "executor.title": "Executor",
    "executor.running": "Generating…",
    "executor.buildCheck": "Build check",
    "references.title": "References",
    "references.add": "Add reference",
    "figma.import": "Import Figma file",
    "figma.export": "Export nodes to Figma",
    "pencil.open": "Open Pencil document",
  },
};

export function t(key: string, locale: Locale = DEFAULT_LOCALE): string {
  return strings[locale][key] ?? key;
}
