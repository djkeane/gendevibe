// agents/executor.ts — terv lépésenkénti végrehajtása build-ellenőrzéssel
//
// Minta: Convex Chef "ne egyben dobjon mindent" elve, a saját stackedre
// (Node/Postgres/pgvector, nem Convex) átírva. Minden lépés után futtatunk
// egy build-checket; ha hibázik, megállunk és visszaadjuk a hibát a hívónak
// (pl. a Planner agentnek, hogy újratervezhessen), nem folytatjuk vakon.

import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ProviderRegistry } from "../registry";
import type { Plan, PlanStep } from "./planner";

export interface ExecutionResult {
  stepId: string;
  ok: boolean;
  message: string;
}

export interface ExecutorOptions {
  workspaceRoot: string;
  // pl. "npm run build" vagy "tsc --noEmit" — projektenként eltérő
  buildCommand: string;
  // ha igaz, minden lépés után lefuttatja a buildCommand-ot;
  // ha hamis, csak a terv végén egyszer
  buildCheckAfterEachStep?: boolean;
}

const EXECUTOR_SYSTEM_PROMPT = `Te a GenDevibe Kivitelező agentje vagy.
Egy konkrét tervlépést kapsz. Generáld a kért fájl TELJES tartalmát vagy a
kért parancsot. Válaszolj KIZÁRÓLAG a fájl nyers tartalmával vagy a parancs
szövegével — ne adj hozzá magyarázatot, ne csomagold code-fence-be.`;

export class ExecutorAgent {
  constructor(
    private registry: ProviderRegistry,
    private opts: ExecutorOptions
  ) {}

  async run(plan: Plan, onProgress?: (r: ExecutionResult) => void): Promise<ExecutionResult[]> {
    if (!plan.approved) {
      throw new Error("A terv nincs jóváhagyva — futtasd a PlannerAgent.approve()-ot előbb.");
    }

    const results: ExecutionResult[] = [];

    for (const step of plan.steps) {
      const result = await this.runStep(step);
      results.push(result);
      onProgress?.(result);

      if (!result.ok) {
        // megállunk az első hibánál — nem folytatjuk vakon a következő
        // lépéssel egy törött köztes állapotból
        break;
      }

      if (this.opts.buildCheckAfterEachStep) {
        const buildResult = await this.runBuildCheck();
        results.push(buildResult);
        onProgress?.(buildResult);
        if (!buildResult.ok) break;
      }
    }

    if (!this.opts.buildCheckAfterEachStep) {
      const finalBuild = await this.runBuildCheck();
      results.push(finalBuild);
      onProgress?.(finalBuild);
    }

    return results;
  }

  private async runStep(step: PlanStep): Promise<ExecutionResult> {
    try {
      switch (step.kind) {
        case "create_file":
        case "edit_file":
          return await this.handleFileStep(step);
        case "install_dependency":
          return await this.handleInstallStep(step);
        case "run_command":
          return await this.handleCommandStep(step);
        case "design_component":
          return await this.handleDesignStep(step);
        default:
          return { stepId: step.id, ok: false, message: `Ismeretlen lépés-típus: ${step.kind}` };
      }
    } catch (err) {
      return { stepId: step.id, ok: false, message: (err as Error).message };
    }
  }

  private async handleFileStep(step: PlanStep): Promise<ExecutionResult> {
    if (!step.target) {
      return { stepId: step.id, ok: false, message: "Hiányzik a fájl célútja (target)." };
    }
    const fullPath = `${this.opts.workspaceRoot}/${step.target}`;

    const response = await this.registry.run("execute", {
      messages: [
        { role: "system", content: EXECUTOR_SYSTEM_PROMPT },
        { role: "user", content: step.description },
      ],
    });

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, response.content, "utf8");

    return {
      stepId: step.id,
      ok: true,
      message: `Fájl megírva: ${step.target} (${response.provider}/${response.model})`,
    };
  }

  private async handleInstallStep(step: PlanStep): Promise<ExecutionResult> {
    if (!step.target) {
      return { stepId: step.id, ok: false, message: "Hiányzik a telepítendő csomag neve." };
    }
    const result = await runShellCommand("npm", ["install", step.target], this.opts.workspaceRoot);
    return {
      stepId: step.id,
      ok: result.code === 0,
      message: result.code === 0 ? `Telepítve: ${step.target}` : result.output,
    };
  }

  private async handleCommandStep(step: PlanStep): Promise<ExecutionResult> {
    if (!step.target) {
      return { stepId: step.id, ok: false, message: "Hiányzik a futtatandó parancs." };
    }
    const [cmd, ...args] = step.target.split(" ");
    const result = await runShellCommand(cmd, args, this.opts.workspaceRoot);
    return { stepId: step.id, ok: result.code === 0, message: result.output };
  }

  private async handleDesignStep(step: PlanStep): Promise<ExecutionResult> {
    // Design-komponens lépés: a vizuális réteg (Webstudio-szerű élő szerkesztő)
    // felelőssége, itt csak jelezzük, hogy ez a lépés kézi/UI beavatkozást
    // igényel, nem automatikus kódgenerálást.
    return {
      stepId: step.id,
      ok: true,
      message: `Design lépés jelölve, vizuális szerkesztőben végzendő: ${step.description}`,
    };
  }

  private async runBuildCheck(): Promise<ExecutionResult> {
    const [cmd, ...args] = this.opts.buildCommand.split(" ");
    const result = await runShellCommand(cmd, args, this.opts.workspaceRoot);
    return {
      stepId: "build-check",
      ok: result.code === 0,
      message: result.code === 0 ? "Build OK" : `Build hiba:\n${result.output}`,
    };
  }
}

function runShellCommand(
  cmd: string,
  args: string[],
  cwd: string
): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, shell: true });
    let output = "";
    proc.stdout.on("data", (d) => (output += d.toString()));
    proc.stderr.on("data", (d) => (output += d.toString()));
    proc.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}
