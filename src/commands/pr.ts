import type { Command } from "commander";
import { createPR } from "../core/pr.js";
import { printResult } from "./_shared.js";

export const registerPRCommand = (program: Command): void => {
  program
    .command("pr")
    .description("Push workspace branch and create GitHub PR")
    .argument("<repo>", "Repository name")
    .argument("<workspace>", "Workspace name")
    .action(async (repo: string, workspace: string) => {
      const result = await createPR(repo, workspace);
      printResult(result);
    });
};
