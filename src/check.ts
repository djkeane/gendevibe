// check.ts — telepítés utáni ellenőrzés:
// `npm install && npm run build && npm run check`
// Ez NEM hív élesben minden providert (azokhoz API kulcs kell), csak:
//  1) ellenőrzi, hogy a registry felépül hiba nélkül
//  2) lefuttatja az Ollama health checket (ha fut lokálisan)
//  3) kiírja, mely cloud providerek vannak API kulccsal konfigurálva
//  4) kiírja az aktuális nyelvi beállítást és néhány lefordított stringet

import { createDefaultRegistry } from "./registry";
import { loadCredentialsFromEnv, loadLocaleFromEnv } from "./settings/store";
import { t } from "./i18n/index";

async function main() {
  console.log("== GenDevibe Provider Registry — telepítés utáni ellenőrzés ==\n");

  const locale = loadLocaleFromEnv();
  console.log(`Nyelv: ${locale}`);
  console.log(`  ${t("settings.providers", locale)}`);
  console.log(`  ${t("planner.title", locale)} / ${t("executor.title", locale)}\n`);

  const creds = loadCredentialsFromEnv();
  const registry = createDefaultRegistry(creds);

  console.log("Regisztrált providerek:", registry.list().map((p) => p.id).join(", "));

  console.log("\nHealth check futtatása (csak a lokálisan elérhetők válaszolnak hiba nélkül,");
  console.log("a cloud providerek API kulcs nélkül 'ok: false' lesz — ez elvárt):\n");

  const results = await registry.healthCheckAll();
  for (const [id, result] of Object.entries(results)) {
    const status = result.ok ? "OK" : "NINCS ELÉRVE";
    console.log(`  [${status}] ${id}${result.message ? " — " + result.message : ""}`);
  }

  console.log("\nKész. Ha az Ollama [OK]-t kapott, a build és a futási környezet rendben van.");
  console.log("Cloud providerek aktiválásához tölts ki egy .env fájlt (.env.example mintára).");
}

main().catch((err) => {
  console.error("Hiba az ellenőrzés során:", err);
  process.exit(1);
});
