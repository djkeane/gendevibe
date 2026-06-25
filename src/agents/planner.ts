// agents/planner.ts — terv → jóváhagyás → kivitelezés első lépése
import type { ProviderRegistry } from "../registry";
import type { ReferenceCollector } from "../hermes/index";

export interface PlanStep {
  id: string;
  description: string;
  kind: "create_file" | "edit_file" | "install_dependency" | "run_command" | "design_component";
  target?: string; // file path or package name
}

export interface Plan {
  summary: string;
  steps: PlanStep[];
  approved: boolean;
}

const PLANNER_SYSTEM_PROMPT = `Te a GenDevibe Tervező agentje vagy.
A felhasználói kérésből bontsd fel a feladatot konkrét, sorszámozott lépésekre
(fájl létrehozás, szerkesztés, függőség telepítés, parancs futtatás, vagy
design-komponens létrehozás). Ne írj kódot, csak a tervet. Válaszolj KIZÁRÓLAG
egy JSON objektummal, ami megfelel ennek a formának:
{"summary": "...", "steps": [{"id": "1", "description": "...", "kind": "create_file", "target": "..."}]}`;

export class PlannerAgent {
  constructor(
    private registry: ProviderRegistry,
    private referenceCollector?: ReferenceCollector
  ) {}

  async plan(userPrompt: string, opts?: { referenceTag?: string }): Promise<Plan> {
    const referenceContext = this.referenceCollector?.toPlannerContext(opts?.referenceTag);

    const messages = [
      { role: "system" as const, content: PLANNER_SYSTEM_PROMPT },
      ...(referenceContext
        ? [{ role: "user" as const, content: `Referenciák:\n${referenceContext}` }]
        : []),
      { role: "user" as const, content: userPrompt },
    ];

    const response = await this.registry.run("plan", { messages });

    let parsed: { summary: string; steps: PlanStep[] };
    try {
      parsed = JSON.parse(extractJson(response.content));
    } catch {
      throw new Error(
        `A tervező agent válasza nem volt érvényes JSON. Nyers válasz: ${response.content.slice(0, 300)}`
      );
    }

    return { summary: parsed.summary, steps: parsed.steps, approved: false };
  }

  approve(plan: Plan): Plan {
    return { ...plan, approved: true };
  }
}

// A modellek néha markdown code-fence-be csomagolják a JSON-t; ezt levágjuk.
function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}
